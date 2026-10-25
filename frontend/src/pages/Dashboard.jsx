import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  CheckCircle,
  RefreshCw,
  X,
  DollarSign,
  Layers,
  Bell,
} from 'lucide-react';
import { fetchKpiScorecard, fetchKpiHistory } from '../lib/api';
import KpiCard from '../components/KpiCard';
import MonteCarloModal from '../components/MonteCarloModal';
import MatplotlibChart from '../components/MatplotlibChart';

// ── Static data for new visualizations ────────────────────────────────────────

const WATERFALL_DATA = [
  { name: 'Summer Baseline', base: 0, value: 576, fill: '#64748b' },
  { name: 'Stockout Loss', base: 561.25, value: -14.75, fill: '#aa2d00' },
  { name: 'Write-off Loss', base: 555.25, value: -6, fill: '#aa2d00' },
  { name: 'Air Freight Premium', base: 552.05, value: -3.2, fill: '#aa2d00' },
  { name: 'Actual Realised', base: 0, value: 552.05, fill: '#475569' },
  { name: 'Protected Revenue', base: 0, value: 573.1, fill: '#1a6641' },
];

// Waterfall trick: offset bar (transparent) + colored bar stacked
const WATERFALL_CHART = [
  { name: 'Summer\nBaseline', offset: 0, positive: 576, negative: 0, color: '#64748b' },
  { name: 'Stockout\nLoss', offset: 561.25, positive: 0, negative: 14.75, color: '#aa2d00' },
  { name: 'Write-off\nLoss', offset: 555.25, positive: 0, negative: 6, color: '#aa2d00' },
  { name: 'Air Freight\nPremium', offset: 552.05, positive: 0, negative: 3.2, color: '#aa2d00' },
  { name: 'Actual\nRealised', offset: 0, positive: 552.05, negative: 0, color: '#475569' },
  { name: 'With Model\nProtected', offset: 0, positive: 573.1, negative: 0, color: '#1a6641' },
];

// 5 weeks × 7 days heatmap data
function generateHeatmapData() {
  const weeks = [];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // Week 1: mostly green, Week 2-3: spike to red, Week 4-5: green again
  const patterns = [
    [1, 2, 1, 1, 2, 1, 1],   // Week 1 – calm
    [3, 4, 8, 12, 15, 11, 9], // Week 2 – building
    [18, 22, 25, 20, 17, 14, 10], // Week 3 – viral spike
    [7, 5, 4, 3, 3, 2, 2],   // Week 4 – recovering
    [2, 1, 1, 2, 1, 1, 1],   // Week 5 – calm
  ];
  for (let w = 0; w < 5; w++) {
    const weekDays = [];
    for (let d = 0; d < 7; d++) {
      const march1 = new Date(2025, 2, 1);
      const date = new Date(march1.getTime() + (w * 7 + d) * 86400000);
      const count = patterns[w][d];
      let severity = 'green';
      if (count >= 15) severity = 'red';
      else if (count >= 6) severity = 'amber';
      weekDays.push({
        date: `${date.toLocaleString('en-IN', { month: 'short' })} ${date.getDate()}`,
        day: dayNames[d],
        count,
        severity,
      });
    }
    weeks.push(weekDays);
  }
  return weeks;
}
const HEATMAP_WEEKS = generateHeatmapData();

// ── KPI Axis and Insight Helpers for Drilldown Modal ────────────────────────────

