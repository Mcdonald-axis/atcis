"use client";

import NextLink from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  Bot,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  FolderArchive,
  Globe,
  HelpCircle,
  Kanban,
  Link,
  ListChecks,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Scale,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  Zap,
} from "lucide-react";

import { ApprovalWorkflowCard } from "@/components/tender/approval-workflow-card";
import { MatchedSuppliersTab } from "@/components/tender/matched-suppliers-tab";
import { GoZambiaScopeViewer } from "@/components/tender/gozambia-scope-viewer";
import { ZppaDetailViewer } from "@/components/tender/zppa-detail-viewer";
import { useTenderSubmission } from "@/components/tender/use-tender-submission";
import { CountryChecklistCard } from "@/components/tender/country-checklist-card";
import { ReferenceDocumentsCard } from "@/components/tender/reference-documents-card";
import { useReferenceDocuments } from "@/components/tender/use-reference-documents";
import { useCountryChecklist } from "@/components/tender/use-country-checklist";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  enrichAnalysisWithItemsAndSuppliers,
  formatAnalysisText,
  type RequiredItemSpecification,
  type SuggestedSupplierMatch,
} from "@/lib/supplier-matching";
import { useAppRecords } from "@/hooks/use-app-records";
import {
  INTERNATIONAL_SUGGESTION_SUPPLIERS,
  mergeSupplierProfiles,
  recommendSuppliers,
  type SupplierProfile,
} from "@/lib/suppliers";
import { copyTextToClipboard, formatCurrency } from "@/lib/utils";
import { officialDocumentPreviewUrl } from "@/lib/official-document-preview";
import { addTenderToPipeline, isTenderInPipeline } from "@/lib/pipeline-sync";
import { TenderApiService } from "@/services/tender-api";
import { toast } from "sonner";
import type { TenderItem, TenderLineItem } from "@/app/(main)/dashboard/default/_components/tender-data";

export interface ProposalAlignmentItem {
  id: string;
  criterion: string;
  weight: string;
  proposalSection: string;
  status: "Mapped" | "Drafted" | "Ready";
}

interface AnalysisChecklistItem {
  item?: string;
  status?: string;
  description?: string;
}

interface AnalysisEvaluationCriterion {
  criterion?: string;
  weight?: string;
  description?: string;
}

interface AnalysisRisk {
  risk?: string;
  severity?: string;
  mitigation?: string;
}

function analysisArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function analysisRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

interface TenderDetailDialogProps {
  tender: TenderItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function sanitizeWorldBankHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "");
}

