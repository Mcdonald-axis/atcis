"use client";

import { Building, Globe, Lock, ShieldCheck } from "lucide-react";

import { type CountryScope } from "./tender-data";

interface MarketRegionSwitcherProps {
  activeScope: CountryScope;
  onScopeChange: (scope: CountryScope) => void;
  userJurisdiction?: CountryScope;
}

export function MarketRegionSwitcher({
  activeScope,
  onScopeChange,
  userJurisdiction = "ALL",
}: MarketRegionSwitcherProps) {
  const isLockedToCountry = userJurisdiction !== "ALL";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-background/80 p-1 shadow-xs backdrop-blur-xs">
        <button
          type="button"
          onClick={() => !isLockedToCountry && onScopeChange("ZW")}
          disabled={isLockedToCountry && userJurisdiction !== "ZW"}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-xs transition-all ${
            activeScope === "ZW"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          } ${isLockedToCountry && userJurisdiction !== "ZW" ? "cursor-not-allowed opacity-40" : ""}`}
        >
          <span className="font-mono font-semibold text-[10px]">ZW</span>
          <span>Zimbabwe</span>
        </button>

        <button
          type="button"
          onClick={() => !isLockedToCountry && onScopeChange("ZM")}
          disabled={isLockedToCountry && userJurisdiction !== "ZM"}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-xs transition-all ${
            activeScope === "ZM"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          } ${isLockedToCountry && userJurisdiction !== "ZM" ? "cursor-not-allowed opacity-40" : ""}`}
        >
          <span className="font-mono font-semibold text-[10px]">ZM</span>
          <span>Zambia</span>
        </button>

        {!isLockedToCountry && (
          <button
            type="button"
            onClick={() => onScopeChange("ALL")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-xs transition-all ${
              activeScope === "ALL"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            <Globe className="size-3" />
            <span>Regional (All)</span>
          </button>
        )}
      </div>

      <div className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex">
        {isLockedToCountry ? (
          <span className="flex items-center gap-1 rounded bg-muted/60 px-2 py-1 font-mono text-[10px] text-muted-foreground">
            <Lock className="size-3" /> Scope Restricted to {userJurisdiction}
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-1 font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="size-3" /> Admin Jurisdiction: Cross-Border
          </span>
        )}
      </div>
    </div>
  );
}
