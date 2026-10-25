import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plane,
  Train,
  Clock,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Leaf,
  CheckCircle2,
  TrendingDown,
  ArrowRight,
  RefreshCw,
  Sliders,
  Layers,
} from 'lucide-react';
import { fetchCorridors, fetchOptimizedRoutes } from '../../lib/api';

export default function RouteOptimizerPanel() {
  const [corridors, setCorridors] = useState([]);
  const [selectedCorridorId, setSelectedCorridorId] = useState('coop_to_plant');
  const [urgency, setUrgency] = useState('balanced'); // cost_priority, speed_priority, balanced
  const [volumeKg, setVolumeKg] = useState(20000);
  const [optimizationData, setOptimizationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [corridorsRes, optRes] = await Promise.all([
        fetchCorridors(),
        fetchOptimizedRoutes(selectedCorridorId, null, volumeKg, urgency),
      ]);
      setCorridors(corridorsRes);
      setOptimizationData(optRes);
    } catch (err) {
      console.error('Failed to load transport optimization data', err);
      setError(err.message || 'Could not fetch route optimization');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCorridorId, urgency]);

  const handleRecalculate = () => {
    loadData();
  };

  if (loading && !optimizationData) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-sm text-airtable-muted">
        <RefreshCw className="w-5 h-5 animate-spin text-airtable-ink" />
        <span>Evaluating Multi-Modal Freight Trade-Offs (Cost vs Time)...</span>
      </div>
    );
  }

  if (error && !optimizationData) {
    return (
      <div className="p-6 rounded-lg bg-rose-50 border border-rose-200 text-center space-y-3">
        <AlertTriangle className="w-6 h-6 text-rose-600 mx-auto" />
        <div className="text-sm font-semibold text-airtable-ink">Unable to load route optimization</div>
        <div className="text-xs text-airtable-muted">{error}</div>
        <button
          onClick={loadData}
          className="px-3 py-1.5 rounded-md bg-airtable-ink text-white text-xs font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  const { corridor, modes, recommendation, live_hazard_context } = optimizationData || {};

  return (
    <div className="space-y-6">
      {/* ── Control Header: Corridor, Volume, and Urgency Selector ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-airtable-hairline">
          <div>
            <span className="section-label">Pareto Multi-Modal Route Engine</span>
            <h3 className="text-base font-medium text-airtable-ink mt-0.5">
              Freight Route & Mode Optimization (Time vs Money Trade-Off)
            </h3>
            <p className="text-xs text-airtable-muted mt-0.5">
              Simulates transit lead time, direct freight cost, spoilage risk, carbon emissions, and weather resilience.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2.5 py-1 rounded-sm bg-airtable-surface-soft text-airtable-ink border border-airtable-hairline">
              Live Weather Adjusted
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-mono uppercase text-airtable-muted mb-1.5 font-medium">
              Logistics Corridor & Good
            </label>
            <select
              value={selectedCorridorId}
              onChange={(e) => setSelectedCorridorId(e.target.value)}
              className="w-full text-xs font-medium bg-white border border-airtable-hairline rounded-sm px-3 py-2 text-airtable-ink focus:outline-none focus:border-airtable-info-border shadow-2xs"
            >
              {corridors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.distance_km} km)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-airtable-muted mb-1.5 font-medium">
              Cargo Volume (kg)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1000"
                step="2000"
                value={volumeKg}
                onChange={(e) => setVolumeKg(Number(e.target.value))}
                className="w-full text-xs font-mono font-medium bg-white border border-airtable-hairline rounded-sm px-3 py-2 text-airtable-ink focus:outline-none focus:border-airtable-info-border shadow-2xs"
              />
              <button
                onClick={handleRecalculate}
                className="px-3 py-2 rounded-sm bg-white border border-airtable-hairline hover:bg-airtable-surface-soft text-xs font-medium text-airtable-ink transition-colors flex-shrink-0 shadow-2xs"
              >
                Apply
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase text-airtable-muted mb-1.5 font-medium">
              Optimization Priority
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-airtable-surface-soft border border-airtable-hairline rounded-sm text-[11px] font-medium text-center">
              <button
                onClick={() => setUrgency('balanced')}
                className={`py-1 rounded-xs transition-colors ${
                  urgency === 'balanced'
                    ? 'bg-white shadow-xs font-medium text-airtable-ink'
                    : 'text-airtable-muted hover:text-airtable-ink'
                }`}
              >
                Balanced
              </button>
              <button
                onClick={() => setUrgency('cost_priority')}
                className={`py-1 rounded-xs transition-colors ${
                  urgency === 'cost_priority'
                    ? 'bg-white shadow-xs font-medium text-airtable-ink'
                    : 'text-airtable-muted hover:text-airtable-ink'
                }`}
              >
                Lowest Cost
              </button>
              <button
                onClick={() => setUrgency('speed_priority')}
                className={`py-1 rounded-xs transition-colors ${
                  urgency === 'speed_priority'
                    ? 'bg-white shadow-xs font-medium text-airtable-ink'
                    : 'text-airtable-muted hover:text-airtable-ink'
                }`}
              >
                Fastest Lead Time
              </button>
            </div>
          </div>
        </div>

        {/* Live Weather & Road Condition Context Banner */}
        {live_hazard_context && (
          <div className="flex items-center justify-between p-3 rounded-sm bg-airtable-surface-soft border border-airtable-hairline text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-airtable-ink">Cooperative Route Condition:</span>
              <span className="font-mono text-airtable-body">
                {live_hazard_context.weather_condition} ({live_hazard_context.rainfall_48h_mm}mm rain)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-airtable-muted font-mono">
                Hazard Index: <strong className="text-airtable-ink font-medium">{live_hazard_context.hazard_score}/100</strong>
              </span>
              <span
                className={`px-2 py-0.5 rounded-sm text-[10px] font-medium uppercase font-mono ${
                  live_hazard_context.road_status === 'BLOCKED_LANDSLIDE'
                    ? 'bg-airtable-coral/10 text-airtable-coral border border-airtable-coral/30'
                    : live_hazard_context.road_status === 'CAUTION_DEBRIS'
                    ? 'bg-airtable-yellow/20 text-airtable-mustard border border-airtable-yellow/60'
                    : 'bg-airtable-surface-soft text-airtable-forest border border-airtable-forest/30'
                }`}
              >
                {live_hazard_context.road_status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Autonomous Mode Recommendation Callout ── */}
      {recommendation && (
        <div className="rounded-md border border-airtable-hairline bg-airtable-surface-soft p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-airtable-forest" />
              <span className="text-xs font-mono uppercase tracking-wider font-medium text-airtable-forest">
                Agent Recommended Logistics Strategy
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-sm text-[11px] font-mono font-medium bg-white text-airtable-forest border border-airtable-hairline">
              Saves ₹{(recommendation.savings_vs_air_freight_inr / 1e5).toFixed(2)} Lakhs vs Emergency Air
            </span>
          </div>
          <p className="text-xs text-airtable-body leading-relaxed font-normal">
            {recommendation.reason}
          </p>
        </div>
      )}

      {/* ── Multi-Modal Comparison Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {modes &&
          modes.map((m) => {
            const isRec = m.is_recommended;
            return (
              <div
                key={m.mode_id}
                className={`rounded-md p-4 border transition-all flex flex-col justify-between ${
                  isRec
                    ? 'bg-white border-airtable-hairline shadow-2xs ring-1 ring-airtable-forest/40'
                    : 'bg-white border-airtable-hairline hover:border-airtable-hairline-dark shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono uppercase text-airtable-muted font-medium">
                      {m.category}
                    </span>
                    {isRec ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-airtable-surface-soft text-airtable-forest border border-airtable-forest/30 text-[10px] font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        Best Choice
                      </span>
                    ) : m.pareto_optimal ? (
                      <span className="px-1.5 py-0.5 rounded-sm bg-airtable-surface-soft text-airtable-muted border border-airtable-hairline text-[10px] font-mono font-medium">
                        Pareto Efficient
                      </span>
                    ) : null}
                  </div>

                  <h4 className="text-sm font-medium text-airtable-ink line-clamp-2 min-h-[40px]">
                    {m.name}
                  </h4>

                  {/* Main Metric Cards */}
                  <div className="mt-3 space-y-2 pb-3 border-b border-airtable-hairline">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-airtable-muted flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-airtable-muted" />
                        Transit Time:
                      </span>
                      <span className="font-mono font-medium text-airtable-ink">
                        {m.transit_days} days ({m.transit_hours}h)
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-airtable-muted flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-airtable-muted" />
                        Freight Cost:
                      </span>
                      <span className="font-mono font-medium text-airtable-ink">
                        ₹{m.cost_inr.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-airtable-muted">
                      <span>Rate per kg:</span>
                      <span className="text-airtable-ink font-medium">₹{m.rate_per_kg_inr}/kg</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-airtable-muted">
                      <span>Per bottle equiv:</span>
                      <span className="text-airtable-ink font-medium">₹{m.cost_per_bottle_inr}</span>
                    </div>
                  </div>

                  {/* Secondary Metrics */}
                  <div className="mt-2.5 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-airtable-muted">Reliability:</span>
                      <span
                        className={`font-mono font-medium ${
                          m.reliability_pct >= 90
                            ? 'text-airtable-forest'
                            : m.reliability_pct >= 70
                            ? 'text-airtable-mustard'
                            : 'text-airtable-coral'
                        }`}
                      >
                        {m.reliability_pct}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-airtable-muted flex items-center gap-1">
                        <Leaf className="w-3 h-3 text-airtable-forest" />
                        Carbon:
                      </span>
                      <span className="font-mono text-airtable-ink font-medium">{m.carbon_kg_co2} kg CO₂</span>
                    </div>

                    <div className="pt-1 text-[10px] text-airtable-muted leading-tight">
                      <span className="font-medium block text-airtable-ink mb-0.5">Vulnerability:</span>
                      {m.landslide_vulnerability}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2 border-t border-airtable-hairline">
                  <span className="text-[10px] text-airtable-muted italic block leading-snug">
                    {m.key_strength}
                  </span>
                </div>
              </div>
            );
          })}
      </div>

      {/* ── Detailed Trade-Off Matrix Table ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline p-5 shadow-2xs space-y-3">
        <h4 className="text-sm font-medium text-airtable-ink">
          Multi-Modal Comparison Matrix ({corridor?.name} — {volumeKg.toLocaleString()} kg)
        </h4>

        <div className="overflow-x-auto border border-airtable-hairline rounded-md">
          <table className="w-full text-xs text-left">
            <thead className="bg-airtable-surface-soft border-b border-airtable-hairline font-mono text-[11px] text-airtable-muted uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Mode</th>
                <th className="px-4 py-2.5 font-medium">Transit (Hrs / Days)</th>
                <th className="px-4 py-2.5 font-medium">Rate / kg</th>
                <th className="px-4 py-2.5 font-medium">Total Cost</th>
                <th className="px-4 py-2.5 font-medium">Cost / Bottle</th>
                <th className="px-4 py-2.5 font-medium">Reliability</th>
                <th className="px-4 py-2.5 font-medium">Carbon (CO₂)</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-airtable-hairline">
              {modes &&
                modes.map((m) => (
                  <tr
                    key={m.mode_id}
                    className={`hover:bg-airtable-surface-soft/40 transition-colors ${
                      m.is_recommended ? 'bg-airtable-surface-soft/30' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-airtable-ink flex items-center gap-2">
                      {m.is_recommended && <CheckCircle2 className="w-3.5 h-3.5 text-airtable-forest" />}
                      <span>{m.name}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-airtable-ink">
                      {m.transit_hours}h ({m.transit_days}d)
                    </td>
                    <td className="px-4 py-3 font-mono text-airtable-ink">
                      ₹{m.rate_per_kg_inr.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-mono font-medium text-airtable-ink">
                      ₹{m.cost_inr.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-airtable-ink">
                      ₹{m.cost_per_bottle_inr.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <span
                        className={`font-medium ${
                          m.reliability_pct >= 90
                            ? 'text-airtable-forest'
                            : m.reliability_pct >= 70
                            ? 'text-airtable-mustard'
                            : 'text-airtable-coral'
                        }`}
                      >
                        {m.reliability_pct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-airtable-muted">
                      {m.carbon_kg_co2} kg
                    </td>
                    <td className="px-4 py-3">
                      {m.is_recommended ? (
                        <span className="px-2 py-0.5 rounded-sm text-[10px] font-medium bg-airtable-surface-soft text-airtable-forest border border-airtable-forest/30">
                          Recommended
                        </span>
                      ) : m.mode_id.includes('air') ? (
                        <span className="px-2 py-0.5 rounded-sm text-[10px] font-medium bg-airtable-coral/10 text-airtable-coral border border-airtable-coral/30">
                          Emergency 5x
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono text-airtable-muted bg-airtable-surface-soft border border-airtable-hairline">
                          Viable
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
