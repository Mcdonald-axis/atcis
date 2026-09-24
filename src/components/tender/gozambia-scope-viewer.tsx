"use client";

import React, { useMemo } from "react";
import {
  Award,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  ExternalLink,
  FileCheck,
  FileText,
  FolderArchive,
  Globe,
  Info,
  Layers,
  ListChecks,
  Mail,
  MapPin,
  Scale,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TenderItem } from "@/app/(main)/dashboard/default/_components/tender-data";

interface GoZambiaScopeViewerProps {
  tender: TenderItem;
  liveDetails?: any;
  onAnalyzeWithAi?: () => void;
}

interface ParsedSection {
  id: string;
  title: string;
  subtitle?: string;
  isSubSection?: boolean;
  content: string;
  bulletItems?: string[];
  subPoints?: Array<{ label: string; text: string }>;
  links?: Array<{ url: string; label: string; type: "drive" | "map" | "email" | "link" }>;
  iconType: "info" | "target" | "scope" | "legal" | "team" | "award" | "apply" | "submit" | "docs" | "general";
}

// Known standard headings in Zambian procurement / ToRs
const KNOWN_HEADINGS: Array<{ pattern: RegExp; title: string; icon: ParsedSection["iconType"]; isSub?: boolean }> = [
  { pattern: /TERMS OF REFERENCE FOR [^\d\n]+/i, title: "Terms of Reference (ToR)", icon: "docs" },
  { pattern: /INVITATION TO (?:TENDER|BID)/i, title: "Invitation to Tender / Bid", icon: "docs" },
  { pattern: /CATEGORIES OF GOODS AND SERVICES/i, title: "Categories of Goods & Services", icon: "scope" },
  { pattern: /\bGeneral Instructions\b/i, title: "General Instructions", icon: "legal" },
  { pattern: /\bQualifications and Experience\b/, title: "Qualifications and Experience", icon: "award" },
  { pattern: /\bHow to apply:?/i, title: "How to Apply", icon: "apply" },
  { pattern: /\bBackground and objective:?/i, title: "Background & Objectives", icon: "target" },
  { pattern: /1\.\s+(?:Project )?Background/i, title: "1. Background & Context", icon: "info" },
  { pattern: /1\.\s+SCOPE OF WORKS/i, title: "1. Scope of Works", icon: "scope" },
  { pattern: /2\.\s+MANDATE/i, title: "2. Mandate & Statutory Authority", icon: "legal" },
  { pattern: /2\.\s+OBJECTIVE(?:S)? OF THE AUDIT/i, title: "2. Objectives of Assignment", icon: "target" },
  { pattern: /2\.\s+Scope of Works/i, title: "2. Scope of Works", icon: "scope" },
  { pattern: /2\.\s+MANDATORY ELIGIBILITY REQUIREMENTS/i, title: "2. Mandatory Eligibility Requirements", icon: "legal" },
  { pattern: /3\.\s+OBJECTIVE(?:S)? OF THE AUDIT/i, title: "3. Objectives of Assignment", icon: "target" },
  { pattern: /3\.\s+SCOPE OF THE AUDIT/i, title: "3. Scope of the Audit", icon: "scope" },
  { pattern: /3\.\s+Eligibility Criteria/i, title: "3. Eligibility Criteria", icon: "legal" },
  { pattern: /3\.\s+SITE VISIT/i, title: "3. Site Visit Information", icon: "info" },
  { pattern: /4\.\s+RESPONSIBILITY FOR PREPARATION OF FINANCIAL STATEMENTS/i, title: "4. Responsibility for Preparation of Financial Statements", icon: "legal" },
  { pattern: /4\.\s+Supporting Documents to be Submitted/i, title: "4. Supporting Documents to be Submitted", icon: "docs" },
  { pattern: /4\.\s+AUDITOR'?S RESPONSIBILITIES/i, title: "4. Auditor's Responsibilities", icon: "legal" },
  { pattern: /4\.1\s+Responsibility of the Executive Committee/i, title: "4.1 Responsibility of Executive Committee / Client", icon: "legal", isSub: true },
  { pattern: /4\.1\s+Site visit Schedule and meeting point/i, title: "4.1 Site Visit Schedule & Meeting Point", icon: "info", isSub: true },
  { pattern: /4\.2\s+Auditor’?s Responsibility/i, title: "4.2 Auditor’s Responsibility", icon: "legal", isSub: true },
  { pattern: /5\.\s+SCOPE OF THE AUDIT/i, title: "5. Scope of the Audit", icon: "scope" },
  { pattern: /5\.\s+FRAUD AND ERROR/i, title: "5. Fraud & Error Standards (ISA 240 / 250)", icon: "legal" },
  { pattern: /5\.\s+Bid Submission Instruction(?:s)?/i, title: "5. Bid Submission Instructions", icon: "apply" },
  { pattern: /5\.\s+SUBMISSION OF BIDS/i, title: "5. Submission of Bids", icon: "submit" },
  { pattern: /6\.\s+DOCUMENTS AND INFORMATION AVAILABLE TO BIDDERS/i, title: "6. Documents & Information Available to Bidders", icon: "docs" },
  { pattern: /6\.\s+Bid Opening/i, title: "6. Bid Opening Ceremony", icon: "info" },
  { pattern: /6\.\s+FULL SOLICITATION DOCUMENT/i, title: "6. Full Solicitation Documents", icon: "docs" },
  { pattern: /7\.\s+REPORT TO MANAGEMENT/i, title: "7. Report to Management & Deliverables", icon: "docs" },
  { pattern: /7\.\s+Inquiries/i, title: "7. Inquiries & Clarifications", icon: "info" },
  { pattern: /8\.\s+GENERAL INFORMATION/i, title: "8. General Information & Deadlines", icon: "info" },
  { pattern: /9\.\s+AUDITOR’?S EXPERIENCE AND QUALIFICATIONS/i, title: "9. Experience & Qualifications Required", icon: "award" },
  { pattern: /9\.1\s+General Qualifications and Experience/i, title: "9.1 General Qualifications & Experience", icon: "award", isSub: true },
  { pattern: /10\.\s+TEAM COMPOSITION/i, title: "10. Key Team Composition", icon: "team" },
  { pattern: /10\.1\s+Audit Partner/i, title: "10.1 Key Personnel: Engagement Partner", icon: "team", isSub: true },
  { pattern: /10\.2\s+Audit Manager/i, title: "10.2 Key Personnel: Engagement Manager", icon: "team", isSub: true },
  { pattern: /10\.3\s+Audit Supervisor/i, title: "10.3 Key Personnel: Engagement Supervisor", icon: "team", isSub: true },
  { pattern: /10\.4\s+Curriculum Vitae/i, title: "10.4 Curriculum Vitae (CV) Requirements", icon: "team", isSub: true },
  { pattern: /11\.\s+HOW TO APPLY/i, title: "11. How to Apply & Mandatory Proposal Terms", icon: "apply" },
  { pattern: /12\.\s+SUBMISSION OF PROPOSALS/i, title: "12. Submission of Proposals & Delivery Address", icon: "submit" },
];

function extractSubPoints(text: string): { intro: string; points: Array<{ label: string; text: string }> } {
  // Check for lettered sub-points like: a) ... b) ... c) ...
  const letteredMatches = [...text.matchAll(/(?:^|\s)([a-z]\))\s+([^]+?)(?=\s+[a-z]\)|\s*$)/g)];
  if (letteredMatches.length >= 2) {
    const firstMatchIdx = letteredMatches[0].index ?? 0;
    const intro = text.slice(0, firstMatchIdx).trim();
    const points = letteredMatches.map((m) => ({
      label: m[1].replace(")", "").toUpperCase(),
      text: m[2].trim(),
    }));
    return { intro, points };
  }

  // Check for numbered bullet lists like: 1. ... 2. ... 3. ...
  const numberedMatches = [...text.matchAll(/(?:^|\s)(\d{1,2}\.)\s+([^]+?)(?=\s+\d{1,2}\.|\s*$)/g)];
  if (numberedMatches.length >= 3) {
    const firstMatchIdx = numberedMatches[0].index ?? 0;
    const intro = text.slice(0, firstMatchIdx).trim();
    const points = numberedMatches.map((m) => ({
      label: m[1].replace(".", ""),
      text: m[2].trim(),
    }));
    return { intro, points };
  }

  // Check for lettered sub-items like: A. ... B. ... C. ... (e.g. project sites)
  const capitalMatches = [...text.matchAll(/(?:^|\s)([A-E]\.)\s+([^]+?)(?=\s+[A-E]\.|\s*$)/g)];
  if (capitalMatches.length >= 2) {
    const firstMatchIdx = capitalMatches[0].index ?? 0;
    const intro = text.slice(0, firstMatchIdx).trim();
    const points = capitalMatches.map((m) => ({
      label: m[1].replace(".", ""),
      text: m[2].trim(),
    }));
    return { intro, points };
  }

  return { intro: text, points: [] };
}

