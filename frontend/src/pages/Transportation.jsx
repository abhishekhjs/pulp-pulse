import React, { useState, useEffect } from 'react';
import {
  Truck,
  Thermometer,
  Plane,
  AlertTriangle,
  CheckCircle,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Layers,
  Search,
  RefreshCw,
  Navigation,
  Compass,
  MapPin,
  TrendingDown,
  FlaskConical,
  Mountain,
  Globe,
  Sliders,
  CloudRain,
  BarChart3,
} from 'lucide-react';
import { fetchModuleTransportation } from '../lib/api';
import MatplotlibChart from '../components/MatplotlibChart';
import DMAICPanel from '../components/DMAICPanel';
import RouteOptimizerPanel from '../components/transport/RouteOptimizerPanel';
import ImportTimingPanel from '../components/transport/ImportTimingPanel';
import WeatherWatchPanel from '../components/transport/WeatherWatchPanel';

const TEMP_SENSOR_SERIES = [
  { time: '00:00', setpoint: 3.0, truck1: 3.1, truck2: 3.5, truck3: 4.2 },
  { time: '04:00', setpoint: 3.0, truck1: 3.2, truck2: 3.4, truck3: 4.4 },
  { time: '08:00', setpoint: 3.0, truck1: 3.4, truck2: 3.8, truck3: 4.8 },
  { time: '12:00', setpoint: 3.0, truck1: 3.6, truck2: 3.9, truck3: 4.9 },
  { time: '16:00', setpoint: 3.0, truck1: 3.3, truck2: 3.7, truck3: 4.6 },
  { time: '20:00', setpoint: 3.0, truck1: 3.1, truck2: 3.5, truck3: 4.3 },
  { time: '24:00', setpoint: 3.0, truck1: 3.2, truck2: 3.6, truck3: 4.1 },
];

// ── Static synthetic data for new visualizations ────────────────────────────

// A) Air vs Road Freight Cost — 16 weeks (Jan–Jun 2025)
const FREIGHT_COST_DATA = Array.from({ length: 16 }, (_, i) => {
  const wk = i + 1;
  const road = 8.0 + Math.sin(wk * 0.3) * 0.4; // stable ~₹8/kg
  const air = wk >= 13 && wk <= 15 ? 40 + (wk === 14 ? 5 : 0) : // highway closure spike
              wk === 12 ? 18 : wk === 11 ? 10 : 0; // warning/approach
  const cumPremium = Array.from({ length: wk }, (_, j) => {
    const airW = j >= 12 && j <= 14 ? 38 : j === 11 ? 8 : 0;
    return airW * 82000 / 1e7; // ₹Cr
  }).reduce((s, v) => s + v, 0);
  return {
    week: `Wk${wk}`,
    road: parseFloat(road.toFixed(1)),
    air: air > 0 ? parseFloat(air.toFixed(1)) : null,
    cumPremium: parseFloat(cumPremium.toFixed(2)),
  };
});

// B) Route Vulnerability Risk Matrix — 5 routes × 4 risk dimensions
const ROUTES = [
  'Coop→Plant',
  'Port→Plant',
  'Plant→Delhi',
  'Plant→Mumbai',
  'Depot→Distrib',
];
const RISK_DIMS = ['Weather Risk', 'Infra Risk', 'Single-Route', 'Lead Time Risk'];

// Risk scores 1-5 for each route × dimension
const RISK_MATRIX = [
  [2, 4, 5, 3], // Coop→Plant (highway risk)
  [2, 3, 4, 4], // Port→Plant (import dependency)
  [3, 2, 2, 2], // Plant→Delhi
  [2, 2, 2, 2], // Plant→Mumbai
  [1, 1, 1, 1], // Depot→Distrib (last mile, low risk)
];

function getRiskColor(score) {
  if (score <= 1) return { bg: 'bg-emerald-100', text: 'text-emerald-800' };
  if (score <= 2) return { bg: 'bg-emerald-50', text: 'text-emerald-700' };
  if (score <= 3) return { bg: 'bg-amber-100', text: 'text-amber-800' };
  if (score <= 4) return { bg: 'bg-orange-100', text: 'text-orange-800' };
  return { bg: 'bg-rose-100', text: 'text-rose-800' };
}

