import "server-only";
import { createClient } from "@/lib/supabase/server";

type JsonRecord = Record<string, unknown>;
type PipelineBoard = Record<string, Array<JsonRecord & { id: string }>>;

function attachPipelineOwner(board: PipelineBoard, pipelineOwnerEmail: string): PipelineBoard {
  return Object.fromEntries(
    Object.entries(board).map(([column, tasks]) => [
      column,
      Array.isArray(tasks) ? tasks.map((task) => ({ ...task, pipelineOwnerEmail })) : [],
    ]),
  );
}

async function records<T = JsonRecord>(kind: string): Promise<T[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("app_records")
    .select("payload")
    .eq("kind", kind)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map((row) => row.payload as T);
}

async function save(kind: string, id: string, payload: object, remove = false): Promise<boolean> {
  const client = await createClient();
  const { error } = await client.rpc("save_app_record", {
    p_kind: kind,
    p_id: id,
    p_payload: payload,
    p_delete: remove,
  });
  if (error) throw new Error(error.message);
  return true;
}

export const DatabaseService = {
  async getAssignments(): Promise<DbAssignment[]> {
    return await records<DbAssignment>("assignment");
  },
  async upsertAssignment(item: DbAssignment) {
    return save("assignment", item.id, item);
  },
  async getCombinedPipelineBoard(): Promise<PipelineBoard | null> {
    const client = await createClient();
    const { data, error } = await client
      .from("app_records")
      .select("id,owner_email,payload")
      .eq("kind", "pipeline")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!data?.length) return null;
    const result: PipelineBoard = {};
    const seen = new Set<string>();
    for (const record of data) {
      const board = record.payload as { board?: PipelineBoard };
      const pipelineOwnerEmail = String(record.owner_email || record.id)
        .trim()
        .toLowerCase();
      for (const [column, tasks] of Object.entries(board.board || {})) {
        result[column] ??= [];
        if (Array.isArray(tasks))
          for (const task of tasks) {
            if (task?.id && !seen.has(task.id)) {
              seen.add(task.id);
              result[column].push({ ...task, pipelineOwnerEmail });
            }
          }
      }
    }
    return result;
  },
  async getUserPipelineBoard(email: string): Promise<JsonRecord | null> {
    const normalized = email.trim().toLowerCase();
    if (["all", "combined"].includes(normalized)) return this.getCombinedPipelineBoard();
    const client = await createClient();
    const { data, error } = await client
      .from("app_records")
      .select("payload")
      .eq("kind", "pipeline")
      .eq("id", normalized)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const directBoard = data?.payload?.board as Record<string, any[]> | null;
    const hasDirectTasks =
      directBoard &&
      typeof directBoard === "object" &&
      Object.values(directBoard).some((arr) => Array.isArray(arr) && arr.length > 0);

    if (hasDirectTasks) {
      return attachPipelineOwner(directBoard as PipelineBoard, normalized);
    }

    // Fallback: extract member's tasks from the aggregated combined pipeline board
    const combined = await this.getCombinedPipelineBoard();
    if (combined && typeof combined === "object") {
      const derived: Record<string, any[]> = {};
      const emailPrefix = normalized.split("@")[0].split(".")[0];

      for (const [column, tasks] of Object.entries(combined)) {
        if (!Array.isArray(tasks)) {
          derived[column] = [];
          continue;
        }
        derived[column] = tasks.filter((task: any) => {
          if (!task) return false;
          const ownerEmail = String(task.ownerEmail || "")
            .toLowerCase()
            .trim();
          const assignedEmail = String(task.assignedToEmail || "")
            .toLowerCase()
            .trim();
          if (ownerEmail === normalized || assignedEmail === normalized) return true;

          const ownerName = String(task.owner?.name || "")
            .toLowerCase()
            .trim();
          const assignedName = String(task.assignedToName || "")
            .toLowerCase()
            .trim();
          const hodName = String(task.assignedByHodName || "")
            .toLowerCase()
            .trim();

          if (emailPrefix.length > 2) {
            if (
              ownerName.includes(emailPrefix) ||
              assignedName.includes(emailPrefix) ||
              hodName.includes(emailPrefix)
            ) {
              return true;
            }
          }
          return false;
        });
      }

      const hasDerivedTasks = Object.values(derived).some((arr) => arr.length > 0);
      if (hasDerivedTasks) {
        return derived;
      }
    }

    return directBoard ? attachPipelineOwner(directBoard as PipelineBoard, normalized) : null;
  },
  async getStoredUserPipelineBoard(email: string): Promise<JsonRecord | null> {
    const normalized = email.trim().toLowerCase();
    const client = await createClient();
    const { data, error } = await client
      .from("app_records")
      .select("payload")
      .eq("kind", "pipeline")
      .eq("id", normalized)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.payload?.board as JsonRecord | null) ?? null;
  },
  async saveUserPipelineBoard(email: string, board: JsonRecord) {
    return save("pipeline", email.trim().toLowerCase(), { board });
  },
  async getChecklistSubmissions(): Promise<ChecklistSubmission[]> {
    return await records<ChecklistSubmission>("review");
  },
  async getWorkflowConfig(): Promise<WorkflowStepConfig[]> {
    const rows = await records<{ id: string; steps: WorkflowStepConfig[] }>("workflow");
    return rows.find((row) => row.id === "default")?.steps || DEFAULT_WORKFLOW_CONFIG;
  },
  async saveWorkflowConfig(steps: WorkflowStepConfig[]) {
    return save("workflow", "default", { steps });
  },
  async getLiveTendersForChat(): Promise<JsonRecord[]> {
    const client = await createClient();
    const { data, error } = await client
      .from("tenders")
      .select("payload")
      .eq("status", "live")
      .order("scraped_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data || []).map((row) => ({
      ReferenceNumber: row.payload.referenceNumber,
      Title: row.payload.title,
      ProcuringEntity: row.payload.procuringEntity,
      ClosingDate: row.payload.closingDate,
    }));
  },
  async getRepositoryFolders() {
    return (await records("folder")).map((folder) => ({
      ...folder,
      jurisdiction:
        ({ ZW: "Zimbabwe (PRAZ)", ZM: "Zambia (ZPPA)", ALL: "Regional (SADC)" } as Record<string, string>)[
          String(folder.jurisdiction)
        ] || folder.jurisdiction,
    }));
  },
  async saveRepositoryFolder(folder: JsonRecord & { id: string }) {
    const jurisdiction = String(folder.jurisdiction || "ALL");
    let countryCode = "ALL";
    if (jurisdiction.includes("Zimbabwe")) countryCode = "ZW";
    if (jurisdiction.includes("Zambia")) countryCode = "ZM";
    return save("folder", folder.id, { ...folder, countryCode });
  },
  async deleteRepositoryFolder(id: string) {
    return save("folder", id, {}, true);
  },
  async getRepositoryDocuments() {
    return records("document");
  },
  async saveRepositoryDocument(doc: JsonRecord & { id: string }) {
    return save("document", doc.id, doc);
  },
  async renewRepositoryDocument(id: string, expiry: string, ref?: string) {
    const doc = (await records("document")).find((row) => row.id === id);
    if (!doc) throw new Error("Document not found");
    return save("document", id, {
      ...doc,
      expiryDate: expiry,
      documentRef: ref ?? doc.documentRef,
      lastUpdated: new Date().toISOString().slice(0, 10),
    });
  },
  async incrementDocumentDownload(id: string) {
    const client = await createClient();
    const { error } = await client.rpc("increment_document_download", { p_id: id });
    if (error) throw new Error(error.message);
    return true;
  },
  async deleteRepositoryDocument(id: string) {
    return save("document", id, {}, true);
  },
  async clearAllRepositoryDocuments() {
    const client = await createClient();
    const { error } = await client.from("app_records").delete().eq("kind", "document");
    if (error) throw new Error(error.message);
    return true;
  },
};

