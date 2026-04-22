import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2, UserPlus, Lock, MailCheck } from "lucide-react";
import { useSignupStatus } from "@/hooks/useSignupStatus";
import { resendVerificationEmail } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/branding/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signup } from "@/lib/api";
import { spring } from "@/lib/motion";

export function SignupPage(): React.ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // If this signup flow was triggered from an invite email, the raw token
  // (and pre-filled email) are in the query string. We pass the token to the
  // backend so signup auto-joins the inviting org instead of creating a fresh
  // personal one.
  const inviteToken = searchParams.get("invite") || undefined;
  const prefilledEmail = searchParams.get("email") || "";
  const { enabled: signupEnabled, loading: signupStatusLoading } = useSignupStatus();

  const [orgName, setOrgName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Post-signup "check your email" state (public signup, no invite token)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resentAt, setResentAt] = useState<number | null>(null);

  // When an invite is in play the user doesn't need to name a new org — they
  // join the inviting one. Seed a throwaway org name; backend will still create
  // a personal org alongside (harmless) and auto-switch to the invited one.
  useEffect(() => {
    if (inviteToken && !orgName) setOrgName("My Workspace");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!orgName.trim()) { setError("Organization name is required"); return; }
    if (!username.trim()) { setError("Username is required"); return; }
    if (!email.trim()) { setError("Email is required"); return; }
    if (!email.includes("@")) { setError("Please enter a valid email address"); return; }
    if (!password.trim()) { setError("Password is required"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }

    setLoading(true);
    try {
      const result = await signup(
        orgName.trim(),
        username.trim(),
        email.trim(),
        password.trim(),
        inviteToken,
      );
      if ("requiresVerification" in result) {
        // Public signup — no JWT. Show "check your email" screen.
        setPendingEmail(result.email);
      } else {
        // Invite path (or first-user bootstrap) — logged in already.
        navigate("/", { replace: true });
      }
    } catch (err) {
      setError((err as Error).message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    setResending(true);
    try {
      await resendVerificationEmail(pendingEmail);
      setResentAt(Date.now());
    } finally {
      setResending(false);
    }
  };

  // "Check your email" screen shown after a public signup. No JWT issued —
  // user must click the verification link to activate their account.
  if (pendingEmail) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring.gentle}
          className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-xl"
        >
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <MailCheck size={26} className="text-primary" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Check your email
          </h1>
          <p className="text-sm text-muted-foreground mb-1">
            We've sent a verification link to
          </p>
          <p className="text-sm font-medium text-foreground mb-5 break-all">
            {pendingEmail}
          </p>
          <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
            Click the link in the email to activate your account and sign in.
            The link expires in 24 hours.
          </p>

          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? (
                <><Loader2 size={14} className="animate-spin mr-2" /> Resending...</>
              ) : resentAt ? (
                "Verification email resent ✓"
              ) : (
                "Resend verification email"
              )}
            </Button>
            <Link
              to="/login"
              className="inline-block w-full text-sm text-muted-foreground hover:text-foreground transition-colors pt-2"
            >
              Back to sign in
            </Link>
          </div>

          <p className="text-[11px] text-muted-foreground mt-6 leading-relaxed">
            Didn't get it? Check your spam folder, or wait a minute and try
            resending. If your admin hasn't configured SMTP yet, the link will
            be printed to the server logs instead.
          </p>
        </motion.div>
      </div>
    );
  }

  // Public signup may be disabled on self-hosted instances. An invite token
  // bypasses this — invited users can still create their account through the
  // flow. Show a friendly "disabled" state only when BOTH conditions hold.
  if (!signupStatusLoading && !signupEnabled && !inviteToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl border border-border bg-card p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Lock size={20} className="text-muted-foreground" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Signup is disabled
          </h1>
          <p className="text-sm text-muted-foreground mb-5">
            This ZuzuFlow instance doesn't allow public signups. Contact your
            administrator for access — they can invite you from Settings → Users.
          </p>
          <Link
            to="/login"
            className="inline-block px-4 py-2 text-sm font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left branding panel -- hidden on mobile */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 flex-col items-center justify-center relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={spring.gentle}
        >
          <Logo size="lg" className="mb-6" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.gentle, delay: 0.1 }}
          className="text-lg text-muted-foreground max-w-sm text-center"
        >
          Visual workflow automation for teams that ship fast
        </motion.p>

        {/* Decorative floating shapes */}
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-20 h-20 rounded-2xl bg-primary/5 border border-primary/10"
        />
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-1/3 right-1/4 w-16 h-16 rounded-xl bg-primary/5 border border-primary/10"
        />
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute top-1/3 right-1/3 w-12 h-12 rounded-lg bg-primary/5 border border-primary/10"
        />
      </div>

      {/* Right form panel */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={spring.gentle}
        className="flex-1 flex items-center justify-center px-6"
      >
        <div className="w-full max-w-sm">
          {/* Logo for mobile only */}
          <div className="md:hidden flex justify-center mb-8">
            <Logo size="md" />
          </div>

          <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-border">
              <h1 className="text-base font-semibold text-foreground">
                Create your account
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Set up your organization and get started
              </p>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  type="text"
                  placeholder="My Company"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  autoFocus
                  autoComplete="organization"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPass ? "text" : "password"}
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pr-9"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPass((v) => !v)}
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPass ? "text" : "password"}
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pr-9"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPass((v) => !v)}
                  >
                    {showConfirmPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </Button>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </form>

            <div className="px-6 py-4 border-t border-border space-y-3">
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleSubmit as React.MouseEventHandler}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin mr-2" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      <UserPlus size={14} className="mr-2" />
                      Sign up
                    </>
                  )}
                </Button>
              </motion.div>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
