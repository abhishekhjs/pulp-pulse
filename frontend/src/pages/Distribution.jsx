import React, { useState, useEffect } from 'react';
import {
  Share2,
  ArrowRightLeft,
  Truck,
  Building,
  CheckCircle,
  AlertTriangle,
  Layers,
  Search,
  RefreshCw,
  Plus,
  Send,
  PieChart as PieIcon,
  ShoppingBag,
  X,
  FlaskConical,
  Compass,
} from 'lucide-react';
import { fetchModuleDistribution, createTransfer } from '../lib/api';
import MatplotlibChart from '../components/MatplotlibChart';
import DMAICPanel from '../components/DMAICPanel';
import DepotDemandRedistribution from '../components/DepotDemandRedistribution';

// ── Static data for new visualizations ────────────────────────────────────────

// B) Channel Fill Rate Trend — 8 weeks, 3 channels + target
const FILL_RATE_DATA = [
  { week: 'Wk1', QC: 96, MT: 97, GT: 95 },
  { week: 'Wk2', QC: 88, MT: 94, GT: 94 },
  { week: 'Wk3', QC: 74, MT: 91, GT: 93 },
  { week: 'Wk4', QC: 71, MT: 88, GT: 92 },
  { week: 'Wk5', QC: 84, MT: 93, GT: 94 },
  { week: 'Wk6', QC: 92, MT: 96, GT: 96 },
  { week: 'Wk7', QC: 95, MT: 97, GT: 97 },
  { week: 'Wk8', QC: 97, MT: 98, GT: 96 },
];

// C) Regional Supply-Demand Gap Bubble Chart
const REGIONAL_BUBBLE = [
  { region: 'North', demand: 42000, cover: 11, risk: 6, color: '#d97706' },
  { region: 'West',  demand: 58000, cover: 9,  risk: 9, color: '#aa2d00' },
  { region: 'South', demand: 51000, cover: 7,  risk: 10, color: '#aa2d00' },
  { region: 'East',  demand: 29000, cover: 16, risk: 2, color: '#1a6641' },
];

const AVG_DEMAND = REGIONAL_BUBBLE.reduce((s, d) => s + d.demand, 0) / REGIONAL_BUBBLE.length;

// CSS animation style for SVG arrows
const svgArrowStyle = `
  @keyframes dashFlow {
    to { stroke-dashoffset: -20; }
  }
  .flow-arrow {
    stroke-dasharray: 10 5;
    animation: dashFlow 1.2s linear infinite;
  }
`;

