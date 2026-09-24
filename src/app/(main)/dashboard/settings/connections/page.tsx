import { Badge } from "@/components/ui/badge";
import { ZohoIntegrationCard } from "./_components/zoho-integration-card";

export const metadata = {
  title: "Connections & Integrations | Settings",
  description: "Manage external CRM webhooks, API connections, and Zoho CRM field mapping.",
};

export default function ConnectionsPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Settings Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium mb-1">
            <span>Settings</span>
            <span>/</span>
            <span className="text-foreground font-semibold">Connections</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Connections &amp; Integrations
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage external CRM webhooks, API connections, and Zoho CRM field mappings for automated tender synchronization.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge variant="outline" className="text-xs py-1 px-2.5 border-primary/30 bg-primary/5 text-primary font-normal">
            Super Admin Restricted
          </Badge>
        </div>
      </div>

      {/* Primary Integration & Field Mapping Card */}
      <ZohoIntegrationCard />
    </div>
  );
}