// C) Transit SLA Bullet Chart — 6 corridors
const TRANSIT_SLA_DATA = [
  { corridor: 'Nashik→Delhi NCR', actual: 38, sla: 36, best: 30 },
  { corridor: 'Nashik→Mumbai',    actual: 14, sla: 16, best: 12 },
  { corridor: 'Nashik→Bengaluru', actual: 22, sla: 20, best: 18 },
  { corridor: 'Pune→Kolkata',     actual: 44, sla: 42, best: 38 },
  { corridor: 'Import Port→Plant',actual: 72, sla: 60, best: 52 },
  { corridor: 'Plant→Chandigarh', actual: 18, sla: 20, best: 16 },
];

function getSLABarColor(actual, sla) {
  const delta = actual - sla;
  if (delta > 8) return '#aa2d00';
  if (delta > 0) return '#d97706';
  return '#1a6641';
}

export default function Transportation() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('optimizer'); // 'optimizer', 'import_timing', 'weather_watch', 'fleet'
  const [fleetSearch, setFleetSearch] = useState('');
  const [dmaicOpen, setDmaicOpen] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await fetchModuleTransportation();
      setData(res);
    } catch (err) {
      console.error('Failed to load transportation module data', err);
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
        <span className="font-medium text-airtable-ink">Loading Transportation & Cold-Chain Reefer Module...</span>
        <span className="text-xs text-airtable-muted">Connecting to fleet telemetry & route optimization engines...</span>
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
          <h3 className="text-base font-semibold text-airtable-ink">Unable to Load Transportation Module</h3>
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

  const filteredReefers = data.reefers.filter(
    (r) =>
      r.vehicle_id.toLowerCase().includes(fleetSearch.toLowerCase()) ||
      r.corridor.toLowerCase().includes(fleetSearch.toLowerCase()) ||
      r.carrier.toLowerCase().includes(fleetSearch.toLowerCase())
  );

  return (
    <div className="p-5 sm:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* ── DMAIC Analysis Action Bar ────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-airtable-ink">Transportation Module</h2>
          <p className="text-xs text-airtable-muted mt-0.5">Reefer cold-chain telemetry · Route SLA · Air freight ratio</p>
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
          moduleName="Transportation"
          companyId="pulp_riot_transportation"
          onClose={() => setDmaicOpen(false)}
        />
      )}

      {/* ── Top Hero Telemetry Strip ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg p-5 bg-white border border-airtable-hairline shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-airtable-muted">Cold Chain Compliance</span>
            <Thermometer className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-[28px] font-medium font-mono text-airtable-forest leading-none">
            {data.summary.cold_chain_compliance_pct}%
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1.5 flex items-center gap-1">
            <span>Maintained at 2C - 4C setpoint</span>
          </div>
        </div>

        <div className="rounded-lg p-5 bg-white border border-airtable-hairline shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-airtable-muted">Freight Mix (F2)</span>
            <Truck className="w-4 h-4 text-airtable-ink" />
          </div>
          <div className="text-[28px] font-medium font-mono text-airtable-ink leading-none">
            {data.summary.road_vs_air_ratio}
          </div>
          <div className="text-[11px] text-airtable-muted mt-1.5">
            Target: &gt;95% planned road logistics
          </div>
        </div>

        <div className="rounded-lg p-5 bg-white border border-airtable-hairline shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-airtable-muted">Air Freight Premium (A4)</span>
            <Plane className="w-4 h-4 text-airtable-coral" />
          </div>
          <div className="text-[28px] font-medium font-mono text-airtable-ink leading-none">
            {data.summary.air_freight_premium_ratio}x
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1.5">
            Averted 5.0x emergency spike
          </div>
        </div>

        <div className="rounded-lg p-5 bg-white border border-airtable-hairline shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-airtable-muted">Transit SLA Adherence</span>
            <Clock className="w-4 h-4 text-airtable-ink" />
          </div>
          <div className="text-[28px] font-medium font-mono text-airtable-ink leading-none">
            {data.summary.transit_sla_adherence_pct}%
          </div>
          <div className="text-[11px] text-airtable-muted mt-1.5">
            Average transit variance: 0.8h
          </div>
        </div>
      </div>

      {/* ── Sub-Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-airtable-hairline pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('optimizer')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'optimizer'
              ? 'bg-airtable-ink text-white shadow-xs'
              : 'text-airtable-muted hover:text-airtable-ink hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Multi-Modal Route Optimizer (Time vs Money)
        </button>

        <button
          onClick={() => setActiveSubTab('import_timing')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'import_timing'
              ? 'bg-airtable-ink text-white shadow-xs'
              : 'text-airtable-muted hover:text-airtable-ink hover:bg-slate-100'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Quarterly Foreign Import Timing (Golden Window)
        </button>

        <button
          onClick={() => setActiveSubTab('weather_watch')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'weather_watch'
              ? 'bg-airtable-ink text-white shadow-xs'
              : 'text-airtable-muted hover:text-airtable-ink hover:bg-slate-100'
          }`}
        >
          <CloudRain className="w-3.5 h-3.5" />
          Cooperative Weather & Landslide Watch
        </button>

        <button
          onClick={() => setActiveSubTab('fleet')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
            activeSubTab === 'fleet'
              ? 'bg-airtable-ink text-white shadow-xs'
              : 'text-airtable-muted hover:text-airtable-ink hover:bg-slate-100'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          Fleet Manifest & Cold-Chain Telemetry
        </button>
      </div>

      {activeSubTab === 'optimizer' && <RouteOptimizerPanel />}
      {activeSubTab === 'import_timing' && <ImportTimingPanel />}
      {activeSubTab === 'weather_watch' && <WeatherWatchPanel />}

      {activeSubTab === 'fleet' && (
        <div className="space-y-6">
          {/* ── Section 1: In-Transit Cold Chain Reefer Temperature Sensor Stream ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-airtable-hairline">
          <div>
            <div className="flex items-center gap-2">
              <span className="section-label">Cold Chain Integrity</span>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                2°C - 4°C Calibrated
              </span>
            </div>
            <h2 className="text-lg font-medium text-airtable-ink mt-0.5">
              Live Reefer Telemetry & Thermal Excursion Monitor (D4)
            </h2>
            <p className="text-xs text-airtable-muted mt-0.5">
              Continuous thermal data logger telemetry across active long-haul refrigerated corridors.
            </p>
          </div>
          <span className="text-xs font-mono text-airtable-muted">
            {data.summary.active_reefers_count} Trucks Active
          </span>
        </div>

        <div className="w-full">
          <MatplotlibChart
            graphId="transportation_temp_telemetry"
            title="Cold-Chain Temperature Sensor Telemetry"
            subtitle="48-Hour Continuous Reefer Log with 8°C Critical Thermal Breach Alert"
            height="h-64"
          />
        </div>
      </div>

      {/* ── Section 2: Active Reefer Vehicles Manifest & Transit Corridors ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Reefer Fleet Table */}
        <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="section-label">Fleet GPS Stream</span>
              <h3 className="text-base font-medium text-airtable-ink">
                Active In-Transit Reefer Manifest
              </h3>
            </div>
            <span className="text-[11px] font-mono text-airtable-muted">
              Live Sensor Status
            </span>
          </div>

          <div className="space-y-3">
            {filteredReefers.map((rf) => (
              <div
                key={rf.vehicle_id}
                className="p-3.5 rounded-lg border border-airtable-hairline bg-airtable-surface-soft hover:bg-white transition-all space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-airtable-ink" />
                    <span className="font-mono font-semibold text-airtable-ink">{rf.vehicle_id}</span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                      rf.temp_status === 'caution'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    <Thermometer className="w-2.5 h-2.5" />
                    {rf.current_temp_c}°C
                  </span>
                </div>

                <div className="text-xs text-airtable-body">
                  <span className="font-medium text-airtable-ink">{rf.carrier}</span> · {rf.corridor}
                </div>

                <div className="flex items-center justify-between text-[11px] text-airtable-muted font-mono pt-1 border-t border-airtable-hairline/60">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-airtable-muted" />
                    {rf.gps_location}
                  </span>
                  <span>ETA: {rf.eta_hrs}h ({rf.cargo_volume} btls)</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Major Logistics Corridors & Route Vulnerability (F1 / F3) */}
        <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="section-label">Lane Reliability</span>
              <h3 className="text-base font-medium text-airtable-ink">
                Corridor Vulnerability & Secondary Carrier SLA (F1 / F3)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-airtable-muted">
              Dynamic Rerouting
            </span>
          </div>

          <div className="space-y-3">
            {data.corridors.map((c) => (
              <div
                key={c.route}
                className="p-3.5 rounded-lg border border-airtable-hairline bg-airtable-surface-soft space-y-2"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-airtable-ink">
                  <span>{c.route}</span>
                  <span className="font-mono text-emerald-700">{c.sla_compliance_pct}% SLA</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] text-airtable-muted font-mono pt-1 border-t border-airtable-hairline/60">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Mode</span>
                    <span className="text-airtable-ink">{c.mode}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Transit Time</span>
                    <span className="text-airtable-ink">{c.lead_time_hrs} hrs</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">Route Risk (F1)</span>
                    <span className={c.route_risk_f1 === 'Medium' ? 'text-amber-700 font-semibold' : 'text-emerald-700'}>
                      {c.route_risk_f1}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 3: Freight Events & Expedited Air Surge Ledger ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="section-label">Freight Audit Trail</span>
            <h3 className="text-base font-medium text-airtable-ink">
              Freight Event Dispatches & Cost Allocations
            </h3>
          </div>
          <span className="text-xs font-mono text-airtable-muted">
            Tracking A4 & F2 Baseline
          </span>
        </div>

        <div className="overflow-x-auto border border-airtable-hairline rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-airtable-surface-soft border-b border-airtable-hairline font-mono text-[11px] text-airtable-muted uppercase">
              <tr>
                <th className="px-4 py-2.5">Event ID</th>
                <th className="px-4 py-2.5">Freight Mode</th>
                <th className="px-4 py-2.5">Dispatched Volume</th>
                <th className="px-4 py-2.5">Cost (INR)</th>
                <th className="px-4 py-2.5">Triggered Reason</th>
                <th className="px-4 py-2.5">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-airtable-hairline">
              {data.freight_events.map((fe) => (
                <tr key={fe.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-airtable-ink">
                    FE-{String(fe.id).padStart(4, '0')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold capitalize ${
                        fe.type.includes('air')
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {fe.type.includes('air') ? <Plane className="w-2.5 h-2.5" /> : <Truck className="w-2.5 h-2.5" />}
                      {fe.type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-airtable-ink">
                    {fe.volume_bottles.toLocaleString()} btls
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-airtable-ink">
                    ₹{fe.cost_inr.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-airtable-body">
                    {fe.triggered_by_kpi}
                  </td>
                  <td className="px-4 py-3 font-mono text-airtable-muted">
                    {fe.created_at}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Section 4: Relevant Transportation Domain KPIs (F1 - F3, A4, D4) ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-airtable-ink" />
          <h3 className="text-base font-medium text-airtable-ink">
            Logistics & Cold-Chain Telemetry (F1-F3, A4, D4)
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
          NEW SECTION A: Air vs Road Freight Cost Explosion
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <span className="section-label">Freight Cost Intelligence</span>
            <h3 className="text-base font-medium text-airtable-ink mt-0.5">
              Inbound Freight Cost Explosion: May 2025 Highway Closure Impact
            </h3>
          </div>
          <div className="rounded-lg px-4 py-2.5 bg-rose-50 border border-rose-200 text-center flex-shrink-0">
            <div className="text-[10px] font-mono uppercase text-rose-600 mb-0.5">Total Air Freight Premium</div>
            <div className="text-xl font-mono font-semibold text-rose-700">₹3.2 Cr</div>
            <div className="text-[10px] text-rose-500">Weeks 11–15 emergency procurement</div>
          </div>
        </div>

        <div className="w-full">
          <MatplotlibChart
            graphId="transportation_freight_cost"
            title="Logistics Cost Trade-Off: Air Emergency vs Reefer Road"
            subtitle="Freight Rate Comparison (5x Premium Avoided by Puree Postponement)"
            height="h-72"
          />
        </div>
        <p className="text-[11px] text-airtable-muted leading-relaxed">
          Road freight remained stable at ₹8/kg throughout January–April. The Nashik–Pune highway closure in Week 13 forced emergency air procurement at ₹40–45/kg — a 5× premium — for Passionfruit Pulp. The model's F1 route vulnerability monitor would have triggered alternative supplier activation at Week 10 (the first geological survey warning), reducing air freight dependency to 1 week instead of 3.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          NEW SECTION B: Route Vulnerability Risk Matrix — Heatmap Grid
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4">
        <div>
          <span className="section-label">Route Risk Intelligence</span>
          <h3 className="text-base font-medium text-airtable-ink mt-0.5">
            Inbound Logistics Route Vulnerability Matrix
          </h3>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[520px]">
            {/* Column headers */}
            <div className="grid gap-2" style={{ gridTemplateColumns: `160px repeat(4, 1fr) 80px` }}>
              <div />
              {RISK_DIMS.map((dim) => (
                <div key={dim} className="text-center text-[10px] font-mono text-airtable-muted font-semibold leading-tight">
                  {dim}
                </div>
              ))}
              <div className="text-center text-[10px] font-mono text-airtable-ink font-bold">
                Total
              </div>
            </div>

            {/* Matrix rows */}
            {ROUTES.map((route, ri) => {
              const rowTotal = RISK_MATRIX[ri].reduce((s, v) => s + v, 0);
              return (
                <div key={route} className="grid gap-2 mt-2" style={{ gridTemplateColumns: `160px repeat(4, 1fr) 80px` }}>
                  <div className={`text-[11px] font-medium flex items-center pr-2 ${ri === 0 ? 'text-airtable-coral' : 'text-airtable-ink'}`}>
                    {route}
                  </div>
                  {RISK_MATRIX[ri].map((score, di) => {
                    const { bg, text } = getRiskColor(score);
                    return (
                      <div
                        key={di}
                        className={`${bg} ${text} h-10 rounded flex items-center justify-center font-mono text-sm font-bold`}
                      >
                        {score}
                      </div>
                    );
                  })}
                  {/* Row total */}
                  <div className={`h-10 rounded flex items-center justify-center font-mono text-sm font-bold ${
                    rowTotal >= 14 ? 'bg-rose-200 text-rose-800' :
                    rowTotal >= 10 ? 'bg-amber-100 text-amber-800' :
                    'bg-emerald-100 text-emerald-800'
                  }`}>
                    {rowTotal}
                  </div>
                </div>
              );
            })}

            {/* Column totals */}
            <div className="grid gap-2 mt-3 pt-2 border-t border-airtable-hairline" style={{ gridTemplateColumns: `160px repeat(4, 1fr) 80px` }}>
              <div className="text-[10px] font-mono text-airtable-muted font-semibold flex items-center">
                Dimension Total
              </div>
              {RISK_DIMS.map((_, di) => {
                const colTotal = RISK_MATRIX.reduce((s, row) => s + row[di], 0);
                return (
                  <div key={di} className={`h-8 rounded flex items-center justify-center font-mono text-xs font-bold ${
                    colTotal >= 16 ? 'bg-rose-100 text-rose-800' :
                    colTotal >= 12 ? 'bg-amber-50 text-amber-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {colTotal}
                  </div>
                );
              })}
              <div className="h-8 rounded flex items-center justify-center font-mono text-xs font-bold bg-slate-200 text-slate-800">
                {RISK_MATRIX.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0)}
              </div>
            </div>

            {/* Risk legend */}
            <div className="flex items-center gap-3 mt-3 flex-wrap text-[10px]">
              {[
                { label: '1 Low', bg: 'bg-emerald-100', text: 'text-emerald-800' },
                { label: '2-3 Med', bg: 'bg-amber-100', text: 'text-amber-800' },
                { label: '4 High', bg: 'bg-orange-100', text: 'text-orange-800' },
                { label: '5 Critical', bg: 'bg-rose-100', text: 'text-rose-800' },
              ].map(({ label, bg, text }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className={`w-5 h-4 rounded ${bg} flex items-center justify-center`}>
                    <span className={`text-[8px] font-bold ${text}`}>■</span>
                  </div>
                  <span className="text-airtable-muted">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-airtable-muted leading-relaxed">
          The Cooperative→Plant route scores highest overall risk (14/20) driven by single-route dependency (5/5) and infrastructure vulnerability (4/5) — this is the Nashik–Pune highway corridor that collapsed in May. Import Port→Plant scores 13/20 due to high lead time risk and single-source exposure from Thai dragonfruit imports.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          NEW SECTION C: Transit SLA Adherence — Bullet Chart
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4">
        <div>
          <span className="section-label">SLA Performance Dashboard</span>
          <h3 className="text-base font-medium text-airtable-ink mt-0.5">
            Transit SLA Adherence vs Target: Corridor-Level Performance
          </h3>
        </div>

        <div className="w-full">
          <MatplotlibChart
            graphId="transportation_transit_sla"
            title="Transit SLA Adherence: Corridor Performance"
            subtitle="Actual Transit Hours vs Target SLA vs Freshness Limit"
            height="h-80"
          />
        </div>

        {/* Color legend */}
        <div className="flex items-center gap-4 flex-wrap text-[11px]">
          {[
            { color: '#1a6641', label: 'On Time (≤ SLA)' },
            { color: '#d97706', label: 'Slightly Late (+1–8h)' },
            { color: '#aa2d00', label: 'Critical Breach (>8h over SLA)' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-airtable-muted">{label}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-airtable-muted leading-relaxed">
          Import Port→Plant corridor shows the most severe SLA breach at 72h actual vs 60h target (+12h, 20% overrun). This is the Thai dragonfruit import route that adds 12 days to lead time when highway alternatives are unavailable. The Nashik→Bengaluru corridor also runs 2h over SLA, requiring pre-positioned buffer stock at S-zone depots.
        </p>
      </div>
        </div>
      )}
    </div>
  );
}
