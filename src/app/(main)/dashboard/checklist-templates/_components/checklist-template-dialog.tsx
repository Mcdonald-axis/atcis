"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChecklistRequirement, CountryChecklistTemplate } from "@/components/tender/use-country-checklist";
import { STARTER_PRESET_REQUIREMENTS } from "./starter-templates";

interface ChecklistTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: CountryChecklistTemplate | null;
  mode?: "create" | "edit" | "clone";
  defaultCountry?: "ZW" | "ZM";
  onSaved: (template: CountryChecklistTemplate) => void;
}

const CATEGORY_SUGGESTIONS = [
  "Statutory & Legal",
  "Financial & Commercial",
  "Technical & Quality",
  "Administrative & Bidding",
  "Health, Safety & Environment",
];

export function ChecklistTemplateDialog({
  open,
  onOpenChange,
  template,
  mode = "create",
  defaultCountry = "ZW",
  onSaved,
}: ChecklistTemplateDialogProps) {
  const [name, setName] = useState("");
  const [country, setCountry] = useState<"ZW" | "ZM">("ZW");
  const [items, setItems] = useState<ChecklistRequirement[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!open) return;
    setValidationError("");

    if (template && mode === "edit") {
      setName(template.name);
      setCountry(template.country);
      setItems(template.items.map((it) => ({ ...it })));
    } else if (template && mode === "clone") {
      setName(`${template.name} (Copy)`);
      setCountry(template.country);
      setItems(
        template.items.map((it) => ({
          ...it,
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        }))
      );
    } else {
      // New template
      setName("");
      setCountry(defaultCountry);
      // Initialize with standard statutory preset for convenience
      const defaultPresets = STARTER_PRESET_REQUIREMENTS[defaultCountry].slice(0, 5).map((it) => ({
        ...it,
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      }));
      setItems(defaultPresets);
    }
  }, [open, template, mode, defaultCountry]);

  const handleCountryChange = (newCountry: "ZW" | "ZM") => {
    setCountry(newCountry);
    if (mode === "create" && items.length <= 5) {
      const presets = STARTER_PRESET_REQUIREMENTS[newCountry].slice(0, 5).map((it) => ({
        ...it,
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      }));
      setItems(presets);
    }
  };

  const handleAddItem = () => {
    const newItem: ChecklistRequirement = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      item: "",
      category: "Statutory & Legal",
      status: "Mandatory",
      description: "",
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleUpdateItem = (id: string, patch: Partial<ChecklistRequirement>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      toast.warning("A checklist template must have at least one requirement.");
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleLoadFullPresets = () => {
    const presets = STARTER_PRESET_REQUIREMENTS[country].map((it) => ({
      ...it,
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    }));
    setItems(presets);
    toast.success(`Loaded ${presets.length} standard ${country === "ZW" ? "Zimbabwe PRAZ" : "Zambia ZPPA"} requirements.`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (!name.trim()) {
      setValidationError("Please enter a template name.");
      return;
    }

    if (!items.length) {
      setValidationError("Please include at least one checklist requirement.");
      return;
    }

    const emptyTitleIndex = items.findIndex((it) => !it.item.trim());
    if (emptyTitleIndex !== -1) {
      setValidationError(`Requirement #${emptyTitleIndex + 1} has no document name.`);
      return;
    }

    setIsSaving(true);
    try {
      const isUpdating = mode === "edit" && template?.id;
      const endpoint = "/api/admin/checklist-templates";
      const method = isUpdating ? "PUT" : "POST";
      const payload = {
        id: isUpdating ? template.id : undefined,
        name: name.trim(),
        country,
        items: items.map((it) => ({
          id: it.id,
          item: it.item.trim(),
          category: it.category.trim() || "General",
          status: it.status,
          description: it.description.trim(),
        })),
      };

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save checklist template");
      }

      toast.success(
        isUpdating
          ? `Checklist Template "${name}" updated successfully`
          : `Checklist Template "${name}" created for ${country === "ZW" ? "Zimbabwe" : "Zambia"}`
      );
      onSaved(data.template);
      onOpenChange(false);
    } catch (err: any) {
      setValidationError(err.message || "An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const mandatoryCount = items.filter((i) => i.status === "Mandatory").length;
  const conditionalCount = items.filter((i) => i.status === "Conditional").length;
  const standardCount = items.filter((i) => i.status === "Standard").length;
  const optionalCount = items.filter((i) => i.status === "Optional").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {mode === "edit"
              ? "Edit Checklist Template"
              : mode === "clone"
              ? "Clone Checklist Template"
              : "Create New Checklist Template"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Standardize the compliance documents and bid attachments required for tenders in this jurisdiction.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {validationError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Top Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="templateNameInput" className="text-xs font-semibold">
                Template Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="templateNameInput"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. PRAZ Standard Goods & Equipment Tender"
                required
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="countrySelect" className="text-xs font-semibold">
                Country Authority <span className="text-destructive">*</span>
              </Label>
              <Select
                value={country}
                onValueChange={(val: "ZW" | "ZM") => handleCountryChange(val)}
                disabled={mode === "edit"}
              >
                <SelectTrigger id="countrySelect" className="h-9 text-sm">
                  <SelectValue placeholder="Select Country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ZW">Zimbabwe (PRAZ e-GP)</SelectItem>
                  <SelectItem value="ZM">Zambia (ZPPA e-GP)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Requirements Header & Quick Actions */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-2">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-foreground">
                  Checklist Requirements ({items.length})
                </h3>
                <div className="flex items-center gap-1.5 text-[10px]">
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
              </div>

              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleLoadFullPresets}
                className="h-7 text-xs gap-1 text-primary hover:text-primary font-medium"
              >
                <Sparkles className="size-3" />
                Load Full {country === "ZW" ? "PRAZ" : "ZPPA"} Presets
              </Button>
            </div>

            {/* List of Requirement Items */}
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-3 transition-colors hover:border-border"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                      <span className="flex size-5 items-center justify-center rounded-full bg-background border text-[11px] font-bold text-foreground">
                        {index + 1}
                      </span>
                      Document Requirement
                    </span>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(item.id)}
                      className="size-6 text-muted-foreground hover:text-destructive cursor-pointer"
                      title="Remove Requirement"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    {/* Document Title */}
                    <div className="md:col-span-6 space-y-1">
                      <Label className="text-[11px] text-muted-foreground font-semibold">
                        Document Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={item.item}
                        onChange={(e) => handleUpdateItem(item.id, { item: e.target.value })}
                        placeholder="e.g. Valid Tax Clearance Certificate"
                        className="h-8 text-xs"
                        required
                      />
                    </div>

                    {/* Category */}
                    <div className="md:col-span-3 space-y-1">
                      <Label className="text-[11px] text-muted-foreground font-semibold">Category</Label>
                      <Input
                        value={item.category}
                        onChange={(e) => handleUpdateItem(item.id, { category: e.target.value })}
                        placeholder="e.g. Statutory & Legal"
                        list={`cat-list-${item.id}`}
                        className="h-8 text-xs"
                      />
                      <datalist id={`cat-list-${item.id}`}>
                        {CATEGORY_SUGGESTIONS.map((cat) => (
                          <option key={cat} value={cat} />
                        ))}
                      </datalist>
                    </div>

                    {/* Status Level */}
                    <div className="md:col-span-3 space-y-1">
                      <Label className="text-[11px] text-muted-foreground font-semibold">Requirement Level</Label>
                      <Select
                        value={item.status}
                        onValueChange={(val: any) => handleUpdateItem(item.id, { status: val })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mandatory">
                            <span className="text-destructive font-medium">Mandatory</span>
                          </SelectItem>
                          <SelectItem value="Conditional">
                            <span className="text-amber-600 dark:text-amber-400 font-medium">Conditional</span>
                          </SelectItem>
                          <SelectItem value="Standard">
                            <span className="text-blue-600 dark:text-blue-400 font-medium">Standard</span>
                          </SelectItem>
                          <SelectItem value="Optional">
                            <span className="text-muted-foreground">Optional</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Description / Instructions */}
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground font-semibold">
                      Bidder Instructions / Notes (Optional)
                    </Label>
                    <Input
                      value={item.description}
                      onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                      placeholder="e.g. Must be valid for current year, certified copy stamped by commissioner of oaths"
                      className="h-7 text-xs text-muted-foreground font-sans"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Add Requirement Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              className="w-full h-9 text-xs border-dashed gap-1.5 font-semibold text-foreground hover:bg-muted/40 cursor-pointer"
            >
              <Plus className="size-3.5" />
              Add Another Document Requirement
            </Button>
          </div>

          <DialogFooter className="gap-2 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSaving} className="gap-1.5">
              {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              {mode === "edit" ? "Update Template" : "Save Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
