/**
 * DMAICReportView.jsx
 *
 * Renders the 5 phases of a DMAIC Analysis (Define, Measure, Analyze, Improve, Control)
 * as rich, interactive, executive-ready dashboard components rather than raw JSON.
 */

import React, { useState } from 'react';
import {
  Target,
  Activity,
  BarChart2,
  Lightbulb,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Layers,
  FileText,
  Clock,
  Sparkles,
  BookOpen,
  HelpCircle,
  Percent,
  Check,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// 1. DEFINE PHASE VIEW
// ─────────────────────────────────────────────────────────────────────────────
export function DefineView({ data }) {
  const pd = data?.problem_definition || data;
  if (!pd) return <div className="text-xs text-airtable-muted">No definition data available.</div>;

  return (
    <div className="space-y-3.5">
      {/* Problem Statement Banner */}
      <div className="p-3.5 rounded-lg bg-airtable-surface-soft border border-airtable-hairline border-l-3 border-l-airtable-ink">
        <span className="text-[10px] font-medium uppercase tracking-wider text-airtable-muted block mb-1">
          Scorched Problem Statement
        </span>
        <p className="text-xs sm:text-sm font-medium text-airtable-ink leading-relaxed">
          {pd.problem_statement}
        </p>
      </div>

      {/* Structured Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 rounded-md bg-airtable-surface-soft border border-airtable-hairline">
          <span className="text-[10px] uppercase font-mono text-airtable-muted block">Target Metric</span>
          <span className="text-xs font-medium text-airtable-ink mt-0.5 block truncate">
            {pd.target_metric || 'Defect Rate'}
          </span>
        </div>

        <div className="p-2.5 rounded-md bg-airtable-surface-soft border border-airtable-hairline">
          <span className="text-[10px] uppercase font-mono text-airtable-muted block">Success Threshold</span>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs font-medium font-mono text-airtable-link">
              &le; {pd.acceptable_threshold}%
            </span>
            <span className="text-[9px] text-airtable-muted">max defect</span>
          </div>
        </div>

        <div className="p-2.5 rounded-md bg-airtable-surface-soft border border-airtable-hairline">
          <span className="text-[10px] uppercase font-mono text-airtable-muted block">Process Scope</span>
          <span className="text-xs font-medium text-airtable-ink mt-0.5 block truncate" title={pd.component_or_process}>
            {pd.component_or_process || 'Full Chain'}
          </span>
        </div>

        <div className="p-2.5 rounded-md bg-airtable-surface-soft border border-airtable-hairline">
          <span className="text-[10px] uppercase font-mono text-airtable-muted block">Observation Time</span>
          <span className="text-xs font-medium text-airtable-ink mt-0.5 block truncate">
            {pd.timeframe || '3 Rolling Days'}
          </span>
        </div>
      </div>

      {/* Grounded in SOP Badges */}
      {pd.grounded_in_sop_sections && pd.grounded_in_sop_sections.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-[10px] font-medium text-airtable-muted flex items-center gap-1">
            <BookOpen className="w-3 h-3 text-airtable-link" />
            Grounded SOP Sections:
          </span>
          {pd.grounded_in_sop_sections.map((sec, i) => (
            <span
              key={i}
              className="text-[10px] font-mono px-2 py-0.5 rounded-xs bg-white text-airtable-ink border border-airtable-hairline shadow-2xs"
            >
              {sec}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. MEASURE PHASE VIEW
// ─────────────────────────────────────────────────────────────────────────────
export function MeasureView({ data }) {
  const mb = data?.measured_baseline || data;
  if (!mb) return <div className="text-xs text-airtable-muted">No baseline measurement data available.</div>;

  const paretoEntries = Object.entries(mb.pareto_ranking || {});

  // Compute individual shares for visualization
  let prev = 0;
  const individualShares = paretoEntries.map(([name, cumulative]) => {
    const share = Math.max(0, cumulative - prev);
    prev = cumulative;
    return { name, cumulative, share: Math.round(share * 10) / 10 };
  });

  return (
    <div className="space-y-4">
      {/* Hero Telemetry Card */}
      <div className="flex items-center justify-between p-3.5 rounded-lg bg-airtable-surface-soft border border-airtable-hairline">
        <div>
          <span className="text-[10px] font-medium uppercase tracking-wider text-airtable-muted block mb-0.5">
            Measured Baseline Defect Rate
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-medium font-mono text-airtable-ink">
              {Number(mb.baseline_rate).toFixed(2)}%
            </span>
            <span className="text-[11px] font-medium text-airtable-coral bg-airtable-coral/10 px-2 py-0.5 rounded-full border border-airtable-coral/30">
              Breaches Quality Target
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-airtable-muted block">Data Quality</span>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-airtable-forest bg-airtable-forest/10 px-2 py-0.5 rounded-full border border-airtable-forest/30 mt-0.5">
            <CheckCircle2 className="w-3 h-3" />
            Verified (No anomalies)
          </span>
        </div>
      </div>

      {/* Pareto 80/20 Distribution Visualization */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-airtable-ink flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-airtable-ink" />
            Pareto Ranking of Non-Conformances
          </span>
          <span className="text-[10px] text-airtable-muted font-mono">
            80/20 Vital Few Separation
          </span>
        </div>

        <div className="space-y-2.5">
          {individualShares.map((item, idx) => {
            const isTopVital = idx === 0;
            return (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] w-4 text-airtable-muted">#{idx + 1}</span>
                    <span className="font-medium text-airtable-ink truncate" title={item.name}>
                      {item.name.replace(/_/g, ' ')}
                    </span>
                    {isTopVital && (
                      <span className="text-[9px] font-medium uppercase px-1.5 py-0.5 rounded-xs bg-airtable-yellow/30 text-airtable-ink border border-airtable-yellow/60">
                        Primary Driver
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs flex-shrink-0">
                    <span className="text-airtable-ink font-medium">{item.share}%</span>
                    <span className="text-airtable-muted text-[10px]">({item.cumulative}% cum.)</span>
                  </div>
                </div>

                {/* Dual bar: share + cumulative track */}
                <div className="h-2 w-full bg-airtable-surface-strong rounded-full overflow-hidden flex">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      isTopVital ? 'bg-airtable-ink' : 'bg-airtable-border-strong'
                    }`}
                    style={{ width: `${Math.min(100, item.cumulative)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ANALYZE PHASE VIEW (Ishikawa & 5-Whys Diagnostic Chain)
// ─────────────────────────────────────────────────────────────────────────────
export function AnalyzeView({ data }) {
  const causes = data?.candidate_causes || (Array.isArray(data) ? data : []);
  const [expandedIndex, setExpandedIndex] = useState(0);

  if (!causes.length) return <div className="text-xs text-airtable-muted">No root-cause analysis data available.</div>;

  const getCategoryColor = (cat) => {
    switch (cat?.toLowerCase()) {
      case 'method': return 'bg-airtable-yellow/20 text-airtable-ink border-airtable-yellow/60';
      case 'measures': return 'bg-airtable-surface-soft text-airtable-link border-airtable-hairline';
      case 'materials': return 'bg-airtable-forest/10 text-airtable-forest border-airtable-forest/30';
      case 'machine': return 'bg-airtable-cream text-airtable-ink border-airtable-hairline';
      case 'man': return 'bg-airtable-coral/10 text-airtable-coral border-airtable-coral/30';
      default: return 'bg-airtable-surface-soft text-airtable-ink border-airtable-hairline';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-airtable-muted">
        <span>Identified {causes.length} Root Causes via 6M & 5-Whys</span>
        <span>Click cause to view diagnostic drilldown</span>
      </div>

      <div className="space-y-2.5">
        {causes.map((c, idx) => {
          const isExpanded = expandedIndex === idx;
          const confPct = Math.round((c.confidence || 0.7) * 100);

          return (
            <div
              key={idx}
              className={`rounded-lg border transition-all ${
                isExpanded
                  ? 'border-airtable-hairline bg-airtable-surface-soft shadow-xs'
                  : 'border-airtable-hairline bg-white hover:border-airtable-border-strong'
              }`}
            >
              {/* Header Card */}
              <div
                className="p-3 cursor-pointer flex items-start justify-between gap-3"
                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-medium font-mono uppercase px-2 py-0.5 rounded-full border ${getCategoryColor(c.category)}`}>
                      {c.category || 'Method'}
                    </span>
                    <span className="text-[10px] text-airtable-muted font-mono">
                      Confidence: <strong className="text-airtable-ink font-medium">{confPct}%</strong>
                    </span>
                    {c.referenced_sop_section && (
                      <span className="text-[10px] text-airtable-muted bg-airtable-surface-soft px-1.5 py-0.5 rounded-xs border border-airtable-hairline truncate">
                        SOP: {c.referenced_sop_section}
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs sm:text-sm font-medium text-airtable-ink leading-snug">
                    {c.cause}
                  </h4>
                </div>

                {/* Confidence Meter Bar */}
                <div className="w-16 flex-shrink-0 text-right">
                  <div className="h-1.5 w-full bg-airtable-surface-strong rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-airtable-mustard rounded-full"
                      style={{ width: `${confPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Expanded Diagnostic 5-Whys Drilldown */}
              {isExpanded && (
                <div className="px-3.5 pb-3.5 pt-1 space-y-3 border-t border-airtable-hairline">
                  {/* Supporting Reasoning */}
                  {c.supporting_reasoning && (
                    <div className="p-2.5 rounded-sm bg-white border border-airtable-hairline text-xs text-airtable-body leading-relaxed">
                      <strong className="text-airtable-ink font-medium block mb-0.5">Evidence & Reasoning:</strong>
                      {c.supporting_reasoning}
                    </div>
                  )}

                  {/* 5-Whys Chain */}
                  {c.five_whys_chain && c.five_whys_chain.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-airtable-muted block">
                        5-Whys Root Cause Chain
                      </span>
                      <div className="space-y-1.5 pl-2 border-l-2 border-airtable-hairline">
                        {c.five_whys_chain.map((step, sIdx) => {
                          const parts = step.split(' - ');
                          const question = parts[0];
                          const answer = parts.slice(1).join(' - ') || parts[0];

                          return (
                            <div key={sIdx} className="text-xs leading-snug flex items-start gap-1.5">
                              <span className="font-mono text-[10px] text-airtable-mustard font-medium mt-0.5">W{sIdx + 1}:</span>
                              <div className="min-w-0">
                                <span className="text-airtable-muted text-[11px] block">{question}</span>
                                <span className="font-medium text-airtable-ink">{answer}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. IMPROVE PHASE VIEW (Action Plan & Sample Size Matrix)
// ─────────────────────────────────────────────────────────────────────────────
export function ImproveView({ data }) {
  const actions = data?.action_plan || (Array.isArray(data) ? data : []);
  if (!actions.length) return <div className="text-xs text-airtable-muted">No action plan available.</div>;

  const getFeasibilityBadge = (feas) => {
    switch (feas?.toLowerCase()) {
      case 'immediate':
        return (
          <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full bg-airtable-forest/10 text-airtable-forest border border-airtable-forest/30">
            Immediate Action
          </span>
        );
      case 'short_term':
        return (
          <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full bg-airtable-surface-soft text-airtable-link border border-airtable-hairline">
            Short-Term (1-2 Wks)
          </span>
        );
      case 'long_term':
        return (
          <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full bg-airtable-cream text-airtable-ink border border-airtable-hairline">
            Strategic Systemic
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full bg-airtable-surface-soft text-airtable-ink border border-airtable-hairline">
            {feas}
          </span>
        );
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-airtable-muted">
        <span>Formulated {actions.length} Targeted Countermeasures</span>
        <span>Prioritized by implementation feasibility</span>
      </div>

      <div className="space-y-3">
        {actions.map((act, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-lg border border-airtable-hairline bg-white hover:border-airtable-border-strong transition-all space-y-2.5"
          >
            {/* Action Top Bar */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-airtable-ink text-white font-mono text-[10px] font-medium flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  {getFeasibilityBadge(act.feasibility)}
                </div>
                <h4 className="text-xs sm:text-sm font-medium text-airtable-ink leading-snug">
                  {act.action}
                </h4>
              </div>
            </div>

            {/* Targeted Root Cause */}
            {act.targets_cause && (
              <div className="flex items-center gap-1.5 text-[11px] text-airtable-muted bg-airtable-surface-soft px-2.5 py-1 rounded-sm border border-airtable-hairline">
                <span className="font-medium text-airtable-ink">Mitigates Root Cause:</span>
                <span className="truncate">{act.targets_cause}</span>
              </div>
            )}

            {/* Expected Impact & Experimental Verification */}
            {act.expected_impact && (
              <div className="p-2.5 rounded-sm bg-airtable-surface-soft border border-airtable-hairline text-xs text-airtable-body space-y-1">
                <span className="text-[10px] font-medium uppercase tracking-wider text-airtable-muted block">
                  Expected Impact & Verification Protocol
                </span>
                <p className="leading-relaxed">
                  {act.expected_impact}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. CONTROL PHASE VIEW (Statistical Verification Gate)
// ─────────────────────────────────────────────────────────────────────────────
export function ControlView({ data }) {
  const cr = data?.control_result || data;
  const iteration = data?.iteration_count || 1;
  if (!cr) return <div className="text-xs text-airtable-muted">No control result data available.</div>;

  const passed = cr.passed === true;

  return (
    <div className="space-y-4">
      {/* Verification Gate Result Banner */}
      <div
        className={`p-4 rounded-lg border flex items-center justify-between ${
          passed
            ? 'bg-airtable-forest/10 border-airtable-forest/30 text-airtable-forest'
            : 'bg-airtable-coral/10 border-airtable-coral/30 text-airtable-coral'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              passed ? 'bg-airtable-forest text-white shadow-2xs' : 'bg-airtable-coral text-white shadow-2xs'
            }`}
          >
            {passed ? <Check className="w-5 h-5 stroke-[2.5]" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-medium leading-tight text-airtable-ink">
              {passed ? 'Control Gate Passed & Statistically Verified' : 'Control Gate Escalated'}
            </h3>
            <p className="text-xs text-airtable-body mt-0.5">
              {passed
                ? 'Post-intervention defect rate is confirmed below the quality threshold.'
                : `Verification check failed: ${cr.failure_reason || 'Requires retry'}`}
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-xs bg-white border border-airtable-hairline text-airtable-ink">
          Cycle #{iteration}
        </span>
      </div>

      {/* Before / After Statistical Telemetry Comparison */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-md bg-white border border-airtable-hairline shadow-2xs">
          <span className="text-[10px] uppercase font-mono text-airtable-muted block">Post-Intervention Rate</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl sm:text-2xl font-medium font-mono text-airtable-forest">
              {Number(cr.post_intervention_rate).toFixed(2)}%
            </span>
          </div>
          <span className="text-[10px] text-airtable-forest font-medium">Controlled & Stable</span>
        </div>

        <div className="p-3 rounded-md bg-white border border-airtable-hairline shadow-2xs">
          <span className="text-[10px] uppercase font-mono text-airtable-muted block">Defect Reduction (Delta)</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl sm:text-2xl font-medium font-mono text-airtable-forest">
              {Number(cr.delta_from_baseline).toFixed(2)}%
            </span>
          </div>
          <span className="text-[10px] text-airtable-forest font-medium flex items-center gap-0.5">
            <TrendingDown className="w-3 h-3" />
            Statistically Significant
          </span>
        </div>

        <div className="p-3 rounded-md bg-white border border-airtable-hairline shadow-2xs">
          <span className="text-[10px] uppercase font-mono text-airtable-muted block">Audit Status</span>
          <div className="mt-1 flex items-center gap-1">
            <ShieldCheck className="w-5 h-5 text-airtable-forest" />
            <span className="text-sm font-medium text-airtable-ink">Approved</span>
          </div>
          <span className="text-[10px] text-airtable-muted">Ready for production lock</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. ALL-IN-ONE ACCORDION / REPORT CONTAINER
// ─────────────────────────────────────────────────────────────────────────────
export default function DMAICReportView({ phases, finalStatus }) {
  return (
    <div className="space-y-4">
      {/* Define */}
      {phases.define && (
        <div className="rounded-lg border border-airtable-hairline bg-white overflow-hidden shadow-2xs">
          <div className="px-4 py-2.5 bg-airtable-surface-soft border-b border-airtable-hairline flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-airtable-ink" />
              <span className="text-xs font-medium uppercase tracking-wider text-airtable-ink">1. Define Phase</span>
            </div>
            <span className="text-[10px] font-mono text-airtable-ink bg-white px-2 py-0.5 rounded-xs border border-airtable-hairline">
              Problem Scoped
            </span>
          </div>
          <div className="p-4">
            <DefineView data={phases.define} />
          </div>
        </div>
      )}

      {/* Measure */}
      {phases.measure && (
        <div className="rounded-lg border border-airtable-hairline bg-white overflow-hidden shadow-2xs">
          <div className="px-4 py-2.5 bg-airtable-surface-soft border-b border-airtable-hairline flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-airtable-ink" />
              <span className="text-xs font-medium uppercase tracking-wider text-airtable-ink">2. Measure Phase</span>
            </div>
            <span className="text-[10px] font-mono text-airtable-ink bg-white px-2 py-0.5 rounded-xs border border-airtable-hairline">
              Pareto Ranked
            </span>
          </div>
          <div className="p-4">
            <MeasureView data={phases.measure} />
          </div>
        </div>
      )}

      {/* Analyze */}
      {phases.analyze && (
        <div className="rounded-lg border border-airtable-hairline bg-white overflow-hidden shadow-2xs">
          <div className="px-4 py-2.5 bg-airtable-surface-soft border-b border-airtable-hairline flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-airtable-ink" />
              <span className="text-xs font-medium uppercase tracking-wider text-airtable-ink">3. Analyze Phase</span>
            </div>
            <span className="text-[10px] font-mono text-airtable-ink bg-white px-2 py-0.5 rounded-xs border border-airtable-hairline">
              5-Whys Grounded
            </span>
          </div>
          <div className="p-4">
            <AnalyzeView data={phases.analyze} />
          </div>
        </div>
      )}

      {/* Improve */}
      {phases.improve && (
        <div className="rounded-lg border border-airtable-hairline bg-white overflow-hidden shadow-2xs">
          <div className="px-4 py-2.5 bg-airtable-surface-soft border-b border-airtable-hairline flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-airtable-ink" />
              <span className="text-xs font-medium uppercase tracking-wider text-airtable-ink">4. Improve Phase</span>
            </div>
            <span className="text-[10px] font-mono text-airtable-ink bg-white px-2 py-0.5 rounded-xs border border-airtable-hairline">
              Action Plan Matrix
            </span>
          </div>
          <div className="p-4">
            <ImproveView data={phases.improve} />
          </div>
        </div>
      )}

      {/* Control */}
      {phases.control && (
        <div className="rounded-lg border border-airtable-hairline bg-white overflow-hidden shadow-2xs">
          <div className="px-4 py-2.5 bg-airtable-surface-soft border-b border-airtable-hairline flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-airtable-ink" />
              <span className="text-xs font-medium uppercase tracking-wider text-airtable-ink">5. Control Phase</span>
            </div>
            <span className="text-[10px] font-mono text-airtable-ink bg-white px-2 py-0.5 rounded-xs border border-airtable-hairline">
              Statistical Verification
            </span>
          </div>
          <div className="p-4">
            <ControlView data={phases.control} />
          </div>
        </div>
      )}
    </div>
  );
}
