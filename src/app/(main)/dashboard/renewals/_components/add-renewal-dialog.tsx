"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createClientId } from "@/lib/utils";

export type RenewalStatus = "Expired" | "Immediate Action" | "Upcoming" | "Good Standing";

export interface RenewalEvent {
  id: string;
  itemTitle: string;
  category?: string;
  regulator: string;
  countryCode: "ZW" | "ZM";
  renewalDate: string;
  daysRemaining: number;
  estCost: number;
  responsibleOfficer: string;
  reminderDays?: number;
  notes?: string;
  status: RenewalStatus;
  createdAt?: string;
  item?: string;
  title?: string;
  authority?: string;
  regulatoryBody?: string;
  expirationDate?: string;
  expiryDate?: string;
  targetDate?: string;
  responsibleLead?: string;
  owner?: string;
}

interface AddRenewalDialogProps {
  defaultCountry: "ZW" | "ZM" | "ALL";
  defaultOfficer: string;
  onCreated: (renewal: RenewalEvent) => void;
  onDeleted?: (id: string) => void;
  renewal?: RenewalEvent;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline";
}

interface RenewalFormState {
  itemTitle: string;
  category: string;
  regulator: string;
  countryCode: "ZW" | "ZM";
  renewalDate: string;
  responsibleOfficer: string;
  reminderDays: string;
  estCost: string;
  notes: string;
}

type RenewalFormErrors = Partial<Record<keyof RenewalFormState, string>>;

function initialForm(
  defaultCountry: "ZW" | "ZM" | "ALL",
  defaultOfficer: string,
  renewal?: RenewalEvent,
): RenewalFormState {
  return {
    itemTitle: renewal?.itemTitle || "",
    category: renewal?.category || "Certificate / registration",
    regulator: renewal?.regulator || "",
    countryCode: renewal?.countryCode || (defaultCountry === "ZM" ? "ZM" : "ZW"),
    renewalDate: renewal?.renewalDate || "",
    responsibleOfficer: renewal?.responsibleOfficer || defaultOfficer,
    reminderDays: String(renewal?.reminderDays || 30),
    estCost: renewal?.estCost ? String(renewal.estCost) : "",
    notes: renewal?.notes || "",
  };
}

