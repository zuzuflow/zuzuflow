import * as crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import { executionService } from "./ExecutionService";
import { credentialService } from "./CredentialService";
import { getTemporalClient } from "../temporal/client";
import { logger } from "../logger";
import type { WebhookAuth } from "@workflow/shared";

// =============================================================================
// WebhookService — manages inbound webhook endpoint registration and dispatch
// =============================================================================

export interface RegisterEndpointInput {
  workflowId: string;
  path: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  auth?: WebhookAuth;
  environmentId: string;
}

// ---------------------------------------------------------------------------
// Auth enforcement helpers
// ---------------------------------------------------------------------------

function verifyHmac(
  secret: string,
  rawBody: string,
  headers: Record<string, string | string[] | undefined>
) {
  const signature =
    (headers["x-webhook-signature"] as string | undefined) ||
    (headers["x-hub-signature-256"] as string | undefined);

  if (!signature) {
    throw Object.assign(new Error("Missing HMAC signature header (x-webhook-signature)"), {
      code: "UNAUTHORIZED",
    });
  }

  const expectedSig =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw Object.assign(new Error("Invalid HMAC signature"), { code: "UNAUTHORIZED" });
  }
}

function verifyBasic(
  username: string,
  password: string,
  headers: Record<string, string | string[] | undefined>
) {
  const authHeader = headers["authorization"] as string | undefined;
  if (!authHeader?.startsWith("Basic ")) {
    throw Object.assign(new Error("Missing Basic Authorization header"), { code: "UNAUTHORIZED" });
  }
  const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
  const colon = decoded.indexOf(":");
  const inUser = colon === -1 ? decoded : decoded.slice(0, colon);
  const inPass = colon === -1 ? "" : decoded.slice(colon + 1);

  // Constant-time comparison
  const userMatch =
    crypto.timingSafeEqual(Buffer.from(inUser), Buffer.from(username));
  const passMatch =
    crypto.timingSafeEqual(Buffer.from(inPass), Buffer.from(password));

  if (!userMatch || !passMatch) {
    throw Object.assign(new Error("Invalid Basic credentials"), { code: "UNAUTHORIZED" });
  }
}

async function verifyJwt(opts: {
  jwksUri?: string | null;
  publicKey?: string | null;
  issuer?: string | null;
  audience?: string | null;
  headers: Record<string, string | string[] | undefined>;
}) {
  const { jwksUri, publicKey, issuer, audience, headers } = opts;
  const authHeader = headers["authorization"] as string | undefined;
  if (!authHeader?.startsWith("Bearer ")) {
    throw Object.assign(new Error("Missing Bearer token in Authorization header"), {
      code: "UNAUTHORIZED",
    });
  }
  const token = authHeader.slice(7);

  // Parse header + payload without full verification first
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw Object.assign(new Error("Malformed JWT"), { code: "UNAUTHORIZED" });
  }

  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as {
    alg?: string;
    kid?: string;
  };
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
    iss?: string;
    aud?: string | string[];
    exp?: number;
  };

  // Expiry check
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw Object.assign(new Error("JWT has expired"), { code: "UNAUTHORIZED" });
  }

  // Issuer check
  if (issuer && payload.iss !== issuer) {
    throw Object.assign(
      new Error(`JWT issuer mismatch: expected "${issuer}", got "${payload.iss}"`),
      { code: "UNAUTHORIZED" }
    );
  }

  // Audience check
  if (audience) {
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(audience)) {
      throw Object.assign(
        new Error(`JWT audience mismatch: "${audience}" not in token`),
        { code: "UNAUTHORIZED" }
      );
    }
  }

  // Signature verification
  const signingInput = `${parts[0]}.${parts[1]}`;
  const sig = Buffer.from(parts[2], "base64url");

  let keyObj: crypto.KeyObject;

  if (jwksUri) {
    // Fetch public key from JWKS URI (uses Node 18+ built-in fetch)
    const res = await fetch(jwksUri);
    if (!res.ok) {
      throw Object.assign(new Error("Failed to fetch JWKS"), { code: "UNAUTHORIZED" });
    }
    const jwks = (await res.json()) as { keys: Array<{ kid?: string; n: string; e: string; kty: string }> };
    const kid = header.kid;
    const jwk = kid ? jwks.keys.find((k) => k.kid === kid) : jwks.keys[0];
    if (!jwk) {
      throw Object.assign(new Error("No matching JWK found"), { code: "UNAUTHORIZED" });
    }
    keyObj = crypto.createPublicKey({ key: jwk as any, format: "jwk" });
  } else if (publicKey) {
    keyObj = crypto.createPublicKey(publicKey);
  } else {
    // No key material — skip signature check (not recommended, but gracefully allow)
    logger.warn("JWT auth configured with no public key or jwksUri — skipping signature verification");
    return;
  }

  const alg = (header.alg ?? "RS256").toUpperCase();
  const hashAlg = alg.startsWith("ES") ? "SHA" + alg.slice(2) : "SHA" + alg.slice(2);

  const valid = crypto.verify(hashAlg, Buffer.from(signingInput), keyObj, sig);
  if (!valid) {
    throw Object.assign(new Error("JWT signature verification failed"), { code: "UNAUTHORIZED" });
  }
}

