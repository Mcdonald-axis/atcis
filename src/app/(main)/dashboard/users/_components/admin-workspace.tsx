"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Activity,
  AlertCircle,
  BriefcaseBusiness,
  Clipboard,
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { copyTextToClipboard } from "@/lib/utils";
import type { UserRole } from "@/services/auth-service";

import { type AdminOverview, type AdminUser, ROLE_OPTIONS, roleLabel } from "./admin-types";

type FormState = {
  name: string;
  email: string;
  role: UserRole;
  country: "ZW" | "ZM" | "ALL";
  department: string;
  active: boolean;
};
const blankForm: FormState = {
  name: "",
  email: "",
  role: "account_manager",
  country: "ZW",
  department: "",
  active: true,
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: typeof UsersRound;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        <CardAction>
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        </CardAction>
      </CardHeader>
      <CardContent className="text-muted-foreground text-xs">{description}</CardContent>
    </Card>
  );
}

function UserDialog({
  open,
  onOpenChange,
  user,
  currentUserId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser | null;
  currentUserId: string;
  onSaved: (password?: string) => void;
}) {
  const [form, setForm] = useState<FormState>(blankForm);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setForm(
      user
        ? {
            name: user.name,
            email: user.email,
            role: user.role,
            country: user.country,
            department: user.department,
            active: user.active,
          }
        : blankForm,
    );
  }, [user]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user ? { action: "update", id: user.id, ...form } : { action: "create", ...form }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The account could not be saved");
      onOpenChange(false);
      onSaved(result.temporaryPassword);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The account could not be saved");
    } finally {
      setSaving(false);
    }
  };
  const isSelf = user?.id === currentUserId;
  let submitLabel = user ? "Save changes" : "Create account";
  if (saving) submitLabel = "Saving…";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{user ? "Edit user access" : "Create a system user"}</DialogTitle>
            <DialogDescription>
              {user
                ? "Update this user’s role, region, department, or access status."
                : "A secure temporary password will be shown once after creation."}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="admin-name">Full name</FieldLabel>
                <Input
                  id="admin-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  required
                />
              </Field>
              <Field data-disabled={Boolean(user)}>
                <FieldLabel htmlFor="admin-email">Email address</FieldLabel>
                <Input
                  id="admin-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  disabled={Boolean(user)}
                  required
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>System role</FieldLabel>
                <Select
                  value={form.role}
                  onValueChange={(value) => {
                    let country = form.country;
                    if (value === "super_admin") country = "ALL";
                    else if (country === "ALL") country = "ZW";
                    setForm({ ...form, role: value as UserRole, country });
                  }}
                  disabled={isSelf}
                >
                  <SelectTrigger aria-label="System role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Country access</FieldLabel>
                <Select
                  value={form.country}
                  onValueChange={(value) => setForm({ ...form, country: value as FormState["country"] })}
                  disabled={form.role === "super_admin" || isSelf}
                >
                  <SelectTrigger aria-label="Country access">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {form.role === "super_admin" && <SelectItem value="ALL">All regions</SelectItem>}
                      <SelectItem value="ZW">Zimbabwe</SelectItem>
                      <SelectItem value="ZM">Zambia</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="admin-department">Department</FieldLabel>
              <Input
                id="admin-department"
                value={form.department}
                onChange={(event) => setForm({ ...form, department: event.target.value })}
                placeholder="Commercial, ICT, Technical…"
              />
              <FieldDescription>Used to group account managers and approval responsibilities.</FieldDescription>
            </Field>
            {user && (
              <Field orientation="horizontal" data-disabled={isSelf}>
                <FieldLabel htmlFor="admin-active">Account active</FieldLabel>
                <Switch
                  id="admin-active"
                  checked={form.active}
                  onCheckedChange={(active) => setForm({ ...form, active })}
                  disabled={isSelf}
                />
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <Plus data-icon="inline-start" />
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminWorkspace() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [credential, setCredential] = useState("");
  const [resetting, setResetting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to load administration data");
      setData(result.data);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load administration data");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const users = useMemo(() => {
    const query = search.toLowerCase().trim();
    return (data?.users ?? []).filter(
      (user) =>
        !query ||
        [user.name, user.email, roleLabel(user.role), user.department, user.country].some((value) =>
          value.toLowerCase().includes(query),
        ),
    );
  }, [data, search]);
  const saved = (password?: string) => {
    toast.success(editing ? "User access updated" : "User account created");
    setEditing(null);
    if (password) setCredential(password);
    void load();
  };
  const resetPassword = async (user: AdminUser) => {
    setResetting(user.id);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_password", id: user.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Password reset failed");
      setCredential(result.temporaryPassword);
      toast.success(`Temporary password created for ${user.name}`);
      void load();
    } catch (resetError) {
      toast.error(resetError instanceof Error ? resetError.message : "Password reset failed");
    } finally {
      setResetting(null);
    }
  };
  const deleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: deleteTarget.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The user could not be deleted");
      const deletedName = deleteTarget.name;
      setDeleteTarget(null);
      toast.success(`${deletedName}'s account was deleted`);
      void load();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "The user could not be deleted");
    } finally {
      setDeleting(false);
    }
  };

  if (error)
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Administration data is unavailable</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  if (!data)
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {["users", "assignments", "reviews", "countries", "one", "two", "three", "four"].map((item) => (
          <Skeleton key={item} className="h-28" />
        ))}
      </div>
    );
  const workload = data.users.filter((user) => user.active && (user.assignments > 0 || user.pendingReviews > 0));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-4 border-b pb-4 md:flex-row md:items-center">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-semibold text-2xl tracking-tight sm:text-3xl">People & access</h1>
            <Badge variant="secondary">Super admin</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Create accounts, assign roles, and see current work across Zimbabwe and Zambia.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <Plus data-icon="inline-start" />
          Add user
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Active users"
          value={data.totals.activeUsers}
          description={`${data.totals.users} total accounts`}
          icon={UserCheck}
        />
        <StatCard
          title="Open assignments"
          value={data.totals.openAssignments}
          description={`${data.totals.overdueAssignments} overdue`}
          icon={BriefcaseBusiness}
        />
        <StatCard
          title="Reviews in progress"
          value={data.totals.pendingReviews}
          description="Awaiting workflow decisions"
          icon={ShieldCheck}
        />
        <StatCard
          title="Country operations"
          value={data.totals.countries}
          description="Zimbabwe and Zambia coverage"
          icon={UsersRound}
        />
      </div>
      <Tabs defaultValue="workload" className="gap-4">
        <TabsList>
          <TabsTrigger value="workload">Workload</TabsTrigger>
          <TabsTrigger value="directory">User directory</TabsTrigger>
          <TabsTrigger value="activity">Admin activity</TabsTrigger>
        </TabsList>
        <TabsContent value="workload">
          <Card>
            <CardHeader>
              <CardTitle>Who is working on what</CardTitle>
              <CardDescription>Active tender assignments and approval workload by team member.</CardDescription>
            </CardHeader>
            <CardContent>
              {workload.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {workload.map((user) => (
                    <Card key={user.id} size="sm">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{initials(user.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <CardTitle className="truncate">{user.name}</CardTitle>
                            <CardDescription>{roleLabel(user.role)}</CardDescription>
                          </div>
                        </div>
                        <CardAction>
                          <Badge variant="outline">{user.country}</Badge>
                        </CardAction>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-4">
                        <div className="flex justify-between text-xs">
                          <span>{user.assignments} active assignments</span>
                          <span className="font-medium">{user.averageProgress}% average</span>
                        </div>
                        <Progress value={user.averageProgress} />
                        {user.currentWork.map((work) => (
                          <div key={work.id} className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{work.title}</p>
                              <p className="text-muted-foreground text-xs">{work.tenderRef || work.status}</p>
                            </div>
                            <Badge variant="secondary">{work.progress}%</Badge>
                          </div>
                        ))}
                        {user.pendingReviews > 0 && (
                          <p className="text-muted-foreground text-xs">
                            {user.pendingReviews} review decisions available
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <BriefcaseBusiness />
                    </EmptyMedia>
                    <EmptyTitle>No active workload</EmptyTitle>
                    <EmptyDescription>
                      Assignments and reviews will appear here as the team begins work.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="directory">
          <Card>
            <CardHeader>
              <CardTitle>System users</CardTitle>
              <CardDescription>Authentication, responsibility, region, and status for every account.</CardDescription>
              <CardAction>
                <div className="relative w-64">
                  <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search users…"
                    aria-label="Search users"
                  />
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">User</TableHead>
                    <TableHead>Responsibility</TableHead>
                    <TableHead>Workload</TableHead>
                    <TableHead>Last sign-in</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{initials(user.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-muted-foreground text-xs">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p>{roleLabel(user.role)}</p>
                        <p className="text-muted-foreground text-xs">
                          {user.country} · {user.department || "No department"}
                        </p>
                      </TableCell>
                      <TableCell>
                        {user.assignments} assignments
                        <br />
                        <span className="text-muted-foreground text-xs">{user.pendingReviews} pending reviews</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(user.lastSignInAt)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          <Badge variant={user.active ? "secondary" : "outline"}>
                            {user.active ? "Active" : "Disabled"}
                          </Badge>
                          {user.mustChangePassword && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-normal text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10"
                            >
                              Password change required
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="icon-sm"
                            variant="outline"
                            onClick={() => void resetPassword(user)}
                            disabled={resetting === user.id}
                            aria-label={`Reset password for ${user.name}`}
                          >
                            <KeyRound />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="outline"
                            onClick={() => {
                              setEditing(user);
                              setOpen(true);
                            }}
                            aria-label={`Edit ${user.name}`}
                          >
                            <Pencil />
                          </Button>
                          {user.id !== data.currentUserId && (
                            <Button
                              size="icon-sm"
                              variant="destructive"
                              onClick={() => setDeleteTarget(user)}
                              aria-label={`Delete ${user.name}`}
                            >
                              <Trash2 />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {users.length === 0 && (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <UsersRound />
                    </EmptyMedia>
                    <EmptyTitle>No users found</EmptyTitle>
                    <EmptyDescription>Change the search or create a new account.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Administration activity</CardTitle>
              <CardDescription>Recent account creation, access changes, password resets, and deletions.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {data.activity.map((event) => (
                <div key={event.id} className="flex items-start gap-3 border-b pb-4 last:border-b-0">
                  <Activity className="mt-1 size-4 text-muted-foreground" />
                  <div>
                    <p>
                      <span className="font-medium">{event.actorName}</span> {event.action.replaceAll("_", " ")} for{" "}
                      <span className="font-medium">{event.targetName}</span>
                    </p>
                    <p className="text-muted-foreground text-xs">{formatDate(event.createdAt)}</p>
                  </div>
                </div>
              ))}
              {data.activity.length === 0 && (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Activity />
                    </EmptyMedia>
                    <EmptyTitle>No administration activity yet</EmptyTitle>
                    <EmptyDescription>New account actions will be recorded here.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <UserDialog
        open={open}
        onOpenChange={setOpen}
        user={editing}
        currentUserId={data.currentUserId}
        onSaved={saved}
      />
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => {
          if (!next && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2 />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the user’s sign-in access and directory profile. Completed tender history and
              uploaded documents are retained. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget &&
            (deleteTarget.assignments > 0 ||
              deleteTarget.ownedPendingReviews > 0 ||
              deleteTarget.activePipelineItems > 0) && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Active work must be reassigned</AlertTitle>
                <AlertDescription>
                  This user has {deleteTarget.assignments} active assignment(s), {deleteTarget.ownedPendingReviews}
                  review submission(s) in progress, and {deleteTarget.activePipelineItems} active pipeline item(s).
                </AlertDescription>
              </Alert>
            )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={
                deleting ||
                Boolean(
                  deleteTarget &&
                    (deleteTarget.assignments > 0 ||
                      deleteTarget.ownedPendingReviews > 0 ||
                      deleteTarget.activePipelineItems > 0),
                )
              }
              onClick={(event) => {
                event.preventDefault();
                void deleteUser();
              }}
            >
              {deleting ? <Spinner data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
              {deleting ? "Deleting…" : "Delete user"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={Boolean(credential)} onOpenChange={(next) => !next && setCredential("")}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
            <DialogDescription>Share this securely with the user. It is shown only in this dialog.</DialogDescription>
          </DialogHeader>
          <Alert>
            <KeyRound />
            <AlertTitle>One-time credential</AlertTitle>
            <AlertDescription>
              <code className="break-all font-mono text-foreground">{credential}</code>
            </AlertDescription>
          </Alert>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={async () => {
                const copied = await copyTextToClipboard(credential);
                if (copied) toast.success("Password copied");
                else toast.error("Copy failed. Select and copy the password manually.");
              }}
            >
              <Clipboard data-icon="inline-start" />
              Copy password
            </Button>
            <Button onClick={() => setCredential("")}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
