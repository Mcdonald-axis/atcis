"use client";

import { useState } from "react";
import { BellRing, CheckCheck, MessageCircle, MessageSquare, Plus, Send, Settings, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AlertLog {
  id: string;
  timestamp: string;
  recipientGroup: string;
  recipientsCount: number;
  messagePreview: string;
  tenderRef: string;
  status: "Delivered" | "Pending" | "Failed";
}

const alertLogs: AlertLog[] = [
  {
    id: "al-1",
    timestamp: "Today, 08:30 AM",
    recipientGroup: "Executive & Bid Directors",
    recipientsCount: 8,
    messagePreview: "NEW TENDER: ZETDC Substation Switchgear Upgrade ($3.2M). AI Fit: 94%. Deadline in 3 days.",
    tenderRef: "PRAZ/ZETDC/2026/089",
    status: "Delivered",
  },
  {
    id: "al-2",
    timestamp: "Today, 08:15 AM",
    recipientGroup: "Zambia Infrastructure Leads",
    recipientsCount: 12,
    messagePreview: "DEADLINE ALERT: RDA Lusaka-Ndola Highway Dualization Subcontracts closing in 96 hours.",
    tenderRef: "ZPPA/RDA/2026/114",
    status: "Delivered",
  },
  {
    id: "al-3",
    timestamp: "Yesterday, 16:45 PM",
    recipientGroup: "ICT & Software Sector Team",
    recipientsCount: 6,
    messagePreview: "AWARD NOTICE: POTRAZ Data Center Modernization contract awarded ($640K).",
    tenderRef: "MOFED/ICT/2026/042",
    status: "Delivered",
  },
  {
    id: "al-4",
    timestamp: "Yesterday, 11:20 AM",
    recipientGroup: "Healthcare & Pharmaceuticals",
    recipientsCount: 5,
    messagePreview: "NEW TENDER: NatPharm Medical Consumables ($1.1M). Submissions open until 08 Sep.",
    tenderRef: "NATPHARM/2026/021",
    status: "Delivered",
  },
];

export default function WhatsAppAlertsPage() {
  const [testSent, setTestSent] = useState(false);

  const handleTestSend = () => {
    setTestSent(true);
    setTimeout(() => setTestSent(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/50 pb-5 md:flex-row md:items-center">
        <div>
          <h1 className="font-bold text-2xl tracking-tight text-foreground sm:text-3xl">
            WhatsApp & Instant Alert Broadcasts
          </h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Automated WhatsApp notifications for new matching tenders, urgent deadlines, and award notices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleTestSend}
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs font-medium"
          >
            <Send className="size-3.5" />
            {testSent ? "Test Dispatch Sent!" : "Send Test WhatsApp Alert"}
          </Button>
          <Button size="sm" className="gap-1.5 text-xs font-medium">
            <Plus className="size-3.5" /> Configure Alert Group
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Broadcast Subscribers
            </span>
            <div className="mt-1 font-bold font-mono text-2xl text-foreground sm:text-3xl">31 Contacts</div>
            <p className="mt-1 text-xs text-muted-foreground">Across 4 specialized sector channels</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Alerts Dispatched (30d)
            </span>
            <div className="mt-1 font-bold font-mono text-2xl text-foreground sm:text-3xl">142 Broadcasts</div>
            <p className="mt-1 text-xs text-muted-foreground">99.4% WhatsApp delivery rate</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Automated AI Trigger
            </span>
            <div className="mt-1 font-bold font-mono text-2xl text-emerald-600 dark:text-emerald-400 sm:text-3xl">
              &gt; 85% Fit
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Instant ping when high-match tender scraped</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Gateway Status
            </span>
            <div className="mt-1 flex items-center gap-1.5 font-bold text-2xl text-emerald-600 dark:text-emerald-400 sm:text-3xl">
              <CheckCheck className="size-6 text-emerald-500" />
              Connected
            </div>
            <p className="mt-1 text-xs text-muted-foreground">WhatsApp Business API Webhook Active</p>
          </CardContent>
        </Card>
      </div>

      {/* Broadcast History Table */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Broadcast Dispatch Log</CardTitle>
          <CardDescription>
            Recent automated notifications transmitted to tender project managers and directors.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-border/50">
            <Table>
              <TableHeader className="bg-muted/40 text-xs">
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Recipient Group</TableHead>
                  <TableHead>Tender Reference</TableHead>
                  <TableHead>WhatsApp Message Preview</TableHead>
                  <TableHead className="text-center">Delivered</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {alertLogs.map((log) => (
                  <TableRow key={log.id} className="transition-colors hover:bg-muted/30">
                    <TableCell className="font-mono text-muted-foreground">{log.timestamp}</TableCell>
                    <TableCell className="font-semibold text-foreground">{log.recipientGroup}</TableCell>
                    <TableCell className="font-mono font-medium text-foreground">{log.tenderRef}</TableCell>
                    <TableCell className="max-w-md truncate text-foreground">{log.messagePreview}</TableCell>
                    <TableCell className="text-center font-mono">{log.recipientsCount} users</TableCell>
                    <TableCell>
                      <Badge variant="default" className="text-[10px]">
                        {log.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
