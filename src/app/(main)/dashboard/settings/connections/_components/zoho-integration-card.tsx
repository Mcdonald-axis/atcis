"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Copy, Loader2, Lock, Send, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyTextToClipboard } from "@/lib/utils";

interface CountryConfig {
  code: string;
  name: string;
  configured: boolean;
}

export function ZohoIntegrationCard() {
  const [countries, setCountries] = useState<Record<string, CountryConfig>>({
    ZM: {
      code: "ZM",
      name: "Zambia",
      configured: true,
    },
    ZW: {
      code: "ZW",
      name: "Zimbabwe",
      configured: false,
    },
  });

  // Accurate connection state — starts as not_connected until verified
  const [connectionStatus, setConnectionStatus] = useState<Record<string, "not_connected" | "connected">>({
    ZM: "not_connected",
    ZW: "not_connected",
  });

  const [testingCountry, setTestingCountry] = useState<string | null>(null);
  const [testResponse, setTestResponse] = useState<any | null>(null);
  const [customZwUrl, setCustomZwUrl] = useState("");
  const [isSavingZw, setIsSavingZw] = useState(false);

  useEffect(() => {
    fetch("/api/crm/zoho")
      .then((res) => res.json())
      .then((data) => {
        if (data?.countries) {
          setCountries(data.countries);
        }
      })
      .catch(() => {});

    // Check if custom ZW URL is stored in localStorage
    try {
      const savedZw = localStorage.getItem("zoho_webhook_zw_custom");
      if (savedZw) {
        setCustomZwUrl(savedZw);
      }
    } catch {}
  }, []);

  const handleTestPing = async (countryCode: string) => {
    setTestingCountry(countryCode);
    setTestResponse(null);
    try {
      const effectiveUrl = countryCode === "ZW" && customZwUrl ? customZwUrl : undefined;

      const res = await fetch("/api/crm/zoho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "test_connection",
          countryCode,
          customWebhookUrl: effectiveUrl,
          stage: "New",
          tender: {
            id: `test-${Date.now()}`,
            refNo: `${countryCode === "ZM" ? "ZPPA/TEST/2026/001" : "PRAZ/TEST/2026/001"}`,
            title: `Sample Integration Test Tender (${countryCode === "ZM" ? "Zambia" : "Zimbabwe"})`,
            entity: countryCode === "ZM" ? "ZESCO Limited" : "City of Harare",
            estimatedValue: 250000,
            amountAwarded: 240000,
            actualCost: 180000,
            grossMargin: 60000,
            team: "ICT & Telecoms",
            countryCode,
            dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
            progress: 10,
            aiScore: 92,
          },
        }),
      });

      const json = await res.json();
      setTestResponse(json);

      if (res.ok && json.success) {
        setConnectionStatus((prev) => ({ ...prev, [countryCode]: "connected" }));
        toast.success(`Connected to ${countries[countryCode]?.name || countryCode} Zoho CRM!`, {
          description: "Test webhook delivered and verified successfully.",
        });
      } else {
        setConnectionStatus((prev) => ({ ...prev, [countryCode]: "not_connected" }));
        if (res.status === 410 || json.status === 410) {
          toast.warning(`Zoho Flow is Currently Inactive (HTTP 410)`, {
            description: "Open your Zoho Flow dashboard and toggle the flow switch to ON.",
            duration: 7000,
          });
        } else {
          toast.error(`Connection Test Failed`, {
            description: json.error || `Server responded with status ${res.status}`,
          });
        }
      }
    } catch (err: any) {
      setConnectionStatus((prev) => ({ ...prev, [countryCode]: "not_connected" }));
      toast.error("Network Error", {
        description: err.message || "Failed to reach backend endpoint",
      });
    } finally {
      setTestingCountry(null);
    }
  };

  const handleSaveZw = () => {
    if (!customZwUrl.trim()) {
      toast.error("Please enter a valid webhook URL");
      return;
    }
    setIsSavingZw(true);
    try {
      localStorage.setItem("zoho_webhook_zw_custom", customZwUrl.trim());
      setCountries((prev) => ({
        ...prev,
        ZW: {
          ...prev.ZW,
          configured: true,
        },
      }));
      toast.success("Zimbabwe Webhook Saved", {
        description: "Tenders from Zimbabwe will now route to this protected endpoint.",
      });
    } finally {
      setIsSavingZw(false);
    }
  };

  return (
    <Card className="border-border/80 shadow-md">
      <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-bold">Zoho CRM Webhook Integration</CardTitle>
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                Protected Endpoint
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Automatically creates Deals and synchronizes pipeline stages in country-specific Zoho CRM instances
              (Zambia &amp; Zimbabwe).
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-6">
        {/* Country Webhook Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ZAMBIA ZOHO CRM */}
          <div
            className={`rounded-xl border p-4 space-y-3 transition-colors ${
              connectionStatus.ZM === "connected"
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-border/80 bg-muted/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-foreground">Zambia Zoho CRM</h4>
                <p className="text-[11px] text-muted-foreground">ZPPA e-GP &amp; Zambian Procurement</p>
              </div>
              <Badge
                variant="outline"
                className={
                  connectionStatus.ZM === "connected"
                    ? "bg-emerald-600 text-white border-emerald-600 font-mono text-[10px] gap-1"
                    : "border-border text-muted-foreground font-mono text-[10px]"
                }
              >
                {connectionStatus.ZM === "connected" ? (
                  <>
                    <CheckCircle2 className="size-3" /> Connected
                  </>
                ) : (
                  "Not Connected"
                )}
              </Badge>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground font-semibold flex items-center justify-between">
                <span>Incoming Flow Webhook</span>
                <span className="text-[10px] text-muted-foreground/70 font-normal flex items-center gap-1">
                  <Lock className="size-2.5" /> Hidden to prevent manipulation
                </span>
              </Label>
              <div className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-background/80 px-3 py-1.5 font-mono text-xs text-muted-foreground">
                <span className="tracking-widest text-xs select-none">••••••••••••••••••••••••••••••••</span>
                <span className="text-[10px] font-sans text-muted-foreground/70 shrink-0">Server Protected</span>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">
                Trigger: New pipeline additions &amp; stage moves
              </span>
              <Button
                size="xs"
                variant="outline"
                disabled={testingCountry === "ZM"}
                onClick={() => handleTestPing("ZM")}
                className="h-7 text-xs gap-1.5 font-semibold cursor-pointer"
              >
                {testingCountry === "ZM" ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                Test Connection
              </Button>
            </div>
          </div>

          {/* ZIMBABWE ZOHO CRM */}
          <div
            className={`rounded-xl border p-4 space-y-3 transition-colors ${
              connectionStatus.ZW === "connected"
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-border/80 bg-muted/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-foreground">Zimbabwe Zoho CRM</h4>
                <p className="text-[11px] text-muted-foreground">PRAZ e-GP &amp; Zimbabwe Procurement</p>
              </div>
              <Badge
                variant="outline"
                className={
                  connectionStatus.ZW === "connected"
                    ? "bg-emerald-600 text-white border-emerald-600 font-mono text-[10px] gap-1"
                    : "border-border text-muted-foreground font-mono text-[10px]"
                }
              >
                {connectionStatus.ZW === "connected" ? (
                  <>
                    <CheckCircle2 className="size-3" /> Connected
                  </>
                ) : (
                  "Not Connected"
                )}
              </Badge>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="zwWebhookInput"
                className="text-[11px] text-muted-foreground font-semibold flex items-center justify-between"
              >
                <span>Incoming Flow Webhook URL</span>
                <span className="text-[10px] text-muted-foreground/70 font-normal flex items-center gap-1">
                  <Lock className="size-2.5" /> Masked
                </span>
              </Label>
              <div className="flex gap-1.5">
                <Input
                  id="zwWebhookInput"
                  type="password"
                  value={customZwUrl}
                  onChange={(e) => setCustomZwUrl(e.target.value)}
                  placeholder="Paste webhook URL (masked)"
                  className="h-7 text-xs font-mono"
                />
                <Button
                  size="xs"
                  onClick={handleSaveZw}
                  disabled={isSavingZw || !customZwUrl.trim()}
                  className="h-7 text-xs px-2.5"
                >
                  Save
                </Button>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">
                Set in .env.local as <code className="font-mono text-primary">ZOHO_CRM_WEBHOOK_ZW</code>
              </span>
              <Button
                size="xs"
                variant="outline"
                disabled={testingCountry === "ZW" || (!countries.ZW?.configured && !customZwUrl.trim())}
                onClick={() => handleTestPing("ZW")}
                className="h-7 text-xs gap-1.5 font-semibold cursor-pointer"
              >
                {testingCountry === "ZW" ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                Test Connection
              </Button>
            </div>
          </div>
        </div>

        {/* Live Diagnostics Panel if test was performed */}
        {testResponse && (
          <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5 text-foreground">
                {testResponse.success ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="size-4 text-amber-500" />
                )}
                Webhook Diagnostics: {testResponse.countryName || "Zoho Flow"} (HTTP {testResponse.status || 200})
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setTestResponse(null)}
                className="h-5 text-[10px] text-muted-foreground"
              >
                Dismiss
              </Button>
            </div>

            <p className="text-muted-foreground text-[11px] leading-relaxed">
              {testResponse.message || testResponse.error}
            </p>

            {testResponse.status === 410 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] space-y-1 text-amber-900 dark:text-amber-200">
                <span className="font-bold block">Action Required in Zoho Flow:</span>
                <p>
                  1. Log into your <strong>Zoho Flow</strong> account (Account #688150434).
                </p>
                <p>2. Open the Flow linked to this incoming webhook.</p>
                <p>
                  3. In the top right corner of Zoho Flow, toggle the <strong>Flow status switch from OFF to ON</strong>
                  .
                </p>
                <p>4. Once active, incoming tenders will automatically create Deals in your Zoho CRM!</p>
              </div>
            )}
          </div>
        )}

        {/* Tenders Zambia (CustomModule1) Field Mapping Guide */}
        <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-foreground">
                  Exact Field Mapping: Tenders Zambia (CustomModule1)
                </h4>
                <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[9px] font-mono">
                  Module: CustomModule1
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground pt-0.5">
                Every field in our outgoing webhook directly matches the API names in your Zoho CRM custom module.
              </p>
            </div>

            <Button
              variant="outline"
              size="xs"
              onClick={async () => {
                const samplePayload = {
                  Name: "ZESCO Limited - ZPPA/ZESCO/2026/102",
                  Budget_Amt: 4100000,
                  Tender_Value: "4100000",
                  Tender_Status: "New",
                  Compilation_Percentage: 15,
                  Gross_Profit_USD: 950000,
                  GP_Age: 23,
                  Products_Services_Supplied: "Electrical Grid - Distribution Transformers 33kV Supply",
                  Official_Submission_Date: "2026-09-18T14:00:00+02:00",
                  Date_Tender_Submitted: null,
                  Currency: "USD",
                  Checked_for_Compliance: "Yes",
                  Tender_Budget_Available: "Yes",
                  Reason_for_Tender_Loss: "",
                  Comments: "Distribution Transformers 33kV Supply opportunity scraped from ZPPA e-GP.",
                  Tag: "ZPPA",
                  Email: "mulenga@atcis.co.zw",
                  Exchange_Rate: 1.0,
                  deal: {
                    deal_name: "Distribution Transformers 33kV Supply",
                    amount: 4100000,
                    stage: "New",
                    account_name: "ZESCO Limited",
                    lead_source: "ZPPA e-GP",
                  },
                };
                const copied = await copyTextToClipboard(JSON.stringify(samplePayload, null, 2));
                if (copied) toast.success("Sample JSON copied to clipboard! Paste it into Zoho Flow test.");
                else toast.error("Copy failed. Select and copy the sample JSON manually.");
              }}
              className="h-7 text-xs gap-1.5 font-semibold shrink-0 cursor-pointer"
            >
              <Copy className="size-3" />
              Copy Sample JSON for Zoho Flow
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-border/70 bg-background">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-muted/60 text-[10px] text-muted-foreground uppercase border-b border-border/70">
                <tr>
                  <th className="px-3 py-2">Zoho CRM Field Label</th>
                  <th className="px-3 py-2 font-bold text-foreground">Exact API Name</th>
                  <th className="px-3 py-2">Data Type</th>
                  <th className="px-3 py-2">Source Value in Pipeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-[11px]">
                <tr className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-sans font-medium text-foreground">Tendering Organization</td>
                  <td className="px-3 py-2 text-primary font-bold">Name</td>
                  <td className="px-3 py-2 text-muted-foreground font-sans">Single Line (Mandatory)</td>
                  <td className="px-3 py-2 text-muted-foreground">Entity + Tender Reference</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-sans font-medium text-foreground">Budget Amt</td>
                  <td className="px-3 py-2 text-primary font-bold">Budget_Amt</td>
                  <td className="px-3 py-2 text-muted-foreground font-sans">Number</td>
                  <td className="px-3 py-2 text-muted-foreground">Estimated Budget (USD)</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-sans font-medium text-foreground">Tender Value</td>
                  <td className="px-3 py-2 text-primary font-bold">Tender_Value</td>
                  <td className="px-3 py-2 text-muted-foreground font-sans">Single Line</td>
                  <td className="px-3 py-2 text-muted-foreground">Contract / Award Value</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-sans font-medium text-foreground">Tender Status</td>
                  <td className="px-3 py-2 text-primary font-bold">Tender_Status</td>
                  <td className="px-3 py-2 text-muted-foreground font-sans">Pick List</td>
                  <td className="px-3 py-2 text-muted-foreground">Stage (New, Won, In Delivery, etc.)</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-sans font-medium text-foreground">Compilation Percentage</td>
                  <td className="px-3 py-2 text-primary font-bold">Compilation_Percentage</td>
                  <td className="px-3 py-2 text-muted-foreground font-sans">Percent</td>
                  <td className="px-3 py-2 text-muted-foreground">Dossier Progress (0 - 100%)</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-sans font-medium text-foreground">Gross Profit (USD)</td>
                  <td className="px-3 py-2 text-primary font-bold">Gross_Profit_USD</td>
                  <td className="px-3 py-2 text-muted-foreground font-sans">Number</td>
                  <td className="px-3 py-2 text-muted-foreground">Expected Gross Margin ($)</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-sans font-medium text-foreground">GP % Age</td>
                  <td className="px-3 py-2 text-primary font-bold">GP_Age</td>
                  <td className="px-3 py-2 text-muted-foreground font-sans">Percent</td>
                  <td className="px-3 py-2 text-muted-foreground">Commercial Margin Percentage (%)</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-sans font-medium text-foreground">Products / Services Supplied</td>
                  <td className="px-3 py-2 text-primary font-bold">Products_Services_Supplied</td>
                  <td className="px-3 py-2 text-muted-foreground font-sans">Single Line</td>
                  <td className="px-3 py-2 text-muted-foreground">Sector Category &amp; Tender Title</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-sans font-medium text-foreground">Official Submission Date</td>
                  <td className="px-3 py-2 text-primary font-bold">Official_Submission_Date</td>
                  <td className="px-3 py-2 text-muted-foreground font-sans">DateTime</td>
                  <td className="px-3 py-2 text-muted-foreground">Tender Closing / Due Date (ISO)</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-sans font-medium text-foreground">Reason for Tender Loss / Award</td>
                  <td className="px-3 py-2 text-primary font-bold">Reason_for_Tender_Loss</td>
                  <td className="px-3 py-2 text-muted-foreground font-sans">Single Line</td>
                  <td className="px-3 py-2 text-muted-foreground">Win / Loss Driver Debrief</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-sans font-medium text-foreground">Currency</td>
                  <td className="px-3 py-2 text-primary font-bold">Currency</td>
                  <td className="px-3 py-2 text-muted-foreground font-sans">Pick List</td>
                  <td className="px-3 py-2 text-muted-foreground">&quot;USD&quot;</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-sans font-medium text-foreground">Checked for Compliance</td>
                  <td className="px-3 py-2 text-primary font-bold">Checked_for_Compliance</td>
                  <td className="px-3 py-2 text-muted-foreground font-sans">Pick List</td>
                  <td className="px-3 py-2 text-muted-foreground">&quot;Yes&quot;</td>
                </tr>
                <tr className="hover:bg-muted/20">
                  <td className="px-3 py-2 font-sans font-medium text-foreground">Comments</td>
                  <td className="px-3 py-2 text-primary font-bold">Comments</td>
                  <td className="px-3 py-2 text-muted-foreground font-sans">Multi Line</td>
                  <td className="px-3 py-2 text-muted-foreground">Lessons Learned / Delivery Status Notes</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
