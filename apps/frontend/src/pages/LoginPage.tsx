import React, { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useSignupStatus } from "@/hooks/useSignupStatus";
import {
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  Shield,
  Mail,
  KeyRound,
  RefreshCw,
  LifeBuoy,
  CheckCircle2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/branding/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  login,
  verifyMfaLogin,
  resendMfaEmailOtp,
  recoverMfaStart,
  recoverMfaConfirm,
  type LoginResult,
  type MfaChallengeResult,
  type MfaEnrollmentRequiredResult,
} from "../lib/api";
import { useOrgStore } from "@/store/orgStore";
import { useApiConfigStore } from "@/store/apiConfigStore";
import { spring } from "@/lib/motion";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function finalizeLogin(
  result: LoginResult,
  navigate: ReturnType<typeof useNavigate>,
  /** If set, we came from an invite email — send the user to the accept page
   *  instead of the dashboard so they can complete the flow with one click. */
  inviteToken?: string | null,
) {
  if (result.organizations && result.organizations.length > 1) {
    useOrgStore
      .getState()
      .setOrganizations(
        result.organizations.map((o) => ({ ...o, createdAt: "" })),
      );
    navigate("/org-picker", {
      replace: true,
      state: {
        organizations: result.organizations.map((o) => ({
          ...o,
          createdAt: "",
        })),
      },
    });
    return;
  }
  if (result.organization) {
    useOrgStore
      .getState()
      .setOrganizations([
        { ...result.organization, role: result.user.role, createdAt: "" },
      ]);
    useOrgStore.getState().setCurrentOrgId(result.organization.id);
    useApiConfigStore.getState().setOrganizationId(result.organization.id);
  } else if (result.organizations && result.organizations.length === 1) {
    const org = result.organizations[0];
    useOrgStore.getState().setOrganizations([{ ...org, createdAt: "" }]);
    useOrgStore.getState().setCurrentOrgId(org.id);
    useApiConfigStore.getState().setOrganizationId(org.id);
  }
  navigate(inviteToken ? `/invite/${inviteToken}` : "/", { replace: true });
}

// ─── MFA step ─────────────────────────────────────────────────────────────────

function MfaStep({
  challenge,
  onSuccess,
  onBack,
  onStartRecovery,
}: {
  challenge: MfaChallengeResult;
  onSuccess: (result: LoginResult) => void;
  onBack: () => void;
  onStartRecovery: () => void;
}) {
  const [method, setMethod] = useState<"totp" | "email" | "backup">(
    challenge.mfaMethods.totp ? "totp" : "email",
  );
  const [code, setCode] = useState("");
  const [emailChallengeId, setEmailChallengeId] = useState(
    challenge.emailChallengeId,
  );
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("Verification code is required");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await verifyMfaLogin(
        challenge.challengeToken,
        method,
        code.trim(),
        method === "email" ? emailChallengeId : undefined,
      );
      onSuccess(result);
    } catch (err) {
      setError((err as Error).message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setResending(true);
    setError("");
    try {
      const res = await resendMfaEmailOtp(challenge.challengeToken);
      setEmailChallengeId(res.emailChallengeId);
      setCode("");
    } catch (err) {
      setError((err as Error).message || "Failed to resend");
    } finally {
      setResending(false);
    }
  };

  const methodLabel =
    method === "totp"
      ? "Authenticator App"
      : method === "email"
        ? "Email Code"
        : "Backup Code";

  const methodIcon =
    method === "totp" ? (
      <Shield size={14} className="mr-2" />
    ) : method === "email" ? (
      <Mail size={14} className="mr-2" />
    ) : (
      <KeyRound size={14} className="mr-2" />
    );

  return (
    <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <Shield size={15} className="text-primary" />
          <h1 className="text-base font-semibold text-foreground">
            Two-factor authentication
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {method === "email"
            ? "A 6-digit code was sent to your email."
            : method === "totp"
              ? "Enter the code from your authenticator app."
              : "Enter one of your backup codes."}
        </p>
      </div>

      <form onSubmit={handleVerify} className="px-6 py-5 space-y-4">
        {/* Method switcher */}
        <div className="flex gap-1.5 flex-wrap">
          {challenge.mfaMethods.totp && (
            <button
              type="button"
              onClick={() => {
                setMethod("totp");
                setCode("");
                setError("");
              }}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                method === "totp"
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Shield size={11} /> Authenticator
            </button>
          )}
          {challenge.mfaMethods.email && (
            <button
              type="button"
              onClick={() => {
                setMethod("email");
                setCode("");
                setError("");
              }}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                method === "email"
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mail size={11} /> Email code
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setMethod("backup");
              setCode("");
              setError("");
            }}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${
              method === "backup"
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <KeyRound size={11} /> Backup code
          </button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mfa-code">{methodLabel}</Label>
          <Input
            id="mfa-code"
            type="text"
            inputMode={method !== "backup" ? "numeric" : "text"}
            placeholder={method === "backup" ? "XXXXXXXXXX" : "000000"}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            autoComplete="one-time-code"
            maxLength={method === "backup" ? 10 : method === "totp" ? 6 : 6}
            className="text-center tracking-widest text-lg"
          />
        </div>

        {method === "email" && (
          <button
            type="button"
            onClick={handleResendEmail}
            disabled={resending}
            className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
          >
            {resending ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <RefreshCw size={11} />
            )}
            Resend code
          </button>
        )}

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
            onClick={handleVerify as React.MouseEventHandler}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin mr-2" />
                Verifying...
              </>
            ) : (
              <>{methodIcon}Verify</>
            )}
          </Button>
        </motion.div>
        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to login
        </button>
        <button
          type="button"
          onClick={onStartRecovery}
          className="w-full text-center text-xs text-muted-foreground/70 hover:text-muted-foreground"
        >
          <LifeBuoy size={11} className="inline mr-1" />
          Can't access your authenticator?
        </button>
      </div>
    </div>
  );
}

