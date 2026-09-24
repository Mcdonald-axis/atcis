"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CircleUser, EllipsisVertical, LogOut, MessageSquareDot } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { getInitials } from "@/lib/utils";

import { AuthService } from "@/services/auth-service";

export function NavUser({
  user: initialUser,
}: {
  readonly user: {
    readonly name: string;
    readonly email: string;
    readonly avatar: string;
  };
}) {
  const { isMobile } = useSidebar();
  const [activeUser, setActiveUser] = useState(initialUser);
  const [activeRole, setActiveRole] = useState("Administrator");

  useEffect(() => {
    const syncUser = () => {
      const stored = AuthService.getCurrentUser();
      if (stored) {
        setActiveUser({
          name: stored.name,
          email: stored.email,
          avatar: stored.avatar || initialUser.avatar,
        });
        const roleLabels: Record<string, string> = {
          super_admin: "Super Admin",
          country_admin: "Country Admin",
          hod: "Head of Dept (HOD)",
          committee: "Bid Committee",
          technical_review: "Technical Reviewer",
          account_manager: "Account Manager (AM)",
        };
        setActiveRole(roleLabels[stored.role] || stored.role);
      }
    };
    syncUser();
    window.addEventListener("atcis-auth-changed", syncUser);
    return () => window.removeEventListener("atcis-auth-changed", syncUser);
  }, [initialUser]);

  const handleLogout = () => {
    AuthService.logout();
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={activeUser.avatar || undefined} alt={activeUser.name} />
                <AvatarFallback className="rounded-lg">{getInitials(activeUser.name)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold text-xs">{activeUser.name}</span>
                <span className="truncate text-[10px] text-primary font-medium">{activeRole}</span>
              </div>
              <EllipsisVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={activeUser.avatar || undefined} alt={activeUser.name} />
                  <AvatarFallback className="rounded-lg">{getInitials(activeUser.name)}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{activeUser.name}</span>
                  <span className="truncate text-primary text-xs font-medium">{activeRole}</span>
                  <span className="truncate text-muted-foreground text-[10px]">{activeUser.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className="cursor-pointer">
                <CircleUser />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/dashboard/notifications">
                  <MessageSquareDot />
                  Notifications
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
