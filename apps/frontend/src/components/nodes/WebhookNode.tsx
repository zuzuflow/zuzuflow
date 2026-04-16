import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import { Shield, ShieldCheck, Key, Lock, KeyRound } from "lucide-react";
import type { WebhookConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-green-700 text-green-200",
  POST: "bg-blue-700 text-blue-200",
  PUT: "bg-amber-700 text-amber-200",
  PATCH: "bg-orange-700 text-orange-200",
  DELETE: "bg-red-700 text-red-200",
};

const AUTH_BADGE: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  hmac: {
    label: "HMAC",
    icon: <ShieldCheck size={10} />,
    className: "bg-emerald-800/60 text-emerald-300 border-emerald-700/50",
  },
  basic: {
    label: "Basic",
    icon: <Lock size={10} />,
    className: "bg-amber-800/60 text-amber-300 border-amber-700/50",
  },
  jwt: {
    label: "JWT",
    icon: <Key size={10} />,
    className: "bg-sky-800/60 text-sky-300 border-sky-700/50",
  },
};

export function WebhookNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as WebhookConfig;
  const methodClass = METHOD_COLORS[cfg.method] ?? "bg-slate-700 text-slate-200";
  const authType = cfg.auth?.type ?? "none";
  const badge = AUTH_BADGE[authType];
  const usesCredential = cfg.authCredentialId !== undefined;

  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${methodClass}`}>
            {cfg.method}
          </span>
          <span className="text-slate-300 truncate">/{cfg.path}</span>
        </div>
        {badge ? (
          <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-medium ${badge.className}`}>
            {usesCredential ? <KeyRound size={10} /> : badge.icon}
            {badge.label}
            {usesCredential && <span className="opacity-60">(cred)</span>}
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-medium bg-slate-700/40 text-slate-500 border-slate-600/50">
            <Shield size={10} />
            No Auth
          </div>
        )}
      </div>
    </NodeWrapper>
  );
}