export interface DbAssignment {
  id: string;
  country: "ZW" | "ZM";
  tenderRef: string;
  tenderTitle: string;
  entity: string;
  estimatedValue: number;
  assignedToName: string;
  assignedToEmail: string;
  assignedToId: string;
  assignedByHodName: string;
  taskTitle: string;
  instructions: string;
  dueDate: string;
  priority: "High" | "Medium" | "Urgent";
  status: string;
  progressPercentage: number;
  addedToPipeline: boolean;
  pipelineTaskId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ChecklistDocItem {
  id: string;
  name: string;
  category: string;
  fileName: string;
  fileSize: string;
  status: "Verified" | "Pending Review" | "Rejected";
  verifiedDate?: string;
  fileUrl?: string;
}

export interface ReviewChecklistRequirement {
  id: string;
  item: string;
  status: "Mandatory" | "Conditional" | "Standard" | "Optional";
  description: string;
  category: string;
}

export interface ApprovalStepRecord {
  stepId: string;
  stepName: string;
  requiredRole: string;
  assignedApproverName?: string;
  status: "Pending" | "Approved" | "Revision Requested" | "Declined" | "Waiting";
  approvedByName?: string;
  approvedByEmail?: string;
  approvedAt?: string;
  comments?: string;
}

export interface ChecklistSubmission {
  id: string;
  checklistId?: string;
  checklistName?: string;
  tenderKey?: string;
  revision?: number;
  history?: { revision: number; submittedAt: string; approvalSteps: ApprovalStepRecord[] }[];
  tenderRef: string;
  tenderTitle: string;
  entity: string;
  countryCode: "ZW" | "ZM";
  bidAmount: number;
  submittedByEmail: string;
  submittedByName: string;
  submittedAt: string;
  currentStepIndex: number;
  overallStatus: "In Review" | "Approved for Submission" | "Revision Requested" | "Declined";
  checklist: ChecklistDocItem[];
  requirements?: ReviewChecklistRequirement[];
  approvalSteps: ApprovalStepRecord[];
  updatedAt?: string;
}

export interface WorkflowStepConfig {
  id: string;
  name: string;
  requiredRole: "hod" | "technical_review" | "committee" | "country_admin" | "super_admin";
  roleLabel: string;
  description: string;
  order: number;
  isRequired: boolean;
}

export const DEFAULT_WORKFLOW_CONFIG: WorkflowStepConfig[] = [
  {
    id: "step-hod",
    name: "Head of Department (HOD) Technical Review",
    requiredRole: "hod",
    roleLabel: "Head of Dept (HOD)",
    description: "Verifies technical BoQ specifications, OEM warranty terms, and execution schedule.",
    order: 1,
    isRequired: true,
  },
  {
    id: "step-tech",
    name: "Technical & Engineering Compliance Audit",
    requiredRole: "technical_review",
    roleLabel: "Technical Reviewer",
    description: "Evaluates engineering calculations, specification tolerances, and safety standards.",
    order: 2,
    isRequired: true,
  },
  {
    id: "step-committee",
    name: "Bid Evaluation Committee & Governance",
    requiredRole: "committee",
    roleLabel: "Committee Chair",
    description: "Audits procurement act compliance, ZIMRA tax clearance, bank guarantees, and pricing margins.",
    order: 3,
    isRequired: true,
  },
  {
    id: "step-admin",
    name: "Country Executive / Admin Sign-Off",
    requiredRole: "country_admin",
    roleLabel: "Country Admin",
    description: "Final executive sign-off releasing the approved document bundle for portal submission.",
    order: 4,
    isRequired: false,
  },
];
