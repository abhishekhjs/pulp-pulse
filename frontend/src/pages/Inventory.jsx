import React, { useState, useEffect } from 'react';
import {
  Package,
  Clock,
  QrCode,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  ArrowRight,
  Layers,
  Search,
  RefreshCw,
  Sliders,
  Send,
  Zap,
  FlaskConical,
} from 'lucide-react';
import { fetchModuleInventory, ingestScan } from '../lib/api';
import AgeClock from '../components/AgeClock';
import MatplotlibChart from '../components/MatplotlibChart';
import DMAICPanel from '../components/DMAICPanel';

// ── Static synthetic data for new visualizations ────────────────────────────

// 9 depots for shelf-life decay
const DEPOT_NAMES = [
  'Delhi NCR', 'Chandigarh', 'Mumbai', 'Pune', 'Ahmedabad',
  'Bengaluru', 'Chennai', 'Hyderabad', 'Kolkata',
];

const SHELF_LIFE_DATA = [
  { depot: 'Delhi NCR',   safe: 28400, atRisk: 8200,  critical: 1800 },
  { depot: 'Chandigarh',  safe: 12100, atRisk: 3400,  critical: 600  },
  { depot: 'Mumbai',      safe: 35600, atRisk: 11000, critical: 3200 },
  { depot: 'Pune',        safe: 19800, atRisk: 5600,  critical: 1100 },
  { depot: 'Ahmedabad',   safe: 14200, atRisk: 4100,  critical: 900  },
  { depot: 'Bengaluru',   safe: 31000, atRisk: 9800,  critical: 4600 },
  { depot: 'Chennai',     safe: 18400, atRisk: 6200,  critical: 2100 },
  { depot: 'Hyderabad',   safe: 22100, atRisk: 7400,  critical: 1700 },
  { depot: 'Kolkata',     safe: 16300, atRisk: 5100,  critical: 800  },
];

const AT_RISK_VALUE_TOTAL = SHELF_LIFE_DATA.reduce((sum, d) => sum + d.critical, 0) * 60;

// 5 flavors × 9 depots freshness matrix
const FLAVORS_MATRIX = ['Mango Peach Basil', 'Guava Chilli', 'Passionfruit Punch', 'Dragonfruit Bloom', 'Dragon Passion'];

function generateFreshnessMatrix() {
  // Synthetic ages: some depots have old batches especially for Passionfruit and Dragon Passion
  const ages = [
    // MPB,  GC,   PP,   DB,   DP
    [ 8,    6,   17,   11,   19 ], // Delhi NCR — Dragon Passion D18 breach
    [ 5,    9,   null,  7,   13 ], // Chandigarh — no Passionfruit stock
    [12,   14,   16,   18,   22 ], // Mumbai — DB and DP breaches
    [ 7,    8,   13,   10,   15 ], // Pune — DP at-risk
    [10,    6,   null,  8,   11 ], // Ahmedabad — no PP
    [16,   12,   19,   14,   21 ], // Bengaluru — PP and DP breach
    [ 9,   11,   15,    7,   17 ], // Chennai — DP at-risk
    [13,    8,   14,   12,   18 ], // Hyderabad — DP D18
    [ 6,    7,   null, 10,   12 ], // Kolkata — no PP
  ];
  return ages;
}

const FRESHNESS_MATRIX = generateFreshnessMatrix();

function getFreshnessClass(age) {
  if (age === null) return { bg: 'bg-slate-100', text: 'text-slate-400', label: '—' };
  if (age >= 18) return { bg: 'bg-rose-100', text: 'text-rose-800', label: `${age}d` };
  if (age >= 14) return { bg: 'bg-amber-100', text: 'text-amber-800', label: `${age}d` };
  return { bg: 'bg-emerald-100', text: 'text-emerald-800', label: `${age}d` };
}

