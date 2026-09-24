import {
  BellRing,
  BrainCircuit,
  CalendarDays,
  Clock,
  FileSpreadsheet,
  Files,
  FileText,
  Globe,
  Handshake,
  Kanban,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  Settings,
  ShieldCheck,
  Store,
  Trophy,
  UserCheck,
  UserCog,
} from "lucide-react";

import type { UserRole } from "@/services/auth-service";

export type NavBadge = "new" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
  allowedRoles?: UserRole[];
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
  allowedRoles?: UserRole[];
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Dashboard",
    items: [
      {
        id: "tender-dashboard",
        title: "Tender Dashboard",
        url: "/dashboard/default",
        icon: LayoutDashboard,
        allowedRoles: ["super_admin", "country_admin", "hod", "committee", "technical_review", "account_manager"],
      },
      {
        id: "tender-pipeline",
        title: "Tender Pipeline",
        url: "/dashboard/tender-pipeline",
        icon: Kanban,
        allowedRoles: ["super_admin", "country_admin", "hod", "committee", "account_manager"],
      },
    ],
  },
  {
    id: 2,
    label: "AI Intelligence",
    items: [
      {
        id: "atcis-ai",
        title: "Atcis AI",
        url: "/dashboard/atcis-ai",
        icon: BrainCircuit,
        badge: "new",
        allowedRoles: ["super_admin", "country_admin", "hod", "committee", "technical_review", "account_manager"],
      },
    ],
  },
  {
    id: 3,
    label: "Tender Log",
    items: [
      {
        id: "all-tenders",
        title: "All Tenders",
        url: "/dashboard/tenders",
        icon: FileText,
        allowedRoles: ["super_admin", "country_admin", "hod", "technical_review", "account_manager"],
      },
      {
        id: "procurement-plans",
        title: "Procurement Plans",
        url: "/dashboard/procurement-plans",
        icon: FileSpreadsheet,
        allowedRoles: ["super_admin", "country_admin", "hod", "account_manager"],
      },
      {
        id: "upcoming-deadlines",
        title: "Upcoming Deadlines",
        url: "/dashboard/upcoming-deadlines",
        icon: Clock,
        allowedRoles: ["super_admin", "country_admin", "hod", "technical_review", "account_manager"],
      },
      {
        id: "notifications",
        title: "Notifications",
        url: "/dashboard/notifications",
        icon: BellRing,
        allowedRoles: ["super_admin", "country_admin", "hod", "committee", "technical_review", "account_manager"],
      },
      {
        id: "external-sources",
        title: "External Sources",
        url: "/dashboard/external-sources",
        icon: Globe,
        allowedRoles: ["super_admin", "country_admin"],
      },
    ],
  },
  {
    id: 4,
    label: "Compliance & Governance",
    items: [
      {
        id: "review-approval",
        title: "Review & Approval",
        url: "/dashboard/reviews",
        icon: ShieldCheck,
        allowedRoles: ["super_admin", "country_admin", "hod", "committee", "technical_review", "account_manager"],
      },
    ],
  },
  {
    id: 5,
    label: "Coordination",
    items: [
      {
        id: "partner-directory",
        title: "Partner Directory",
        url: "/dashboard/partners",
        icon: Handshake,
        allowedRoles: ["super_admin", "country_admin", "hod", "account_manager"],
      },
      {
        id: "supplier-intelligence",
        title: "Suppliers",
        url: "/dashboard/suppliers",
        icon: Store,
        badge: "new",
        allowedRoles: ["super_admin", "country_admin", "hod", "committee", "technical_review", "account_manager"],
      },
      {
        id: "my-assignments",
        title: "Assignments",
        url: "/dashboard/team",
        icon: UserCheck,
        allowedRoles: ["super_admin", "country_admin", "hod", "technical_review", "account_manager"],
      },
    ],
  },
  {
    id: 6,
    label: "Knowledge Base",
    items: [
      {
        id: "results-tracker",
        title: "Win/Loss Debriefs",
        url: "/dashboard/lessons",
        icon: Trophy,
        allowedRoles: ["super_admin", "country_admin", "hod", "committee", "account_manager"],
      },
      {
        id: "documents",
        title: "Documents & Specs",
        url: "/dashboard/templates",
        icon: Files,
        allowedRoles: ["super_admin", "country_admin", "hod", "technical_review", "account_manager"],
      },
      {
        id: "renewal-calendar",
        title: "Renewal Calendar",
        url: "/dashboard/renewals",
        icon: CalendarDays,
        allowedRoles: ["super_admin", "country_admin"],
      },
    ],
  },
  {
    id: 7,
    label: "Administration",
    items: [
      {
        id: "user-administration",
        title: "People & Access",
        url: "/dashboard/users",
        icon: UserCog,
        allowedRoles: ["super_admin"],
      },
      {
        id: "checklist-templates",
        title: "Checklist Templates",
        url: "/dashboard/checklist-templates",
        icon: ListChecks,
        allowedRoles: ["super_admin", "country_admin"],
      },
      {
        id: "settings",
        title: "Settings",
        icon: Settings,
        allowedRoles: ["super_admin"],
        subItems: [
          {
            id: "settings-connections",
            title: "Connections",
            url: "/dashboard/settings/connections",
            allowedRoles: ["super_admin"],
          },
        ],
      },
    ],
  },
];
