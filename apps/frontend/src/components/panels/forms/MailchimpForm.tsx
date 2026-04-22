import React from "react";
import type { MailchimpConfig, MailchimpOperation } from "@workflow/shared";
import { CredentialSelector } from "../CredentialSelector";
import { TemplateInput } from "../TemplateInput";
import { TemplateTextarea } from "../TemplateTextarea";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";

interface Props {
  config: MailchimpConfig;
  onChange: (patch: Partial<MailchimpConfig>) => void;
}

const OPERATIONS: MailchimpOperation[] = [
  "lists.addMember",
  "lists.updateMember",
  "lists.getMember",
  "lists.deleteMember",
  "lists.getMembers",
  "campaigns.send",
  "campaigns.get",
];

export function MailchimpForm({
  config,
  onChange,
}: Props): React.ReactElement {
  const op = config.operation ?? "lists.addMember";
  const needsList = op.startsWith("lists.");
  const needsEmail =
    op === "lists.addMember" ||
    op === "lists.updateMember" ||
    op === "lists.getMember" ||
    op === "lists.deleteMember";
  const needsStatusFields =
    op === "lists.addMember" || op === "lists.updateMember";
  const needsCampaign = op.startsWith("campaigns.");
  const isList = op === "lists.getMembers";

  return (
    <div className="space-y-4">
      <CredentialSelector
        kinds={["mailchimp"]}
        value={config.credentialId}
        onChange={(id) => onChange({ credentialId: id })}
        label="Mailchimp Credential"
        placeholder="— API key (must include -<dc> suffix) —"
      />
      <div>
        <Label>Operation</Label>
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          value={op}
          onChange={(e) =>
            onChange({ operation: e.target.value as MailchimpOperation })
          }
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {needsList && (
        <div>
          <Label>Audience / List ID</Label>
          <TemplateInput
            value={config.listId ?? ""}
            onChange={(v) => onChange({ listId: v })}
            placeholder="abc123"
          />
        </div>
      )}
      {needsCampaign && (
        <div>
          <Label>Campaign ID</Label>
          <TemplateInput
            value={config.campaignId ?? ""}
            onChange={(v) => onChange({ campaignId: v })}
            placeholder="abc123"
          />
        </div>
      )}
      {needsEmail && (
        <div>
          <Label>Email</Label>
          <TemplateInput
            value={config.email ?? ""}
            onChange={(v) => onChange({ email: v })}
            placeholder="user@example.com"
          />
        </div>
      )}
      {needsStatusFields && (
        <>
          <div>
            <Label>Status</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={config.status ?? "subscribed"}
              onChange={(e) =>
                onChange({
                  status: e.target.value as MailchimpConfig["status"],
                })
              }
            >
              <option value="subscribed">subscribed</option>
              <option value="unsubscribed">unsubscribed</option>
              <option value="cleaned">cleaned</option>
              <option value="pending">pending</option>
              <option value="transactional">transactional</option>
            </select>
          </div>
          <div>
            <Label>Merge fields JSON (optional)</Label>
            <TemplateTextarea
              value={config.mergeFields ?? ""}
              onChange={(v) => onChange({ mergeFields: v || undefined })}
              placeholder='{"FNAME":"Ada","LNAME":"Lovelace"}'
              rows={3}
            />
          </div>
          <div>
            <Label>Tags JSON array (optional)</Label>
            <TemplateTextarea
              value={config.tags ?? ""}
              onChange={(v) => onChange({ tags: v || undefined })}
              placeholder='["newsletter","trial"]'
              rows={2}
            />
          </div>
        </>
      )}
      {isList && (
        <div>
          <Label>Count</Label>
          <Input
            type="number"
            min={1}
            max={1000}
            value={config.count ?? 50}
            onChange={(e) =>
              onChange({ count: Number(e.target.value) || undefined })
            }
          />
        </div>
      )}
    </div>
  );
}
