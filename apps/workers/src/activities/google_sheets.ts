import { google } from "googleapis";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";

// =============================================================================
// googleSheetsActivity — Google Sheets CRUD via service account
// =============================================================================

export interface GoogleSheetsConfig {
  credentialId?: string;
  spreadsheetId: string;
  operation: "read_range" | "append_rows" | "update_range" | "clear_range";
  range: string;
  values?: string;
  valueInputOption?: "RAW" | "USER_ENTERED";
}

export interface GoogleSheetsActivityInput {
  config: GoogleSheetsConfig;
  context: Record<string, unknown>;
  resolvedServiceAccountJson?: string;
}

export interface GoogleSheetsActivityOutput {
  result: unknown;
  ok: boolean;
}

export async function googleSheetsActivity(
  input: GoogleSheetsActivityInput
): Promise<GoogleSheetsActivityOutput> {
  const { config: cfg, context, resolvedServiceAccountJson } = input;

  if (!resolvedServiceAccountJson) {
    throw ApplicationFailure.create({
      message: "Google Sheets: no service account JSON provided",
      type: "GOOGLE_SHEETS_CONFIG_ERROR",
      nonRetryable: true,
    });
  }

  // Parse service account credentials
  let serviceAccount: { client_email: string; private_key: string };
  try {
    serviceAccount = JSON.parse(resolvedServiceAccountJson);
  } catch {
    throw ApplicationFailure.create({
      message: "Google Sheets: invalid service account JSON",
      type: "GOOGLE_SHEETS_CONFIG_ERROR",
      nonRetryable: true,
    });
  }

  // Create JWT auth
  const auth = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  // Interpolate dynamic values
  const spreadsheetId = interpolateTemplate(cfg.spreadsheetId, context);
  const range = interpolateTemplate(cfg.range, context);
  const valueInputOption = cfg.valueInputOption ?? "USER_ENTERED";

  // Parse values if provided
  let values: unknown[][] | undefined;
  if (cfg.values) {
    const interpolatedValues = interpolateTemplate(cfg.values, context);
    try {
      values = JSON.parse(interpolatedValues);
    } catch {
      throw ApplicationFailure.create({
        message: "Google Sheets: could not parse values as JSON array of arrays",
        type: "GOOGLE_SHEETS_CONFIG_ERROR",
        nonRetryable: true,
      });
    }
  }

  const sheets = google.sheets({ version: "v4", auth });

  try {
    let result: unknown;

    switch (cfg.operation) {
      case "read_range": {
        const resp = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });
        result = { values: resp.data.values, range: resp.data.range };
        break;
      }
      case "append_rows": {
        if (!values) {
          throw ApplicationFailure.create({
            message: "Google Sheets append_rows: values are required",
            type: "GOOGLE_SHEETS_CONFIG_ERROR",
            nonRetryable: true,
          });
        }
        const resp = await sheets.spreadsheets.values.append({
          spreadsheetId,
          range,
          valueInputOption,
          requestBody: { values },
        });
        result = { updatedRows: resp.data.updates?.updatedRows ?? 0 };
        break;
      }
      case "update_range": {
        if (!values) {
          throw ApplicationFailure.create({
            message: "Google Sheets update_range: values are required",
            type: "GOOGLE_SHEETS_CONFIG_ERROR",
            nonRetryable: true,
          });
        }
        const resp = await sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption,
          requestBody: { values },
        });
        result = { updatedCells: resp.data.updatedCells ?? 0 };
        break;
      }
      case "clear_range": {
        const resp = await sheets.spreadsheets.values.clear({
          spreadsheetId,
          range,
          requestBody: {},
        });
        result = { clearedRange: resp.data.clearedRange };
        break;
      }
      default:
        throw ApplicationFailure.create({
          message: `Unknown Google Sheets operation: ${cfg.operation}`,
          type: "GOOGLE_SHEETS_UNSUPPORTED_OP",
          nonRetryable: true,
        });
    }

    return { result, ok: true };
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    throw ApplicationFailure.create({
      message: `Google Sheets ${cfg.operation} failed: ${(err as Error).message}`,
      type: "GOOGLE_SHEETS_OPERATION_ERROR",
      nonRetryable: false,
    });
  }
}
