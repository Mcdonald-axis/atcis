"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthService } from "@/services/auth-service";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Files,
  Folder,
  FolderOpen,
  FolderPlus,
  Layers,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/browser";
import { createClientId } from "@/lib/utils";

interface DocFolder {
  id: string;
  name: string;
  description: string;
  jurisdiction: "Zimbabwe (PRAZ)" | "Zambia (ZPPA)" | "Regional (SADC)";
  isCustom?: boolean;
  countryCode?: "ZW" | "ZM" | "ALL";
}

interface TemplateDoc {
  storagePath?: string;
  storageBucket?: "repository-documents";
  fileName?: string;
  sizeBytes?: number;
  id: string;
  folderId: string;
  name: string;
  documentRef: string;
  fileFormat: "PDF" | "DOCX" | "XLSX";
  fileSize: string;
  lastUpdated: string;
  expiryDate?: string | null;
  downloadsCount: number;
  description: string;
  countryCode: "ZW" | "ZM" | "ALL";
}

type ExpiryStatus = "EXPIRED" | "EXPIRING_SOON" | "ACTIVE" | "PERMANENT";

interface ExpiryEvaluation {
  status: ExpiryStatus;
  daysRemaining: number | null;
  label: string;
}

function evaluateExpiry(expiryDateStr?: string | null): ExpiryEvaluation {
  if (!expiryDateStr) {
    return {
      status: "PERMANENT",
      daysRemaining: null,
      label: "Permanent / No Expiry",
    };
  }

  const today = new Date("2026-09-03"); // Standard system operating baseline date
  const target = new Date(expiryDateStr);
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      status: "EXPIRED",
      daysRemaining: diffDays,
      label: `Expired ${Math.abs(diffDays)}d ago`,
    };
  }

  if (diffDays <= 30) {
    return {
      status: "EXPIRING_SOON",
      daysRemaining: diffDays,
      label: `Expires in ${diffDays}d`,
    };
  }

  return {
    status: "ACTIVE",
    daysRemaining: diffDays,
    label: `Valid until ${target.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`,
  };
}

