"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthService } from "@/services/auth-service";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRedirect = searchParams.get("redirect") || "";
  const redirectUrl = /^\/dashboard(?:[/?#]|$)/.test(requestedRedirect) && !requestedRedirect.includes("\\") ? requestedRedirect : "/dashboard/default";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please enter both email and password.");
      return;
    }

    setLoading(true);

    try {
      const result = await AuthService.login(email, password, remember);

      if (!result.success) {
        setErrorMsg(result.message || "Invalid authentication credentials.");
        setLoading(false);
        return;
      }

      // Save user country preference based on user profile
      if (typeof window !== "undefined") {
        const country = result.user?.country || (email.toLowerCase().includes(".zm") ? "ZM" : "ZW");
        localStorage.setItem("user_country_preference", country);
      }

      toast.success("Authentication Successful", {
        description: "Welcome back to ATCIS.",
      });

      // Redirect to target destination
      router.push(redirectUrl);
      router.refresh();
    } catch {
      setErrorMsg("Failed to authenticate. Please check your connection.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="flex flex-col gap-4">
      {errorMsg && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-medium">
          {errorMsg}
        </div>
      )}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="login-email" className="text-xs font-medium">
            Email Address
          </Label>
          <Input
            id="login-email"
            type="email"
            placeholder=""
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-9 text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password" className="text-xs font-medium">
              Password
            </Label>
          </div>
          <Input
            id="login-password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-9 text-xs"
          />
        </div>

        <div className="flex items-center space-x-2 pt-0.5">
          <Checkbox
            id="remember"
            checked={remember}
            onCheckedChange={(checked) => setRemember(Boolean(checked))}
          />
          <label
            htmlFor="remember"
            className="text-xs text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Keep me signed in for 7 days
          </label>
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full gap-2 text-xs font-semibold h-9 mt-1">
        {loading ? (
          <>
            <Loader2 className="size-3.5 animate-spin" /> Authenticating...
          </>
        ) : (
          <>
            <span>Access ATCIS Dashboard</span>
            <ArrowRight className="size-3.5" />
          </>
        )}
      </Button>
    </form>
  );
}
