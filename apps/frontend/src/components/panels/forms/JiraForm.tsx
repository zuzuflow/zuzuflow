import React from "react";
import type { JiraConfig, JiraOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: JiraConfig;
  onChange: (patch: Partial<JiraConfig>) => void;
}

const OPERATIONS: JiraOperation[] = [
  "issues.create",
  "issues.get",
  "issues.update",
  "issues.transition",
  "issues.addComment",
  "issues.search",
];

export function JiraForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "issues.create";
  const needsKey =
    op === "issues.get" ||
    op === "issues.update" ||
    op === "issues.transition" ||
    op === "issues.addComment";
  const isCreate = op === "issues.create";
  const isSearch = op === "issues.search";
  const isTransition = op === "issues.transition";
  const isComment = op === "issues.addComment";
  const needsSummary = isCreate || op === "issues.update";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["jira"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Jira Credential"
        placeholder="— baseUrl + email + API token —"
      />

      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as JiraOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {isCreate && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Project key</Label>
            <TemplateInput
              value={config.projectKey ?? ""}
              onChange={(v) => onChange({ projectKey: v })}
              placeholder="PROJ"
            />
          </div>
          <div>
            <Label>Issue type</Label>
            <TemplateInput
              value={config.issueType ?? ""}
              onChange={(v) => onChange({ issueType: v })}
              placeholder="Bug / Task / Story"
            />
          </div>
        </div>
      )}

      {needsKey && (
        <div>
          <Label>Issue key</Label>
          <TemplateInput
            value={config.issueKey ?? ""}
            onChange={(v) => onChange({ issueKey: v })}
            placeholder="PROJ-123"
          />
        </div>
      )}

      {needsSummary && (
        <div>
          <Label>Summary</Label>
          <TemplateInput
            value={config.summary ?? ""}
            onChange={(v) => onChange({ summary: v })}
            placeholder="Short issue title"
          />
        </div>
      )}

      {(isCreate || op === "issues.update") && (
        <>
          <div>
            <Label>Description (plain text)</Label>
            <TemplateTextarea
              value={config.description ?? ""}
              onChange={(v) => onChange({ description: v })}
              placeholder="Details..."
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Labels (CSV)</Label>
              <TemplateInput
                value={config.labels ?? ""}
                onChange={(v) => onChange({ labels: v })}
                placeholder="triage,bug"
              />
            </div>
            <div>
              <Label>Assignee accountId</Label>
              <TemplateInput
                value={config.assigneeAccountId ?? ""}
                onChange={(v) => onChange({ assigneeAccountId: v })}
                placeholder="5b10a..."
              />
            </div>
          </div>
          <div>
            <Label>Extra fields JSON (optional)</Label>
            <TemplateTextarea
              value={config.extraFields ?? ""}
              onChange={(v) => onChange({ extraFields: v })}
              placeholder='{"priority": {"name": "High"}}'
              rows={3}
            />
          </div>
        </>
      )}

      {isTransition && (
        <div>
          <Label>Transition ID</Label>
          <TemplateInput
            value={config.transitionId ?? ""}
            onChange={(v) => onChange({ transitionId: v })}
            placeholder="11 (use issues.get to see available transitions)"
          />
        </div>
      )}

      {isComment && (
        <div>
          <Label>Comment</Label>
          <TemplateTextarea
            value={config.comment ?? ""}
            onChange={(v) => onChange({ comment: v })}
            placeholder="This was resolved by workflow {{workflowId}}."
            rows={4}
          />
        </div>
      )}

      {isSearch && (
        <>
          <div>
            <Label>JQL</Label>
            <TemplateTextarea
              value={config.jql ?? ""}
              onChange={(v) => onChange({ jql: v })}
              placeholder='project = "PROJ" AND status = "To Do"'
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Fields CSV</Label>
              <TemplateInput
                value={config.fields ?? ""}
                onChange={(v) => onChange({ fields: v })}
                placeholder="summary,status,assignee"
              />
            </div>
            <div>
              <Label>Max results</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={config.maxResults ?? 50}
                onChange={(e) =>
                  onChange({ maxResults: Number(e.target.value) || undefined })
                }
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
