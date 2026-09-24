import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/server";

type Json = Record<string, unknown>;

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export async function GET() {
  try {
    const { user, profile } = await requireUser();
    if (profile.role !== "super_admin") {
      return NextResponse.json({ success: false, error: "Super administrator access is required" }, { status: 403 });
    }

    const admin = createAdminClient();
    const [authResult, profilesResult, recordsResult, auditResult] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from("profiles").select("id,email,name,role,country,department,active,must_change_password"),
      admin.from("app_records").select("kind,owner_email,payload").in("kind", ["assignment", "review", "pipeline"]),
      admin
        .from("admin_audit_logs")
        .select("id,action,actor_id,target_id,details,created_at")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    if (authResult.error) throw authResult.error;
    if (profilesResult.error) throw profilesResult.error;
    if (recordsResult.error) throw recordsResult.error;

    const profiles = profilesResult.data ?? [];
    const assignments = (recordsResult.data ?? [])
      .filter((row) => row.kind === "assignment")
      .map((row) => row.payload as Json);
    const reviewRecords = (recordsResult.data ?? []).filter((row) => row.kind === "review");
    const reviews = reviewRecords.map((row) => row.payload as Json);
    const pipelines = (recordsResult.data ?? []).filter((row) => row.kind === "pipeline");
    const now = Date.now();

    const users = profiles.map((profileRow) => {
      const authUser = authResult.data.users.find((candidate) => candidate.id === profileRow.id);
      const owned = assignments.filter(
        (assignment) => String(assignment.assignedToEmail ?? "").toLowerCase() === profileRow.email.toLowerCase(),
      );
      const open = owned.filter(
        (assignment) => !["completed", "closed"].includes(String(assignment.status).toLowerCase()),
      );
      const pendingReviews = reviews.filter((review) => {
        if (review.overallStatus !== "In Review") return false;
        const steps = Array.isArray(review.approvalSteps) ? (review.approvalSteps as Json[]) : [];
        return steps.some(
          (step) =>
            step.status === "Pending" &&
            (step.requiredRole === profileRow.role || profileRow.role === "super_admin") &&
            (profileRow.country === "ALL" || review.countryCode === profileRow.country),
        );
      }).length;
      const ownedPendingReviews = reviewRecords.filter(
        (record) =>
          String(record.owner_email ?? "")
            .trim()
            .toLowerCase() === profileRow.email.toLowerCase() && (record.payload as Json).overallStatus === "In Review",
      ).length;
      const progressValues = open.map((assignment) => Number(assignment.progressPercentage ?? 0));
      const pipelineRecord = pipelines.find(
        (record) =>
          String(record.owner_email ?? "")
            .trim()
            .toLowerCase() === profileRow.email.toLowerCase(),
      );
      const pipelineBoard = (pipelineRecord?.payload as Json | undefined)?.board;
      const activePipelineItems =
        pipelineBoard && typeof pipelineBoard === "object" && !Array.isArray(pipelineBoard)
          ? ["new", "opportunity", "in-progress", "submitted", "won", "contract-signing", "in-delivery"].reduce(
              (total, stage) => {
                const items = (pipelineBoard as Json)[stage];
                return total + (Array.isArray(items) ? items.length : 0);
              },
              0,
            )
          : 0;

      return {
        id: profileRow.id,
        name: profileRow.name,
        email: profileRow.email,
        role: profileRow.role,
        country: profileRow.country,
        department: profileRow.department ?? "",
        active: profileRow.active,
        mustChangePassword: Boolean(profileRow.must_change_password),
        createdAt: authUser?.created_at ?? "",
        lastSignInAt: authUser?.last_sign_in_at ?? null,
        emailConfirmed: Boolean(authUser?.email_confirmed_at),
        assignments: open.length,
        overdueAssignments: open.filter((assignment) => {
          const due = parseDate(assignment.dueDate);
          return due !== null && due < now;
        }).length,
        averageProgress: progressValues.length
          ? Math.round(progressValues.reduce((total, value) => total + value, 0) / progressValues.length)
          : 0,
        pendingReviews,
        ownedPendingReviews,
        activePipelineItems,
        currentWork: open.slice(0, 3).map((assignment) => ({
          id: String(assignment.id ?? ""),
          title: String(assignment.taskTitle ?? assignment.tenderTitle ?? "Tender assignment"),
          tenderRef: String(assignment.tenderRef ?? ""),
          status: String(assignment.status ?? "Assigned"),
          progress: Number(assignment.progressPercentage ?? 0),
        })),
      };
    });

    const names = new Map(users.map((directoryUser) => [directoryUser.id, directoryUser.name]));
    const activity = (auditResult.data ?? []).map((event) => {
      const details = (event.details ?? {}) as Json;
      const wasDeleted = event.action === "user_updated" && details.operation === "deleted";
      return {
        id: event.id,
        action: wasDeleted ? "user_deleted" : event.action,
        actorName: names.get(event.actor_id) ?? "System administrator",
        targetName: event.target_id
          ? (names.get(event.target_id) ?? String(details.targetName ?? "Former user"))
          : String(details.targetName ?? "System"),
        createdAt: event.created_at,
        details,
      };
    });
    const openAssignments = assignments.filter(
      (assignment) => !["completed", "closed"].includes(String(assignment.status).toLowerCase()),
    );

    return NextResponse.json({
      success: true,
      data: {
        currentUserId: user.id,
        totals: {
          users: users.length,
          activeUsers: users.filter((directoryUser) => directoryUser.active).length,
          openAssignments: openAssignments.length,
          overdueAssignments: users.reduce((total, directoryUser) => total + directoryUser.overdueAssignments, 0),
          pendingReviews: reviews.filter((review) => review.overallStatus === "In Review").length,
          countries: new Set(users.filter((directoryUser) => directoryUser.country !== "ALL").map((u) => u.country))
            .size,
        },
        users,
        activity,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to load administration data" },
      { status: 500 },
    );
  }
}
