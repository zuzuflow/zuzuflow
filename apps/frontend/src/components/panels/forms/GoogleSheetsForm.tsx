import React from "react";
import type { GoogleSheetsConfig } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Label } from "../../ui/label";

interface Props {
  config: GoogleSheetsConfig;
  onChange: (patch: Partial<GoogleSheetsConfig>) => void;
}

export function GoogleSheetsForm({ config, onChange }: Props): React.ReactElement {
  const showValues = config.operation === "append_rows" || config.operation === "update_range";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["google_sheets"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Google Sheets Credential"
        placeholder="— Select credential —"
      />

      <div>
        <Label>Spreadsheet ID</Label>
        <TemplateInput
          wrapperClassName="relative"
          value={config.spreadsheetId ?? ""}
          onChange={(v) => onChange({ spreadsheetId: v })}
          placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
        />
      </div>

      <div>
        <Label>Operation</Label>
        <select
          value={config.operation ?? "read_range"}
          onChange={(e) => onChange({ operation: e.target.value as GoogleSheetsConfig["operation"] })}
          className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="read_range">Read Range</option>
          <option value="append_rows">Append Rows</option>
          <option value="update_range">Update Range</option>
          <option value="clear_range">Clear Range</option>
        </select>
      </div>

      <div>
        <Label>Range</Label>
        <TemplateInput
          wrapperClassName="relative"
          value={config.range ?? ""}
          onChange={(v) => onChange({ range: v })}
          placeholder="Sheet1!A1:D10"
        />
      </div>

      {showValues && (
        <div>
          <Label>Values (JSON array of arrays)</Label>
          <TemplateTextarea
            className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
            value={config.values ?? ""}
            onChange={(v) => onChange({ values: v })}
            placeholder='[["Alice", 30], ["Bob", 25]]'
          />
        </div>
      )}

      {showValues && (
        <div>
          <Label>Value Input Option</Label>
          <select
            value={config.valueInputOption ?? "RAW"}
            onChange={(e) => onChange({ valueInputOption: e.target.value as GoogleSheetsConfig["valueInputOption"] })}
            className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="RAW">RAW</option>
            <option value="USER_ENTERED">USER_ENTERED</option>
          </select>
        </div>
      )}
    </div>
  );
}