export default function Distribution() {
  const [mainView, setMainView] = useState('optimizer'); // 'optimizer' | 'network'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [transferSearch, setTransferSearch] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [dmaicOpen, setDmaicOpen] = useState(false);

  // New transfer form state
  const [originDepotId, setOriginDepotId] = useState(1);
  const [destDepotId, setDestDepotId] = useState(3);
  const [transferQty, setTransferQty] = useState(350);
  const [transferFlavorId, setTransferFlavorId] = useState(1);
  const [submittingTransfer, setSubmittingTransfer] = useState(false);
  const [transferSuccessMsg, setTransferSuccessMsg] = useState(null);
  const [svgTooltip, setSvgTooltip] = useState(null);
  const [bubbleTooltip, setBubbleTooltip] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await fetchModuleDistribution();
      setData(res);
    } catch (err) {
      console.error('Failed to load distribution module data', err);
      setLoadError(err.message || 'Failed to connect to backend API server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateTransfer = async (e) => {
    e.preventDefault();
    if (originDepotId === destDepotId) {
      alert('Origin and destination depots must be different');
      return;
    }
    setSubmittingTransfer(true);
    try {
      await createTransfer({
        from_depot_id: originDepotId,
        to_depot_id: destDepotId,
        quantity: transferQty,
        flavor_id: transferFlavorId,
      });
      setTransferSuccessMsg(`Transfer dispatched: ${transferQty} bottles en route.`);
      setShowTransferModal(false);
      loadData();
    } catch (err) {
      console.error('Failed to create transfer', err);
    } finally {
      setSubmittingTransfer(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col h-96 items-center justify-center gap-3 text-sm text-airtable-muted">
        <RefreshCw className="w-6 h-6 animate-spin text-airtable-ink" />
        <span className="font-medium text-airtable-ink">Loading Multi-Channel Distribution & Allocation Module...</span>
        <span className="text-xs text-airtable-muted">Analyzing depot balance, transfer recommendations, and fulfillment...</span>
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
          <h3 className="text-base font-semibold text-airtable-ink">Unable to Load Distribution Module</h3>
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

  const filteredTransfers = data.transfers.filter(
    (t) =>
      t.origin_name.toLowerCase().includes(transferSearch.toLowerCase()) ||
      t.destination_name.toLowerCase().includes(transferSearch.toLowerCase()) ||
      t.flavor_name.toLowerCase().includes(transferSearch.toLowerCase())
  );

  return (
    <div className="p-5 sm:p-8 space-y-6 max-w-[1600px] mx-auto">
      <style>{svgArrowStyle}</style>

      {/* ── DMAIC Analysis Action Bar ────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-airtable-ink">Distribution Module</h2>
          <p className="text-xs text-airtable-muted mt-0.5">Depot balance · Channel allocation · Inter-depot transfers</p>
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
          moduleName="Distribution"
          companyId="pulp_riot_distribution"
          onClose={() => setDmaicOpen(false)}
        />
      )}

      {/* ── Main View Switcher ─────────────────────────────────────── */}
      <div className="flex border-b border-airtable-hairline">
        <button
          onClick={() => setMainView('optimizer')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
            mainView === 'optimizer'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-airtable-muted hover:text-airtable-ink'
          }`}
        >
          <Compass className="w-4 h-4 text-indigo-600" />
          <span>Surplus-to-Deficit Redistribution & Demand Forecasting</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-50 text-indigo-700 font-mono">
            ₹1.50 Arbitrage
          </span>
        </button>

        <button
          onClick={() => setMainView('network')}
          className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
            mainView === 'network'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-airtable-muted hover:text-airtable-ink'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Regional Network Stock & Capacity</span>
        </button>
      </div>

      {mainView === 'optimizer' ? (
        <DepotDemandRedistribution />
      ) : (
        <>
          {/* ── Top Hero Telemetry Strip ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg p-5 bg-white border border-airtable-hairline shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-airtable-muted">Depot Stock Imbalance (E1)</span>
            <Share2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-[28px] font-medium font-mono text-airtable-forest leading-none">
            {data.summary.stock_imbalance_index_pct}%
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1.5 flex items-center gap-1">
            <span>Balanced across 4 zones (&lt;20% target)</span>
          </div>
        </div>

        <div className="rounded-lg p-5 bg-white border border-airtable-hairline shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-airtable-muted">Fair Share Fulfillment (E4)</span>
            <Building className="w-4 h-4 text-airtable-ink" />
          </div>
          <div className="text-[28px] font-medium font-mono text-airtable-ink leading-none">
            {data.summary.fair_share_fulfillment_pct}%
          </div>
          <div className="text-[11px] text-airtable-muted mt-1.5">
            Prevents A5 competitive shelf loss
          </div>
        </div>

        <div className="rounded-lg p-5 bg-white border border-airtable-hairline shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-airtable-muted">Transfer Utilization (E2)</span>
            <ArrowRightLeft className="w-4 h-4 text-airtable-ink" />
          </div>
          <div className="text-[28px] font-medium font-mono text-airtable-ink leading-none">
            {data.summary.transfer_utilization_pct}%
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1.5">
            Proactive freshness preservation active
          </div>
        </div>

        <div className="rounded-lg p-5 bg-white border border-airtable-hairline shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-airtable-muted">Active Inter-Depot Transfers</span>
            <Truck className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-[28px] font-medium font-mono text-orange-600 leading-none">
            {data.summary.active_transfers_count}
          </div>
          <div className="text-[11px] text-airtable-muted mt-1.5">
            In-transit between regional hubs
          </div>
        </div>
      </div>

      {transferSuccessMsg && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{transferSuccessMsg}</span>
          </div>
          <button onClick={() => setTransferSuccessMsg(null)} className="text-emerald-700 font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Section 1: Regional Depot Network Stock Balance (E1) ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-airtable-hairline">
          <div>
            <span className="section-label">Regional Balance</span>
            <h2 className="text-lg font-medium text-airtable-ink mt-0.5">
              Regional Depot Stock Balance & Capacity Distribution (E1)
            </h2>
            <p className="text-xs text-airtable-muted mt-0.5">
              Continuous monitoring of stock cover to prevent local stockouts while balancing regional demand.
            </p>
          </div>

          <button
            onClick={() => setShowTransferModal(true)}
            className="btn-primary"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Initiate Inter-Depot Transfer</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {data.regions.map((reg) => (
            <div key={reg.region} className="p-4 rounded-lg border border-airtable-hairline bg-airtable-surface-soft space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-airtable-ink">{reg.region} Region</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                  reg.status === 'deficit' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  reg.status === 'surplus' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                  'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  {reg.status.toUpperCase()}
                </span>
              </div>

              <div>
                <div className="text-[22px] font-medium font-mono text-airtable-ink leading-tight">
                  {reg.total_stock.toLocaleString()}
                </div>
                <div className="text-[11px] text-airtable-muted">
                  Capacity: {reg.capacity.toLocaleString()} bottles ({reg.utilization_pct}%)
                </div>
              </div>

              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    reg.status === 'deficit' ? 'bg-amber-500' :
                    reg.status === 'surplus' ? 'bg-blue-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, reg.utilization_pct)}%` }}
                />
              </div>

              <div className="pt-2 border-t border-airtable-hairline/60 space-y-1">
                {reg.depots.map((d) => (
                  <div key={d.id} className="flex justify-between text-[11px]">
                    <span className="text-airtable-body truncate">{d.name.replace('Depot ', '')}</span>
                    <span className="font-mono text-airtable-ink">{d.stock.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 2: Channel Allocation & Fair-Share Fulfillment (E4) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Fair Share Breakdown */}
        <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="section-label">Multi-Channel Fairness</span>
              <h3 className="text-base font-medium text-airtable-ink">
                Channel Fair Share Allocation vs Target (E4)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-airtable-muted">
              Demand Momentum Aligned
            </span>
          </div>

          <div className="space-y-3">
            {data.channel_allocation.map((ch) => (
              <div key={ch.channel} className="p-3.5 rounded-lg border border-airtable-hairline bg-airtable-surface-soft space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-airtable-muted" />
                    <span className="font-semibold text-airtable-ink">{ch.channel}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-airtable-muted">Target: {ch.target_share_pct}%</span>
                    <span className="font-medium text-airtable-ink">Actual: {ch.actual_share_pct}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-airtable-muted">Order Fulfillment Ratio:</span>
                  <span className="font-mono font-semibold text-emerald-700">{ch.fulfillment_rate}% OTIF</span>
                </div>

                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${ch.fulfillment_rate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Allocation Policy & SKU Weighting (E3) */}
        <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="section-label">Demand Sensing Integration</span>
              <h3 className="text-base font-medium text-airtable-ink">
                Dynamic SKU Allocation Policy (E3)
              </h3>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700">
              Momentum Driven
            </span>
          </div>
          <p className="text-xs text-airtable-muted leading-relaxed">
            When Quick Commerce velocity deviates by &gt;15% (B3), the system dynamically increases Dark Store replenishment weighting to capture impulse purchases without robbing Modern Trade contract volumes.
          </p>

          <div className="p-3.5 rounded-lg border border-orange-200 bg-orange-50/50 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-orange-950">
              <span>Quick Commerce Allocation Priority Active</span>
              <span className="font-mono text-orange-800">+18% Allocation Boost</span>
            </div>
            <p className="text-[11px] text-orange-900 leading-snug">
              Mango Peach Basil & Guava Chilli prioritized for Depot S1 (Bengaluru) and Depot W1 (Mumbai) Blinkit/Zepto hubs.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-airtable-hairline bg-slate-50 space-y-1.5 text-xs">
            <div className="font-semibold text-airtable-ink">A5 Competitive Shelf Loss Mitigation:</div>
            <p className="text-[11px] text-airtable-body">
              Modern Trade accounts have hard SLA commitments. Zero stockouts allowed exceeding 48 hours to preserve end-cap retail positioning against competing beverage brands.
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 3: Inter-Depot Rebalancing Transfer Ledger ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="section-label">Freshness Preservation</span>
            <h3 className="text-base font-medium text-airtable-ink">
              Inter-Depot Rebalancing Transfer Ledger (E2)
            </h3>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-airtable-muted" />
            <input
              type="text"
              placeholder="Filter by origin or destination..."
              value={transferSearch}
              onChange={(e) => setTransferSearch(e.target.value)}
              className="input-base pl-8 py-1.5 text-xs w-full"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-airtable-hairline rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-airtable-surface-soft border-b border-airtable-hairline font-mono text-[11px] text-airtable-muted uppercase">
              <tr>
                <th className="px-4 py-2.5">Transfer ID</th>
                <th className="px-4 py-2.5">Origin Depot</th>
                <th className="px-4 py-2.5">Destination Depot</th>
                <th className="px-4 py-2.5">Flavor SKU</th>
                <th className="px-4 py-2.5">Quantity</th>
                <th className="px-4 py-2.5">Freshness Benefit</th>
                <th className="px-4 py-2.5">Transfer Cost</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-airtable-hairline">
              {filteredTransfers.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-airtable-ink">
                    TR-{String(t.id).padStart(4, '0')}
                  </td>
                  <td className="px-4 py-3 text-airtable-body">{t.origin_name}</td>
                  <td className="px-4 py-3 text-airtable-body">{t.destination_name}</td>
                  <td className="px-4 py-3 font-medium text-airtable-ink">{t.flavor_name}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-airtable-ink">{t.quantity} btls</td>
                  <td className="px-4 py-3 font-mono text-emerald-700 font-medium">
                    {t.preservation_benefit}
                  </td>
                  <td className="px-4 py-3 font-mono text-airtable-ink">
                    ₹{t.cost_inr.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                      <CheckCircle className="w-2.5 h-2.5" />
                      {t.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 4: Relevant Distribution Domain KPIs (E1 - E4, A5) ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-airtable-ink" />
          <h3 className="text-base font-medium text-airtable-ink">
            Distribution & Multi-Channel Telemetry (E1-E4, A5)
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
          NEW SECTION A: Depot Stock Imbalance Flow Diagram — SVG
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4">
        <div>
          <span className="section-label">Inter-Zone Flow Network</span>
          <h3 className="text-base font-medium text-airtable-ink mt-0.5">
            Live Inter-Depot Stock Flow Network (4 Zones)
          </h3>
        </div>

        <div className="w-full">
          <MatplotlibChart
            graphId="distribution_network"
            title="Inter-Depot Rebalancing Network"
            subtitle="Proactive Rebalancing: 25,000 Bottles Routed to South Deficit Depot"
            height="h-80"
          />
        </div>

        <p className="text-[11px] text-airtable-muted leading-relaxed">
          The South zone (22,000 btls) is in critical deficit during peak summer — 45% below required cover. North is proactively rebalancing 12,000 bottles southward (green arrows), while East is pulling stock from its balanced reserves to patch the gap. West contributes 8,000 bottles via the Pune–Bengaluru corridor. Total inter-depot flow: 25,000 bottles at ₹4.2L logistics cost.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          NEW SECTION B: Channel Fill Rate Trend — ComposedChart
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4">
        <div>
          <span className="section-label">Fill Rate Analytics</span>
          <h3 className="text-base font-medium text-airtable-ink mt-0.5">
            Multi-Channel Order Fulfillment Rate Trend (with Viral Spike)
          </h3>
        </div>

        <div className="w-full">
          <MatplotlibChart
            graphId="distribution_fill_rate"
            title="Multi-Channel Order Fulfillment Rate Trend"
            subtitle="QC vs Modern Trade vs General Trade SLA vs 95% Target"
            height="h-72"
          />
        </div>
        <p className="text-[11px] text-airtable-muted leading-relaxed">
          QC fill rates collapsed to 71% at the peak of the viral surge (Weeks 3–4) — 24 percentage points below the 95% SLA target. MT held above 88% due to pre-committed stock ring-fencing. With the agent layer, QC replenishment would have been triggered at Week 2 onset, maintaining fill rates above 90% throughout.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          NEW SECTION C: Regional Demand vs Supply Coverage Bubble Chart
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4">
        <div>
          <span className="section-label">Supply-Demand Gap Intelligence</span>
          <h3 className="text-base font-medium text-airtable-ink mt-0.5">
            Regional Supply-Demand Gap Analysis: Risk Positioning
          </h3>
        </div>

        <div className="relative">
          <div className="w-full">
            <MatplotlibChart
              graphId="distribution_gap_bubble"
              title="Regional Supply-Demand Gap Analysis"
              subtitle="Regional Demand vs Stock Cover Days (Bubble Size = Stockout Risk Score)"
              height="h-72"
            />
          </div>
        </div>

        {/* Risk legend */}
        <div className="flex items-center gap-4 flex-wrap text-[11px]">
          {[
            { color: '#aa2d00', label: 'Cover <10d — Critical Risk' },
            { color: '#d97706', label: 'Cover 10–14d — Amber Risk' },
            { color: '#1a6641', label: 'Cover >14d — Safe' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full opacity-70" style={{ backgroundColor: color }} />
              <span className="text-airtable-muted">{label}</span>
            </div>
          ))}
          <span className="text-[10px] text-airtable-muted">(bubble size = stockout risk score 1–10)</span>
        </div>
        <p className="text-[11px] text-airtable-muted leading-relaxed">
          South and West are double-jeopardy: high demand AND low stock cover puts them at maximum stockout risk (9–10/10). Both sit below the 10-day safety floor. East, with moderate demand and 16-day cover, is the only region in a safe position and can donate up to 8,000 bottles to the Southern deficit without breaching its own safety stock.
        </p>
      </div>

      {/* ── Transfer Dispatch Modal ── */}
      {showTransferModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
          onClick={() => setShowTransferModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-airtable-hairline animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-airtable-hairline">
              <div className="font-semibold text-sm text-airtable-ink">
                Initiate Inter-Depot Rebalancing
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-airtable-muted hover:text-airtable-ink p-1"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="text-[11px] font-mono text-airtable-muted block mb-1">Origin Depot (Source)</label>
                <select
                  value={originDepotId}
                  onChange={(e) => setOriginDepotId(Number(e.target.value))}
                  className="input-base w-full py-1.5"
                >
                  <option value={1}>Depot N1 (Delhi NCR)</option>
                  <option value={2}>Depot N2 (Chandigarh)</option>
                  <option value={3}>Depot W1 (Mumbai)</option>
                  <option value={4}>Depot W2 (Pune)</option>
                  <option value={5}>Depot W3 (Ahmedabad)</option>
                  <option value={6}>Depot S1 (Bengaluru)</option>
                  <option value={7}>Depot S2 (Chennai)</option>
                  <option value={8}>Depot S3 (Hyderabad)</option>
                  <option value={9}>Depot E1 (Kolkata)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-airtable-muted block mb-1">Destination Depot (Target)</label>
                <select
                  value={destDepotId}
                  onChange={(e) => setDestDepotId(Number(e.target.value))}
                  className="input-base w-full py-1.5"
                >
                  <option value={3}>Depot W1 (Mumbai)</option>
                  <option value={1}>Depot N1 (Delhi NCR)</option>
                  <option value={2}>Depot N2 (Chandigarh)</option>
                  <option value={4}>Depot W2 (Pune)</option>
                  <option value={5}>Depot W3 (Ahmedabad)</option>
                  <option value={6}>Depot S1 (Bengaluru)</option>
                  <option value={7}>Depot S2 (Chennai)</option>
                  <option value={8}>Depot S3 (Hyderabad)</option>
                  <option value={9}>Depot E1 (Kolkata)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-airtable-muted block mb-1">Flavor SKU</label>
                <select
                  value={transferFlavorId}
                  onChange={(e) => setTransferFlavorId(Number(e.target.value))}
                  className="input-base w-full py-1.5"
                >
                  <option value={1}>Mango Peach Basil</option>
                  <option value={2}>Guava Chilli</option>
                  <option value={3}>Passionfruit Punch</option>
                  <option value={4}>Dragonfruit Bloom</option>
                  <option value={5}>Dragon Passion</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-airtable-muted block mb-1">Transfer Quantity (Bottles)</label>
                <input
                  type="number"
                  min="50"
                  max="1500"
                  step="50"
                  value={transferQty}
                  onChange={(e) => setTransferQty(Number(e.target.value))}
                  className="input-base w-full py-1.5 font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="btn-secondary py-1.5 px-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTransfer}
                  className="btn-primary py-1.5 px-4"
                >
                  {submittingTransfer ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Confirm & Dispatch</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
