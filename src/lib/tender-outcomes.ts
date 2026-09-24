export interface TenderOutcome {
  id: string;
  tenderRef: string;
  title: string;
  entity: string;
  countryCode: "ZW" | "ZM";
  outcome: "Won" | "Lost" | "Under Evaluation";
  ourBidPrice: number;
  winningBidPrice: number;
  winningCompany: string;
  awardDate: string;
  keyTakeaway: string;
  currency?: string;
}

export interface OutcomeSourceRecord {
  kind: string;
  id: string;
  country: string;
  payload: Record<string, unknown>;
}

const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const amount = (value: unknown): number => typeof value === "number" && Number.isFinite(value) ? value : 0;
const identity = (country: string, reference: string, id: string) =>
  JSON.stringify([country, reference.trim().toLowerCase() || id]);

/** Rows arrive newest first. Read through the caller's RLS; never create synthetic debrief records. */
export function collectTenderOutcomes(rows: OutcomeSourceRecord[]): TenderOutcome[] {
  const manual = new Map<string, TenderOutcome>();
  for (const row of rows) {
    if (row.kind !== "lesson") continue;
    const item = row.payload as unknown as TenderOutcome;
    const key = identity(item.countryCode, item.tenderRef || "", row.id);
    if (!manual.has(key)) manual.set(key, item);
  }

  const pipeline = new Map<string, TenderOutcome>();
  const seenTasks = new Set<string>();
  for (const row of rows) {
    if (row.kind !== "pipeline") continue;
    const board = row.payload.board;
    if (!board || typeof board !== "object" || Array.isArray(board)) continue;
    for (const [stage, tasks] of Object.entries(board)) {
      if (!Array.isArray(tasks)) continue;
      for (const value of tasks) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        const task = value as Record<string, unknown>;
        const id = text(task.id);
        const country = text(task.countryCode) || row.country;
        if (!id || (country !== "ZW" && country !== "ZM")) continue;
        const taskKey = identity(country, "", id);
        if (seenTasks.has(taskKey)) continue;
        seenTasks.add(taskKey);
        // Match the pipeline's current Won/Lost columns exactly.
        const outcome = stage === "won" ? "Won" : stage === "lost" ? "Lost" : null;
        if (!outcome) continue;
        const reference = text(task.refNo);
        const key = identity(country, reference, id);
        if (pipeline.has(key)) continue;
        pipeline.set(key, {
          id: `pipeline-outcome:${country}:${id}`,
          tenderRef: reference || id,
          title: text(task.title),
          entity: text(task.entity),
          countryCode: country,
          outcome,
          // An estimated contract value is not an actual submitted bid price.
          ourBidPrice: 0,
          winningBidPrice: outcome === "Won" ? amount(task.amountAwarded) : 0,
          winningCompany: outcome === "Won" ? "Our Company" : "",
          awardDate: "",
          keyTakeaway: [text(task.winLossReason), text(task.lessonsLearned)].filter(Boolean).join(" — "),
          currency: /^[A-Z]{3}$/.test(text(task.currency).toUpperCase())
            ? text(task.currency).toUpperCase() : "USD",
        });
      }
    }
  }

  for (const [key, logged] of manual) {
    const saved = pipeline.get(key);
    pipeline.set(key, saved ? {
      ...saved,
      ...logged,
      outcome: saved.outcome,
      winningBidPrice: logged.winningBidPrice || saved.winningBidPrice,
      winningCompany: logged.winningCompany || saved.winningCompany,
      keyTakeaway: logged.keyTakeaway || saved.keyTakeaway,
      currency: logged.currency || "USD",
    } : logged);
  }
  return [...pipeline.values()];
}
