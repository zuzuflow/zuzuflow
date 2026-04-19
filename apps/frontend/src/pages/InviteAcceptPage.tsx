import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";
import { useApiConfigStore } from "@/store/apiConfigStore";
import * as api from "@/lib/api";
import type { PublicInvitePreview } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Public landing page for invite emails — `/invite/:token`.
 *
 * Three possible states once the invite preview loads:
 *   1. User is logged in AND their email matches the invite → show Accept/Decline
 *   2. User is logged in but different email → show mismatch warning
 *   3. User is not logged in:
 *      - account exists for the invited email → "Log in to accept" (preserves ?invite=token)
 *      - no account yet → "Sign up to accept" (preserves ?invite=token)
 */
export function InviteAcceptPage(): React.ReactElement {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useApiConfigStore((s) => s.isAuthenticated);

  const [preview, setPreview] = useState<PublicInvitePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [acting, setActing] = useState<"accept" | "decline" | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .getPublicInvite(token)
      .then(setPreview)
      .catch((err) => setLoadError((err as Error).message));
  }, [token]);

  async function handleAccept() {
    if (!token) return;
    setActing("accept");
    try {
      const result = await api.acceptInvite(token);
      toast.success(`Joined ${result.organizationName} as ${result.role}`);
      navigate("/");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActing(null);
    }
  }

  async function handleDecline() {
    if (!token) return;
    setActing("decline");
    try {
      await api.declineInvite(token);
      toast.success("Invite declined");
      navigate("/");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setActing(null);
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (loadError) {
    return (
      <Centered>
        <Card icon={<XCircle size={32} className="text-red-400" />}>
          <h1 className="text-lg font-semibold mb-1">Invite unavailable</h1>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Link to="/login" className="text-xs text-indigo-400 hover:text-indigo-300 mt-4 inline-block">
            Go to login →
          </Link>
        </Card>
      </Centered>
    );
  }

  if (!preview) {
    return (
      <Centered>
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </Centered>
    );
  }

  // ── State 3: not logged in ────────────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <Centered>
        <Card icon={<Mail size={32} className="text-indigo-400" />}>
          <h1 className="text-lg font-semibold mb-1">
            {preview.inviterName} invited you to {preview.organizationName}
          </h1>
          <p className="text-sm text-muted-foreground mb-1">
            as a <strong className="text-foreground">{preview.role}</strong>
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            Invite addressed to <strong className="text-foreground">{preview.invitedEmail}</strong>
          </p>
          <div className="space-y-2">
            {preview.userExists ? (
              <Link
                to={`/login?invite=${token}`}
                className="block w-full text-center px-4 py-2 text-sm font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                Log in to accept
              </Link>
            ) : (
              <Link
                to={`/signup?invite=${token}&email=${encodeURIComponent(preview.invitedEmail)}`}
                className="block w-full text-center px-4 py-2 text-sm font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                Sign up & join
              </Link>
            )}
            <p className="text-[11px] text-muted-foreground/70 text-center">
              Invite expires{" "}
              <time dateTime={preview.expiresAt}>
                {new Date(preview.expiresAt).toLocaleDateString()}
              </time>
            </p>
          </div>
        </Card>
      </Centered>
    );
  }

  // ── Logged in — show Accept/Decline. Backend rejects with FORBIDDEN if the
  //    current user's email doesn't match the invite's invitedEmail.

  return (
    <Centered>
      <Card icon={<Mail size={32} className="text-indigo-400" />}>
        <h1 className="text-lg font-semibold mb-1">
          Join {preview.organizationName}?
        </h1>
        <p className="text-sm text-muted-foreground mb-1">
          {preview.inviterName} invited you as a{" "}
          <strong className="text-foreground">{preview.role}</strong>.
        </p>
        <p className="text-xs text-muted-foreground mb-1">
          Addressed to <strong className="text-foreground">{preview.invitedEmail}</strong>
        </p>
        <p className="text-[11px] text-muted-foreground/70 mb-5">
          Invite expires{" "}
          <time dateTime={preview.expiresAt}>
            {new Date(preview.expiresAt).toLocaleDateString()}
          </time>
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleAccept}
            disabled={!!acting}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-60",
            )}
          >
            {acting === "accept" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CheckCircle2 size={14} />
            )}
            Accept
          </button>
          <button
            onClick={handleDecline}
            disabled={!!acting}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-60"
          >
            {acting === "decline" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <XCircle size={14} />
            )}
            Decline
          </button>
        </div>
      </Card>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
      {children}
    </div>
  );
}

function Card({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="max-w-sm w-full bg-card border border-border rounded-xl p-6 text-center">
      {icon && <div className="flex justify-center mb-3">{icon}</div>}
      {children}
    </div>
  );
}
