import { createClient } from "@/lib/supabase/browser";

export type UserRole = "account_manager" | "technical_review" | "hod" | "committee" | "country_admin" | "super_admin";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  country: "ZW" | "ZM" | "ALL";
  department?: string;
  avatar?: string;
  must_change_password?: boolean;
}

export interface LoginResult {
  success: boolean;
  message?: string;
  user?: AuthUser;
  token?: string;
}

export class AuthService {
  public static isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  // Display cache only. Supabase verifies sessions and permissions on every request.
  public static getCurrentUser(): AuthUser | null {
    if (typeof window === "undefined") return null;
    try {
      return JSON.parse(localStorage.getItem("atcis_user") || "null");
    } catch {
      return null;
    }
  }

  public static isSuperAdmin(): boolean {
    const user = this.getCurrentUser();
    return user?.role === "super_admin";
  }

  public static getUserJurisdiction(): "ZW" | "ZM" | "ALL" {
    const user = this.getCurrentUser();
    if (!user) return "ALL";
    if (user.role === "super_admin") return "ALL";
    return user.country || "ZW";
  }

  public static async refreshUser(): Promise<AuthUser | null> {
    const client = createClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) {
      localStorage.removeItem("atcis_user");
      return null;
    }
    const { data, error } = await client
      .from("profiles")
      .select("id,name,email,role,country,department,must_change_password")
      .eq("id", user.id)
      .eq("active", true)
      .single();
    if (error || !data) {
      localStorage.removeItem("atcis_user");
      return null;
    }
    const profile = {
      ...data,
      must_change_password: Boolean(data.must_change_password ?? user.user_metadata?.must_change_password),
    } as AuthUser;
    localStorage.setItem("atcis_user", JSON.stringify(profile));
    localStorage.setItem("user_country_preference", profile.country);
    window.dispatchEvent(new CustomEvent("atcis-auth-changed", { detail: profile }));
    return profile;
  }

  public static async changePassword(newPassword: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, message: data.error || "Failed to update password" };
      }
      return { success: true };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : "Network error" };
    }
  }

  public static async login(email: string, password: string, remember = false): Promise<LoginResult> {
    document.cookie = `atcis_remember=${remember ? "1" : "0"}; path=/; SameSite=Lax${remember ? "; max-age=604800" : ""}`;
    const client = createClient();
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { success: false, message: error.message };
    const user = await this.refreshUser();
    if (!user) {
      await client.auth.signOut();
      return { success: false, message: "Your account needs an active ATCIS profile. Contact your administrator." };
    }
    // Remove legacy demo sessions. They never authorize Supabase requests.
    document.cookie = "atcis_auth_token=; path=/; max-age=0";
    document.cookie = "atcis_user_role=; path=/; max-age=0";
    localStorage.removeItem("auth_token");
    return { success: true, user };
  }

  public static async logout(): Promise<void> {
    try {
      await createClient().auth.signOut();
    } catch {
      // Always clear the local session and return to login, even if the remote
      // sign-out request is unavailable on the local network.
    }
    localStorage.removeItem("atcis_user");
    localStorage.removeItem("auth_token");
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("atcis_") || key.startsWith("tender_pipeline")) localStorage.removeItem(key);
    }
    document.cookie = "atcis_auth_token=; path=/; max-age=0";
    document.cookie = "atcis_user_role=; path=/; max-age=0";
    document.cookie = "atcis_remember=; path=/; max-age=0";
    window.location.href = "/auth/v2/login";
  }
}