// ─── MFA Recovery step ────────────────────────────────────────────────────────

function MfaRecoveryStep({ onBack }: { onBack: () => void }) {
  // Phase 1: enter credentials → send OTP
  // Phase 2: enter email OTP → clear MFA
  type Phase = "credentials" | "otp" | "done";
  const [phase, setPhase] = useState<Phase>("credentials");

  // Phase 1 state
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Phase 2 state
  const [challengeId, setChallengeId] = useState("");
  const [emailMasked, setEmailMasked] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resending, setResending] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1: verify password and send OTP
  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password.trim()) {
      setError("Username/email and password are required");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await recoverMfaStart(
        usernameOrEmail.trim(),
        password.trim(),
      );
      setChallengeId(result.challengeId);
      setEmailMasked(result.emailMasked);
      setPhase("otp");
    } catch (err) {
      setError((err as Error).message || "Recovery failed");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: verify OTP and clear MFA
  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setError("Verification code is required");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await recoverMfaConfirm(challengeId, otpCode.trim());
      setPhase("done");
    } catch (err) {
      setError((err as Error).message || "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    try {
      const result = await recoverMfaStart(
        usernameOrEmail.trim(),
        password.trim(),
      );
      setChallengeId(result.challengeId);
      setOtpCode("");
    } catch (err) {
      setError((err as Error).message || "Failed to resend");
    } finally {
      setResending(false);
    }
  };

  // ── Phase: done ─────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={15} className="text-green-500" />
            <h1 className="text-base font-semibold text-foreground">
              MFA cleared
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            All MFA methods have been removed from your account.
          </p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            You can now sign in with your password. We recommend setting up MFA
            again after logging in.
          </p>
          <Button className="w-full" onClick={onBack}>
            <LogIn size={14} className="mr-2" /> Back to login
          </Button>
        </div>
      </div>
    );
  }

  // ── Phase: OTP entry ────────────────────────────────────────────────────
  if (phase === "otp") {
    return (
      <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Mail size={15} className="text-primary" />
            <h1 className="text-base font-semibold text-foreground">
              Check your email
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            A 6-digit code was sent to{" "}
            <span className="font-medium text-foreground">{emailMasked}</span>.
            Enter it below to clear your MFA.
          </p>
        </div>

        <form onSubmit={handleConfirm} className="px-6 py-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rec-otp">Verification code</Label>
            <Input
              id="rec-otp"
              type="text"
              inputMode="numeric"
              placeholder="000000"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              autoFocus
              autoComplete="one-time-code"
              maxLength={6}
              className="text-center tracking-widest text-lg"
            />
          </div>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
          >
            {resending ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <RefreshCw size={11} />
            )}
            Resend code
          </button>

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
              onClick={handleConfirm as React.MouseEventHandler}
              disabled={loading}
              variant="destructive"
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-2" />
                  Clearing MFA...
                </>
              ) : (
                <>
                  <LifeBuoy size={14} className="mr-2" /> Clear all MFA
                </>
              )}
            </Button>
          </motion.div>
          <button
            type="button"
            onClick={() => {
              setPhase("credentials");
              setError("");
              setOtpCode("");
            }}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  // ── Phase: credentials ──────────────────────────────────────────────────
  return (
    <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <LifeBuoy size={15} className="text-primary" />
          <h1 className="text-base font-semibold text-foreground">
            MFA recovery
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Verify your password — we'll send a code to your registered email to
          confirm.
        </p>
      </div>

      <form onSubmit={handleStart} className="px-6 py-5 space-y-4">
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          This will remove your authenticator app, email OTP, and all backup
          codes. You'll need to re-enroll after signing in.
        </div>

        <div className="space-y-2">
          <Label htmlFor="rec-login">Username or Email</Label>
          <Input
            id="rec-login"
            type="text"
            placeholder="admin or you@example.com"
            value={usernameOrEmail}
            onChange={(e) => setUsernameOrEmail(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rec-password">Password</Label>
          <div className="relative">
            <Input
              id="rec-password"
              type={showPass ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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
            onClick={handleStart as React.MouseEventHandler}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin mr-2" />
                Sending code...
              </>
            ) : (
              <>
                <Mail size={14} className="mr-2" /> Send verification code
              </>
            )}
          </Button>
        </motion.div>
        <button
          type="button"
          onClick={onBack}
          className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          ← Cancel
        </button>
      </div>
    </div>
  );
}

