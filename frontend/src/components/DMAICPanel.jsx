/**
 * DMAICPanel.jsx
 *
 * Slide-over panel that lets a user run a full DMAIC analysis from any
 * Pulp Pulse supply-chain module page.
 *
 * Workflow:
 *   Step 1 — SOP Upload  →  feeds ChromaDB RAG for this module's namespace
 *   Step 2 — Run Config  →  problem statement + two CSV files
 *   Step 3 — Streaming   →  live SSE phase cards
 *   Step 4 — Results     →  collapsible DMAIC output accordion
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Upload,
  FlaskConical,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Activity,
  Target,
  BarChart2,
  Lightbulb,
  ShieldCheck,
  RotateCcw,
  Paperclip,
  Zap,
  Maximize2,
} from 'lucide-react';
import {
  ensureCompany,
  uploadSOP,
  listSOPs,
  startRun,
  openRunStream,
  getRun,
  fetchHistoricalDataset,
} from '../lib/dmaicApi';
import {
  DefineView,
  MeasureView,
  AnalyzeView,
  ImproveView,
  ControlView,
} from './DMAICReportView';
import DMAICReportModal from './DMAICReportModal';

// ─────────────────────────────────────────────────────────────────────────────
// Phase metadata
// ─────────────────────────────────────────────────────────────────────────────

const PHASES = [
  { key: 'sop_retrieval', label: 'SOP Retrieval',  Icon: BookOpen,    color: 'text-airtable-muted',  bg: 'bg-airtable-surface-soft',  border: 'border-airtable-hairline' },
  { key: 'define',        label: 'Define',          Icon: Target,      color: 'text-airtable-link',   bg: 'bg-airtable-surface-soft',  border: 'border-airtable-hairline' },
  { key: 'measure',       label: 'Measure',         Icon: Activity,    color: 'text-airtable-ink',    bg: 'bg-airtable-surface-soft',  border: 'border-airtable-hairline' },
  { key: 'analyze',       label: 'Analyze',         Icon: BarChart2,   color: 'text-airtable-mustard',bg: 'bg-airtable-surface-soft',  border: 'border-airtable-hairline' },
  { key: 'improve',       label: 'Improve',         Icon: Lightbulb,   color: 'text-airtable-forest', bg: 'bg-airtable-surface-soft',  border: 'border-airtable-hairline' },
  { key: 'control',       label: 'Control',         Icon: ShieldCheck, color: 'text-airtable-coral',  bg: 'bg-airtable-surface-soft',  border: 'border-airtable-hairline' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tiny helpers
// ─────────────────────────────────────────────────────────────────────────────

function FileDropZone({ label, accept, value, onChange, hint }) {
  const inputRef = useRef();
  return (
    <div
      className="relative flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-airtable-hairline rounded-lg py-5 px-4 cursor-pointer hover:border-airtable-border-strong hover:bg-airtable-surface-soft transition-colors text-center"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) onChange(f);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => e.target.files[0] && onChange(e.target.files[0])}
      />
      {value ? (
        <>
          <Paperclip className="w-4 h-4 text-airtable-forest" />
          <span className="text-xs font-medium text-airtable-forest truncate max-w-full">{value.name}</span>
        </>
      ) : (
        <>
          <Upload className="w-4 h-4 text-airtable-muted" />
          <span className="text-xs font-medium text-airtable-ink">{label}</span>
          {hint && <span className="text-[10px] text-airtable-muted">{hint}</span>}
        </>
      )}
    </div>
  );
}

function PhaseBar({ phases, activeNode }) {
  return (
    <div className="flex items-center gap-0 py-3">
      {PHASES.map((phase, i) => {
        const done = phases[phase.key] !== undefined;
        const active = activeNode === phase.key && !done;
        return (
          <React.Fragment key={phase.key}>
            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all duration-300
                  ${done ? 'bg-airtable-forest border-airtable-forest text-white' :
                    active ? 'bg-white border-airtable-ink text-airtable-ink animate-pulse' :
                    'bg-white border-airtable-hairline text-airtable-muted'}`}
              >
                {done ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : active ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <phase.Icon className="w-3 h-3" />
                )}
              </div>
              <span className={`text-[9px] font-medium text-center leading-tight truncate w-full px-0.5
                ${done ? 'text-airtable-forest' : active ? 'text-airtable-ink' : 'text-airtable-muted'}`}>
                {phase.label}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div className={`h-px w-4 flex-shrink-0 transition-colors duration-300
                ${done ? 'bg-airtable-forest' : 'bg-airtable-hairline'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function SopRetrievalView({ data }) {
  const chunks = data?.retrieved_chunks || [];
  const sections = data?.source_sections || [];

  return (
    <div className="space-y-2.5 text-xs">
      <div className="flex items-center justify-between text-airtable-body">
        <span className="font-medium text-airtable-ink">
          Retrieved {chunks.length} Knowledge Chunks from ChromaDB
        </span>
        <span className="text-[10px] bg-airtable-surface-soft text-airtable-ink px-2 py-0.5 rounded-xs font-mono border border-airtable-hairline">
          RAG Vector Grounded
        </span>
      </div>

      {sections.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sections.map((sec, idx) => (
            <span
              key={idx}
              className="text-[10px] font-mono bg-white px-2 py-0.5 rounded-xs border border-airtable-hairline text-airtable-ink shadow-2xs"
            >
              {sec}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {chunks.map((chunk, idx) => (
          <div
            key={idx}
            className="p-2.5 rounded-sm bg-airtable-surface-soft border border-airtable-hairline text-[11px] leading-relaxed text-airtable-body whitespace-pre-wrap font-sans"
          >
            {chunk}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultSection({ phase, data }) {
  const [open, setOpen] = useState(true);
  if (!data) return null;

  const renderContent = () => {
    switch (phase.key) {
      case 'define':
        return <DefineView data={data} />;
      case 'measure':
        return <MeasureView data={data} />;
      case 'analyze':
        return <AnalyzeView data={data} />;
      case 'improve':
        return <ImproveView data={data} />;
      case 'control':
        return <ControlView data={data} />;
      case 'sop_retrieval':
        return <SopRetrievalView data={data} />;
      default:
        return (
          <pre className="text-[10px] leading-relaxed whitespace-pre-wrap font-mono bg-airtable-surface-soft border border-airtable-hairline rounded p-2">
            {JSON.stringify(data, null, 2)}
          </pre>
        );
    }
  };

  // Try to surface the most human-readable summary badge in the header
  const summaryBadge = (() => {
    if (!data || typeof data !== 'object') return null;
    if (phase.key === 'define') {
      const pd = data.problem_definition || data;
      return pd.target_metric ? `Metric: ${pd.target_metric}` : null;
    }
    if (phase.key === 'measure') {
      const mb = data.measured_baseline || data;
      return mb.baseline_rate ? `Baseline: ${Number(mb.baseline_rate).toFixed(2)}%` : null;
    }
    if (phase.key === 'analyze') {
      const causes = data.candidate_causes || data;
      return Array.isArray(causes) ? `${causes.length} Root Causes Identified` : null;
    }
    if (phase.key === 'improve') {
      const actions = data.action_plan || data;
      return Array.isArray(actions) ? `${actions.length} Action Items Formulated` : null;
    }
    if (phase.key === 'control') {
      const cr = data.control_result || data;
      return cr.passed ? `PASSED (${Number(cr.post_intervention_rate).toFixed(2)}%)` : 'ESCALATED';
    }
    return null;
  })();

  return (
    <div className={`rounded-lg border ${phase.border} overflow-hidden shadow-2xs bg-white`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 ${phase.bg} hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-2">
          <phase.Icon className={`w-4 h-4 ${phase.color}`} />
          <span className={`text-xs font-medium uppercase tracking-wider ${phase.color}`}>{phase.label}</span>
          {summaryBadge && (
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-white/90 border border-current text-slate-700 shadow-2xs">
              {summaryBadge}
            </span>
          )}
        </div>
        {open ? (
          <ChevronDown className={`w-4 h-4 ${phase.color}`} />
        ) : (
          <ChevronRight className={`w-4 h-4 ${phase.color}`} />
        )}
      </button>
      {open && (
        <div className="p-3.5 bg-white border-t border-airtable-hairline/60">
          {renderContent()}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Panel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {string}   moduleName  Human-readable module name, e.g. "Supply"
 * @param {string}   companyId   DMAIC company namespace, e.g. "pulp_riot_supply"
 * @param {Function} onClose     Called when the panel should be closed
 */
