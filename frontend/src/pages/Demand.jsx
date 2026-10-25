import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Activity,
  Zap,
  Sliders,
  Sparkles,
  BarChart2,
  Calendar,
  Layers,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  ChevronRight,
  FlaskConical,
} from 'lucide-react';
import { fetchModuleDemand, fetchFlavorForecast } from '../lib/api';
import MonteCarloModal from '../components/MonteCarloModal';
import MatplotlibChart from '../components/MatplotlibChart';
import DMAICPanel from '../components/DMAICPanel';

// ── Static synthetic data for new visualizations ────────────────────────────

// A) Viral Spike Propagation — Days 1-28
const VIRAL_PROPAGATION = Array.from({ length: 28 }, (_, i) => {
  const day = i + 1;
  // QC spikes 4x at day 14
  const qcBase = 1200;
  const qcSpike =
    day < 12 ? qcBase :
    day === 12 ? qcBase * 1.5 :
    day === 13 ? qcBase * 2.8 :
    day === 14 ? qcBase * 4.2 :
    day === 15 ? qcBase * 3.6 :
    day === 16 ? qcBase * 2.1 :
    day <= 20 ? qcBase * 1.6 - (day - 16) * 80 :
    qcBase * 1.1;
  return {
    day: `D${day}`,
    QC: Math.round(qcSpike),
    MT: Math.round(800 + Math.sin(day * 0.4) * 60 + (day > 13 && day < 18 ? 300 : 0)),
    GT: Math.round(600 + Math.sin(day * 0.3) * 40),
    Baseline: 900,
  };
});

// B) Flavor Market Share Momentum — Horizontal bar
const FLAVOR_SHARE = [
  { flavor: 'Dragon Passion', forecast: 18, actual: 31 },
  { flavor: 'Mango Peach Basil', forecast: 30, actual: 26 },
  { flavor: 'Guava Chilli', forecast: 22, actual: 19 },
  { flavor: 'Passionfruit Punch', forecast: 15, actual: 13 },
  { flavor: 'Dragonfruit Bloom', forecast: 15, actual: 11 },
];

// C) Demand Decomposition — 12 weeks stacked bar + line
const DEMAND_DECOMP = Array.from({ length: 12 }, (_, i) => {
  const wk = i + 1;
  const socialBump = wk >= 6 && wk <= 10 ? (wk === 8 ? 420 : wk >= 7 && wk <= 9 ? 310 : 180) : 40;
  const campaignBump = wk >= 4 && wk <= 7 ? 200 : 80;
  const seasonality = 800 + wk * 30;
  const tempEffect = 300 + Math.sin(wk * 0.5) * 80;
  const baseDemand = 500;
  const total = seasonality + tempEffect + socialBump + campaignBump + baseDemand;
  const actualOrders = wk >= 6 && wk <= 10
    ? total * (1.15 + Math.random() * 0.08)
    : total * (0.95 + Math.random() * 0.04);
  return {
    week: `Wk${wk}`,
    'Base Demand': baseDemand,
    'Seasonality': Math.round(seasonality),
    'Temp Effect': Math.round(tempEffect),
    'Social Trend': Math.round(socialBump),
    'Campaign Multiplier': Math.round(campaignBump),
    'Actual Orders': Math.round(actualOrders),
  };
});

