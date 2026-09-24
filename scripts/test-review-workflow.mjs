import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium, expect as baseExpect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { unzipSync } from "fflate";

const expect = baseExpect.configure({ timeout: 45000 });
process.loadEnvFile(".env.local");
const config = JSON.parse(await readFile(process.env.ATCIS_TEST_SECRETS, "utf8"));
assert.equal(config.url, process.env.NEXT_PUBLIC_SUPABASE_URL, "Test and application Supabase projects must match");
const baseURL = process.env.ATCIS_TEST_URL || "http://localhost:3000";
const admin = createClient(config.url, config.serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
const run = `review-e2e-${Date.now()}`;
const output = `test-results/${run}`;
await mkdir(output, { recursive: true });
const accounts = [];
const tenders = [];
const sources = [];
const passes = [];
let browser;
let failure;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function ok(message) { passes.push(message); console.log(`PASS ${message}`); }
function requireResult(result, label) { if (result.error) throw new Error(`${label}: ${result.error.message}`); return result.data; }
async function account(role, country, suffix = "") {
  const email = `${run}.${country}.${role}${suffix}@example.invalid`.toLowerCase();
  const password = `Test!${randomUUID()}7a`;
  const { user } = requireResult(await admin.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { name: `E2E ${country} ${role}${suffix}`, country, role } }), "Create temporary test account");
  const a = { id: user.id, email, password, country, role };
  accounts.push(a);
  requireResult(await admin.from("profiles").update({ role, country, active: true, must_change_password: false }).eq("id", a.id), "Set fixture profile");
  a.client = createClient(config.url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  requireResult(await a.client.auth.signInWithPassword({ email, password }), "Fixture API login");
  return a;
}
async function login(a) {
  a.context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  a.page = await a.context.newPage();
  a.page.setDefaultTimeout(45000);
  await a.page.goto("/auth/v2/login?redirect=/dashboard/reviews");
  await a.page.getByLabel("Email Address").fill(a.email);
  await a.page.getByLabel("Password", { exact: true }).fill(a.password);
  await a.page.getByRole("button", { name: "Access ATCIS Dashboard" }).click();
  await a.page.waitForURL("**/dashboard/reviews", { timeout: 90000 });
  await expect(a.page.getByRole("heading", { name: "Review & Approval" })).toBeVisible();
}
async function savedReview(a, checklistId) {
  const res = await a.page.request.get(`/api/reviews?checklistId=${checklistId}`);
  assert.equal(res.status(), 200, "Load saved review via authenticated app API");
  const result = await res.json();
  return result.data;
}
async function openReview(a, reference) {
  await a.page.goto("/dashboard/reviews");
  const row = a.page.getByRole("row").filter({ hasText: reference });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "Checklist", exact: true }).click();
  return a.page.getByRole("dialog");
}
async function bytesDownloaded(page, locator) {
  const promised = page.waitForEvent("download", { timeout: 60000 });
  await locator.click();
  const download = await promised;
  const path = await download.path();
  assert.equal(await download.failure(), null, "Browser download succeeds");
  return readFile(path);
}
async function cleanup() {
  const ids = accounts.map((a) => a.id);
  if (!ids.length) return;
  const checklists = requireResult(await admin.from("tender_checklists").select("id").in("owner_id", ids), "Find fixture checklists");
  if (checklists.length) {
    const rows = requireResult(await admin.from("checklist_attachments").select("storage_bucket,storage_path").in("checklist_id", checklists.map((c) => c.id)), "Find fixture uploads");
    sources.push(...rows.map((f) => ({ bucket: f.storage_bucket, path: f.storage_path })));
    requireResult(await admin.from("app_records").delete().eq("kind", "review").in("id", checklists.map((c) => `checklist-${c.id}`)), "Delete fixture reviews");
    requireResult(await admin.from("tender_checklists").delete().in("owner_id", ids), "Delete fixture checklists");
  }
  const refs = requireResult(await admin.from("tender_reference_documents").select("storage_path").in("owner_id", ids), "Find fixture references");
  sources.push(...refs.map((f) => ({ bucket: "reference-documents", path: f.storage_path })));
  requireResult(await admin.from("tender_reference_documents").delete().in("owner_id", ids), "Delete fixture references");
  requireResult(await admin.from("app_records").delete().in("id", [`${run}-document`, `${run}-folder`]), "Delete fixture repository entries");
  for (const bucket of new Set(sources.map((s) => s.bucket))) {
    const paths = [...new Set(sources.filter((s) => s.bucket === bucket).map((s) => s.path))];
    requireResult(await admin.storage.from(bucket).remove(paths), "Remove fixture bytes");
  }
  if (tenders.length) requireResult(await admin.from("tenders").delete().in("id", tenders), "Delete fixture tenders");
  for (const a of accounts) requireResult(await admin.auth.admin.deleteUser(a.id), "Delete temporary account");
  ok("All disposable users, tenders, reviews, metadata, and uploaded files removed");
}
try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const am = await account("account_manager", "ZW");
  const hod = await account("hod", "ZW");
  const tech = await account("technical_review", "ZW");
  const committee = await account("committee", "ZW");
  const outsider = await account("account_manager", "ZW", "-other");
  const otherCountry = await account("hod", "ZM");
  for (const a of accounts) await login(a);
  ok("AM, HOD, Technical, Committee, and access-control accounts sign in through the browser");
  const id = `${run}-tender`;
  const title = `E2E document workflow ${run}`;
  const payload = { id, title, refNo: run, procuringEntity: "Disposable E2E fixture", countryCode: "ZW", countryName: "Zimbabwe",
    sourcePortal: "Manual", category: "Services", sector: "Other", status: "Open", aiScore: 90,
    currency: "USD", estimatedValue: 0, publishDate: "2026-09-08", closingDate: "2099-12-31", daysRemaining: 300,
    description: "Temporary workflow verification; automatically removed." };
  requireResult(await admin.from("tenders").insert({ id, source: "e2e", source_id: id, country: "ZW", status: "live", payload, details: payload }), "Create fixture tender");
  tenders.push(id);
  const page = am.page;
  await page.goto(`/dashboard/tenders?q=${run}`);
  await page.getByRole("row").filter({ hasText: title }).getByRole("button", { name: /Details/ }).click();
  await page.getByRole("tab", { name: /Checklist/ }).click();
  await page.getByRole("button", { name: "Create your own checklist", exact: true }).click();
  await page.getByLabel("Checklist name", { exact: true }).fill(`E2E Checklist ${run}`);
  await page.getByRole("button", { name: "Add requirement", exact: true }).click();
  await page.getByLabel("Document required", { exact: true }).fill("AM uploaded evidence");
  await page.getByRole("button", { name: "Save checklist", exact: true }).click();
  await expect(page.getByRole("button", { name: "Submit to HOD Review", exact: true })).toBeDisabled();
  await expect.poll(async () => {
    const { data } = await am.client.from("tender_checklists").select("id").eq("tender_key", id).single();
    return data?.id;
  }).toBeTruthy();
  const c = requireResult(await am.client.from("tender_checklists").select("*").eq("tender_key", id).single(), "Read created checklist");
  let denied = await am.client.rpc("review_action", { p_action: "submit_checklist", p_id: `checklist-${c.id}`, p_payload: { revision: 0 } });
  assert(denied.error, "Database rejects submission with missing documents");
  ok("AM creates personal checklist; UI and database block incomplete submission");
  const evidence = Buffer.from(`AM checklist evidence ${run}\n`);
  await page.locator('input[type="file"]').first().setInputFiles({ name: "same-name.txt", mimeType: "text/plain", buffer: evidence });
  await expect(page.getByText("Document attached", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByLabel("Item name", { exact: true }).fill("Linked repository evidence");
  await page.getByRole("button", { name: "Save item", exact: true }).click();
  const repository = Buffer.from(`Repository original bytes ${run}\n`);
  const repoPath = `ZW/${am.id}/${randomUUID()}`;
  requireResult(await admin.storage.from("repository-documents").upload(repoPath, repository, { contentType: "text/plain" }), "Fixture repository upload");
  sources.push({ bucket: "repository-documents", path: repoPath });
  requireResult(await admin.from("app_records").insert([
    { kind: "folder", id: `${run}-folder`, country: "ZW", payload: { id: `${run}-folder`, name: run, countryCode: "ZW" } },
    { kind: "document", id: `${run}-document`, country: "ZW", payload: { id: `${run}-document`, name: run, countryCode: "ZW",
      folderId: `${run}-folder`, storageBucket: "repository-documents", storagePath: repoPath, fileName: "same-name.txt", sizeBytes: repository.length } },
  ]), "Fixture repository metadata");
  await page.getByRole("button", { name: "Link from Documents", exact: true }).last().click();
  await page.getByLabel("Search documents").fill(run);
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await expect(page.getByText("Document attached", { exact: true })).toHaveCount(2);
  const expectedFiles = [evidence, repository];
  for (let n = 1; n <= 3; n++) {
    const bytes = Buffer.from(`Reference ${n} original bytes ${run}\n`);
    expectedFiles.push(bytes);
    await page.getByRole("button", { name: "Add Reference Document", exact: true }).click();
    await page.getByLabel("Document name", { exact: true }).fill(`Reference ${n}`);
    await page.locator("#reference-document-file").setInputFiles({ name: "same-name.txt", mimeType: "text/plain", buffer: bytes });
    await page.getByRole("button", { name: "Save Document", exact: true }).click();
    await expect(page.getByText(`${n} / 3 uploaded`, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Submit to HOD Review", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Submit to HOD Review", exact: true }).click();
  await expect(page.getByText("Submitted", { exact: true })).toBeVisible();
  let review = await savedReview(am, c.id);
  assert.equal(review.checklist.length, 5);
  assert.equal(review.currentStepIndex, 0);
  assert.equal((await page.request.get(`/api/reviews/${review.id}/package`)).status(), 403);
  await expect(page.getByRole("button", { name: "Add item", exact: true })).toBeDisabled();
  ok("AM uploads evidence and three references, links a repository file, and submits five real files to HOD");
  const attachment = requireResult(await am.client.from("checklist_attachments").select("id").eq("checklist_id", c.id).limit(1).single(), "Find attachment");
  denied = await am.client.from("checklist_attachments").delete().eq("id", attachment.id);
  assert(denied.error, "Submitted attachment deletion rejected");
  ok("Submitted documents are locked and full ZIP download is blocked before approval");
  for (const a of [hod, tech, committee]) {
    const dialog = await openReview(a, run);
    await expect(dialog.getByText("Submitted documents (5)", { exact: true })).toBeVisible();
    const actualHashes = [];
    for (const button of await dialog.getByRole("button", { name: "Download same-name.txt", exact: true }).all()) {
      actualHashes.push(hash(await bytesDownloaded(a.page, button)));
    }
    assert.deepEqual(actualHashes.sort(), expectedFiles.map(hash).sort());
    await expect(dialog.getByRole("button", { name: "Download all files (.zip)", exact: true })).toBeDisabled();
    ok(`${a.role} sees and downloads all five original AM files byte-for-byte`);
  }
  for (const a of [outsider, otherCountry]) {
    assert.equal(await savedReview(a, c.id), null);
    assert.equal((await a.page.request.get(`/api/reviews/${review.id}/package?file=${review.checklist[0].id}`)).status(), 403);
  }
  denied = await tech.page.request.post("/api/reviews", { data: { action: "approve_step", submission: { id: review.id, revision: 1 }, stepId: "step-tech" } });
  assert.equal(denied.status(), 400);
  denied = await am.page.request.post("/api/reviews", { data: { action: "approve_step", submission: { id: review.id, revision: 1 }, stepId: "step-hod" } });
  assert.equal(denied.status(), 400);
  ok("Other AMs/countries cannot read files; AM self-approval and out-of-order review are rejected");
  // Each reviewer declines at their own stage, then the AM resubmits.
  for (let target = 0; target < 3; target++) {
    for (let stepIndex = 0; stepIndex < target; stepIndex++) {
      const reviewer = [hod, tech, committee][stepIndex];
      const dialog = await openReview(reviewer, run);
      await dialog.getByRole("button", { name: /^Accept / }).click();
      await expect(dialog.getByRole("button", { name: /^Accept / })).toHaveCount(0);
    }
    const reviewer = [hod, tech, committee][target];
    const dialog = await openReview(reviewer, run);
    await expect(dialog.getByRole("button", { name: "Decline submission", exact: true })).toBeDisabled();
    await dialog.getByLabel("Review comments").fill(`Declined by ${reviewer.role}: replace the supporting evidence.`);
    await dialog.getByRole("button", { name: "Decline submission", exact: true }).click();
    await expect(dialog.getByText("Submission declined", { exact: false })).toBeVisible();
    const rejected = await savedReview(am, c.id);
    assert.equal(rejected.overallStatus, "Declined");
    assert.equal(rejected.approvalSteps[target].status, "Declined");
    await page.getByRole("button", { name: "Refresh status", exact: true }).click();
    await expect(page.getByText(`Declined by ${reviewer.role}: replace the supporting evidence.`, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add item", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Resubmit to HOD Review", exact: true }).click();
    await expect.poll(async () => (await savedReview(am, c.id))?.revision).toBe(target + 2);
    ok(`${reviewer.role} declines with a reason; AM sees it and can resubmit`);
  }
  review = await savedReview(am, c.id);
  const stale = await hod.page.request.post("/api/reviews", { data: { action: "approve_step", submission: { id: review.id, revision: 1 }, stepId: "step-hod" } });
  assert.equal(stale.status(), 400);
  ok("Approval from an old submission revision is rejected");
  for (const reviewer of [hod, tech, committee]) {
    const dialog = await openReview(reviewer, run);
    await dialog.getByRole("button", { name: /^Accept / }).click();
    await expect(dialog.getByRole("button", { name: /^Accept / })).toHaveCount(0);
    ok(`${reviewer.role} accepts its pending stage`);
  }
  const approved = await savedReview(am, c.id);
  assert.equal(approved.overallStatus, "Approved for Submission");
  assert.equal(approved.history.length, 3);
  await page.getByRole("button", { name: "Refresh status", exact: true }).click();
  const zip = await bytesDownloaded(page, page.getByRole("button", { name: "Download all files (.zip)", exact: true }));
  const contents = unzipSync(zip);
  assert.equal(Object.keys(contents).length, 6);
  assert.deepEqual(Object.entries(contents).filter(([name]) => name !== "Approval_Record.json").map(([, data]) => hash(data)).sort(), expectedFiles.map(hash).sort());
  assert.equal(JSON.parse(Buffer.from(contents["Approval_Record.json"]).toString()).overallStatus, "Approved for Submission");
  ok("Approved ZIP contains every original file despite repeated filenames, plus the approval history");
  await page.screenshot({ path: `${output}/am-approved-desktop.png` });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: `${output}/am-approved-dark.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Download all files (.zip)", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/am-approved-mobile.png` });
  await committee.page.screenshot({ path: `${output}/committee-approved.png` });
} catch (error) {
  failure = error;
  let message = error?.stack || String(error);
  for (const secret of [config.serviceRole, ...accounts.map((a) => a.password)]) message = message.replaceAll(secret, "[redacted]");
  console.error(message);
  for (const a of accounts.filter((a) => a.page)) await a.page.screenshot({ path: `${output}/failure-${a.country}-${a.role}.png` }).catch(() => {});
} finally {
  await browser?.close();
  try { await cleanup(); } catch (error) { failure ||= error; console.error(`Fixture cleanup failed: ${error.message}`); }
  await writeFile(`${output}/report.json`, JSON.stringify({ run, passed: passes, success: !failure, error: failure?.message }, null, 2));
  console.log(`Report: ${output}/report.json`);
}
if (failure) process.exitCode = 1;
