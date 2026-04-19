import { useState, useRef, useEffect, useCallback } from "react";
import { Bell, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import * as api from "@/lib/api";
import type { OrgInvitePublic } from "@/lib/api";
import { toast } from "sonner";

/**
 * Bell icon in the TopNav that surfaces pending organization invites addressed
 * to the current user. Polls `listMyInvites()` every 60 seconds; the dropdown
 * lists each invite with Accept / Decline buttons.
 */
export function InviteBell() {
  const [invites, setInvites] = useState<OrgInvitePublic[]>([]);
  const [open, setOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setInvites(await api.listMyInvites());
    } catch {
      // Silent — bell is a nice-to-have, not critical
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function handleAccept(invite: OrgInvitePublic) {
    setActingId(invite.id);
    try {
      const result = await api.acceptInviteById(invite.id);
      toast.success(`Joined ${result.organizationName} as ${result.role}`);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActingId(null);
    }
  }

  async function handleDecline(invite: OrgInvitePublic) {
    setActingId(invite.id);
    try {
      await api.declineInviteById(invite.id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActingId(null);
    }
  }

  const count = invites.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex items-center justify-center w-8 h-8 rounded-md transition-colors",
          count > 0
            ? "text-foreground hover:bg-accent"
            : "text-muted-foreground hover:text-foreground hover:bg-accent",
        )}
        aria-label={`${count} pending invite${count === 1 ? "" : "s"}`}
        title={count > 0 ? `${count} pending invite${count === 1 ? "" : "s"}` : "No pending invites"}
      >
        <Bell size={14} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full bg-indigo-500 text-white text-[9px] font-bold">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[300px] max-w-[340px]">
          <div className="px-3 py-2 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider border-b border-border">
            Pending organization invites
          </div>
          {count === 0 ? (
            <div className="px-3 py-6 text-xs text-center text-muted-foreground">
              You have no pending invites.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="px-3 py-2.5 border-b border-border/40 last:border-b-0"
                >
                  <div className="text-xs text-foreground font-medium">
                    {invite.organizationName}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Invited as <strong className="text-foreground/90">{invite.role}</strong>
                    {invite.invitedByName ? ` by ${invite.invitedByName}` : ""}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => handleAccept(invite)}
                      disabled={actingId === invite.id}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-60"
                    >
                      {actingId === invite.id ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Check size={10} />
                      )}
                      Accept
                    </button>
                    <button
                      onClick={() => handleDecline(invite)}
                      disabled={actingId === invite.id}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-60"
                    >
                      <X size={10} />
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
