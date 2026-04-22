import React from "react";
import type { CircleCIConfig, CircleCIOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Label } from "../../ui/label";

interface Props {
  config: CircleCIConfig;
  onChange: (patch: Partial<CircleCIConfig>) => void;
}

const OPERATIONS: CircleCIOperation[] = [
  "pipelines.trigger",
  "pipelines.get",
  "pipelines.list",
  "workflows.get",
  "workflows.cancel",
  "projects.get",
];

export function CircleCIForm({
  config,
  onChange,
}: Props): React.ReactElement {
  const op = config.operation ?? "pipelines.trigger";
  const needsProject =
    op === "pipelines.trigger" ||
    op === "pipelines.list" ||
    op === "projects.get";
  const needsPipeline = op === "pipelines.get";
  const needsWorkflow = op === "workflows.get" || op === "workflows.cancel";
  const isTrigger = op === "pipelines.trigger";
  const isListPipelines = op === "pipelines.list";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["circleci"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="CircleCI Credential"
        placeholder="— Personal API token —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as CircleCIOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {needsProject && (
        <div>
          <Label>Project slug ("{"{vcs}/{org}/{repo}"}")</Label>
          <TemplateInput
            value={config.projectSlug ?? ""}
            onChange={(v) => onChange({ projectSlug: v })}
            placeholder="github/acme/myrepo"
          />
        </div>
      )}
      {needsPipeline && (
        <div>
          <Label>Pipeline ID</Label>
          <TemplateInput
            value={config.pipelineId ?? ""}
            onChange={(v) => onChange({ pipelineId: v })}
            placeholder="uuid"
          />
        </div>
      )}
      {needsWorkflow && (
        <div>
          <Label>Workflow ID</Label>
          <TemplateInput
            value={config.workflowId ?? ""}
            onChange={(v) => onChange({ workflowId: v })}
            placeholder="uuid"
          />
        </div>
      )}
      {(isTrigger || isListPipelines) && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Branch (optional)</Label>
            <TemplateInput
              value={config.branch ?? ""}
              onChange={(v) => onChange({ branch: v || undefined })}
              placeholder="main"
            />
          </div>
          {isTrigger && (
            <div>
              <Label>Tag (optional, overrides branch)</Label>
              <TemplateInput
                value={config.tag ?? ""}
                onChange={(v) => onChange({ tag: v || undefined })}
                placeholder="v1.0.0"
              />
            </div>
          )}
        </div>
      )}
      {isTrigger && (
        <div>
          <Label>Parameters JSON (optional)</Label>
          <TemplateTextarea
            value={config.parameters ?? ""}
            onChange={(v) => onChange({ parameters: v || undefined })}
            placeholder='{"deploy_env": "prod"}'
            rows={3}
          />
        </div>
      )}
    </div>
  );
}
