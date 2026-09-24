export type ColumnId =
  | "new"
  | "opportunity"
  | "in-progress"
  | "submitted"
  | "won"
  | "contract-signing"
  | "in-delivery"
  | "delivered"
  | "lost"
  | "cancelled";

export type Column = {
  id: ColumnId;
  title: string;
  badgeTone?: string;
};

export type TaskTeam =
  | "Electrical Grid"
  | "Civil & Roads"
  | "ICT & Telecoms"
  | "Solar & Energy"
  | "Water & Sanitation"
  | "Healthcare"
  | "Compliance & Legal";

export type TaskPriority = "High" | "Medium" | "Low" | "Urgent";

export type TaskInsightLabel = "Attachments" | "Comments" | "Documents";

export type TaskInsight = {
  label: TaskInsightLabel;
  count: number;
};

export type TaskOwnerProfile = {
  name: string;
  tone: string;
};

export type TaskDocument = {
  id: string;
  name: string;
  size: number;
  storagePath: string;
  confidence?: number;
};

export type Task = {
  id: string;
  refNo?: string;
  countryCode?: "ZW" | "ZM";
  title: string;
  description: string;
  entity?: string;
  /** Value manually entered in the pipeline editor and used by pipeline reporting. */
  pipelineValue?: number;
  estimatedValue?: number;
  amountAwarded?: number;
  actualCost?: number;
  grossMargin?: number;
  currency?: string;
  sourcePortal?: string;
  portalUrl?: string;
  rfqDocument?: TaskDocument;
  /** Database owner of this task when it is shown in a combined oversight board. */
  pipelineOwnerEmail?: string;
  lessonsLearned?: string;
  deliveryStatusNotes?: string;
  winLossReason?: string;
  contractRef?: string;
  leadPartner?: string;
  satisfactionScore?: number;
  customNotes?: string;
  aiScore?: number;
  priority: TaskPriority;
  dueDate: string;
  progress: number;
  owner: TaskOwnerProfile;
  team: TaskTeam;
  insights: TaskInsight[];
};

export type BoardState = Record<ColumnId, Task[]>;
