"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Edit2,
  FileCheck2,
  ListChecks,
  Loader2,
  MoreVertical,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CountryChecklistTemplate } from "@/components/tender/use-country-checklist";

interface TemplateCardProps {
  template: CountryChecklistTemplate;
  onEdit: (template: CountryChecklistTemplate) => void;
  onClone: (template: CountryChecklistTemplate) => void;
  onDeleted: (id: string) => void;
}

export function TemplateCard({ template, onEdit, onClone, onDeleted }: TemplateCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const items = template.items || [];
  const mandatoryCount = items.filter((i) => i.status === "Mandatory").length;
  const conditionalCount = items.filter((i) => i.status === "Conditional").length;
  const standardCount = items.filter((i) => i.status === "Standard").length;
  const optionalCount = items.filter((i) => i.status === "Optional").length;

  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean)));

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete the template "${template.name}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/checklist-templates?id=${encodeURIComponent(template.id)}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete template");
      }

      toast.success(data.message || `Template "${template.name}" deleted.`);
      onDeleted(template.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete template");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="border-border/80 shadow-xs hover:border-border transition-all flex flex-col justify-between">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-[10px] font-mono font-medium ${
                  template.country === "ZW"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                }`}
              >
                {template.country === "ZW" ? "Zimbabwe (PRAZ)" : "Zambia (ZPPA)"}
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                {items.length} requirement{items.length === 1 ? "" : "s"}
              </span>
            </div>
            <CardTitle className="text-base font-bold text-foreground leading-snug">
              {template.name}
            </CardTitle>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 text-xs">
              <DropdownMenuItem onClick={() => onEdit(template)} className="gap-2 cursor-pointer">
                <Edit2 className="size-3.5" /> Edit Template
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onClone(template)} className="gap-2 cursor-pointer">
                <Copy className="size-3.5" /> Clone Template
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                disabled={isDeleting}
                className="gap-2 text-destructive focus:text-destructive cursor-pointer"
              >
                {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                Delete Template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Breakdown pill badges */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2">
          {mandatoryCount > 0 && (
            <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-[9px] px-1.5">
              {mandatoryCount} Mandatory
            </Badge>
          )}
          {conditionalCount > 0 && (
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[9px] px-1.5">
              {conditionalCount} Conditional
            </Badge>
          )}
          {standardCount > 0 && (
            <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[9px] px-1.5">
              {standardCount} Standard
            </Badge>
          )}
          {optionalCount > 0 && (
            <Badge variant="outline" className="border-border text-muted-foreground text-[9px] px-1.5">
              {optionalCount} Optional
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          {/* Categories tag line */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {categories.map((cat) => (
                <span
                  key={cat}
                  className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-medium"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}

          {/* Top 3 or all items preview */}
          <div className="space-y-1.5 pt-1">
            {(expanded ? items : items.slice(0, 3)).map((item, idx) => (
              <div
                key={item.id || idx}
                className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1.5 text-xs"
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-background border text-[9px] font-bold text-muted-foreground shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-medium text-foreground truncate text-xs">{item.item}</span>
                    <span
                      className={`text-[9px] font-mono px-1 rounded shrink-0 ${
                        item.status === "Mandatory"
                          ? "text-destructive"
                          : item.status === "Conditional"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{item.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {items.length > 3 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setExpanded(!expanded)}
              className="h-6 w-full text-[10px] text-muted-foreground hover:text-foreground gap-1"
            >
              {expanded ? (
                <>
                  <ChevronUp className="size-3" /> Show fewer requirements
                </>
              ) : (
                <>
                  <ChevronDown className="size-3" /> View all {items.length} requirements
                </>
              )}
            </Button>
          )}
        </div>

        {/* Footer actions */}
        <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-2">
          <Button
            size="xs"
            variant="outline"
            onClick={() => onClone(template)}
            className="h-7 text-xs gap-1"
          >
            <Copy className="size-3" /> Clone
          </Button>

          <Button
            size="xs"
            onClick={() => onEdit(template)}
            className="h-7 text-xs gap-1"
          >
            <Edit2 className="size-3" /> Edit Requirements
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