export function getDaysRemaining(dateValue: string) {
  if (!dateValue) return 0;
  const target = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(target.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

export function getRenewalStatus(daysRemaining: number, reminderDays = 30): RenewalStatus {
  if (daysRemaining < 0) return "Expired";
  if (daysRemaining <= reminderDays) return "Immediate Action";
  if (daysRemaining <= 120) return "Upcoming";
  return "Good Standing";
}

export function AddRenewalDialog({
  defaultCountry,
  defaultOfficer,
  onCreated,
  onDeleted,
  renewal,
  triggerLabel = "Add renewal item",
  triggerVariant = "default",
}: AddRenewalDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RenewalFormState>(() => initialForm(defaultCountry, defaultOfficer, renewal));
  const [errors, setErrors] = useState<RenewalFormErrors>({});

  useEffect(() => {
    if (open) {
      setForm(initialForm(defaultCountry, defaultOfficer, renewal));
      setErrors({});
    }
  }, [defaultCountry, defaultOfficer, open, renewal]);

  const handleDelete = async () => {
    if (!renewal?.id) return;
    if (!confirm(`Are you sure you want to delete "${renewal.itemTitle || renewal.title || 'this renewal item'}"?`)) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/records/renewal?id=${encodeURIComponent(renewal.id)}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not delete this renewal item.");
      onDeleted?.(renewal.id);
      setOpen(false);
      toast.success("Renewal item deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete this renewal item.");
    } finally {
      setSaving(false);
    }
  };

  const updateField = <Key extends keyof RenewalFormState>(key: Key, value: RenewalFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = () => {
    const nextErrors: RenewalFormErrors = {};
    if (!form.itemTitle.trim()) nextErrors.itemTitle = "Enter the item that requires renewal.";
    if (!form.regulator.trim()) nextErrors.regulator = "Enter the authority, provider, or issuing body.";
    if (!form.renewalDate) nextErrors.renewalDate = "Choose an expiration or renewal date.";
    if (!form.responsibleOfficer.trim()) nextErrors.responsibleOfficer = "Assign a responsible person or team.";
    if (!Number.isFinite(Number(form.reminderDays)) || Number(form.reminderDays) < 1) {
      nextErrors.reminderDays = "Enter a reminder period of at least one day.";
    }
    if (form.estCost && (!Number.isFinite(Number(form.estCost)) || Number(form.estCost) < 0)) {
      nextErrors.estCost = "Enter a valid estimated cost.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const daysRemaining = getDaysRemaining(form.renewalDate);
      const record: RenewalEvent = {
        id: renewal?.id || `renewal-${form.countryCode.toLowerCase()}-${createClientId()}`,
        itemTitle: form.itemTitle.trim(),
        category: form.category,
        regulator: form.regulator.trim(),
        countryCode: form.countryCode,
        renewalDate: form.renewalDate,
        daysRemaining,
        estCost: form.estCost ? Number(form.estCost) : 0,
        responsibleOfficer: form.responsibleOfficer.trim(),
        reminderDays: Number(form.reminderDays),
        notes: form.notes.trim(),
        status: getRenewalStatus(daysRemaining, Number(form.reminderDays)),
        createdAt: renewal?.createdAt || new Date().toISOString(),
      };

      const response = await fetch("/api/records/renewal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      const result = (await response.json()) as { success?: boolean; data?: RenewalEvent; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || "Could not save this renewal item.");

      onCreated(result.data || record);
      setOpen(false);
      toast.success(renewal ? "Renewal item updated." : "Renewal item added to the calendar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this renewal item.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={triggerVariant}>
          {!renewal && <Plus data-icon="inline-start" />}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{renewal ? "Manage renewal item" : "Add a renewal item"}</DialogTitle>
            <DialogDescription>
              {renewal
                ? "Update the renewal details, ownership, reminder period, or expiration date."
                : "Track any licence, certificate, subscription, policy, permit, or compliance document that expires."}
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.itemTitle)}>
                <FieldLabel htmlFor="renewal-item-title">Item name</FieldLabel>
                <Input
                  id="renewal-item-title"
                  value={form.itemTitle}
                  aria-invalid={Boolean(errors.itemTitle)}
                  placeholder="e.g. PRAZ supplier registration"
                  onChange={(event) => updateField("itemTitle", event.target.value)}
                />
                <FieldError>{errors.itemTitle}</FieldError>
              </Field>

              <Field>
                <FieldLabel htmlFor="renewal-category">Renewal type</FieldLabel>
                <Select value={form.category} onValueChange={(value) => updateField("category", value)}>
                  <SelectTrigger id="renewal-category" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="Certificate / registration">Certificate / registration</SelectItem>
                      <SelectItem value="Licence / permit">Licence / permit</SelectItem>
                      <SelectItem value="Tax clearance">Tax clearance</SelectItem>
                      <SelectItem value="Insurance policy">Insurance policy</SelectItem>
                      <SelectItem value="Membership / subscription">Membership / subscription</SelectItem>
                      <SelectItem value="Service contract">Service contract</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.regulator)}>
                <FieldLabel htmlFor="renewal-regulator">Authority or provider</FieldLabel>
                <Input
                  id="renewal-regulator"
                  value={form.regulator}
                  aria-invalid={Boolean(errors.regulator)}
                  placeholder="e.g. PRAZ, ZIMRA, ZPPA, insurer"
                  onChange={(event) => updateField("regulator", event.target.value)}
                />
                <FieldError>{errors.regulator}</FieldError>
              </Field>

              <Field>
                <FieldLabel htmlFor="renewal-country">Country</FieldLabel>
                <Select
                  value={form.countryCode}
                  disabled={defaultCountry !== "ALL"}
                  onValueChange={(value) => updateField("countryCode", value as "ZW" | "ZM")}
                >
                  <SelectTrigger id="renewal-country" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="ZW">Zimbabwe</SelectItem>
                      <SelectItem value="ZM">Zambia</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.renewalDate)}>
                <FieldLabel htmlFor="renewal-date">Expiration or renewal date</FieldLabel>
                <Input
                  id="renewal-date"
                  type="date"
                  value={form.renewalDate}
                  aria-invalid={Boolean(errors.renewalDate)}
                  onChange={(event) => updateField("renewalDate", event.target.value)}
                />
                <FieldError>{errors.renewalDate}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.reminderDays)}>
                <FieldLabel htmlFor="renewal-reminder-days">Remind me before (days)</FieldLabel>
                <Input
                  id="renewal-reminder-days"
                  type="number"
                  min="1"
                  max="365"
                  value={form.reminderDays}
                  aria-invalid={Boolean(errors.reminderDays)}
                  onChange={(event) => updateField("reminderDays", event.target.value)}
                />
                <FieldError>{errors.reminderDays}</FieldError>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.responsibleOfficer)}>
                <FieldLabel htmlFor="renewal-owner">Responsible person or team</FieldLabel>
                <Input
                  id="renewal-owner"
                  value={form.responsibleOfficer}
                  aria-invalid={Boolean(errors.responsibleOfficer)}
                  placeholder="e.g. Compliance Officer"
                  onChange={(event) => updateField("responsibleOfficer", event.target.value)}
                />
                <FieldError>{errors.responsibleOfficer}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.estCost)}>
                <FieldLabel htmlFor="renewal-cost">Estimated cost (optional)</FieldLabel>
                <Input
                  id="renewal-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.estCost}
                  aria-invalid={Boolean(errors.estCost)}
                  placeholder="0.00"
                  onChange={(event) => updateField("estCost", event.target.value)}
                />
                <FieldError>{errors.estCost}</FieldError>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="renewal-notes">Notes (optional)</FieldLabel>
              <Textarea
                id="renewal-notes"
                value={form.notes}
                maxLength={500}
                rows={3}
                placeholder="Add a document reference, account number, or renewal instructions"
                onChange={(event) => updateField("notes", event.target.value)}
              />
            </Field>
          </FieldGroup>

          <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
            {renewal ? (
              <Button
                type="button"
                variant="ghost"
                disabled={saving}
                onClick={handleDelete}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 mr-auto"
              >
                <Trash2 data-icon="inline-start" className="size-4" />
                Delete
              </Button>
            ) : <div />}
            <div className="flex items-center gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={saving}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
                {saving ? "Saving…" : renewal ? "Save changes" : "Add renewal item"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
