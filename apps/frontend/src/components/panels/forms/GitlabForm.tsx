import React from "react";
import type { GitlabConfig, GitlabOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Label } from "../../ui/label";

interface Props {
  config: GitlabConfig;
  onChange: (patch: Partial<GitlabConfig>) => void;
}

const OPERATIONS: GitlabOperation[] = [
  "issues.create",
  "issues.get",
  "issues.update",
  "issues.list",
  "issues.addComment",
  "mergeRequests.create",
  "mergeRequests.merge",
  "mergeRequests.list",
  "pipelines.trigger",
  "projects.get",
];

export function GitlabForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "issues.create";
  const needsIid =
    op === "issues.get" ||
    op === "issues.update" ||
    op === "issues.addComment" ||
    op === "mergeRequests.merge";
  const needsTitle =
    op === "issues.create" ||
    op === "issues.update" ||
    op === "mergeRequests.create";
  const needsBody =
    op === "issues.create" ||
    op === "issues.update" ||
    op === "mergeRequests.create";
  const needsLabelsAssignees =
    op === "issues.create" ||
    op === "issues.update" ||
    op === "mergeRequests.create";
  const needsComment = op === "issues.addComment";
  const needsMrRefs = op === "mergeRequests.create";
  const needsState =
    op === "issues.list" ||
    op === "mergeRequests.list" ||
    op === "issues.update";
  const needsPipeline = op === "pipelines.trigger";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["gitlab"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="GitLab Credential"
        placeholder="— Personal / Project Access Token —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as GitlabOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>Project (numeric ID or owner/repo)</Label>
        <TemplateInput
          value={config.projectId ?? ""}
          onChange={(v) => onChange({ projectId: v })}
          placeholder="42 or my-group/my-repo"
        />
      </div>
      {needsIid && (
        <div>
          <Label>IID (issue / MR number within project)</Label>
          <TemplateInput
            value={config.iid ?? ""}
            onChange={(v) => onChange({ iid: v })}
            placeholder="12"
          />
        </div>
      )}
      {needsTitle && (
        <div>
          <Label>Title</Label>
          <TemplateInput
            value={config.title ?? ""}
            onChange={(v) => onChange({ title: v })}
            placeholder="Title..."
          />
        </div>
      )}
      {needsBody && (
        <div>
          <Label>Description (markdown)</Label>
          <TemplateTextarea
            value={config.description ?? ""}
            onChange={(v) => onChange({ description: v })}
            placeholder="Details..."
            rows={4}
          />
        </div>
      )}
      {needsLabelsAssignees && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Labels (CSV)</Label>
            <TemplateInput
              value={config.labels ?? ""}
              onChange={(v) => onChange({ labels: v })}
              placeholder="bug,triage"
            />
          </div>
          <div>
            <Label>Assignee IDs (CSV)</Label>
            <TemplateInput
              value={config.assigneeIds ?? ""}
              onChange={(v) => onChange({ assigneeIds: v })}
              placeholder="12,34"
            />
          </div>
        </div>
      )}
      {needsMrRefs && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Source branch</Label>
            <TemplateInput
              value={config.sourceBranch ?? ""}
              onChange={(v) => onChange({ sourceBranch: v })}
              placeholder="feature/x"
            />
          </div>
          <div>
            <Label>Target branch</Label>
            <TemplateInput
              value={config.targetBranch ?? ""}
              onChange={(v) => onChange({ targetBranch: v })}
              placeholder="main"
            />
          </div>
        </div>
      )}
      {needsComment && (
        <div>
          <Label>Comment</Label>
          <TemplateTextarea
            value={config.comment ?? ""}
            onChange={(v) => onChange({ comment: v })}
            placeholder="Triggered by workflow"
            rows={4}
          />
        </div>
      )}
      {needsState && (
        <div>
          <Label>State</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={config.state ?? "opened"}
            onChange={(e) =>
              onChange({ state: e.target.value as GitlabConfig["state"] })
            }
          >
            <option value="opened">opened</option>
            <option value="closed">closed</option>
            <option value="all">all</option>
            {op.startsWith("mergeRequests") && (
              <option value="merged">merged</option>
            )}
          </select>
        </div>
      )}
      {needsPipeline && (
        <>
          <div>
            <Label>Ref (branch / tag)</Label>
            <TemplateInput
              value={config.ref ?? ""}
              onChange={(v) => onChange({ ref: v })}
              placeholder="main"
            />
          </div>
          <div>
            <Label>Variables JSON (optional)</Label>
            <TemplateTextarea
              value={config.variables ?? ""}
              onChange={(v) => onChange({ variables: v })}
              placeholder='{"DEPLOY_ENV": "prod"}'
              rows={3}
            />
          </div>
        </>
      )}
    </div>
  );
}
