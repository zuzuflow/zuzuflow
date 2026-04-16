import * as http2 from "http2";
import * as crypto from "crypto";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { ApnsPushConfig } from "@workflow/shared";

// =============================================================================
// apnsPushActivity — sends a push notification via Apple Push Notification service
// =============================================================================

export interface ApnsPushActivityInput {
  config: ApnsPushConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: { keyId?: string; teamId?: string; privateKey?: string };
}

export interface ApnsPushActivityOutput {
  statusCode: number;
  apnsId?: string;
  deviceToken: string;
}

function generateApnsJwt(keyId: string, teamId: string, privateKey: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) })
  ).toString("base64url");

  const headerPayload = `${header}.${payload}`;
  const signature = crypto
    .sign("sha256", Buffer.from(headerPayload), privateKey)
    .toString("base64url");

  return `${headerPayload}.${signature}`;
}

export async function apnsPushActivity(
  input: ApnsPushActivityInput
): Promise<ApnsPushActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;

  const keyId = resolvedCredentials?.keyId ?? "";
  const teamId = resolvedCredentials?.teamId ?? "";
  const privateKey = resolvedCredentials?.privateKey ?? "";

  if (!keyId || !teamId || !privateKey) {
    throw ApplicationFailure.create({
      message: "APNs Push: keyId, teamId, and privateKey are required",
      type: "APNS_CONFIG_ERROR",
      nonRetryable: true,
    });
  }

  const deviceToken = interpolateTemplate(cfg.deviceToken, context);
  const title = interpolateTemplate(cfg.title, context);
  const body = interpolateTemplate(cfg.body, context);
  const customPayloadStr = cfg.payload
    ? interpolateTemplate(cfg.payload, context)
    : undefined;

  const pushType = cfg.pushType ?? "alert";
  const production = cfg.production ?? false;
  const host = production
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";
  const path = `/3/device/${deviceToken}`;

  let customPayload: Record<string, unknown> = {};
  if (customPayloadStr) {
    try {
      customPayload = JSON.parse(customPayloadStr);
    } catch {
      throw ApplicationFailure.create({
        message: "APNs Push: failed to parse custom payload JSON",
        type: "APNS_CONFIG_ERROR",
        nonRetryable: true,
      });
    }
  }

  const apsPayload = JSON.stringify({
    aps: {
      alert: { title, body },
    },
    ...customPayload,
  });

  let jwt: string;
  try {
    jwt = generateApnsJwt(keyId, teamId, privateKey);
  } catch (err) {
    throw ApplicationFailure.create({
      message: `APNs Push: failed to generate JWT: ${(err as Error).message}`,
      type: "APNS_AUTH_ERROR",
      nonRetryable: true,
    });
  }

  return new Promise<ApnsPushActivityOutput>((resolve, reject) => {
    const session = http2.connect(host);

    session.on("error", (err) => {
      session.close();
      reject(
        ApplicationFailure.create({
          message: `APNs Push connection error: ${err.message}`,
          type: "APNS_CONNECTION_ERROR",
          nonRetryable: false,
        })
      );
    });

    const headers: http2.OutgoingHttpHeaders = {
      ":method": "POST",
      ":path": path,
      authorization: `bearer ${jwt}`,
      "apns-topic": cfg.bundleId,
      "apns-push-type": pushType,
    };

    const req = session.request(headers);

    let responseData = "";
    let statusCode = 0;
    let apnsId: string | undefined;

    req.on("response", (hdrs) => {
      statusCode = hdrs[":status"] as number;
      apnsId = hdrs["apns-id"] as string | undefined;
    });

    req.on("data", (chunk: Buffer) => {
      responseData += chunk.toString();
    });

    req.on("end", () => {
      session.close();

      if (statusCode >= 400) {
        let reason = responseData;
        try {
          reason = JSON.parse(responseData).reason ?? responseData;
        } catch {
          // use raw responseData
        }
        reject(
          ApplicationFailure.create({
            message: `APNs Push returned ${statusCode}: ${reason}`,
            type: "APNS_PUSH_ERROR",
            nonRetryable: statusCode >= 400 && statusCode < 500,
          })
        );
        return;
      }

      resolve({ statusCode, apnsId, deviceToken });
    });

    req.on("error", (err) => {
      session.close();
      reject(
        ApplicationFailure.create({
          message: `APNs Push request error: ${err.message}`,
          type: "APNS_REQUEST_ERROR",
          nonRetryable: false,
        })
      );
    });

    req.end(apsPayload);
  });
}