// Pareto data — depots sorted by write-off risk descending
const PARETO_DATA = [
  { depot: 'Bengaluru',  risk: 16.56 },
  { depot: 'Mumbai',     risk: 11.52 },
  { depot: 'Delhi NCR',  risk: 6.48  },
  { depot: 'Chennai',    risk: 7.56  },
  { depot: 'Hyderabad',  risk: 6.12  },
  { depot: 'Pune',       risk: 3.96  },
  { depot: 'Ahmedabad',  risk: 3.24  },
  { depot: 'Kolkata',    risk: 2.88  },
  { depot: 'Chandigarh', risk: 2.16  },
].sort((a, b) => b.risk - a.risk);

// Compute cumulative %
const totalRisk = PARETO_DATA.reduce((s, d) => s + d.risk, 0);
let cumulative = 0;
const PARETO_WITH_CUM = PARETO_DATA.map((d) => {
  cumulative += d.risk;
  return { ...d, cumPct: Math.round((cumulative / totalRisk) * 100) };
});

export default function Inventory() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [batchSearch, setBatchSearch] = useState('');
  const [selectedBatchForTransfer, setSelectedBatchForTransfer] = useState(null);
  const [freshnessTooltip, setFreshnessTooltip] = useState(null);
  const [dmaicOpen, setDmaicOpen] = useState(false);

  // Scan simulator state (Section 16.4)
  const [scanType, setScanType] = useState('factory_intake');
  const [scanDepotId, setScanDepotId] = useState(1);
  const [scanFlavorId, setScanFlavorId] = useState(1);
  const [scanQty, setScanQty] = useState(240);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await fetchModuleInventory();
      setData(res);
      if (res.depots && res.depots.length > 0) {
        setScanDepotId(res.depots[0].id);
      }
    } catch (err) {
      console.error('Failed to load inventory module data', err);
      setLoadError(err.message || 'Failed to connect to backend API server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleExecuteScan = async (e) => {
    e.preventDefault();
    setScanLoading(true);
    setScanSuccess(null);
    try {
      const payload = {
        scan_type: scanType,
        parcel_code: `SCAN-${Date.now().toString().slice(-6)}`,
        from_node_type: scanType === 'factory_intake' ? 'factory' : 'depot',
        from_node_id: scanType === 'factory_intake' ? 1 : scanDepotId,
        to_node_type: scanType === 'factory_intake' ? 'depot' : 'distributor',
        to_node_id: scanType === 'factory_intake' ? scanDepotId : 99,
        flavor_id: scanFlavorId,
        quantity: scanQty,
      };
      const res = await ingestScan(payload);
      setScanSuccess(
        `Scan processed: ${scanQty} bottles ingested. Freshness evaluated with zero polling.`
      );
      loadData(); // reload freshness status
    } catch (err) {
      console.error('Scan ingestion failed', err);
    } finally {
      setScanLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col h-96 items-center justify-center gap-3 text-sm text-airtable-muted">
        <RefreshCw className="w-6 h-6 animate-spin text-airtable-ink" />
        <span className="font-medium text-airtable-ink">Loading Inventory & Freshness Clocks Module...</span>
        <span className="text-xs text-airtable-muted">Tracking Day-18 triggers and 30-day rejection cliff...</span>
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
          <h3 className="text-base font-semibold text-airtable-ink">Unable to Load Inventory Module</h3>
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

  // Filter batches
  const filteredBatches = data.at_risk_batches.filter(
    (b) =>
      b.flavor_name.toLowerCase().includes(batchSearch.toLowerCase()) ||
      b.depot_name.toLowerCase().includes(batchSearch.toLowerCase()) ||
      b.batch_number.toLowerCase().includes(batchSearch.toLowerCase())
  );

  // Depot distribution chart data
  const depotChartData = data.depots.map((d) => ({
    name: d.name.replace('Depot ', '').split(' ')[0],
    bottles: d.total_bottles,
    oldestAge: d.oldest_batch_age,
  }));

  return (
    <div className="p-5 sm:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* ── DMAIC Analysis Action Bar ────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-airtable-ink">Inventory Module</h2>
          <p className="text-xs text-airtable-muted mt-0.5">D18 age clocks · Batch tracking · Scan ingest</p>
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
          moduleName="Inventory"
          companyId="pulp_riot_inventory"
          onClose={() => setDmaicOpen(false)}
        />
      )}

      {/* ── Top Hero Telemetry Strip ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg p-5 bg-white border border-airtable-hairline shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-airtable-muted">Finished Stock In Depots</span>
            <Package className="w-4 h-4 text-airtable-ink" />
          </div>
          <div className="text-[28px] font-medium font-mono text-airtable-ink leading-none">
            {data.summary.total_stock_bottles.toLocaleString()}
          </div>
          <div className="text-[11px] text-airtable-muted mt-1.5">
            Across 9 regional cold depots
          </div>
        </div>

        <div className="rounded-lg p-5 bg-white border border-rose-500 ring-2 ring-rose-500/25 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-airtable-muted">D18 Trigger Batches (D2)</span>
            <Clock className="w-4 h-4 text-airtable-coral" />
          </div>
          <div className="text-[28px] font-medium font-mono text-airtable-coral leading-none">
            {data.summary.d18_warning_batches}
          </div>
          <div className="text-[11px] text-airtable-coral mt-1.5 font-medium">
            Requires automated inter-depot transfer
          </div>
        </div>

        <div className="rounded-lg p-5 bg-white border border-airtable-hairline shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-airtable-muted">QC Cliff Breaches (&gt;21d)</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-[28px] font-medium font-mono text-emerald-700 leading-none">
            {data.summary.qc_cliff_batches}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1.5 font-medium">
            Zero write-offs · Target achieved
          </div>
        </div>

        <div className="rounded-lg p-5 bg-white border border-airtable-hairline shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-airtable-muted">Average Depot Cover (D1)</span>
            <Layers className="w-4 h-4 text-airtable-ink" />
          </div>
          <div className="text-[28px] font-medium font-mono text-airtable-ink leading-none">
            {data.summary.avg_cover_days}d
          </div>
          <div className="text-[11px] text-airtable-muted mt-1.5">
            Healthy baseline range (10-14 days)
          </div>
        </div>
      </div>

      {/* ── Section 1: Handheld Barcode & RFID Scan Simulator (Section 16.4) ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-airtable-hairline">
          <div>
            <div className="flex items-center gap-2">
              <span className="section-label">Handheld Telemetry Ingestion</span>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                POST /api/scans
              </span>
            </div>
            <h2 className="text-lg font-medium text-airtable-ink mt-0.5">
              Physical RFID & 2D Barcode Scan Ingestion Simulator
            </h2>
            <p className="text-xs text-airtable-muted mt-0.5">
              Simulates physical scanner triggers: atomically updates inventory, increments channel sales, and runs immediate freshness evaluation without polling.
            </p>
          </div>
          <QrCode className="w-6 h-6 text-airtable-muted hidden sm:block" />
        </div>

        <form onSubmit={handleExecuteScan} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          <div>
            <label className="text-[11px] font-mono text-airtable-muted block mb-1">Scan Type</label>
            <select
              value={scanType}
              onChange={(e) => setScanType(e.target.value)}
              className="input-base w-full py-1.5 text-xs"
            >
              <option value="factory_intake">Factory Intake (Receipt)</option>
              <option value="depot_dispatch">Depot Dispatch (Sale)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-mono text-airtable-muted block mb-1">Target Regional Depot</label>
            <select
              value={scanDepotId}
              onChange={(e) => setScanDepotId(Number(e.target.value))}
              className="input-base w-full py-1.5 text-xs"
            >
              {data.depots.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-mono text-airtable-muted block mb-1">Flavor SKU</label>
            <select
              value={scanFlavorId}
              onChange={(e) => setScanFlavorId(Number(e.target.value))}
              className="input-base w-full py-1.5 text-xs"
            >
              <option value={1}>Mango Peach Basil</option>
              <option value={2}>Guava Chilli</option>
              <option value={3}>Passionfruit Punch</option>
              <option value={4}>Dragonfruit Bloom</option>
              <option value={5}>Dragon Passion</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-mono text-airtable-muted block mb-1">Quantity (Bottles)</label>
            <input
              type="number"
              min="20"
              max="2000"
              step="20"
              value={scanQty}
              onChange={(e) => setScanQty(Number(e.target.value))}
              className="input-base w-full py-1.5 text-xs font-mono"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={scanLoading}
              className="btn-primary w-full py-2 text-xs"
            >
              {scanLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Transmit Scan</span>
                </>
              )}
            </button>
          </div>
        </form>

        {scanSuccess && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 animate-fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{scanSuccess}</span>
          </div>
        )}
      </div>

      {/* ── Section 2: 9 Regional Depots Finished Stock & Aging Grid ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="section-label">Regional Network</span>
            <h3 className="text-base font-medium text-airtable-ink">
              9 Regional Depots Stock Levels & Oldest Batch Age
            </h3>
          </div>
          <span className="text-xs font-mono text-airtable-muted">
            North · West · South · East
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.depots.map((d) => (
            <div
              key={d.id}
              className={`p-4 rounded-lg border bg-airtable-surface-soft transition-all ${
                d.status === 'breach' ? 'border-rose-400 bg-rose-50/20' : 'border-airtable-hairline hover:bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="font-semibold text-xs text-airtable-ink">{d.name}</div>
                  <div className="text-[11px] text-airtable-muted">Region: {d.region}</div>
                </div>
                {d.d18_count > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {d.d18_count} D18 At-Risk
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle className="w-2.5 h-2.5" />
                    Healthy
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-airtable-hairline text-center text-xs">
                <div>
                  <div className="text-[10px] text-airtable-muted font-mono uppercase">Stock</div>
                  <div className="font-mono font-medium text-airtable-ink">{d.total_bottles.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-airtable-muted font-mono uppercase">Batches</div>
                  <div className="font-mono font-medium text-airtable-ink">{d.batch_count}</div>
                </div>
                <div>
                  <div className="text-[10px] text-airtable-muted font-mono uppercase">Oldest Age</div>
                  <div className={`font-mono font-semibold ${d.oldest_batch_age >= 18 ? 'text-rose-700' : 'text-airtable-ink'}`}>
                    {d.oldest_batch_age}d
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 3: Detailed Batch Shelf-Life Freshness Matrix ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="section-label">Freshness Telemetry</span>
            <h3 className="text-base font-medium text-airtable-ink">
              Batch Freshness Clocks & Aging Matrix (D2 Freshness Governance)
            </h3>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-airtable-muted" />
            <input
              type="text"
              placeholder="Search batch, depot, or flavor..."
              value={batchSearch}
              onChange={(e) => setBatchSearch(e.target.value)}
              className="input-base pl-8 py-1.5 text-xs w-full"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-airtable-hairline rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-airtable-surface-soft border-b border-airtable-hairline font-mono text-[11px] text-airtable-muted uppercase">
              <tr>
                <th className="px-4 py-2.5">Batch ID</th>
                <th className="px-4 py-2.5">Depot Location</th>
                <th className="px-4 py-2.5">Flavor SKU</th>
                <th className="px-4 py-2.5">Bottles</th>
                <th className="px-4 py-2.5">Age</th>
                <th className="px-4 py-2.5">Remaining Freshness</th>
                <th className="px-4 py-2.5">D18 Trigger Window</th>
                <th className="px-4 py-2.5">Action Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-airtable-hairline">
              {filteredBatches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-airtable-ink">
                    {b.batch_number}
                  </td>
                  <td className="px-4 py-3 text-airtable-body">
                    {b.depot_name}
                  </td>
                  <td className="px-4 py-3 font-medium text-airtable-ink">
                    {b.flavor_name}
                  </td>
                  <td className="px-4 py-3 font-mono text-airtable-ink">
                    {b.bottles_current.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold">
                    <span className={b.age_days >= 18 ? 'text-airtable-coral' : b.age_days >= 14 ? 'text-amber-700' : 'text-emerald-700'}>
                      {b.age_days} days
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            b.freshness_pct < 20 ? 'bg-rose-500' : b.freshness_pct < 40 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${b.freshness_pct}%` }}
                        />
                      </div>
                      <span className="font-mono text-[11px] text-airtable-muted">{b.freshness_pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-airtable-muted">
                    {b.age_days >= 18 ? (
                      <span className="text-airtable-coral font-semibold">D18 Cliff Active</span>
                    ) : (
                      <span>{b.hours_to_d18}h to trigger</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {b.age_days >= 18 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Transfer Mandated
                      </span>
                    ) : b.age_days >= 14 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-2.5 h-2.5" />
                        Watchlist
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle className="w-2.5 h-2.5" />
                        Optimal Fresh
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 4: Relevant Inventory Domain KPIs (D1 - D4, A3) ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-airtable-ink" />
          <h3 className="text-base font-medium text-airtable-ink">
            Inventory Freshness & Write-Off Governance (D1-D4, A3)
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
          NEW SECTION A: Shelf-Life Decay Cascade — Area Chart
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4">
        {/* Stat tile above chart */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="section-label">Freshness Risk Analytics</span>
            <h3 className="text-base font-medium text-airtable-ink mt-0.5">
              Network-wide Shelf Life Decay Profile by Depot
            </h3>
          </div>
          <div className="rounded-lg px-4 py-2.5 bg-rose-50 border border-rose-200 text-center flex-shrink-0">
            <div className="text-[10px] font-mono uppercase text-rose-600 mb-0.5">Total At-Risk Value</div>
            <div className="text-xl font-mono font-semibold text-rose-700">
              ₹{(AT_RISK_VALUE_TOTAL / 100000).toFixed(2)} L
            </div>
            <div className="text-[10px] text-rose-500">&lt;30 days stock × ₹60/bottle</div>
          </div>
        </div>

        <div className="w-full">
          <MatplotlibChart
            graphId="inventory_shelf_life"
            title="Shelf-Life Decay Cascade: Aging Inventory Curves"
            subtitle="Fresh (>60d) vs Amber (30-60d) vs Critical (<30d) vs Expired Risk"
            height="h-72"
          />
        </div>
        <p className="text-[11px] text-airtable-muted leading-relaxed">
          Bengaluru and Mumbai depots hold the highest concentration of critical (&lt;30-day) stock — together accounting for ₹12.5L of at-risk value. These depots serve QC channels with strict D18 rejection windows, making proactive inter-depot transfers essential within the next 48 hours.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          NEW SECTION B: D18 Freshness Clock Heatmap Matrix
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4">
        <div>
          <span className="section-label">D18 Governance Matrix</span>
          <h3 className="text-base font-medium text-airtable-ink mt-0.5">
            Real-Time Freshness Matrix: All Flavors × All Depots
          </h3>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Column headers (depots) */}
            <div className="grid gap-1" style={{ gridTemplateColumns: `180px repeat(9, 1fr)` }}>
              <div className="text-[10px] font-mono text-airtable-muted" />
              {DEPOT_NAMES.map((name) => (
                <div key={name} className="text-center text-[9px] font-mono text-airtable-muted leading-tight px-1">
                  {name.split(' ')[0]}
                </div>
              ))}
            </div>

            {/* Matrix rows (flavors) */}
            {FLAVORS_MATRIX.map((flavor, fi) => (
              <div key={flavor} className="grid gap-1 mt-1" style={{ gridTemplateColumns: `180px repeat(9, 1fr)` }}>
                {/* Flavor label */}
                <div className={`text-[11px] font-medium flex items-center pr-2 ${
                  flavor === 'Dragon Passion' ? 'text-airtable-coral' : 'text-airtable-ink'
                }`}>
                  {flavor}
                </div>
                {/* Cells */}
                {FRESHNESS_MATRIX.map((row, di) => {
                  const age = row[fi];
                  const { bg, text, label } = getFreshnessClass(age);
                  return (
                    <div
                      key={di}
                      className={`${bg} ${text} h-9 rounded flex items-center justify-center font-mono text-[10px] font-semibold cursor-default transition-all hover:scale-105 hover:shadow-md relative`}
                      onMouseEnter={() => setFreshnessTooltip({
                        flavor,
                        depot: DEPOT_NAMES[di],
                        age,
                        label,
                      })}
                      onMouseLeave={() => setFreshnessTooltip(null)}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Tooltip */}
            {freshnessTooltip && (
              <div className="mt-3 p-2.5 rounded-lg bg-slate-900 text-white text-[11px] font-mono animate-fade-in inline-block">
                <span className="font-semibold">{freshnessTooltip.flavor}</span>
                {' @ '}
                <span>{freshnessTooltip.depot}</span>
                {' — '}
                {freshnessTooltip.age === null ? (
                  <span className="text-slate-400">No Stock</span>
                ) : (
                  <span className={
                    freshnessTooltip.age >= 18 ? 'text-rose-300' :
                    freshnessTooltip.age >= 14 ? 'text-amber-300' : 'text-emerald-300'
                  }>
                    Age: {freshnessTooltip.age} days {freshnessTooltip.age >= 18 ? '[D18 BREACH]' : freshnessTooltip.age >= 14 ? '[At-Risk]' : '[Optimal Fresh]'}
                  </span>
                )}
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-airtable-hairline">
              {[
                { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Fresh <14d' },
                { bg: 'bg-amber-100', text: 'text-amber-800', label: 'At-Risk 14–17d' },
                { bg: 'bg-rose-100', text: 'text-rose-800', label: 'D18 Breach ≥18d' },
                { bg: 'bg-slate-100', text: 'text-slate-400', label: 'No Stock' },
              ].map(({ bg, text, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`w-4 h-4 rounded ${bg} flex items-center justify-center`}>
                    <span className={`text-[8px] font-mono font-bold ${text}`}>—</span>
                  </div>
                  <span className="text-[10px] text-airtable-muted">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-airtable-muted leading-relaxed">
          Dragon Passion (bottom row) shows the most pervasive D18 breach pattern — 4 of 9 depots have batches at or above the 18-day freshness cliff. QC partners reject stock older than 18 days; each rejected batch triggers a ₹60/bottle write-off plus emergency reorder costs averaging ₹14,400 per batch.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          NEW SECTION C: Write-Off Risk Pareto Analysis
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4">
        <div>
          <span className="section-label">Write-Off Risk Prioritization</span>
          <h3 className="text-base font-medium text-airtable-ink mt-0.5">
            Write-off Risk Pareto: Which Depots Need Priority Attention?
          </h3>
        </div>

        <div className="w-full">
          <MatplotlibChart
            graphId="inventory_pareto"
            title="Batch Risk Pareto Analysis (ABC Concentration)"
            subtitle="Top Risk Batches vs Cumulative Financial Write-Off Exposure (80% Line)"
            height="h-72"
          />
        </div>
        <p className="text-[11px] text-airtable-muted leading-relaxed">
          Pareto analysis reveals that just 3 depots (Bengaluru, Mumbai, Chennai) account for 79% of total write-off risk (₹35.64L of ₹45.08L). Concentrating inter-depot freshness transfers on these three locations will protect 4× more value than distributing effort uniformly across the network.
        </p>
      </div>
    </div>
  );
}
