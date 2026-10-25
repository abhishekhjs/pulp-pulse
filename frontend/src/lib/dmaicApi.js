/**
 * dmaicApi.js
 *
 * All fetch helpers for the DMAIC Agent, routed through the Pulp Pulse
 * backend proxy at /api/dmaic/** → DMAIC FastAPI (port 8001).
 */

const DMAIC_BASE = '/api/dmaic';

// ─────────────────────────────────────────────────────────────────────────────
// Historical Baseline & Post-Intervention Datasets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch calibrated historical baseline and post-intervention data for a module.
 */
export async function fetchHistoricalDataset(moduleName) {
  const res = await fetch(`${DMAIC_BASE}/historical-datasets/${moduleName.toLowerCase()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Company management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ensure a DMAIC "company" context exists for the given module.
 * Safe to call repeatedly — ignores 400 "already registered" errors.
 */
export async function ensureCompany(companyId, displayName) {
  const res = await fetch(`${DMAIC_BASE}/companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: companyId, display_name: displayName }),
  });
  // 400 means it already exists — that's fine
  if (!res.ok && res.status !== 400) {
    throw new Error(`Failed to create company context: ${await res.text()}`);
  }
  return res.status === 400 ? null : res.json();
}

/**
 * Fetch company details (includes sop_chunk_count).
 */
export async function getCompany(companyId) {
  const res = await fetch(`${DMAIC_BASE}/companies/${companyId}`);
  if (!res.ok) throw new Error(`Company not found: ${companyId}`);
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// SOP ingestion (RAG vector store)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload and ingest an SOP file (.pdf, .md, .txt) for a company namespace.
 * Returns { filename, chunk_count }.
 */
export async function uploadSOP(companyId, file, docType = 'SOP') {
  const form = new FormData();
  form.append('file', file);
  form.append('doc_type', docType);

  const res = await fetch(`${DMAIC_BASE}/companies/${companyId}/sop-files`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * List previously ingested SOP files for a company namespace.
 * Returns SOPFileRead[].
 */
export async function listSOPs(companyId) {
  const res = await fetch(`${DMAIC_BASE}/companies/${companyId}/sop-files`);
  if (!res.ok) return [];
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// DMAIC runs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start a new DMAIC analysis run.
 *
 * @param {string} companyId
 * @param {string} problemStatement
 * @param {File}   baselineFile   — CSV with baseline process data
 * @param {File}   postFile       — CSV with post-intervention data
 * @returns DMAICRunRead (id, status, ...)
 */
export async function startRun(companyId, problemStatement, baselineFile, postFile) {
  const form = new FormData();
  form.append('company_id', companyId);
  form.append('problem_statement', problemStatement);
  form.append('baseline_file', baselineFile);
  form.append('post_file', postFile);

  const res = await fetch(`${DMAIC_BASE}/runs`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * Open a Server-Sent Events stream for a running DMAIC run.
 * Returns an EventSource. Caller is responsible for calling .close().
 *
 * Events emitted by the stream:
 *   { event: "node_start",    node: string }
 *   { event: "node_complete", node: string, data: object }
 *   { event: "completed" | "failed" | "escalated", run_id: number }
 */
export function openRunStream(runId) {
  return new EventSource(`${DMAIC_BASE}/runs/${runId}/stream`);
}

/**
 * Fetch a single run by ID (for results after completion).
 */
export async function getRun(runId) {
  const res = await fetch(`${DMAIC_BASE}/runs/${runId}`);
  if (!res.ok) throw new Error('Failed to fetch DMAIC run');
  return res.json();
}

/**
 * List all runs for a company (most recent first).
 */
export async function listRuns(companyId) {
  const res = await fetch(`${DMAIC_BASE}/runs?company_id=${companyId}`);
  if (!res.ok) return [];
  return res.json();
}
