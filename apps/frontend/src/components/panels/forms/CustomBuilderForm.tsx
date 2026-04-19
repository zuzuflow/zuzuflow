import React from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import type {
  CustomBuilderConfig,
  CustomBuilderInputField,
} from "@workflow/shared";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Button } from "../../ui/button";
import { useCustomNodeTemplates } from "../../../hooks/useCustomNodeTemplates";

interface CustomBuilderFormProps {
  config: CustomBuilderConfig;
  onChange: (patch: Partial<CustomBuilderConfig>) => void;
}

/**
 * Auto-rendered form for a placed custom_builder node. Drives the
 * `templateInputs` map from the snapshotted `inputsSchema`.
 *
 * Notably does NOT let users edit the code/handles/execution-mode — those are
 * owned by the template, not the node instance. Users who want to edit the
 * template itself open the CustomNodeBuilder modal from the palette.
 */
export function CustomBuilderForm({
  config,
  onChange,
}: CustomBuilderFormProps): React.ReactElement {
  const fields = config.inputsSchema;
  const { templates } = useCustomNodeTemplates();

  // Detect version drift so the user can opt-in to the latest snapshot.
  const latest = templates.find((t) => t.key === config.templateKey);
  const upgradeAvailable =
    latest !== undefined && latest.version > config.templateVersion;

  function setField(name: string, value: unknown) {
    const next = { ...config.templateInputs, [name]: value };
    onChange({ templateInputs: next });
  }

  function handleUpgrade() {
    if (!latest) return;
    const defaults: Record<string, unknown> = {};
    for (const f of latest.inputsSchema) {
      if (f.default !== undefined) defaults[f.name] = f.default;
    }
    // Preserve any user-filled values whose field names still exist in the
    // new schema; drop fields that were removed. Fields added in the new
    // version pick up their `default`.
    const preserved: Record<string, unknown> = { ...defaults };
    for (const f of latest.inputsSchema) {
      if (config.templateInputs[f.name] !== undefined) {
        preserved[f.name] = config.templateInputs[f.name];
      }
    }
    onChange({
      templateId: latest.id,
      templateVersion: latest.version,
      name: latest.name,
      icon: latest.icon,
      color: latest.color,
      category: latest.category,
      inputs: latest.handles.inputs,
      outputs: latest.handles.outputs,
      inputsSchema: latest.inputsSchema,
      executionMode: latest.executionMode,
      code: latest.code ?? undefined,
      httpTemplate: latest.httpTemplate ?? undefined,
      credentialType: latest.credentialType ?? undefined,
      templateInputs: preserved,
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-bold"
            style={{
              backgroundColor: config.color + "30",
              color: config.color,
            }}
          >
            {config.executionMode === "http" ? "HTTP" : "JS"}
          </span>
          <span className="font-medium text-slate-200 truncate flex-1">
            {config.name}
          </span>
        </div>
        <div className="mt-1 text-[10px] text-slate-500">
          Template <code className="text-slate-400">{config.templateKey}</code>{" "}
          · v{config.templateVersion}
        </div>
      </div>

      {upgradeAvailable && (
        <div className="rounded-md border border-amber-600/60 bg-amber-900/20 px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={13} className="text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 text-xs">
            <div className="font-medium text-amber-200">
              Template v{latest!.version} available
            </div>
            <div className="text-[10px] text-amber-400/80 mt-0.5">
              This node runs v{config.templateVersion}. Upgrading snapshots the
              latest code/schema — other workflows are unaffected.
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={handleUpgrade}
          >
            <RefreshCcw size={11} className="mr-1" /> Upgrade
          </Button>
        </div>
      )}

      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          This node takes no inputs.
        </p>
      ) : (
        fields.map((field) => (
          <CustomBuilderField
            key={field.name}
            field={field}
            value={config.templateInputs[field.name]}
            onChange={(v) => setField(field.name, v)}
          />
        ))
      )}
    </div>
  );
}

function CustomBuilderField({
  field,
  value,
  onChange,
}: {
  field: CustomBuilderInputField;
  value: unknown;
  onChange: (v: unknown) => void;
}): React.ReactElement {
  const labelNode = (
    <Label>
      {field.label}
      {field.required && <span className="text-red-400 ml-0.5">*</span>}
    </Label>
  );

  switch (field.type) {
    case "textarea":
    case "json":
      return (
        <div>
          {labelNode}
          <textarea
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            rows={field.type === "json" ? 6 : 4}
            value={
              typeof value === "string"
                ? value
                : value === undefined
                  ? ""
                  : JSON.stringify(value, null, 2)
            }
            placeholder={field.description}
            onChange={(e) => onChange(e.target.value)}
          />
          {field.description && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {field.description}
            </p>
          )}
        </div>
      );
    case "number":
      return (
        <div>
          {labelNode}
          <Input
            type="number"
            value={typeof value === "number" ? value : ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === "" ? undefined : Number(v));
            }}
            placeholder={field.description}
          />
        </div>
      );
    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <input
            id={`field-${field.name}`}
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-800"
          />
          <Label htmlFor={`field-${field.name}`} className="mb-0">
            {field.label}
          </Label>
        </div>
      );
    case "select":
      return (
        <div>
          {labelNode}
          <select
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">— Select —</option>
            {(field.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    case "credential":
      return (
        <div>
          {labelNode}
          <Input
            type="text"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.description ?? "Credential name"}
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Credential binding UI lands in Slice 3.
          </p>
        </div>
      );
    case "string":
    default:
      return (
        <div>
          {labelNode}
          <Input
            type="text"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.description}
          />
        </div>
      );
  }
}
