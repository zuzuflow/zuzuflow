import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Mail, Loader2, CheckCircle2, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/branding/Logo";
import { spring } from "@/lib/motion";
import {
  getMfaStatus,
  setupTotp,
  enableTotp,
  enableEmailOtp,
  type TotpSetupResult,
} from "@/lib/api";
import { useApiConfigStore } from "@/store/apiConfigStore";

export function MfaEnrollmentPage(): React.ReactElement {
  const navigate = useNavigate();
  const clearAuth = useApiConfigStore((s) => s.clearAuth);

  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");

  const [totpSetupData, setTotpSetupData] = useState<TotpSetupResult | null>(
    null,
  );
  const [totpCode, setTotpCode] = useState("");
  const [totpLoading, setTotpLoading] = useState(false);

  const [emailLoading, setEmailLoading] = useState(false);
  const [enrolled, setEnrolled] = useState(false);

  const refreshStatus = async () => {
    const status = await getMfaStatus();
    const isEnrolled =
      status.totpEnabled ||
      status.emailEnabled ||
      status.backupCodesRemaining > 0;
    setEnrolled(isEnrolled);
    if (isEnrolled) {
      setStatusMsg("MFA enrolled. You can continue to the app.");
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await refreshStatus();
      } catch (err) {
        setError((err as Error).message || "Failed to load MFA status");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const startTotpSetup = async () => {
    setError("");
    setTotpLoading(true);
    try {
      setTotpSetupData(await setupTotp());
    } catch (err) {
      setError((err as Error).message || "Failed to start authenticator setup");
    } finally {
      setTotpLoading(false);
    }
  };

  const confirmTotp = async () => {
    if (!totpCode.trim()) {
      setError("Enter the 6-digit code from your authenticator app");
      return;
    }
    setError("");
    setTotpLoading(true);
    try {
      await enableTotp(totpCode.trim());
      setTotpSetupData(null);
      setTotpCode("");
      await refreshStatus();
    } catch (err) {
      setError((err as Error).message || "Failed to enable authenticator MFA");
    } finally {
      setTotpLoading(false);
    }
  };

  const enableEmail = async () => {
    setError("");
    setEmailLoading(true);
    try {
      await enableEmailOtp();
      await refreshStatus();
    } catch (err) {
      setError((err as Error).message || "Failed to enable email OTP");
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.gentle}
        className="w-full max-w-lg"
      >
        <div className="flex justify-center mb-8">
          <Logo size="md" />
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-border">
            <h1 className="text-base font-semibold text-foreground">
              MFA required by your organization
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Complete enrollment to continue using the app.
            </p>
          </div>

          {loading ? (
            <div className="px-6 py-8 flex items-center justify-center text-muted-foreground">
              <Loader2 size={16} className="animate-spin mr-2" /> Loading...
            </div>
          ) : (
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs text-muted-foreground">
                Any enrolled method unlocks access: Authenticator app, Email
                OTP, or existing backup codes.
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Button
                  onClick={startTotpSetup}
                  disabled={totpLoading || enrolled}
                  className="w-full"
                >
                  {totpLoading ? (
                    <Loader2 size={14} className="animate-spin mr-2" />
                  ) : (
                    <Shield size={14} className="mr-2" />
                  )}
                  Setup authenticator
                </Button>

                <Button
                  variant="outline"
                  onClick={enableEmail}
                  disabled={emailLoading || enrolled}
                  className="w-full"
                >
                  {emailLoading ? (
                    <Loader2 size={14} className="animate-spin mr-2" />
                  ) : (
                    <Mail size={14} className="mr-2" />
                  )}
                  Enable email OTP
                </Button>
              </div>

              {totpSetupData && !enrolled && (
                <div className="border border-border rounded-xl p-4 space-y-3">
                  <p className="text-sm text-foreground font-medium">
                    Scan QR in your authenticator app
                  </p>
                  <img
                    src={totpSetupData.qrCodeUrl}
                    alt="TOTP QR code"
                    className="w-44 h-44 rounded border border-border bg-white mx-auto"
                  />
                  <div className="space-y-2">
                    <Label htmlFor="enroll-totp-code">6-digit code</Label>
                    <Input
                      id="enroll-totp-code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value)}
                      placeholder="000000"
                      className="text-center tracking-widest"
                    />
                  </div>
                  <Button
                    onClick={confirmTotp}
                    disabled={totpLoading}
                    className="w-full"
                  >
                    {totpLoading ? (
                      <Loader2 size={14} className="animate-spin mr-2" />
                    ) : null}
                    Confirm authenticator
                  </Button>
                </div>
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

              {statusMsg && (
                <div className="flex items-center gap-2 text-sm text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  <CheckCircle2 size={14} />
                  {statusMsg}
                </div>
              )}
            </div>
          )}

          <div className="px-6 py-4 border-t border-border space-y-2">
            <Button
              onClick={() => navigate("/", { replace: true })}
              disabled={!enrolled}
              className="w-full"
            >
              Continue to app
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                clearAuth();
                navigate("/login", { replace: true });
              }}
            >
              <LogOut size={14} className="mr-2" /> Sign out
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
