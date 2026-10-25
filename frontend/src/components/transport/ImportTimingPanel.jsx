import React, { useState, useEffect } from 'react';
import {
  Globe,
  Calendar,
  DollarSign,
  Clock,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Anchor,
  Sparkles,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { fetchImportQuarterlyTiming, calculatePoPlacement } from '../../lib/api';

export default function ImportTimingPanel() {
  const [selectedQuarter, setSelectedQuarter] = useState('Q2');
  const [timingData, setTimingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // PO Placement Calculator State
  const [targetArrivalDate, setTargetArrivalDate] = useState('2027-05-20');
  const [calcVolumeKg, setCalcVolumeKg] = useState(24000);
  const [poResult, setPoResult] = useState(null);
  const [poLoading, setPoLoading] = useState(false);

  const loadTiming = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchImportQuarterlyTiming(selectedQuarter);
      setTimingData(res);
    } catch (err) {
      console.error('Failed to load import timing data', err);
      setError(err.message || 'Could not fetch quarterly import timing');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculatePo = async () => {
    try {
      setPoLoading(true);
      const res = await calculatePoPlacement(targetArrivalDate, calcVolumeKg, 'Dragonfruit Pulp');
      setPoResult(res);
    } catch (err) {
      console.error('Failed to calculate PO placement', err);
    } finally {
      setPoLoading(false);
    }
  };

  useEffect(() => {
    loadTiming();
  }, [selectedQuarter]);

  useEffect(() => {
    handleCalculatePo();
  }, []);

  if (loading && !timingData) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-sm text-airtable-muted">
        <RefreshCw className="w-5 h-5 animate-spin text-airtable-ink" />
        <span>Analyzing Global Import Seasonality & Ocean Freight Cycles...</span>
      </div>
    );
  }

  if (error && !timingData) {
    return (
      <div className="p-6 rounded-lg bg-rose-50 border border-rose-200 text-center space-y-3">
        <AlertTriangle className="w-6 h-6 text-rose-600 mx-auto" />
        <div className="text-sm font-semibold text-airtable-ink">Unable to load import timing</div>
        <div className="text-xs text-airtable-muted">{error}</div>
        <button
          onClick={loadTiming}
          className="px-3 py-1.5 rounded-md bg-airtable-ink text-white text-xs font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  const { calendar_seasonality, weekly_profile, executive_summary, planning_rule } = timingData || {};

  return (
    <div className="space-y-6">
      {/* ── Control Header: Quarter Selection & Sourcing Context ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-airtable-hairline">
          <div>
            <span className="section-label">Global Procurement & Sourcing Rhythm</span>
            <h3 className="text-base font-medium text-airtable-ink mt-0.5">
              Ideal Quarterly Import Timing & Ocean Lead Time Optimizer
            </h3>
            <p className="text-xs text-airtable-muted mt-0.5">
              Identifies optimal booking windows for foreign pulp (Dragonfruit / Purees) to minimize ocean spot rates, port dwell times, and avoid the quarter-end rush cliff.
            </p>
          </div>

          {/* Quarter Tabs */}
          <div className="flex items-center gap-1 bg-airtable-surface-soft p-0.5 rounded-sm border border-airtable-hairline">
            {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
              <button
                key={q}
                onClick={() => setSelectedQuarter(q)}
                className={`px-3 py-1 rounded-xs text-xs font-mono font-medium transition-all ${
                  selectedQuarter === q
                    ? 'bg-airtable-primary text-white shadow-xs font-medium'
                    : 'text-airtable-muted hover:text-airtable-ink'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* ── Golden Window vs Quarter-End Rush KPI Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
          <div className="rounded-md p-4 bg-white border border-airtable-hairline shadow-2xs">
            <span className="text-[10px] font-mono uppercase text-airtable-forest font-medium block mb-1">
              Golden Window (Sweet Spot)
            </span>
            <div className="text-2xl font-mono font-medium text-airtable-forest leading-none">
              Weeks 4 – 8
            </div>
            <div className="text-[11px] text-airtable-muted font-medium mt-1.5">
              Lowest port dwell & spot rates
            </div>
          </div>

          <div className="rounded-md p-4 bg-white border border-airtable-hairline shadow-2xs">
            <span className="text-[10px] font-mono uppercase text-airtable-muted font-medium block mb-1">
              Ocean Freight Discount
            </span>
            <div className="text-2xl font-mono font-medium text-airtable-ink leading-none">
              {executive_summary?.freight_rate_savings_pct}% Off
            </div>
            <div className="text-[11px] text-airtable-forest font-medium mt-1.5">
              ${executive_summary?.golden_window_ocean_rate_usd} vs ${executive_summary?.quarter_end_ocean_rate_usd}/FEU
            </div>
          </div>

          <div className="rounded-md p-4 bg-white border border-airtable-hairline shadow-2xs">
            <span className="text-[10px] font-mono uppercase text-airtable-muted font-medium block mb-1">
              Lead Time Saved
            </span>
            <div className="text-2xl font-mono font-medium text-airtable-ink leading-none">
              {executive_summary?.lead_time_reduction_days} Days
            </div>
            <div className="text-[11px] text-airtable-muted mt-1.5">
              {executive_summary?.golden_lead_time_days}d vs {executive_summary?.quarter_end_lead_time_days}d rush
            </div>
          </div>

          <div className="rounded-md p-4 bg-white border border-airtable-hairline shadow-2xs">
            <span className="text-[10px] font-mono uppercase text-airtable-forest font-medium block mb-1">
              Annual Profit Protected
            </span>
            <div className="text-2xl font-mono font-medium text-airtable-forest leading-none">
              ₹{executive_summary?.projected_annual_pulp_savings_inr_cr} Cr
            </div>
            <div className="text-[11px] text-airtable-forest font-medium mt-1.5">
              ₹{executive_summary?.landed_cost_savings_per_kg_inr}/kg landed savings
            </div>
          </div>
        </div>

        {/* Strategic Guidance Callout */}
        <div className="p-3.5 rounded-sm bg-airtable-surface-soft border border-airtable-hairline text-xs space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-airtable-mustard" />
            <strong className="text-airtable-ink font-medium">Seasonal Procurement Law:</strong>
          </div>
          <p className="text-airtable-body leading-relaxed">{planning_rule}</p>
        </div>
      </div>

      {/* ── 13-Week Interactive Timeline Heatmap ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="section-label">Quarterly Week-by-Week Trajectory</span>
            <h4 className="text-sm font-medium text-airtable-ink">
              13-Week Ocean Freight Cost & Port Congestion Index ({selectedQuarter})
            </h4>
          </div>
          <span className="text-xs font-mono text-airtable-muted">
            Nhava Sheva & Transshipment Telemetry
          </span>
        </div>

        {/* Weekly strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-13 gap-2 overflow-x-auto pb-2">
          {weekly_profile &&
            weekly_profile.map((w) => {
              const isGold = w.is_golden_window;
              const isRush = w.phase.includes('Rush');
              return (
                <div
                  key={w.week}
                  className={`p-2.5 rounded-md border flex flex-col justify-between transition-all ${
                    isGold
                      ? 'bg-airtable-surface-soft border-airtable-forest/40 ring-1 ring-airtable-forest/30'
                      : isRush
                      ? 'bg-airtable-coral/10 border-airtable-coral/30'
                      : 'bg-airtable-surface-soft border-airtable-hairline'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono font-medium mb-1">
                      <span>Wk {w.week}</span>
                      {isGold && <CheckCircle2 className="w-3 h-3 text-airtable-forest" />}
                    </div>
                    <div
                      className={`text-[9px] uppercase font-medium leading-tight mb-2 ${
                        isGold ? 'text-airtable-forest' : isRush ? 'text-airtable-coral' : 'text-airtable-muted'
                      }`}
                    >
                      {isGold ? 'Golden Window' : isRush ? 'Rush Cliff' : w.phase}
                    </div>

                    <div className="space-y-1 text-[10px] font-mono">
                      <div className="flex justify-between">
                        <span className="text-airtable-muted">Rate:</span>
                        <strong className="text-airtable-ink font-medium">${w.ocean_rate_index_usd}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-airtable-muted">Lead:</span>
                        <span className="text-airtable-ink font-medium">{w.total_lead_time_days}d</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-airtable-muted">Dwell:</span>
                        <span className="text-airtable-ink font-medium">{w.port_dwell_days}d</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-airtable-muted">Roll:</span>
                        <span className={w.rollover_risk_pct > 15 ? 'text-airtable-coral font-medium' : 'text-airtable-muted'}>
                          {w.rollover_risk_pct}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-airtable-hairline text-[9px] text-airtable-muted line-clamp-2">
                    {w.advisory}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-mono pt-1 text-airtable-muted">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-xs bg-airtable-surface-soft border border-airtable-forest/40" />
            <span>Optimal Golden Window (Lowest Landed Cost)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-xs bg-airtable-coral/10 border border-airtable-coral/30" />
            <span>Quarter-End Rush Cliff (Peak Surcharges & Delays)</span>
          </div>
        </div>
      </div>

      {/* ── Macro Calendar Seasonality Factors & PO Date Calculator ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar Seasonality Card */}
        <div className="rounded-lg bg-white border border-airtable-hairline p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-airtable-ink" />
            <h4 className="text-sm font-medium text-airtable-ink">
              {calendar_seasonality?.quarter} Global Seasonality Dynamics
            </h4>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-sm bg-airtable-surface-soft border border-airtable-hairline space-y-1">
              <span className="text-[10px] font-mono uppercase text-airtable-muted font-medium block">
                Primary Macro Driver
              </span>
              <p className="font-medium text-airtable-ink">
                {calendar_seasonality?.seasonal_driver}
              </p>
            </div>

            <div className="p-3 rounded-sm bg-airtable-surface-soft border border-airtable-forest/40 space-y-1">
              <span className="text-[10px] font-mono uppercase text-airtable-forest font-medium block">
                Recommended Order Window: {calendar_seasonality?.sweet_spot_weeks}
              </span>
              <p className="text-airtable-body leading-relaxed font-normal">
                {calendar_seasonality?.sweet_spot_rationale}
              </p>
            </div>

            <div className="p-3 rounded-sm bg-airtable-coral/10 border border-airtable-coral/30 space-y-1">
              <span className="text-[10px] font-mono uppercase text-airtable-coral font-medium block">
                Critical Avoid Window: {calendar_seasonality?.avoid_weeks}
              </span>
              <p className="text-airtable-body leading-relaxed font-normal">
                {calendar_seasonality?.avoid_rationale}
              </p>
            </div>

            <div className="pt-2 text-[11px] text-airtable-muted border-t border-airtable-hairline">
              <strong>Strategic Focus:</strong> {calendar_seasonality?.strategic_focus}
            </div>
          </div>
        </div>

        {/* PO Date Placement Calculator */}
        <div className="rounded-lg bg-white border border-airtable-hairline p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-airtable-ink" />
            <h4 className="text-sm font-medium text-airtable-ink">
              Interactive Purchase Order Date Recommender
            </h4>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono uppercase text-airtable-muted mb-1 font-medium">
                  Required Plant Arrival
                </label>
                <input
                  type="date"
                  value={targetArrivalDate}
                  onChange={(e) => setTargetArrivalDate(e.target.value)}
                  className="w-full text-xs font-mono font-medium bg-white border border-airtable-hairline rounded-sm px-3 py-2 text-airtable-ink focus:border-airtable-info-border"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-airtable-muted mb-1 font-medium">
                  Pulp Volume (kg)
                </label>
                <input
                  type="number"
                  step="2000"
                  value={calcVolumeKg}
                  onChange={(e) => setCalcVolumeKg(Number(e.target.value))}
                  className="w-full text-xs font-mono font-medium bg-white border border-airtable-hairline rounded-sm px-3 py-2 text-airtable-ink focus:border-airtable-info-border"
                />
              </div>
            </div>

            <button
              onClick={handleCalculatePo}
              disabled={poLoading}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-airtable-primary text-white text-xs font-medium hover:bg-airtable-primary-active transition-colors shadow-xs disabled:opacity-50"
            >
              {poLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Calculate Least-Cost PO Placement
            </button>

            {poResult && (
              <div className="mt-3 p-3.5 rounded-md bg-airtable-surface-soft border border-airtable-hairline space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-medium uppercase text-airtable-ink">
                    Recommended PO Date:
                  </span>
                  <span className="text-sm font-mono font-medium text-airtable-forest">
                    {poResult.recommended_po_date}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-airtable-hairline">
                  <div>
                    <span className="text-airtable-muted block text-[10px]">Lead Time in Golden Window:</span>
                    <strong className="text-airtable-forest font-mono font-medium">{poResult.golden_lead_time_days} Days</strong>
                  </div>
                  <div>
                    <span className="text-airtable-muted block text-[10px]">Lead Time Saved:</span>
                    <strong className="text-airtable-forest font-mono font-medium">+{poResult.lead_time_cushion_saved_days} Days</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-airtable-hairline">
                  <span className="text-xs text-airtable-forest font-medium">Estimated Direct Cost Savings:</span>
                  <span className="text-sm font-mono font-medium text-airtable-forest">
                    {poResult.savings_label}
                  </span>
                </div>

                <p className="text-[11px] text-airtable-muted leading-snug pt-1">
                  {poResult.execution_guidance}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