export default function Demand() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFlavorId, setSelectedFlavorId] = useState(1);
  const [selectedChannel, setSelectedChannel] = useState('QC');
  const [forecastData, setForecastData] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [showMonteCarlo, setShowMonteCarlo] = useState(false);
  const [heatwaveBoost, setHeatwaveBoost] = useState(0); // 0 to 25% what-if boost
  const [skuSearch, setSkuSearch] = useState('');
  const [dmaicOpen, setDmaicOpen] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await fetchModuleDemand();
      setData(res);
      if (res.flavors && res.flavors.length > 0) {
        setSelectedFlavorId(res.flavors[0].id);
      }
    } catch (err) {
      console.error('Failed to load demand module data', err);
      setLoadError(err.message || 'Failed to connect to backend API server');
    } finally {
      setLoading(false);
    }
  };

  const loadFlavorForecast = async (flavorId, channel) => {
    try {
      setForecastLoading(true);
      const res = await fetchFlavorForecast(flavorId, channel, 14);
      setForecastData(res);
    } catch (err) {
      console.error('Failed to load SARIMAX flavor forecast', err);
    } finally {
      setForecastLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedFlavorId) {
      loadFlavorForecast(selectedFlavorId, selectedChannel);
    }
  }, [selectedFlavorId, selectedChannel]);

  if (loading && !data) {
    return (
      <div className="flex flex-col h-96 items-center justify-center gap-3 text-sm text-airtable-muted">
        <RefreshCw className="w-6 h-6 animate-spin text-airtable-ink" />
        <span className="font-medium text-airtable-ink">Loading Demand Sensing & Forecasting Module...</span>
        <span className="text-xs text-airtable-muted">Fetching SARIMAX parameters & Quick Commerce telemetry...</span>
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
          <h3 className="text-base font-semibold text-airtable-ink">Unable to Load Demand Module</h3>
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

  const selectedFlavor = data.flavors.find((f) => f.id === selectedFlavorId) || data.flavors[0];

  // Prepare combined chart data for SARIMAX forecast with What-if heatwave slider
  const boostMultiplier = 1 + heatwaveBoost / 100;
  const lastHistoricalDate = forecastData?.last_historical_date || null;
  const lastHistoricalFormatted = lastHistoricalDate ? lastHistoricalDate.slice(5) : null;

  const chartPoints = (forecastData?.combined_timeline || []).map((pt) => {
    const isFuture = pt.is_future;
    const isBridge = pt.date === lastHistoricalDate;

    const actualVal = pt.actual !== null && pt.actual !== undefined ? pt.actual : null;
    let forecastVal = null;
    let lowerVal = null;
    let upperVal = null;

    if (isFuture) {
      forecastVal = pt.point_forecast !== null ? Math.round(pt.point_forecast * boostMultiplier) : null;
      lowerVal = pt.ci_lower !== null ? Math.round(pt.ci_lower * boostMultiplier) : null;
      upperVal = pt.ci_upper !== null ? Math.round(pt.ci_upper * boostMultiplier) : null;
    } else if (isBridge) {
      // Connect to actual at bridge point
      forecastVal = pt.actual;
      lowerVal = pt.actual;
      upperVal = pt.actual;
    }

    return {
      rawDate: pt.date,
      date: pt.date.slice(5), // MM-DD
      actual: actualVal,
      pointForecast: forecastVal,
      ciLower: lowerVal,
      ciUpper: upperVal,
      isFuture: isFuture,
      isBridge: isBridge,
    };
  });

  // Filter SKUs
  const filteredFlavors = data.flavors.filter((f) =>
    f.name.toLowerCase().includes(skuSearch.toLowerCase())
  );

  return (
    <div className="p-5 sm:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* ── DMAIC Analysis Action Bar ────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-airtable-ink">Demand Module</h2>
          <p className="text-xs text-airtable-muted mt-0.5">SARIMAX forecasting · Channel sensing · SKU mix</p>
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
          moduleName="Demand"
          companyId="pulp_riot_demand"
          onClose={() => setDmaicOpen(false)}
        />
      )}

      {/* ── Top Hero Telemetry Strip ───────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg p-5 bg-white border border-airtable-hairline shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-airtable-muted">14-Day Demand Forecast</span>
            <TrendingUp className="w-4 h-4 text-airtable-ink" />
          </div>
          <div className="text-[28px] font-medium font-mono text-airtable-ink leading-none">
            {data.summary.forecast_14d_total_bottles.toLocaleString()}
          </div>
          <div className="text-[11px] text-airtable-forest font-medium mt-1.5 flex items-center gap-1">
            <span>+12.4% vs last cycle</span>
            <span className="text-airtable-muted font-normal">· Seasonal surge</span>
          </div>
        </div>

        <div className="rounded-lg p-5 bg-white border border-airtable-hairline shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-airtable-muted">Forecast Error Rate (B2)</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-[28px] font-medium font-mono text-airtable-forest leading-none">
            {data.summary.b2_forecast_error_pct}%
          </div>
          <div className="text-[11px] text-airtable-muted mt-1.5">
            Target &lt;20% · SARIMAX Forecaster
          </div>
        </div>

        <div className="rounded-lg p-5 bg-white border border-airtable-hairline shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-airtable-muted">Demand Sensing Latency (B1)</span>
            <Zap className="w-4 h-4 text-airtable-ink" />
          </div>
          <div className="text-[28px] font-medium font-mono text-airtable-ink leading-none">
            {data.summary.b1_sensing_latency_hrs}h
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1.5">
            Daily automated ingest (&lt;24h target)
          </div>
        </div>

        <div className="rounded-lg p-5 bg-white border border-rose-500 ring-2 ring-rose-500/25 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-airtable-muted">QC Velocity Surge (B3)</span>
            <Sparkles className="w-4 h-4 text-airtable-coral" />
          </div>
          <div className="text-[28px] font-medium font-mono text-airtable-coral leading-none">
            +{data.summary.b3_qc_velocity_surge_pct}%
          </div>
          <div className="text-[11px] text-airtable-coral mt-1.5 font-medium">
            Demand Momentum signal active
          </div>
        </div>
      </div>

      {/* ── SARIMAX Statistical Forecaster ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-airtable-hairline">
          <div>
            <div className="flex items-center gap-2">
              <span className="section-label">Statistical Forecaster</span>
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                SARIMAX Engine
              </span>
            </div>
            <h2 className="text-lg font-medium text-airtable-ink mt-1">
              14-Day Flavor Demand Trajectory with 95% Confidence Bounds
            </h2>
            <p className="text-xs text-airtable-muted mt-0.5">
              Configurable orders (p,d,q)x(P,D,Q)[7] with exogenous regressors (seasonality, social trend, campaign flags).
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowMonteCarlo(true)}
              className="btn-primary"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Monte Carlo Stress Test (16.3)</span>
            </button>
            <button
              onClick={() => loadFlavorForecast(selectedFlavorId, selectedChannel)}
              className="btn-secondary"
              title="Recalculate forecast"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${forecastLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Flavor Selector Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {data.flavors.map((fl) => {
              const active = fl.id === selectedFlavorId;
              return (
                <button
                  key={fl.id}
                  onClick={() => setSelectedFlavorId(fl.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? 'bg-airtable-ink text-white shadow-xs'
                      : 'bg-airtable-surface-soft text-airtable-ink hover:bg-slate-200 border border-airtable-hairline'
                  }`}
                >
                  {fl.name}
                </button>
              );
            })}
          </div>

          {/* Channel selector */}
          <div className="flex items-center gap-1 p-1 rounded-md bg-airtable-surface-soft border border-airtable-hairline text-xs font-medium">
            <span className="px-2 text-airtable-muted font-mono uppercase text-[10px]">Channel:</span>
            {['QC', 'MT', 'GT'].map((ch) => (
              <button
                key={ch}
                onClick={() => setSelectedChannel(ch)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  selectedChannel === ch
                    ? 'bg-white text-airtable-ink shadow-xs border border-airtable-hairline'
                    : 'text-airtable-muted hover:text-airtable-ink'
                }`}
              >
                {ch === 'QC' ? 'Quick Commerce' : ch === 'MT' ? 'Modern Trade' : 'General Trade'}
              </button>
            ))}
          </div>
        </div>

        {/* What-If Temperature Simulation Slider */}
        <div className="p-3.5 rounded-lg bg-orange-50/60 border border-orange-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-orange-600 flex-shrink-0" />
            <div>
              <span className="font-semibold text-orange-950">
                What-If Exogenous Heatwave Sensitivity:
              </span>{' '}
              <span className="text-orange-900">
                Simulate +{heatwaveBoost}% ambient summer demand spike
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="30"
              step="5"
              value={heatwaveBoost}
              onChange={(e) => setHeatwaveBoost(Number(e.target.value))}
              className="w-40 accent-orange-600 cursor-pointer"
            />
            <span className="font-mono font-semibold text-orange-900 w-10 text-right">
              +{heatwaveBoost}%
            </span>
          </div>
        </div>

        {/* Empirical Ground Truth vs Forecast Demarcation Stat Strip */}
        {forecastData?.summary_stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 border border-airtable-hairline rounded-lg text-xs">
            <div>
              <span className="text-[10px] font-mono uppercase text-airtable-muted block">Database Cutoff</span>
              <span className="font-mono font-medium text-slate-800">
                {forecastData.last_historical_date || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-airtable-muted block">14-Day Actual Volume</span>
              <span className="font-mono font-medium text-slate-800">
                {forecastData.summary_stats.historical_14d_total?.toLocaleString()} btls
                <span className="text-[10px] text-airtable-muted font-normal ml-1">
                  (avg {forecastData.summary_stats.historical_14d_avg}/d)
                </span>
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-airtable-muted block">14-Day SARIMAX Projection</span>
              <span className="font-mono font-medium text-orange-600">
                {forecastData.summary_stats.forecast_14d_total?.toLocaleString()} btls
                <span className="text-[10px] text-orange-700/80 font-normal ml-1">
                  (avg {forecastData.summary_stats.forecast_14d_avg}/d)
                </span>
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-airtable-muted block">Forward Trajectory Shift</span>
              <span className={`font-mono font-medium ${forecastData.summary_stats.growth_rate_pct >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {forecastData.summary_stats.growth_rate_pct >= 0 ? '+' : ''}{forecastData.summary_stats.growth_rate_pct}%
                <span className="text-[10px] text-airtable-muted font-normal ml-1">
                  (std ±{forecastData.residual_std?.toFixed(1)})
                </span>
              </span>
            </div>
          </div>
        )}

        {/* Forecast Chart */}
        <div className="w-full pt-2">
          <MatplotlibChart
            graphId="demand_forecast_fan"
            params={{ flavor_id: selectedFlavorId, channel: selectedChannel }}
            title="SARIMAX Forecast Fan Chart"
            subtitle="Multi-Regime Trajectory & Confidence Envelope"
            height="h-72"
          />
        </div>
      </div>

      {/* ── Section 2: Channel Demand Mix & Exogenous Regressors Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Channel Velocity Breakdown Chart */}
        <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="section-label">Channel Demand Mix</span>
              <h3 className="text-base font-medium text-airtable-ink">
                Multi-Channel Velocity Trajectory
              </h3>
            </div>
            <span className="text-[11px] font-mono text-airtable-muted">
              QC vs MT vs GT
            </span>
          </div>

          <div className="w-full">
            <MatplotlibChart
              graphId="demand_channel_series"
              title="Multi-Channel Demand Trajectory"
              subtitle="Quick Commerce vs Modern Trade vs General Trade"
              height="h-64"
            />
          </div>
          <p className="text-[11px] text-airtable-muted leading-relaxed">
            Quick Commerce exhibits highest velocity volatility (B3 +34.2%), requiring continuous 14-day stock rebalancing to prevent stockout penalties.
          </p>
        </div>

        {/* Exogenous Regressor Configuration Table */}
        <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="section-label">Exogenous Regressors</span>
              <h3 className="text-base font-medium text-airtable-ink">
                Dynamic Exogenous Parameter Matrix
              </h3>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              forecast_exog.json
            </span>
          </div>
          <p className="text-xs text-airtable-muted">
            Config-driven regressors injected dynamically into SARIMAX without requiring code deployment.
          </p>

          <div className="overflow-x-auto border border-airtable-hairline rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-airtable-surface-soft border-b border-airtable-hairline font-mono text-[11px] text-airtable-muted uppercase">
                <tr>
                  <th className="px-3 py-2">Regressor</th>
                  <th className="px-3 py-2">Weight</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-airtable-hairline">
                {Object.entries(data.exogenous_regressors).map(([key, item]) => (
                  <tr key={key} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-airtable-ink capitalize">
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div className="text-[10px] text-airtable-muted line-clamp-1">
                        {item.description}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono font-medium text-airtable-ink">
                      {item.weight}x
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-airtable-muted">
                      {item.type}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle className="w-2.5 h-2.5" />
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── SKU Trajectory & Sentiment Push Signals Table ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="section-label">Momentum Signals</span>
            <h3 className="text-base font-medium text-airtable-ink">
              Flavor Portfolio Demand & Market Push Breakdown
            </h3>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-airtable-muted" />
            <input
              type="text"
              placeholder="Filter flavor SKU..."
              value={skuSearch}
              onChange={(e) => setSkuSearch(e.target.value)}
              className="input-base pl-8 py-1.5 text-xs w-full"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-airtable-hairline rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-airtable-surface-soft border-b border-airtable-hairline font-mono text-[11px] text-airtable-muted uppercase">
              <tr>
                <th className="px-4 py-2.5">Flavor SKU</th>
                <th className="px-4 py-2.5">Summer Share</th>
                <th className="px-4 py-2.5">Realized Price</th>
                <th className="px-4 py-2.5">Contribution Margin</th>
                <th className="px-4 py-2.5">14d Forecast</th>
                <th className="px-4 py-2.5">B3 Velocity Deviation</th>
                <th className="px-4 py-2.5">Market Sentiment Signal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-airtable-hairline">
              {filteredFlavors.map((fl) => (
                <tr key={fl.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-medium text-airtable-ink">
                    {fl.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-airtable-ink">
                    {fl.summer_share_pct}%
                  </td>
                  <td className="px-4 py-3 font-mono text-airtable-ink">
                    ₹{fl.realized_price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-airtable-forest">
                    ₹{fl.cm_per_bottle.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 font-mono text-airtable-ink font-semibold">
                    {fl.forecast_14d_bottles.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    <span className={fl.b3_deviation_pct > 15 ? 'text-airtable-coral font-semibold' : 'text-slate-600'}>
                      +{fl.b3_deviation_pct}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {fl.sentiment_badge ? (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                        title={typeof fl.sentiment_badge === 'object' ? fl.sentiment_badge.rationale : fl.sentiment_badge}
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        {typeof fl.sentiment_badge === 'object' ? fl.sentiment_badge.text : fl.sentiment_badge}
                      </span>
                    ) : (
                      <span className="text-[11px] text-airtable-muted font-mono">
                        Baseline Balanced
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          NEW SECTION A: Viral Spike Propagation Graph
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4">
        <div>
          <span className="section-label">Viral Event Detection</span>
          <h3 className="text-base font-medium text-airtable-ink mt-0.5">
            Dragon Passion QC Viral Propagation & Demand Detection Timeline
          </h3>
        </div>

        <div className="w-full">
          <MatplotlibChart
            graphId="demand_viral_propagation"
            title="QC Viral Propagation & Demand Detection Timeline"
            subtitle="Day 1-28 Timeline: 4.2x QC Surge vs Modern Trade vs General Trade"
            height="h-72"
          />
        </div>

        {/* 3-column stat strip */}
        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-airtable-hairline">
          {[
            { label: 'Spike Detected', value: 'Day 14', sub: 'Influencer reel virality', color: 'text-airtable-coral' },
            { label: 'Lag Time to Restock', value: '36 hrs', sub: 'System response to QC signal', color: 'text-amber-700' },
            { label: 'Revenue Lost to Lag', value: '₹14.75 Cr', sub: 'Stockout penalty (QC & MT)', color: 'text-airtable-coral' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="text-center">
              <div className="text-[10px] text-airtable-muted font-mono uppercase mb-1">{label}</div>
              <div className={`text-lg font-mono font-semibold ${color}`}>{value}</div>
              <div className="text-[10px] text-airtable-muted mt-0.5">{sub}</div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-airtable-muted leading-relaxed">
          QC orders surged 4.2× at Day 14 following a viral influencer reel. The 36-hour sensing lag (before the model's B3 signal fired) resulted in ₹14.75Cr in stockout revenue loss. The agent layer would have detected the velocity anomaly at Day 12, triggering emergency replenishment 48 hours earlier.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Portfolio Analytics & Exogenous Factor Attribution (Side-by-Side Halves)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* NEW SECTION B: Flavor Market Share Momentum — Horizontal Bar */}
        <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <span className="section-label">Portfolio Analytics</span>
              <h3 className="text-base font-medium text-airtable-ink mt-0.5">
                Flavor Portfolio: Forecast vs Actual Market Share Drift
              </h3>
            </div>

            <div className="w-full">
              <MatplotlibChart
                graphId="demand_flavor_share"
                title="Flavor Market Share Momentum"
                subtitle="Pre-Season Forecast vs Actual Summer Realised Portfolio Share"
                height="h-72"
              />
            </div>
          </div>
          <p className="text-[11px] text-airtable-muted leading-relaxed">
            Dragon Passion deviated +13 percentage points above forecast (18%→31%), cannibalizing demand from Mango Peach Basil. The model's B3 momentum signal would have detected this drift at Week 2 and dynamically shifted production mix — preventing the SKU imbalance that caused stockouts.
          </p>
        </div>

        {/* NEW SECTION C: Demand Decomposition — Stacked bar + line */}
        <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <span className="section-label">Exogenous Factor Attribution</span>
              <h3 className="text-base font-medium text-airtable-ink mt-0.5">
                Demand Decomposition: Exogenous Factor Attribution by Week
              </h3>
            </div>

            <div className="w-full">
              <MatplotlibChart
                graphId="demand_decomposition"
                title="Demand Decomposition Breakdown"
                subtitle="12-Week Attribution: Base, Seasonality, Temp, Campaign, Social vs Actual Orders"
                height="h-72"
              />
            </div>
          </div>
          <p className="text-[11px] text-airtable-muted leading-relaxed">
            Weeks 6–10 show Social Trend Index exploding above the modelled stack as the influencer reel effect propagated. Actual orders (black line) consistently overshot the decomposed model sum by 15–22%, confirming that the viral demand signal was not captured in the original SARIMAX exogenous weights.
          </p>
        </div>
      </div>

      {/* ── Section 4: Relevant Demand Domain KPIs ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-airtable-ink" />
          <h3 className="text-base font-medium text-airtable-ink">
            Demand Governance & Market Sensing Telemetry (B1-B4, G1, G2, A2)
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

      {/* ── Monte Carlo Stress Test Modal (Section 16.3) ── */}
      {showMonteCarlo && (
        <MonteCarloModal
          flavorId={selectedFlavorId}
          onClose={() => setShowMonteCarlo(false)}
        />
      )}
    </div>
  );
}
