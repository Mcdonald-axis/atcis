"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, LogOut, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthService, type AuthUser } from "@/services/auth-service";

interface ForceChangePasswordDialogProps {
  initialMustChange?: boolean;
}

export function ForceChangePasswordDialog({ initialMustChange = false }: ForceChangePasswordDialogProps) {
  const [isOpen, setIsOpen] = useState(initialMustChange);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(3);

  useEffect(() => {
    const user = AuthService.getCurrentUser();
    setCurrentUser(user);
    if (initialMustChange || user?.must_change_password) {
      setIsOpen(true);
    }

    const handleAuthChanged = (event: Event) => {
      const detail = (event as CustomEvent<AuthUser>).detail;
      setCurrentUser(detail);
      if (detail?.must_change_password) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };

    window.addEventListener("atcis-auth-changed", handleAuthChanged);
    return () => window.removeEventListener("atcis-auth-changed", handleAuthChanged);
  }, [initialMustChange]);

  useEffect(() => {
    if (!passwordChanged) return;

    const interval = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    const timeout = window.setTimeout(() => {
      void AuthService.logout();
    }, 3000);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [passwordChanged]);

  const hasMinLength = password.length >= 8;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!hasMinLength) {
      setErrorMsg("Password must be at least 8 characters in length.");
      return;
    }

    if (!passwordsMatch) {
      setErrorMsg("Passwords do not match. Please re-check.");
      return;
    }

    setLoading(true);

    try {
      const result = await AuthService.changePassword(password);
      if (!result.success) {
        setErrorMsg(result.message || "Failed to update password. Please try again.");
        setLoading(false);
        return;
      }

      toast.success("Password Updated Successfully", {
        description: "Your new password is active. You are now being signed out securely.",
      });

      setPassword("");
      setConfirmPassword("");
      setSecondsRemaining(3);
      setPasswordChanged(true);
    } catch {
      setErrorMsg("An unexpected error occurred. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await AuthService.logout();
  };

  if (!isOpen) return null;

  if (passwordChanged) {
    return (
      <Dialog open onOpenChange={() => {}}>
        <DialogContent
          className="border-border/80 bg-background/95 shadow-2xl backdrop-blur-xl sm:max-w-md"
          showCloseButton={false}
          onPointerDownOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader className="flex flex-col items-center gap-2 pt-3 text-center">
            <div className="mb-2 flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 ring-4 ring-emerald-500/10 dark:text-emerald-400">
              <CheckCircle2 className="size-7" />
            </div>
            <DialogTitle className="font-bold text-xl tracking-tight">Password changed successfully</DialogTitle>
            <DialogDescription className="max-w-sm text-muted-foreground text-sm leading-6">
              Your new password is active. For your security, ATCIS is signing you out. Sign in again using your new
              password.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border/70 bg-muted/35 px-4 py-3 text-center">
            <p className="font-medium text-foreground text-sm">
              Signing out in {secondsRemaining} second{secondsRemaining === 1 ? "" : "s"}…
            </p>
            <p className="mt-1 text-muted-foreground text-xs">
              You will be redirected to the login page automatically.
            </p>
          </div>

          <Button disabled className="w-full">
            <Loader2 className="size-4 animate-spin" />
            Signing out securely
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex flex-col items-center text-center gap-1.5 pt-2">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-4 ring-amber-500/10 mb-2">
            <KeyRound className="size-6" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">Set Your New Password</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground max-w-sm">
            You are logging in with a temporary password. Choose a permanent password, then sign in again securely.
          </DialogDescription>
        </DialogHeader>

        {currentUser?.email && (
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Account</span>
            <span className="font-medium text-foreground truncate max-w-[200px]">{currentUser.email}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-1">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-medium">
              <ShieldAlert className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="force-new-password" className="text-xs font-medium">
                New Password
              </Label>
              <div className="relative">
                <Input
                  id="force-new-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  autoFocus
                  className="pr-9 text-xs"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="force-confirm-password" className="text-xs font-medium">
                Confirm New Password
              </Label>
              <div className="relative">
                <Input
                  id="force-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  required
                  className="pr-9 text-xs"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-1 rounded-lg bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <CheckCircle2
                className={`size-3.5 ${hasMinLength ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50"}`}
              />
              <span className={hasMinLength ? "text-foreground font-medium" : ""}>Minimum 8 characters</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2
                className={`size-3.5 ${passwordsMatch ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/50"}`}
              />
              <span className={passwordsMatch ? "text-foreground font-medium" : ""}>Passwords must match</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="submit"
              disabled={loading || !hasMinLength || !passwordsMatch}
              className="w-full h-9 font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Updating Password…
                </>
              ) : (
                "Update Password & Sign Out"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <LogOut className="mr-1.5 size-3.5" />
              Sign out instead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
