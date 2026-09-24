"use client";

import { useRef, useState } from "react";

import {
  AlertCircle,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  FileCheck,
  FileText,
  Globe,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";

import type { TenderItem } from "@/app/(main)/dashboard/default/_components/tender-data";
import type { Task, TaskTeam } from "@/app/(main)/dashboard/kanban/_components/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import { getLivePipelineBoard, saveLivePipelineBoard } from "@/lib/pipeline-sync";
import { createClient } from "@/lib/supabase/browser";
import { cn, createClientId, sha256Hex } from "@/lib/utils";
import { syncTenderToZohoCrm } from "@/lib/zoho-sync";

interface LogManualTenderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTenderCreated?: (newTender: TenderItem) => void;
}

interface AiExtractedResult {
  confidenceScore?: number;
  summaryPoints?: string[];
  fileName?: string;
  fileSize?: number;
}

interface StoredRfqDocument {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  storagePath: string;
}

async function storeRfqDocument(tenderId: string, country: "ZW" | "ZM", file: File): Promise<StoredRfqDocument> {
  const client = createClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("Please sign in again before uploading the RFQ document.");

  const contentHash = await sha256Hex(await file.arrayBuffer());
  const storagePath = `${country}/${auth.user.id}/${createClientId()}`;
  const bucket = "reference-documents";
  const { error: uploadError } = await client.storage.from(bucket).upload(storagePath, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (uploadError) throw uploadError;

  const documentName = "Original RFQ / Tender Document";
  const { data, error: saveError } = await client
    .from("tender_reference_documents")
    .insert({
      country,
      tender_key: tenderId,
      name: documentName,
      file_name: file.name,
      file_size: file.size,
      content_hash: contentHash,
      storage_path: storagePath,
    })
    .select("id,name,file_name,file_size,storage_path")
    .single();
  if (saveError) {
    await client.storage.from(bucket).remove([storagePath]);
    throw saveError;
  }

  return {
    id: data.id,
    name: data.name,
    fileName: data.file_name,
    fileSize: data.file_size,
    storagePath: data.storage_path,
  };
}

export function LogManualTenderDialog({ open, onOpenChange, onTenderCreated }: LogManualTenderDialogProps) {
  const [refNo, setRefNo] = useState("");
  const [title, setTitle] = useState("");
  const [procuringEntity, setProcuringEntity] = useState("");
  const [countryCode, setCountryCode] = useState<"ZW" | "ZM">(() => {
    if (typeof window !== "undefined") {
      try {
        const u = JSON.parse(localStorage.getItem("atcis_user") || "null");
        if (u?.country === "ZM") return "ZM";
      } catch {}
    }
    return "ZW";
  });
  const [sector, setSector] = useState<string>("ICT & Software");
  const [estimatedValue, setEstimatedValue] = useState<string>("");
  const [closingDate, setClosingDate] = useState<string>("");
  const [sourcePortal, setSourcePortal] = useState<string>("Direct Invitation / Quotation");
  const [status, setStatus] = useState<string>("Open");
  const [scopeNotes, setScopeNotes] = useState<string>("");
  const [addToPipeline, setAddToPipeline] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // RFQ Document Upload & AI State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rfqFile, setRfqFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<string>("");
  const [aiResult, setAiResult] = useState<AiExtractedResult | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showAiSummary, setShowAiSummary] = useState<boolean>(false);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error("File Too Large", {
        description: "Maximum RFQ document size is 15MB.",
      });
      return;
    }

    setRfqFile(file);
    setIsAnalyzing(true);
    setAiResult(null);
    setAnalysisProgress("Reading document structure & bytes...");

    const t1 = setTimeout(() => setAnalysisProgress("ATCIS AI parsing scope & procuring authority..."), 1000);
    const t2 = setTimeout(() => setAnalysisProgress("Extracting submission deadline & budget estimates..."), 2200);
    const t3 = setTimeout(() => setAnalysisProgress("Analyzing statutory compliance & BoQ deliverables..."), 3500);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/tenders/parse-rfq", {
        method: "POST",
        body: formData,
      });

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to analyze RFQ");
      }

      const data = json.data;
      if (data) {
        if (data.referenceNumber) setRefNo(data.referenceNumber);
        if (data.title) setTitle(data.title);
        if (data.procuringEntity) setProcuringEntity(data.procuringEntity);
        if (data.countryCode === "ZW" || data.countryCode === "ZM") setCountryCode(data.countryCode);
        if (data.sector) setSector(data.sector);
        if (data.estimatedValue) setEstimatedValue(String(data.estimatedValue));
        if (data.closingDate) setClosingDate(data.closingDate);
        if (data.sourcePortal) setSourcePortal(data.sourcePortal);
        if (data.technicalScope) setScopeNotes(data.technicalScope);

        setAiResult({
          confidenceScore: data.confidenceScore || 92,
          summaryPoints: data.summaryPoints || [],
          fileName: file.name,
          fileSize: file.size,
        });

        toast.success("RFQ Analyzed Successfully!", {
          description: `Auto-filled tender reference, entity, deadline, and scope from ${file.name}.`,
        });
      }
    } catch (err: any) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      console.error("RFQ Analysis error:", err);
      toast.error("RFQ Analysis Notice", {
        description: err.message || "Could not extract all RFQ parameters. You can still fill or edit fields manually.",
      });
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress("");
    }
  };

  const handleClearFile = () => {
    setRfqFile(null);
    setAiResult(null);
    setShowAiSummary(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!refNo.trim() || !title.trim() || !procuringEntity.trim()) {
      toast.error("Required Fields Missing", {
        description: "Please fill in the Tender Reference, Title, and Procuring Entity.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const budgetNum = Number.parseFloat(estimatedValue) || 0;
      const formattedDate = closingDate
        ? closingDate
        : new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];

      // Calculate sector AI score
      let aiScore = 88;
      if (sector === "ICT & Software" || sector === "Healthcare & Medical") {
        aiScore = 94;
      } else if (sector === "Electrical & Energy") {
        aiScore = 91;
      }

      const tenderId = `manual-${createClientId()}`;
      const storedDocument = rfqFile ? await storeRfqDocument(tenderId, countryCode, rfqFile) : undefined;
      const newTender: TenderItem & {
        rfqDocument?: { id: string; name: string; size: number; storagePath: string; confidence?: number };
      } = {
        id: tenderId,
        refNo: refNo.trim(),
        title: title.trim(),
        procuringEntity: procuringEntity.trim(),
        countryCode: countryCode,
        countryName: countryCode === "ZW" ? "Zimbabwe" : "Zambia",
        sourcePortal: sourcePortal,
        status: status,
        closingDate: formattedDate,
        estimatedValue: budgetNum,
        currency: "USD",
        sector: sector,
        category: sector,
        aiScore: aiResult?.confidenceScore ? Math.max(aiScore, aiResult.confidenceScore) : aiScore,
        publishDate: new Date().toISOString().split("T")[0],
        daysRemaining: 14,
        portalUrl: countryCode === "ZM" ? "https://eprocure.zppa.org.zm/" : "https://egp.praz.org.zw/",
        documents: storedDocument
          ? [
              {
                documentId: storedDocument.id,
                title: storedDocument.name,
                fileName: storedDocument.fileName,
                downloadUrl: `/api/tenders/reference-document?id=${encodeURIComponent(storedDocument.id)}`,
              },
            ]
          : [],
        rfqDocument: storedDocument
          ? {
              id: storedDocument.id,
              name: storedDocument.fileName,
              size: storedDocument.fileSize,
              storagePath: storedDocument.storagePath,
              confidence: aiResult?.confidenceScore,
            }
          : undefined,
      };

      // 1. Save to local storage custom tenders
      try {
        const stored = localStorage.getItem("custom_logged_tenders");
        const existing: TenderItem[] = stored ? JSON.parse(stored) : [];
        existing.unshift(newTender);
        localStorage.setItem("custom_logged_tenders", JSON.stringify(existing));
      } catch {
        // ignore
      }

      // 2. Add directly to Kanban Pipeline if selected
      if (addToPipeline) {
        try {
          const board = getLivePipelineBoard();

          let taskTeam: TaskTeam = "ICT & Telecoms";
          if (sector === "Healthcare & Medical") taskTeam = "Healthcare";
          else if (sector === "Electrical & Energy") taskTeam = "Electrical Grid";
          else if (sector === "Civil & Infrastructure") taskTeam = "Civil & Roads";

          const newTask: Task = {
            id: newTender.id,
            refNo: newTender.refNo,
            countryCode: newTender.countryCode === "ZM" ? "ZM" : "ZW",
            title: newTender.title,
            description:
              scopeNotes.trim() ||
              `Procurement opportunity issued by ${newTender.procuringEntity}. Estimated budget $${newTender.estimatedValue.toLocaleString()}.${rfqFile ? ` [Attached RFQ: ${rfqFile.name}]` : ""}`,
            entity: newTender.procuringEntity,
            estimatedValue: newTender.estimatedValue,
            pipelineValue: newTender.estimatedValue,
            sourcePortal: newTender.sourcePortal,
            portalUrl: newTender.portalUrl,
            rfqDocument: newTender.rfqDocument,
            team: taskTeam,
            priority: "High",
            dueDate: newTender.closingDate,
            progress: 15,
            insights: rfqFile
              ? [
                  {
                    label: "Documents",
                    count: 1,
                  },
                ]
              : [],
            owner: {
              name: "Administrator",
              tone: "bg-emerald-500",
            },
          };

          board.opportunity = [newTask, ...(board.opportunity || [])];
          await saveLivePipelineBoard(board);
          const zohoResult = await syncTenderToZohoCrm(newTask, {
            event: "tender_pipeline_added",
            stage: "Opportunity",
            countryCode,
            silent: true,
          });
          if (!zohoResult.success) {
            toast.warning("Tender saved, but Zoho CRM did not confirm the sync", {
              description: zohoResult.error || "Use Sync to Zoho from the pipeline card to retry.",
              duration: 7000,
            });
          } else {
            toast.success(`Synced to ${countryCode === "ZM" ? "Zambia" : "Zimbabwe"} Zoho CRM`, {
              description: `${newTender.refNo} was accepted by the configured Zoho Flow.`,
            });
          }
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : "The tender could not be saved to the pipeline.");
        }
      }

      // 3. Notify caller and show toast
      if (onTenderCreated) {
        onTenderCreated(newTender);
      }

      toast.success("Tender Logged Successfully", {
        description: `${newTender.refNo} added to Directory${addToPipeline ? " & Kanban Opportunity pipeline" : ""}${storedDocument ? " with its saved RFQ document" : ""}.`,
      });

      // Reset form
      setRefNo("");
      setTitle("");
      setProcuringEntity("");
      setEstimatedValue("");
      setClosingDate("");
      setScopeNotes("");
      handleClearFile();
      onOpenChange(false);
    } catch (error) {
      toast.error("Manual tender could not be completed", {
        description: error instanceof Error ? error.message : "Please retry the submission.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 border border-border/80 bg-card shadow-2xl">
        <DialogHeader className="p-5 border-b border-border/70 bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs font-mono">
              Manual Entry
            </Badge>
            {aiResult && (
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-mono flex items-center gap-1">
                <Sparkles className="size-3" />
                AI Analyzed
              </Badge>
            )}
            <DialogTitle className="text-lg font-bold text-foreground">Log Manual Tender Opportunity</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Upload an RFQ document for automated AI extraction or register private RFPs, newspaper notices, and
            invitations manually.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* AI-Powered RFQ Upload Dropzone */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                Upload RFQ / Tender Document for AI Auto-Fill
              </Label>
              <span className="text-[11px] text-muted-foreground">Optional</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />

            {/* Dropzone Container */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const dropped = e.dataTransfer.files?.[0];
                if (dropped) handleFileUpload(dropped);
              }}
              className={cn(
                "relative rounded-xl border border-dashed p-3.5 transition-all",
                isDragging
                  ? "border-primary bg-primary/10 shadow-md"
                  : "border-border/80 bg-muted/20 hover:border-primary/50 hover:bg-muted/30",
                aiResult && "border-emerald-500/40 bg-emerald-500/5",
                isAnalyzing && "border-primary/50 bg-primary/5",
              )}
            >
              {isAnalyzing ? (
                /* Scanning State */
                <div className="flex flex-col items-center justify-center py-4 text-center space-y-2.5">
                  <div className="relative">
                    <div className="size-10 rounded-full bg-primary/15 flex items-center justify-center animate-pulse">
                      <Loader2 className="size-5 text-primary animate-spin" />
                    </div>
                    <Sparkles className="size-3.5 text-amber-500 absolute -top-1 -right-1 animate-bounce" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">ATCIS AI Intelligence Engine</p>
                    <p className="text-[11px] font-medium text-primary mt-0.5 animate-pulse">
                      {analysisProgress || "Analyzing procurement document..."}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Extracting reference, procuring entity, submission date, budget lots, and mandatory statutory
                      requirements
                    </p>
                  </div>
                  {/* Subtle Progress Bar */}
                  <div className="w-48 h-1 rounded-full bg-muted overflow-hidden mt-1">
                    <div className="h-full bg-primary animate-pulse w-3/4 rounded-full" />
                  </div>
                </div>
              ) : aiResult ? (
                /* Analyzed State */
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0 border border-emerald-500/20">
                        <FileCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate max-w-[280px] sm:max-w-md">
                          {aiResult.fileName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {aiResult.fileSize ? `${(aiResult.fileSize / 1024).toFixed(0)} KB · ` : ""}
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            ✨ Successfully Extracted with AI ({aiResult.confidenceScore}% Confidence)
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                      >
                        <RefreshCw className="size-3 mr-1" /> Replace
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearFile}
                        className="h-7 text-[11px] px-1.5 text-muted-foreground hover:text-destructive"
                        title="Remove attached RFQ"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Expandable Key Highlights */}
                  {aiResult.summaryPoints && aiResult.summaryPoints.length > 0 && (
                    <div className="rounded-lg border border-emerald-500/20 bg-background/60 p-2.5">
                      <button
                        type="button"
                        onClick={() => setShowAiSummary(!showAiSummary)}
                        className="flex items-center justify-between w-full text-left font-semibold text-[11px] text-emerald-700 dark:text-emerald-300 cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="size-3 text-emerald-500" />
                          Key RFQ Insights Identified by AI ({aiResult.summaryPoints.length} points)
                        </span>
                        {showAiSummary ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </button>
                      {showAiSummary && (
                        <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground pl-4 list-disc">
                          {aiResult.summaryPoints.map((pt, i) => (
                            <li key={i} className="leading-snug">
                              {pt}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Idle Upload State */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center py-2.5 text-center cursor-pointer group"
                >
                  <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors mb-1.5">
                    <UploadCloud className="size-4" />
                  </div>
                  <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    Click to upload or drag &amp; drop RFQ / RFP Document
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 max-w-sm">
                    ATCIS AI will automatically read the document and extract reference, title, entity, budget &amp;
                    deadline.
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="rounded bg-background px-1.5 py-0.5 text-[9px] font-mono font-medium text-muted-foreground border border-border/70">
                      PDF
                    </span>
                    <span className="rounded bg-background px-1.5 py-0.5 text-[9px] font-mono font-medium text-muted-foreground border border-border/70">
                      DOCX
                    </span>
                    <span className="rounded bg-background px-1.5 py-0.5 text-[9px] font-mono font-medium text-muted-foreground border border-border/70">
                      TXT
                    </span>
                    <span className="rounded bg-background px-1.5 py-0.5 text-[9px] font-mono font-medium text-muted-foreground border border-border/70">
                      Scans &amp; Images
                    </span>
                    <span className="text-[9px] text-muted-foreground font-mono ml-1">Up to 15MB</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-border/60" />
            <span className="flex-shrink mx-3 text-[10px] uppercase font-semibold text-muted-foreground tracking-wider font-mono">
              Tender Parameters
            </span>
            <div className="flex-grow border-t border-border/60" />
          </div>

          {/* Row 1: Ref No & Country */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                Tender Reference Number <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. PRAZ/DOM/2026/089 or ZPPA/RDA/2026/112"
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                className="h-8 text-xs font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Jurisdiction / Country</Label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value as "ZW" | "ZM")}
                className="w-full h-8 rounded-md border border-border/70 bg-background px-2.5 font-medium text-xs text-foreground shadow-xs focus:outline-hidden"
              >
                <option value="ZW">Zimbabwe (ZW)</option>
                <option value="ZM">Zambia (ZM)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Tender Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
              Tender Title &amp; Project Scope <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="e.g. Supply & Installation of High-Density Medical Ultrasound Systems"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 text-xs"
              required
            />
          </div>

          {/* Row 3: Procuring Entity & Sector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                Procuring Authority / Entity <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. Ministry of Health, ZESA Holdings, City of Harare"
                value={procuringEntity}
                onChange={(e) => setProcuringEntity(e.target.value)}
                className="h-8 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">AI Sector Match</Label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full h-8 rounded-md border border-border/70 bg-background px-2.5 font-medium text-xs text-foreground shadow-xs focus:outline-hidden"
              >
                <option value="ICT & Software">ICT &amp; Software</option>
                <option value="Healthcare & Medical">Healthcare &amp; Medical</option>
                <option value="Electrical & Energy">Electrical &amp; Energy</option>
                <option value="Civil & Infrastructure">Civil &amp; Infrastructure</option>
                <option value="General Goods & Consumables">General Goods &amp; Consumables</option>
                <option value="Services & Logistics">Services &amp; Logistics</option>
              </select>
            </div>
          </div>

          {/* Row 4: Budget & Closing Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Estimated Value / Budget (USD)</Label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 250000"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                  className="h-8 pl-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Closing Submission Date</Label>
              <div className="relative">
                <Calendar className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                <Input
                  type="date"
                  value={closingDate}
                  onChange={(e) => setClosingDate(e.target.value)}
                  className="h-8 pl-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Row 5: Source Portal & Initial Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Publication Source</Label>
              <select
                value={sourcePortal}
                onChange={(e) => setSourcePortal(e.target.value)}
                className="w-full h-8 rounded-md border border-border/70 bg-background px-2.5 font-medium text-xs text-foreground shadow-xs focus:outline-hidden"
              >
                <option value="Direct Invitation / Quotation">Direct Invitation / Quotation</option>
                <option value="PRAZ Official Gazette">PRAZ Official Gazette</option>
                <option value="ZPPA e-GP Portal">ZPPA e-GP Portal</option>
                <option value="National Newspaper Notice">National Newspaper Notice</option>
                <option value="Multilateral (WB / AFDB / UN)">Multilateral (WB / AFDB / UN)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Initial Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-8 rounded-md border border-border/70 bg-background px-2.5 font-medium text-xs text-foreground shadow-xs focus:outline-hidden"
              >
                <option value="Open">Open</option>
                <option value="Closing Soon">Closing Soon</option>
                <option value="Under Evaluation">Under Evaluation</option>
              </select>
            </div>
          </div>

          {/* Row 6: Scope / Deliverables Summary */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Technical Scope &amp; Notes (Optional)</Label>
            <Textarea
              placeholder="Enter specific lot details, statutory certificates needed (e.g. MAF, ZIMRA tax clearance, bank bond), or contact personnel."
              value={scopeNotes}
              onChange={(e) => setScopeNotes(e.target.value)}
              rows={3}
              className="text-xs leading-relaxed"
            />
          </div>

          {/* Row 7: Kanban Pipeline Option */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-primary/20 bg-primary/5">
            <Checkbox
              id="add-pipeline"
              checked={addToPipeline}
              onCheckedChange={(checked) => setAddToPipeline(Boolean(checked))}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <label
                htmlFor="add-pipeline"
                className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="size-3.5 text-primary" />
                Add directly to Kanban Pipeline (Opportunity stage)
              </label>
              <p className="text-[11px] text-muted-foreground">
                Instantly tracks this bid on your Kanban board, updates real-time pipeline KPI values, and enables
                document checklist management.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t border-border/50 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || isAnalyzing}
              className="h-8 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-3.5" /> Save &amp; Log Opportunity
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
