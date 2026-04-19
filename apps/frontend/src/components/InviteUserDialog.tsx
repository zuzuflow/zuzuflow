import { useState } from "react";
import { Loader2, Mail, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import * as api from "@/lib/api";
import { toast } from "sonner";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful invite so the parent can refresh its lists. */
  onInvited: () => void;
}

/**
 * Small dialog to invite someone to the current org by email.
 *
 * Success path shows the generated accept URL — useful if SMTP delivery fails
 * or if the admin wants to send it through their own channel.
 */
export function InviteUserDialog({ open, onOpenChange, onInvited }: InviteUserDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{
    email: string;
    acceptUrl: string;
    targetUserExists: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setEmail("");
    setRole("member");
    setSubmitting(false);
    setError(null);
    setSent(null);
    setCopied(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.createOrgInvite(email.trim(), role);
      setSent({
        email: result.invite.invitedEmail,
        acceptUrl: result.acceptUrl,
        targetUserExists: result.targetUserExists,
      });
      onInvited();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function copyUrl() {
    if (!sent) return;
    try {
      await navigator.clipboard.writeText(sent.acceptUrl);
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the link manually");
    }
  }

  const inputClass =
    "w-full px-3 py-1.5 text-sm bg-secondary border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            <span className="inline-flex items-center gap-2">
              <Mail size={14} className="text-muted-foreground" />
              Invite a user to this organization
            </span>
          </DialogTitle>
          <DialogDescription>
            They'll get an email with a link to join. If they already have a
            ZuzuFlow account, they'll also see the invite inside the app.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="space-y-3">
            <div className="rounded-md border border-emerald-900/40 bg-emerald-900/20 px-3 py-2 text-xs text-emerald-300">
              ✔ Invite sent to <strong>{sent.email}</strong>.
              {sent.targetUserExists
                ? " They'll see it when they next log in."
                : " They can sign up from the emailed link."}
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                Accept link (copy if email didn't arrive)
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={sent.acceptUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className={inputClass + " text-[11px] font-mono"}
                />
                <button
                  type="button"
                  onClick={copyUrl}
                  className="shrink-0 p-2 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                  title="Copy link"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                Email address
              </label>
              <input
                autoFocus
                type="email"
                placeholder="person@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                Role
              </label>
              <div className="flex gap-2">
                {(["member", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      "flex-1 px-3 py-2 text-xs rounded border transition-colors",
                      role === r
                        ? "border-indigo-500 bg-indigo-600/30 text-indigo-200"
                        : "border-border bg-secondary text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <div className="font-semibold capitalize">{r}</div>
                    <div className="text-[10px] text-muted-foreground/80 mt-0.5">
                      {r === "admin"
                        ? "Manage org settings & invite others"
                        : "Regular access"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 size={12} className="animate-spin mr-1.5" />
                ) : (
                  <Mail size={12} className="mr-1.5" />
                )}
                {submitting ? "Sending…" : "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
