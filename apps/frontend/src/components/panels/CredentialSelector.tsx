import React, { useEffect, useState } from "react";
import { KeyRound, ExternalLink, RefreshCw } from "lucide-react";
import * as api from "../../lib/api";
import { cn } from "../../lib/utils";

interface CredentialSelectorProps {
  /** The kinds to filter (e.g. ["postgres"]) — undefined = all */
  kinds?: api.CredentialKind[];
  /** Currently selected credential ID */
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  label?: string;
  placeholder?: string;
}

const selectClass =
  "w-full px-3 py-1.5 text-sm bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

export function CredentialSelector({
  kinds,
  value,
  onChange,
  label = "Credential",
  placeholder = "— Select saved credential —",
}: CredentialSelectorProps): React.ReactElement {
  const [credentials, setCredentials] = useState<api.CredentialItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .listCredentials()
      .then((all) => {
        setCredentials(kinds ? all.filter((c) => kinds.includes(c.kind)) : all);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <KeyRound size={11} />
          {label}
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
            title="Refresh"
          >
            <RefreshCw size={10} className={cn(loading && "animate-spin")} />
          </button>
          <a
            href="/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
          >
            Manage
            <ExternalLink size={9} />
          </a>
        </div>
      </div>
      <select
        className={selectClass}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        disabled={loading}
      >
        <option value="">{loading ? "Loading…" : placeholder}</option>
        {credentials.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.kind})
          </option>
        ))}
      </select>
      {credentials.length === 0 && !loading && (
        <p className="text-[10px] text-muted-foreground mt-1">
          No credentials found.{" "}
          <a href="/credentials" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300">
            Create one
          </a>{" "}
          first.
        </p>
      )}
    </div>
  );
}
