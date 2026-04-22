import React from "react";
import type { GithubConfig, GithubOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Label } from "../../ui/label";

interface Props {
  config: GithubConfig;
  onChange: (patch: Partial<GithubConfig>) => void;
}

const OPERATIONS: GithubOperation[] = [
  "issues.create",
  "issues.update",
  "issues.get",
  "issues.list",
  "issues.createComment",
  "pulls.create",
  "pulls.merge",
  "pulls.list",
  "repos.get",
  "repos.listForAuthenticatedUser",
  "repos.createDispatchEvent",
  "actions.createWorkflowDispatch",
];

export function GithubForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "issues.create";
  const needsRepo = op !== "repos.listForAuthenticatedUser";
  const needsNumber =
    op === "issues.update" ||
    op === "issues.get" ||
    op === "issues.createComment" ||
    op === "pulls.merge";
  const needsTitle =
    op === "issues.create" || op === "pulls.create" || op === "issues.update";
  const needsBody =
    op === "issues.create" ||
    op === "issues.update" ||
    op === "issues.createComment" ||
    op === "pulls.create";
  const needsLabelsAssignees =
    op === "issues.create" || op === "issues.update";
  const needsPullRefs = op === "pulls.create";
  const needsStateFilter = op === "issues.list" || op === "pulls.list";
  const needsWorkflowDispatch = op === "actions.createWorkflowDispatch";
  const needsRepoDispatch = op === "repos.createDispatchEvent";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["github"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="GitHub Credential"
        placeholder="— Personal access token (ghp_... / github_pat_...) —"
      />

      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as GithubOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {needsRepo && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Owner</Label>
            <TemplateInput
              value={config.owner ?? ""}
              onChange={(v) => onChange({ owner: v })}
              placeholder="octocat"
            />
          </div>
          <div>
            <Label>Repo</Label>
            <TemplateInput
              value={config.repo ?? ""}
              onChange={(v) => onChange({ repo: v })}
              placeholder="hello-world"
            />
          </div>
        </div>
      )}

      {needsNumber && (
        <div>
          <Label>Issue / PR number</Label>
          <TemplateInput
            value={config.number ?? ""}
            onChange={(v) => onChange({ number: v })}
            placeholder="42"
          />
        </div>
      )}

      {needsTitle && (
        <div>
          <Label>Title</Label>
          <TemplateInput
            value={config.title ?? ""}
            onChange={(v) => onChange({ title: v })}
            placeholder="New issue from workflow"
          />
        </div>
      )}

      {needsBody && (
        <div>
          <Label>Body (markdown)</Label>
          <TemplateTextarea
            value={config.body ?? ""}
            onChange={(v) => onChange({ body: v })}
            placeholder="Triggered by workflow {{workflowId}}"
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
            <Label>Assignees (CSV)</Label>
            <TemplateInput
              value={config.assignees ?? ""}
              onChange={(v) => onChange({ assignees: v })}
              placeholder="octocat"
            />
          </div>
        </div>
      )}

      {needsPullRefs && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Head (source branch)</Label>
            <TemplateInput
              value={config.head ?? ""}
              onChange={(v) => onChange({ head: v })}
              placeholder="feature/foo"
            />
          </div>
          <div>
            <Label>Base (target branch)</Label>
            <TemplateInput
              value={config.base ?? ""}
              onChange={(v) => onChange({ base: v })}
              placeholder="main"
            />
          </div>
        </div>
      )}

      {needsStateFilter && (
        <div>
          <Label>State</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={config.state ?? "open"}
            onChange={(e) =>
              onChange({
                state: e.target.value as GithubConfig["state"],
              })
            }
          >
            <option value="open">open</option>
            <option value="closed">closed</option>
            <option value="all">all</option>
          </select>
        </div>
      )}

      {needsWorkflowDispatch && (
        <>
          <div>
            <Label>Workflow ID / filename</Label>
            <TemplateInput
              value={config.workflowId ?? ""}
              onChange={(v) => onChange({ workflowId: v })}
              placeholder="ci.yml"
            />
          </div>
          <div>
            <Label>Ref (branch / tag)</Label>
            <TemplateInput
              value={config.ref ?? ""}
              onChange={(v) => onChange({ ref: v })}
              placeholder="main"
            />
          </div>
          <div>
            <Label>Inputs JSON (optional)</Label>
            <TemplateTextarea
              value={config.inputs ?? ""}
              onChange={(v) => onChange({ inputs: v })}
              placeholder='{"env": "prod"}'
              rows={3}
            />
          </div>
        </>
      )}

      {needsRepoDispatch && (
        <>
          <div>
            <Label>Event type</Label>
            <TemplateInput
              value={config.eventType ?? ""}
              onChange={(v) => onChange({ eventType: v })}
              placeholder="deploy"
            />
          </div>
          <div>
            <Label>Client payload JSON (optional)</Label>
            <TemplateTextarea
              value={config.clientPayload ?? ""}
              onChange={(v) => onChange({ clientPayload: v })}
              placeholder='{"env": "prod"}'
              rows={3}
            />
          </div>
        </>
      )}
    </div>
  );
}