function getKpiAxisConfig(kpi) {
  if (!kpi) return { yLabel: 'Metric Value', unit: '', format: (v) => v };
  const code = kpi.kpi_code;
  const unit = kpi.unit;

  if (code === 'B3' || unit === 'ratio') {
    return {
      yLabel: 'Velocity Deviation (%)',
      unit: '%',
      format: (v) => `${(v * 100).toFixed(0)}%`,
    };
  }
  if (code === 'C1') {
    return {
      yLabel: 'Plant Utilization (%)',
      unit: '%',
      format: (v) => `${(v * 100).toFixed(0)}%`,
    };
  }
  if (code === 'C3' || unit === 'days') {
    return {
      yLabel: 'Inventory Cover (Days)',
      unit: 'd',
      format: (v) => `${v}d`,
    };
  }
  if (code === 'D2' || unit === 'batches') {
    return {
      yLabel: 'Batches at Risk (Count)',
      unit: 'batches',
      format: (v) => `${v}`,
    };
  }
  if (code === 'E1') {
    return {
      yLabel: 'Depot Cover Variance (Days)',
      unit: 'd',
      format: (v) => `${v}d`,
    };
  }
  if (unit === '₹') {
    return {
      yLabel: 'Financial Exposure (₹)',
      unit: '₹',
      format: (v) => v >= 10000000 ? `₹${(v / 10000000).toFixed(2)}Cr` : v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${v.toLocaleString()}`,
    };
  }
  if (unit === 'x') {
    return {
      yLabel: 'Freight Cost Ratio (x Road)',
      unit: 'x',
      format: (v) => `${v}x`,
    };
  }
  if (unit === '%') {
    return {
      yLabel: `${kpi.name} (%)`,
      unit: '%',
      format: (v) => `${v}%`,
    };
  }
  return {
    yLabel: `${kpi.name} (${unit || 'Value'})`,
    unit: unit || '',
    format: (v) => `${v} ${unit || ''}`,
  };
}

function getKpiDetailedInsight(kpi) {
  if (!kpi) return null;
  const code = kpi.kpi_code;

  const insights = {
    B3: {
      trend: "Exponential inflection: Quick Commerce sell-through deviated +34% above forecast following the viral 30-second influencer reel on Dragon Passion.",
      rootCause: "Quick commerce dark stores sent daily sell-through reports to marketing, while S&OP planners received data only at month-end.",
      action: "Trigger immediate 10% co-packer reserve (requires 2 weeks advance notice) and bias dynamic depot replenishment toward Mumbai & Bengaluru dark stores."
    },
    C1: {
      trend: "Plant utilization is running at 95.8%, colliding with the fixed summer operating ceiling across both bottling plants.",
      rootCause: "Summer lines cannot be expanded mid-season; in-house plant capacity (2.5 Cr bottles/month) cannot absorb sudden portfolio velocity shifts.",
      action: "Supply Lead must issue contractual 14-day advance notice to co-packer to activate up to 10% overflow volume at 25% premium."
    },
    C3: {
      trend: "Passionfruit pulp reserves in plant cold storage have depleted to 14 days, breaching the 28-day pre-monsoon safety floor.",
      rootCause: "100% single-source reliance on a hill-region cooperative; the sole road route closed for >=1 week in 3 of the last 5 summers.",
      action: "Trigger secondary cooperative procurement (Sahyadri Bio-Organics) to restore safety buffer to >=35 days before seasonal landslide window."
    },
    D1: {
      trend: "Severe stock divergence: Slow depots hold >16 days cover while high-velocity urban dark stores sit under 5 days.",
      rootCause: "Depots held 3 weeks cover allocated strictly on the previous year's static flavor mix, starving breakout hits.",
      action: "Execute inter-depot rebalancing transfers (2-4 day transit, ₹1.50/bottle) from North/East surplus depots to South/West deficit hubs."
    },
    D2: {
      trend: "18 batches have crossed age 18 days and will face mandatory commercial rejection upon crossing the Day 30 shelf-life cliff.",
      rootCause: "Modern Trade and Quick Commerce reject finished juice with <60 days remaining (90-day total life), costing ₹6 Cr in write-offs last summer.",
      action: "Reroute aging batches immediately to high-turnover Quick Commerce dark stores before Day 21 cliff occurs."
    },
    E1: {
      trend: "Regional depot cover-day variance has widened to 12.4 days across the 9 distribution hubs (governance threshold: <6.0 days).",
      rootCause: "Each depot reported inventory weekly in its own disconnected spreadsheet, preventing real-time national inventory balancing.",
      action: "Authorize automated inter-depot stock rebalancing ledger within 48-hour execution SLA to eliminate local starvation."
    },
    A1: {
      trend: "Summer contribution margin trajectory is trailing potential by ₹20.75 Cr due to mismatched flavor mix and stockouts.",
      rootCause: "Unsynchronized monthly S&OP meetings allowed compounding operational losses to continue unmitigated.",
      action: "Executive COO review required to authorize co-packer overtime and protect target 32% seasonal contribution margin."
    },
    A2: {
      trend: "Unfulfilled demand rate is tracking at 8% of summer revenue (₹46.08 Cr loss), driven by viral SKU stockouts.",
      rootCause: "Fixed in-house capacity and delayed co-packer notice left customer orders stranded during the viral spike.",
      action: "Prioritize production scheduling for Dragon Passion and Passionfruit Punch to cap stock-out loss below 1.0%."
    },
    A3: {
      trend: "Depot inventory write-off exposure stands at ₹6.0 Cr across slow-moving Mango Peach Basil and Guava Chilli SKUs.",
      rootCause: "Depots were overstocked with old flavor profiles while consumer preference shifted toward exotic blends.",
      action: "Apply promotional price elasticities and reroute stock before Modern Trade 60-day shelf-life rejections trigger."
    },
    A4: {
      trend: "Emergency air freight premium spiked to 5.0x normal logistics cost (₹3.2 Cr air vs ₹0.64 Cr road baseline).",
      rootCause: "Emergency air freight was booked in the second week of the May highway closure after plant buffer had already dried up.",
      action: "Pre-contract multi-modal secondary road/rail backup transit whenever pulp cover drops below 28 days between April and June."
    },
    A5: {
      trend: "Retail out-of-stock duration reached 11 consecutive days, exposing dark-store shelf space to competitor replacement.",
      rootCause: "A larger rival launched its own dragonfruit-passionfruit blend within 6 weeks and seized unfulfilled retail slots.",
      action: "Enforce Channel Fair Share SLA (KPI E4) ensuring no Modern Trade account is out of stock for >48 hours."
    }
  };

  return insights[code] || {
    trend: `${kpi.name} is currently reading ${kpi.value} ${kpi.unit || ''} against baseline ${kpi.baseline}.`,
    rootCause: "Manual spreadsheet planning and monthly S&OP cycles delayed early operational intervention.",
    action: `Action assigned to ${kpi.approval_tier?.toUpperCase() || 'PLANNER'} tier to restore performance to target: ${kpi.target}.`
  };
}

// ── StatTile component ─────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  onClick,
  isActionable,
  valueColor = 'text-airtable-ink',
  borderClass,
  shadowClass = 'shadow-xs hover:shadow-soft',
}) {
  const content = (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-airtable-muted">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-airtable-muted" />}
      </div>
      <div className={`text-[28px] font-medium font-mono leading-none tracking-tight ${valueColor}`}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-airtable-muted mt-1.5 leading-snug">{sub}</div>}
    </>
  );

  const borderStyles = borderClass || 'border-airtable-hairline hover:border-airtable-border-strong';

  if (isActionable) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick && onClick();
          }
        }}
        className={`rounded-lg p-5 flex flex-col justify-between cursor-pointer transition-all duration-150 active:scale-[0.98] bg-white border ${borderStyles} ${shadowClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900`}
      >
        {content}
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-5 flex flex-col justify-between bg-white border ${borderStyles} ${shadowClass}`}>
      {content}
    </div>
  );
}

// ── Custom waterfall tooltip ───────────────────────────────────────────────────
const WaterfallTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const pos = payload.find(p => p.dataKey === 'positive');
  const neg = payload.find(p => p.dataKey === 'negative');
  const val = pos?.value > 0 ? `+₹${pos.value} Cr` : neg?.value > 0 ? `-₹${neg.value} Cr` : null;
  return (
    <div className="bg-white p-3 rounded-lg border border-airtable-hairline shadow-md text-xs">
      <div className="font-semibold text-airtable-ink mb-1">{label}</div>
      {val && <div className="font-mono text-airtable-ink">{val}</div>}
    </div>
  );
};

