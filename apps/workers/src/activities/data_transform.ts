import crypto from "crypto";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type {
  DataMapperConfig,
  JsonParserConfig,
  HtmlTemplateConfig,
  CryptoHashConfig,
  DateFormatterConfig,
  Base64Config,
} from "@workflow/shared";

dayjs.extend(utc);
dayjs.extend(timezone);

// =============================================================================
// Pure-compute data transformation activities
// =============================================================================

// ─── Data Mapper ─────────────────────────────────────────────────────────────

export interface DataMapperActivityInput {
  config: DataMapperConfig;
  context: Record<string, unknown>;
}

export interface DataMapperActivityOutput {
  result: Record<string, unknown>;
}

export async function dataMappingActivity(
  input: DataMapperActivityInput
): Promise<DataMapperActivityOutput> {
  const { config: cfg, context } = input;
  const result: Record<string, unknown> = {};

  for (const mapping of cfg.mappings) {
    const key = mapping.to.trim();
    if (!key) continue;
    const interpolated = interpolateTemplate(mapping.from, context);
    // Try to parse as JSON first (for objects/arrays/numbers)
    try {
      result[key] = JSON.parse(interpolated);
    } catch {
      result[key] = interpolated;
    }
  }

  return { result };
}

// ─── JSON Parser ─────────────────────────────────────────────────────────────

export interface JsonParserActivityInput {
  config: JsonParserConfig;
  context: Record<string, unknown>;
}

export interface JsonParserActivityOutput {
  parsed: unknown;
}

export async function jsonParserActivity(
  input: JsonParserActivityInput
): Promise<JsonParserActivityOutput> {
  const { config: cfg, context } = input;
  const raw = interpolateTemplate(cfg.input, context);

  try {
    const parsed = JSON.parse(raw);
    return { parsed };
  } catch (err) {
    throw ApplicationFailure.create({
      message: `JSON parse failed: ${(err as Error).message}`,
      type: "JSON_PARSE_ERROR",
      nonRetryable: true,
      details: [{ input: raw.slice(0, 500) }],
    });
  }
}

// ─── HTML Template ────────────────────────────────────────────────────────────

export interface HtmlTemplateActivityInput {
  config: HtmlTemplateConfig;
  context: Record<string, unknown>;
}

export interface HtmlTemplateActivityOutput {
  html: string;
}

export async function htmlTemplateActivity(
  input: HtmlTemplateActivityInput
): Promise<HtmlTemplateActivityOutput> {
  const { config: cfg, context } = input;
  const html = interpolateTemplate(cfg.template, context);
  return { html };
}

// ─── Crypto / Hash ────────────────────────────────────────────────────────────

export interface CryptoHashActivityInput {
  config: CryptoHashConfig;
  context: Record<string, unknown>;
}

export interface CryptoHashActivityOutput {
  hash: string;
  algorithm: string;
  encoding: string;
}

export async function cryptoHashActivity(
  input: CryptoHashActivityInput
): Promise<CryptoHashActivityOutput> {
  const { config: cfg, context } = input;
  const raw = interpolateTemplate(cfg.input, context);
  const algorithm = cfg.algorithm ?? "sha256";
  const encoding = cfg.encoding ?? "hex";

  try {
    const hash = crypto
      .createHash(algorithm)
      .update(raw)
      .digest(encoding as crypto.BinaryToTextEncoding);
    return { hash, algorithm, encoding };
  } catch (err) {
    throw ApplicationFailure.create({
      message: `Crypto hash failed: ${(err as Error).message}`,
      type: "CRYPTO_HASH_ERROR",
      nonRetryable: true,
    });
  }
}

// ─── Date Formatter ───────────────────────────────────────────────────────────

export interface DateFormatterActivityInput {
  config: DateFormatterConfig;
  context: Record<string, unknown>;
}

export interface DateFormatterActivityOutput {
  formatted: string;
  iso: string;
  unix: number;
}

export async function dateFormatterActivity(
  input: DateFormatterActivityInput
): Promise<DateFormatterActivityOutput> {
  const { config: cfg, context } = input;
  const raw = interpolateTemplate(cfg.input, context);
  const tz = cfg.timezone ?? "UTC";

  let d = dayjs(raw === "now" || raw === "" ? undefined : raw);
  if (!d.isValid()) {
    throw ApplicationFailure.create({
      message: `Invalid date input: "${raw}"`,
      type: "DATE_PARSE_ERROR",
      nonRetryable: true,
    });
  }

  if (tz !== "UTC") {
    d = d.tz(tz);
  }

  const formatted = d.format(cfg.outputFormat);
  return {
    formatted,
    iso: d.toISOString(),
    unix: d.unix(),
  };
}

// ─── Base64 ───────────────────────────────────────────────────────────────────

export interface Base64ActivityInput {
  config: Base64Config;
  context: Record<string, unknown>;
}

export interface Base64ActivityOutput {
  result: string;
  operation: string;
}

export async function base64Activity(
  input: Base64ActivityInput
): Promise<Base64ActivityOutput> {
  const { config: cfg, context } = input;
  const raw = interpolateTemplate(cfg.input, context);

  try {
    let result: string;
    if (cfg.operation === "encode") {
      result = Buffer.from(raw, "utf-8").toString("base64");
    } else {
      result = Buffer.from(raw, "base64").toString("utf-8");
    }
    return { result, operation: cfg.operation };
  } catch (err) {
    throw ApplicationFailure.create({
      message: `Base64 ${cfg.operation} failed: ${(err as Error).message}`,
      type: "BASE64_ERROR",
      nonRetryable: true,
    });
  }
}
