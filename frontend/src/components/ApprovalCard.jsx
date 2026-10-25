import React, { useState, useEffect } from 'react';
import {
  Check,
  X,
  Clock,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  UserCheck,
} from 'lucide-react';

const TIER_CONFIG = {
  coo: {
    label: 'COO Executive Tier',
    shortLabel: 'COO',
    badgeClass: 'bg-airtable-yellow/20 text-airtable-ink border border-airtable-yellow/60',
    leftBorder: '#d9a441',
  },
  supply_lead: {
    label: 'Supply Lead Tier',
    shortLabel: 'SUPPLY',
    badgeClass: 'bg-airtable-surface-soft text-airtable-ink border border-airtable-hairline',
    leftBorder: '#181d26',
  },
  planner: {
    label: 'Planner Tier',
    shortLabel: 'PLANNER',
    badgeClass: 'bg-airtable-surface-soft text-airtable-muted border border-airtable-hairline',
    leftBorder: '#41454d',
  },
};

export default function ApprovalCard({ alert, onApprove, onOverride }) {
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('context_missing');
  const [overrideNote, setOverrideNote] = useState('');
  const [loading, setLoading] = useState(false);

  const tier = alert.approval?.tier || 'supply_lead';
  const config = TIER_CONFIG[tier] || TIER_CONFIG.supply_lead;
  const roi = alert.roi_trade_off;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showOverrideModal) {
        setShowOverrideModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showOverrideModal]);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onApprove(alert.id);
    } finally {
      setLoading(false);
    }
  };

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onOverride(alert.id, { reason_code: overrideReason, note: overrideNote });
      setShowOverrideModal(false);
    } finally {
      setLoading(false);
    }
  };

  const isDmac = alert.kpi_code === 'dmac_recalibration';

  return (
    <>
      <div
        className="relative rounded-lg overflow-hidden transition-all duration-150 bg-white border border-airtable-hairline shadow-xs hover:border-airtable-border-strong hover:shadow-soft"
        style={{
          borderLeft: `3px solid ${isDmac ? '#1b61c9' : config.leftBorder}`,
        }}
      >
        <div className="p-5">
          {/* DMAC Banner per Section 16.5 */}
          {isDmac && (
            <div className="mb-3 px-3 py-1.5 rounded-md bg-airtable-surface-soft border border-airtable-hairline text-xs text-airtable-ink flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4 text-airtable-link" />
                <span>DMAC Self-Correcting Governance Engine</span>
              </div>
              <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded-xs border border-airtable-hairline text-airtable-ink font-medium">
                Mandatory Supply Lead Authorization
              </span>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className={`${config.badgeClass} font-mono text-[11px] font-medium px-2 py-0.5 rounded`}>
                {config.label}
              </span>
              <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-airtable-surface-soft text-airtable-ink border border-airtable-hairline">
                {isDmac ? 'DMAC RECALIBRATION' : `KPI ${alert.kpi_code}`}
              </span>
              <span className="text-[11px] text-airtable-muted font-mono">
                {new Date(alert.triggered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {alert.approval && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] bg-airtable-surface-soft border border-airtable-hairline">
                <Clock className="w-3 h-3 text-airtable-muted" />
                <span className="text-airtable-muted">SLA:</span>
                <span className="font-mono font-medium text-airtable-ink">{alert.approval.sla_hours}h</span>
              </div>
            )}
          </div>

          {/* Alert message */}
          <p className="text-[14px] text-airtable-ink leading-relaxed font-normal mb-4">
            {alert.message}
          </p>

          {/* ROI panel (Airtable signature-cream callout band) */}
          {roi && (
            <div className="mb-4 rounded-md p-4 bg-airtable-cream/50 border border-airtable-hairline">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-airtable-forest" />
                  <span className="text-xs font-medium text-airtable-ink">Economic Arbitrage</span>
                </div>
                <span className="font-mono text-xs font-medium text-airtable-forest px-2 py-0.5 rounded-xs bg-white border border-airtable-hairline">
                  {roi.roi_multiple}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs mb-2.5">
                <div className="p-2.5 rounded-sm bg-white border border-airtable-hairline">
                  <div className="text-[10px] text-airtable-muted uppercase tracking-wide mb-0.5">Action Cost</div>
                  <div className="font-mono font-medium text-airtable-ink">{roi.action_cost_text}</div>
                </div>
                <div className="p-2.5 rounded-sm bg-white border border-airtable-hairline">
                  <div className="text-[10px] text-airtable-coral uppercase tracking-wide mb-0.5">Prevented Loss</div>
                  <div className="font-mono font-medium text-airtable-coral">{roi.prevented_loss_text}</div>
                </div>
              </div>

              <p className="text-[11px] text-airtable-body leading-relaxed">{roi.detail}</p>
            </div>
          )}

          {/* Footer: confidence + actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-airtable-hairline/60">
            {/* Confidence bar */}
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-3.5 h-3.5 text-airtable-forest flex-shrink-0" />
              <div>
                <div className="text-[10px] text-airtable-muted mb-0.5">Agent Confidence</div>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 rounded-full bg-airtable-surface-strong overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        alert.confidence_pct > 80 ? 'bg-airtable-forest' : alert.confidence_pct > 60 ? 'bg-airtable-mustard' : 'bg-airtable-coral'
                      }`}
                      style={{
                        width: `${alert.confidence_pct}%`,
                      }}
                    />
                  </div>
                  <span className="font-mono text-xs font-medium text-airtable-ink">{alert.confidence_pct}%</span>
                </div>
              </div>
            </div>

            {/* Actions (Airtable Spec: button-primary is near-black, secondary is hairline white) */}
            {alert.status === 'open' ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowOverrideModal(true)}
                  disabled={loading}
                  className="btn-secondary text-xs text-airtable-coral hover:bg-airtable-coral/5"
                >
                  <X className="w-3.5 h-3.5" />
                  Override
                </button>
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="btn-primary text-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  Approve
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`font-medium px-3 py-1 rounded capitalize ${
                    alert.status === 'approved'
                      ? 'bg-airtable-forest/10 text-airtable-forest border border-airtable-forest/30'
                      : 'bg-airtable-surface-soft text-airtable-muted border border-airtable-hairline'
                  }`}
                >
                  {alert.status}
                </span>
                {alert.approval?.decided_by && (
                  <span className="flex items-center gap-1 text-airtable-muted text-[11px]">
                    <UserCheck className="w-3.5 h-3.5" />
                    {alert.approval.decided_by}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Override Modal */}
      {showOverrideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-airtable-ink/40 animate-fade-in"
          onClick={() => setShowOverrideModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Override Agent Recommendation"
        >
          <div
            className="w-full max-w-md rounded-lg p-6 shadow-soft bg-white border border-airtable-hairline animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-base font-medium text-airtable-ink flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-airtable-mustard" />
                Override Recommendation
              </h3>
              <button
                onClick={() => setShowOverrideModal(false)}
                className="btn-secondary p-1"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-airtable-muted mb-4 leading-relaxed">
              Logging an override recalibrates false-positive filters (KPI H3). Categorize the operational justification.
            </p>

            <form onSubmit={handleOverrideSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-airtable-ink mb-1.5">Reason Code</label>
                <select
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="input-base w-full text-xs"
                >
                  <option value="data_wrong">Data Incorrect or Outdated</option>
                  <option value="already_handled">Already Addressed Outside System</option>
                  <option value="context_missing">Missing Commercial Context</option>
                  <option value="other">Other Operational Justification</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-airtable-ink mb-1.5">Explanation</label>
                <textarea
                  rows={3}
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  placeholder="Provide context for governance and audit trail..."
                  className="input-base w-full text-xs resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-danger text-xs"
                >
                  Confirm Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
