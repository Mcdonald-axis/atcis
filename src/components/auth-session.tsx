"use client";

import { useEffect } from "react";

import { type SystemUser, users } from "@/data/users";
import type { AuthUser } from "@/services/auth-service";

export function AuthSession({ user, directory }: { user: AuthUser; directory: SystemUser[] }) {
  useEffect(() => {
    users.splice(0, users.length, ...directory);
    localStorage.setItem("atcis_user", JSON.stringify(user));
    // Clear obsolete global caches that were shared between demo accounts.
    localStorage.removeItem("kanban_board_state");
    localStorage.removeItem("atcis_tender_assignments");
    localStorage.removeItem("auth_token");
    window.dispatchEvent(new CustomEvent("atcis-auth-changed", { detail: user }));
  }, [user, directory]);
  return null;
}