export default function DMAICPanel({ moduleName, companyId, onClose }) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState('sop');          // sop | config | running | done | error
  const [sopFile, setSopFile] = useState(null);
  const [uploadingSOp, setUploadingSOP] = useState(false);
  const [sopStatus, setSopStatus] = useState(null); // { chunks, filename } | null
  const [existingSOPs, setExistingSOPs] = useState([]);

  const [problem, setProblem] = useState('');
  const [baselineFile, setBaselineFile] = useState(null);
  const [postFile, setPostFile] = useState(null);
  const [historicalData, setHistoricalData] = useState(null);
  const [loadingHistorical, setLoadingHistorical] = useState(false);

  const [run, setRun] = useState(null);
  const [phases, setPhases] = useState({});         // node_key -> data
  const [activeNode, setActiveNode] = useState(null);
  const [finalStatus, setFinalStatus] = useState(null); // completed | failed | escalated
  const [errorMsg, setErrorMsg] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);

  const esRef = useRef(null);

  // ── Bootstrap: ensure company + fetch existing SOPs ───────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        await ensureCompany(companyId, `Pulp Riot – ${moduleName}`);
        const sops = await listSOPs(companyId);
        setExistingSOPs(sops);
        if (sops.length > 0) setSopStatus({ fromExisting: true, count: sops.length });
      } catch {
        // DMAIC service might be offline — non-fatal for initial load
      }
    };
    init();
  }, [companyId, moduleName]);

  // ── Cleanup SSE on unmount ─────────────────────────────────────────────────
  useEffect(() => () => esRef.current?.close(), []);

  // ── Load Grounded Historical Dataset ──────────────────────────────────────
  const handleLoadHistoricalData = useCallback(async () => {
    try {
      setLoadingHistorical(true);
      setErrorMsg('');
      const data = await fetchHistoricalDataset(moduleName);
      setHistoricalData(data);
      setProblem(data.problem_statement);

      // Create browser File objects from calibrated CSV data
      const bFile = new File(
        [data.baseline_csv],
        `${moduleName.toLowerCase()}_baseline_historical.csv`,
        { type: 'text/csv' }
      );
      const pFile = new File(
        [data.post_csv],
        `${moduleName.toLowerCase()}_post_intervention.csv`,
        { type: 'text/csv' }
      );
      setBaselineFile(bFile);
      setPostFile(pFile);

      // Also auto-prepare the calibrated SOP if user hasn't selected one
      if (!sopFile && existingSOPs.length === 0) {
        const sFile = new File(
          [data.sop_markdown],
          `${moduleName.toLowerCase()}_sop.md`,
          { type: 'text/markdown' }
        );
        setSopFile(sFile);
      }
    } catch (err) {
      setErrorMsg(`Failed to load historical data: ${err.message}`);
    } finally {
      setLoadingHistorical(false);
    }
  }, [moduleName, sopFile, existingSOPs.length]);

  // ── SOP Upload ─────────────────────────────────────────────────────────────
  const handleSOPUpload = useCallback(async () => {
    if (!sopFile) return;
    setUploadingSOP(true);
    setErrorMsg('');
    try {
      await ensureCompany(companyId, `Pulp Riot – ${moduleName}`);
      const result = await uploadSOP(companyId, sopFile);
      setSopStatus({ filename: result.filename, chunks: result.chunk_count });
    } catch (e) {
      setErrorMsg(`SOP ingestion failed: ${e.message}`);
    } finally {
      setUploadingSOP(false);
    }
  }, [companyId, moduleName, sopFile]);

  // ── Start DMAIC Run ────────────────────────────────────────────────────────
  const handleStartRun = useCallback(async () => {
    if (!problem.trim() || !baselineFile || !postFile) return;
    setErrorMsg('');
    setStep('running');
    setPhases({});
    setActiveNode(null);

    try {
      const newRun = await startRun(companyId, problem, baselineFile, postFile);
      setRun(newRun);

      // Open SSE stream
      const es = openRunStream(newRun.id);
      esRef.current = es;

      es.onmessage = (e) => {
        let evt;
        try { evt = JSON.parse(e.data); } catch { return; }

        if (evt.event === 'node_start') {
          setActiveNode(evt.node);
        } else if (evt.event === 'node_complete') {
          setActiveNode(null);
          setPhases((prev) => ({ ...prev, [evt.node]: evt.data }));
        } else if (['completed', 'failed', 'escalated'].includes(evt.event)) {
          setFinalStatus(evt.event);
          setStep('done');
          es.close();
          esRef.current = null;
        }
      };

      es.onerror = () => {
        setErrorMsg('Connection to DMAIC service lost. Check the run results below.');
        setStep('done');
        es.close();
        esRef.current = null;
      };
    } catch (e) {
      setErrorMsg(e.message);
      setStep('error');
    }
  }, [companyId, problem, baselineFile, postFile]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`DMAIC Analysis – ${moduleName}`}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white shadow-soft flex flex-col border-l border-airtable-hairline overflow-hidden"
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-airtable-hairline flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-airtable-ink flex items-center justify-center flex-shrink-0">
              <FlaskConical className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-airtable-ink leading-tight">
                DMAIC Analysis
              </p>
              <p className="text-[11px] text-airtable-muted">
                {moduleName} module · {companyId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-airtable-surface-soft text-airtable-muted hover:text-airtable-ink transition-colors"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body (scrollable) ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Error banner */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 px-3 py-2.5 bg-airtable-coral/10 border border-airtable-coral/30 rounded-sm text-airtable-coral">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {/* ── Step 1: SOP Upload ──────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-airtable-ink text-white text-[10px] font-medium flex items-center justify-center">1</span>
                <h3 className="text-sm font-medium text-airtable-ink">Upload SOP Document</h3>
              </div>
              {(sopStatus || existingSOPs.length > 0) && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-airtable-forest bg-airtable-forest/10 border border-airtable-forest/30 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" />
                  {sopStatus?.chunks
                    ? `${sopStatus.chunks} chunks ingested`
                    : `${existingSOPs.length} SOP(s) ready`}
                </span>
              )}
            </div>
            <p className="text-xs text-airtable-muted mb-3 leading-relaxed">
              Upload the Standard Operating Procedure for the <strong>{moduleName}</strong> module.
              This feeds the RAG vector store and grounds the DMAIC analysis in your real process context.
              Accepted formats: <code className="text-[10px] bg-airtable-surface-soft px-1 rounded">.pdf</code>{' '}
              <code className="text-[10px] bg-airtable-surface-soft px-1 rounded">.md</code>{' '}
              <code className="text-[10px] bg-airtable-surface-soft px-1 rounded">.txt</code>
            </p>

            {existingSOPs.length > 0 && (
              <div className="mb-3 space-y-1">
                {existingSOPs.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-[10px] text-airtable-muted px-2 py-1.5 bg-airtable-surface-soft rounded border border-airtable-hairline">
                    <FileText className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate font-mono">{s.filename}</span>
                    <span className="ml-auto text-[9px] bg-white border border-airtable-hairline rounded px-1.5 py-0.5">{s.chunk_count} chunks</span>
                  </div>
                ))}
              </div>
            )}

            <FileDropZone
              label="Drop SOP file here or click to browse"
              accept=".pdf,.md,.txt"
              value={sopFile}
              onChange={setSopFile}
              hint="PDF, Markdown, or plain text"
            />

            {sopFile && (
              <button
                onClick={handleSOPUpload}
                disabled={uploadingSOp}
                className="mt-2.5 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-airtable-primary text-white text-xs font-medium hover:bg-airtable-primary-active active:bg-airtable-primary-active disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {uploadingSOp ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Ingesting…</>
                ) : (
                  <><Upload className="w-3.5 h-3.5" /> Ingest SOP into Vector Store</>
                )}
              </button>
            )}
          </section>

          <div className="border-t border-airtable-hairline" />

          {/* ── Step 2: Run Configuration ───────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-airtable-ink text-white text-[10px] font-medium flex items-center justify-center">2</span>
                <h3 className="text-sm font-medium text-airtable-ink">Configure DMAIC Run</h3>
              </div>
              <button
                type="button"
                onClick={handleLoadHistoricalData}
                disabled={loadingHistorical || step === 'running' || step === 'done'}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-airtable-hairline hover:bg-airtable-surface-soft text-airtable-ink text-[11px] font-medium transition-colors disabled:opacity-50 shadow-xs"
                title="Auto-fill with calibrated historical data from database"
              >
                {loadingHistorical ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Zap className="w-3 h-3 text-airtable-mustard" />
                )}
                Auto-fill from History
              </button>
            </div>

            {/* Historical Telemetry Banner when loaded */}
            {historicalData && (
              <div className="mb-3.5 p-3 rounded-lg bg-airtable-cream/50 border border-airtable-hairline text-xs space-y-2">
                <div className="flex items-center justify-between text-airtable-ink font-medium text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-airtable-mustard" />
                    Calibrated Historical Telemetry Loaded ({moduleName})
                  </span>
                  <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded-xs border border-airtable-hairline text-airtable-ink">
                    Threshold: &le; {historicalData.acceptable_threshold}%
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="bg-white p-2 rounded-sm border border-airtable-hairline shadow-2xs">
                    <span className="font-medium text-airtable-ink block">Baseline Period</span>
                    <span className="text-airtable-muted text-[9px] block leading-tight">{historicalData.baseline_summary.period}</span>
                    <div className="mt-1 flex items-baseline gap-1 font-mono">
                      <span className="text-[13px] font-medium text-airtable-coral">
                        {historicalData.baseline_summary.baseline_defect_rate_pct}%
                      </span>
                      <span className="text-airtable-muted text-[9px]">
                        ({historicalData.baseline_summary.defect_count.toLocaleString()} defects)
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-2 rounded-sm border border-airtable-hairline shadow-2xs">
                    <span className="font-medium text-airtable-ink block">Post-Intervention</span>
                    <span className="text-airtable-muted text-[9px] block leading-tight">{historicalData.post_intervention_summary.period}</span>
                    <div className="mt-1 flex items-baseline gap-1 font-mono">
                      <span className="text-[13px] font-medium text-airtable-forest">
                        {historicalData.post_intervention_summary.post_defect_rate_pct}%
                      </span>
                      <span className="text-airtable-forest font-medium text-[9px]">
                        ({historicalData.post_intervention_summary.improvement_delta_pct}%)
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-airtable-body leading-snug">
                  <strong>Impact:</strong> {historicalData.baseline_summary.business_impact}
                </p>
              </div>
            )}

            {/* Problem statement */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-airtable-ink mb-1">
                Problem Statement <span className="text-airtable-coral">*</span>
              </label>
              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder={`e.g. "High defect rate in ${moduleName.toLowerCase()} process causing customer complaints and revenue loss"`}
                rows={3}
                disabled={step === 'running' || step === 'done'}
                className="w-full text-xs rounded-sm border border-airtable-hairline px-3 py-2 text-airtable-ink placeholder:text-airtable-muted focus:outline-none focus:ring-1 focus:ring-airtable-info-border focus:border-airtable-info-border resize-none bg-white disabled:bg-airtable-surface-soft disabled:text-airtable-muted"
              />
            </div>

            {/* CSV files */}
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              <div>
                <label className="block text-xs font-medium text-airtable-ink mb-1">
                  Baseline Data <span className="text-airtable-coral">*</span>
                </label>
                <FileDropZone
                  label="Baseline CSV"
                  accept=".csv"
                  value={baselineFile}
                  onChange={setBaselineFile}
                  hint="Pre-intervention measurements"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-airtable-ink mb-1">
                  Post-Intervention Data <span className="text-airtable-coral">*</span>
                </label>
                <FileDropZone
                  label="Post CSV"
                  accept=".csv"
                  value={postFile}
                  onChange={setPostFile}
                  hint="Post-intervention measurements"
                />
              </div>
            </div>

            {step !== 'running' && step !== 'done' && (
              <button
                onClick={handleStartRun}
                disabled={
                  !problem.trim() || !baselineFile || !postFile ||
                  (!sopStatus && existingSOPs.length === 0)
                }
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-airtable-primary text-white text-xs font-medium hover:bg-airtable-primary-active active:bg-airtable-primary-active disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                Launch DMAIC Analysis
              </button>
            )}
            {(!sopStatus && existingSOPs.length === 0) && (
              <p className="text-[10px] text-airtable-coral mt-1.5 text-center">
                ⚠ Upload and ingest an SOP first (Step 1)
              </p>
            )}
          </section>

          {/* ── Step 3: Live Progress ───────────────────────────────────── */}
          {(step === 'running' || step === 'done') && (
            <>
              <div className="border-t border-airtable-hairline" />
              <section>
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-airtable-ink text-white text-[10px] font-medium flex items-center justify-center">3</span>
                  <h3 className="text-sm font-medium text-airtable-ink">
                    {step === 'running' ? 'Running DMAIC Pipeline…' : 'Analysis Complete'}
                  </h3>
                  {step === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin text-airtable-muted" />}
                  {step === 'done' && finalStatus === 'completed' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-airtable-forest" />
                  )}
                  {step === 'done' && finalStatus === 'escalated' && (
                    <AlertTriangle className="w-3.5 h-3.5 text-airtable-mustard" />
                  )}
                  {step === 'done' && finalStatus === 'failed' && (
                    <AlertTriangle className="w-3.5 h-3.5 text-airtable-coral" />
                  )}
                </div>

                {run && (
                  <p className="text-[10px] font-mono text-airtable-muted mb-2">
                    Run #{run.id} · {companyId}
                  </p>
                )}

                <PhaseBar phases={phases} activeNode={activeNode} />

                {/* Final status banner */}
                {finalStatus === 'escalated' && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-airtable-yellow/10 border border-airtable-yellow/30 rounded-sm text-airtable-ink text-xs mt-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-airtable-mustard" />
                    Control gate did not pass — run escalated. Review root causes and action plan below.
                  </div>
                )}
                {finalStatus === 'failed' && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-airtable-coral/10 border border-airtable-coral/30 rounded-sm text-airtable-coral text-xs mt-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Run failed. Check the DMAIC API server logs for details.
                  </div>
                )}
              </section>
            </>
          )}

          {/* ── Step 4: Results Accordion ───────────────────────────────── */}
          {step === 'done' && Object.keys(phases).length > 0 && (
            <>
              <div className="border-t border-airtable-hairline" />
              <section>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-airtable-ink text-white text-[10px] font-medium flex items-center justify-center">4</span>
                    <h3 className="text-sm font-medium text-airtable-ink">DMAIC Results</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowReportModal(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-airtable-primary hover:bg-airtable-primary-active active:bg-airtable-primary-active text-white text-[11px] font-medium shadow-xs transition-colors"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-white" />
                    Full Executive Report
                  </button>
                </div>
                <div className="space-y-2.5">
                  {PHASES.map((phase) =>
                    phases[phase.key] ? (
                      <ResultSection key={phase.key} phase={phase} data={phases[phase.key]} />
                    ) : null
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="border-t border-airtable-hairline px-5 py-3 flex items-center justify-between flex-shrink-0 bg-airtable-surface-soft">
          <p className="text-[10px] text-airtable-muted">
            Powered by <span className="font-semibold text-airtable-ink">DMAIC Agent</span> · LangGraph + ChromaDB
          </p>
          {(step === 'done' || step === 'error') && (
            <button
              onClick={() => {
                setStep('sop');
                setRun(null);
                setPhases({});
                setActiveNode(null);
                setFinalStatus(null);
                setErrorMsg('');
                setProblem('');
                setBaselineFile(null);
                setPostFile(null);
                setSopFile(null);
                setSopStatus(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-airtable-hairline text-xs font-medium text-airtable-ink hover:bg-airtable-surface-soft transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              New Run
            </button>
          )}
        </div>
      </div>

      {/* Full-width Executive Presentation Modal */}
      {showReportModal && (
        <DMAICReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          moduleName={moduleName}
          companyId={companyId}
          phases={phases}
          runId={run?.id}
        />
      )}
    </>
  );
}
