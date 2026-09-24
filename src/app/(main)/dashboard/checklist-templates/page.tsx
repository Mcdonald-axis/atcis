"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  ListChecks,
  Loader2,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CountryChecklistTemplate } from "@/components/tender/use-country-checklist";
import { ChecklistTemplateDialog } from "./_components/checklist-template-dialog";
import { TemplateCard } from "./_components/template-card";
import { DEFAULT_STARTER_TEMPLATES } from "./_components/starter-templates";

export default function ChecklistTemplatesPage() {
  const [templates, setTemplates] = useState<CountryChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountryTab, setSelectedCountryTab] = useState<"ALL" | "ZW" | "ZM">("ALL");

  // Dialog management
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "clone">("create");
  const [selectedTemplate, setSelectedTemplate] = useState<CountryChecklistTemplate | null>(null);
  const [isSeedingStarter, setIsSeedingStarter] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/checklist-templates");
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load templates");
      }
      setTemplates(data.templates || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load checklist templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleCreateNew = () => {
    setSelectedTemplate(null);
    setDialogMode("create");
    setIsDialogOpen(true);
  };

  const handleEdit = (tpl: CountryChecklistTemplate) => {
    setSelectedTemplate(tpl);
    setDialogMode("edit");
    setIsDialogOpen(true);
  };

  const handleClone = (tpl: CountryChecklistTemplate) => {
    setSelectedTemplate(tpl);
    setDialogMode("clone");
    setIsDialogOpen(true);
  };

  const handleTemplateDeleted = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const handleTemplateSaved = (saved: CountryChecklistTemplate) => {
    setTemplates((prev) => {
      const exists = prev.some((t) => t.id === saved.id);
      if (exists) {
        return prev.map((t) => (t.id === saved.id ? saved : t));
      }
      return [saved, ...prev];
    });
  };

  // Seed default starter templates for Zimbabwe and Zambia
  const handleSeedStarterKit = async () => {
    setIsSeedingStarter(true);
    let createdCount = 0;
    try {
      for (const starter of DEFAULT_STARTER_TEMPLATES) {
        const res = await fetch("/api/admin/checklist-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: starter.name,
            country: starter.country,
            items: starter.items,
          }),
        });
        if (res.ok) {
          createdCount++;
        }
      }

      toast.success(`Procurement Starter Kit Loaded`, {
        description: `Created ${createdCount} standard PRAZ & ZPPA checklist templates.`,
      });
      await fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || "Failed to load starter kit");
    } finally {
      setIsSeedingStarter(false);
    }
  };

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return templates.filter((tpl) => {
      const matchesCountry =
        selectedCountryTab === "ALL" || tpl.country === selectedCountryTab;
      if (!matchesCountry) return false;

      if (!q) return true;

      const inName = tpl.name.toLowerCase().includes(q);
      const inItems = tpl.items?.some(
        (it) =>
          it.item.toLowerCase().includes(q) ||
          it.category?.toLowerCase().includes(q) ||
          it.description?.toLowerCase().includes(q)
      );

      return inName || inItems;
    });
  }, [templates, selectedCountryTab, searchQuery]);

  const zwCount = templates.filter((t) => t.country === "ZW").length;
  const zmCount = templates.filter((t) => t.country === "ZM").length;
  const totalRequirements = templates.reduce((acc, t) => acc + (t.items?.length || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-1">
            <span>Administration</span>
            <span>/</span>
            <span className="text-foreground font-semibold">Checklist Templates</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <ListChecks className="size-6 text-primary" />
            Checklist Templates
          </h1>
          <p className="text-sm text-muted-foreground">
            Create and maintain standardized compliance document checklists used by Account Managers on Zimbabwe and Zambia tenders.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button onClick={handleCreateNew} size="sm" className="gap-1.5 font-semibold cursor-pointer">
            <Plus className="size-4" /> Create Template
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/70 p-3.5">
          <CardContent className="p-0 space-y-1">
            <span className="text-xs text-muted-foreground font-medium">Total Templates</span>
            <p className="text-2xl font-bold text-foreground">{templates.length}</p>
            <span className="text-[10px] text-muted-foreground">Standardized tender dossiers</span>
          </CardContent>
        </Card>

        <Card className="border-border/70 p-3.5">
          <CardContent className="p-0 space-y-1">
            <span className="text-xs text-muted-foreground font-medium">Zimbabwe (PRAZ)</span>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{zwCount}</p>
            <span className="text-[10px] text-muted-foreground">PRAZ statutory &amp; technical</span>
          </CardContent>
        </Card>

        <Card className="border-border/70 p-3.5">
          <CardContent className="p-0 space-y-1">
            <span className="text-xs text-muted-foreground font-medium">Zambia (ZPPA)</span>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{zmCount}</p>
            <span className="text-[10px] text-muted-foreground">ZPPA e-GP requirements</span>
          </CardContent>
        </Card>

        <Card className="border-border/70 p-3.5">
          <CardContent className="p-0 space-y-1">
            <span className="text-xs text-muted-foreground font-medium">Defined Requirements</span>
            <p className="text-2xl font-bold text-primary">{totalRequirements}</p>
            <span className="text-[10px] text-muted-foreground">Across all tender templates</span>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar: Country Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        <Tabs
          value={selectedCountryTab}
          onValueChange={(val: any) => setSelectedCountryTab(val)}
          className="w-full sm:w-auto"
        >
          <TabsList className="h-9">
            <TabsTrigger value="ALL" className="text-xs">
              All ({templates.length})
            </TabsTrigger>
            <TabsTrigger value="ZW" className="text-xs">
              Zimbabwe ({zwCount})
            </TabsTrigger>
            <TabsTrigger value="ZM" className="text-xs">
              Zambia ({zmCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 flex-1 sm:max-w-xs">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates or documents..."
              className="pl-8 h-9 text-xs"
            />
          </div>

          {templates.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedStarterKit}
              disabled={isSeedingStarter}
              className="h-9 text-xs gap-1.5 shrink-0"
            >
              {isSeedingStarter ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              Starter Kit
            </Button>
          )}
        </div>
      </div>

      {/* Templates List / Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-2">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="text-xs font-medium">Loading checklist templates...</span>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center space-y-4 bg-muted/10">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <ListChecks className="size-6 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-base text-foreground">No Checklist Templates Found</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {searchQuery
                ? `No templates matching "${searchQuery}". Try clearing your search.`
                : "Standardize your procurement compliance by creating your first template or loading pre-built African procurement standard templates."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button size="sm" onClick={handleCreateNew} className="gap-1.5">
              <Plus className="size-3.5" /> Create Template
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSeedStarterKit}
              disabled={isSeedingStarter}
              className="gap-1.5"
            >
              {isSeedingStarter ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              Load Pre-built Procurement Kit
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={handleEdit}
              onClone={handleClone}
              onDeleted={handleTemplateDeleted}
            />
          ))}
        </div>
      )}

      {/* Create / Edit / Clone Dialog */}
      <ChecklistTemplateDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        template={selectedTemplate}
        mode={dialogMode}
        defaultCountry={selectedCountryTab === "ZM" ? "ZM" : "ZW"}
        onSaved={handleTemplateSaved}
      />
    </div>
  );
}