function extractBullets(text: string): string[] {
  if (!text.includes("•")) return [];
  const parts = text.split("•").map((p) => p.trim()).filter((p) => p.length > 0);
  return parts;
}

export function GoZambiaScopeViewer({ tender, liveDetails, onAnalyzeWithAi }: GoZambiaScopeViewerProps) {
  const rawDescription = (liveDetails?.description || tender.description || "").trim();

  // Extract all Google Drive, Google Maps, and Email links from payload and description
  const links = useMemo(() => {
    const discovered: Array<{ url: string; label: string; type: "drive" | "map" | "email" | "link" }> = [];
    const seen = new Set<string>();

    const docUrls: string[] = [
      ...(Array.isArray(tender.documents) ? tender.documents.map((d: any) => d.downloadUrl) : []),
      ...((tender as any).documentUrls || []),
      ((tender as any).pdfUrl || ""),
    ].filter(Boolean);

    for (const url of docUrls) {
      if (seen.has(url)) continue;
      seen.add(url);
      if (url.includes("drive.google.com")) {
        discovered.push({ url, label: "Official Google Drive Tender Dossier", type: "drive" });
      } else if (url.includes("maps.app.goo.gl") || url.includes("google.com/maps")) {
        discovered.push({ url, label: "Site Inspection Location (Google Maps)", type: "map" });
      } else {
        discovered.push({ url, label: "Tender Document Link", type: "link" });
      }
    }

    // Also regex search rawDescription for any URLs not already in payload
    const urlMatches = rawDescription.match(/https?:\/\/[^\s"'<>)]+/gi) || [];
    for (const url of urlMatches) {
      const cleanUrl = url.replace(/[.,;:]+$/, "");
      if (seen.has(cleanUrl)) continue;
      seen.add(cleanUrl);
      if (cleanUrl.includes("drive.google.com")) {
        discovered.push({ url: cleanUrl, label: "Official Google Drive Tender Dossier", type: "drive" });
      } else if (cleanUrl.includes("maps.app.goo.gl") || cleanUrl.includes("google.com/maps")) {
        discovered.push({ url: cleanUrl, label: "Site Inspection Location (Google Maps)", type: "map" });
      } else if (cleanUrl.endsWith(".pdf") || cleanUrl.includes(".pdf")) {
        discovered.push({ url: cleanUrl, label: "Official Specification Dossier (PDF)", type: "link" });
      }
    }

    // Email addresses
    const emailMatches = rawDescription.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || [];
    for (const email of emailMatches) {
      const mailUrl = `mailto:${email}`;
      if (seen.has(mailUrl)) continue;
      seen.add(mailUrl);
      discovered.push({ url: mailUrl, label: `Submit Bid via Email (${email})`, type: "email" });
    }

    return discovered;
  }, [tender, rawDescription]);

  // Extract Tender Participation Fee if present (e.g. ZMW1,000.00)
  const participationFee = useMemo(() => {
    const feeMatch = rawDescription.match(/(?:participation fee of|tender fee of|fee of)\s+([A-Z]{3}\s*[\d,]+(?:\.\d{2})?)/i);
    return feeMatch ? feeMatch[1].trim() : null;
  }, [rawDescription]);

  // Extract Key Deadlines
  const extractedDeadline = useMemo(() => {
    const m = rawDescription.match(/(?:submission deadline|on or before|no later than|deadline:)\s*([^\n\r.]+?(?:hours|hrs|cat|am|pm|\d{4}))/i);
    return m ? m[1].trim() : tender.closingDate ? new Date(tender.closingDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "See Solicitation Document";
  }, [rawDescription, tender.closingDate]);

  // Parse raw text into structured sections
  const sections = useMemo(() => {
    if (!rawDescription) return [];

    // Normalize spacing between periods and numbers
    const text = rawDescription
      .replace(/([A-Za-z)])\.(\d{1,2}(?:\.\d{1,2})?\s+[A-Z])/g, "$1. $2")
      .replace(/\s+/g, " ")
      .trim();

    // Match all known headings
    const splits: Array<{ index: number; length: number; title: string; icon: ParsedSection["iconType"]; isSub?: boolean }> = [];

    for (const item of KNOWN_HEADINGS) {
      const rx = new RegExp(item.pattern.source, item.pattern.flags.includes("g") ? item.pattern.flags : item.pattern.flags + "g");
      let m;
      while ((m = rx.exec(text)) !== null) {
        splits.push({
          index: m.index,
          length: m[0].length,
          title: item.title,
          icon: item.icon,
          isSub: item.isSub,
        });
      }
    }

    // Sort by index
    splits.sort((a, b) => a.index - b.index);

    // Remove overlapping matches
    const filtered: typeof splits = [];
    for (const s of splits) {
      if (filtered.length === 0 || s.index >= filtered[filtered.length - 1].index + filtered[filtered.length - 1].length) {
        filtered.push(s);
      }
    }

    const result: ParsedSection[] = [];

    // If there is preamble text before the first section
    if (filtered.length > 0 && filtered[0].index > 0) {
      const pre = text.slice(0, filtered[0].index).trim();
      if (pre.length > 15) {
        const bullets = extractBullets(pre);
        const { intro, points } = extractSubPoints(pre);
        result.push({
          id: "sec-preamble",
          title: "Procurement Overview & Authority Notice",
          content: intro,
          bulletItems: bullets.length > 1 ? bullets : undefined,
          subPoints: points.length > 0 ? points : undefined,
          iconType: "info",
        });
      }
    }

    if (filtered.length === 0) {
      // Fallback: If no known headers matched, cleanly split by double breaks or bullets
      const bullets = extractBullets(text);
      const { intro, points } = extractSubPoints(text);
      result.push({
        id: "sec-0",
        title: "Terms of Reference & Detailed Specifications",
        content: intro,
        bulletItems: bullets.length > 1 ? bullets : undefined,
        subPoints: points.length > 0 ? points : undefined,
        iconType: "scope",
      });
      return result;
    }

    for (let i = 0; i < filtered.length; i++) {
      const cur = filtered[i];
      const nextIdx = i + 1 < filtered.length ? filtered[i + 1].index : text.length;
      const content = text.slice(cur.index + cur.length, nextIdx).trim();

      // Check for bullet lists and lettered sub-points
      const bullets = extractBullets(content);
      const { intro, points } = extractSubPoints(content);

      result.push({
        id: `sec-${i + 1}`,
        title: cur.title,
        isSubSection: cur.isSub,
        content: points.length > 0 ? intro : content,
        bulletItems: bullets.length > 1 ? bullets : undefined,
        subPoints: points.length > 0 ? points : undefined,
        iconType: cur.icon,
      });
    }

    return result;
  }, [rawDescription]);

  const renderIcon = (type: ParsedSection["iconType"]) => {
    switch (type) {
      case "target":
        return <Target className="size-4 text-emerald-600 dark:text-emerald-400" />;
      case "scope":
        return <Layers className="size-4 text-primary" />;
      case "legal":
        return <Scale className="size-4 text-amber-600 dark:text-amber-400" />;
      case "team":
        return <Users className="size-4 text-purple-600 dark:text-purple-400" />;
      case "award":
        return <Award className="size-4 text-blue-600 dark:text-blue-400" />;
      case "apply":
        return <ListChecks className="size-4 text-teal-600 dark:text-teal-400" />;
      case "submit":
        return <Send className="size-4 text-emerald-600 dark:text-emerald-400" />;
      case "docs":
        return <FolderArchive className="size-4 text-primary" />;
      default:
        return <FileText className="size-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* 1. Top Notice Header Banner */}
      <div className="rounded-xl border border-border/70 bg-gradient-to-r from-muted/30 via-card to-muted/20 p-4 sm:p-5 min-w-0 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 min-w-0">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25">
                GoZambiaJobs Official Notice
              </Badge>
              <Badge variant="secondary" className="font-mono text-xs">
                {tender.refNo}
              </Badge>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground font-medium">Zambia Public & Commercial Procurement</span>
            </div>
            <h3 className="font-bold text-lg sm:text-xl text-foreground leading-snug break-words">
              Terms of Reference & Scope of Requirements
            </h3>
            <p className="text-xs text-muted-foreground">
              Procuring Entity: <strong className="text-foreground">{liveDetails?.procuringEntity || tender.procuringEntity}</strong>
            </p>
          </div>

          {onAnalyzeWithAi && (
            <Button
              size="sm"
              variant="outline"
              onClick={onAnalyzeWithAi}
              className="gap-1.5 rounded-lg text-xs font-semibold border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 shrink-0"
            >
              <Sparkles className="size-3.5" />
              <span>AI Scope Conformance Check</span>
            </Button>
          )}
        </div>

        {/* Quick Parameters Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 mt-3 border-t border-border/50 text-xs">
          <div className="rounded-lg border border-border/40 bg-card/60 p-2.5 space-y-0.5">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
              <Building2 className="size-3" /> Procuring Authority
            </span>
            <p className="font-semibold text-foreground truncate">{liveDetails?.procuringEntity || tender.procuringEntity}</p>
          </div>

          <div className="rounded-lg border border-border/40 bg-card/60 p-2.5 space-y-0.5">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
              <Clock className="size-3" /> Submission Deadline
            </span>
            <p className="font-mono font-semibold text-amber-600 dark:text-amber-400 truncate">{extractedDeadline}</p>
          </div>

          <div className="rounded-lg border border-border/40 bg-card/60 p-2.5 space-y-0.5">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
              <Coins className="size-3" /> Tender Document Fee
            </span>
            <p className="font-mono font-semibold text-foreground truncate">{participationFee || "No Mandatory Fee"}</p>
          </div>

          <div className="rounded-lg border border-border/40 bg-card/60 p-2.5 space-y-0.5">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
              <MapPin className="size-3" /> Delivery Location
            </span>
            <p className="font-medium text-foreground truncate">Lusaka, Zambia</p>
          </div>
        </div>
      </div>

      {/* 2. Official Google Drive / Document Links Banner (If any) */}
      {links.length > 0 && (
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FolderArchive className="size-4 text-primary shrink-0" />
              <h4 className="font-bold text-xs sm:text-sm uppercase tracking-wide text-primary">
                Official Solicitation Documents & Electronic Submission Dossier
              </h4>
            </div>
            <Badge variant="outline" className="text-[11px] font-mono bg-primary/10 text-primary border-primary/20">
              {links.length} Available Link{links.length > 1 ? "s" : ""}
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {links.map((lnk, idx) => (
              <a
                key={idx}
                href={lnk.url}
                target={lnk.type === "email" ? "_self" : "_blank"}
                rel="noopener noreferrer"
                className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-all text-xs font-medium shadow-2xs ${
                  lnk.type === "drive"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                    : lnk.type === "email"
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20"
                    : "border-border/70 bg-card hover:bg-muted/40 text-foreground"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {lnk.type === "drive" ? (
                    <FolderArchive className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : lnk.type === "email" ? (
                    <Mail className="size-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  ) : lnk.type === "map" ? (
                    <MapPin className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  ) : (
                    <FileText className="size-4 text-primary shrink-0" />
                  )}
                  <span className="truncate">{lnk.label}</span>
                </div>
                <ExternalLink className="size-3.5 shrink-0 opacity-70" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 3. Structured Sections Feed */}
      <div className="space-y-4 min-w-0">
        {sections.map((section) => {
          const isSubmission = section.iconType === "submit" || section.title.toLowerCase().includes("submission");
          const isKeyTeam = section.iconType === "team";

          return (
            <div
              key={section.id}
              className={`rounded-xl border transition-all min-w-0 ${
                section.isSubSection
                  ? "ml-0 sm:ml-4 border-l-4 border-l-primary/60 border-t-border/50 border-r-border/50 border-b-border/50 bg-muted/15 p-3.5 sm:p-4"
                  : isSubmission
                  ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 p-4 sm:p-6 shadow-2xs"
                  : isKeyTeam
                  ? "border-purple-500/25 bg-purple-500/5 dark:bg-purple-500/10 p-4 sm:p-5"
                  : "border-border/70 bg-card p-4 sm:p-5 shadow-2xs"
              }`}
            >
              {/* Section Header */}
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border/40 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 rounded bg-muted/60 shrink-0">
                    {renderIcon(section.iconType)}
                  </div>
                  <h4 className={`font-bold tracking-tight text-foreground truncate ${
                    section.isSubSection ? "text-sm" : "text-base sm:text-lg"
                  }`}>
                    {section.title}
                  </h4>
                </div>

                {isSubmission && (
                  <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-[10px] shrink-0">
                    Action Required
                  </Badge>
                )}
              </div>

              {/* Section Body */}
              <div className="pt-3 text-xs sm:text-sm text-foreground/90 space-y-3 leading-relaxed">
                {section.content && (
                  <p className="leading-relaxed whitespace-pre-line break-words text-foreground/90">
                    {section.content}
                  </p>
                )}

                {/* Sub-Points (Lettered a), b) or Numbered 1., 2.) */}
                {section.subPoints && section.subPoints.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {section.subPoints.map((pt, pIdx) => (
                      <div
                        key={pIdx}
                        className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/35 transition-colors"
                      >
                        <span className="inline-flex items-center justify-center size-5 rounded-md font-mono text-[11px] font-bold bg-primary/10 text-primary shrink-0 mt-0.5 shadow-2xs">
                          {pt.label}
                        </span>
                        <div className="text-xs sm:text-sm text-foreground/90 leading-relaxed break-words flex-1">
                          {pt.text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bullet Items */}
                {section.bulletItems && section.bulletItems.length > 0 && (
                  <ul className="space-y-1.5 pt-1">
                    {section.bulletItems.map((bullet, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-2 text-xs sm:text-sm text-foreground/90">
                        <span className="size-1.5 rounded-full bg-primary shrink-0 mt-2" />
                        <span className="leading-relaxed break-words">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Official Source & Verification Footer */}
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-muted-foreground min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="size-4 text-muted-foreground shrink-0" />
          <span className="truncate">
            Source Platform: <strong className="text-foreground">GoZambiaJobs Portal</strong> (Direct Scraped Feed)
          </span>
        </div>

        <a
          href={tender.portalUrl || "https://gozambiajobs.com/tenders"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline shrink-0"
        >
          <span>View on GoZambiaJobs.com</span>
          <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  );
}
