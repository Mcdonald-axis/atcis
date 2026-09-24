"use client";

import React, { useMemo } from "react";
import {
  Building2,
  Calendar,
  Clock,
  Download,
  ExternalLink,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Gavel,
  Globe,
  Hash,
  HelpCircle,
  Layers,
  Percent,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TenderItem } from "@/app/(main)/dashboard/default/_components/tender-data";

interface ZppaDetailViewerProps {
  tender: TenderItem;
  liveDetails?: any;
  onAnalyzeWithAi?: () => void;
}

export function ZppaDetailViewer({ tender, liveDetails, onAnalyzeWithAi }: ZppaDetailViewerProps) {
  // Aggregate fields from liveDetails and tender payload
  const details = liveDetails || {};
  const payload = (tender as any) || {};

  const cleanResourceId = useMemo(() => {
    return (
      details.resourceId ||
      payload.resourceId ||
      payload.tenderId ||
      (tender.id || "").replace(/^zppa:/i, "")
    );
  }, [details, payload, tender.id]);

  const rawFields: Record<string, string> = useMemo(() => {
    return details.rawFields || payload.rawFields || {};
  }, [details, payload]);

  const appReferenceNumber =
    details.appReferenceNumber ||
    payload.appReferenceNumber ||
    rawFields["APP Reference Number"] ||
    rawFields["app reference number"] ||
    "N/A";

  const tenderUniqueId =
    details.tenderUniqueId ||
    payload.tenderUniqueId ||
    rawFields["Tender Unique ID"] ||
    rawFields["tender unique id"] ||
    tender.refNo ||
    "N/A";

  const procuringEntity =
    details.procuringEntity ||
    payload.procuringEntity ||
    rawFields["Name of Procuring Entity"] ||
    tender.procuringEntity ||
    "Procuring Entity";

  const title =
    details.title ||
    payload.title ||
    rawFields["Title"] ||
    tender.title ||
    "ZPPA e-Procurement Tender";

  const description =
    details.description ||
    payload.description ||
    rawFields["Description"] ||
    tender.description ||
    title;

  const procurementMethodRationale =
    details.procurementMethodRationale ||
    payload.procurementMethodRationale ||
    rawFields["Procurement Method Rationale"] ||
    "THRESHOLD";

  const awardCriteria =
    details.awardCriteriaDetails ||
    payload.awardCriteriaDetails ||
    rawFields["Award Criteria Details"] ||
    "BEST EVALUATED BIDDER";

  const submissionMethod =
    details.submissionMethodDetails ||
    payload.submissionMethodDetails ||
    rawFields["Submission Method Details"] ||
    "ONLINE THROUGH EGP";

  const procurementType =
    details.procurementType ||
    payload.procurementType ||
    rawFields["Procurement Type"] ||
    tender.procurementType ||
    "Goods";

  const procedure =
    details.procedure ||
    payload.procedure ||
    rawFields["Procedure"] ||
    "Open Bidding National";

  const commencementType =
    details.commencementType ||
    payload.commencementType ||
    rawFields["Commencement Type"] ||
    "Tender Notice";

  const threshold =
    details.threshold ||
    payload.threshold ||
    rawFields["Threshold"] ||
    "Below";

  const procurementTechnique =
    details.procurementTechnique ||
    payload.procurementTechnique ||
    rawFields["Procurement Technique"] ||
    "Invitation To Bid (ITB)";

  const numberOfStages =
    details.numberOfStages ||
    payload.numberOfStages ||
    rawFields["Number of Stages"] ||
    "1";

  const evaluationMechanism =
    details.evaluationMechanism ||
    payload.evaluationMechanism ||
    rawFields["Evaluation Mechanism"] ||
    "Least Cost Selection (LCS)";

  const ceecPreference =
    details.ceecPreferenceType ||
    payload.ceecPreferenceType ||
    rawFields["CEEC Preference Type"] ||
    "No Preference";

  const frameworkAgreement =
    details.frameworkAgreement ||
    payload.frameworkAgreement ||
    rawFields["Framework Agreement Establishment"] ||
    "No";

  const postqualification =
    details.postqualification ||
    payload.postqualification ||
    rawFields["Postqualification"] ||
    "No";

  const deadlineRemaining =
    details.deadlineRemaining ||
    payload.deadlineRemaining ||
    rawFields["Bid submission deadline in (days/hours)"] ||
    "";

  // Statutory Financial Fields
  const paymentType =
    details.paymentType ||
    payload.paymentType ||
    rawFields["Payment Type"] ||
    "Participation Fee Required";

  const paymentAmount =
    details.paymentAmount ||
    payload.paymentAmount ||
    rawFields["Payment Amount (ZMW)"] ||
    rawFields["Payment Amount"] ||
    "";

  const paymentTerms =
    details.paymentTerms ||
    payload.paymentTerms ||
    rawFields["Payment Terms and Method"] ||
    "ONLINE THROUGH EGP";

  const bidSecurityType =
    details.bidSecurityType ||
    payload.bidSecurityType ||
    rawFields["Bid Security Type"] ||
    "Bid Security Required";

  const bidSecurityAmount =
    details.bidSecurityAmount ||
    payload.bidSecurityAmount ||
    rawFields["Bid Security Amount ()"] ||
    rawFields["Bid Security Amount"] ||
    "";

  const bidSecurityAmountType =
    details.bidSecurityAmountType ||
    payload.bidSecurityAmountType ||
    rawFields["Bid Security Amount Type"] ||
    "Percentage";

  // Lots
  const lots: string[] = useMemo(() => {
    if (details.lots && Array.isArray(details.lots) && details.lots.length > 0) {
      return details.lots;
    }
    if (payload.lots && Array.isArray(payload.lots) && payload.lots.length > 0) {
      return payload.lots;
    }
    const extracted: string[] = [];
    Object.keys(rawFields).forEach((k) => {
      if (k.toLowerCase().startsWith("lot name")) {
        extracted.push(rawFields[k]);
      }
    });
    return extracted;
  }, [details, payload, rawFields]);

  // UNSPSC Codes
  const unspscCodes: string[] = useMemo(() => {
    if (details.unspscCodes && Array.isArray(details.unspscCodes)) {
      return details.unspscCodes;
    }
    if (payload.unspscCodes && Array.isArray(payload.unspscCodes)) {
      return payload.unspscCodes;
    }
    const rawCodes = rawFields["UNSPSC Codes"] || "";
    if (rawCodes) {
      return rawCodes.split(/\s(?=\d{8})/).map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }, [details, payload, rawFields]);

  // Dates
  const publicationDate =
    rawFields["Date of Publication/Invitation"] ||
    details.publishDate ||
    tender.publishDate ||
    "";

  const contractNoticeDate =
    rawFields["Contract Notice Date"] ||
    details.contractNoticeDate ||
    "";

  const clarificationDeadline =
    rawFields["End of Clarification Period"] ||
    details.clarificationDeadline ||
    "";

  const submissionDeadline =
    rawFields["Deadline for Bid Submission"] ||
    details.closingDate ||
    tender.closingDate ||
    "";

  const bidOpeningDate =
    rawFields["Bid Opening Date"] ||
    details.bidOpeningDate ||
    "";

  // Documents
  const documents: any[] = useMemo(() => {
    const list = details.documents || payload.documents || [];
    return Array.isArray(list) ? list : [];
  }, [details, payload]);

  const noticePdf = documents.find(
    (d: any) =>
      (d.type && d.type.includes("Notice")) ||
      (d.title && d.title.toLowerCase().includes("notice")) ||
      (d.downloadUrl && d.downloadUrl.includes("downloadNoticeForAdvSearch"))
  );

  const officialPortalUrl =
    details.officialUrl ||
    payload.detailsUrl ||
    `https://eprocure.zppa.org.zm/epps/cft/prepareViewCfTWS.do?resourceId=${encodeURIComponent(cleanResourceId)}`;

  const noticePdfUrl =
    noticePdf?.downloadUrl ||
    `https://eprocure.zppa.org.zm/epps/cft/downloadNoticeForAdvSearch.do?resourceId=${encodeURIComponent(cleanResourceId)}`;

  return (
    <div className="space-y-6 min-w-0">
      {/* 1. OFFICIAL ZPPA BANNER */}
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs tracking-wide">
                ZPPA e-GP Portal (Zambia)
              </Badge>
              <Badge variant="outline" className="text-xs font-mono font-medium border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
                Resource ID: {cleanResourceId}
              </Badge>
              {deadlineRemaining && (
                <Badge variant="secondary" className="text-xs font-mono font-semibold flex items-center gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  <Clock className="size-3" />
                  Remaining: {deadlineRemaining} (Days/Hours)
                </Badge>
              )}
            </div>

            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-snug">
              {title}
            </h2>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1.5 font-medium text-foreground/90">
                <Building2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                {procuringEntity}
              </span>
              <span className="flex items-center gap-1.5 font-mono">
                <Hash className="size-3.5 text-muted-foreground shrink-0" />
                APP Ref: {appReferenceNumber}
              </span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-xs"
              asChild
            >
              <a href={noticePdfUrl} target="_blank" rel="noopener noreferrer">
                <Download className="mr-1.5 size-3.5" />
                Notice PDF
              </a>
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="text-xs font-medium border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
              asChild
            >
              <a href={officialPortalUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 size-3.5" />
                ZPPA Portal
              </a>
            </Button>

            {onAnalyzeWithAi && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAnalyzeWithAi}
                className="text-xs font-medium border-primary/40 text-primary hover:bg-primary/10"
              >
                <Sparkles className="mr-1.5 size-3.5" />
                AI Analysis
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 2. STATUTORY PARAMETERS GRID (Matching Image 3) */}
      <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-xs">
        <div className="bg-[#1e392a] text-white px-4 sm:px-6 py-3 font-semibold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="size-4 text-emerald-400" />
            Official Tender Details & Statutory Parameters
          </span>
          <span className="text-[11px] font-mono text-emerald-200">
            e-GP Platform - View Tender Details
          </span>
        </div>

        <div className="p-4 sm:p-6 divide-y divide-border/50 text-xs sm:text-sm">
          {/* Key Identification */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
            <div>
              <span className="text-xs font-semibold text-muted-foreground block uppercase">Name of Procuring Entity</span>
              <p className="font-semibold text-foreground mt-0.5">{procuringEntity}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground block uppercase">APP Reference Number</span>
              <p className="font-mono font-medium text-foreground mt-0.5">{appReferenceNumber}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground block uppercase">Tender Unique ID</span>
              <p className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">{tenderUniqueId}</p>
            </div>
          </div>

          {/* Description */}
          <div className="py-4">
            <span className="text-xs font-semibold text-muted-foreground block uppercase">Description</span>
            <p className="text-foreground/90 mt-1 leading-relaxed whitespace-pre-wrap">{description}</p>
          </div>

          {/* Procurement Methods */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-4">
            <div>
              <span className="text-xs font-semibold text-muted-foreground block uppercase">Procurement Type</span>
              <Badge variant="secondary" className="mt-1 font-medium text-xs">{procurementType}</Badge>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground block uppercase">Procedure</span>
              <p className="font-medium text-foreground mt-1">{procedure}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground block uppercase">Procurement Method Rationale</span>
              <p className="font-medium text-foreground mt-1">{procurementMethodRationale}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground block uppercase">Procurement Technique</span>
              <p className="font-medium text-foreground mt-1">{procurementTechnique}</p>
            </div>
          </div>

          {/* Evaluation & Criteria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-4">
            <div>
              <span className="text-xs font-semibold text-muted-foreground block uppercase">Award Criteria Details</span>
              <p className="font-semibold text-emerald-600 dark:text-emerald-400 mt-1">{awardCriteria}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground block uppercase">Evaluation Mechanism</span>
              <p className="font-medium text-foreground mt-1">{evaluationMechanism}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground block uppercase">Submission Method Details</span>
              <p className="font-medium text-foreground mt-1">{submissionMethod}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground block uppercase">Commencement Type</span>
              <p className="font-medium text-foreground mt-1">{commencementType}</p>
            </div>
          </div>

          {/* Governance & Preferences */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 py-4">
            <div>
              <span className="text-xs font-semibold text-muted-foreground block uppercase">Threshold</span>
              <p className="font-medium text-foreground mt-1">{threshold}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground block uppercase">Number of Stages</span>
              <p className="font-mono font-medium text-foreground mt-1">{numberOfStages}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground block uppercase">CEEC Preference Type</span>
              <p className="font-medium text-foreground mt-1">{ceecPreference}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground block uppercase">Framework Agreement</span>
              <p className="font-medium text-foreground mt-1">{frameworkAgreement}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground block uppercase">Postqualification</span>
              <p className="font-medium text-foreground mt-1">{postqualification}</p>
            </div>
          </div>

          {/* UNSPSC Codes */}
          {unspscCodes.length > 0 && (
            <div className="py-4">
              <span className="text-xs font-semibold text-muted-foreground block uppercase mb-2">UNSPSC Commodity Codes</span>
              <div className="flex flex-wrap gap-2">
                {unspscCodes.map((code, idx) => (
                  <Badge key={idx} variant="outline" className="font-mono text-xs border-emerald-500/30 bg-emerald-500/5 text-foreground flex items-center gap-1">
                    <Tag className="size-3 text-emerald-600" />
                    {code}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. FINANCIAL & STATUTORY COMPLIANCE TERMS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Participation Fee Card */}
        <div className="rounded-xl border border-border/70 bg-card p-5 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-border/40">
            <Receipt className="size-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="font-bold text-sm text-foreground uppercase tracking-wide">Participation Fee & Payment</h4>
          </div>

          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Payment Type:</span>
              <span className="font-semibold text-foreground">{paymentType}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Payment Amount:</span>
              <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {paymentAmount ? `ZMW ${paymentAmount}` : "Free / No Fee"}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Payment Terms & Method:</span>
              <Badge variant="outline" className="font-medium text-xs border-emerald-500/30">
                {paymentTerms}
              </Badge>
            </div>
          </div>
        </div>

        {/* Bid Security Card */}
        <div className="rounded-xl border border-border/70 bg-card p-5 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-border/40">
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="font-bold text-sm text-foreground uppercase tracking-wide">Bid Security Guarantee</h4>
          </div>

          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Security Type:</span>
              <span className="font-semibold text-foreground">{bidSecurityType}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Security Amount:</span>
              <span className="font-bold font-mono text-foreground">
                {bidSecurityAmount ? `${bidSecurityAmount} ${bidSecurityAmountType === "Percentage" ? "%" : bidSecurityAmountType}` : "Standard Statutory"}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Amount Type:</span>
              <span className="font-medium text-muted-foreground">{bidSecurityAmountType}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. PROCUREMENT LOTS BREAKDOWN */}
      {lots.length > 0 && (
        <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="font-bold text-sm text-foreground uppercase tracking-wide">
                Procurement Lots ({lots.length} Defined Lots)
              </h4>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              Bids for: One or More Lots
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lots.map((lotName, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-border/60 bg-muted/20 p-3.5 space-y-1 hover:border-emerald-500/40 transition-colors"
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">LOT {idx + 1}</span>
                  <span className="text-[10px]">Active</span>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-foreground leading-snug">{lotName}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. CRITICAL TIMELINES & STATUTORY MILESTONES */}
      <div className="rounded-xl border border-border/70 bg-card p-5 space-y-4 shadow-xs">
        <div className="flex items-center gap-2 pb-2 border-b border-border/40">
          <Calendar className="size-4 text-emerald-600 dark:text-emerald-400" />
          <h4 className="font-bold text-sm text-foreground uppercase tracking-wide">
            Statutory Dates & Deadlines
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1 p-3 rounded-lg bg-muted/20 border border-border/40">
            <span className="text-[11px] font-semibold text-muted-foreground block uppercase">Publication Date</span>
            <p className="text-xs sm:text-sm font-mono font-medium text-foreground">{publicationDate || "N/A"}</p>
          </div>

          <div className="space-y-1 p-3 rounded-lg bg-muted/20 border border-border/40">
            <span className="text-[11px] font-semibold text-muted-foreground block uppercase">Contract Notice Date</span>
            <p className="text-xs sm:text-sm font-mono font-medium text-foreground">{contractNoticeDate || "N/A"}</p>
          </div>

          <div className="space-y-1 p-3 rounded-lg bg-muted/20 border border-border/40">
            <span className="text-[11px] font-semibold text-muted-foreground block uppercase">Clarifications End</span>
            <p className="text-xs sm:text-sm font-mono font-medium text-foreground">{clarificationDeadline || "N/A"}</p>
          </div>

          <div className="space-y-1 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block uppercase">Submission Deadline</span>
            <p className="text-xs sm:text-sm font-mono font-bold text-foreground">{submissionDeadline || "N/A"}</p>
          </div>

          <div className="space-y-1 p-3 rounded-lg bg-muted/20 border border-border/40">
            <span className="text-[11px] font-semibold text-muted-foreground block uppercase">Bid Opening Date</span>
            <p className="text-xs sm:text-sm font-mono font-medium text-foreground">{bidOpeningDate || "N/A"}</p>
          </div>
        </div>
      </div>

      {/* 6. ATTACHED CONTRACT DOCUMENTS & OFFICIAL SBD FILES */}
      <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-xs">
        <div className="bg-[#1e392a] text-white px-4 sm:px-6 py-3 font-semibold text-xs sm:text-sm uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="size-4 text-emerald-400" />
            Official Bidding Documents & Standard Bidding Documents (SBD)
          </span>
          <span className="text-[11px] font-mono text-emerald-200">
            {documents.length} File{documents.length !== 1 ? "s" : ""} Available
          </span>
        </div>

        <div className="p-4 sm:p-6 space-y-3">
          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs sm:text-sm">
              <FileText className="size-8 mx-auto mb-2 opacity-40" />
              No attached documents indexed yet. You can download the official notice PDF or open the ZPPA portal.
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {documents.map((doc: any, idx: number) => {
                const isPdf = (doc.fileName || "").toLowerCase().endsWith(".pdf") || (doc.type || "").includes("PDF");
                const isDoc = (doc.fileName || "").toLowerCase().endsWith(".doc") || (doc.fileName || "").toLowerCase().endsWith(".docx");
                const isXml = (doc.fileName || "").toLowerCase().endsWith(".xml");

                return (
                  <div
                    key={doc.documentId || idx}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-muted/60 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                        {isPdf ? (
                          <FileText className="size-5 text-red-500" />
                        ) : isDoc ? (
                          <FileCheck className="size-5 text-blue-500" />
                        ) : isXml ? (
                          <FileSpreadsheet className="size-5 text-amber-500" />
                        ) : (
                          <FileText className="size-5" />
                        )}
                      </div>

                      <div className="space-y-0.5 min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-foreground break-words">
                          {doc.fileName || doc.title}
                        </p>
                        {doc.description && doc.description !== "N/A" && doc.description !== doc.fileName && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {doc.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <Badge variant="outline" className="text-[10px] font-mono py-0 h-4">
                            {doc.type || "Document"}
                          </Badge>
                          {doc.language && (
                            <span className="text-[10px] text-muted-foreground uppercase">
                              Lang: {doc.language}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-xs font-medium border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 ml-auto sm:ml-0"
                      asChild
                    >
                      <a href={doc.downloadUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="mr-1.5 size-3.5" />
                        Download File
                      </a>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
