import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { StripeConfig } from "@workflow/shared";
import type StripeSdk from "stripe";

// =============================================================================
// stripeActivity — Stripe payments / billing
//
// Uses the official `stripe` Node SDK (lazy-imported). Expects a decrypted
// credential payload of `{ apiKey: "sk_..." }`. Supports a curated set of
// operations spanning charges, customers, payment intents, subscriptions,
// and invoices.
// =============================================================================

export interface StripeActivityInput {
  config: StripeConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    apiKey?: string;
  };
}

export interface StripeActivityOutput {
  ok: boolean;
  result: unknown;
}

function parseJson(
  label: string,
  raw: string | undefined,
  context: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  const interp = interpolateTemplate(raw, context);
  if (!interp.trim()) return undefined;
  try {
    return JSON.parse(interp) as Record<string, unknown>;
  } catch (err) {
    throw ApplicationFailure.create({
      message: `Stripe ${label}: invalid JSON — ${(err as Error).message}`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
}

function mustString(
  label: string,
  raw: string | undefined,
  context: Record<string, unknown>,
): string {
  const val = raw ? interpolateTemplate(raw, context) : "";
  if (!val) {
    throw ApplicationFailure.create({
      message: `Stripe: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

export async function stripeActivity(
  input: StripeActivityInput,
): Promise<StripeActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;

  const apiKey = resolvedCredentials?.apiKey;
  if (!apiKey) {
    throw ApplicationFailure.create({
      message:
        "Stripe credential is missing — supply `{ apiKey: \"sk_...\" }` in the stored credential.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(apiKey, {
    apiVersion: "2024-11-20.acacia" as StripeSdk.LatestApiVersion,
  });

  const idempotencyKey = cfg.idempotencyKey
    ? interpolateTemplate(cfg.idempotencyKey, context)
    : undefined;
  const reqOpts: StripeSdk.RequestOptions | undefined = idempotencyKey
    ? { idempotencyKey }
    : undefined;

  const extraParams =
    (parseJson("extraParams", cfg.extraParams, context) as Record<
      string,
      unknown
    >) ?? {};
  const metadata = parseJson("metadata", cfg.metadata, context) as
    | StripeSdk.MetadataParam
    | undefined;
  const description = cfg.description
    ? interpolateTemplate(cfg.description, context)
    : undefined;

  try {
    switch (cfg.operation) {
      case "charges.create": {
        const amount = Number(
          interpolateTemplate(cfg.amount ?? "0", context),
        );
        if (!Number.isFinite(amount) || amount <= 0) {
          throw ApplicationFailure.create({
            message:
              "Stripe charges.create: `amount` must be a positive integer (in smallest currency unit)",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const currency = (cfg.currency ?? "usd").toLowerCase();
        const source = cfg.source
          ? interpolateTemplate(cfg.source, context)
          : undefined;
        const customer = cfg.customerId
          ? interpolateTemplate(cfg.customerId, context)
          : undefined;
        const params: StripeSdk.ChargeCreateParams = {
          amount: Math.round(amount),
          currency,
          ...(source ? { source } : {}),
          ...(customer ? { customer } : {}),
          ...(description ? { description } : {}),
          ...(metadata ? { metadata } : {}),
          ...(extraParams as Partial<StripeSdk.ChargeCreateParams>),
        };
        const charge = await stripe.charges.create(params, reqOpts);
        return { ok: true, result: charge as unknown };
      }

      case "charges.retrieve": {
        const id = mustString("resourceId", cfg.resourceId, context);
        const charge = await stripe.charges.retrieve(id);
        return { ok: true, result: charge as unknown };
      }

      case "charges.refund": {
        const id = mustString("resourceId", cfg.resourceId, context);
        const refundParams: StripeSdk.RefundCreateParams = { charge: id };
        if (cfg.amount) {
          const amt = Number(interpolateTemplate(cfg.amount, context));
          if (Number.isFinite(amt)) refundParams.amount = Math.round(amt);
        }
        if (metadata) refundParams.metadata = metadata;
        const refund = await stripe.refunds.create(
          {
            ...refundParams,
            ...(extraParams as Partial<StripeSdk.RefundCreateParams>),
          },
          reqOpts,
        );
        return { ok: true, result: refund as unknown };
      }

      case "customers.create": {
        const params: StripeSdk.CustomerCreateParams = {
          ...(description ? { description } : {}),
          ...(metadata ? { metadata } : {}),
          ...(extraParams as Partial<StripeSdk.CustomerCreateParams>),
        };
        const customer = await stripe.customers.create(params, reqOpts);
        return { ok: true, result: customer as unknown };
      }

      case "customers.retrieve": {
        const id = mustString("resourceId", cfg.resourceId, context);
        const customer = await stripe.customers.retrieve(id);
        return { ok: true, result: customer as unknown };
      }

      case "customers.update": {
        const id = mustString("resourceId", cfg.resourceId, context);
        const params: StripeSdk.CustomerUpdateParams = {
          ...(description ? { description } : {}),
          ...(metadata ? { metadata } : {}),
          ...(extraParams as Partial<StripeSdk.CustomerUpdateParams>),
        };
        const customer = await stripe.customers.update(id, params, reqOpts);
        return { ok: true, result: customer as unknown };
      }

      case "paymentIntents.create": {
        const amount = Number(
          interpolateTemplate(cfg.amount ?? "0", context),
        );
        if (!Number.isFinite(amount) || amount <= 0) {
          throw ApplicationFailure.create({
            message:
              "Stripe paymentIntents.create: `amount` must be a positive integer",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const currency = (cfg.currency ?? "usd").toLowerCase();
        const customer = cfg.customerId
          ? interpolateTemplate(cfg.customerId, context)
          : undefined;
        const params: StripeSdk.PaymentIntentCreateParams = {
          amount: Math.round(amount),
          currency,
          ...(customer ? { customer } : {}),
          ...(description ? { description } : {}),
          ...(metadata ? { metadata } : {}),
          ...(extraParams as Partial<StripeSdk.PaymentIntentCreateParams>),
        };
        const pi = await stripe.paymentIntents.create(params, reqOpts);
        return { ok: true, result: pi as unknown };
      }

      case "paymentIntents.retrieve": {
        const id = mustString("resourceId", cfg.resourceId, context);
        const pi = await stripe.paymentIntents.retrieve(id);
        return { ok: true, result: pi as unknown };
      }

      case "paymentIntents.capture": {
        const id = mustString("resourceId", cfg.resourceId, context);
        const captureParams: StripeSdk.PaymentIntentCaptureParams = {};
        if (cfg.amount) {
          const amt = Number(interpolateTemplate(cfg.amount, context));
          if (Number.isFinite(amt)) captureParams.amount_to_capture = Math.round(amt);
        }
        const pi = await stripe.paymentIntents.capture(
          id,
          {
            ...captureParams,
            ...(extraParams as Partial<StripeSdk.PaymentIntentCaptureParams>),
          },
          reqOpts,
        );
        return { ok: true, result: pi as unknown };
      }

      case "subscriptions.create": {
        const customer = mustString("customerId", cfg.customerId, context);
        const params: StripeSdk.SubscriptionCreateParams = {
          customer,
          ...(metadata ? { metadata } : {}),
          ...(extraParams as Partial<StripeSdk.SubscriptionCreateParams>),
        };
        const sub = await stripe.subscriptions.create(params, reqOpts);
        return { ok: true, result: sub as unknown };
      }

      case "subscriptions.cancel": {
        const id = mustString("resourceId", cfg.resourceId, context);
        const sub = await stripe.subscriptions.cancel(
          id,
          extraParams as StripeSdk.SubscriptionCancelParams,
        );
        return { ok: true, result: sub as unknown };
      }

      case "invoices.create": {
        const customer = mustString("customerId", cfg.customerId, context);
        const params: StripeSdk.InvoiceCreateParams = {
          customer,
          ...(description ? { description } : {}),
          ...(metadata ? { metadata } : {}),
          ...(extraParams as Partial<StripeSdk.InvoiceCreateParams>),
        };
        const invoice = await stripe.invoices.create(params, reqOpts);
        return { ok: true, result: invoice as unknown };
      }

      case "invoices.send": {
        const id = mustString("resourceId", cfg.resourceId, context);
        const invoice = await stripe.invoices.sendInvoice(
          id,
          extraParams as StripeSdk.InvoiceSendInvoiceParams,
        );
        return { ok: true, result: invoice as unknown };
      }

      default:
        throw ApplicationFailure.create({
          message: `Unsupported Stripe operation: ${(cfg as { operation?: string }).operation}`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
    }
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const e = err as {
      type?: string;
      code?: string;
      statusCode?: number;
      message?: string;
    };
    const retriable =
      e.statusCode === undefined ||
      e.statusCode === 429 ||
      (e.statusCode >= 500 && e.statusCode < 600);
    throw ApplicationFailure.create({
      message: `Stripe ${cfg.operation} failed: ${e.message ?? String(err)}`,
      type:
        e.type === "StripeAuthenticationError"
          ? "AUTH_ERROR"
          : e.type === "StripeInvalidRequestError"
            ? "VALIDATION_ERROR"
            : e.type === "StripeRateLimitError" || e.statusCode === 429
              ? "RATE_LIMITED"
              : "UPSTREAM_ERROR",
      nonRetryable: !retriable,
      details: [
        {
          code: e.code,
          stripeType: e.type,
          statusCode: e.statusCode,
          operation: cfg.operation,
        },
      ],
    });
  }
}