export class WebhookService {
  // ---------------------------------------------------------------------------
  // Lookup
  // ---------------------------------------------------------------------------
  async lookupEndpoint(path: string) {
    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { path },
      include: { workflow: true },
    });
    return endpoint;
  }

  // ---------------------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------------------
  async registerEndpoint(input: RegisterEndpointInput) {
    const { workflowId, path, method = "POST", auth, environmentId } = input;

    const workflow = await prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) {
      throw Object.assign(new Error(`Workflow ${workflowId} not found`), { code: "NOT_FOUND" });
    }

    const existing = await prisma.webhookEndpoint.findUnique({ where: { path } });
    if (existing) {
      throw Object.assign(
        new Error(`Webhook path "${path}" is already registered`),
        { code: "CONFLICT" }
      );
    }

    const authType = auth?.type ?? "none";

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        workflowId,
        path,
        method: method as Prisma.EnumHttpMethodFieldUpdateOperationsInput["set"],
        authType,
        secret:        auth?.type === "hmac"  ? auth.secret        : null,
        basicUsername: auth?.type === "basic" ? auth.username       : null,
        basicPassword: auth?.type === "basic" ? auth.password       : null,
        jwtJwksUri:    auth?.type === "jwt"   ? (auth.jwksUri ?? null)   : null,
        jwtPublicKey:  auth?.type === "jwt"   ? (auth.publicKey ?? null) : null,
        jwtIssuer:     auth?.type === "jwt"   ? (auth.issuer ?? null)    : null,
        jwtAudience:   auth?.type === "jwt"   ? (auth.audience ?? null)  : null,
        isActive: true,
        environmentId,
      },
    });

    logger.info("Webhook endpoint registered", { endpointId: endpoint.id, path, authType });
    return endpoint;
  }

  // ---------------------------------------------------------------------------
  // Update auth (called when workflow is saved with changed webhook config)
  // ---------------------------------------------------------------------------
  async updateEndpointAuth(id: string, auth: WebhookAuth) {
    const authType = auth.type;
    await prisma.webhookEndpoint.update({
      where: { id },
      data: {
        authType,
        secret:        auth.type === "hmac"  ? auth.secret        : null,
        basicUsername: auth.type === "basic" ? auth.username       : null,
        basicPassword: auth.type === "basic" ? auth.password       : null,
        jwtJwksUri:    auth.type === "jwt"   ? (auth.jwksUri ?? null)   : null,
        jwtPublicKey:  auth.type === "jwt"   ? (auth.publicKey ?? null) : null,
        jwtIssuer:     auth.type === "jwt"   ? (auth.issuer ?? null)    : null,
        jwtAudience:   auth.type === "jwt"   ? (auth.audience ?? null)  : null,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  async deleteEndpoint(id: string) {
    const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!endpoint) {
      throw Object.assign(new Error(`Webhook endpoint ${id} not found`), { code: "NOT_FOUND" });
    }
    await prisma.webhookEndpoint.delete({ where: { id } });
    logger.info("Webhook endpoint deleted", { endpointId: id });
  }

  // ---------------------------------------------------------------------------
  // Handle inbound webhook request
  // ---------------------------------------------------------------------------
  async handleInbound(opts: {
    path: string;
    method: string;
    headers: Record<string, string | string[] | undefined>;
    body: unknown;
    query: Record<string, unknown>;
  }) {
    const { path, method, headers, body, query } = opts;

    const endpoint = await this.lookupEndpoint(path);

    if (!endpoint) {
      throw Object.assign(new Error(`No webhook registered at path "${path}"`), {
        code: "NOT_FOUND",
      });
    }

    if (!endpoint.isActive) {
      throw Object.assign(new Error(`Webhook endpoint "${path}" is inactive`), {
        code: "ENDPOINT_INACTIVE",
      });
    }

    // ── Authentication ────────────────────────────────────────────────────────
    const authType = endpoint.authType ?? "none";
    const rawBody = typeof body === "string" ? body : JSON.stringify(body);

    // Check if the workflow template has an authCredentialId on the webhook node.
    // The credential is stored in the node config (not the DB endpoint row) so
    // updating the credential automatically applies on the next request.
    let resolvedCred: Record<string, string> | null = null;
    if (authType !== "none" && endpoint.workflow) {
      try {
        const template = endpoint.workflow.template as {
          nodes?: Array<{ kind: string; config?: { path?: string; authCredentialId?: string } }>;
        };
        const webhookNode = template.nodes?.find(
          (n) => n.kind === "webhook" && n.config?.path === path
        );
        const credId = webhookNode?.config?.authCredentialId;
        if (credId) {
          resolvedCred = await credentialService.resolveCredential(credId);
        }
      } catch (err) {
        logger.warn("Failed to resolve auth credential for webhook endpoint", { path, err });
        throw Object.assign(
          new Error("Failed to resolve auth credential for webhook endpoint"),
          { code: "UNAUTHORIZED" }
        );
      }
    }

    if (authType === "hmac") {
      const secret = resolvedCred?.secret ?? endpoint.secret;
      if (!secret) {
        throw Object.assign(new Error("HMAC auth configured but no secret stored"), {
          code: "UNAUTHORIZED",
        });
      }
      verifyHmac(secret, rawBody, headers);
    } else if (authType === "basic") {
      const username = resolvedCred?.username ?? endpoint.basicUsername;
      const password = resolvedCred?.password ?? endpoint.basicPassword;
      if (!username || !password) {
        throw Object.assign(new Error("Basic auth configured but credentials not stored"), {
          code: "UNAUTHORIZED",
        });
      }
      verifyBasic(username, password, headers);
    } else if (authType === "jwt") {
      await verifyJwt({
        jwksUri:   resolvedCred?.jwksUri   ?? endpoint.jwtJwksUri,
        publicKey: resolvedCred?.publicKey  ?? endpoint.jwtPublicKey,
        issuer:    resolvedCred?.issuer     ?? endpoint.jwtIssuer,
        audience:  resolvedCred?.audience   ?? endpoint.jwtAudience,
        headers,
      });
    }
    // authType === "none" — no check

    // Backwards compat: legacy endpoints with a secret but authType="none"
    if (authType === "none" && endpoint.secret) {
      verifyHmac(endpoint.secret, rawBody, headers);
    }

    // ── Method check ──────────────────────────────────────────────────────────
    if (endpoint.method !== method.toUpperCase()) {
      throw Object.assign(
        new Error(`Method ${method} not allowed; expected ${endpoint.method}`),
        { code: "METHOD_NOT_ALLOWED" }
      );
    }

    // ── Build trigger payload ─────────────────────────────────────────────────
    const triggerPayload: Record<string, unknown> = {
      webhookPath: path,
      method,
      headers,
      query,
      body,
    };

    // Signal a waiting execution if one exists
    const waitingExecution = await prisma.execution.findFirst({
      where: {
        workflowId: endpoint.workflowId,
        status: "running",
        temporalWorkflowId: { not: null },
      },
      orderBy: { startedAt: "desc" },
    });

    if (waitingExecution?.temporalWorkflowId) {
      try {
        const temporal = await getTemporalClient();
        const handle = temporal.workflow.getHandle(waitingExecution.temporalWorkflowId);
        await handle.signal("webhookPayload", triggerPayload);

        await prisma.execution.update({
          where: { id: waitingExecution.id },
          data: { triggerPayload: triggerPayload as unknown as Prisma.InputJsonValue },
        });

        logger.info("Webhook signal sent to waiting execution", {
          path,
          executionId: waitingExecution.id,
          temporalWorkflowId: waitingExecution.temporalWorkflowId,
        });

        return waitingExecution;
      } catch (err) {
        logger.warn("Could not signal waiting execution — starting new one", { err });
      }
    }

    const execution = await executionService.startExecution({
      workflowId: endpoint.workflowId,
      triggerPayload,
      environmentId: endpoint.environmentId,
    });

    logger.info("Webhook inbound handled (new execution)", {
      path,
      executionId: execution.id,
      workflowId: endpoint.workflowId,
    });

    return execution;
  }
}

export const webhookService = new WebhookService();
