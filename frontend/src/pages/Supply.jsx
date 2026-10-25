import React, { useState, useEffect } from 'react';
import {
  Factory,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  Clock,
  Layers,
  Search,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Truck,
  Droplet,
  Percent,
  FlaskConical,
} from 'lucide-react';
import { fetchModuleSupply } from '../lib/api';
import MatplotlibChart from '../components/MatplotlibChart';
import DMAICPanel from '../components/DMAICPanel';

const COST_BREAKDOWN = [
  { name: 'Puree & Ingredients', value: 17.14, color: '#f97316' },
  { name: 'Glass Bottles & Crown Caps', value: 9.79, color: '#0ea5e9' },
  { name: 'Co-Packer Bottling Fee', value: 7.34, color: '#10b981' },
  { name: 'Cold Storage (-18C)', value: 4.08, color: '#8b5cf6' },
  { name: 'Inbound Farm Freight', value: 2.45, color: '#64748b' },
];

// ── Gantt-style critical path data (days 1–120, 5 ingredients) ───────────────
const GANTT_DATA = [
  {
    ingredient: 'Mango Pulp',
    stockDays: 62,
    leadDays: 18,
    isCritical: false,
  },
  {
    ingredient: 'Peach Pulp',
    stockDays: 45,
    leadDays: 21,
    isCritical: false,
  },
  {
    ingredient: 'Guava Pulp',
    stockDays: 38,
    leadDays: 25,
    isCritical: false,
  },
  {
    ingredient: 'Passionfruit Pulp',
    stockDays: 12,
    leadDays: 45,
    isCritical: true,
  },
  {
    ingredient: 'Dragonfruit Pulp',
    stockDays: 28,
    leadDays: 30,
    isCritical: false,
  },
];

// ── Co-Packer Utilization Scatter (12 data points, one per week) ─────────────
const COPACKER_SCATTER = [
  { week: 'W1', cost: 38.2, utilization: 74, volume: 42000, month: 'March' },
  { week: 'W2', cost: 38.6, utilization: 81, volume: 48000, month: 'March' },
  { week: 'W3', cost: 39.1, utilization: 86, volume: 52000, month: 'March' },
  { week: 'W4', cost: 39.4, utilization: 88, volume: 55000, month: 'March' },
  { week: 'W5', cost: 39.8, utilization: 91, volume: 58000, month: 'April' },
  { week: 'W6', cost: 40.2, utilization: 95, volume: 62000, month: 'April' },
  { week: 'W7', cost: 40.9, utilization: 98, volume: 64000, month: 'April' },
  { week: 'W8', cost: 41.4, utilization: 102, volume: 60000, month: 'April' },
  { week: 'W9', cost: 41.8, utilization: 99, volume: 57000, month: 'May' },
  { week: 'W10', cost: 41.2, utilization: 94, volume: 54000, month: 'May' },
  { week: 'W11', cost: 40.4, utilization: 88, volume: 51000, month: 'May' },
  { week: 'W12', cost: 39.7, utilization: 82, volume: 49000, month: 'June' },
];

const MONTH_COLORS = { March: '#2563eb', April: '#f97316', May: '#aa2d00', June: '#1a6641' };

// ── Supplier Risk Dual-Axis data ─────────────────────────────────────────────
const SUPPLIER_DUAL = [
  { supplier: 'Konkan Coop', sla: 97, cost: 42.5, singleSource: false },
  { supplier: 'Sahyadri Farm', sla: 94, cost: 45.2, singleSource: false },
  { supplier: 'Thai Exports', sla: 88, cost: 68.1, singleSource: true },
  { supplier: 'Nashik Agri', sla: 92, cost: 41.8, singleSource: false },
  { supplier: 'Kerala Coop', sla: 85, cost: 52.4, singleSource: true },
  { supplier: 'Pune Farms', sla: 96, cost: 40.2, singleSource: false },
  { supplier: 'Vietnam Fresh', sla: 79, cost: 72.3, singleSource: true },
  { supplier: 'Ratnagiri Co.', sla: 91, cost: 43.7, singleSource: false },
];