// ─── LoginPage ────────────────────────────────────────────────────────────────

export function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const { enabled: signupEnabled } = useSignupStatus();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallengeResult | null>(
    null,
  );
  const [showMfaRecovery, setShowMfaRecovery] = useState(false);

  const startEnrollment = (result: MfaEnrollmentRequiredResult) => {
    useOrgStore.getState().setOrganizations([
      {
        ...result.organization,
        role: result.organization.role ?? result.user?.role ?? "member",
        createdAt: "",
      },
    ]);
    useOrgStore.getState().setCurrentOrgId(result.organization.id);
    useApiConfigStore.getState().setOrganizationId(result.organization.id);
    navigate("/mfa-setup", { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!usernameOrEmail.trim()) {
      setError("Username or email is required");
      return;
    }
    if (!password.trim()) {
      setError("Password is required");
      return;
    }
    setLoading(true);
    try {
      const result = await login(usernameOrEmail.trim(), password.trim());
      if ("mfaRequired" in result) {
        setMfaChallenge(result);
        return;
      }
      if ("mfaEnrollmentRequired" in result) {
        startEnrollment(result);
        return;
      }
      finalizeLogin(result, navigate, inviteToken);
    } catch (err) {
      setError((err as Error).message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

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
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          className="absolute bottom-1/3 right-1/4 w-16 h-16 rounded-xl bg-primary/5 border border-primary/10"
        />
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
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

          <AnimatePresence mode="wait">
            {showMfaRecovery ? (
              <motion.div
                key="recovery"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={spring.gentle}
              >
                <MfaRecoveryStep
                  onBack={() => {
                    setShowMfaRecovery(false);
                    setMfaChallenge(null);
                    setError("");
                  }}
                />
              </motion.div>
            ) : mfaChallenge ? (
              <motion.div
                key="mfa"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={spring.gentle}
              >
                <MfaStep
                  challenge={mfaChallenge}
                  onSuccess={(result) => finalizeLogin(result, navigate, inviteToken)}
                  onBack={() => {
                    setMfaChallenge(null);
                    setError("");
                  }}
                  onStartRecovery={() => setShowMfaRecovery(true)}
                />
              </motion.div>
            ) : (
              <motion.div
                key="credentials"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={spring.gentle}
              >
                <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
                  <div className="px-6 py-5 border-b border-border">
                    <h1 className="text-base font-semibold text-foreground">
                      Welcome back
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Sign in to your account
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="usernameOrEmail">Username or Email</Label>
                      <Input
                        id="usernameOrEmail"
                        type="text"
                        placeholder="admin or you@example.com"
                        value={usernameOrEmail}
                        onChange={(e) => setUsernameOrEmail(e.target.value)}
                        autoFocus
                        autoComplete="username"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPass ? "text" : "password"}
                          placeholder="Enter your password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="current-password"
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
                            Signing in...
                          </>
                        ) : (
                          <>
                            <LogIn size={14} className="mr-2" />
                            Sign in
                          </>
                        )}
                      </Button>
                    </motion.div>

                    {signupEnabled && (
                      <p className="text-center text-sm text-muted-foreground">
                        Don't have an account?{" "}
                        <Link
                          to="/signup"
                          className="text-primary hover:underline font-medium"
                        >
                          Sign up
                        </Link>
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