export default function TemplatesPage() {
  const [currentUser, setCurrentUser] = useState(() => AuthService.getCurrentUser());
  useEffect(() => {
    const sync = () => setCurrentUser(AuthService.getCurrentUser());
    window.addEventListener("atcis-auth-changed", sync);
    return () => window.removeEventListener("atcis-auth-changed", sync);
  }, []);

  const isCountryAdmin = currentUser?.role === "country_admin";
  const canDeleteRepositoryItems =
    currentUser?.role === "country_admin" || currentUser?.role === "super_admin";
  const userCountry = isCountryAdmin
    ? (currentUser.country === "ZM" ? "ZM" : "ZW")
    : currentUser?.role !== "super_admin" && currentUser?.country && currentUser.country !== "ALL"
    ? currentUser.country
    : "ALL";

  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [documents, setDocuments] = useState<TemplateDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<"ALL" | "ZW" | "ZM">(() => {
    if (typeof window !== "undefined") {
      const u = AuthService.getCurrentUser();
      if (u?.role === "country_admin") return u.country === "ZM" ? "ZM" : "ZW";
      if (u && u.role !== "super_admin" && u.country && u.country !== "ALL") return u.country;
    }
    return "ALL";
  });
  const [expiryFilter, setExpiryFilter] = useState<"ALL" | "EXPIRING_SOON" | "EXPIRED" | "ACTIVE">("ALL");

  // MODAL 1: Create New Folder
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDesc, setNewFolderDesc] = useState("");
  const [newFolderJurisdiction, setNewFolderJurisdiction] = useState<"Zimbabwe (PRAZ)" | "Zambia (ZPPA)" | "Regional (SADC)">(() => {
    const u = AuthService.getCurrentUser();
    if (u?.country === "ZM") return "Zambia (ZPPA)";
    if (u?.country === "ZW") return "Zimbabwe (PRAZ)";
    return "Regional (SADC)";
  });

  // MODAL 2: Upload Document
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadExistingId, setUploadExistingId] = useState<string | null>(null);
  const [uploadDocName, setUploadDocName] = useState("");
  const [uploadDocRef, setUploadDocRef] = useState("");
  const [uploadFolderId, setUploadFolderId] = useState("company-registrations");
  const [uploadDescription, setUploadDescription] = useState("");
  const [hasExpiry, setHasExpiry] = useState(false);
  const [uploadExpiryDate, setUploadExpiryDate] = useState("2026-12-31");

  // MODAL 3: Renew Document
  const [renewDoc, setRenewDoc] = useState<TemplateDoc | null>(null);
  const [renewExpiryDate, setRenewExpiryDate] = useState("2026-12-31");
  const [renewNewRef, setRenewNewRef] = useState("");

  // Load from SQLite database via /api/templates
  const loadRepositoryData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/templates");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setFolders(json.data.folders || []);
          setDocuments(json.data.documents || []);
        }
      }
    } catch (err) {
      console.error("Failed to load repository data:", err);
      toast.error("Database connection error while loading repository files.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRepositoryData();
  }, []);

  const activeFolder = folders.find((f) => f.id === activeFolderId);

  // Filtered directories based on country admin isolation
  const displayedFolders = useMemo(() => {
    if (userCountry === "ALL") return folders;
    return folders.filter((f) => {
      if (f.countryCode && f.countryCode !== "ALL" && f.countryCode !== userCountry) return false;
      const jur = String(f.jurisdiction || "");
      if (userCountry === "ZW" && jur.includes("Zambia")) return false;
      if (userCountry === "ZM" && jur.includes("Zimbabwe")) return false;
      return true;
    });
  }, [folders, userCountry]);

  // Country scoped documents for metrics
  const countryDocuments = useMemo(() => {
    if (userCountry === "ALL") return documents;
    return documents.filter((d) => d.countryCode === "ALL" || d.countryCode === userCountry);
  }, [documents, userCountry]);

  // Expiration metrics
  const expiredCount = countryDocuments.filter((d) => evaluateExpiry(d.expiryDate).status === "EXPIRED").length;
  const expiringSoonCount = countryDocuments.filter((d) => evaluateExpiry(d.expiryDate).status === "EXPIRING_SOON").length;

  // Filtered documents
  const displayedDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (activeFolderId && doc.folderId !== activeFolderId) return false;
      const effectiveJur = userCountry !== "ALL" ? userCountry : selectedJurisdiction;
      if (effectiveJur !== "ALL" && doc.countryCode !== "ALL" && doc.countryCode !== effectiveJur) {
        return false;
      }
      if (expiryFilter !== "ALL") {
        const evaluation = evaluateExpiry(doc.expiryDate);
        if (expiryFilter === "EXPIRED" && evaluation.status !== "EXPIRED") return false;
        if (expiryFilter === "EXPIRING_SOON" && evaluation.status !== "EXPIRING_SOON") return false;
        if (expiryFilter === "ACTIVE" && evaluation.status !== "ACTIVE" && evaluation.status !== "PERMANENT") return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          doc.name.toLowerCase().includes(q) ||
          doc.documentRef.toLowerCase().includes(q) ||
          doc.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [documents, activeFolderId, userCountry, selectedJurisdiction, expiryFilter, searchTerm]);

  const getFolderFileCount = (folderId: string) => {
    return documents.filter((d) => d.folderId === folderId).length;
  };

  // Handle Create Folder (Database write)
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const newFolder: DocFolder = {
      id: `fld-${Date.now()}`,
      name: newFolderName.trim(),
      description: newFolderDesc.trim() || "User-created document repository folder.",
      jurisdiction: newFolderJurisdiction,
      isCustom: true,
    };

    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_folder", folder: newFolder }),
      });

      if (res.ok) {
        setFolders([...folders, newFolder]);
        setActiveFolderId(newFolder.id);
        setIsNewFolderOpen(false);
        setNewFolderName("");
        setNewFolderDesc("");

        toast.success("Folder created in database.", {
          description: `Directory "${newFolder.name}" is now ready for files.`,
        });
      }
    } catch {
      toast.error("Failed to save folder to database.");
    }
  };

  // Handle Delete Custom Folder (Database delete)
  const handleDeleteFolder = async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDeleteRepositoryItems) {
      toast.error("Administrator access is required to delete folders.");
      return;
    }

    const count = getFolderFileCount(folderId);
    if (count > 0) {
      toast.error("Cannot delete folder containing files.", {
        description: `This directory still contains ${count} document(s). Please move or delete the files first.`,
      });
      return;
    }

    if (!confirm("Are you sure you want to delete this folder directory?")) {
      return;
    }

    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_folder", folderId }),
      });

      const result = await res.json().catch(() => ({}));
      if (res.ok && result.success) {
        setFolders(folders.filter((f) => f.id !== folderId));
        if (activeFolderId === folderId) setActiveFolderId(null);
        toast.info("Folder removed from database.");
      } else {
        toast.error(result.error || "Failed to delete folder from database.");
      }
    } catch {
      toast.error("Failed to delete folder from database.");
    }
  };

  // Handle Delete Document
  const handleDeleteDocument = async (docId: string, docName: string) => {
    if (!canDeleteRepositoryItems) {
      toast.error("Administrator access is required to delete documents.");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${docName}" from the repository?`)) {
      return;
    }

    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_document", docId }),
      });

      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
        toast.success(`Deleted "${docName}" from repository.`);
      } else {
        toast.error("Failed to delete document from database.");
      }
    } catch {
      toast.error("Network error while deleting document.");
    }
  };

  // Handle Clear All Documents
  const handleClearAllDocuments = async () => {
    if (!canDeleteRepositoryItems) {
      toast.error("Administrator access is required to clear repository documents.");
      return;
    }

    if (!confirm("Are you sure you want to remove ALL documents from the repository? This will give you a completely clean slate to upload real files.")) {
      return;
    }

    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_all_documents" }),
      });

      if (res.ok) {
        setDocuments([]);
        toast.success("Repository cleared.", {
          description: "All documents removed. You can now upload your real company records.",
        });
      } else {
        toast.error("Failed to clear documents from database.");
      }
    } catch {
      toast.error("Network error while clearing repository.");
    }
  };

  const openUpload = (document?: TemplateDoc) => {
    setUploadExistingId(document?.id || null);
    setUploadFile(null);
    setUploadDocName(document?.name || "");
    setUploadDocRef(document?.documentRef || "");
    setUploadDescription(document?.description || "");
    setUploadFolderId(document?.folderId || activeFolderId || displayedFolders[0]?.id || folders[0]?.id || "");
    setHasExpiry(!!document?.expiryDate);
    setUploadExpiryDate(document?.expiryDate || "2026-12-31");
    setIsUploadOpen(true);
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadBusy) return;
    const folder = folders.find((row) => row.id === uploadFolderId);
    if (!uploadDocName.trim() || !folder || !uploadFile) {
      toast.error("Choose a folder, enter a document name, and select a file.");
      return;
    }
    const format = uploadFile.name.split(".").pop()?.toUpperCase();
    if (format !== "PDF" && format !== "DOCX" && format !== "XLSX") {
      toast.error("Choose a PDF, DOCX, or XLSX document.");
      return;
    }
    if (!uploadFile.size || uploadFile.size > 20 * 1024 * 1024) {
      toast.error("Choose a non-empty file no larger than 20 MB.");
      return;
    }
    setUploadBusy(true);
    const client = createClient();
    let uploadedPath: string | null = null;
    try {
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError || !auth.user) throw new Error("Please sign in to upload documents.");
      const existing = documents.find((row) => row.id === uploadExistingId);
      const countryCode = existing?.countryCode || folder.countryCode ||
        (folder.jurisdiction.includes("Zimbabwe") ? "ZW" : folder.jurisdiction.includes("Zambia") ? "ZM" : "ALL");
      const path = `${countryCode}/${auth.user.id}/${createClientId()}`;
      const { error: uploadError } = await client.storage.from("repository-documents").upload(path, uploadFile);
      if (uploadError) throw uploadError;
      uploadedPath = path;
      const newDoc: TemplateDoc = {
        ...existing,
        id: uploadExistingId || createClientId(),
        folderId: uploadFolderId,
        name: uploadDocName.trim(),
        documentRef: uploadDocRef.trim() || `DOC-${Date.now()}`,
        fileFormat: format,
        fileSize: `${(uploadFile.size / 1024 / 1024).toFixed(2)} MB`,
        lastUpdated: new Date().toISOString().slice(0, 10),
        expiryDate: hasExpiry ? uploadExpiryDate : null,
        downloadsCount: existing?.downloadsCount || 0,
        description: uploadDescription.trim(),
        countryCode,
        storagePath: path,
        storageBucket: "repository-documents",
        fileName: uploadFile.name,
        sizeBytes: uploadFile.size,
      };
      const response = await fetch("/api/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upload_document", doc: newDoc }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || "Could not save the document.");
      uploadedPath = null;
      setDocuments((rows) => [newDoc, ...rows.filter((row) => row.id !== newDoc.id)]);
      setIsUploadOpen(false);
      setUploadFile(null);
      toast.success("Document uploaded and ready to link to checklists");
    } catch (error) {
      if (uploadedPath) await client.storage.from("repository-documents").remove([uploadedPath]);
      toast.error(error && typeof error === "object" && "message" in error ? String(error.message) : "Document upload failed.");
    } finally {
      setUploadBusy(false);
    }
  };

  // Handle Document Renewal (Database update)
  const handleConfirmRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewDoc) return;

    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "renew_document",
          docId: renewDoc.id,
          newExpiryDate: renewExpiryDate,
          newRef: renewNewRef.trim() || renewDoc.documentRef,
        }),
      });

      if (res.ok) {
        setDocuments(
          documents.map((d) => {
            if (d.id === renewDoc.id) {
              return {
                ...d,
                expiryDate: renewExpiryDate,
                documentRef: renewNewRef.trim() || d.documentRef,
                lastUpdated: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
              };
            }
            return d;
          })
        );

        toast.success("License renewed in database.", {
          description: `${renewDoc.name} validity extended to ${renewExpiryDate}.`,
        });
        setRenewDoc(null);
      }
    } catch {
      toast.error("Failed to update license in database.");
    }
  };

  const handleDownload = async (doc: TemplateDoc) => {
    if (!doc.storagePath) {
      toast.error("This record has no file yet. Attach the original document first.");
      return;
    }
    try {
      const { data, error } = await createClient().storage.from("repository-documents").download(doc.storagePath);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.fileName || doc.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const response = await fetch("/api/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "increment_download", docId: doc.id }),
      });
      if (response.ok) setDocuments((rows) => rows.map((row) => row.id === doc.id
        ? { ...row, downloadsCount: row.downloadsCount + 1 } : row));
    } catch {
      toast.error("Could not download the document.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/60 pb-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-xl tracking-tight text-foreground sm:text-2xl">
              Documents & Specifications
            </h1>
            <Badge variant="outline" className="text-xs font-mono font-medium">
              Database Repository
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Create custom folder directories, file proposal deliverables, and track statutory document expiration dates directly in the database.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canDeleteRepositoryItems && documents.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearAllDocuments}
              title="Clear all documents from the repository"
            >
              <Trash2 data-icon="inline-start" />
              Clear All
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={loadRepositoryData}
            disabled={isLoading}
            className="h-8 gap-1 text-xs"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          {/* Create Custom Folder */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsNewFolderOpen(true)}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <FolderPlus className="size-3.5" />
            <span>Create Folder</span>
          </Button>

          {/* Upload Document */}
          <Button
            size="sm"
            onClick={() => openUpload()}
            className="h-8 gap-1.5 text-xs font-semibold bg-primary text-primary-foreground shadow-xs"
          >
            <Upload className="size-3.5" />
            <span>Upload Document</span>
          </Button>
        </div>
      </div>

      {/* Critical Expiration Alert Banner */}
      {(expiredCount > 0 || expiringSoonCount > 0) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <strong className="text-foreground font-semibold block">
                Statutory Expiration Notice:
              </strong>
              <span className="text-muted-foreground">
                {expiredCount > 0 ? `${expiredCount} document(s) have expired` : ""}
                {expiredCount > 0 && expiringSoonCount > 0 ? " and " : ""}
                {expiringSoonCount > 0 ? `${expiringSoonCount} document(s) expire within 30 days` : ""}.
                Renew licenses prior to proposal submission.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpiryFilter("EXPIRING_SOON")}
              className="h-7 text-xs border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
            >
              View Expiring Items
            </Button>
            {expiredCount > 0 && (
              <Button
                size="sm"
                onClick={() => setExpiryFilter("EXPIRED")}
                className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white font-medium"
              >
                View Expired Items
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Metrics Overview Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Directories</span>
              <Folder className="size-4 text-primary" />
            </div>
            <p className="mt-1.5 text-xl font-bold font-mono text-foreground">{displayedFolders.length}</p>
            <p className="text-[11px] text-muted-foreground">
              {displayedFolders.filter((f) => f.isCustom).length} user-created folders
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Database Records</span>
              <FileText className="size-4 text-foreground" />
            </div>
            <p className="mt-1.5 text-xl font-bold font-mono text-foreground">{countryDocuments.length}</p>
            <p className="text-[11px] text-muted-foreground">Templates, licenses & specs</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Expiring in &le; 30 Days</span>
              <Clock className="size-4 text-amber-500" />
            </div>
            <p className="mt-1.5 text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {expiringSoonCount}
            </p>
            <p className="text-[11px] text-muted-foreground">Requires upcoming renewal</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Expired Licenses</span>
              <ShieldAlert className="size-4 text-red-500" />
            </div>
            <p className="mt-1.5 text-xl font-bold font-mono text-red-600 dark:text-red-400">
              {expiredCount}
            </p>
            <p className="text-[11px] text-muted-foreground">Urgent renewal mandatory</p>
          </CardContent>
        </Card>
      </div>

      {/* DIRECTORIES GRID VIEW */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Folder className="size-4 text-primary" />
            <span>Folder Directories</span>
          </h2>
          {activeFolderId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveFolderId(null)}
              className="h-7 px-2 text-xs text-primary gap-1"
            >
              <ArrowLeft className="size-3" />
              <span>Show All Directories</span>
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {displayedFolders.length === 0 ? (
            <div className="col-span-full p-8 border border-dashed border-border/80 rounded-xl text-center flex flex-col items-center justify-center space-y-2 bg-muted/10">
              <FolderPlus className="size-8 text-muted-foreground/60" />
              <p className="text-xs font-semibold text-foreground">No directory folders found</p>
              <p className="text-[11px] text-muted-foreground max-w-sm">
                Create custom folders to organize company registrations, technical specs, and financial models.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsNewFolderOpen(true)}
                className="h-7 text-xs gap-1.5 mt-1 font-semibold"
              >
                <FolderPlus className="size-3.5" />
                <span>Create First Folder</span>
              </Button>
            </div>
          ) : (
            displayedFolders.map((f) => {
              const count = getFolderFileCount(f.id);
              const isSelected = activeFolderId === f.id;

              return (
                <div
                  key={f.id}
                  onClick={() => setActiveFolderId(isSelected ? null : f.id)}
                  className={`flex flex-col text-left p-4 rounded-xl border transition-all space-y-2 shadow-2xs cursor-pointer group relative ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/70 bg-card hover:bg-muted/40 hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex size-8 items-center justify-center rounded-lg ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-primary/10 text-primary group-hover:bg-primary/20"
                        } transition-colors`}
                      >
                        {isSelected ? <FolderOpen className="size-4" /> : <Folder className="size-4" />}
                      </div>
                      <div>
                        <h3 className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {f.name}
                        </h3>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {count} {count === 1 ? "document" : "documents"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {f.isCustom && (
                        <Badge variant="outline" className="text-[9px] font-mono border-primary/30 text-primary">
                          Custom
                        </Badge>
                      )}
                      <Badge variant={isSelected ? "default" : "outline"} className="text-[10px] font-mono">
                        {isSelected ? "Active" : "Open"}
                      </Badge>
                      {canDeleteRepositoryItems && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-xs"
                          onClick={(e) => handleDeleteFolder(f.id, e)}
                          disabled={count > 0}
                          title={count > 0 ? "Empty folder first to delete" : "Delete empty folder"}
                          aria-label={`Delete ${f.name}`}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                    {f.description}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* DOCUMENT LIST TABLE */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileCheck className="size-4 text-primary" />
                <span>
                  {activeFolder ? activeFolder.name : "All Document Files"}
                </span>
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {displayedDocuments.length} files
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                {activeFolder
                  ? activeFolder.description
                  : "Database records of statutory certifications, technical specifications, and financial workbooks."}
              </CardDescription>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-md border border-border/70 p-0.5 bg-muted/30 text-xs">
                <button
                  type="button"
                  onClick={() => setExpiryFilter("ALL")}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    expiryFilter === "ALL" ? "bg-background text-foreground shadow-2xs font-semibold" : "text-muted-foreground"
                  }`}
                >
                  All Statuses
                </button>
                <button
                  type="button"
                  onClick={() => setExpiryFilter("EXPIRING_SOON")}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    expiryFilter === "EXPIRING_SOON" ? "bg-amber-500 text-white font-semibold" : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  Expiring Soon ({expiringSoonCount})
                </button>
                <button
                  type="button"
                  onClick={() => setExpiryFilter("EXPIRED")}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    expiryFilter === "EXPIRED" ? "bg-red-600 text-white font-semibold" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  Expired ({expiredCount})
                </button>
                <button
                  type="button"
                  onClick={() => setExpiryFilter("ACTIVE")}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    expiryFilter === "ACTIVE" ? "bg-background text-foreground shadow-2xs font-semibold" : "text-muted-foreground"
                  }`}
                >
                  Valid
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3 text-muted-foreground" />
                <Input
                  placeholder="Search files or reference..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 w-48 sm:w-60 pl-8 text-xs shadow-2xs"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 sm:p-6 sm:pt-0">
          <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="border-b border-border/60 bg-muted/40 text-muted-foreground">
                  <tr>
                    <th scope="col" className="py-3 px-4 font-semibold text-foreground min-w-[280px]">
                      Document Name & Reference
                    </th>
                    <th scope="col" className="py-3 px-4 font-semibold text-foreground min-w-[170px]">
                      Directory Folder
                    </th>
                    <th scope="col" className="py-3 px-4 font-semibold text-foreground text-center min-w-[70px]">
                      Format
                    </th>
                    <th scope="col" className="py-3 px-4 font-semibold text-foreground min-w-[80px]">
                      Size
                    </th>
                    <th scope="col" className="py-3 px-4 font-semibold text-foreground min-w-[160px]">
                      Expiration & Compliance Status
                    </th>
                    <th scope="col" className="py-3 px-4 font-semibold text-foreground text-right min-w-[130px]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="size-4 animate-spin text-primary" />
                          <span>Connecting to admin database...</span>
                        </div>
                      </td>
                    </tr>
                  ) : displayedDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center">
                        <div className="max-w-md mx-auto flex flex-col items-center justify-center text-center space-y-3">
                          <div className="p-3.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            <Files className="size-6" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm text-foreground">
                              {searchTerm || expiryFilter !== "ALL" || activeFolderId
                                ? "No matching documents"
                                : "No documents in repository"}
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                              {searchTerm || expiryFilter !== "ALL"
                                ? "Try adjusting your search query or status filter to locate existing records."
                                : activeFolder
                                ? `The folder "${activeFolder.name}" has no documents yet. Upload compliance files, specs, or schedules.`
                                : "Start building your tender repository by uploading company registrations, tax clearances, technical specifications, and templates."}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            {searchTerm || expiryFilter !== "ALL" || activeFolderId ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSearchTerm("");
                                  setExpiryFilter("ALL");
                                  setActiveFolderId(null);
                                }}
                                className="h-8 text-xs"
                              >
                                Reset Filters
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              onClick={() => openUpload()}
                              className="h-8 gap-1.5 text-xs font-semibold bg-primary text-primary-foreground"
                            >
                              <Upload className="size-3.5" />
                              <span>Upload Document</span>
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    displayedDocuments.map((doc) => {
                      const folderObj = folders.find((f) => f.id === doc.folderId);
                      const evaluation = evaluateExpiry(doc.expiryDate);

                      return (
                        <tr key={doc.id} className="transition-colors hover:bg-muted/30">
                          {/* Name & Reference */}
                          <td className="py-3 px-4 align-top">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                                  {doc.documentRef}
                                </span>
                                {doc.countryCode !== "ALL" && (
                                  <Badge variant="outline" className="text-[9px] font-mono">
                                    {doc.countryCode}
                                  </Badge>
                                )}
                              </div>
                              <h4 className="font-semibold text-foreground text-xs">{doc.name}</h4>
                              <p className="text-[11px] text-muted-foreground line-clamp-1">
                                {doc.description}
                              </p>
                            </div>
                          </td>

                          {/* Folder */}
                          <td className="py-3 px-4 align-top">
                            <button
                              type="button"
                              onClick={() => setActiveFolderId(doc.folderId)}
                              className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1.5 transition-colors"
                            >
                              <Folder className="size-3 text-primary shrink-0" />
                              <span className="truncate">{folderObj?.name || "General"}</span>
                            </button>
                          </td>

                          {/* Format */}
                          <td className="py-3 px-4 align-top text-center">
                            <span
                              className={`inline-block font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                doc.fileFormat === "PDF"
                                  ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
                                  : doc.fileFormat === "XLSX"
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                                  : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
                              }`}
                            >
                              {doc.fileFormat}
                            </span>
                          </td>

                          {/* Size */}
                          <td className="py-3 px-4 align-top font-mono text-[11px] text-muted-foreground">
                            {doc.storagePath ? doc.fileSize : "No file attached"}
                          </td>

                          {/* Expiration Status */}
                          <td className="py-3 px-4 align-top">
                            <div className="space-y-1">
                              {evaluation.status === "EXPIRED" && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-semibold border-red-500/40 text-red-600 dark:text-red-400 bg-red-500/10 flex items-center gap-1"
                                >
                                  <ShieldAlert className="size-3" />
                                  <span>{evaluation.label}</span>
                                </Badge>
                              )}

                              {evaluation.status === "EXPIRING_SOON" && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-semibold border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 flex items-center gap-1"
                                >
                                  <Clock className="size-3" />
                                  <span>{evaluation.label}</span>
                                </Badge>
                              )}

                              {evaluation.status === "ACTIVE" && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-medium border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 flex items-center gap-1"
                                >
                                  <CheckCircle2 className="size-3" />
                                  <span>{evaluation.label}</span>
                                </Badge>
                              )}

                              {evaluation.status === "PERMANENT" && (
                                <span className="text-[10px] font-mono text-muted-foreground block">
                                  Permanent (No Expiry)
                                </span>
                              )}

                              <span className="text-[10px] font-mono text-muted-foreground block">
                                Verified: {doc.lastUpdated}
                              </span>
                            </div>
                          </td>

                          {/* Action */}
                          <td className="py-3 px-4 align-top text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {doc.expiryDate && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setRenewDoc(doc);
                                    setRenewExpiryDate("2027-12-31");
                                    setRenewNewRef(doc.documentRef);
                                  }}
                                  className="h-7 px-2 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 gap-1"
                                  title="Renew this expiring license"
                                >
                                  <RefreshCw className="size-3" />
                                  <span>Renew</span>
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => doc.storagePath ? handleDownload(doc) : openUpload(doc)}
                                className="h-7 px-2.5 text-xs font-medium gap-1 hover:bg-primary hover:text-primary-foreground transition-all shadow-2xs"
                              >
                                <Download className="size-3" />
                                <span>{doc.storagePath ? "Download" : "Attach file"}</span>
                              </Button>

                              {canDeleteRepositoryItems && (
                                <Button
                                  size="icon-sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteDocument(doc.id, doc.name)}
                                  title="Delete document"
                                  aria-label={`Delete ${doc.name}`}
                                >
                                  <Trash2 />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MODAL 1: CREATE CUSTOM FOLDER */}
      <Dialog open={isNewFolderOpen} onOpenChange={setIsNewFolderOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Create New Folder Directory</DialogTitle>
            <DialogDescription className="text-xs">
              Save a custom directory to the admin database for organizing tender packs.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateFolder} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Folder Name</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. ZESA Substation Bid Packages 2026"
                className="h-8 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Jurisdiction Scope</Label>
              <select
                value={newFolderJurisdiction}
                onChange={(e) => setNewFolderJurisdiction(e.target.value as any)}
                className="w-full h-8 px-2.5 text-xs rounded-md border border-input bg-background font-medium"
              >
                {userCountry !== "ZM" && <option value="Zimbabwe (PRAZ)">Zimbabwe (PRAZ)</option>}
                {userCountry !== "ZW" && <option value="Zambia (ZPPA)">Zambia (ZPPA)</option>}
                {userCountry === "ALL" && <option value="Regional (SADC)">Regional (SADC) / All</option>}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input
                value={newFolderDesc}
                onChange={(e) => setNewFolderDesc(e.target.value)}
                placeholder="Brief purpose of this document collection..."
                className="h-8 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsNewFolderOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-primary text-primary-foreground font-semibold">
                Create in Database
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: UPLOAD DOCUMENT */}
      <Dialog open={isUploadOpen} onOpenChange={(value) => { if (!uploadBusy) setIsUploadOpen(value); }}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Upload Document to Repository</DialogTitle>
            <DialogDescription className="text-xs">
              File a statutory license, technical schedule, or financial model directly into the database.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddDocument} className="space-y-4 pt-2">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="repository-upload-file">Document file</FieldLabel>
                <Input id="repository-upload-file" type="file" accept=".pdf,.docx,.xlsx" required disabled={uploadBusy}
                  onChange={(event) => setUploadFile(event.target.files?.[0] || null)} />
                <p className="text-xs text-muted-foreground">PDF, DOCX, or XLSX. Maximum 20 MB.</p>
              </Field>
            </FieldGroup>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Target Folder</Label>
              <select
                value={uploadFolderId}
                onChange={(e) => setUploadFolderId(e.target.value)}
                className="w-full h-8 px-2.5 text-xs rounded-md border border-input bg-background font-medium"
              >
                {displayedFolders.length === 0 ? (
                  <option value="">No folders available - please create a folder first</option>
                ) : (
                  displayedFolders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.isCustom ? "(Custom Folder)" : ""}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Document Title</Label>
              <Input
                value={uploadDocName}
                onChange={(e) => setUploadDocName(e.target.value)}
                placeholder="e.g. ZIMRA ITF 263 Tax Clearance Certificate (Q4 2026)"
                className="h-8 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Document Reference No.</Label>
                <Input
                  value={uploadDocRef}
                  onChange={(e) => setUploadDocRef(e.target.value)}
                  placeholder="e.g. ZIMRA-ITF263-2026-Q4"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="repository-file-format" className="text-xs">File Format</Label>
                <Input id="repository-file-format" readOnly
                  value={uploadFile?.name.split(".").pop()?.toUpperCase() || "Choose a file"} />
              </div>
            </div>

            {/* Expiration Tracking Checkbox & Date Picker */}
            <div className="p-3 rounded-md border border-border/60 bg-muted/20 space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasExpiryToggle"
                  checked={hasExpiry}
                  onChange={(e) => setHasExpiry(e.target.checked)}
                  className="rounded border-input text-primary"
                />
                <label htmlFor="hasExpiryToggle" className="text-xs font-semibold text-foreground cursor-pointer">
                  This document has an expiration date (e.g. Tax Clearance, Bid Bond, Annual PRAZ)
                </label>
              </div>

              {hasExpiry && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs shrink-0">Expiry Date:</Label>
                    <Input
                      type="date"
                      value={uploadExpiryDate}
                      onChange={(e) => setUploadExpiryDate(e.target.value)}
                      className="h-8 text-xs font-mono w-48"
                      required={hasExpiry}
                    />
                  </div>
                  <div className="flex gap-1.5 text-[10px]">
                    <span className="text-muted-foreground self-center">Quick Presets:</span>
                    <button
                      type="button"
                      onClick={() => setUploadExpiryDate("2026-09-30")}
                      className="px-2 py-0.5 rounded border bg-card hover:bg-muted font-mono"
                    >
                      End of Q3 2026
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadExpiryDate("2026-12-31")}
                      className="px-2 py-0.5 rounded border bg-card hover:bg-muted font-mono"
                    >
                      End of Year 2026
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Document Description & Scope</Label>
              <Input
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Brief summary of what this document certifies..."
                className="h-8 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" disabled={uploadBusy} onClick={() => setIsUploadOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={uploadBusy || !uploadFile} className="bg-primary text-primary-foreground font-semibold">
                {uploadBusy ? "Uploading…" : "Save Document"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: RENEW EXPIRING DOCUMENT */}
      {renewDoc && (
        <Dialog open={!!renewDoc} onOpenChange={(open) => !open && setRenewDoc(null)}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Renew Statutory License</DialogTitle>
              <DialogDescription className="text-xs">
                Update the validity period and file reference for <strong>{renewDoc.name}</strong>.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleConfirmRenewal} className="space-y-4 pt-2">
              <div className="p-2.5 rounded bg-muted/40 border text-xs space-y-1 font-mono">
                <p><strong>Current Reference:</strong> {renewDoc.documentRef}</p>
                <p><strong>Previous Expiration:</strong> {renewDoc.expiryDate || "None"}</p>
                <p><strong>Format:</strong> {renewDoc.fileFormat}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">New Expiration Date</Label>
                <Input
                  type="date"
                  value={renewExpiryDate}
                  onChange={(e) => setRenewExpiryDate(e.target.value)}
                  className="h-8 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Updated Document Reference Number</Label>
                <Input
                  value={renewNewRef}
                  onChange={(e) => setRenewNewRef(e.target.value)}
                  placeholder="e.g. ZIMRA-ITF263-2027-Q1"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setRenewDoc(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                  Confirm Renewal
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
