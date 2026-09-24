"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Check, ChevronRight, LogOut, Shield, UserCog } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { users as defaultUsers, type SystemUser } from "@/data/users";
import { cn, getInitials } from "@/lib/utils";
import { AuthService } from "@/services/auth-service";

export function AccountSwitcher({
  users = defaultUsers,
}: {
  readonly users?: readonly SystemUser[];
}) {
  const [activeUser, setActiveUser] = useState<SystemUser>(users[0]);

  useEffect(() => {
    const checkCurrentUser = () => {
      const stored = AuthService.getCurrentUser();
      if (stored) {
        const found = users.find((u) => u.email === stored.email);
        if (found) {
          setActiveUser(found);
          return;
        }
      }
      setActiveUser(users[0]);
    };

    checkCurrentUser();
    window.addEventListener("atcis-auth-changed", checkCurrentUser);
    return () => window.removeEventListener("atcis-auth-changed", checkCurrentUser);
  }, [users]);

  const handleSelectRole = (user: SystemUser) => {
    // Account changes require a real sign-in; browser storage cannot select a role.
    if (user.email === AuthService.getCurrentUser()?.email) setActiveUser(user);
  };

  const getRoleBadgeTone = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30";
      case "country_admin":
        return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "hod":
        return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "committee":
        return "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30";
      case "technical_review":
        return "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30";
      case "account_manager":
        return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      default:
        return "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30";
    }
  };

  if (!activeUser) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex items-center gap-2 cursor-pointer rounded-lg p-1 pr-2 transition-colors hover:bg-muted/50">
          <Avatar className="size-8 rounded-lg">
            <AvatarImage src={activeUser.avatar || undefined} alt={activeUser.name} />
            <AvatarFallback className="text-xs">{getInitials(activeUser.name)}</AvatarFallback>
          </Avatar>
          <div className="hidden flex-col text-left text-xs leading-tight sm:flex">
            <span className="font-semibold text-foreground truncate max-w-[120px]">{activeUser.name}</span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{activeUser.roleTitle}</span>
          </div>
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-72 space-y-1 rounded-xl p-1.5" side="bottom" align="end" sideOffset={6}>
        {/* Active Profile Header */}
        <div className="flex items-start gap-2.5 p-2 rounded-lg bg-muted/30">
          <Avatar className="size-10 rounded-lg shrink-0">
            <AvatarImage src={activeUser.avatar || undefined} alt={activeUser.name} />
            <AvatarFallback>{getInitials(activeUser.name)}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 text-left text-xs leading-tight space-y-0.5">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate font-bold text-foreground text-sm">{activeUser.name}</span>
              <span className="font-mono text-[9px] rounded bg-muted px-1 border border-border">
                {activeUser.country}
              </span>
            </div>
            <span className="truncate text-muted-foreground text-[11px]">{activeUser.email}</span>
            <div className="pt-0.5">
              <Badge className={`text-[9px] font-semibold border px-1.5 py-0 ${getRoleBadgeTone(activeUser.role)}`}>
                {activeUser.roleTitle}
              </Badge>
            </div>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Role Switching Section for Testing & Role Navigation */}
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-2 py-1">
          Switch Team Role Persona
        </DropdownMenuLabel>

        <DropdownMenuGroup className="space-y-0.5">
          {users.map((u) => {
            const isSelected = activeUser.id === u.id || activeUser.role === u.role;
            return (
              <DropdownMenuItem
                key={u.id}
                onClick={() => handleSelectRole(u)}
                className={cn(
                  "cursor-pointer flex items-center justify-between p-2 rounded-md text-xs",
                  isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/60"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="size-6 rounded">
                    <AvatarImage src={u.avatar} alt={u.name} />
                    <AvatarFallback className="text-[10px]">{getInitials(u.name)}</AvatarFallback>
                  </Avatar>
                  <div className="truncate">
                    <p className="font-semibold text-[11px] truncate text-foreground">{u.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{u.roleTitle}</p>
                  </div>
                </div>

                {isSelected && <Check className="size-4 text-primary shrink-0 ml-1" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => AuthService.logout()}
          className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 text-xs py-2"
        >
          <LogOut className="size-4 mr-2" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
