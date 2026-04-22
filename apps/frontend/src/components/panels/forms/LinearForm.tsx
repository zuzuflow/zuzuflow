import React from "react";
import type { LinearConfig, LinearOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: LinearConfig;
  onChange: (patch: Partial<LinearConfig>) => void;
}

const OPERATIONS: LinearOperation[] = [
  "issues.create",
  "issues.get",
  "issues.update",
  "issues.list",
  "issues.addComment",
  "teams.list",
];

export function LinearForm({ config, onChange }: Props): React.ReactElement {
  const op = config.operation ?? "issues.create";
  const needsIssueId =
    op === "issues.get" ||
    op === "issues.update" ||
    op === "issues.addComment";
  const needsTeam = op === "issues.create";
  const needsTitle = op === "issues.create" || op === "issues.update";
  const needsDescription = op === "issues.create" || op === "issues.update";
  const needsState = op === "issues.create" || op === "issues.update";
  const needsComment = op === "issues.addComment";
  const isList = op === "issues.list";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["linear"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Linear Credential"
        placeholder="— Personal API Key —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as LinearOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {needsTeam && (
        <div>
          <Label>Team ID</Label>
          <TemplateInput
            value={config.teamId ?? ""}
            onChange={(v) => onChange({ teamId: v })}
            placeholder="(use teams.list to find IDs)"
          />
        </div>
      )}
      {needsIssueId && (
        <div>
          <Label>Issue ID</Label>
          <TemplateInput
            value={config.issueId ?? ""}
            onChange={(v) => onChange({ issueId: v })}
            placeholder="abc12345-..."
          />
        </div>
      )}
      {needsTitle && (
        <div>
          <Label>Title</Label>
          <TemplateInput
            value={config.title ?? ""}
            onChange={(v) => onChange({ title: v })}
            placeholder="Short issue title"
          />
        </div>
      )}
      {needsDescription && (
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
      {needsState && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Priority</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={config.priority ?? 0}
                onChange={(e) =>
                  onChange({
                    priority: Number(e.target.value) as LinearConfig["priority"],
                  })
                }
              >
                <option value={0}>0 — no priority</option>
                <option value={1}>1 — urgent</option>
                <option value={2}>2 — high</option>
                <option value={3}>3 — medium</option>
                <option value={4}>4 — low</option>
              </select>
            </div>
            <div>
              <Label>State ID (optional)</Label>
              <TemplateInput
                value={config.stateId ?? ""}
                onChange={(v) => onChange({ stateId: v || undefined })}
                placeholder="(workflow state UUID)"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Assignee user ID (optional)</Label>
              <TemplateInput
                value={config.assigneeId ?? ""}
                onChange={(v) => onChange({ assigneeId: v || undefined })}
                placeholder="user-uuid"
              />
            </div>
            <div>
              <Label>Label IDs CSV (optional)</Label>
              <TemplateInput
                value={config.labelIds ?? ""}
                onChange={(v) => onChange({ labelIds: v || undefined })}
                placeholder="label-uuid-1,label-uuid-2"
              />
            </div>
          </div>
        </>
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
      {isList && (
        <>
          <div>
            <Label>Filter JSON (optional, Linear IssueFilter shape)</Label>
            <TemplateTextarea
              value={config.filter ?? ""}
              onChange={(v) => onChange({ filter: v || undefined })}
              placeholder='{"state":{"type":{"eq":"started"}}}'
              rows={3}
            />
          </div>
          <div>
            <Label>First (max results)</Label>
            <Input
              type="number"
              min={1}
              max={250}
              value={config.first ?? 25}
              onChange={(e) =>
                onChange({ first: Number(e.target.value) || undefined })
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
