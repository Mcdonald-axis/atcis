import type { UserRole } from "@/services/auth-service";

export const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "account_manager", label: "Account Manager" },
  { value: "technical_review", label: "Technical Reviewer" },
  { value: "hod", label: "Head of Department" },
  { value: "committee", label: "Bid Committee" },
  { value: "country_admin", label: "Country Administrator" },
  { value: "super_admin", label: "Regional Super Administrator" },
];

export const roleLabel = (role: string) => ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  country: "ZW" | "ZM" | "ALL";
  department: string;
  active: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  assignments: number;
  overdueAssignments: number;
  averageProgress: number;
  pendingReviews: number;
  ownedPendingReviews: number;
  activePipelineItems: number;
  currentWork: Array<{ id: string; title: string; tenderRef: string; status: string; progress: number }>;
  mustChangePassword?: boolean;
}

export interface AuditEvent {
  id: number;
  action: string;
  actorName: string;
  targetName: string;
  createdAt: string;
  details: Record<string, unknown>;
}

export interface AdminOverview {
  currentUserId: string;
  totals: {
    users: number;
    activeUsers: number;
    openAssignments: number;
    overdueAssignments: number;
    pendingReviews: number;
    countries: number;
  };
  users: AdminUser[];
  activity: AuditEvent[];
}
