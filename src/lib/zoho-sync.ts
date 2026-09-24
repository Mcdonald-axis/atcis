import { toast } from "sonner";

export interface ZohoSyncResult {
  success: boolean;
  message?: string;
  error?: string;
  status?: number;
  countryCode?: string;
  countryName?: string;
  details?: any;
}

/**
 * Sends a tender opportunity or pipeline update to the country-specific Zoho CRM webhook
 */
export async function syncTenderToZohoCrm(
  tender: any,
  options: {
    event?: "tender_pipeline_added" | "tender_stage_changed" | "tender_updated" | "manual_sync";
    stage?: string;
    countryCode?: string;
    silent?: boolean;
  } = {},
): Promise<ZohoSyncResult> {
  const country =
    options.countryCode ||
    tender?.countryCode ||
    (tender?.refNo?.toLowerCase().includes("zppa") || tender?.refNo?.toLowerCase().includes("zesco") ? "ZM" : "ZW");

  const countryName = country === "ZM" ? "Zambia" : country === "ZW" ? "Zimbabwe" : country;

  try {
    const res = await fetch("/api/crm/zoho", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: options.event ?? "tender_pipeline_added",
        tender,
        countryCode: country,
        stage: options.stage || "New",
      }),
    });

    const data: ZohoSyncResult = await res.json();
    const resolvedCountryName = data.countryName ?? countryName;

    if (!options.silent) {
      if (data.success) {
        toast.success(`Synced to ${resolvedCountryName} Zoho CRM`, {
          description: `"${tender.refNo || tender.title}" is now recorded in Zoho CRM.`,
        });
      } else if (data.status === 410) {
        toast.warning(`${resolvedCountryName} Zoho Flow is Inactive (HTTP 410)`, {
          description:
            "Your Zoho Flow webhook is currently turned OFF. Open your Zoho Flow dashboard and toggle the switch to ON.",
          duration: 6000,
        });
      } else {
        toast.error(`Zoho CRM Sync Issue (${resolvedCountryName})`, {
          description: data.error || "Could not deliver payload to Zoho webhook.",
        });
      }
    }

    return data;
  } catch (err: any) {
    const errorMsg = err.message || "Failed to contact Zoho CRM sync endpoint";
    if (!options.silent) {
      toast.error("Zoho Sync Error", { description: errorMsg });
    }
    return {
      success: false,
      error: errorMsg,
      countryCode: country,
      countryName,
    };
  }
}
