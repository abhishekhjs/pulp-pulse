/**
 * DMAICReportModal.jsx
 *
 * Full-width, presentation-ready Executive Report Modal for DMAIC cycle outcomes.
 * Allows executives and supply leads to review, share, and print the complete
 * 5-phase Six Sigma verification as real website content.
 */

import React from 'react';
import {
  X,
  Printer,
  Download,
  Share2,
  ShieldCheck,
  FlaskConical,
  CheckCircle2,
  TrendingDown,
  Calendar,
  Building,
} from 'lucide-react';
import DMAICReportView from './DMAICReportView';

export default function DMAICReportModal({
  isOpen,
  onClose,
  moduleName,
  companyId,
  phases,
  runId,
  completedAt,
}) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const cr = phases?.control?.control_result || phases?.control;
  const mb = phases?.measure?.measured_baseline || phases?.measure;
  const pd = phases?.define?.problem_definition || phases?.define;

  const baselineRate = mb?.baseline_rate ? Number(mb.baseline_rate).toFixed(2) : null;
  const postRate = cr?.post_intervention_rate ? Number(cr.post_intervention_rate).toFixed(2) : null;
  const delta = cr?.delta_from_baseline ? Number(cr.delta_from_baseline).toFixed(2) : null;
  const passed = cr?.passed === true;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-airtable-ink/40 flex items-center justify-center p-3 sm:p-6"
    >
      <div
        className="relative w-full max-w-4xl bg-white rounded-lg shadow-soft border border-airtable-hairline flex flex-col max-h-[92vh] overflow-hidden animate-scale-in"
      >
        {/* ── Modal Header ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-airtable-hairline bg-airtable-surface-soft flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-airtable-ink flex items-center justify-center text-white">
              <FlaskConical className="w-5 h-5 text-airtable-mustard" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-medium text-airtable-ink font-title">
                  Six Sigma DMAIC Executive Report
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-airtable-forest/10 text-airtable-forest border border-airtable-forest/30 font-medium">
                  Audited & Verified
                </span>
              </div>
              <p className="text-xs text-airtable-muted">
                Pulp Riot Juice Co. · {moduleName} Module ({companyId}) {runId ? `· Run #${runId}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-airtable-hairline bg-white hover:bg-airtable-surface-soft text-xs font-medium text-airtable-ink transition-colors shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-airtable-muted" />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-airtable-surface-strong text-airtable-muted hover:text-airtable-ink transition-colors"
              aria-label="Close report"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Executive KPI Banner ────────────────────────────────────────── */}
        {(baselineRate || postRate) && (
          <div className="px-6 py-3 bg-white border-b border-airtable-hairline grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs flex-shrink-0">
            <div>
              <span className="text-[10px] font-mono text-airtable-muted uppercase block">Baseline Defect Rate</span>
              <span className="text-lg font-medium font-mono text-airtable-coral leading-tight">
                {baselineRate}%
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono text-airtable-muted uppercase block">Post-Intervention Rate</span>
              <span className="text-lg font-medium font-mono text-airtable-forest leading-tight">
                {postRate}%
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono text-airtable-muted uppercase block">Net Reduction</span>
              <span className="text-lg font-medium font-mono text-airtable-forest leading-tight flex items-center gap-1">
                <TrendingDown className="w-4 h-4" />
                {delta}%
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono text-airtable-muted uppercase block">Quality Gate Status</span>
              <span className="inline-flex items-center gap-1 text-xs font-medium font-mono text-airtable-forest mt-1">
                <ShieldCheck className="w-4 h-4" />
                {passed ? 'PASSED (≤ 3.0%)' : 'ESCALATED'}
              </span>
            </div>
          </div>
        )}

        {/* ── Body: Formatted 5-Phase Website Content ─────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-airtable-surface-soft">
          <DMAICReportView phases={phases} finalStatus={passed ? 'completed' : 'escalated'} />
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="px-6 py-3 border-t border-airtable-hairline bg-white flex items-center justify-between text-xs text-airtable-muted flex-shrink-0">
          <span>
            Grounded in LangGraph DMAIC Pipeline & ChromaDB Vector Store · ISO 13053 Six Sigma Compliant
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-airtable-primary text-white text-xs font-medium hover:bg-airtable-primary-active active:bg-airtable-primary-active transition-colors shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
