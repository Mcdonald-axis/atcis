"use client";

import { useEffect, useState } from "react";

import { Ban, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatCurrency } from "@/lib/utils";

import { columns } from "./data";
import type { ColumnId, Task } from "./types";

interface TenderPipelineEditDialogProps {
  task: Task | null;
  columnId?: ColumnId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedTask: Task, targetStage?: ColumnId) => void | Promise<void>;
}

export function TenderPipelineEditDialog({
  task,
  columnId,
  open,
  onOpenChange,
  onSave,
}: TenderPipelineEditDialogProps) {
  const [formData, setFormData] = useState<Partial<Task>>({});
  const [pipelineValueInput, setPipelineValueInput] = useState("");
  const [selectedStage, setSelectedStage] = useState<ColumnId>(columnId || "new");
  const [activeTab, setActiveTab] = useState("financials");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setFormData({
        ...task,
        pipelineValue: task.pipelineValue ?? 0,
        amountAwarded: task.amountAwarded ?? 0,
        actualCost: task.actualCost ?? 0,
        progress: task.progress ?? 0,
        satisfactionScore: task.satisfactionScore ?? 90,
      });
      setPipelineValueInput(task.pipelineValue === undefined ? "" : String(task.pipelineValue));
      setSelectedStage(columnId || "new");
    }
  }, [task, columnId, open]);

  if (!task) return null;

  const pipelineValue = pipelineValueInput.trim() === "" ? 0 : Number(pipelineValueInput);
  const amountAwarded = Number(formData.amountAwarded || 0);
  const actualCost = Number(formData.actualCost || 0);

  // Profit calculations
  const grossProfit = amountAwarded > 0 && actualCost > 0 ? amountAwarded - actualCost : 0;
  const marginPct = amountAwarded > 0 && actualCost > 0 ? Math.round((grossProfit / amountAwarded) * 100) : 0;

  const handleSave = async () => {
    const nextPipelineValue = pipelineValueInput.trim() === "" ? 0 : Number(pipelineValueInput);
    if (!Number.isFinite(nextPipelineValue) || nextPipelineValue < 0) {
      toast.error("Enter a valid tender pipeline value");
      return;
    }
    const updated: Task = {
      ...task,
      ...formData,
      pipelineValue: nextPipelineValue,
      amountAwarded: Number(formData.amountAwarded) || undefined,
      actualCost: Number(formData.actualCost) || undefined,
      grossMargin: grossProfit || undefined,
      progress: Number(formData.progress) ?? task.progress,
      satisfactionScore: Number(formData.satisfactionScore) || undefined,
    };

    setSaving(true);
    try {
      await onSave(updated, selectedStage);
      toast.success("Tender value saved", {
        description:
          nextPipelineValue === 0
            ? "The tender was removed from the monetary pipeline total."
            : `${formatCurrency(nextPipelineValue, { noDecimals: true })} will now be used in the active pipeline total.`,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The tender value could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0 gap-0 border-border/80 shadow-2xl">
        {/* Header */}
        <div className="border-b border-border/60 bg-muted/30 p-5 pr-10 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {task.countryCode && (
                <span className="rounded border border-border bg-background px-2 py-0.5 font-mono text-xs font-bold text-foreground">
                  {task.countryCode}
                </span>
              )}
              <span className="font-mono text-xs font-semibold text-muted-foreground">{task.refNo || task.id}</span>

              {/* Stage Switcher Selector */}
              <div className="flex items-center gap-1.5 ml-1">
                <span className="text-[11px] font-medium text-muted-foreground">Stage:</span>
                <Select
                  value={selectedStage}
                  onValueChange={(val) => {
                    const newSt = val as ColumnId;
                    setSelectedStage(newSt);
                    if (newSt === "lost") {
                      setActiveTab("lessons");
                    }
                  }}
                >
                  <SelectTrigger className="h-6 text-[11px] font-semibold px-2 py-0 bg-background border-border/80 min-w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    {columns.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Quick Mark as Lost Shortcut */}
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => {
                  setSelectedStage("lost");
                  setActiveTab("lessons");
                  toast.info("Stage changed to Lost. Please add primary loss reason in Lessons Learned.");
                }}
                className={cn(
                  "h-6 px-2 text-[10px] gap-1 font-semibold border-rose-500/30 text-rose-600 hover:bg-rose-500/10",
                  selectedStage === "lost" && "bg-rose-500/15 border-rose-500 font-bold",
                )}
                title="Mark this tender as Lost"
              >
                <XCircle className="size-3 text-rose-600" />
                Lost
              </Button>

              {/* Quick Mark as Cancelled Shortcut */}
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => {
                  setSelectedStage("cancelled");
                  toast.info("Stage changed to Cancelled.");
                }}
                className={cn(
                  "h-6 px-2 text-[10px] gap-1 font-semibold border-border/80 text-muted-foreground hover:bg-muted",
                  selectedStage === "cancelled" && "bg-muted border-foreground/40 text-foreground font-bold",
                )}
                title="Mark this tender as Cancelled"
              >
                <Ban className="size-3" />
                Cancelled
              </Button>

              {amountAwarded > 0 && (
                <Badge className="bg-emerald-600 text-white font-mono text-xs shrink-0">
                  Awarded: {formatCurrency(amountAwarded, { noDecimals: true })}
                </Badge>
              )}
            </div>
          </div>

          <DialogHeader className="p-0 text-left">
            <DialogTitle className="text-lg font-bold text-foreground leading-snug">
              Edit Custom Data: {task.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-0.5">
              {task.entity || "Procuring Authority"} • Record custom costs, awarded amounts, loss reasons, and delivery
              notes.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b border-border/60 p-3 bg-background">
            <TabsList className="grid grid-cols-4 w-full h-9 bg-muted/60 p-1 rounded-lg">
              <TabsTrigger value="financials" className="text-xs font-medium truncate">
                Financials & Margin
              </TabsTrigger>
              <TabsTrigger value="lessons" className="text-xs font-medium truncate">
                Lessons Learned
              </TabsTrigger>
              <TabsTrigger value="delivery" className="text-xs font-medium truncate">
                Delivery & Execution
              </TabsTrigger>
              <TabsTrigger value="general" className="text-xs font-medium truncate">
                General & Progress
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-5 max-h-[55vh] overflow-y-auto space-y-4">
            {/* TAB 1: FINANCIALS */}
            <TabsContent value="financials" className="mt-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pipelineValue" className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                    Tender / Pipeline Value (USD)
                  </Label>
                  <Input
                    id="pipelineValue"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={pipelineValueInput}
                    onChange={(e) => setPipelineValueInput(e.target.value)}
                    placeholder="e.g. 1500000"
                    className="h-8 border-blue-500/30 bg-blue-500/5 font-mono text-xs focus-visible:ring-blue-500"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Used in Total Pipeline Value while this tender is active.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="amountAwarded"
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400"
                  >
                    Amount Awarded (USD)
                  </Label>
                  <Input
                    id="amountAwarded"
                    type="number"
                    value={formData.amountAwarded || ""}
                    onChange={(e) => setFormData({ ...formData, amountAwarded: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g. 1420000"
                    className="h-8 font-mono text-xs border-emerald-500/30 bg-emerald-500/5 focus-visible:ring-emerald-500"
                  />
                  <p className="text-[10px] text-muted-foreground">Winning contract value</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="actualCost" className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    Actual Execution Cost (USD)
                  </Label>
                  <Input
                    id="actualCost"
                    type="number"
                    value={formData.actualCost || ""}
                    onChange={(e) => setFormData({ ...formData, actualCost: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g. 1080000"
                    className="h-8 font-mono text-xs border-amber-500/30 bg-amber-500/5 focus-visible:ring-amber-500"
                  />
                  <p className="text-[10px] text-muted-foreground">Materials, logistics & labour</p>
                </div>
              </div>

              {/* Profit & Margin Calculator Banner */}
              <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Commercial Margin & Profit Calculator</span>
                  {marginPct > 0 && (
                    <Badge className={marginPct >= 20 ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}>
                      {marginPct}% Gross Margin
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="p-2 rounded-lg bg-background border border-border/60">
                    <p className="text-[10px] text-muted-foreground">Contract Value</p>
                    <p className="font-mono text-xs font-bold text-foreground">
                      {formatCurrency(amountAwarded || pipelineValue, { noDecimals: true })}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border/60">
                    <p className="text-[10px] text-muted-foreground">Cost of Delivery</p>
                    <p className="font-mono text-xs font-bold text-foreground">
                      {formatCurrency(actualCost, { noDecimals: true })}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border/60">
                    <p className="text-[10px] text-muted-foreground">Net Margin ($)</p>
                    <p
                      className={`font-mono text-xs font-bold ${grossProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}
                    >
                      {grossProfit >= 0
                        ? `+${formatCurrency(grossProfit, { noDecimals: true })}`
                        : formatCurrency(grossProfit, { noDecimals: true })}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-background border border-border/60">
                    <p className="text-[10px] text-muted-foreground">Variance vs Pipeline Value</p>
                    <p className="font-mono text-xs font-bold text-foreground">
                      {pipelineValue && amountAwarded
                        ? `${Math.round(((amountAwarded - pipelineValue) / pipelineValue) * 100)}%`
                        : "0%"}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: LESSONS LEARNED & STRATEGY */}
            <TabsContent value="lessons" className="mt-0 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="lessonsLearned" className="text-xs font-semibold text-foreground">
                  Key Lessons Learned & Competitive Intelligence
                </Label>
                <Textarea
                  id="lessonsLearned"
                  rows={4}
                  value={formData.lessonsLearned || ""}
                  onChange={(e) => setFormData({ ...formData, lessonsLearned: e.target.value })}
                  placeholder="e.g. Consortium model with local electrical engineering contractor secured 15 bonus technical points. Next time lock in transformer procurement 4 weeks earlier to hedge forex fluctuations."
                  className="text-xs leading-relaxed"
                />
                <p className="text-[10px] text-muted-foreground">
                  Record post-bid review, subcontractor feedback, or bidding takeaways for institutional knowledge.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="winLossReason" className="text-xs font-semibold text-foreground">
                  Primary Win / Loss Driver
                </Label>
                <Input
                  id="winLossReason"
                  value={formData.winLossReason || ""}
                  onChange={(e) => setFormData({ ...formData, winLossReason: e.target.value })}
                  placeholder="e.g. Lowest compliant price + 100% technical threshold met; competitor lost on lack of MAF"
                  className="h-8 text-xs"
                />
              </div>
            </TabsContent>

            {/* TAB 3: DELIVERY & CONTRACT SIGN-OFF */}
            <TabsContent value="delivery" className="mt-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="contractRef" className="text-xs font-semibold text-foreground">
                    Signed Contract Reference No.
                  </Label>
                  <Input
                    id="contractRef"
                    value={formData.contractRef || ""}
                    onChange={(e) => setFormData({ ...formData, contractRef: e.target.value })}
                    placeholder="e.g. ZETDC-OVR-2025-112"
                    className="h-8 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="leadPartner" className="text-xs font-semibold text-foreground">
                    Joint Venture / Subcontractor Partner
                  </Label>
                  <Input
                    id="leadPartner"
                    value={formData.leadPartner || ""}
                    onChange={(e) => setFormData({ ...formData, leadPartner: e.target.value })}
                    placeholder="e.g. Copperbelt Heavy Civil / OEM Tech"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="deliveryStatusNotes" className="text-xs font-semibold text-foreground">
                  Delivery & Site Execution Milestones
                </Label>
                <Textarea
                  id="deliveryStatusNotes"
                  rows={3}
                  value={formData.deliveryStatusNotes || ""}
                  onChange={(e) => setFormData({ ...formData, deliveryStatusNotes: e.target.value })}
                  placeholder="e.g. Batch 1 cleared customs at Chirundu border. Site foundation works 80% complete across provincial sites. Handover inspection scheduled for next Friday."
                  className="text-xs leading-relaxed"
                />
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <Label className="text-xs font-semibold text-foreground">Client Handover & Satisfaction Score</Label>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formData.satisfactionScore || 90}%
                  </span>
                </div>
                <Slider
                  value={[formData.satisfactionScore || 90]}
                  min={10}
                  max={100}
                  step={5}
                  onValueChange={(val) => setFormData({ ...formData, satisfactionScore: val[0] })}
                />
              </div>
            </TabsContent>

            {/* TAB 4: GENERAL & PROGRESS */}
            <TabsContent value="general" className="mt-0 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs font-semibold text-foreground">
                  Tender Title
                </Label>
                <Input
                  id="title"
                  value={formData.title || ""}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs font-semibold text-foreground">
                  Summary / Scope Description
                </Label>
                <Textarea
                  id="description"
                  rows={2}
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <Label className="text-xs font-semibold text-foreground">Dossier / Execution Progress</Label>
                  <span className="font-mono font-bold text-primary">{formData.progress || 0}%</span>
                </div>
                <Slider
                  value={[formData.progress || 0]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={(val) => setFormData({ ...formData, progress: val[0] })}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="border-t border-border/60 bg-muted/20 p-3 px-5 flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs" disabled={saving}>
            Cancel
          </Button>

          <Button size="sm" onClick={handleSave} className="text-xs font-semibold px-4" disabled={saving}>
            {saving ? "Saving…" : "Save Tender Value & Data"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