export default function Supply() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [dmaicOpen, setDmaicOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await fetchModuleSupply();
      setData(res);
    } catch (err) {
      console.error('Failed to load supply module data', err);
      setLoadError(err.message || 'Failed to connect to backend API server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex flex-col h-96 items-center justify-center gap-3 text-sm text-airtable-muted">
        <RefreshCw className="w-6 h-6 animate-spin text-airtable-ink" />
        <span className="font-medium text-airtable-ink">Loading Supply & Co-Packer Operations Module...</span>
        <span className="text-xs text-airtable-muted">Syncing purees, co-packer notices, and tank schedules...</span>
      </div>
    );
  }

  if (loadError && !data) {
    return (
      <div className="p-8 max-w-xl mx-auto mt-12 rounded-xl border border-rose-200 bg-rose-50/50 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-airtable-ink">Unable to Load Supply Module</h3>
          <p className="text-xs text-airtable-muted mt-1 leading-relaxed">
            {loadError}. Make sure the FastAPI backend server is running on <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">http://127.0.0.1:8000</code>.
          </p>
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-airtable-ink text-white text-xs font-semibold hover:bg-airtable-ink/90 transition-colors shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Connection
        </button>
      </div>
    );
  }

  if (!data) return null;

  // Filter suppliers
  const filteredSuppliers = data.suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      s.ingredient.toLowerCase().includes(supplierSearch.toLowerCase())
  );

  // Chart data from production runs
  const runChartData = data.production_runs.slice(0, 10).map((r) => ({
    date: r.date.slice(5),
    bottles: r.bottles_produced,
    utilization: r.plant_utilization_pct,
    facility: r.facility.split(' ')[0],
  })).reverse();

  return (
    <div className="p-5 sm:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* ── DMAIC Analysis Action Bar ────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-airtable-ink">Supply Module</h2>
          <p className="text-xs text-airtable-muted mt-0.5">Co-packers · Puree buffers · Production capacity</p>
        </div>
        <button
          onClick={() => setDmaicOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md bg-airtable-ink text-white hover:bg-airtable-ink/90 transition-colors shadow-xs"
        >
          <FlaskConical className="w-3.5 h-3.5" />
          Run DMAIC Analysis
        </button>
      </div>

      {dmaicOpen && (
        <DMAICPanel
          moduleName="Supply"
          companyId="pulp_riot_supply"
          onClose={() => setDmaicOpen(false)}
        />
      )}

      {/* ── Top Hero Telemetry Strip ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg p-5 bg-white border border-airtable-hairline shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-airtable-muted">Plant Utilization (C1)</span>
            <Factory className="w-4 h-4 text-airtable-ink" />
          </div>
          <div className="text-[28px] font-medium font-mono text-airtable-ink leading-none">
            {data.summary.plant_utilization_pct}%
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1.5 flex items-center gap-1">
            <span>Optimal range (85-90%)</span>
          </div>
        </div>

        <div className="rounded-lg p-5 bg-white border border-airtable-hairline shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-airtable-muted">Frozen Pulp Cover (C3)</span>
            <Droplet className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-[28px] font-medium font-mono text-airtable-forest leading-none">
            {data.summary.frozen_pulp_cover_days}d
          </div>
          <div className="text-[11px] text-airtable-muted mt-1.5">
            Floor: 25.0 days · -18C aseptic storage
          </div>
        </div>

        <div className="rounded-lg p-5 bg-white border border-amber-300 ring-2 ring-amber-300/25 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-airtable-muted">Single Source Risk (C4)</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-[28px] font-medium font-mono text-[#854d0e] leading-none">
            {data.summary.single_source_risk_pct}%
          </div>
          <div className="text-[11px] text-[#854d0e] font-medium mt-1.5">
            Alphonso Mango exposure (target &lt;50%)
          </div>
        </div>

        <div className="rounded-lg p-5 bg-white border border-airtable-hairline shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-airtable-muted">Landed Cost / Bottle (C5)</span>
            <DollarSign className="w-4 h-4 text-airtable-ink" />
          </div>
          <div className="text-[28px] font-medium font-mono text-airtable-ink leading-none">
            ₹{data.summary.avg_landed_cost_bottle.toFixed(2)}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1.5">
            Gross Margin target maintained
          </div>
        </div>
      </div>

      {/* ── Section 1: Bottling Output & Co-Packer Utilization Chart ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-airtable-hairline">
          <div>
            <span className="section-label">Co-Packer Bottling Network</span>
            <h2 className="text-lg font-medium text-airtable-ink mt-0.5">
              Co-Packer Production Runs & Daily Bottling Throughput
            </h2>
          </div>
          <span className="text-xs font-mono text-airtable-muted">
            3 Facilities Active · Nashik, Baramati, Pune
          </span>
        </div>

        <div className="w-full">
          <MatplotlibChart
            graphId="supply_copacker_utilization"
            title="Co-Packer Production Runs & Daily Bottling Throughput"
            subtitle="Bottles Produced vs Plant Utilization % Ceiling"
            height="h-64"
          />
        </div>
      </div>

      {/* ── Section 2: Frozen Pulp Inventory & Landed Cost Breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Frozen Pulp Strategic Reserves (-18C) */}
        <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="section-label">Strategic Puree Reserves</span>
              <h3 className="text-base font-medium text-airtable-ink">
                Frozen Fruit Pulp Buffer Tracking (C3 / C6)
              </h3>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              -18°C Cold Stores
            </span>
          </div>

          <div className="space-y-3">
            {data.pulp_inventory.map((pi) => {
              const pctOfFloor = Math.min(100, Math.round((pi.cover_days / pi.safety_target_days) * 100));
              const isLow = pi.cover_days < 25;
              return (
                <div key={pi.id} className="p-3.5 rounded-lg border border-airtable-hairline bg-airtable-surface-soft space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs text-airtable-ink">{pi.ingredient}</span>
                    <span className={`font-mono text-xs font-semibold ${isLow ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {pi.cover_days} days cover
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${isLow ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${pctOfFloor}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-airtable-muted font-mono">
                    <span>Floor: {pi.safety_target_days}d</span>
                    <span>Updated: {pi.last_updated}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Landed Cost Waterfall / Distribution */}
        <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="section-label">Cost Optimization</span>
              <h3 className="text-base font-medium text-airtable-ink">
                Landed Unit Cost Breakdown (C5: ₹40.80)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-airtable-muted">
              Target Margin: 32%
            </span>
          </div>

          <div className="w-full">
            <MatplotlibChart
              graphId="supply_copacker_share"
              title="Production Bottling Allocation Share"
              subtitle="Nashik Main Plant vs Pune & Bengaluru Co-Packers vs Cold Buffer"
              height="h-80"
            />
          </div>
          <p className="text-[11px] text-airtable-muted leading-relaxed">
            Direct ingredient contracts locked with Konkan & Sahyadri cooperatives buffer against spot raw mango price inflation.
          </p>
        </div>
      </div>

      {/* ── Section 3: Live Blending Pipeline & Active Batches ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="section-label">Shopfloor Operations</span>
            <h3 className="text-base font-medium text-airtable-ink">
              Live Blending Tanks & Manufacturing Pipeline
            </h3>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
            Nashik Central Plant
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.blending_schedule.map((tank) => (
            <div key={tank.tank_id} className="p-4 rounded-lg border border-airtable-hairline bg-airtable-surface-soft space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-airtable-ink">{tank.tank_id}</span>
                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {tank.qa_status}
                </span>
              </div>
              <div>
                <div className="font-semibold text-xs text-airtable-ink">{tank.flavor}</div>
                <div className="text-[11px] text-airtable-muted mt-0.5">{tank.stage}</div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-airtable-muted">
                  <span>Batch Volume: {tank.volume_liters.toLocaleString()} L</span>
                  <span>{tank.completion_pct}%</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-orange-500 h-full rounded-full" style={{ width: `${tank.completion_pct}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 4: Raw Material Supplier Matrix (C2 / C4) ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="section-label">Vendor Performance</span>
            <h3 className="text-base font-medium text-airtable-ink">
              Supplier Risk & Lead Time Compliance Matrix (C2 / C4)
            </h3>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-airtable-muted" />
            <input
              type="text"
              placeholder="Search vendor or ingredient..."
              value={supplierSearch}
              onChange={(e) => setSupplierSearch(e.target.value)}
              className="input-base pl-8 py-1.5 text-xs w-full"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-airtable-hairline rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-airtable-surface-soft border-b border-airtable-hairline font-mono text-[11px] text-airtable-muted uppercase">
              <tr>
                <th className="px-4 py-2.5">Supplier Name</th>
                <th className="px-4 py-2.5">Ingredient Puree</th>
                <th className="px-4 py-2.5">Lead Time</th>
                <th className="px-4 py-2.5">SLA Compliance (C2)</th>
                <th className="px-4 py-2.5">Risk-Adjusted Cost</th>
                <th className="px-4 py-2.5">Sourcing Risk (C4)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-airtable-hairline">
              {filteredSuppliers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-medium text-airtable-ink">{s.name}</td>
                  <td className="px-4 py-3 text-airtable-body">{s.ingredient}</td>
                  <td className="px-4 py-3 font-mono text-airtable-ink">{s.lead_time_days} days</td>
                  <td className="px-4 py-3 font-mono font-medium text-emerald-700">
                    {s.lead_time_compliance_pct}%
                  </td>
                  <td className="px-4 py-3 font-mono text-airtable-ink">
                    ₹{s.risk_adjusted_cost_per_kg}/kg
                  </td>
                  <td className="px-4 py-3">
                    {s.single_source ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Single Source Exposure
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle className="w-2.5 h-2.5" />
                        Multi-Source Redundant
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 5: Relevant Supply Domain KPIs (C1 - C6) ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-airtable-ink" />
          <h3 className="text-base font-medium text-airtable-ink">
            Supply Domain Continuous Telemetry (C1 through C6)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.kpis.map((kpi) => (
            <div
              key={kpi.kpi_code}
              className="p-3.5 rounded-lg border border-airtable-hairline bg-airtable-surface-soft hover:bg-white hover:border-airtable-border-strong transition-all"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-mono text-[11px] font-medium px-1.5 py-0.2 rounded bg-white text-airtable-ink border border-airtable-hairline">
                  {kpi.kpi_code}
                </span>
                <span className="text-[10px] font-mono uppercase text-airtable-muted">
                  Tier: {kpi.approval_tier}
                </span>
              </div>
              <div className="font-medium text-xs text-airtable-ink line-clamp-1 mb-1">
                {kpi.name}
              </div>
              <p className="text-[11px] text-airtable-body line-clamp-2 leading-snug">
                {kpi.caption}
              </p>
              <div className="mt-2 text-[10px] font-mono text-airtable-muted border-t border-airtable-hairline/60 pt-1.5">
                Target: <span className="text-airtable-ink">{kpi.target}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          NEW SECTION A: Ingredient Cover vs Lead Time — Gantt-style
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4">
        <div>
          <span className="section-label">Critical Path Analysis</span>
          <h3 className="text-base font-medium text-airtable-ink mt-0.5">
            Ingredient Cover vs Lead Time: Critical Path for Peak Summer
          </h3>
        </div>

        <div className="w-full">
          <MatplotlibChart
            graphId="supply_lead_times"
            title="Raw Material Lead Times & Buffer Cover"
            subtitle="Postponement Analysis: Replenishment Lead Time vs Buffer Ceiling"
            height="h-72"
          />
        </div>
        <p className="text-[11px] text-airtable-muted leading-relaxed">
          Passionfruit Pulp (highlighted red) had only 12 days of stock cover when the Nashik–Pune highway closed on Day 14, but required 45 days lead time to restock via alternative supplier routes. This 33-day gap is the critical path that triggered emergency air freight procurement at ₹3.2Cr premium.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          NEW SECTION B: Co-Packer Utilization vs Cost Efficiency Scatter
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4">
        <div>
          <span className="section-label">Capacity Optimization</span>
          <h3 className="text-base font-medium text-airtable-ink mt-0.5">
            Co-Packer Utilization vs. Cost Efficiency Scatter (Summer 2025)
          </h3>
        </div>

        {/* Quadrant labels + chart */}
        <div className="relative">
          <div className="w-full">
            <MatplotlibChart
              graphId="supply_risk_matrix"
              title="Co-Packer Utilization vs Cost Efficiency Matrix"
              subtitle="Vendor Risk Matrix & Capacity Frontier"
              height="h-72"
            />
          </div>
          {/* Quadrant labels overlay */}
          <div className="absolute top-4 left-14 text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 opacity-80">
            Sweet Spot
          </div>
          <div className="absolute top-4 right-8 text-[9px] font-mono text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 opacity-80">
            Cost Inefficient
          </div>
          <div className="absolute bottom-8 left-14 text-[9px] font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 opacity-80">
            Under-utilized
          </div>
          <div className="absolute bottom-8 right-8 text-[9px] font-mono text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 opacity-80">
            Over-stretched
          </div>
        </div>

        {/* Month legend */}
        <div className="flex items-center gap-4 flex-wrap">
          {Object.entries(MONTH_COLORS).map(([month, color]) => (
            <div key={month} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[11px] text-airtable-muted">{month}</span>
            </div>
          ))}
          <span className="text-[10px] text-airtable-muted ml-2">(bubble size = volume produced)</span>
        </div>
        <p className="text-[11px] text-airtable-muted leading-relaxed">
          Weeks 7–8 (April peak) pushed into the Over-stretched quadrant: utilization exceeded 95% capacity at ₹41.4/bottle — 3.5% above the efficient frontier. The model-recommended pre-build strategy would have flattened the curve to keep all weeks in the Sweet Spot zone.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          NEW SECTION C: Supplier Risk Dual-Axis Chart
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4">
        <div>
          <span className="section-label">Vendor Risk Intelligence</span>
          <h3 className="text-base font-medium text-airtable-ink mt-0.5">
            Supplier SLA Compliance vs Risk-Adjusted Cost Dual-Axis
          </h3>
        </div>

        <div className="w-full">
          <MatplotlibChart
            graphId="supply_dual_axis"
            title="Supplier SLA Compliance vs Risk-Adjusted Cost Dual-Axis"
            subtitle="SLA Compliance % vs Raw Material Cost per kg"
            height="h-72"
          />
        </div>

        <div className="flex items-center gap-4 flex-wrap text-[11px]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-rose-700" />
            <span className="text-airtable-muted">Red bars = Single-source exposure</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#1a6641]" />
            <span className="text-airtable-muted">Green = SLA ≥95% multi-source</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-slate-400" />
            <span className="text-airtable-muted">Grey = SLA &lt;95% but multi-source</span>
          </div>
        </div>
        <p className="text-[11px] text-airtable-muted leading-relaxed">
          Three single-source suppliers (Thai Exports, Kerala Coop, Vietnam Fresh) compound supply risk: their SLA averages 84% against a 95% target, while their risk-adjusted costs run 58–80% higher than cooperative alternatives. Dual-sourcing these three would reduce C4 single-source risk from 65% to &lt;30%.
        </p>
      </div>
    </div>
  );
}
