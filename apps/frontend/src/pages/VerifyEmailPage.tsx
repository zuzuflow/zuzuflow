import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Loader2, MailCheck } from "lucide-react";
import { motion } from "framer-motion";
import { Logo } from "@/components/branding/Logo";
import { Button } from "@/components/ui/button";
import { verifyEmail, resendVerificationEmail } from "@/lib/api";
import { spring } from "@/lib/motion";

// =============================================================================
// VerifyEmailPage
//
// Landing page for the verification link emailed at signup time.
//   • ?token=<raw> present → POST to /auth/verify-email, show success, redirect.
//   • Missing token or backend rejection → show error + offer resend form.
// On success we receive a JWT and the user is logged in directly.
// =============================================================================

type Phase = "verifying" | "success" | "error";

export function VerifyEmailPage(): React.ReactElement {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [phase, setPhase] = useState<Phase>("verifying");
  const [errorMsg, setErrorMsg] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resentAt, setResentAt] = useState<number | null>(null);

  useEffect(() => {
    if (!token) {
      setPhase("error");
      setErrorMsg("Missing verification token.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await verifyEmail(token);
        if (cancelled) return;
        setPhase("success");
        // Short delay so the user sees the success state before the redirect.
        setTimeout(() => {
          if (!cancelled) navigate("/", { replace: true });
        }, 1500);
      } catch (err) {
        if (cancelled) return;
        setErrorMsg((err as Error).message || "Verification failed.");
        setErrorCode(((err as any).code as string) ?? null);
        setPhase("error");
      }
    })();
    return () => { cancelled = true; };
  }, [token, navigate]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail.trim()) return;
    setResending(true);
    try {
      await resendVerificationEmail(resendEmail.trim());
      setResentAt(Date.now());
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.gentle}
        className="max-w-md w-full rounded-2xl border border-border bg-card p-8 shadow-xl"
      >
        <div className="flex justify-center mb-6">
          <Logo size="md" />
        </div>

        {phase === "verifying" && (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 size={22} className="text-primary animate-spin" />
              </div>
            </div>
            <h1 className="text-lg font-semibold text-foreground mb-1">
              Verifying your email…
            </h1>
            <p className="text-sm text-muted-foreground">
              This only takes a second.
            </p>
          </div>
        )}

        {phase === "success" && (
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 size={26} className="text-emerald-500" />
              </div>
            </div>
            <h1 className="text-lg font-semibold text-foreground mb-1">
              Email verified
            </h1>
            <p className="text-sm text-muted-foreground">
              Signing you in…
            </p>
          </div>
        )}

        {phase === "error" && (
          <div>
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle size={24} className="text-amber-500" />
              </div>
            </div>
            <h1 className="text-lg font-semibold text-foreground text-center mb-2">
              {errorCode === "EXPIRED"
                ? "Verification link expired"
                : errorCode === "ALREADY_USED"
                  ? "Link already used"
                  : "Verification failed"}
            </h1>
            <p className="text-sm text-muted-foreground text-center mb-6">
              {errorMsg}
            </p>

            <form onSubmit={handleResend} className="space-y-3">
              <label className="block text-xs text-muted-foreground">
                Enter your email to request a new verification link:
              </label>
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
              <Button type="submit" disabled={resending || !resendEmail} className="w-full">
                {resending ? (
                  <><Loader2 size={14} className="animate-spin mr-2" /> Sending…</>
                ) : resentAt ? (
                  <><MailCheck size={14} className="mr-2" /> Verification email sent</>
                ) : (
                  "Send new verification email"
                )}
              </Button>
            </form>

            <div className="text-center mt-5">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Back to sign in
              </Link>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
