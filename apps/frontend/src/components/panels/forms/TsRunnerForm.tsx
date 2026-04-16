import React, { useState, useCallback } from "react";
import { Maximize2 } from "lucide-react";
import type { TsRunnerConfig } from "@workflow/shared";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { CodeEditorModal } from "../../editor/CodeEditorModal";
import { NpmPackageList } from "./NpmPackageList";
import { usePackageTypes } from "@/hooks/usePackageTypes";

interface Props {
  config: TsRunnerConfig;
  onChange: (patch: Partial<TsRunnerConfig>) => void;
}

export function TsRunnerForm({ config, onChange }: Props): React.ReactElement {
  const [editorOpen, setEditorOpen] = useState(false);
  const npmPackages = config.npmPackages ?? [];
  const customTypeDefs = config.customTypeDefs ?? {};

  // Reactive type acquisition — triggers on package list changes, merges custom types
  const { packageStatuses, typeDefs, loading: typesLoading } = usePackageTypes(
    npmPackages,
    customTypeDefs
  );

  const handleCustomTypeUpload = useCallback(
    (packageName: string, content: string) => {
      onChange({
        customTypeDefs: { ...customTypeDefs, [packageName]: content },
      });
    },
    [customTypeDefs, onChange]
  );

  const handleCustomTypeRemove = useCallback(
    (packageName: string) => {
      const next = { ...customTypeDefs };
      delete next[packageName];
      onChange({ customTypeDefs: next });
    },
    [customTypeDefs, onChange]
  );

  return (
    <>
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label>TypeScript Expression</Label>
            <button
              onClick={() => setEditorOpen(true)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-accent"
              title="Open full editor"
            >
              <Maximize2 size={11} />
              Open Editor
            </button>
          </div>
          <TemplateTextarea
            className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono resize-y"
            value={config.expression ?? ""}
            onChange={(v) => onChange({ expression: v })}
            placeholder={"const main = (input: Record<string, unknown>, context: { workflowId: string }) => {\n  return null;\n}"}
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Define <code className="text-muted-foreground">main(input, context)</code> — typed TypeScript, transpiled at runtime. <code className="text-muted-foreground">input</code> is prior node outputs, <code className="text-muted-foreground">context</code> has workflowId, executionId, triggerPayload.
          </p>
        </div>

        <div>
          <Label>Timeout (ms)</Label>
          <Input
            type="number"
            min={100}
            max={30000}
            step={100}
            value={config.timeoutMs ?? 5000}
            onChange={(e) =>
              onChange({ timeoutMs: parseInt(e.target.value, 10) || 5000 })
            }
          />
        </div>

        <NpmPackageList
          packages={npmPackages}
          onChange={(pkgs) => onChange({ npmPackages: pkgs })}
          packageStatuses={packageStatuses}
          customTypeDefs={customTypeDefs}
          onCustomTypeUpload={handleCustomTypeUpload}
          onCustomTypeRemove={handleCustomTypeRemove}
        />
      </div>

      <CodeEditorModal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        language="typescript"
        value={config.expression ?? ""}
        onChange={(v) => onChange({ expression: v })}
        title="ts-runner"
        typeDefs={typeDefs}
        typesLoading={typesLoading}
      />
    </>
  );
}
