import assert from "node:assert/strict";

import { classifyTenderSector } from "../lib/tender-mapping";

const fixtures = [
  ["Contract award for home economics equipment", "General Goods & Consumables"],
  ["Procurement of computer workstations and network switches", "ICT & Software"],
  ["Supply of medical equipment and laboratory reagents", "Healthcare & Medical"],
  ["Construction of a new district hospital", "Civil & Infrastructure"],
  ["Consultancy services to develop an infrastructure plan", "Services & Logistics"],
  ["Supply and installation of a solar power system", "Electrical & Energy"],
] as const;

for (const [title, expectedSector] of fixtures) {
  const result = classifyTenderSector({ title });
  assert.equal(result.sector, expectedSector, `${title}: expected ${expectedSector}, got ${result.sector}`);
}

const ambiguous = classifyTenderSector({ title: "Invitation to bid", description: "Public procurement opportunity" });
assert.equal(ambiguous.sector, "Other");
assert.equal(ambiguous.needsClassificationReview, true);

console.log(`Tender classifier passed ${fixtures.length + 1} fixtures.`);