export default function Dashboard({ onNavigateToAlerts, onRefreshBadge }) {
  const [scorecard, setScorecard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedKpi, setSelectedKpi] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showMonteCarlo, setShowMonteCarlo] = useState(false);
  const [heatmapTooltip, setHeatmapTooltip] = useState(null);

  const loadScorecard = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchKpiScorecard();
      setScorecard(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScorecard();
  }, [loadScorecard]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedKpi) {
        setSelectedKpi(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedKpi]);

  const handleCardClick = async (kpi) => {
    setSelectedKpi(kpi);
    setHistoryLoading(true);
    try {
      const data = await fetchKpiHistory(kpi.kpi_code);
      setHistoryData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const headlineCodes = ['B3', 'C1', 'C3', 'D1', 'D2', 'E1'];
  const financialCodes = ['A1', 'A2', 'A3', 'A4', 'A5'];

  const headlineCards = scorecard?.cards.filter((c) => headlineCodes.includes(c.kpi_code)) || [];
  const financialCards = scorecard?.cards.filter((c) => financialCodes.includes(c.kpi_code)) || [];
  const openAlerts = scorecard?.cards.filter((c) => c.status === 'breach').length || 0;

  if (loading && !scorecard) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-airtable-surface-soft border border-airtable-hairline">
            <RefreshCw className="w-4 h-4 text-airtable-ink animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-airtable-ink">Synthesizing telemetry</p>
            <p className="text-xs text-airtable-muted mt-0.5">31 continuous KPI monitors active</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-5 sm:p-8 pb-16 max-w-[1600px] mx-auto">
      {/* ── Hero Stat Tiles ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Summer Revenue"
          value="₹576 Cr"
          sub="48% annual: 9.6 Cr bottles"
          icon={DollarSign}
        />
        <StatTile
          label="Protected P&L"
          value="₹20.75 Cr"
          sub="Proactive multi-agent mitigation"
          icon={CheckCircle}
          valueColor="text-airtable-forest"
        />
        <StatTile
          label="Solution ROI"
          value="9.2x"
          sub="Against ₹2.5 Cr budget cap"
          icon={TrendingUp}
        />
        <StatTile
          label="Active Breaches"
          value={openAlerts}
          sub="Click to open alert queue"
          icon={Bell}
          onClick={onNavigateToAlerts}
          isActionable={true}
          valueColor={openAlerts > 0 ? 'text-airtable-coral' : 'text-airtable-forest'}
          borderClass={openAlerts > 0 ? 'border-red-400' : 'border-airtable-hairline'}
          shadowClass="shadow-none"
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          P&L Damage Waterfall: Last Summer vs. With Agent Layer
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4">
        <div>
          <span className="section-label">Financial Risk Decomposition</span>
          <h3 className="text-base font-medium text-airtable-ink mt-0.5">
            P&L Damage Waterfall: Last Summer vs. With Agent Layer
          </h3>
        </div>

        <div className="w-full">
          <MatplotlibChart
            graphId="dashboard_waterfall"
            title="Summer Value Protected Waterfall"
            subtitle="₹576 Cr Summer Baseline to ₹573.1 Cr Protected Revenue"
            height="h-72"
          />
        </div>
        <p className="text-[11px] text-airtable-muted leading-relaxed">
          Without the agent layer, three compounding losses (stockout revenue loss ₹14.75Cr, excess write-offs ₹6Cr, emergency air freight premium ₹3.2Cr) collapsed ₹576Cr baseline to ₹552.05Cr realised. The model intervention recovers ₹21.05Cr, protecting 97% of the baseline.
        </p>
      </div>

      {/* ── Domain Scorecard ─────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-airtable-ink" />
          <h2 className="text-base font-medium text-airtable-ink">Domain Scorecard</h2>
          <span className="text-xs text-airtable-muted hidden sm:inline">
            (5-second planner view across key operations. Click card to drill down)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {headlineCards.map((kpi) => (
            <KpiCard key={kpi.kpi_code} kpi={kpi} onClick={() => handleCardClick(kpi)} />
          ))}
        </div>
      </div>

      {/* ── Financial Impact Rollup ───────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4 text-airtable-ink" />
          <h2 className="text-base font-medium text-airtable-ink">Financial Impact Rollup</h2>
          <span className="text-xs text-airtable-muted hidden sm:inline">
            (A1-A5 Tier-1 risk exposure monitors)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {financialCards.map((kpi) => (
            <KpiCard key={kpi.kpi_code} kpi={kpi} onClick={() => handleCardClick(kpi)} />
          ))}
        </div>
      </div>


      {/* ══════════════════════════════════════════════════════════════════════
          NEW SECTION C: 30-Day Rolling Alert Heatmap Calendar
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4">
        <div>
          <span className="section-label">Alert Intensity Calendar</span>
          <h3 className="text-base font-medium text-airtable-ink mt-0.5">
            Alert Intensity Calendar: March–April 2025
          </h3>
        </div>

        {/* Day-of-week headers */}
        <div className="overflow-x-auto">
          <div className="min-w-[420px]">
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="text-center text-[10px] font-mono text-airtable-muted font-semibold py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Heatmap grid */}
            {HEATMAP_WEEKS.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1.5 mb-1.5">
                {week.map((cell, di) => (
                  <div
                    key={di}
                    className={`relative h-10 rounded-md flex flex-col items-center justify-center cursor-default transition-all hover:scale-105 hover:shadow-md
                      ${cell.severity === 'red' ? 'bg-rose-500 text-white' :
                        cell.severity === 'amber' ? 'bg-amber-400 text-white' :
                        'bg-emerald-100 text-emerald-800'}`}
                    onMouseEnter={() => setHeatmapTooltip({ ...cell, week: wi + 1 })}
                    onMouseLeave={() => setHeatmapTooltip(null)}
                  >
                    <span className="text-[10px] font-mono font-bold leading-none">{cell.count}</span>
                    <span className="text-[8px] font-mono opacity-80 leading-none mt-0.5">{cell.date.split(' ')[1]}</span>
                  </div>
                ))}
              </div>
            ))}

            {/* Tooltip */}
            {heatmapTooltip && (
              <div className="mt-2 p-2.5 rounded-lg bg-slate-900 text-white text-[11px] font-mono animate-fade-in inline-block">
                <span className="font-semibold">{heatmapTooltip.date}</span>
                {' · '}
                <span>{heatmapTooltip.count} alerts</span>
                {' · '}
                <span className={heatmapTooltip.severity === 'red' ? 'text-rose-300' :
                  heatmapTooltip.severity === 'amber' ? 'text-amber-300' : 'text-emerald-300'}>
                  {heatmapTooltip.severity.toUpperCase()} severity
                </span>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-airtable-hairline">
              <span className="text-[11px] text-airtable-muted font-mono">Severity:</span>
              {[
                { color: 'bg-emerald-100', label: 'Normal (1-5)' },
                { color: 'bg-amber-400', label: 'Elevated (6-14)' },
                { color: 'bg-rose-500', label: 'Crisis (15+)' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded-sm ${color}`} />
                  <span className="text-[10px] text-airtable-muted">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-airtable-muted leading-relaxed">
          Week 3 (March 15–21) shows the viral spike crisis: Dragon Passion QC velocity surged 4× triggering 25 simultaneous alerts in a single day. The agent's early-detection cascade prevented stockout propagation to MT channel. By Week 4–5, continuous rebalancing restored the network to baseline alert frequency.
        </p>
      </div>

      {/* ── Drilldown Modal ───────────────────────────── */}
      {selectedKpi && (() => {
        const axisConfig = getKpiAxisConfig(selectedKpi);
        const insight = getKpiDetailedInsight(selectedKpi);
        const isBreach = selectedKpi.status === 'breach';
        const isWarning = selectedKpi.status === 'warning';

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in overflow-y-auto"
            onClick={() => setSelectedKpi(null)}
            role="dialog"
            aria-modal="true"
            aria-label={`Drilldown for ${selectedKpi.name}`}
          >
            <div
              className="w-full max-w-3xl rounded-xl p-6 shadow-xl bg-white border border-airtable-hairline animate-slide-up space-y-4 my-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-start justify-between pb-3 border-b border-airtable-hairline">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-airtable-surface-soft text-airtable-ink border border-airtable-hairline">
                      KPI {selectedKpi.kpi_code}
                    </span>
                    <span className="text-xs text-airtable-muted font-medium uppercase tracking-wider">
                      {selectedKpi.category}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                        isBreach
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : isWarning
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {selectedKpi.status.toUpperCase()}
                    </span>
                    {selectedKpi.sentiment_badge && (
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                        title={typeof selectedKpi.sentiment_badge === 'object' ? (selectedKpi.sentiment_badge.rationale || selectedKpi.sentiment_badge.text) : undefined}
                      >
                        {typeof selectedKpi.sentiment_badge === 'object' ? selectedKpi.sentiment_badge.text : selectedKpi.sentiment_badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-airtable-ink">{selectedKpi.name}</h3>
                  <p className="text-xs text-airtable-muted mt-0.5 font-mono">{selectedKpi.trigger_condition}</p>
                </div>
                <button
                  onClick={() => setSelectedKpi(null)}
                  className="btn-secondary p-1.5"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Top Key Metrics Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-lg bg-airtable-surface-soft border border-airtable-hairline text-xs">
                <div>
                  <span className="text-[10px] text-airtable-muted uppercase tracking-wider block">Current Reading</span>
                  <span className={`text-base font-bold font-mono ${isBreach ? 'text-airtable-coral' : isWarning ? 'text-amber-700' : 'text-airtable-forest'}`}>
                    {axisConfig.format(selectedKpi.value)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-airtable-muted uppercase tracking-wider block">Alarm Trigger</span>
                  <span className="text-base font-semibold font-mono text-airtable-ink">
                    {axisConfig.format(selectedKpi.trigger_value)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-airtable-muted uppercase tracking-wider block">Target Standard</span>
                  <span className="text-xs font-semibold text-emerald-700 leading-snug block">
                    {selectedKpi.target}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-airtable-muted uppercase tracking-wider block">Approval Authority</span>
                  <span className="text-xs font-semibold font-mono text-airtable-ink uppercase">
                    {selectedKpi.approval_tier?.replace('_', ' ') || 'Planner'}
                  </span>
                </div>
              </div>

              {/* Chart with Explicit X-Axis & Y-Axis Labels */}
              <div className="rounded-lg border border-airtable-hairline bg-white p-3 space-y-1">
                <div className="flex items-center justify-between text-xs pb-1">
                  <span className="font-semibold text-airtable-ink text-[11px] uppercase tracking-wider">
                    30-Day Evaluated Trajectory vs. Trigger Corridor
                  </span>
                  <span className="text-[10px] font-mono text-airtable-muted">
                    Y-Axis: {axisConfig.yLabel}
                  </span>
                </div>

                <div className="w-full">
                  <MatplotlibChart
                    graphId="dashboard_kpi_trend"
                    params={{ kpi_code: selectedKpi.kpi_code }}
                    title={`${selectedKpi.kpi_code}: 30-Day Evaluated Trajectory`}
                    subtitle={`Target: ${selectedKpi.target_value != null ? axisConfig.format(selectedKpi.target_value) : (selectedKpi.target || 'None')} | Alert Trigger: ${axisConfig.format(selectedKpi.trigger_value)}`}
                    height="h-64"
                  />
                </div>
              </div>

              {/* Structured Operational & Financial Insight Panel */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900 uppercase text-[10px] tracking-wider">
                  <span>Continuous Telemetry Diagnostic & Action Directive</span>
                </div>

                <div className="space-y-1.5 leading-relaxed text-slate-800">
                  <div className="flex items-start gap-1.5">
                    <span className="font-semibold text-slate-900 shrink-0">Observed Trend:</span>
                    <span>{insight.trend}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="font-semibold text-rose-800 shrink-0">Case Root Cause:</span>
                    <span className="text-slate-700">{insight.rootCause}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="font-semibold text-emerald-800 shrink-0">Recommended Action:</span>
                    <span className="text-emerald-950 font-medium">{insight.action}</span>
                  </div>
                </div>
              </div>

              {/* Case Baseline vs Target footer */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg text-xs bg-airtable-surface-soft border border-airtable-hairline">
                <div>
                  <span className="text-airtable-muted block text-[10px] uppercase font-mono">Last Summer Actual Failure</span>
                  <span className="text-airtable-ink font-mono font-medium">{selectedKpi.baseline}</span>
                </div>
                <div>
                  <span className="text-airtable-muted block text-[10px] uppercase font-mono">Agent Performance Target</span>
                  <span className="text-airtable-ink font-mono font-medium">{selectedKpi.target}</span>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => setSelectedKpi(null)}
                  className="btn-secondary text-xs px-4 py-1.5"
                >
                  Close Drilldown
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Section 16.3 Monte Carlo Stress Test Modal ── */}
      <MonteCarloModal
        isOpen={showMonteCarlo}
        onClose={() => setShowMonteCarlo(false)}
      />
    </div>
  );
}
