"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AuthService } from "@/services/auth-service";

import {
  AddRenewalDialog,
  getDaysRemaining,
  getRenewalStatus,
  type RenewalEvent,
} from "./_components/add-renewal-dialog";

function formatRenewalDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (!value || Number.isNaN(date.getTime())) return "Date not set";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

export default function RenewalCalendarPage() {
  const [currentUser, setCurrentUser] = useState(() => AuthService.getCurrentUser());
  const [items, setItems] = useState<RenewalEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRenewals = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/records/renewal");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setItems(json.data);
      }
    } catch {
      toast.error("Failed to load renewal records.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRenewals();
  }, []);

  useEffect(() => {
    const sync = () => setCurrentUser(AuthService.getCurrentUser());
    window.addEventListener("atcis-auth-changed", sync);
    return () => window.removeEventListener("atcis-auth-changed", sync);
  }, []);

  const isCountryAdmin = currentUser?.role === "country_admin";
  const userCountry = isCountryAdmin
    ? currentUser.country === "ZM"
      ? "ZM"
      : "ZW"
    : currentUser?.role !== "super_admin" && currentUser?.country && currentUser.country !== "ALL"
      ? currentUser.country
      : "ALL";

  const renewalEvents = useMemo(() => {
    const uniqueRenewals = new Map<string, RenewalEvent>();
    for (const renewal of items) {
      if (renewal?.id) uniqueRenewals.set(renewal.id, renewal);
    }

    return [...uniqueRenewals.values()]
      .filter((renewal) => userCountry === "ALL" || renewal.countryCode === userCountry)
      .map((renewal) => {
        const renewalDate =
          renewal.renewalDate || renewal.expirationDate || renewal.expiryDate || renewal.targetDate || "";
        const daysRemaining = getDaysRemaining(renewalDate);
        return {
          ...renewal,
          itemTitle: renewal.itemTitle || renewal.item || renewal.title || "Untitled renewal item",
          regulator: renewal.regulator || renewal.authority || renewal.regulatoryBody || "Not specified",
          renewalDate,
          responsibleOfficer:
            renewal.responsibleOfficer || renewal.responsibleLead || renewal.owner || "Unassigned",
          daysRemaining,
          status: getRenewalStatus(daysRemaining, renewal.reminderDays),
        };
      })
      .sort((left, right) => String(left.renewalDate || "9999").localeCompare(String(right.renewalDate || "9999")));
  }, [items, userCountry]);

  const handleCreated = (renewal: RenewalEvent) => {
    setItems((current) => [renewal, ...current.filter((item) => item.id !== renewal.id)]);
  };

  const handleDeleted = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      const res = await fetch(`/api/records/renewal?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        handleDeleted(id);
        toast.success(`Deleted "${title}".`);
      } else {
        toast.error("Failed to delete renewal item.");
      }
    } catch {
      toast.error("Network error while deleting item.");
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to remove ALL renewal items from the calendar?")) return;
    try {
      const res = await fetch("/api/records/renewal?all=true", {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setItems([]);
        toast.success("Renewal calendar cleared.");
      } else {
        toast.error("Failed to clear renewal items.");
      }
    } catch {
      toast.error("Network error while clearing calendar.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 border-b pb-5 md:flex-row md:items-center">
        <div>
          <h1 className="font-bold text-2xl tracking-tight sm:text-3xl">
            Statutory Compliance &amp; Renewal Calendar
          </h1>
          <p className="text-muted-foreground text-sm">
            Track licences, certificates, subscriptions, insurance policies, and compliance deadlines.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {renewalEvents.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-900/30 gap-1.5"
              title="Clear all renewal items"
            >
              <Trash2 className="size-3.5" />
              <span>Clear All</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={loadRenewals}
            disabled={isLoading}
            className="h-8 gap-1 text-xs"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          <AddRenewalDialog
            defaultCountry={userCountry}
            defaultOfficer={currentUser?.name || ""}
            onCreated={handleCreated}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Renewal schedule</CardTitle>
          <CardDescription>
            Items are ordered by expiration date, with countdown and status calculated automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renewalEvents.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Authority or provider</TableHead>
                    <TableHead>Expiration date</TableHead>
                    <TableHead>Countdown</TableHead>
                    <TableHead>Responsible lead</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renewalEvents.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 font-medium">
                            <Badge variant="outline">{item.countryCode}</Badge>
                            <span>{item.itemTitle}</span>
                          </div>
                          {item.category && <span className="text-muted-foreground text-xs">{item.category}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.regulator}</TableCell>
                      <TableCell>{formatRenewalDate(item.renewalDate)}</TableCell>
                      <TableCell>
                        {item.daysRemaining < 0
                          ? `${Math.abs(item.daysRemaining)} days overdue`
                          : item.daysRemaining === 0
                            ? "Due today"
                            : `${item.daysRemaining} days left`}
                      </TableCell>
                      <TableCell>{item.responsibleOfficer}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === "Expired" || item.status === "Immediate Action"
                              ? "destructive"
                              : item.status === "Upcoming"
                                ? "secondary"
                                : "default"
                          }
                        >
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <AddRenewalDialog
                            defaultCountry={userCountry}
                            defaultOfficer={currentUser?.name || ""}
                            onCreated={handleCreated}
                            onDeleted={handleDeleted}
                            renewal={item}
                            triggerLabel="Manage"
                            triggerVariant="outline"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(item.id, item.itemTitle)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                            title="Delete renewal item"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarDays />
                </EmptyMedia>
                <EmptyTitle>No renewal items yet</EmptyTitle>
                <EmptyDescription>
                  Add a licence, certificate, policy, subscription, or compliance document to start tracking its
                  expiration date.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <AddRenewalDialog
                  defaultCountry={userCountry}
                  defaultOfficer={currentUser?.name || ""}
                  onCreated={handleCreated}
                />
              </EmptyContent>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
