import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/branding/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "../lib/api";
import { useOrgStore } from "@/store/orgStore";
import { useApiConfigStore } from "@/store/apiConfigStore";
import { spring } from "@/lib/motion";

export function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!usernameOrEmail.trim()) { setError("Username or email is required"); return; }
    if (!password.trim()) { setError("Password is required"); return; }
    setLoading(true);
    try {
      const result = await login(usernameOrEmail.trim(), password.trim());

      // Multi-org: if user belongs to multiple orgs, let them pick
      if (result.organizations && result.organizations.length > 1) {
        // Store orgs so OrgPickerPage can use them
        useOrgStore.getState().setOrganizations(
          result.organizations.map((o) => ({ ...o, createdAt: "" }))
        );
        navigate("/org-picker", {
          replace: true,
          state: { organizations: result.organizations.map((o) => ({ ...o, createdAt: "" })) },
        });
        return;
      }

      // Single org or org returned directly
      if (result.organization) {
        useOrgStore.getState().setOrganizations([
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

      navigate("/", { replace: true });
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

              <p className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/signup" className="text-primary hover:underline font-medium">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
