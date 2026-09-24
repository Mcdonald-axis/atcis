"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Bell,
  BellRing,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  FilePenLine,
  Globe2,
  Leaf,
  LoaderCircle,
  type LucideIcon,
  Mail,
  MessageCircle,
  PackageSearch,
  PlugZap,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Tag,
  Truck,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { AuthService } from "@/services/auth-service";

type DeliveryFrequency = "instant" | "twice-daily" | "daily" | "weekly";
type CountryScope = "ALL" | "ZW" | "ZM";
type ChannelKey = "inApp" | "email" | "whatsapp";

interface NotificationPreferencesState {
  enabled: boolean;
  categories: string[];
  alertTypes: string[];
  keywords: string[];
  channels: Record<ChannelKey, boolean>;
  emailAddress: string;
  whatsappNumber: string;
  countryScope: CountryScope;
  frequency: DeliveryFrequency;
  minimumMatchScore: string;
}

interface PreferenceOption {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

interface SavedNotificationPreferences {
  preferences: NotificationPreferencesState;
  savedAt: string;
}

const CATEGORIES: PreferenceOption[] = [
  {
    id: "ict-software",
    title: "ICT & Software",
    description: "Software, cloud, telecoms, hardware, and cybersecurity.",
    icon: Zap,
  },
  {
    id: "construction-infrastructure",
    title: "Construction & Infrastructure",
    description: "Civil works, buildings, roads, water, and engineering.",
    icon: Building2,
  },
  {
    id: "goods-supplies",
    title: "Goods & Supplies",
    description: "Equipment, consumables, furniture, and general supplies.",
    icon: PackageSearch,
  },
  {
    id: "transport-logistics",
    title: "Transport & Logistics",
    description: "Vehicles, freight, warehousing, and fleet services.",
    icon: Truck,
  },
  {
    id: "energy-utilities",
    title: "Energy & Utilities",
    description: "Solar, electrical, power generation, and utility services.",
    icon: PlugZap,
  },
  {
    id: "agriculture-food",
    title: "Agriculture & Food",
    description: "Farming inputs, irrigation, food supply, and agribusiness.",
    icon: Leaf,
  },
  {
    id: "professional-services",
    title: "Professional Services",
    description: "Consulting, audit, training, research, and advisory work.",
    icon: ClipboardCheck,
  },
  {
    id: "healthcare-medical",
    title: "Healthcare & Medical",
    description: "Pharmaceuticals, medical devices, and health services.",
    icon: ShieldCheck,
  },
];

const ALERT_TYPES: PreferenceOption[] = [
  {
    id: "new-tender",
    title: "New matching tenders",
    description: "A new opportunity matches your categories or keywords.",
    icon: Search,
  },
  {
    id: "closing-soon",
    title: "Closing soon",
    description: "A matched tender is approaching its submission deadline.",
    icon: CalendarClock,
  },
  {
    id: "amendments",
    title: "Tender amendments",
    description: "Dates, documents, or requirements have changed.",
    icon: FilePenLine,
  },
  {
    id: "awards",
    title: "Award notices",
    description: "Results and contract award information are published.",
    icon: CircleDollarSign,
  },
];

const DEFAULT_PREFERENCES: NotificationPreferencesState = {
  enabled: false,
  categories: ["ict-software", "construction-infrastructure", "goods-supplies"],
  alertTypes: ["new-tender", "closing-soon", "amendments"],
  keywords: [],
  channels: {
    inApp: true,
    email: false,
    whatsapp: false,
  },
  emailAddress: "",
  whatsappNumber: "",
  countryScope: "ALL",
  frequency: "instant",
  minimumMatchScore: "70",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function preferencesWithUserEmail() {
  const user = AuthService.getCurrentUser();
  return {
    ...DEFAULT_PREFERENCES,
    channels: { ...DEFAULT_PREFERENCES.channels },
    emailAddress: user?.email ?? "",
    countryScope: user?.country ?? "ALL",
  };
}

function normalizeStoredPreferences(value: unknown): NotificationPreferencesState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const stored = value as Partial<NotificationPreferencesState>;
  return {
    ...preferencesWithUserEmail(),
    ...stored,
    categories: Array.isArray(stored.categories) ? stored.categories : DEFAULT_PREFERENCES.categories,
    alertTypes: Array.isArray(stored.alertTypes) ? stored.alertTypes : DEFAULT_PREFERENCES.alertTypes,
    keywords: Array.isArray(stored.keywords) ? stored.keywords : [],
    channels: {
      inApp: stored.channels?.inApp ?? DEFAULT_PREFERENCES.channels.inApp,
      email: stored.channels?.email ?? DEFAULT_PREFERENCES.channels.email,
      whatsapp: stored.channels?.whatsapp ?? DEFAULT_PREFERENCES.channels.whatsapp,
    },
  };
}

function formatSavedTime(value: string | null) {
  if (!value) return "Not saved yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Saved previously";
  return `Last saved ${new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed)}`;
}

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferencesState>(DEFAULT_PREFERENCES);
  const [keywordInput, setKeywordInput] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const loadPreferences = async () => {
      try {
        const response = await fetch("/api/notification-preferences", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to load notification preferences");
        }
        const saved = result.data as SavedNotificationPreferences | null;
        const next = normalizeStoredPreferences(saved?.preferences) ?? preferencesWithUserEmail();
        setPreferences(next);
        setSavedSnapshot(JSON.stringify(next));
        setLastSavedAt(saved?.savedAt ?? null);
      } catch (error) {
        if (controller.signal.aborted) return;
        const next = preferencesWithUserEmail();
        setPreferences(next);
        setSavedSnapshot(JSON.stringify(next));
        toast.error(error instanceof Error ? error.message : "Notification settings could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setLoaded(true);
      }
    };
    void loadPreferences();
    return () => controller.abort();
  }, []);

  const isDirty = useMemo(
    () => loaded && JSON.stringify(preferences) !== savedSnapshot,
    [loaded, preferences, savedSnapshot],
  );

  const selectedChannelCount = Object.values(preferences.channels).filter(Boolean).length;
  const selectedCategoryCount = preferences.categories.length;

  const updatePreference = <Key extends keyof NotificationPreferencesState>(
    key: Key,
    value: NotificationPreferencesState[Key],
  ) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  const toggleSelection = (key: "categories" | "alertTypes", id: string) => {
    setPreferences((current) => {
      const selected = current[key];
      return {
        ...current,
        [key]: selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id],
      };
    });
  };

  const updateChannel = (channel: ChannelKey, enabled: boolean) => {
    setPreferences((current) => ({
      ...current,
      channels: { ...current.channels, [channel]: enabled },
    }));
  };

  const addKeyword = () => {
    const keyword = keywordInput.trim().replace(/\s+/g, " ");
    if (!keyword) return;
    if (preferences.keywords.some((item) => item.toLowerCase() === keyword.toLowerCase())) {
      toast.info("That keyword is already in your list.");
      return;
    }
    if (preferences.keywords.length >= 20) {
      toast.error("You can add up to 20 keywords.");
      return;
    }
    updatePreference("keywords", [...preferences.keywords, keyword]);
    setKeywordInput("");
  };

  const removeKeyword = (keyword: string) => {
    updatePreference(
      "keywords",
      preferences.keywords.filter((item) => item !== keyword),
    );
  };

  const validatePreferences = () => {
    if (!preferences.enabled) return true;
    if (preferences.categories.length === 0 && preferences.keywords.length === 0) {
      toast.error("Select at least one tender category or add a keyword.");
      return false;
    }
    if (preferences.alertTypes.length === 0) {
      toast.error("Select at least one alert type.");
      return false;
    }
    if (selectedChannelCount === 0) {
      toast.error("Turn on at least one delivery channel.");
      return false;
    }
    if (preferences.channels.email && !EMAIL_PATTERN.test(preferences.emailAddress.trim())) {
      toast.error("Enter a valid email address.");
      return false;
    }
    if (preferences.channels.whatsapp && preferences.whatsappNumber.trim().length < 8) {
      toast.error("Enter a WhatsApp number with its country code.");
      return false;
    }
    return true;
  };

  const savePreferences = async () => {
    if (!validatePreferences()) return;
    const next = {
      ...preferences,
      emailAddress: preferences.emailAddress.trim(),
      whatsappNumber: preferences.whatsappNumber.trim(),
    };
    setSaving(true);
    try {
      const response = await fetch("/api/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Failed to save preferences");
      const saved = result.data as SavedNotificationPreferences;
      const normalized = normalizeStoredPreferences(saved.preferences) ?? next;
      setPreferences(normalized);
      setSavedSnapshot(JSON.stringify(normalized));
      setLastSavedAt(saved.savedAt);
      toast.success(normalized.enabled ? "Tender email alerts are now active." : "Tender alerts have been paused.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Notification preferences could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const sendTestEmail = async () => {
    setTesting(true);
    try {
      const response = await fetch("/api/notification-preferences", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Test email failed");
      toast.success(`Test email sent to ${preferences.emailAddress}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test email could not be sent.");
    } finally {
      setTesting(false);
    }
  };

  const restoreDefaults = () => {
    const next = preferencesWithUserEmail();
    setPreferences(next);
    setKeywordInput("");
    toast.info("Defaults restored. Save your changes to apply them.");
  };

  const previewCategory = CATEGORIES.find((category) => preferences.categories.includes(category.id));
  const previewKeyword = preferences.keywords[0];
  let previewMessage = "Add a category or keyword to personalize this preview.";
  if (!preferences.enabled) {
    previewMessage = "Turn alerts back on when you are ready to receive notification matches again.";
  } else if (previewKeyword) {
    previewMessage = `A new opportunity containing “${previewKeyword}” matches your notification profile.`;
  } else if (previewCategory) {
    previewMessage = `A new ${previewCategory.title} opportunity matches your notification profile.`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 border-b pb-5 md:flex-row md:items-center">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-2xl tracking-tight sm:text-3xl">Notification preferences</h1>
            <Badge variant={preferences.enabled ? "default" : "secondary"}>
              {preferences.enabled ? "Alerts on" : "Paused"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Choose the tender updates you care about and how ATCIS should reach you.
          </p>
        </div>
        <Button onClick={() => void savePreferences()} disabled={!loaded || !isDirty || saving}>
          {saving ? (
            <LoaderCircle className="animate-spin" data-icon="inline-start" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          {saving ? "Saving..." : "Save preferences"}
        </Button>
      </div>

      <Alert>
        <ShieldCheck />
        <AlertTitle>Personal notification profile</AlertTitle>
        <AlertDescription>
          These choices are securely saved to your signed-in account. New-tender emails are sent only while both Alert
          status and the Email channel are switched on.
        </AlertDescription>
      </Alert>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,0.75fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Alert status</CardTitle>
              <CardDescription>Pause every notification without losing your saved filters.</CardDescription>
              <CardAction>
                <Switch
                  aria-label="Enable all notifications"
                  checked={preferences.enabled}
                  onCheckedChange={(checked) => updatePreference("enabled", checked)}
                />
              </CardAction>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{selectedCategoryCount} categories</Badge>
                <Badge variant="outline">{preferences.keywords.length} keywords</Badge>
                <Badge variant="outline">{selectedChannelCount} channels</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tender categories</CardTitle>
              <CardDescription>Select the sectors you want ATCIS to monitor for you.</CardDescription>
              <CardAction>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={!preferences.enabled}
                  onClick={() =>
                    updatePreference(
                      "categories",
                      preferences.categories.length === CATEGORIES.length
                        ? []
                        : CATEGORIES.map((category) => category.id),
                    )
                  }
                >
                  {preferences.categories.length === CATEGORIES.length ? "Clear all" : "Select all"}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <FieldSet disabled={!preferences.enabled}>
                <FieldLegend className="sr-only">Tender categories</FieldLegend>
                <FieldGroup className="grid gap-3 md:grid-cols-2">
                  {CATEGORIES.map((category) => {
                    const Icon = category.icon;
                    return (
                      <Field key={category.id} orientation="horizontal">
                        <Checkbox
                          id={`category-${category.id}`}
                          checked={preferences.categories.includes(category.id)}
                          onCheckedChange={() => toggleSelection("categories", category.id)}
                        />
                        <FieldContent>
                          <FieldLabel htmlFor={`category-${category.id}`}>
                            <Icon aria-hidden="true" />
                            {category.title}
                          </FieldLabel>
                          <FieldDescription>{category.description}</FieldDescription>
                        </FieldContent>
                      </Field>
                    );
                  })}
                </FieldGroup>
              </FieldSet>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Keywords</CardTitle>
              <CardDescription>
                Add products, services, organizations, or phrases that should trigger an alert.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field data-disabled={!preferences.enabled}>
                  <FieldLabel htmlFor="notification-keyword">Add a keyword or phrase</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <Tag />
                    </InputGroupAddon>
                    <InputGroupInput
                      id="notification-keyword"
                      value={keywordInput}
                      disabled={!preferences.enabled}
                      maxLength={80}
                      placeholder="e.g. solar panels, ERP system, borehole drilling"
                      onChange={(event) => setKeywordInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addKeyword();
                        }
                      }}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton onClick={addKeyword} disabled={!preferences.enabled || !keywordInput.trim()}>
                        <Plus data-icon="inline-start" />
                        Add
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldDescription>
                    Matching is case-insensitive. Press Enter to add each keyword. Maximum 20 keywords.
                  </FieldDescription>
                </Field>

                <div className="flex min-h-7 flex-wrap gap-2" aria-live="polite">
                  {preferences.keywords.length > 0 ? (
                    preferences.keywords.map((keyword) => (
                      <Badge key={keyword} variant="secondary">
                        {keyword}
                        <Button
                          aria-label={`Remove ${keyword}`}
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => removeKeyword(keyword)}
                          disabled={!preferences.enabled}
                        >
                          <X />
                        </Button>
                      </Badge>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No keywords added yet.</p>
                  )}
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alert types</CardTitle>
              <CardDescription>Choose which changes should generate a notification.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldSet disabled={!preferences.enabled}>
                <FieldLegend className="sr-only">Alert types</FieldLegend>
                <FieldGroup className="grid gap-3 md:grid-cols-2">
                  {ALERT_TYPES.map((alertType) => {
                    const Icon = alertType.icon;
                    return (
                      <Field key={alertType.id} orientation="horizontal">
                        <Checkbox
                          id={`alert-${alertType.id}`}
                          checked={preferences.alertTypes.includes(alertType.id)}
                          onCheckedChange={() => toggleSelection("alertTypes", alertType.id)}
                        />
                        <FieldContent>
                          <FieldLabel htmlFor={`alert-${alertType.id}`}>
                            <Icon aria-hidden="true" />
                            {alertType.title}
                          </FieldLabel>
                          <FieldDescription>{alertType.description}</FieldDescription>
                        </FieldContent>
                      </Field>
                    );
                  })}
                </FieldGroup>
              </FieldSet>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6 xl:sticky xl:top-18">
          <Card>
            <CardHeader>
              <CardTitle>Delivery channels</CardTitle>
              <CardDescription>Send the same matched alert through any combination of channels.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field orientation="horizontal" data-disabled={!preferences.enabled}>
                  <FieldContent>
                    <FieldTitle>
                      <BellRing aria-hidden="true" />
                      In-app notifications
                    </FieldTitle>
                    <FieldDescription>Show alerts inside your ATCIS dashboard.</FieldDescription>
                  </FieldContent>
                  <Switch
                    aria-label="In-app notifications"
                    checked={preferences.channels.inApp}
                    disabled={!preferences.enabled}
                    onCheckedChange={(checked) => updateChannel("inApp", checked)}
                  />
                </Field>

                <Separator />

                <Field orientation="horizontal" data-disabled={!preferences.enabled}>
                  <FieldContent>
                    <FieldTitle>
                      <Mail aria-hidden="true" />
                      Email
                    </FieldTitle>
                    <FieldDescription>Send alerts to your preferred inbox.</FieldDescription>
                  </FieldContent>
                  <Switch
                    aria-label="Email notifications"
                    checked={preferences.channels.email}
                    disabled={!preferences.enabled}
                    onCheckedChange={(checked) => updateChannel("email", checked)}
                  />
                </Field>
                {preferences.channels.email && (
                  <Field data-disabled={!preferences.enabled}>
                    <FieldLabel htmlFor="notification-email">Email address</FieldLabel>
                    <Input
                      id="notification-email"
                      type="email"
                      autoComplete="email"
                      value={preferences.emailAddress}
                      disabled={!preferences.enabled}
                      placeholder="name@company.com"
                      onChange={(event) => updatePreference("emailAddress", event.target.value)}
                    />
                  </Field>
                )}

                <Separator />

                <Field orientation="horizontal" data-disabled={!preferences.enabled}>
                  <FieldContent>
                    <FieldTitle>
                      <MessageCircle aria-hidden="true" />
                      WhatsApp
                    </FieldTitle>
                    <FieldDescription>Receive instant tender alerts on WhatsApp.</FieldDescription>
                  </FieldContent>
                  <Switch
                    aria-label="WhatsApp notifications"
                    checked={preferences.channels.whatsapp}
                    disabled={!preferences.enabled}
                    onCheckedChange={(checked) => updateChannel("whatsapp", checked)}
                  />
                </Field>
                {preferences.channels.whatsapp && (
                  <Field data-disabled={!preferences.enabled}>
                    <FieldLabel htmlFor="notification-whatsapp">WhatsApp number</FieldLabel>
                    <Input
                      id="notification-whatsapp"
                      type="tel"
                      autoComplete="tel"
                      value={preferences.whatsappNumber}
                      disabled={!preferences.enabled}
                      placeholder="+263 77 123 4567"
                      onChange={(event) => updatePreference("whatsappNumber", event.target.value)}
                    />
                  </Field>
                )}
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery rules</CardTitle>
              <CardDescription>Control location, relevance, and notification timing.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field data-disabled={!preferences.enabled}>
                  <FieldLabel htmlFor="notification-country">Tender location</FieldLabel>
                  <Select
                    value={preferences.countryScope}
                    disabled={!preferences.enabled}
                    onValueChange={(value) => updatePreference("countryScope", value as CountryScope)}
                  >
                    <SelectTrigger id="notification-country" className="w-full">
                      <Globe2 />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="ALL">Zimbabwe and Zambia</SelectItem>
                        <SelectItem value="ZW">Zimbabwe only</SelectItem>
                        <SelectItem value="ZM">Zambia only</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field data-disabled={!preferences.enabled}>
                  <FieldLabel htmlFor="notification-score">Minimum AI match</FieldLabel>
                  <Select
                    value={preferences.minimumMatchScore}
                    disabled={!preferences.enabled}
                    onValueChange={(value) => updatePreference("minimumMatchScore", value)}
                  >
                    <SelectTrigger id="notification-score" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="50">50% — Broad matches</SelectItem>
                        <SelectItem value="70">70% — Recommended</SelectItem>
                        <SelectItem value="85">85% — Strong matches</SelectItem>
                        <SelectItem value="95">95% — Exact matches</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>Higher scores reduce the number of alerts.</FieldDescription>
                </Field>

                <Field data-disabled={!preferences.enabled}>
                  <FieldLabel htmlFor="notification-frequency">Delivery frequency</FieldLabel>
                  <Select
                    value={preferences.frequency}
                    disabled={!preferences.enabled}
                    onValueChange={(value) => updatePreference("frequency", value as DeliveryFrequency)}
                  >
                    <SelectTrigger id="notification-frequency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="instant">Instantly</SelectItem>
                        <SelectItem value="twice-daily">Twice-daily digest</SelectItem>
                        <SelectItem value="daily">Daily digest</SelectItem>
                        <SelectItem value="weekly">Weekly summary</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alert preview</CardTitle>
              <CardDescription>A sample based on your current matching rules.</CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <Bell />
                <AlertTitle>
                  {preferences.enabled
                    ? `New tender match · ${preferences.minimumMatchScore}%+`
                    : "Notifications paused"}
                </AlertTitle>
                <AlertDescription>{previewMessage}</AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="flex flex-wrap justify-between gap-3">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <CheckCircle2 aria-hidden="true" />
                {formatSavedTime(lastSavedAt)}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void sendTestEmail()}
                  disabled={
                    !loaded ||
                    isDirty ||
                    testing ||
                    !preferences.enabled ||
                    !preferences.channels.email ||
                    !EMAIL_PATTERN.test(preferences.emailAddress.trim())
                  }
                >
                  {testing ? (
                    <LoaderCircle className="animate-spin" data-icon="inline-start" />
                  ) : (
                    <Mail data-icon="inline-start" />
                  )}
                  {testing ? "Sending..." : "Send test email"}
                </Button>
                <Button variant="ghost" size="sm" onClick={restoreDefaults} disabled={!loaded}>
                  <RotateCcw data-icon="inline-start" />
                  Reset
                </Button>
                <Button size="sm" onClick={() => void savePreferences()} disabled={!loaded || !isDirty || saving}>
                  {saving ? (
                    <LoaderCircle className="animate-spin" data-icon="inline-start" />
                  ) : (
                    <Save data-icon="inline-start" />
                  )}
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
