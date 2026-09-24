import type { UserRole } from "@/services/auth-service";

export interface SystemUser {
  id: string;
  name: string;
  username: string;
  email: string;
  avatar: string;
  role: UserRole;
  roleTitle: string;
  country: "ZW" | "ZM" | "ALL";
  department: string;
  reportsToHod?: string; // HOD ID this AM reports to
  must_change_password?: boolean;
}

export const rootUser: SystemUser = {
  id: "", name: "ATCIS", username: "", email: "", avatar: "", role: "account_manager",
  roleTitle: "", country: "ALL", department: "",
};

// Populated from the authenticated Supabase directory by AuthSession.
export const users: SystemUser[] = [];

/**
 * Returns all team members whose pipelines an oversight user (Country Admin, Super Admin, HOD) can view.
 * For Country Admins, this includes EVERYONE in their assigned country (both HODs and AMs).
 */
export function getPipelineMembersForUser(
  user?: { role?: string; id?: string; email?: string; country?: string } | null
): SystemUser[] {
  if (!user) return [];

  const eligibleRoles: UserRole[] = ["account_manager", "hod", "country_admin"];
  const pipelineUsers = users.filter((u) => eligibleRoles.includes(u.role));

  // Country Admin can see everyone in their country including HODs, AMs, and local admins
  if (user.role === "country_admin") {
    return pipelineUsers
      .filter((u) => user.country === "ALL" || u.country === user.country)
      .sort((a, b) => {
        // Put HODs first, then AMs, then by name
        const roleOrder: Record<string, number> = { hod: 1, account_manager: 2, country_admin: 3 };
        const rankDiff = (roleOrder[a.role] || 9) - (roleOrder[b.role] || 9);
        if (rankDiff !== 0) return rankDiff;
        return a.name.localeCompare(b.name);
      });
  }

  // Super Admin can see everyone across all countries
  if (user.role === "super_admin") {
    return pipelineUsers.sort((a, b) => {
      if (a.country !== b.country) return a.country.localeCompare(b.country);
      const roleOrder: Record<string, number> = { hod: 1, account_manager: 2, country_admin: 3 };
      const rankDiff = (roleOrder[a.role] || 9) - (roleOrder[b.role] || 9);
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name);
    });
  }

  // HOD sees themselves and AMs in their department / country / under their reporting line
  if (user.role === "hod") {
    return pipelineUsers
      .filter((u) => {
        if (u.id === user.id || u.email === user.email) return true;
        if (u.role !== "account_manager") return false;
        return (
          u.reportsToHod === user.id ||
          u.country === user.country ||
          user.country === "ALL"
        );
      })
      .sort((a, b) => {
        if (a.id === user.id) return -1;
        if (b.id === user.id) return 1;
        return a.name.localeCompare(b.name);
      });
  }

  // Account Managers see their own pipeline
  return pipelineUsers.filter((u) => u.email === user.email || u.id === user.id);
}

// Backwards-compatible alias for existing imports
export const getAmsForUser = getPipelineMembersForUser;
