import React, { useState, useEffect } from 'react';
import {
  X,
  RefreshCw,
  TrendingUp,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { runMonteCarlo } from '../lib/api';
import MatplotlibChart from './MatplotlibChart';

const FLAVORS = [
  { id: 1, name: 'Mango Peach Basil', share: '38%' },
  { id: 2, name: 'Guava Chilli', share: '20%' },
  { id: 3, name: 'Passionfruit Punch', share: '16%' },
  { id: 4, name: 'Dragonfruit Bloom', share: '14%' },
  { id: 5, name: 'Dragon Passion', share: '12%' },
];

export default function MonteCarloModal({ isOpen = true, onClose, flavorId }) {
  const [selectedFlavorId, setSelectedFlavorId] = useState(flavorId || 1);
  const [channel, setChannel] = useState('QC');
  const [serviceLevel, setServiceLevel] = useState(0.95);
  const [nRuns, setNRuns] = useState(1000);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (flavorId) {
      setSelectedFlavorId(flavorId);
    }
  }, [flavorId]);

  const fetchSimulation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runMonteCarlo(selectedFlavorId, {
        channel,
        n_runs: nRuns,
        horizon_days: 14,
        target_service_level: serviceLevel,
        seed: 42,
      });
      setData(res);
    } catch (err) {
      setError(err.message || 'Simulation run failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSimulation();
    }
  }, [isOpen, selectedFlavorId, channel, serviceLevel, nRuns]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-airtable-ink/40 animate-fade-in">
      <div className="w-full max-w-3xl rounded-lg p-6 shadow-soft bg-white border border-airtable-hairline animate-slide-up space-y-5">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 border-b border-airtable-hairline">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded-xs bg-airtable-peach/30 text-airtable-ink border border-airtable-peach">
                14-Day Stochastic Simulation
              </span>
              <span className="text-[11px] font-medium uppercase tracking-wider text-airtable-muted">
                SARIMAX Residual Sampling
              </span>
            </div>
            <h2 className="text-base font-medium text-airtable-ink">
              Monte Carlo Demand Stress Test & Buffer Optimization
            </h2>
            <p className="text-xs text-airtable-muted mt-0.5">
              Simulates 1,000 empirical demand trajectories to reverse-engineer safety buffers clearing target service levels.
            </p>
          </div>
          <button onClick={onClose} className="btn-secondary p-1.5 rounded-lg text-airtable-muted hover:text-airtable-ink">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Controls Toolbar */}
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-md bg-airtable-surface-soft border border-airtable-hairline text-xs">
          <div>
            <label className="block text-[10px] font-medium text-airtable-muted uppercase tracking-wider mb-1">Flavor</label>
            <select
              value={selectedFlavorId}
              onChange={(e) => setSelectedFlavorId(Number(e.target.value))}
              className="input-base py-1 px-2.5 bg-white text-xs"
            >
              {FLAVORS.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-airtable-muted uppercase tracking-wider mb-1">Channel</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="input-base py-1 px-2.5 bg-white text-xs"
            >
              <option value="QC">Quick Commerce (QC)</option>
              <option value="MT">Modern Trade (MT)</option>
              <option value="GT">General Trade (GT)</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-airtable-muted uppercase tracking-wider mb-1">Service Level</label>
            <select
              value={serviceLevel}
              onChange={(e) => setServiceLevel(Number(e.target.value))}
              className="input-base py-1 px-2.5 bg-white text-xs"
            >
              <option value={0.90}>90% Service Level</option>
              <option value={0.95}>95% Target Service Level</option>
              <option value={0.99}>99% High Availability</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-airtable-muted uppercase tracking-wider mb-1">Iterations</label>
            <select
              value={nRuns}
              onChange={(e) => setNRuns(Number(e.target.value))}
              className="input-base py-1 px-2.5 bg-white text-xs"
            >
              <option value={500}>500 runs</option>
              <option value={1000}>1,000 runs (standard)</option>
              <option value={2500}>2,500 runs (stress)</option>
            </select>
          </div>

          <div className="ml-auto self-end">
            <button onClick={fetchSimulation} disabled={loading} className="btn-primary py-1.5 px-3 text-xs">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Simulate
            </button>
          </div>
        </div>

        {/* Buffer Metrics Cards */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-md bg-white border border-airtable-hairline">
              <span className="text-[10px] uppercase font-medium text-airtable-muted">Current Buffer</span>
              <div className="text-xl font-medium font-mono text-airtable-ink mt-0.5">
                {data.current_buffer_days}d
              </div>
              <span className="text-[10px] text-airtable-muted">Baseline lead time</span>
            </div>

            <div className="p-3 rounded-md bg-airtable-forest/10 border border-airtable-forest/30">
              <span className="text-[10px] uppercase font-medium text-airtable-forest">Recommended Buffer</span>
              <div className="text-xl font-medium font-mono text-airtable-forest mt-0.5">
                {data.recommended_buffer_days}d
              </div>
              <span className="text-[10px] text-airtable-forest font-medium">{data.recommended_buffer_bottles.toLocaleString()} btls</span>
            </div>

            <div className="p-3 rounded-md bg-white border border-airtable-hairline">
              <span className="text-[10px] uppercase font-medium text-airtable-muted">Service Level</span>
              <div className="text-xl font-medium font-mono text-airtable-ink mt-0.5">
                {(data.target_service_level * 100).toFixed(0)}%
              </div>
              <span className="text-[10px] text-airtable-muted">Non-stockout target</span>
            </div>

            <div className="p-3 rounded-md bg-airtable-coral/10 border border-airtable-coral/30">
              <span className="text-[10px] uppercase font-medium text-airtable-coral">Stockout Risk at 14d</span>
              <div className="text-xl font-medium font-mono text-airtable-coral mt-0.5">
                {data.stockout_risk_current_pct}%
              </div>
              <span className="text-[10px] text-airtable-coral">Without buffer expansion</span>
            </div>
          </div>
        )}

        {/* Fan Chart Area */}
        <div className="w-full pt-1">
          <MatplotlibChart
            graphId="monte_carlo_distribution"
            params={{ flavor_id: selectedFlavorId }}
            title="Monte Carlo 1,000-Run Fan Trajectory & Terminal Risk Density"
            subtitle="P10–P90 Simulation Ensembles & 95% Value-at-Risk Calibration"
            height="h-64"
          />
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-airtable-hairline">
          <div className="text-[11px] text-airtable-muted">
            Legend: <span className="font-medium text-airtable-coral">Solid line: P50 Median</span> · Shaded: P10-P90 empirical distribution
          </div>
          <button onClick={onClose} className="btn-secondary text-xs py-1.5 px-4">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
