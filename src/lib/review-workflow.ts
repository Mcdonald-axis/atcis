import type { WorkflowStepConfig } from "@/lib/server-db";

// Matches the enforced tender sequence in the submission workflow migration.
export const TENDER_REVIEW_WORKFLOW: WorkflowStepConfig[] = [
  { id: "step-hod", name: "HOD Review", requiredRole: "hod", roleLabel: "Head of Department",
    description: "Reviews the AM's completed checklist and reference documents.", order: 1, isRequired: true },
  { id: "step-tech", name: "Technical Review", requiredRole: "technical_review", roleLabel: "Lead Engineer / Architect",
    description: "Reviews the technical content after HOD approval.", order: 2, isRequired: true },
  { id: "step-committee", name: "Committee Review", requiredRole: "committee", roleLabel: "Executive Bid Committee",
    description: "Gives final approval and releases the complete document ZIP.", order: 3, isRequired: true },
];