export function TenderDetailDialog({ tender, open, onOpenChange }: TenderDetailDialogProps) {
  const savedSuppliers = useAppRecords<SupplierProfile>("supplier");
  const supplierProfiles = useMemo(() => mergeSupplierProfiles(savedSuppliers), [savedSuppliers]);
  const [activeTab, setActiveTab] = useState<string>("listed-items");
  const [pipelineAdded, setPipelineAdded] = useState(false);
  const [isAddingToPipeline, setIsAddingToPipeline] = useState(false);
  const [liveDetails, setLiveDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (!open || !tender) {
      setPipelineAdded(false);
      return;
    }
    const status = isTenderInPipeline({
      id: tender.id,
      refNo: tender.refNo,
      title: tender.title,
    });
    setPipelineAdded(status.exists);
  }, [open, tender]);

  // AI Document Analysis States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [analyzedDocName, setAnalyzedDocName] = useState<string>("");
  const [customQuestion, setCustomQuestion] = useState("");
  const [askingQuestion, setAskingQuestion] = useState(false);
  const [qaHistory, setQaHistory] = useState<Array<{ question: string; answer: string }>>([]);
  const [selectedSupplierRfq, setSelectedSupplierRfq] = useState<{
    item: {
      itemName: string;
      quantity?: string | number;
      unit?: string;
      specifications?: string;
      complianceStandards?: string;
    };
    supplier: {
      supplierName: string;
      contactEmail?: string;
      contactPhone?: string;
      location?: string;
    };
  } | null>(null);
  const [previewDocIndex, setPreviewDocIndex] = useState<number>(0);
  const analyzedRequiredItems = analysisArray<RequiredItemSpecification>(analysisResult?.requiredItems);
  const analyzedMandatoryChecklist = analysisArray<AnalysisChecklistItem>(analysisResult?.mandatoryChecklist);
  const analyzedEvaluationMatrix = analysisArray<AnalysisEvaluationCriterion>(analysisResult?.evaluationMatrix);
  const analyzedCommercialTerms = analysisRecord(analysisResult?.commercialTerms);
  const analyzedRiskAssessment = analysisArray<AnalysisRisk>(analysisResult?.riskAssessment);

  const checklistState = useCountryChecklist(open, tender?.countryCode, tender?.id || tender?.refNo);
  const complianceItems = checklistState.items;
  const completedChecklist = checklistState.completed;

  const referenceState = useReferenceDocuments(open, tender?.countryCode, tender?.id || tender?.refNo);
  const referenceDocs = referenceState.documents;
  const workflowState = useTenderSubmission(open, checklistState.instance?.id);
  const [submissionBusy, setSubmissionBusy] = useState(false);
  const missingMandatory = complianceItems.filter(
    (item) => item.status === "Mandatory" && !completedChecklist[item.id],
  ).length;
  const submissionBlocked =
    checklistState.loading || referenceState.loading
      ? "Loading documents…"
      : checklistState.error || referenceState.error
        ? "Resolve the document loading errors before submitting."
        : checklistState.busy || referenceState.busy
          ? "Wait for the document operation to finish."
          : missingMandatory
            ? `Attach documents to ${missingMandatory} remaining mandatory items.`
            : !complianceItems.some((item) => item.attachedFiles.length)
              ? "Attach at least one checklist document."
              : referenceDocs.length < 3
                ? "Upload three reference documents before submitting."
                : "";

  // Technical Proposal Alignment States
  const [proposalCriteria, setProposalCriteria] = useState<ProposalAlignmentItem[]>([]);
  const [isAddingCriteria, setIsAddingCriteria] = useState(false);
  const [newCritName, setNewCritName] = useState("");
  const [newCritWeight, setNewCritWeight] = useState("25%");
  const [newCritSection, setNewCritSection] = useState("");
  const [newCritStatus, setNewCritStatus] = useState<"Mapped" | "Drafted" | "Ready">("Mapped");

  useEffect(() => {
    if (!open || !tender) {
      setLiveDetails(null);
      setAnalysisResult(null);
      setQaHistory([]);
      setActiveTab("listed-items");
      setPreviewDocIndex(0);
      setProposalCriteria([]);
      setIsAddingCriteria(false);
      return;
    }

    const isWb =
      (tender.sourcePortal || "").toLowerCase().includes("world bank") ||
      (tender.sourcePortal || "").toLowerCase().includes("worldbank") ||
      (tender.id || "").toLowerCase().startsWith("worldbank:") ||
      ((tender as any).source || "").toLowerCase().includes("worldbank");

    const isUn =
      (tender.sourcePortal || "").toLowerCase().includes("ungm") ||
      (tender.sourcePortal || "").toLowerCase().includes("un global") ||
      (tender.sourcePortal || "").toLowerCase().includes("unprocurement") ||
      (tender.procuringEntity || "").toLowerCase().includes("united nations") ||
      (tender.procuringEntity || "").toLowerCase().includes("unpd") ||
      (tender.procuringEntity || "").toLowerCase().includes("undp") ||
      (tender.id || "").toLowerCase().startsWith("unprocurement:") ||
      (tender.id || "").toLowerCase().startsWith("ungm:") ||
      ((tender as any).source || "").toLowerCase().includes("unprocurement") ||
      ((tender as any).source || "").toLowerCase().includes("ungm");

    const isGz =
      (tender.sourcePortal || "").toLowerCase().includes("gozambia") ||
      (tender.id || "").toLowerCase().startsWith("gozambiajobs:") ||
      ((tender as any).source || "").toLowerCase().includes("gozambia");

    const isZp =
      (tender.sourcePortal || "").toLowerCase().includes("zppa") ||
      (tender.id || "").toLowerCase().startsWith("zppa:") ||
      ((tender as any).source || "").toLowerCase().includes("zppa");

    setActiveTab(isWb || isUn || isGz || isZp ? "scope" : "listed-items");

    setProposalCriteria([]);
    setIsAddingCriteria(false);

    // Extract identifier: prefer tender.id (e.g. praz:92255), falling back to numerical portal URL ID
    let tenderId = tender.id;
    if (!tenderId && tender.portalUrl) {
      const match = tender.portalUrl.match(/\/(\d+)(?:[/?#]|$)/);
      if (match && match[1]) {
        tenderId = match[1];
      }
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    setLiveDetails(null);
    setLoadingDetails(true);
    const load = async () => {
      try {
        const data = await TenderApiService.getTenderDetails(tenderId, controller.signal);
        if (controller.signal.aborted) return;
        if (data) setLiveDetails(data);
        setLoadingDetails(false);
        // Saved details render immediately; check for the shared refresh without
        // blanking the dossier or restarting its tabs/checklists.
        if (data?.cacheInfo?.refreshing && attempts++ < 15) timer = setTimeout(load, 2000);
      } catch {
        if (!controller.signal.aborted) {
          setLoadingDetails(false);
          if (attempts === 0) toast.error("Could not load saved tender details. Close and reopen to retry.");
        }
      }
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, tender]);

  if (!tender) return null;

  const isWb =
    (tender.sourcePortal || "").toLowerCase().includes("world bank") ||
    (tender.sourcePortal || "").toLowerCase().includes("worldbank") ||
    (tender.id || "").toLowerCase().startsWith("worldbank:") ||
    ((tender as any).source || "").toLowerCase().includes("worldbank");

  const isUn =
    (tender.sourcePortal || "").toLowerCase().includes("ungm") ||
    (tender.sourcePortal || "").toLowerCase().includes("un global") ||
    (tender.sourcePortal || "").toLowerCase().includes("unprocurement") ||
    (tender.procuringEntity || "").toLowerCase().includes("united nations") ||
    (tender.procuringEntity || "").toLowerCase().includes("unpd") ||
    (tender.procuringEntity || "").toLowerCase().includes("undp") ||
    (tender.id || "").toLowerCase().startsWith("unprocurement:") ||
    (tender.id || "").toLowerCase().startsWith("ungm:") ||
    ((tender as any).source || "").toLowerCase().includes("unprocurement") ||
    ((tender as any).source || "").toLowerCase().includes("ungm");

  // Derive accurate official portal URL
  const getOfficialPortalUrl = () => {
    const source = (tender.sourcePortal || "").toLowerCase();
    const rawId = (tender.id || "").toLowerCase();

    // 1. Specific portalUrl from scraper/dataset
    if (
      tender.portalUrl &&
      tender.portalUrl.startsWith("http") &&
      !tender.portalUrl.includes("url=egp-SW5kZXhlcy") &&
      !tender.portalUrl.includes("Indexes/index")
    ) {
      return tender.portalUrl;
    }

    const cleanNumId = (tender.id || "").replace(/[^0-9]/g, "");

    // 2. African Development Bank (AfDB)
    if (source.includes("afdb") || source.includes("african development") || rawId.startsWith("afdb:")) {
      return tender.portalUrl || "https://www.afdb.org/en/projects-and-operations/procurement?tid=343";
    }

    // 3. World Bank
    if (source.includes("world bank") || source.includes("worldbank") || rawId.startsWith("worldbank:")) {
      const wbId = ((tender as any).tenderId || rawId.split(":").pop() || "").trim();
      return (
        tender.portalUrl ||
        (wbId
          ? `https://projects.worldbank.org/en/projects-operations/procurement-detail/${wbId}`
          : "https://projects.worldbank.org/en/projects-operations/procurement-notices")
      );
    }

    // 4. UN Global Procurement (UNPD / UNGM)
    if (
      source.includes("ungm") ||
      source.includes("un ") ||
      source.includes("united nations") ||
      rawId.startsWith("unprocurement:") ||
      rawId.startsWith("ungm:")
    ) {
      const noticeId = ((tender as any).tenderId || rawId.split(":").pop() || "").replace(/[^0-9]/g, "");
      return (
        tender.portalUrl ||
        (noticeId ? `https://www.ungm.org/Public/Notice/${noticeId}` : "https://www.ungm.org/Public/Notice")
      );
    }

    // 5. GoZambiaJobs
    if (source.includes("gozambia") || rawId.startsWith("gozambiajobs:")) {
      return tender.portalUrl || "https://gozambiajobs.com/tenders";
    }

    // 6. OnlineTenders (Aggregator)
    if (
      source.includes("online") ||
      rawId.startsWith("onlinetenders:") ||
      tender.refNo.startsWith("AMA/") ||
      tender.refNo.startsWith("EOIUNPD") ||
      tender.refNo.startsWith("ACZ/")
    ) {
      return tender.countryCode === "ZM"
        ? "https://www.onlinetenders.co.za/tenders/zambia"
        : "https://www.onlinetenders.co.za/tenders/zimbabwe";
    }

    // 7. ZPPA Zambia
    if (source.includes("zppa") || tender.countryCode === "ZM" || rawId.startsWith("zppa:")) {
      const zppaId = cleanNumId || rawId.replace(/^zppa:/i, "");
      return (
        tender.portalUrl ||
        (zppaId
          ? `https://eprocure.zppa.org.zm/epps/cft/prepareViewCfTWS.do?resourceId=${encodeURIComponent(zppaId)}`
          : "https://eprocure.zppa.org.zm")
      );
    }

    // 8. PRAZ e-GP (Official Zimbabwe Government Portal)
    if (cleanNumId && cleanNumId.length >= 4) {
      return `https://egp.praz.org.zw/Indexes/viewLiveTenderDetails/${cleanNumId}`;
    }

    return "https://egp.praz.org.zw/index?url=egp-SW5kZXhlcy9pbmRleA%3D%3D";
  };

  const portalUrl = getOfficialPortalUrl();

  // GoZambiaJobs detection
  const isGoZambia =
    (tender.sourcePortal || "").toLowerCase().includes("gozambia") ||
    (tender.id || "").toLowerCase().startsWith("gozambiajobs:") ||
    ((tender as any).source || "").toLowerCase().includes("gozambia") ||
    (liveDetails?.sourcePortal || "").toLowerCase().includes("gozambia");

  // ZPPA Zambia detection
  const isZppa =
    (tender.sourcePortal || "").toLowerCase().includes("zppa") ||
    (tender.id || "").toLowerCase().startsWith("zppa:") ||
    ((tender as any).source || "").toLowerCase().includes("zppa") ||
    ((tender as any).portal || "").toLowerCase().includes("zppa") ||
    (liveDetails?.sourcePortal || "").toLowerCase().includes("zppa");

  // World Bank detection & structured parameters
  const isWorldBank =
    (tender.sourcePortal || "").toLowerCase().includes("world bank") ||
    (tender.sourcePortal || "").toLowerCase().includes("worldbank") ||
    (tender.id || "").toLowerCase().startsWith("worldbank:") ||
    ((tender as any).source || "").toLowerCase().includes("worldbank") ||
    ((tender as any).portal || "").toLowerCase().includes("worldbank") ||
    (liveDetails?.sourcePortal || "").toLowerCase().includes("world bank") ||
    (liveDetails?.sourcePortal || "").toLowerCase().includes("worldbank");

  // United Nations Procurement Division & UNGM detection
  const isUnitedNations =
    (tender.sourcePortal || "").toLowerCase().includes("ungm") ||
    (tender.sourcePortal || "").toLowerCase().includes("un global") ||
    (tender.sourcePortal || "").toLowerCase().includes("unprocurement") ||
    (tender.procuringEntity || "").toLowerCase().includes("united nations") ||
    (tender.procuringEntity || "").toLowerCase().includes("unpd") ||
    (tender.procuringEntity || "").toLowerCase().includes("undp") ||
    (tender.id || "").toLowerCase().startsWith("unprocurement:") ||
    (tender.id || "").toLowerCase().startsWith("ungm:") ||
    ((tender as any).source || "").toLowerCase().includes("unprocurement") ||
    ((tender as any).source || "").toLowerCase().includes("ungm") ||
    (liveDetails?.procuringEntity || "").toLowerCase().includes("united nations") ||
    (liveDetails?.procuringEntity || "").toLowerCase().includes("unpd") ||
    (liveDetails?.sourcePortal || "").toLowerCase().includes("ungm") ||
    (liveDetails?.sourcePortal || "").toLowerCase().includes("un global");

  // Build actual line items from live scraped PRAZ data or structured tender dataset
  let lineItems: TenderLineItem[] = [];
  const rawItems =
    liveDetails?.lineItems && Array.isArray(liveDetails.lineItems) && liveDetails.lineItems.length > 0
      ? liveDetails.lineItems
      : tender.lineItems && Array.isArray(tender.lineItems) && tender.lineItems.length > 0
        ? tender.lineItems
        : [];

  if (rawItems.length > 0) {
    lineItems = rawItems.map((item: any, idx: number) => {
      const qty = parseFloat(item.quantity) || 1;
      const rawNum = (item.itemNumber || "").toString().trim();
      let itemNumber = `Item ${(idx + 1).toString().padStart(2, "0")}`;
      if (rawNum) {
        if (/^(item|package|lot|deliverable)/i.test(rawNum)) {
          itemNumber = rawNum;
        } else {
          itemNumber = `Item ${rawNum.padStart(2, "0")}`;
        }
      }

      const desc =
        item.description ||
        item.lotName ||
        item.lotDescription ||
        item.projectName ||
        liveDetails?.projectName ||
        tender.title ||
        `Deliverable Lot ${idx + 1}`;

      const spec =
        item.specification ||
        (item.unspsc
          ? `UNSPSC Code: ${item.unspsc}`
          : item.lotDescription ||
            liveDetails?.description ||
            tender.description ||
            "Detailed schedule of requirements specified in official bidding document");

      const unit = item.unit || item.unitOfMeasure || "Lot";

      return {
        itemNumber,
        description: desc,
        quantity: qty,
        unit,
        specification: spec,
      };
    });
  } else if (!loadingDetails && !isGoZambia && !isWorldBank && !isUnitedNations) {
    const rawDesc = liveDetails?.description || tender.description || tender.title;
    // Only synthesize a package if description is a concise line item summary, never a full document / ToR
    if (rawDesc && rawDesc.length < 250) {
      lineItems = [
        {
          itemNumber: "Package 01",
          description: liveDetails?.projectName || tender.title,
          quantity: 1,
          unit: "Lot",
          specification: rawDesc || "Detailed schedule of requirements specified in official bidding document",
        },
      ];
    }
  }

  const hasPricing = lineItems.some((i) => typeof i.estUnitPrice === "number" && i.estUnitPrice > 0);
  const totalBoQ = hasPricing ? lineItems.reduce((acc, item) => acc + (item.estTotal || 0), 0) : 0;

  const lineItemsText = lineItems.map((item) => `${item.description} ${item.specification}`).join(" ");
  const matchedSuppliers = recommendSuppliers(
    tender,
    [...supplierProfiles, ...INTERNATIONAL_SUGGESTION_SUPPLIERS],
    lineItemsText,
  );

  const rawDocs: any[] =
    liveDetails?.documents && Array.isArray(liveDetails.documents) && liveDetails.documents.length > 0
      ? liveDetails.documents
      : tender.documents && Array.isArray(tender.documents) && tender.documents.length > 0
        ? tender.documents
        : [];

  const attachedDocs: any[] = (isWorldBank || isUnitedNations ? [] : rawDocs).filter((doc: any) => {
    if (!doc) return false;
    const fName = (doc.fileName || doc.title || "").toLowerCase();
    const dUrl = (doc.downloadUrl || "").toLowerCase();
    // Filter out dummy/synthetic web page HTML links or external aggregator links
    if (
      fName.endsWith(".html") ||
      fName.includes(".html") ||
      fName.startsWith("worldbank_") ||
      fName.startsWith("unpd_") ||
      fName.startsWith("ungm_") ||
      fName.startsWith("un_") ||
      dUrl.includes("projects.worldbank.org") ||
      dUrl.includes("/procurement-detail/") ||
      dUrl.includes("ungm.org") ||
      dUrl.includes("un.org") ||
      dUrl.includes("onlinetenders.co.za")
    ) {
      return false;
    }
    return true;
  });

  const showDocumentsTab = attachedDocs.length > 0;

  const currentPreviewDoc = attachedDocs[previewDocIndex] || attachedDocs[0];
  const currentPreviewUrl = currentPreviewDoc?.downloadUrl
    ? officialDocumentPreviewUrl(currentPreviewDoc.downloadUrl)
    : "";

  const handleAddToPipeline = async () => {
    if (!tender) return;
    setIsAddingToPipeline(true);
    try {
      const result = await addTenderToPipeline({
        id: tender.id,
        refNo: tender.refNo,
        title: tender.title,
        procuringEntity: tender.procuringEntity,
        estimatedValue: tender.estimatedValue,
        closingDate: tender.closingDate,
        countryCode: tender.countryCode,
        sector: tender.sector,
        aiScore: tender.aiScore,
        description: tender.description,
        sourcePortal: tender.sourcePortal,
        documentsCount: attachedDocs.length,
      });

      if (result.alreadyExists) {
        setPipelineAdded(true);
        toast.info("Already Tracked in Pipeline", {
          description: `This tender is already tracked in your pipeline under "${result.column || "Active"}".`,
        });
      } else {
        setPipelineAdded(true);
        toast.success("Tender Added to Pipeline", {
          description: `"${tender.title}" has been successfully added to your Kanban pipeline under "New".`,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add tender to pipeline.");
    } finally {
      setIsAddingToPipeline(false);
    }
  };

  const handleDownloadAllDocs = () => {
    if (attachedDocs.length > 0) {
      attachedDocs.forEach((doc) => {
        if (doc.downloadUrl) {
          window.open(doc.downloadUrl, "_blank");
        }
      });
      return;
    }
    handleDownloadSpecPdf();
  };

  const handleDownloadSpecPdf = () => {
    const directDoc = attachedDocs[0]?.downloadUrl;
    if (directDoc) {
      window.open(directDoc, "_blank");
      return;
    }

    if (liveDetails?.documentsPreviewUrl) {
      window.open(liveDetails.documentsPreviewUrl, "_blank");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const itemsHtml = lineItems
      .map(
        (item) => `
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: 600;">${item.itemNumber}</td>
        <td style="padding: 10px 12px; border: 1px solid #cbd5e1;">
          <strong style="color: #0f172a;">${item.description}</strong><br/>
          <span style="font-size: 11px; color: #64748b; font-family: monospace;">${item.specification}</span>
        </td>
        <td style="padding: 10px 12px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace; font-weight: bold;">${item.quantity.toLocaleString()}</td>
        <td style="padding: 10px 12px; border: 1px solid #cbd5e1; color: #334155;">${item.unit}</td>
      </tr>
    `,
      )
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Tender Specification - ${liveDetails?.tenderReferenceNumber || tender.refNo}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; line-height: 1.5; padding: 25px; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
          .badge { display: inline-block; padding: 4px 10px; background: #e2e8f0; border-radius: 4px; font-size: 11px; font-family: monospace; font-weight: bold; }
          .title { font-size: 20px; font-weight: bold; margin: 12px 0 6px 0; color: #0f172a; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 25px; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; }
          .grid-item strong { display: block; font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px; }
          th { background: #f1f5f9; padding: 10px 12px; border: 1px solid #cbd5e1; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; }
          .footer { margin-top: 35px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="badge">${tender.countryCode} · ${tender.sourcePortal} · ${tender.category}</span>
            <span style="font-family: monospace; font-size: 11px; color: #64748b;">Dossier Date: ${new Date().toLocaleDateString()}</span>
          </div>
          <h1 class="title">${liveDetails?.projectName || tender.title}</h1>
          <div style="font-size: 13px; color: #475569;">Procuring Authority: <strong style="color: #0f172a;">${liveDetails?.procuringEntity || tender.procuringEntity}</strong> (${tender.countryName})</div>
        </div>

        <div class="grid">
          <div class="grid-item"><strong>Tender Reference Number</strong> ${liveDetails?.tenderReferenceNumber || tender.refNo}</div>
          <div class="grid-item"><strong>Procurement Method</strong> ${procurementMethod}</div>
          <div class="grid-item"><strong>Closing Deadline</strong> ${tender.closingDate || "Open for Bidding"}</div>
          <div class="grid-item"><strong>Bid Validity Period</strong> ${bidValidity}</div>
          <div class="grid-item"><strong>Funding Source</strong> ${fundingSource}</div>
          <div class="grid-item"><strong>Delivery / Project Location</strong> ${deliveryLocation}</div>
        </div>

        <h3 style="font-size: 14px; font-weight: 700; text-transform: uppercase; color: #0f172a; margin-bottom: 6px;">Schedule of Requirements & Gazetted Line Items (${lineItems.length})</h3>
        <table>
          <thead>
            <tr>
              <th style="width: 80px;">Item #</th>
              <th>Deliverable & Technical Specification</th>
              <th style="width: 100px; text-align: center;">Quantity</th>
              <th style="width: 100px;">Unit of Measure</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="footer">
          Official Procurement Notice · ${tender.sourcePortal || "Official Portal"}<br/>
          Source URL: ${portalUrl}
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Live fields
  const procurementMethod =
    liveDetails?.procurementMethod ||
    tender.procurementMethod ||
    liveDetails?.classOfProcurement ||
    "Open Competitive (ICB)";
  const bidValidity = liveDetails?.bidValidityPeriod ? `${liveDetails.bidValidityPeriod} Days` : "90 Calendar Days";
  const deliveryLocation = liveDetails?.deliveryProjectLocation || tender.countryName;
  const fundingSource = liveDetails?.fundingSource || "National Treasury / Statutory Budget";
  const deliveryPeriod = liveDetails?.deliveryPeriod || "As Specified in Dossier";

  const hasContractValue = tender.estimatedValue && tender.estimatedValue > 0;

  const wbId =
    liveDetails?.noticeAtAGlance?.noticeNo ||
    liveDetails?.tenderId ||
    (tender as any).tenderId ||
    tender.id
      .replace(/^worldbank:(zw|zm):/i, "")
      .replace(/^worldbank:/i, "")
      .replace(/^(zw|zm)-/i, "") ||
    "";

  const formatWbDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        timeZone: "UTC",
      });
    } catch {
      return dateStr;
    }
  };

  const formatWbDeadline = (dateStr?: string, timeStr?: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      let datePart = dateStr;
      if (!isNaN(d.getTime())) {
        datePart = d.toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
          timeZone: "UTC",
        });
      }
      const cleanTime = timeStr ? timeStr.trim() : "";
      return cleanTime ? `${datePart} ${cleanTime}` : datePart;
    } catch {
      return timeStr ? `${dateStr} ${timeStr}` : dateStr;
    }
  };

  const wbNotice = {
    projectId: liveDetails?.noticeAtAGlance?.projectId || liveDetails?.projectId || (tender as any).projectId || "—",
    projectTitle:
      liveDetails?.noticeAtAGlance?.projectTitle ||
      liveDetails?.projectTitle ||
      liveDetails?.projectName ||
      (tender as any).projectTitle ||
      tender.title ||
      "—",
    country:
      liveDetails?.noticeAtAGlance?.country ||
      liveDetails?.countryName ||
      tender.countryName ||
      (tender.countryCode === "ZW" ? "Zimbabwe" : tender.countryCode === "ZM" ? "Zambia" : "Zimbabwe"),
    noticeNo: liveDetails?.noticeAtAGlance?.noticeNo || wbId || "—",
    noticeType:
      liveDetails?.noticeAtAGlance?.noticeType ||
      liveDetails?.procurementType ||
      (tender as any).procurementType ||
      "Request for Expression of Interest",
    noticeStatus:
      liveDetails?.noticeAtAGlance?.noticeStatus ||
      liveDetails?.noticeStatus ||
      (tender as any).noticeStatus ||
      "Published",
    borrowerBidReference:
      liveDetails?.noticeAtAGlance?.borrowerBidReference ||
      liveDetails?.referenceNumber ||
      liveDetails?.tenderReferenceNumber ||
      (tender as any).referenceNumber ||
      tender.refNo ||
      "—",
    procurementMethod:
      liveDetails?.noticeAtAGlance?.procurementMethod ||
      liveDetails?.procurementMethod ||
      tender.procurementMethod ||
      "—",
    language:
      liveDetails?.noticeAtAGlance?.language || liveDetails?.noticeLang || (tender as any).noticeLang || "English",
    submissionDeadline:
      liveDetails?.noticeAtAGlance?.submissionDeadline ||
      formatWbDeadline(
        liveDetails?.closingDate || tender.closingDate,
        liveDetails?.submissionDeadlineTime || (tender as any).submissionDeadlineTime,
      ),
    publishedDate:
      liveDetails?.noticeAtAGlance?.publishedDate || formatWbDate(liveDetails?.publishDate || tender.publishDate),
  };

  const wbContact = {
    organization:
      liveDetails?.contactInfo?.organization ||
      liveDetails?.contact?.organization ||
      liveDetails?.procuringEntity ||
      tender.procuringEntity ||
      "—",
    name: liveDetails?.contactInfo?.name || liveDetails?.contact?.name || (tender as any).contact?.name || "—",
    address:
      liveDetails?.contactInfo?.address || liveDetails?.contact?.address || (tender as any).contact?.address || "—",
    city:
      liveDetails?.contactInfo?.city ||
      (liveDetails?.contact?.address?.toLowerCase().includes("harare")
        ? "Harare"
        : liveDetails?.contact?.address?.toLowerCase().includes("lusaka")
          ? "Lusaka"
          : "—"),
    province:
      liveDetails?.contactInfo?.province ||
      liveDetails?.contact?.province ||
      liveDetails?.countryName ||
      tender.countryName ||
      "—",
    postalCode: liveDetails?.contactInfo?.postalCode || liveDetails?.contact?.postalCode || "—",
    country:
      liveDetails?.contactInfo?.country ||
      liveDetails?.contact?.country ||
      liveDetails?.countryName ||
      tender.countryName ||
      "—",
    phone: liveDetails?.contactInfo?.phone || liveDetails?.contact?.phone || (tender as any).contact?.phone || "—",
    email: liveDetails?.contactInfo?.email || liveDetails?.contact?.email || (tender as any).contact?.email || "",
    website: liveDetails?.contactInfo?.website || liveDetails?.contact?.website || "",
  };

  const wbHtmlContent = liveDetails?.noticeTextHtml || (tender as any).noticeTextHtml || "";

  const wbTextContent = liveDetails?.description || tender.description || "";

  // Comprehensive plain-text Scope of Works extracted from all gazetted notice sources
  const cleanNoticeHtml = (wbHtmlContent || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  const fullScopeOfWorksText = [
    tender.title ? `PROJECT TITLE: ${tender.title}` : "",
    liveDetails?.procuringEntity || tender.procuringEntity
      ? `PROCURING ENTITY: ${liveDetails?.procuringEntity || tender.procuringEntity} (${tender.countryName || ""})`
      : "",
    wbNotice?.borrowerBidReference || tender.refNo
      ? `TENDER REFERENCE / BID NO: ${wbNotice?.borrowerBidReference || tender.refNo}`
      : "",
    wbNotice?.projectId && wbNotice.projectId !== "—" ? `WORLD BANK PROJECT ID: ${wbNotice.projectId}` : "",
    wbNotice?.noticeType || procurementMethod
      ? `PROCUREMENT METHOD & TYPE: ${wbNotice?.noticeType || tender.procurementType || ""} | ${wbNotice?.procurementMethod || procurementMethod || ""}`
      : "",
    wbNotice?.submissionDeadline || tender.closingDate
      ? `SUBMISSION DEADLINE: ${wbNotice?.submissionDeadline || tender.closingDate}`
      : "",
    cleanNoticeHtml && cleanNoticeHtml.length > 50
      ? `OFFICIAL SCOPE OF WORKS & TERMS OF REFERENCE:\n${cleanNoticeHtml}`
      : wbTextContent
        ? `OFFICIAL SCOPE OF WORKS & REQUIREMENTS:\n${wbTextContent}`
        : "",
    lineItems && lineItems.length > 0
      ? `GAZETTED LOTS & SCHEDULE OF REQUIREMENTS:\n` +
        lineItems
          .map(
            (li: any, idx: number) =>
              `Lot/Item ${idx + 1}: ${li.description || li.lotName || "Item"} (Qty: ${li.quantity || 1} ${li.unit || li.unitOfMeasure || "Unit"})`,
          )
          .join("\n")
      : "",
    wbContact?.organization && wbContact.organization !== "—"
      ? `CONTACT & SUBMISSION DIRECTORY:\nOrganization: ${wbContact.organization}, Contact: ${wbContact.name}, Email: ${wbContact.email}, Address: ${wbContact.address}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  // Trigger Gemini Deep Document / Scope of Works Analysis
  const handleAnalyzeDocument = async (doc?: any, targetTab = "ai-recommendation") => {
    setActiveTab(targetTab);
    setIsAnalyzing(true);

    const isScopeAnalysis = !doc && attachedDocs.length === 0;
    const docName = isScopeAnalysis
      ? "Scope of Works & Official Gazette Specifications"
      : doc?.fileName || doc?.title || attachedDocs[0]?.fileName || "Tender Bidding Document";
    setAnalyzedDocName(docName);

    try {
      let result: any = null;
      try {
        result = await TenderApiService.analyzeTenderDocument({
          tenderId: tender.id,
          tender: {
            ...tender,
            ...liveDetails,
          },
          scopeOfWorks: fullScopeOfWorksText,
          fileName: docName,
          documentUrl: doc?.downloadUrl || attachedDocs[0]?.downloadUrl,
          isScopeAnalysis,
        });
      } catch {
        // network or backend fallback
      }

      const enriched = enrichAnalysisWithItemsAndSuppliers(
        result,
        tender,
        liveDetails?.lineItems,
        isScopeAnalysis,
        supplierProfiles,
      );
      setAnalysisResult(enriched);

      const evaluationMatrix = analysisArray<AnalysisEvaluationCriterion>(enriched?.evaluationMatrix);
      if (evaluationMatrix.length > 0) {
        setProposalCriteria(
          evaluationMatrix.map((em, idx) => ({
            id: `ai-crit-${idx}`,
            criterion: em.criterion || `Evaluation criterion ${idx + 1}`,
            weight: em.weight || "25%",
            proposalSection: `Section ${idx + 2}: ${em.criterion || `Criterion ${idx + 1}`}`,
            status: "Mapped" as const,
          })),
        );
      }
    } catch {
      const fallback = enrichAnalysisWithItemsAndSuppliers(
        null,
        tender,
        liveDetails?.lineItems,
        isScopeAnalysis,
        supplierProfiles,
      );
      setAnalysisResult(fallback);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Ask AI Follow-up Question
  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestion.trim() || askingQuestion) return;

    const q = customQuestion.trim();
    setCustomQuestion("");
    setAskingQuestion(true);

    try {
      const isScopeAnalysis = attachedDocs.length === 0;
      const result = await TenderApiService.analyzeTenderDocument({
        tenderId: tender.id,
        tender: { ...tender, ...liveDetails },
        scopeOfWorks: fullScopeOfWorksText,
        fileName: analyzedDocName || (isScopeAnalysis ? "Scope of Works" : "Tender Bidding Document"),
        customPrompt: q,
        isScopeAnalysis,
      });

      if (result?.executiveSummary || result?.pricingStrategy) {
        setQaHistory((prev) => [
          ...prev,
          {
            question: q,
            answer: formatAnalysisText(result.executiveSummary || result.pricingStrategy, "Analysis completed."),
          },
        ]);
      }
    } finally {
      setAskingQuestion(false);
    }
  };

  // --- Technical Proposal Alignment Handlers ---
  const handleSaveCriteria = () => {
    if (!newCritName.trim()) {
      toast.error("Please enter an evaluation criterion name");
      return;
    }
    const newCrit: ProposalAlignmentItem = {
      id: `crit-${Date.now()}`,
      criterion: newCritName.trim(),
      weight: newCritWeight.trim() || "20%",
      proposalSection: newCritSection.trim() || "Technical Proposal Volume II",
      status: newCritStatus,
    };
    setProposalCriteria((prev) => [...prev, newCrit]);
    setNewCritName("");
    setNewCritSection("");
    setIsAddingCriteria(false);
    toast.success("Evaluation criterion mapped to proposal");
  };

  const handleDeleteCriteria = (critId: string) => {
    setProposalCriteria((prev) => prev.filter((c) => c.id !== critId));
    toast.info("Criterion removed");
  };

  const handleImportCriteriaFromAi = () => {
    if (analyzedEvaluationMatrix.length > 0) {
      const imported: ProposalAlignmentItem[] = analyzedEvaluationMatrix.map((em, idx) => ({
        id: `crit-ai-${idx}-${Date.now()}`,
        criterion: em.criterion || `Evaluation criterion ${idx + 1}`,
        weight: em.weight || "25%",
        proposalSection: `Section ${idx + 2}: ${em.criterion || `Criterion ${idx + 1}`}`,
        status: "Mapped",
      }));
      setProposalCriteria(imported);
      toast.success(`Imported ${imported.length} evaluation criteria from AI matrix`);
    } else {
      const defaults: ProposalAlignmentItem[] = [
        {
          id: "crit-1",
          criterion: "Technical Methodology & Work Plan",
          weight: "40 Points",
          proposalSection: "Section 3.1: Execution Strategy",
          status: "Ready",
        },
        {
          id: "crit-2",
          criterion: "Key Personnel Qualifications & Accreditations",
          weight: "30 Points",
          proposalSection: "Section 4.0: Expert Team Profiles",
          status: "Ready",
        },
        {
          id: "crit-3",
          criterion: "Specific Corporate Experience in Similar Works",
          weight: "20 Points",
          proposalSection: "Section 2.3: Past Performance Letters",
          status: "Mapped",
        },
        {
          id: "crit-4",
          criterion: "Risk Mitigation & Environmental Health Plan",
          weight: "10 Points",
          proposalSection: "Section 5.2: HSE Framework",
          status: "Drafted",
        },
      ];
      setProposalCriteria(defaults);
      toast.success("Initialized standard technical proposal criteria");
    }
  };

  const handleResetCriteria = () => {
    setProposalCriteria([]);
    toast.info("Technical proposal alignment reset");
  };

  const totalChecklistItems = complianceItems.length;
  const completedCount = complianceItems.filter((i) => completedChecklist[i.id || i.item]).length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl md:max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto overflow-x-hidden p-5 sm:p-7 md:p-8 space-y-6 shadow-2xl border border-border/80 bg-card min-w-0">
          {/* Top Header Section */}
          <div className="space-y-4 border-b border-border/60 pb-5 pr-8 min-w-0">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 min-w-0">
              {/* Left Badges Group */}
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="inline-flex items-center rounded-md border border-border bg-muted/90 px-2.5 py-1 font-mono text-xs font-bold text-foreground shadow-2xs">
                  {tender.countryCode}
                </span>
                <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/60 px-2.5 py-1 font-mono text-xs font-semibold text-foreground/90">
                  {liveDetails?.tenderReferenceNumber || tender.refNo}
                </span>
                <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {tender.sourcePortal}
                </span>
                <span className="inline-flex items-center rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  {tender.category}
                </span>
                {liveDetails && (
                  <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Live Scraped
                  </span>
                )}
                {attachedDocs.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                    <FileText className="size-3" />
                    {attachedDocs.length} {attachedDocs.length === 1 ? "File Attached" : "Files Attached"}
                  </span>
                )}
              </div>

              {/* Right Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {attachedDocs.length > 0 && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleDownloadAllDocs}
                    className="gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                  >
                    <Download className="size-3.5" />
                    <span>Download Document</span>
                  </Button>
                )}

                <a
                  href={portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-2xs"
                >
                  <Globe className="size-3.5 text-primary" />
                  <span>Official Portal</span>
                  <ExternalLink className="size-3 text-muted-foreground" />
                </a>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAnalyzeDocument()}
                  className={`gap-1.5 rounded-full px-3.5 py-1 font-mono text-xs font-semibold shadow-2xs ${
                    (analysisResult?.aiFitScore ?? tender.aiScore) >= 85
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                      : (analysisResult?.aiFitScore ?? tender.aiScore) >= 50
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                        : "border-zinc-500/40 bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-500/20"
                  }`}
                >
                  <Sparkles className="size-3.5" />
                  {analysisResult
                    ? `${analysisResult.aiFitScore}% Fit Score`
                    : `${tender.aiScore}% Fit · Analyze with AI`}
                </Button>
              </div>
            </div>

            <div className="space-y-2 pt-1 min-w-0">
              <h2 className="font-bold text-xl sm:text-2xl md:text-3xl leading-snug tracking-tight text-foreground break-words">
                {liveDetails?.projectName || tender.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted-foreground min-w-0">
                <Building2 className="size-4 shrink-0 text-muted-foreground" />
                <span className="break-words">
                  Procuring Entity:{" "}
                  <strong className="text-foreground">{liveDetails?.procuringEntity || tender.procuringEntity}</strong>
                </span>
                <span>·</span>
                <span className="text-foreground font-medium shrink-0">{tender.countryName}</span>
              </div>
            </div>
          </div>

          {/* 4 Metric Summary Cards Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 min-w-0">
            {/* Card 1: Est. Value / Procurement Basis */}
            <div className="flex flex-col justify-between h-[96px] rounded-xl border border-border/70 bg-muted/25 p-3.5 sm:p-4 shadow-2xs min-w-0 overflow-hidden">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                {hasContractValue ? "Est. Contract Value" : "Procurement Pricing"}
              </span>
              <p className="font-bold font-mono text-xl sm:text-2xl text-foreground truncate">
                {hasContractValue ? formatCurrency(tender.estimatedValue, { noDecimals: true }) : "Sealed Bidding"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {hasContractValue ? `${tender.currency} Fixed Procurement` : "To Be Quoted in Proposal"}
              </p>
            </div>

            {/* Card 2: Closing Deadline */}
            <div className="flex flex-col justify-between h-[96px] rounded-xl border border-border/70 bg-muted/25 p-3.5 sm:p-4 shadow-2xs min-w-0 overflow-hidden">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                Closing Deadline
              </span>
              <p className="font-bold font-mono text-lg sm:text-xl text-foreground truncate">
                {tender.closingDate || "Open"}
              </p>
              <p
                className={`font-mono text-[11px] font-semibold truncate ${
                  tender.daysRemaining <= 5
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {tender.daysRemaining > 0
                  ? `${tender.daysRemaining} days remaining`
                  : isGoZambia
                    ? "Active Notice"
                    : "Active Gazetted"}
              </p>
            </div>

            {/* Card 3: Procurement Method */}
            <div className="flex flex-col justify-between h-[96px] rounded-xl border border-border/70 bg-muted/25 p-3.5 sm:p-4 shadow-2xs min-w-0 overflow-hidden">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                Procurement Method
              </span>
              <p className="font-semibold text-sm sm:text-base text-foreground truncate" title={procurementMethod}>
                {procurementMethod}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {isGoZambia
                  ? "Published Notice"
                  : isWorldBank
                    ? "World Bank Standard"
                    : isUnitedNations
                      ? "UN Solicitation"
                      : "Standard Gazetted"}
              </p>
            </div>

            {/* Card 4: Attached Documents */}
            <div className="flex flex-col justify-between h-[96px] rounded-xl border border-border/70 bg-muted/25 p-3.5 sm:p-4 shadow-2xs min-w-0 overflow-hidden">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                {isWorldBank || isUnitedNations || attachedDocs.length === 0 ? "Tender Dossier" : "Attached Documents"}
              </span>
              <p className="font-bold font-mono text-lg sm:text-xl text-foreground truncate flex items-center gap-1.5">
                <FileText className="size-4 text-primary shrink-0" />
                <span>
                  {isWorldBank || isUnitedNations || attachedDocs.length === 0
                    ? "Online Dossier"
                    : `${attachedDocs.length} ${attachedDocs.length === 1 ? "File" : "Files"}`}
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {isWorldBank
                  ? "Official Gazette Text"
                  : isUnitedNations
                    ? "Official UNGM Notice"
                    : isGoZambia
                      ? "Published on GoZambiaJobs"
                      : attachedDocs.length > 0
                        ? "Direct Download"
                        : tender.sourcePortal?.includes("Online")
                          ? "Aggregator Summary"
                          : "Published in Gazette"}
              </p>
            </div>
          </div>

          {liveDetails?.cacheInfo && (
            <p className="text-xs text-muted-foreground" role="status">
              Last source update:{" "}
              {liveDetails.cacheInfo.updatedAt
                ? new Date(liveDetails.cacheInfo.updatedAt).toLocaleString()
                : "Not recorded"}
              {liveDetails.cacheInfo.refreshing ? " · Checking for updates in the background…" : ""}
              {liveDetails.cacheInfo.retryAt ? " · Source unavailable; showing saved details." : ""}
            </p>
          )}

          {/* Detailed Tabs Container with Clear Tabs */}
          <Tabs
            value={!showDocumentsTab && activeTab === "documents" ? "scope" : activeTab}
            onValueChange={setActiveTab}
            className="w-full space-y-4 min-w-0"
          >
            <TabsList
              className={`grid w-full ${
                showDocumentsTab
                  ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
                  : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
              } h-auto bg-muted/60 p-1.5 rounded-xl text-xs gap-1 min-w-0`}
            >
              <TabsTrigger value="listed-items" className="text-xs font-medium py-2 px-2 truncate">
                Listed Items ({lineItems.length})
              </TabsTrigger>
              {showDocumentsTab && (
                <TabsTrigger
                  value="documents"
                  className="text-xs font-medium py-2 px-2 flex items-center justify-center gap-1.5 truncate"
                >
                  <FileText className="size-3.5 shrink-0" />
                  <span className="truncate">Documents ({attachedDocs.length})</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="scope" className="text-xs font-medium py-2 px-2 truncate">
                {isZppa
                  ? "ZPPA Dossier"
                  : isWorldBank
                    ? "World Bank Notice"
                    : isGoZambia
                      ? "GoZambia Scope"
                      : isUnitedNations
                        ? "UNGM Dossier"
                        : "Scope of Works"}
              </TabsTrigger>
              <TabsTrigger
                value="matched-suppliers"
                className="text-xs font-medium py-2 px-2 flex items-center justify-center gap-1.5 truncate"
              >
                <Store className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="truncate">Suppliers ({matchedSuppliers.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="ai-recommendation"
                className="text-xs font-medium py-2 px-2 flex items-center justify-center gap-1.5 truncate"
              >
                <Sparkles className="size-3.5 shrink-0 text-emerald-500" />
                <span className="truncate">AI Intelligence {analysisResult ? "✓" : ""}</span>
              </TabsTrigger>
              <TabsTrigger
                value="compliance-checklist"
                className={`text-xs font-medium py-2 px-2 flex items-center justify-center gap-1.5 truncate ${
                  showDocumentsTab ? "col-span-2 sm:col-span-1" : ""
                }`}
              >
                <ListChecks className="size-3.5 shrink-0" />
                <span className="truncate">
                  Checklist ({completedCount}/{totalChecklistItems})
                </span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: LISTED ITEMS */}
            <TabsContent
              value="listed-items"
              className="space-y-3.5 rounded-xl border border-border/60 bg-card p-4 sm:p-6 min-w-0"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-border/50 min-w-0">
                <div className="min-w-0">
                  <h3 className="font-semibold text-base sm:text-lg text-foreground">
                    Schedule of Requirements & Bill of Quantities (BoQ)
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {tender.sourcePortal?.includes("AfDB")
                      ? "Official procurement requirements and specifications extracted directly from African Development Bank (AfDB)."
                      : isGoZambia
                        ? "Official procurement requirements and technical specifications extracted from GoZambiaJobs."
                        : liveDetails
                          ? "Official line items and technical specifications scraped directly from the official gazette."
                          : "Official gazetted deliverables and requirements."}
                  </p>
                </div>
                <span className="font-mono text-xs sm:text-sm font-bold text-foreground shrink-0">
                  {lineItems.length}{" "}
                  {isGoZambia ? (lineItems.length === 1 ? "Listed Item" : "Listed Items") : "Gazetted Items"}
                </span>
              </div>

              {/* Quick Sourcing Bar: Alerting user to evidence-based candidates */}
              {matchedSuppliers.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      <Store className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {matchedSuppliers.length} Evidence-Based{" "}
                        {matchedSuppliers.length === 1 ? "Candidate" : "Candidates"} for These Goods
                      </p>
                      <p className="text-muted-foreground text-[11px] truncate">
                        Includes country-local directory profiles and source-reviewed international suggestions.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab("matched-suppliers")}
                    className="h-7 text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 shrink-0 gap-1 font-medium"
                  >
                    <Store className="size-3" /> View Matched Suppliers ({matchedSuppliers.length}) →
                  </Button>
                </div>
              )}

              <div className="rounded-xl border border-border/60 overflow-hidden bg-card/40 min-w-0 shadow-2xs">
                <Table className="w-full table-fixed min-w-[620px] md:min-w-full">
                  <TableHeader className="bg-muted/40 text-xs">
                    <TableRow className="border-b border-border/60">
                      <TableHead className="w-[90px] font-semibold text-xs py-3 text-center">Item #</TableHead>
                      <TableHead className="font-semibold text-xs py-3">
                        Deliverable & Technical Specification
                      </TableHead>
                      <TableHead className="text-center w-[100px] font-semibold text-xs py-3">Quantity</TableHead>
                      <TableHead className="w-[110px] font-semibold text-xs py-3">Unit</TableHead>
                      {hasPricing && (
                        <>
                          <TableHead className="text-right w-[130px] font-semibold text-xs py-3">
                            Unit Price ($)
                          </TableHead>
                          <TableHead className="text-right w-[140px] font-semibold text-xs py-3">
                            Total Value ($)
                          </TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs sm:text-sm divide-y divide-border/40">
                    {loadingDetails ? (
                      <TableRow>
                        <TableCell
                          colSpan={hasPricing ? 6 : 4}
                          className="text-center py-8 text-muted-foreground text-xs"
                        >
                          {isGoZambia
                            ? "Loading notice details directly from GoZambiaJobs..."
                            : "Loading live items directly from official gazette notice..."}
                        </TableCell>
                      </TableRow>
                    ) : lineItems.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={hasPricing ? 6 : 4}
                          className="text-center py-8 text-muted-foreground text-xs space-y-1.5"
                        >
                          <p className="font-medium text-foreground">
                            {isGoZambia
                              ? "This notice is published as a Request for Proposals (RFP) / Terms of Reference."
                              : "No individual line items itemized on the portal."}
                          </p>
                          <p
                            className="text-[11px] text-primary cursor-pointer hover:underline"
                            onClick={() => setActiveTab("scope")}
                          >
                            {isGoZambia
                              ? "Click to inspect the Scope of Works tab for the complete schedule of requirements, team qualifications, and submission instructions →"
                              : "Please inspect the attached tender documents tab."}
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      lineItems.map((item, idx) => (
                        <TableRow key={idx} className="transition-colors hover:bg-muted/30">
                          <TableCell className="font-mono font-semibold text-center text-muted-foreground align-middle py-3">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-muted/60 text-foreground text-xs">
                              {item.itemNumber}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-normal break-words align-middle py-3">
                            <div className="space-y-1 min-w-0">
                              <p className="font-semibold text-foreground text-xs sm:text-sm leading-snug">
                                {item.description}
                              </p>
                              <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                                {item.specification}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono font-semibold text-foreground align-middle py-3">
                            {item.quantity.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-foreground font-medium align-middle py-3">{item.unit}</TableCell>
                          {hasPricing && (
                            <>
                              <TableCell className="text-right font-mono tabular-nums text-muted-foreground align-middle py-3">
                                {formatCurrency(item.estUnitPrice || 0, { noDecimals: true })}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold tabular-nums text-foreground align-middle py-3">
                                {formatCurrency(item.estTotal || 0, { noDecimals: true })}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))
                    )}

                    {hasPricing && (
                      <TableRow className="bg-muted/50 font-semibold text-sm">
                        <TableCell colSpan={hasPricing ? 4 : 3} className="text-right text-foreground py-3">
                          Total Bill of Quantities (BoQ):
                        </TableCell>
                        <TableCell
                          colSpan={2}
                          className="text-right font-mono font-bold text-base text-foreground py-3 pr-4"
                        >
                          {formatCurrency(totalBoQ, { noDecimals: true })}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* TAB 2: DEDICATED OFFICIAL DOCUMENTS TAB */}
            {showDocumentsTab && (
              <TabsContent
                value="documents"
                className="space-y-5 rounded-xl border border-border/60 bg-card p-4 sm:p-6 min-w-0"
              >
                {/* AI Document Analysis Promotion Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 min-w-0">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      <Sparkles className="size-4" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-semibold text-sm text-foreground">
                        Deep AI Document Analysis (Gemini 2.5 Flash)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Automatically extract statutory compliance criteria, technical scoring weights, and
                        win-strategies from attached documents.
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleAnalyzeDocument()}
                    disabled={isAnalyzing}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-semibold shrink-0 shadow-sm"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" /> Analyzing...
                      </>
                    ) : (
                      <>
                        <Bot className="size-3.5" /> Analyze with AI
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-border/50 min-w-0">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-base sm:text-lg text-foreground flex items-center gap-2">
                      <FileText className="size-4 text-primary shrink-0" />
                      <span>Official Gazetted Bidding Documents</span>
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {tender.sourcePortal?.includes("AfDB")
                        ? "Direct official downloads extracted from African Development Bank (AfDB). No account or login required."
                        : "Direct public downloads extracted from official statutory portal & gazette. No account or login required."}
                    </p>
                  </div>

                  {attachedDocs.length > 1 && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={handleDownloadAllDocs}
                      className="gap-1.5 text-xs font-semibold shrink-0"
                    >
                      <FolderArchive className="size-3.5" /> Download All ({attachedDocs.length} Files)
                    </Button>
                  )}
                </div>

                {loadingDetails ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    Loading official document attachments...
                  </div>
                ) : attachedDocs.length === 0 ? (
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-8 text-center space-y-3">
                    <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                      <FileText className="size-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-semibold text-foreground">
                        {tender.sourcePortal?.includes("Online")
                          ? "Aggregator Summary Notice (OnlineTenders)"
                          : "No Standalone PDF Attachments Published"}
                      </p>
                      <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
                        {tender.sourcePortal?.includes("Online")
                          ? `This notice was collected from OnlineTenders Zimbabwe as a public tender brief. Official standalone bidding documents (SBDs) are gazetted by ${tender.procuringEntity} on the official government portal (PRAZ e-GP) or provided directly to registered bidders.`
                          : "The procuring authority has published this tender opportunity directly on the official portal with all requirements inline. All statutory specifications and deliverable schedules are detailed under the Listed Items and Scope of Works tabs."}
                      </p>
                    </div>
                    <div className="pt-2 flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setActiveTab("listed-items")}
                        className="text-xs font-semibold"
                      >
                        View Listed Items
                      </Button>
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                      >
                        <span>Open on {tender.sourcePortal}</span>
                        <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-border/70 overflow-hidden bg-card/50 shadow-2xs min-w-0">
                      <Table className="w-full table-fixed min-w-[620px] md:min-w-full">
                        <TableHeader className="bg-muted/40 text-xs">
                          <TableRow className="border-b border-border/60">
                            <TableHead className="w-16 text-center font-semibold text-xs py-3">Doc #</TableHead>
                            <TableHead className="font-semibold text-xs py-3">Document File & Specification</TableHead>
                            <TableHead className="w-24 text-center font-semibold text-xs py-3">Format</TableHead>
                            <TableHead className="w-28 text-center font-semibold text-xs py-3">Access Status</TableHead>
                            <TableHead className="w-44 text-right font-semibold text-xs py-3 pr-4">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs sm:text-sm divide-y divide-border/40">
                          {attachedDocs
                            .filter((doc) => !(doc.fileName || doc.title || "").toLowerCase().endsWith(".html"))
                            .map((doc, dIdx) => {
                              const isSelected = previewDocIndex === dIdx;
                              const isDocx = (doc.fileName || "").toLowerCase().endsWith(".docx");

                              return (
                                <TableRow
                                  key={dIdx}
                                  className={`transition-colors hover:bg-muted/40 ${isSelected ? "bg-primary/5 dark:bg-primary/10" : ""}`}
                                >
                                  {/* Column 1: Doc Number */}
                                  <TableCell className="text-center font-mono font-bold text-xs text-muted-foreground align-middle py-3">
                                    <span className="inline-block px-1.5 py-0.5 rounded bg-muted/60 text-foreground">
                                      #{(dIdx + 1).toString().padStart(2, "0")}
                                    </span>
                                  </TableCell>

                                  {/* Column 2: Document File & Specification */}
                                  <TableCell className="whitespace-normal align-middle py-3">
                                    <div className="flex items-start gap-3 min-w-0">
                                      <div
                                        className={`flex size-9 shrink-0 items-center justify-center rounded-lg border text-xs font-bold font-mono shadow-2xs ${
                                          isDocx
                                            ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
                                            : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                                        }`}
                                      >
                                        <FileText className="size-4" />
                                      </div>
                                      <div className="space-y-0.5 min-w-0">
                                        <p className="font-semibold text-xs sm:text-sm text-foreground break-all leading-tight">
                                          {doc.fileName || doc.title || `Tender_Doc_${dIdx + 1}.pdf`}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                            <CheckCircle2 className="size-3" /> Public Statutory Spec
                                          </span>
                                          <span>•</span>
                                          <span>Direct Downloadable</span>
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>

                                  {/* Column 3: Format */}
                                  <TableCell className="text-center align-middle py-3">
                                    <Badge
                                      variant="outline"
                                      className="font-mono text-[10px] uppercase font-bold tracking-wider"
                                    >
                                      {isDocx ? "DOCX SPEC" : "PDF SPEC"}
                                    </Badge>
                                  </TableCell>

                                  {/* Column 4: Access Status */}
                                  <TableCell className="text-center align-middle py-3">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                      Direct Public
                                    </span>
                                  </TableCell>

                                  {/* Column 5: Actions */}
                                  <TableCell className="text-right align-middle py-3 pr-4">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <Button
                                        size="xs"
                                        variant={isSelected ? "default" : "outline"}
                                        onClick={() => setPreviewDocIndex(dIdx)}
                                        className="gap-1 text-xs font-semibold h-7 px-2"
                                      >
                                        <Eye className="size-3" />
                                        <span>{isSelected ? "Viewing" : "Preview"}</span>
                                      </Button>

                                      <Button
                                        size="xs"
                                        variant="outline"
                                        onClick={() => handleAnalyzeDocument(doc)}
                                        className="gap-1 text-xs font-semibold h-7 px-2 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                                      >
                                        <Sparkles className="size-3" />
                                        <span>Analyze</span>
                                      </Button>

                                      <a
                                        href={doc.downloadUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download={doc.fileName || true}
                                        className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs h-7"
                                      >
                                        <Download className="size-3" />
                                        <span>Download</span>
                                      </a>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Inline Document Preview Box */}
                    {attachedDocs.length > 0 && currentPreviewDoc?.downloadUrl && (
                      <div className="space-y-2.5 pt-2 min-w-0">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              <FileText className="size-3.5" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-semibold text-xs sm:text-sm text-foreground truncate flex items-center gap-1.5">
                                <span>Inline Official Document Preview</span>
                                <Badge variant="outline" className="text-[10px] font-mono px-1 py-0">
                                  Doc {previewDocIndex + 1} of {attachedDocs.length}
                                </Badge>
                              </h4>
                              <p className="text-[11px] font-mono text-muted-foreground truncate">
                                {currentPreviewDoc.fileName || currentPreviewDoc.title || "Tender_Document.pdf"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {attachedDocs.length > 1 && (
                              <div className="flex items-center gap-1 border border-border/60 rounded-lg p-0.5 bg-muted/40">
                                {attachedDocs.map((_, idx) => (
                                  <Button
                                    key={idx}
                                    size="xs"
                                    variant={previewDocIndex === idx ? "default" : "ghost"}
                                    onClick={() => setPreviewDocIndex(idx)}
                                    className="h-7 px-2 text-[11px] font-mono font-bold"
                                  >
                                    Doc {idx + 1}
                                  </Button>
                                ))}
                              </div>
                            )}

                            <a
                              href={currentPreviewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-2xs"
                            >
                              <ExternalLink className="size-3.5 text-primary" />
                              <span>Open in New Tab</span>
                            </a>

                            <a
                              href={currentPreviewDoc.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors shadow-2xs"
                            >
                              <Download className="size-3.5" />
                              <span>Download PDF</span>
                            </a>
                          </div>
                        </div>

                        {/* PDF Previewer Iframe */}
                        <div className="relative rounded-xl border border-border/80 overflow-hidden bg-muted/10 h-[520px] sm:h-[620px] shadow-sm">
                          <iframe
                            src={`${currentPreviewUrl}#toolbar=1&view=FitH`}
                            className="w-full h-full border-0"
                            title="Official Document Viewer"
                          />
                        </div>

                        <p className="text-[11px] text-muted-foreground text-center">
                          Direct official document extracted from {tender.sourcePortal || "official government gazette"}
                          . If your browser does not display the PDF preview above, please use the{" "}
                          <a
                            href={currentPreviewDoc.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline font-medium"
                          >
                            Direct Download
                          </a>{" "}
                          button to view locally.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            )}

            {/* TAB 3: SCOPE OF WORKS */}
            <TabsContent
              value="scope"
              className="space-y-5 rounded-xl border border-border/60 bg-card p-4 sm:p-6 min-w-0"
            >
              {isWorldBank ? (
                <div className="space-y-6 min-w-0">
                  {/* Overview Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/50 min-w-0">
                    <div className="space-y-0.5 min-w-0">
                      <h3 className="font-bold text-xl sm:text-2xl tracking-tight text-foreground">Overview</h3>
                      <p className="text-xs text-muted-foreground">
                        Official procurement notice parameters and borrower contact information
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-xs font-semibold bg-primary/10 text-primary border-primary/25 shrink-0"
                    >
                      World Bank Procurement Notice
                    </Badge>
                  </div>

                  {/* 1. NOTICE AT-A-GLANCE */}
                  <div className="rounded-lg overflow-hidden border border-border/70 bg-card shadow-xs min-w-0">
                    <div className="bg-[#474747] dark:bg-[#282828] text-white px-4 py-2.5 font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-between">
                      <span>NOTICE AT-A-GLANCE</span>
                      <span className="text-[11px] font-normal text-white/80 font-mono">
                        Notice: {wbNotice.noticeNo}
                      </span>
                    </div>

                    <div className="p-4 sm:p-6 space-y-5 bg-card min-w-0">
                      {/* Row 1: Project ID, Project Title, Country, Notice No */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 min-w-0">
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Project ID</span>
                          <p className="text-xs sm:text-sm font-mono font-medium text-muted-foreground break-all">
                            {wbNotice.projectId}
                          </p>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Project Title</span>
                          <p className="text-xs sm:text-sm font-medium text-foreground/90 leading-snug break-words">
                            {wbNotice.projectTitle}
                          </p>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Country</span>
                          <p className="text-xs sm:text-sm text-muted-foreground">{wbNotice.country}</p>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Notice No</span>
                          <p className="text-xs sm:text-sm font-mono font-semibold text-primary break-all">
                            {wbNotice.noticeNo}
                          </p>
                        </div>
                      </div>

                      <div className="h-px bg-border/40 w-full" />

                      {/* Row 2: Notice Type, Notice Status, Borrower Bid Reference, Procurement Method */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 min-w-0">
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Notice Type</span>
                          <p className="text-xs sm:text-sm text-muted-foreground break-words">{wbNotice.noticeType}</p>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Notice Status</span>
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="size-3 shrink-0" />
                              {wbNotice.noticeStatus}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Borrower Bid Reference</span>
                          <p className="text-xs sm:text-sm font-mono text-muted-foreground break-all">
                            {wbNotice.borrowerBidReference}
                          </p>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Procurement Method</span>
                          <p className="text-xs sm:text-sm text-muted-foreground break-words">
                            {wbNotice.procurementMethod}
                          </p>
                        </div>
                      </div>

                      <div className="h-px bg-border/40 w-full" />

                      {/* Row 3: Language of Notice, Submission Deadline Date/Time, Published Date */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 min-w-0">
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Language of Notice</span>
                          <p className="text-xs sm:text-sm text-muted-foreground">{wbNotice.language}</p>
                        </div>
                        <div className="space-y-1 min-w-0 sm:col-span-1 lg:col-span-2">
                          <span className="text-xs font-bold text-foreground block">Submission Deadline Date/Time</span>
                          <p className="text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                            <Clock className="size-3.5 shrink-0" />
                            <span>{wbNotice.submissionDeadline}</span>
                          </p>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Published Date</span>
                          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
                            <Calendar className="size-3.5 shrink-0" />
                            <span>{wbNotice.publishedDate}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. CONTACT INFORMATION */}
                  <div className="rounded-lg overflow-hidden border border-border/70 bg-card shadow-xs min-w-0">
                    <div className="bg-[#474747] dark:bg-[#282828] text-white px-4 py-2.5 font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-between">
                      <span>CONTACT INFORMATION</span>
                      <Building2 className="size-4 text-white/80" />
                    </div>

                    <div className="p-4 sm:p-6 space-y-5 bg-card min-w-0">
                      {/* Row 1: Organization/Department, Name, Address, City */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 min-w-0">
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Organization/Department</span>
                          <p className="text-xs sm:text-sm font-medium text-foreground/90 leading-snug break-words">
                            {wbContact.organization}
                          </p>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Name</span>
                          <p className="text-xs sm:text-sm text-muted-foreground break-words">{wbContact.name}</p>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Address</span>
                          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed break-words">
                            {wbContact.address}
                          </p>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">City</span>
                          <p className="text-xs sm:text-sm text-muted-foreground">{wbContact.city}</p>
                        </div>
                      </div>

                      <div className="h-px bg-border/40 w-full" />

                      {/* Row 2: Province/State, Postal Code, Country, Phone */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 min-w-0">
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Province/State</span>
                          <p className="text-xs sm:text-sm text-muted-foreground">{wbContact.province}</p>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Postal Code</span>
                          <p className="text-xs sm:text-sm text-muted-foreground">{wbContact.postalCode || "—"}</p>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Country</span>
                          <p className="text-xs sm:text-sm text-muted-foreground">{wbContact.country}</p>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Phone</span>
                          {wbContact.phone && wbContact.phone !== "—" ? (
                            <a
                              href={`tel:${wbContact.phone}`}
                              className="text-xs sm:text-sm font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                            >
                              <Phone className="size-3.5 text-primary shrink-0" />
                              <span>{wbContact.phone}</span>
                            </a>
                          ) : (
                            <p className="text-xs sm:text-sm text-muted-foreground">—</p>
                          )}
                        </div>
                      </div>

                      <div className="h-px bg-border/40 w-full" />

                      {/* Row 3: Email, Website */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 min-w-0">
                        <div className="space-y-1 min-w-0 sm:col-span-2">
                          <span className="text-xs font-bold text-foreground block">Email</span>
                          {wbContact.email ? (
                            <a
                              href={`mailto:${wbContact.email}`}
                              className="text-xs sm:text-sm font-semibold text-primary hover:underline flex items-center gap-1.5 break-all"
                            >
                              <Mail className="size-3.5 text-primary shrink-0" />
                              <span>{wbContact.email}</span>
                            </a>
                          ) : (
                            <p className="text-xs sm:text-sm text-muted-foreground">—</p>
                          )}
                        </div>
                        <div className="space-y-1 min-w-0 sm:col-span-2">
                          <span className="text-xs font-bold text-foreground block">Website</span>
                          {wbContact.website ? (
                            <a
                              href={
                                wbContact.website.startsWith("http")
                                  ? wbContact.website
                                  : `https://${wbContact.website}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs sm:text-sm font-semibold text-primary hover:underline flex items-center gap-1.5 break-all"
                            >
                              <Globe className="size-3.5 text-primary shrink-0" />
                              <span>{wbContact.website}</span>
                            </a>
                          ) : (
                            <p className="text-xs sm:text-sm text-muted-foreground">—</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. DETAILS */}
                  <div className="space-y-3 min-w-0 pt-2">
                    <h3 className="font-bold text-xl sm:text-2xl tracking-tight text-foreground">Details</h3>
                    <div className="rounded-lg border border-border/70 bg-muted/15 p-5 sm:p-7 min-w-0">
                      {wbHtmlContent ? (
                        <div
                          className="text-xs sm:text-sm text-foreground/90 space-y-3 leading-relaxed [&_p]:mb-3 [&_strong]:text-foreground [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 break-words"
                          dangerouslySetInnerHTML={{ __html: sanitizeWorldBankHtml(wbHtmlContent) }}
                        />
                      ) : (
                        <div className="text-xs sm:text-sm text-foreground/90 space-y-3 leading-relaxed whitespace-pre-line break-words">
                          {wbTextContent ||
                            "Detailed specifications are outlined in the official World Bank procurement dossier."}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Official Source Link Card */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs sm:text-sm min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Globe className="size-4 text-primary shrink-0" />
                      <span className="min-w-0 truncate">
                        Official World Bank Portal:{" "}
                        <strong className="font-mono text-foreground break-all">{portalUrl}</strong>
                      </span>
                    </div>
                    <a
                      href={portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      Open Official World Bank Portal <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </div>
              ) : isUnitedNations ? (
                <div className="space-y-6 min-w-0">
                  {/* UN Overview Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/50 min-w-0">
                    <div className="space-y-0.5 min-w-0">
                      <h3 className="font-bold text-xl sm:text-2xl tracking-tight text-foreground">
                        United Nations Procurement Overview
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Official solicitation notice parameters, vendor registration requirements, and EOI instructions
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-xs font-semibold bg-[#0072bc]/10 text-[#0072bc] dark:text-[#4da3ff] border-[#0072bc]/25 shrink-0"
                    >
                      United Nations Procurement Notice
                    </Badge>
                  </div>

                  {/* 1. UN NOTICE AT-A-GLANCE */}
                  <div className="rounded-lg overflow-hidden border border-border/70 bg-card shadow-xs min-w-0">
                    <div className="bg-[#0072bc] dark:bg-[#005a96] text-white px-4 py-2.5 font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-between">
                      <span>UN NOTICE AT-A-GLANCE</span>
                      <span className="text-[11px] font-normal text-white/90 font-mono">Ref: {tender.refNo}</span>
                    </div>

                    <div className="p-4 sm:p-6 space-y-5 bg-card min-w-0">
                      {/* Row 1: Ref No, Procuring Entity, Country/Region, Procurement Type */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 min-w-0">
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Reference / Bid No</span>
                          <p className="text-xs sm:text-sm font-mono font-semibold text-primary break-all">
                            {tender.refNo}
                          </p>
                        </div>
                        <div className="space-y-1 min-w-0 sm:col-span-1 lg:col-span-2">
                          <span className="text-xs font-bold text-foreground block">Procuring Organization</span>
                          <p className="text-xs sm:text-sm font-medium text-foreground/90 leading-snug break-words">
                            {liveDetails?.procuringEntity || tender.procuringEntity}
                          </p>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Duty Station / Country</span>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {tender.countryName || "Global / International"}
                          </p>
                        </div>
                      </div>

                      <div className="h-px bg-border/40 w-full" />

                      {/* Row 2: Procurement Method, Commodity Group, Notice Status, Submission Deadline */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 min-w-0">
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Solicitation Type</span>
                          <p className="text-xs sm:text-sm text-muted-foreground break-words">
                            {tender.procurementMethod || tender.procurementType || "Expression of Interest (EOI)"}
                          </p>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Commodity Group</span>
                          <p className="text-xs sm:text-sm text-muted-foreground break-words">
                            {tender.category || "General Procurement"}
                          </p>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Notice Status</span>
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="size-3 shrink-0" />
                              {tender.status || "Active"}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-1 min-w-0">
                          <span className="text-xs font-bold text-foreground block">Submission Deadline</span>
                          <p className="text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                            <Clock className="size-3.5 shrink-0" />
                            <span>
                              {tender.closingDate
                                ? new Date(tender.closingDate).toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "See UNGM Notice"}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. VENDOR INSTRUCTIONS & PARTICIPATION NOTICE */}
                  <div className="rounded-lg border border-[#0072bc]/30 bg-[#0072bc]/5 dark:bg-[#0072bc]/10 p-4 sm:p-5 space-y-2 min-w-0">
                    <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-[#0072bc] dark:text-[#4da3ff]">
                      <Building2 className="size-4 shrink-0" />
                      <span>VENDOR PARTICIPATION & SUBMISSION NOTICE</span>
                    </div>
                    <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                      Vendors intending to participate in this solicitation must be registered with the{" "}
                      <strong>United Nations Global Marketplace (UNGM)</strong> at{" "}
                      <a
                        href="https://www.ungm.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline font-medium"
                      >
                        www.ungm.org
                      </a>
                      . All Expressions of Interest (EOI) and proposal submissions are managed electronically via the
                      official UN Procurement portal or UNGM system.
                    </p>
                  </div>

                  {/* 3. DETAILS & SPECIFICATIONS */}
                  <div className="space-y-3 min-w-0 pt-2">
                    <h3 className="font-bold text-xl sm:text-2xl tracking-tight text-foreground">
                      Specifications & Scope of Requirements
                    </h3>
                    <div className="rounded-lg border border-border/70 bg-muted/15 p-5 sm:p-7 min-w-0">
                      <div className="text-xs sm:text-sm text-foreground/90 space-y-3 leading-relaxed whitespace-pre-line break-words">
                        {liveDetails?.description ||
                          tender.description ||
                          "Detailed specifications are outlined in the official UN procurement dossier."}
                      </div>
                    </div>
                  </div>

                  {/* 4. Official UN Source Link Card */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs sm:text-sm min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Globe className="size-4 text-primary shrink-0" />
                      <span className="min-w-0 truncate">
                        Official Portal: <strong className="font-mono text-foreground break-all">{portalUrl}</strong>
                      </span>
                    </div>
                    <a
                      href={portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      Open Official UNGM / UN Portal <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </div>
              ) : isZppa ? (
                <ZppaDetailViewer
                  tender={tender}
                  liveDetails={liveDetails}
                  onAnalyzeWithAi={() => handleAnalyzeDocument()}
                />
              ) : isGoZambia ? (
                <GoZambiaScopeViewer
                  tender={tender}
                  liveDetails={liveDetails}
                  onAnalyzeWithAi={() => handleAnalyzeDocument()}
                />
              ) : (
                /* Non-World Bank default view */
                <>
                  <div className="space-y-3 min-w-0">
                    <h3 className="font-semibold text-base sm:text-lg text-foreground">
                      Project Scope & Procurement Parameters
                    </h3>
                    <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
                      The procuring entity,{" "}
                      <strong className="text-foreground">
                        {liveDetails?.procuringEntity || tender.procuringEntity}
                      </strong>
                      , invites eligible suppliers and registered consortia to tender for:{" "}
                      <span className="font-medium text-foreground">{liveDetails?.projectName || tender.title}</span>.
                    </p>
                    {(liveDetails?.description || tender.description) && (
                      <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-xs sm:text-sm text-foreground space-y-2 leading-relaxed min-w-0">
                        <div className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
                          Official Gazette Description & Tender Specifications
                        </div>
                        <p className="text-foreground/90 whitespace-pre-line break-words">
                          {liveDetails?.description || tender.description}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4 sm:gap-4 min-w-0">
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-3.5 space-y-1 min-w-0 overflow-hidden">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">Bid Validity</span>
                      <p className="font-mono font-medium text-sm text-foreground truncate">{bidValidity}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-3.5 space-y-1 min-w-0 overflow-hidden">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">Delivery Window</span>
                      <p className="font-mono font-medium text-sm text-foreground truncate">{deliveryPeriod}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-3.5 space-y-1 min-w-0 overflow-hidden">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">Funding Source</span>
                      <p className="font-mono font-medium text-sm text-foreground truncate">{fundingSource}</p>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-3.5 space-y-1 min-w-0 overflow-hidden">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                        Delivery Location
                      </span>
                      <p className="font-mono font-medium text-sm text-foreground truncate">{deliveryLocation}</p>
                    </div>
                  </div>

                  {/* Official Source Link Card */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3.5 text-xs sm:text-sm min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Globe className="size-4 text-primary shrink-0" />
                      <span className="min-w-0 truncate">
                        Official Portal URL:{" "}
                        <strong className="font-mono text-foreground break-all">{portalUrl}</strong>
                      </span>
                    </div>
                    <a
                      href={portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      Open Source Portal <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </>
              )}
            </TabsContent>

            {/* TAB: MATCHED SOURCING SUPPLIERS (LOCAL DIRECTORY + INTERNATIONAL SUGGESTIONS) */}
            <TabsContent value="matched-suppliers" className="min-w-0">
              <MatchedSuppliersTab
                tender={tender}
                lineItems={lineItems}
                supplierProfiles={supplierProfiles}
                onRequestRfq={(target) => setSelectedSupplierRfq(target)}
              />
            </TabsContent>

            {/* TAB 4: DEEP AI INTELLIGENCE & DOCUMENT / SCOPE OF WORK ANALYSIS */}
            <TabsContent
              value="ai-recommendation"
              className="space-y-5 rounded-xl border border-emerald-500/25 bg-card p-5 sm:p-6"
            >
              {/* Loading AI State */}
              {isAnalyzing && (
                <div className="py-12 text-center space-y-4">
                  <div className="flex size-14 mx-auto items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 animate-pulse">
                    <Bot className="size-7" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-lg text-foreground">
                      {attachedDocs.length === 0
                        ? "Gemini 2.5 Flash is Analyzing Scope of Work"
                        : "Gemini 2.5 Flash is Analyzing Tender Documents"}
                    </h4>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      {attachedDocs.length === 0
                        ? `Extracting statutory checklist, technical scoring matrix, payment terms, and competitive win-strategy from Scope of Work for ${tender.title}...`
                        : `Extracting statutory checklist, technical scoring matrix, payment terms, and competitive win-strategy for ${analyzedDocName}...`}
                    </p>
                  </div>
                  <div className="flex justify-center gap-2 pt-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs text-emerald-600">
                      <Loader2 className="size-3 animate-spin" />
                      {attachedDocs.length === 0 ? "Ingesting Scope & Gazette Clauses" : "Ingesting Gazette Clauses"}
                    </span>
                  </div>
                </div>
              )}

              {/* Empty State: Prompt User to Run Analysis */}
              {!isAnalyzing && !analysisResult && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center space-y-4">
                  <div className="flex size-12 mx-auto items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="size-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-base sm:text-lg text-foreground">
                      {attachedDocs.length === 0
                        ? "Ready for Deep AI Scope of Work Analysis"
                        : "Ready for Deep AI Document Analysis"}
                    </h4>
                    <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto">
                      {attachedDocs.length === 0
                        ? "Click the button below to send this tender's Scope of Work, technical requirements, and gazetted parameters to Google Gemini 2.5 Flash for a full statutory breakdown, evaluation matrix, and win-strategy."
                        : "Click the button below to send this tender notice and all attached gazetted documents to Google Gemini 2.5 Flash for a full statutory breakdown, evaluation matrix, and win-strategy."}
                    </p>
                  </div>

                  <Button
                    size="default"
                    onClick={() => handleAnalyzeDocument()}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm px-5 py-2.5 shadow-md"
                  >
                    <Bot className="size-4" />
                    {attachedDocs.length === 0 ? "Run Deep AI Scope of Work Analysis" : "Run Deep AI Document Analysis"}
                  </Button>
                </div>
              )}

              {/* Active Analysis Result */}
              {!isAnalyzing && analysisResult && (
                <div className="space-y-5">
                  {/* Header Banner with Bid Recommendation */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                        <Award className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-sm uppercase text-emerald-600 dark:text-emerald-400">
                            {analysisResult.bidDecision === "STRONG_BID"
                              ? "Recommended: STRONG BID"
                              : analysisResult.bidDecision === "CONDITIONAL_BID"
                                ? "Recommended: CONDITIONAL BID"
                                : "Recommended: REVIEW CAUTION"}
                          </span>
                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                            {analysisResult.aiFitScore}% Fit
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {attachedDocs.length === 0 ? "Source Analyzed:" : "Document Analyzed:"}{" "}
                          <strong className="text-foreground">{analysisResult.fileName}</strong>
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAnalyzeDocument()}
                      className="gap-1.5 text-xs font-semibold shrink-0 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                    >
                      <RefreshCw className="size-3" />
                      {attachedDocs.length === 0 ? "Re-analyze Scope" : "Re-Analyze"}
                    </Button>
                  </div>

                  {/* 1. Executive Summary */}
                  <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4 sm:p-5">
                    <h4 className="font-semibold text-sm sm:text-base text-foreground flex items-center gap-2">
                      <FileText className="size-4 text-primary" />
                      <span>Executive Summary & Project Context</span>
                    </h4>
                    <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                      {formatAnalysisText(analysisResult.executiveSummary)}
                    </p>
                  </div>

                  {/* 2. Required Items in Detail & Linked Supplier Suggestions */}
                  <div className="space-y-4 rounded-xl border border-border/70 bg-card p-4 sm:p-5 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Package className="size-4 text-primary" />
                          <h4 className="font-bold text-sm sm:text-base text-foreground">
                            Required Items & Technical Bill of Quantities (BoQ)
                          </h4>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono border-primary/30 text-primary bg-primary/5"
                          >
                            {analyzedRequiredItems.length} Detailed Items Extracted
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Detailed item specifications extracted from bidding dossier and linked to verified sourcing
                          suppliers.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs">
                          <CheckCircle2 className="size-3 mr-1" /> Sourcing Matches Linked
                        </Badge>
                      </div>
                    </div>

                    {/* List of Detailed Required Items */}
                    <div className="space-y-4">
                      {analyzedRequiredItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-border/70 bg-muted/15 p-4 space-y-3.5 transition-all hover:border-border"
                        >
                          {/* Top: Item Title, Lot No, Quantity & Total Cost */}
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                  Item #{item.itemNumber || idx + 1}
                                </span>
                                <h5 className="font-bold text-sm text-foreground">{item.itemName}</h5>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                <span>
                                  Quantity:{" "}
                                  <strong className="text-foreground">
                                    {item.quantity} {item.unit}
                                  </strong>
                                </span>
                                {item.estimatedUnitCost && (
                                  <span>
                                    Est. Unit:{" "}
                                    <strong className="text-foreground font-mono">
                                      {formatCurrency(item.estimatedUnitCost, { noDecimals: true })}
                                    </strong>
                                  </span>
                                )}
                                {item.totalEstimatedCost && (
                                  <span>
                                    Total Est:{" "}
                                    <strong className="text-foreground font-mono">
                                      {formatCurrency(item.totalEstimatedCost, { noDecimals: true })}
                                    </strong>
                                  </span>
                                )}
                              </div>
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                const copied = await copyTextToClipboard(
                                  `Item: ${item.itemName}\nQuantity: ${item.quantity} ${item.unit}\nSpecifications: ${item.specifications}\nStandards: ${item.complianceStandards}`,
                                );
                                if (copied) {
                                  toast.success("Specifications Copied to Clipboard", {
                                    description: `Copied details for ${item.itemName}`,
                                  });
                                } else {
                                  toast.error("Copy failed. Select and copy the specifications manually.");
                                }
                              }}
                              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground shrink-0"
                            >
                              <Copy className="size-3" /> Copy Specs
                            </Button>
                          </div>

                          {/* Detailed Technical Specifications Box */}
                          <div className="space-y-1">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Required Technical Specifications &amp; Parameters:
                            </span>
                            <div className="p-3 rounded-lg border border-border/60 bg-card text-xs text-foreground/90 font-mono leading-relaxed whitespace-pre-line">
                              {item.specifications}
                            </div>
                            {item.complianceStandards && (
                              <p className="text-[11px] text-muted-foreground">
                                <strong>Mandatory Compliance Standards:</strong>{" "}
                                <span className="text-foreground font-medium">{item.complianceStandards}</span>
                              </p>
                            )}
                          </div>

                          {/* Linked Supplier Suggestions Sub-Section */}
                          <div className="space-y-2 pt-1 border-t border-border/50">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                <Store className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                Country-matched Supplier Suggestions ({(item.suggestedSuppliers || []).length}):
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                Ranked by capability and jurisdiction
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                              {(item.suggestedSuppliers || []).map((sup: any, sIdx: number) => (
                                <div
                                  key={sIdx}
                                  className="rounded-lg border border-border/60 bg-card p-3 space-y-2 text-xs flex flex-col justify-between hover:border-emerald-500/40 hover:shadow-2xs transition-all"
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <p className="font-bold text-foreground flex items-center gap-1">
                                          {sup.supplierName}
                                          {sup.verificationStatus && (
                                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] px-1 py-0 h-4">
                                              {sup.verificationStatus}
                                            </Badge>
                                          )}
                                        </p>
                                        <span className="text-[10px] text-muted-foreground font-medium">
                                          {sup.tier}
                                        </span>
                                      </div>
                                      <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                                        {sup.matchScore}% Match
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground pt-1">
                                      <div className="flex items-center gap-1">
                                        <MapPin className="size-3 shrink-0 text-muted-foreground" />
                                        <span className="truncate" title={sup.location}>
                                          {sup.location}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Clock className="size-3 shrink-0 text-muted-foreground" />
                                        <span className="truncate">{sup.leadTime}</span>
                                      </div>
                                    </div>

                                    {sup.estimatedPrice && (
                                      <div className="flex items-center justify-between text-[11px] bg-muted/40 px-2 py-1 rounded">
                                        <span className="text-muted-foreground">Est. Sourcing Price:</span>
                                        <span className="font-mono font-bold text-foreground">
                                          {formatCurrency(sup.estimatedPrice, { noDecimals: true })}
                                        </span>
                                      </div>
                                    )}

                                    {sup.notes && (
                                      <p className="text-[10px] text-muted-foreground italic leading-tight">
                                        {sup.notes}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                                    {sup.profileHref && (
                                      <Button size="sm" variant="outline" asChild className="h-7 text-xs">
                                        <NextLink href={sup.profileHref}>
                                          <Building2 data-icon="inline-start" />
                                          Profile
                                        </NextLink>
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      onClick={() => setSelectedSupplierRfq({ item, supplier: sup })}
                                      className="flex-1 h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1"
                                    >
                                      <Send className="size-3" /> Request Quote (RFQ)
                                    </Button>
                                    {sup.contactEmail && (
                                      <Button size="sm" variant="outline" asChild className="h-7 text-xs px-2.5">
                                        <a
                                          href={`mailto:${sup.contactEmail}?subject=RFQ%20-%20${encodeURIComponent(item.itemName)}%20(${encodeURIComponent(tender.refNo)})`}
                                          title={`Email ${sup.contactEmail}`}
                                        >
                                          <Mail className="size-3" />
                                        </a>
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3. Mandatory Statutory Checklist & Technical Evaluation Matrix */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Left: Mandatory Checklist */}
                    <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 sm:p-5">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-xs sm:text-sm text-foreground flex items-center gap-2">
                          <ShieldCheck className="size-4 text-emerald-500" />
                          <span>Mandatory Statutory Checklist</span>
                        </h4>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setActiveTab("compliance-checklist")}
                          className="text-xs text-primary hover:underline h-7 px-2"
                        >
                          View Full Checklist →
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {analyzedMandatoryChecklist.map((item, iIdx) => (
                          <div
                            key={iIdx}
                            className="flex items-start justify-between gap-2.5 p-2.5 rounded-lg border border-border/50 bg-muted/20 text-xs"
                          >
                            <div className="space-y-0.5">
                              <p className="font-semibold text-foreground">{item.item}</p>
                              <p className="text-[11px] text-muted-foreground">{item.description}</p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold shrink-0 ${
                                item.status === "Mandatory"
                                  ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                              }`}
                            >
                              {item.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right: Technical Evaluation Matrix */}
                    <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 sm:p-5">
                      <h4 className="font-semibold text-xs sm:text-sm text-foreground flex items-center gap-2">
                        <Scale className="size-4 text-primary" />
                        <span>Technical Evaluation Matrix</span>
                      </h4>
                      <div className="space-y-2">
                        {analyzedEvaluationMatrix.map((crit, cIdx) => (
                          <div
                            key={cIdx}
                            className="flex items-start justify-between gap-2.5 p-2.5 rounded-lg border border-border/50 bg-muted/20 text-xs"
                          >
                            <div className="space-y-0.5">
                              <p className="font-semibold text-foreground">{crit.criterion}</p>
                              <p className="text-[11px] text-muted-foreground">{crit.description}</p>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-mono text-[10px] font-bold shrink-0">
                              {crit.weight}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 3. Commercial Terms & Risk Assessment */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Left: Commercial Terms */}
                    <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 sm:p-5">
                      <h4 className="font-semibold text-xs sm:text-sm text-foreground flex items-center gap-2">
                        <Zap className="size-4 text-amber-500" />
                        <span>Commercial & Payment Terms</span>
                      </h4>
                      <div className="space-y-2 text-xs">
                        {Object.entries(analyzedCommercialTerms).map(([k, v], idx) => (
                          <div key={idx} className="p-2.5 rounded-lg border border-border/50 bg-muted/20 space-y-0.5">
                            <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground">
                              {k.replace(/([A-Z])/g, " $1").trim()}
                            </span>
                            <p className="font-medium text-foreground">{String(v ?? "")}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right: Risk Assessment */}
                    <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 sm:p-5">
                      <h4 className="font-semibold text-xs sm:text-sm text-foreground flex items-center gap-2">
                        <ShieldAlert className="size-4 text-red-500" />
                        <span>Risk Assessment & Traps</span>
                      </h4>
                      <div className="space-y-2">
                        {analyzedRiskAssessment.map((risk, rIdx) => (
                          <div
                            key={rIdx}
                            className="p-2.5 rounded-lg border border-border/50 bg-muted/20 space-y-1 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-foreground">{risk.risk}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded font-mono text-[9px] font-bold ${
                                  risk.severity === "High"
                                    ? "bg-red-500/20 text-red-600 dark:text-red-400"
                                    : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {risk.severity} Risk
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              <strong className="text-foreground">Mitigation:</strong> {risk.mitigation}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 4. Pricing & Win Strategy */}
                  {analysisResult.pricingStrategy && (
                    <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5">
                      <h4 className="font-semibold text-sm sm:text-base text-foreground flex items-center gap-2">
                        <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
                        <span>AI Win-Strategy & Pricing Recommendations</span>
                      </h4>
                      <p className="text-xs sm:text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                        {formatAnalysisText(analysisResult.pricingStrategy)}
                      </p>
                    </div>
                  )}

                  {/* 5. Interactive Document Q&A Section */}
                  <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4 sm:p-5">
                    <h4 className="font-semibold text-xs sm:text-sm text-foreground flex items-center gap-2">
                      <HelpCircle className="size-4 text-primary" />
                      <span>Ask AI About This Document</span>
                    </h4>

                    {qaHistory.length > 0 && (
                      <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                        {qaHistory.map((item, qIdx) => (
                          <div
                            key={qIdx}
                            className="space-y-1.5 p-3 rounded-lg bg-background border border-border/60 text-xs"
                          >
                            <p className="font-semibold text-foreground flex items-center gap-1.5">
                              <span className="text-primary font-mono font-bold">Q:</span> {item.question}
                            </p>
                            <p className="text-muted-foreground leading-relaxed pl-4 border-l-2 border-primary/30 whitespace-pre-line">
                              {item.answer}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    <form onSubmit={handleAskQuestion} className="flex gap-2">
                      <Input
                        placeholder="e.g. Is a joint venture allowed? What is the required bank guarantee percentage?"
                        value={customQuestion}
                        onChange={(e) => setCustomQuestion(e.target.value)}
                        className="text-xs h-9"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={askingQuestion || !customQuestion.trim()}
                        className="gap-1.5 text-xs font-semibold shrink-0 h-9"
                      >
                        {askingQuestion ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                        Ask AI
                      </Button>
                    </form>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 5: COMPLIANCE & SUBMISSION SUITE */}
            <TabsContent value="compliance-checklist" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-w-0">
                {/* LEFT COLUMN: 1. Checklist, 2. Reference Documents, 3. Technical Alignment */}
                <div className="lg:col-span-7 space-y-5 min-w-0">
                  <fieldset
                    disabled={workflowState.locked || workflowState.loading || submissionBusy || !!workflowState.error}
                    className="flex min-w-0 flex-col gap-5"
                  >
                    <CountryChecklistCard
                      key={`${tender.countryCode}:${tender.id || tender.refNo}`}
                      state={checklistState}
                      country={tender.countryCode}
                    />

                    <ReferenceDocumentsCard
                      key={`references:${tender.countryCode}:${tender.id || tender.refNo}`}
                      state={referenceState}
                    />
                  </fieldset>

                  {/* 3. TECHNICAL PROPOSAL ALIGNMENT CARD */}
                  <div className="rounded-xl border border-border/70 bg-card p-4 sm:p-5 space-y-4 shadow-2xs min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/50">
                      <div>
                        <div className="flex items-center gap-2">
                          <Scale className="size-4.5 text-primary" />
                          <h3 className="font-semibold text-base sm:text-lg text-foreground">
                            Technical Proposal Alignment
                          </h3>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {proposalCriteria.length} Mapped
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Map evaluation criteria to proposal sections (Optional).
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {proposalCriteria.length > 0 && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={handleResetCriteria}
                            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <RotateCcw className="size-3" />
                            <span>Reset</span>
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={handleImportCriteriaFromAi}
                          className="gap-1 text-xs"
                        >
                          <Sparkles className="size-3 text-primary" />
                          <span>AI Import</span>
                        </Button>
                        <Button
                          size="xs"
                          onClick={() => setIsAddingCriteria(!isAddingCriteria)}
                          className="gap-1 text-xs font-semibold"
                        >
                          <Plus className="size-3" />
                          <span>Add Criteria</span>
                        </Button>
                      </div>
                    </div>

                    {/* Inline Add Criteria Form */}
                    {isAddingCriteria && (
                      <div className="p-3.5 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            <Scale className="size-3.5 text-primary" />
                            <span>Map Evaluation Criterion</span>
                          </h4>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setIsAddingCriteria(false)}
                            className="text-muted-foreground"
                          >
                            ×
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="sm:col-span-2">
                            <Input
                              placeholder="Criterion (e.g. Technical Methodology & Work Plan)"
                              value={newCritName}
                              onChange={(e) => setNewCritName(e.target.value)}
                              className="text-xs h-8 bg-background"
                            />
                          </div>
                          <div>
                            <Input
                              placeholder="Weight (e.g. 35% or 40 Pts)"
                              value={newCritWeight}
                              onChange={(e) => setNewCritWeight(e.target.value)}
                              className="text-xs h-8 bg-background"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="sm:col-span-2">
                            <Input
                              placeholder="Proposal Section (e.g. Section 3.2 - Delivery Timeline)"
                              value={newCritSection}
                              onChange={(e) => setNewCritSection(e.target.value)}
                              className="text-xs h-8 bg-background"
                            />
                          </div>
                          <div>
                            <Select value={newCritStatus} onValueChange={(v: any) => setNewCritStatus(v)}>
                              <SelectTrigger className="h-8 text-xs bg-background">
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Mapped" className="text-xs">
                                  Mapped
                                </SelectItem>
                                <SelectItem value="Drafted" className="text-xs">
                                  Drafted
                                </SelectItem>
                                <SelectItem value="Ready" className="text-xs">
                                  Ready
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setIsAddingCriteria(false)}
                            className="text-xs"
                          >
                            Cancel
                          </Button>
                          <Button size="xs" onClick={handleSaveCriteria} className="text-xs font-semibold">
                            Save Mapping
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Proposal Criteria List */}
                    {proposalCriteria.length === 0 ? (
                      <div className="p-6 text-center rounded-lg border border-dashed border-border/70 bg-muted/10 space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          Add proposal documents or initialize with evaluation criteria.
                        </p>
                        <p className="text-[11px] text-muted-foreground/70">
                          Click &quot;AI Import&quot; to automatically extract the RFP scoring matrix and link proposal
                          sections.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {proposalCriteria.map((crit) => (
                          <div
                            key={crit.id}
                            className="flex items-start justify-between gap-2.5 p-3 rounded-lg border border-border/60 bg-background text-xs"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{crit.criterion}</span>
                                <span className="px-1.5 py-0.2 rounded font-mono text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                                  {crit.weight}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground font-mono">
                                Mapped to: <strong className="text-foreground">{crit.proposalSection}</strong>
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  crit.status === "Ready"
                                    ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5"
                                    : crit.status === "Drafted"
                                      ? "text-amber-500 border-amber-500/30 bg-amber-500/5"
                                      : "text-blue-500 border-blue-500/30 bg-blue-500/5"
                                }`}
                              >
                                {crit.status}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => handleDeleteCriteria(crit.id)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-5 min-w-0">
                  <ApprovalWorkflowCard
                    key={`approval:${tender.countryCode}:${tender.id || tender.refNo}`}
                    submission={workflowState.submission}
                    profile={checklistState.profile}
                    loading={workflowState.loading || checklistState.loading}
                    error={workflowState.error}
                    submit={
                      checklistState.instance
                        ? {
                            checklistId: checklistState.instance.id,
                            tenderRef: liveDetails?.tenderReferenceNumber || tender.refNo || tender.id,
                            tenderTitle: tender.title,
                            entity: liveDetails?.procuringEntity || tender.procuringEntity || "",
                          }
                        : undefined
                    }
                    blockedReason={submissionBlocked}
                    showDocuments={workflowState.locked}
                    onChange={workflowState.update}
                    onRefresh={workflowState.refresh}
                    onBusyChange={setSubmissionBusy}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Modal Action Footer */}
          <div className="flex flex-col-reverse gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/60">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
              Close
            </Button>

            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Globe className="size-3.5 text-primary" />
                <span>Official Portal</span>
                <ExternalLink className="size-3 text-muted-foreground" />
              </a>

              <Button
                variant="outline"
                size="sm"
                onClick={attachedDocs.length > 1 ? handleDownloadAllDocs : handleDownloadSpecPdf}
                className="gap-1.5 text-xs font-medium hover:bg-muted"
              >
                <Download className="size-3.5" />
                {attachedDocs.length > 1
                  ? `Download Documents (${attachedDocs.length} Files)`
                  : "Download Tender Spec (PDF)"}
              </Button>

              <Button
                size="sm"
                onClick={handleAddToPipeline}
                disabled={isAddingToPipeline || pipelineAdded}
                className={`gap-1.5 text-xs font-semibold ${
                  pipelineAdded ? "bg-emerald-600 hover:bg-emerald-600 text-white cursor-default" : ""
                }`}
              >
                {isAddingToPipeline ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Adding to Pipeline...</span>
                  </>
                ) : pipelineAdded ? (
                  <>
                    <Check className="size-3.5" />
                    <span>Tracked in Pipeline</span>
                  </>
                ) : (
                  <>
                    <Kanban className="size-3.5" />
                    <span>Track in Pipeline</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Supplier RFQ Generator Dialog */}
      <Dialog open={selectedSupplierRfq !== null} onOpenChange={(open) => !open && setSelectedSupplierRfq(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 gap-0">
          <div className="p-5 border-b border-border/70 bg-muted/20 shrink-0">
            <div className="flex items-center justify-between gap-2 pr-6">
              <div className="space-y-1">
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs">
                  Request for Quotation (RFQ)
                </Badge>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Send RFQ to {selectedSupplierRfq?.supplier.supplierName}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Pre-populated with official technical specifications and quantities from {tender.title}.
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border/60 bg-muted/20">
              <div>
                <span className="text-muted-foreground text-[11px] block">Target Supplier:</span>
                <span className="font-bold text-foreground">{selectedSupplierRfq?.supplier.supplierName}</span>
                <span className="text-muted-foreground block text-[10px]">
                  {selectedSupplierRfq?.supplier.contactEmail}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] block">Tender Reference:</span>
                <span className="font-mono font-bold text-foreground">{tender.refNo}</span>
                <span className="text-muted-foreground block text-[10px]">{tender.procuringEntity}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Item &amp; Specifications Requested:</label>
              <div className="p-3 rounded-lg border border-border/60 bg-card font-mono text-[11px] leading-relaxed space-y-1">
                <p className="font-bold text-foreground">{selectedSupplierRfq?.item.itemName}</p>
                <p className="text-muted-foreground">
                  Quantity: {selectedSupplierRfq?.item.quantity} {selectedSupplierRfq?.item.unit}
                </p>
                <p className="text-muted-foreground">Required Specs: {selectedSupplierRfq?.item.specifications}</p>
                <p className="text-muted-foreground">Compliance: {selectedSupplierRfq?.item.complianceStandards}</p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-foreground">Generated RFQ Email Message:</label>
              <textarea
                readOnly
                rows={6}
                value={`Dear Sales Team at ${selectedSupplierRfq?.supplier.supplierName},

We are preparing a formal bid submission for "${tender.title}" (Ref: ${tender.refNo}) issued by ${tender.procuringEntity}.

Please provide your most competitive commercial quotation, lead time, and manufacturer authorization for the following item:

- Item: ${selectedSupplierRfq?.item.itemName}
- Quantity: ${selectedSupplierRfq?.item.quantity} ${selectedSupplierRfq?.item.unit}
- Technical Specs: ${selectedSupplierRfq?.item.specifications}
- Required Standards: ${selectedSupplierRfq?.item.complianceStandards}
- Required Delivery: Prior to ${tender.closingDate}

Kindly confirm warranty terms and availability of type-test certifications.

Best regards,
Procurement & Bidding Department`}
                className="w-full rounded-lg border border-border/70 bg-muted/30 p-2.5 font-mono text-[11px] text-foreground focus:outline-hidden"
              />
            </div>
          </div>

          <div className="p-3 px-5 border-t border-border/70 bg-muted/20 flex items-center justify-between shrink-0">
            <Button size="sm" variant="outline" onClick={() => setSelectedSupplierRfq(null)} className="h-8 text-xs">
              Close
            </Button>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const emailBody = `Dear Sales Team at ${selectedSupplierRfq?.supplier.supplierName},\n\nWe are preparing a formal bid submission for "${tender.title}" (Ref: ${tender.refNo}) issued by ${tender.procuringEntity}.\n\nPlease provide your quotation for:\n- Item: ${selectedSupplierRfq?.item.itemName}\n- Quantity: ${selectedSupplierRfq?.item.quantity} ${selectedSupplierRfq?.item.unit}\n- Specs: ${selectedSupplierRfq?.item.specifications}\n- Standards: ${selectedSupplierRfq?.item.complianceStandards}\n\nBest regards,\nBidding Department`;
                  const copied = await copyTextToClipboard(emailBody);
                  if (copied) toast.success("RFQ Draft Copied to Clipboard");
                  else toast.error("Copy failed. Select and copy the RFQ draft manually.");
                }}
                className="h-8 text-xs gap-1"
              >
                <Copy className="size-3.5" /> Copy RFQ Draft
              </Button>
              {selectedSupplierRfq?.supplier.contactEmail && (
                <Button size="sm" asChild className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
                  <a
                    href={`mailto:${selectedSupplierRfq.supplier.contactEmail}?subject=${encodeURIComponent(`RFQ: ${selectedSupplierRfq.item.itemName} - Ref ${tender.refNo}`)}&body=${encodeURIComponent(`Dear Sales Team,\n\nPlease quote on:\nItem: ${selectedSupplierRfq.item.itemName}\nQuantity: ${selectedSupplierRfq.item.quantity} ${selectedSupplierRfq.item.unit}\nSpecs: ${selectedSupplierRfq.item.specifications}`)}`}
                  >
                    <Mail className="size-3.5" /> Open in Email
                  </a>
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
