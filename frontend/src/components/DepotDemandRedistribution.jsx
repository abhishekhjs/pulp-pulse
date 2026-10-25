import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Truck,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Zap,
  RefreshCw,
  CheckCircle2,
  DollarSign,
  Activity,
  Layers,
  Sparkles,
  MapPin,
  Clock,
  Compass,
  Building,
  ShoppingBag,
} from 'lucide-react';
import {
  fetchDepotForecastMatrix,
  fetchDepotFlavorForecast,
  fetchRebalancingOpportunities,
  triggerRebalancing,
  simulateSurge,
  approveRedistributionTransfer,
} from '../lib/api';

const FLAVORS = [
  { id: 1, name: 'Mango Peach Basil' },
  { id: 2, name: 'Guava Chilli' },
  { id: 3, name: 'Passionfruit Punch' },
  { id: 4, name: 'Dragonfruit Bloom' },
  { id: 5, name: 'Dragon Passion' },
];

const DEPOTS = [
  { id: 1, name: 'Depot N1 (Delhi NCR)', region: 'North' },
  { id: 2, name: 'Depot N2 (Chandigarh)', region: 'North' },
  { id: 3, name: 'Depot W1 (Mumbai)', region: 'West' },
  { id: 4, name: 'Depot W2 (Pune)', region: 'West' },
  { id: 5, name: 'Depot W3 (Ahmedabad)', region: 'West' },
  { id: 6, name: 'Depot S1 (Bengaluru)', region: 'South' },
  { id: 7, name: 'Depot S2 (Chennai)', region: 'South' },
  { id: 8, name: 'Depot S3 (Hyderabad)', region: 'South' },
  { id: 9, name: 'Depot E1 (Kolkata)', region: 'East' },
];

export default function DepotDemandRedistribution() {
  const [activeTab, setActiveTab] = useState('rebalancing'); // 'rebalancing' | 'forecasting' | 'matrix'
  const [selectedDepotId, setSelectedDepotId] = useState(1);
  const [selectedFlavorId, setSelectedFlavorId] = useState(5);
  const [forecastHorizon, setForecastHorizon] = useState(14);

  // Data states
  const [forecastData, setForecastData] = useState(null);
  const [matrixData, setMatrixData] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Simulation state
  const [surgeDepotId, setSurgeDepotId] = useState(1);
  const [surgeFlavorId, setSurgeFlavorId] = useState(5);
  const [surgeMultiplier, setSurgeMultiplier] = useState(2.8);
  const [surgeSegment, setSurgeSegment] = useState('Quick Commerce');
  const [simulating, setSimulating] = useState(false);
  const [surgeBanner, setSurgeBanner] = useState(null);

  // Execution state
  const [executingTransferId, setExecutingTransferId] = useState(null);
  const [executionSuccessMsg, setExecutionSuccessMsg] = useState(null);

  // Load initial data
  const loadOpportunities = async () => {
    try {
      const opps = await fetchRebalancingOpportunities();
      setOpportunities(opps);
    } catch (err) {
      console.error('Failed to load rebalancing opportunities', err);
    }
  };

  const loadForecast = async (dId, fId, hDays) => {
    try {
      const fData = await fetchDepotFlavorForecast(dId, fId, hDays);
      setForecastData(fData);
    } catch (err) {
      console.error('Failed to load forecast data', err);
    }
  };

  const loadMatrix = async () => {
    try {
      const mData = await fetchDepotForecastMatrix();
      setMatrixData(mData);
    } catch (err) {
      console.error('Failed to load matrix data', err);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      loadOpportunities(),
      loadForecast(selectedDepotId, selectedFlavorId, forecastHorizon),
      loadMatrix(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleDepotOrFlavorChange = (dId, fId) => {
    setSelectedDepotId(dId);
    setSelectedFlavorId(fId);
    loadForecast(dId, fId, forecastHorizon);
  };

  const handleSimulateSurge = async (e) => {
    e.preventDefault();
    setSimulating(true);
    setSurgeBanner(null);
    try {
      const res = await simulateSurge({
        depot_id: surgeDepotId,
        flavor_id: surgeFlavorId,
        surge_multiplier: parseFloat(surgeMultiplier),
        segment: surgeSegment,
        auto_create_alert: true,
      });

      const match = res.best_optimal_match;
      setSurgeBanner({
        depot: res.depot_name,
        flavor: res.flavor_name,
        units: res.surged_demand_units,
        surplusSource: match ? match.surplus_depot_name : 'No immediate surplus found',
        buffer: match ? match.buffer_bottles : 0,
        roi: match ? `${match.roi_multiple}x` : 'N/A',
        netGain: match ? match.net_economic_benefit : 0,
        transferId: match ? match.transfer_id : null,
      });

      // Reload opportunities & forecast
      await loadOpportunities();
      await loadForecast(selectedDepotId, selectedFlavorId, forecastHorizon);
      await loadMatrix();
    } catch (err) {
      console.error('Failed to simulate surge', err);
    } finally {
      setSimulating(false);
    }
  };

  const handleApproveTransfer = async (opp) => {
    setExecutingTransferId(opp.id);
    try {
      // If opportunity has a transfer ID, approve it directly
      let trfId = opp.transfer_id;
      if (!trfId) {
        // Trigger autonomous rebalancing to generate records first
        await triggerRebalancing();
        const updatedOpps = await fetchRebalancingOpportunities();
        const found = updatedOpps.find((o) => o.id === opp.id);
        trfId = found ? found.transfer_id : null;
      }

      if (trfId) {
        const res = await approveRedistributionTransfer(trfId, 'supply_lead_1', opp.recommendation_reason);
        setExecutionSuccessMsg({
          title: 'Buffer Transfer Dispatched & Executed!',
          text: `Transferred ${res.details.buffer_bottles} bottles of ${opp.flavor_name} from ${opp.surplus_depot_name} to ${opp.deficit_depot_name}. Avoided ₹${opp.prevented_writeoff_loss.toLocaleString()} write-off for only ₹${res.details.cost_inr} redistribution cost.`,
          parcel: res.details.scan_parcel_code,
        });

        // Update local status
        setOpportunities((prev) =>
          prev.map((o) => (o.id === opp.id ? { ...o, status: 'in_transit' } : o))
        );

        // Refresh underlying data
        await loadForecast(selectedDepotId, selectedFlavorId, forecastHorizon);
        await loadMatrix();
      }
    } catch (err) {
      console.error('Failed to execute buffer transfer', err);
    } finally {
      setExecutingTransferId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-sm text-airtable-muted bg-white rounded-lg border border-airtable-hairline">
        <RefreshCw className="w-5 h-5 animate-spin text-airtable-ink" />
        <span>Initializing Depot Demand Forecaster & Redistribution Optimizer...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Sub-Navigation Bar ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-white border border-airtable-hairline shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-airtable-ink" />
            <h2 className="text-base font-medium text-airtable-ink">
              Depot Flavor Demand Forecasting & Autonomous Surplus-to-Deficit Redistribution
            </h2>
          </div>
          <p className="text-xs text-airtable-muted mt-0.5">
            Collects past historical demand by flavor & segment across 9 regional hubs, forecasts future pull, and automatically routes buffer stock at ₹1.50/btl to prevent Day-30 write-offs.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-airtable-surface-soft p-1 rounded-md border border-airtable-hairline text-xs font-medium">
          <button
            onClick={() => setActiveTab('rebalancing')}
            className={`px-3 py-1.5 rounded-sm transition-all flex items-center gap-1.5 ${
              activeTab === 'rebalancing'
                ? 'bg-white text-airtable-ink shadow-2xs border border-airtable-hairline font-medium'
                : 'text-airtable-muted hover:text-airtable-ink'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-airtable-forest" />
            Surplus-to-Deficit Arbitrage
            {opportunities.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-airtable-coral/10 text-airtable-coral font-mono font-medium border border-airtable-coral/30">
                {opportunities.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('forecasting')}
            className={`px-3 py-1.5 rounded-sm transition-all flex items-center gap-1.5 ${
              activeTab === 'forecasting'
                ? 'bg-white text-airtable-ink shadow-2xs border border-airtable-hairline font-medium'
                : 'text-airtable-muted hover:text-airtable-ink'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-airtable-link" />
            Depot Demand Forecaster
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-1.5 rounded-sm transition-all flex items-center gap-1.5 ${
              activeTab === 'matrix'
                ? 'bg-white text-airtable-ink shadow-2xs border border-airtable-hairline font-medium'
                : 'text-airtable-muted hover:text-airtable-ink'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-airtable-ink" />
            9-Depot Matrix Overview
          </button>
        </div>
      </div>

      {/* ── Notification Banners ──────────────────────────────────── */}
      {executionSuccessMsg && (
        <div className="p-4 rounded-lg bg-airtable-forest/10 border border-airtable-forest/30 text-xs text-airtable-forest flex items-start justify-between shadow-xs animate-fade-in">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-airtable-forest shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-sm text-airtable-forest">{executionSuccessMsg.title}</div>
              <p className="mt-0.5 leading-relaxed text-airtable-body">{executionSuccessMsg.text}</p>
              <div className="mt-2 font-mono text-[11px] text-airtable-forest bg-white px-2 py-0.5 rounded-xs border border-airtable-forest/20 inline-block">
                Dispatch Parcel RFID: {executionSuccessMsg.parcel}
              </div>
            </div>
          </div>
          <button
            onClick={() => setExecutionSuccessMsg(null)}
            className="text-airtable-forest font-medium hover:underline text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {surgeBanner && (
        <div className="p-4 rounded-lg bg-airtable-yellow/20 border border-airtable-yellow/60 text-xs text-airtable-ink flex items-start justify-between shadow-xs animate-fade-in">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-airtable-mustard shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-sm text-airtable-ink">
                Surge Event Simulated at {surgeBanner.depot} ({surgeBanner.flavor})
              </div>
              <p className="mt-0.5 leading-relaxed text-airtable-body">
                Registered sudden demand spike of <strong>{surgeBanner.units} bottles</strong>. Optimization engine automatically identified stagnant excess at <strong>{surgeBanner.surplusSource}</strong> and created an approval alert for a <strong>{surgeBanner.buffer} bottle buffer transfer</strong>.
              </p>
              <div className="mt-2 flex items-center gap-3 font-mono text-[11px]">
                <span className="bg-white text-airtable-ink px-2 py-0.5 rounded-xs border border-airtable-hairline font-medium">
                  ROI: {surgeBanner.roi}
                </span>
                <span className="text-airtable-ink">
                  Net Financial Arbitrage: +₹{surgeBanner.netGain.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setSurgeBanner(null)}
            className="text-airtable-ink font-medium hover:underline text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* TAB 1: SURPLUS-TO-DEFICIT REDISTRIBUTION & ARBITRAGE          */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {activeTab === 'rebalancing' && (
        <div className="space-y-6">
          {/* Top Arbitrage Telemetry Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-md p-4 bg-white border border-airtable-hairline shadow-xs">
              <div className="flex items-center justify-between text-xs text-airtable-muted font-medium mb-1">
                <span>Active Surge-Surplus Pairs</span>
                <Compass className="w-4 h-4 text-airtable-ink" />
              </div>
              <div className="text-2xl font-mono font-medium text-airtable-ink">
                {opportunities.length}
              </div>
              <div className="text-[11px] text-airtable-muted mt-1 font-normal">
                High-demand vs Stagnant stock
              </div>
            </div>

            <div className="rounded-md p-4 bg-white border border-airtable-hairline shadow-xs">
              <div className="flex items-center justify-between text-xs text-airtable-muted font-medium mb-1">
                <span>Redistribution Cost</span>
                <Truck className="w-4 h-4 text-airtable-ink" />
              </div>
              <div className="text-2xl font-mono font-medium text-airtable-ink">
                ₹1.50 <span className="text-xs font-normal text-airtable-muted">/ bottle</span>
              </div>
              <div className="text-[11px] text-airtable-muted mt-1 font-normal">
                Fixed inter-depot reefer freight
              </div>
            </div>

            <div className="rounded-md p-4 bg-white border border-airtable-hairline shadow-xs">
              <div className="flex items-center justify-between text-xs text-airtable-muted font-medium mb-1">
                <span>Avoided Write-Off</span>
                <ShieldCheck className="w-4 h-4 text-airtable-forest" />
              </div>
              <div className="text-2xl font-mono font-medium text-airtable-forest">
                ₹60.00 <span className="text-xs font-normal text-airtable-muted">/ bottle</span>
              </div>
              <div className="text-[11px] text-airtable-forest mt-1 font-normal">
                Day-30 rejection cliff prevented
              </div>
            </div>

            <div className="rounded-md p-4 bg-white border border-airtable-hairline shadow-xs">
              <div className="flex items-center justify-between text-xs text-airtable-muted font-medium mb-1">
                <span>Net Financial ROI Multiple</span>
                <DollarSign className="w-4 h-4 text-airtable-forest" />
              </div>
              <div className="text-2xl font-mono font-medium text-airtable-forest">
                52.8x <span className="text-xs font-normal text-airtable-muted">ROI</span>
              </div>
              <div className="text-[11px] text-airtable-forest font-medium mt-1">
                ₹77.70 net benefit / bottle
              </div>
            </div>
          </div>

          {/* Interactive Surge Simulation Bar (Hero Card Dark - No atmospheric gradient) */}
          <div className="rounded-lg bg-airtable-surface-dark text-white border border-airtable-hairline/20 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-airtable-mustard" />
                <h3 className="text-sm font-medium text-white">
                  Live Demand Surge Ingestion & Optimization Simulator
                </h3>
              </div>
              <span className="text-[11px] font-mono text-white/70">
                Test sudden viral spikes & observe automated path matching
              </span>
            </div>

            <form onSubmit={handleSimulateSurge} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block text-white/80 mb-1">Surging Depot</label>
                <select
                  value={surgeDepotId}
                  onChange={(e) => setSurgeDepotId(Number(e.target.value))}
                  className="w-full bg-airtable-surface-dark-elevated border border-white/20 rounded-sm px-2.5 py-1.5 text-white focus:outline-none focus:border-airtable-info-border"
                >
                  {DEPOTS.map((d) => (
                    <option key={d.id} value={d.id} className="bg-airtable-surface-dark text-white">
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-white/80 mb-1">Surging Flavor</label>
                <select
                  value={surgeFlavorId}
                  onChange={(e) => setSurgeFlavorId(Number(e.target.value))}
                  className="w-full bg-airtable-surface-dark-elevated border border-white/20 rounded-sm px-2.5 py-1.5 text-white focus:outline-none focus:border-airtable-info-border"
                >
                  {FLAVORS.map((f) => (
                    <option key={f.id} value={f.id} className="bg-airtable-surface-dark text-white">
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-white/80 mb-1">Channel Segment</label>
                <select
                  value={surgeSegment}
                  onChange={(e) => setSurgeSegment(e.target.value)}
                  className="w-full bg-airtable-surface-dark-elevated border border-white/20 rounded-sm px-2.5 py-1.5 text-white focus:outline-none focus:border-airtable-info-border"
                >
                  <option value="Quick Commerce" className="bg-airtable-surface-dark text-white">Quick Commerce (Dark Stores)</option>
                  <option value="Modern Trade" className="bg-airtable-surface-dark text-white">Modern Trade (Supermarkets)</option>
                  <option value="General Trade" className="bg-airtable-surface-dark text-white">General Trade (Distributors)</option>
                </select>
              </div>

              <div>
                <label className="block text-white/80 mb-1">Surge Multiplier</label>
                <select
                  value={surgeMultiplier}
                  onChange={(e) => setSurgeMultiplier(Number(e.target.value))}
                  className="w-full bg-airtable-surface-dark-elevated border border-white/20 rounded-sm px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-airtable-info-border"
                >
                  <option value="1.8" className="bg-airtable-surface-dark text-white">1.8x (+80% Spike)</option>
                  <option value="2.5" className="bg-airtable-surface-dark text-white">2.5x (+150% Viral Surge)</option>
                  <option value="3.5" className="bg-airtable-surface-dark text-white">3.5x (+250% Weekend Explosion)</option>
                  <option value="5.0" className="bg-airtable-surface-dark text-white">5.0x (+400% Extreme Viral)</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={simulating}
                  className="w-full bg-white hover:bg-airtable-surface-soft text-airtable-ink font-medium py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 active:scale-[0.98] transition-all disabled:opacity-50 text-xs shadow-xs"
                >
                  {simulating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Optimizing...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Trigger Surge</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Opportunities List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-airtable-ink">
                  Recommended Compatible Redistribution Corridors & Financial Arbitrage
                </h3>
                <p className="text-xs text-airtable-muted">
                  Pairs deficit nodes facing stockouts with stagnant surplus nodes facing Day-30 write-offs, enforcing the ₹1.50/btl viability test.
                </p>
              </div>
              <button
                onClick={loadAll}
                className="text-xs text-airtable-muted hover:text-airtable-ink flex items-center gap-1 font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh Pairs
              </button>
            </div>

            {opportunities.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-md border border-airtable-hairline text-airtable-muted text-xs space-y-2">
                <CheckCircle2 className="w-8 h-8 text-airtable-forest mx-auto" />
                <p className="font-medium text-airtable-ink">Network Currently In Equilibrium</p>
                <p>No extreme surplus-deficit imbalances detected. Use the simulator above to inject a sudden viral surge.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {opportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="p-4 rounded-md bg-white border border-airtable-hairline shadow-2xs space-y-4 hover:border-airtable-hairline-dark transition-colors"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-airtable-hairline">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-sm text-xs font-medium bg-airtable-surface-soft text-airtable-ink border border-airtable-hairline">
                          {opp.flavor_name}
                        </span>

                        <div className="flex items-center gap-1.5 text-xs font-medium text-airtable-ink">
                          <span className="font-medium text-airtable-mustard bg-airtable-yellow/20 px-2 py-0.5 rounded-sm border border-airtable-yellow/60">
                            {opp.surplus_depot_name} (Surplus {opp.surplus_cover_days}d cover)
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-airtable-muted" />
                          <span className="font-medium text-airtable-coral bg-airtable-coral/10 px-2 py-0.5 rounded-sm border border-airtable-coral/30">
                            {opp.deficit_depot_name} (Deficit {opp.deficit_cover_days}d cover)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs font-medium text-airtable-forest">
                            Compatibility: {opp.compatibility_score}%
                          </div>
                          <div className="text-[10px] text-airtable-muted font-mono">
                            {opp.distance_km} km · ~{opp.transit_hours}h transit
                          </div>
                        </div>

                        {opp.status === 'in_transit' ? (
                          <span className="px-2.5 py-1 rounded-sm text-xs font-medium bg-airtable-surface-soft text-airtable-forest border border-airtable-forest/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Dispatched / In-Transit
                          </span>
                        ) : (
                          <button
                            onClick={() => handleApproveTransfer(opp)}
                            disabled={executingTransferId === opp.id}
                            className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-airtable-primary text-white hover:bg-airtable-primary-active transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                          >
                            {executingTransferId === opp.id ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                Dispatching...
                              </>
                            ) : (
                              <>
                                <Truck className="w-3.5 h-3.5" />
                                Approve & Dispatch Buffer
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Financial Arbitrage Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3.5 rounded-sm bg-airtable-surface-soft border border-airtable-hairline text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-airtable-muted block font-sans">Buffer Quantity</span>
                        <span className="text-sm font-medium text-airtable-ink">
                          {opp.buffer_bottles.toLocaleString()} btls
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-airtable-muted block font-sans">Transfer Cost (@ ₹1.50)</span>
                        <span className="text-sm font-medium text-airtable-ink">
                          ₹{opp.total_redistribution_cost.toLocaleString()}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-airtable-muted block font-sans">Avoided Write-Off (@ ₹60)</span>
                        <span className="text-sm font-medium text-airtable-forest">
                          ₹{opp.prevented_writeoff_loss.toLocaleString()}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-airtable-muted block font-sans">Protected CM (@ ₹19.20)</span>
                        <span className="text-sm font-medium text-airtable-ink">
                          ₹{opp.protected_contribution_margin.toLocaleString()}
                        </span>
                      </div>

                      <div className="bg-airtable-cream/60 p-2 rounded-sm border border-airtable-hairline">
                        <span className="text-[10px] text-airtable-ink block font-sans font-medium">Net Arbitrage ROI</span>
                        <span className="text-sm font-medium text-airtable-forest">
                          +{opp.roi_multiple}x ROI (₹{opp.net_economic_benefit.toLocaleString()})
                        </span>
                      </div>
                    </div>

                    {/* Rationale & Corridor */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-airtable-muted">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-airtable-muted shrink-0" />
                        <span><strong>Corridor:</strong> {opp.corridor_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-medium text-airtable-forest bg-airtable-surface-soft border border-airtable-hairline px-2.5 py-1 rounded-sm">
                        <ShieldCheck className="w-3.5 h-3.5 text-airtable-forest" />
                        <span>Worth ₹1.50/btl cost: Beats distress discounting (₹30 loss) & prevents total write-off</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* TAB 2: DEPOT FLAVOR DEMAND FORECASTER & SEGMENTS              */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {activeTab === 'forecasting' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="p-4 rounded-md bg-white border border-airtable-hairline shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Depot Select */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-airtable-ink">Regional Depot:</span>
                <select
                  value={selectedDepotId}
                  onChange={(e) => handleDepotOrFlavorChange(Number(e.target.value), selectedFlavorId)}
                  className="text-xs border border-airtable-hairline rounded-sm px-2.5 py-1.5 font-medium bg-white text-airtable-ink shadow-2xs focus:border-airtable-info-border"
                >
                  {DEPOTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.region})
                    </option>
                  ))}
                </select>
              </div>

              {/* Horizon Select */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-airtable-ink">Forecast Horizon:</span>
                <div className="flex bg-airtable-surface-soft p-0.5 rounded-sm text-xs font-medium border border-airtable-hairline">
                  {[7, 14, 30].map((h) => (
                    <button
                      key={h}
                      onClick={() => {
                        setForecastHorizon(h);
                        loadForecast(selectedDepotId, selectedFlavorId, h);
                      }}
                      className={`px-2.5 py-1 rounded-xs transition-colors ${
                        forecastHorizon === h ? 'bg-white shadow-xs font-medium text-airtable-ink' : 'text-airtable-muted hover:text-airtable-ink'
                      }`}
                    >
                      {h} Days
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Flavor Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-airtable-hairline">
              <span className="text-xs font-medium text-airtable-muted">Flavor:</span>
              {FLAVORS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => handleDepotOrFlavorChange(selectedDepotId, f.id)}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${
                    selectedFlavorId === f.id
                      ? 'bg-airtable-primary text-white shadow-xs font-medium'
                      : 'bg-airtable-surface-soft text-airtable-muted hover:bg-airtable-surface-strong border border-airtable-hairline'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          {forecastData && (
            <div className="space-y-6">
              {/* Telemetry Strip for Selected Depot & Flavor */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-md p-4 bg-white border border-airtable-hairline shadow-2xs">
                  <div className="text-xs text-airtable-muted font-medium mb-1">On-Hand Stock</div>
                  <div className="text-2xl font-mono font-medium text-airtable-ink">
                    {forecastData.on_hand_stock.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-airtable-muted mt-1">
                    Max batch age: {forecastData.max_batch_age} days
                  </div>
                </div>

                <div className="rounded-md p-4 bg-white border border-airtable-hairline shadow-2xs">
                  <div className="text-xs text-airtable-muted font-medium mb-1">Daily Demand Rate</div>
                  <div className="text-2xl font-mono font-medium text-airtable-ink">
                    {forecastData.daily_run_rate} <span className="text-xs font-normal text-airtable-muted">btls/day</span>
                  </div>
                  <div className="text-[11px] text-airtable-muted font-medium mt-1">
                    Velocity ratio: {forecastData.velocity_ratio}x
                  </div>
                </div>

                <div className="rounded-md p-4 bg-white border border-airtable-hairline shadow-2xs">
                  <div className="text-xs text-airtable-muted font-medium mb-1">Days of Stock Cover</div>
                  <div className="text-2xl font-mono font-medium text-airtable-ink">
                    {forecastData.days_of_cover} <span className="text-xs font-normal text-airtable-muted">days</span>
                  </div>
                  <div className="mt-1">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-sm font-medium font-mono ${
                        forecastData.status === 'surge_deficit'
                          ? 'bg-airtable-coral/10 text-airtable-coral border border-airtable-coral/30'
                          : forecastData.status === 'surplus_stagnant'
                          ? 'bg-airtable-yellow/20 text-airtable-mustard border border-airtable-yellow/60'
                          : 'bg-airtable-surface-soft text-airtable-forest border border-airtable-forest/30'
                      }`}
                    >
                      {forecastData.status.toUpperCase().replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="rounded-md p-4 bg-white border border-airtable-hairline shadow-2xs">
                  <div className="text-xs text-airtable-muted font-medium mb-1">Projected {forecastHorizon}d Demand</div>
                  <div className="text-2xl font-mono font-medium text-airtable-ink">
                    {forecastData.forecast_p50.reduce((a, b) => a + b, 0).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-airtable-muted font-medium mt-1">
                    P10: {forecastData.forecast_p10.reduce((a, b) => a + b, 0)} · P90: {forecastData.forecast_p90.reduce((a, b) => a + b, 0)}
                  </div>
                </div>
              </div>

              {/* Downstream Segments & Distributors Grid */}
              <div className="rounded-md bg-white border border-airtable-hairline shadow-2xs p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-airtable-ink">
                    Downstream Distribution Segments & Designated Distributors
                  </h3>
                  <p className="text-xs text-airtable-muted">
                    Depot supplies to different customer segments and downstream distribution networks.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {forecastData.segments.map((seg) => (
                    <div
                      key={seg.segment}
                      className="p-3.5 rounded-md bg-white border border-airtable-hairline space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-airtable-ink">{seg.segment}</span>
                        <span className="text-[11px] font-mono text-airtable-ink font-medium bg-airtable-surface-soft px-2 py-0.5 rounded-sm border border-airtable-hairline">
                          {seg.share_pct}%
                        </span>
                      </div>

                      <div className="text-xs text-airtable-muted">
                        <span className="block font-medium text-airtable-ink truncate" title={seg.distributor_name}>
                          {seg.distributor_name}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-airtable-hairline space-y-1 text-xs font-mono">
                        <div className="flex justify-between text-airtable-muted">
                          <span>Daily Avg:</span>
                          <span className="font-medium text-airtable-ink">{seg.historical_daily_avg} btls</span>
                        </div>
                        <div className="flex justify-between text-airtable-muted">
                          <span>7d Forecast:</span>
                          <span className="font-medium text-airtable-ink">{seg.forecast_7d} btls</span>
                        </div>
                        <div className="flex justify-between text-airtable-muted">
                          <span>14d Forecast:</span>
                          <span className="font-medium text-airtable-ink">{seg.forecast_14d} btls</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Historical vs Forecast Chart */}
              <div className="rounded-md bg-white border border-airtable-hairline shadow-2xs p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-airtable-ink">
                      Demand Trajectory: Past Historical Actuals vs Statistical Forecast (P10 / P50 / P90)
                    </h3>
                    <p className="text-xs text-airtable-muted">
                      21-day historical actuals followed by {forecastHorizon}-day confidence intervals.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="flex items-center gap-1.5 text-airtable-muted">
                      <span className="w-2.5 h-2.5 rounded-xs bg-airtable-surface-strong border border-airtable-hairline inline-block" /> Historical
                    </span>
                    <span className="flex items-center gap-1.5 text-airtable-ink font-medium">
                      <span className="w-2.5 h-2.5 rounded-xs bg-airtable-primary inline-block" /> Forecast P50
                    </span>
                    <span className="flex items-center gap-1.5 text-airtable-muted">
                      <span className="w-2.5 h-2.5 rounded-xs bg-airtable-primary/20 inline-block" /> P10-P90 Range
                    </span>
                  </div>
                </div>

                {/* Visual SVG Chart */}
                <div className="h-64 w-full bg-airtable-surface-soft rounded-md border border-airtable-hairline p-4 relative flex items-end">
                  <div className="w-full h-full flex items-end gap-1 overflow-x-auto pb-2">
                    {/* Historical bars */}
                    {forecastData.historical_units.map((u, i) => {
                      const maxVal = Math.max(
                        ...forecastData.historical_units,
                        ...forecastData.forecast_p90,
                        40
                      );
                      const heightPct = Math.min(100, (u / maxVal) * 100);
                      return (
                        <div
                          key={`hist-${i}`}
                          className="flex-1 flex flex-col items-center justify-end group relative min-w-[14px]"
                        >
                          <div
                            style={{ height: `${heightPct}%` }}
                            className="w-full bg-airtable-muted hover:bg-airtable-ink/40 rounded-t-xs transition-all"
                          />
                          <span className="absolute -top-7 hidden group-hover:block bg-airtable-primary text-white text-[10px] px-1.5 py-0.5 rounded-sm font-mono z-10 whitespace-nowrap">
                            Hist: {u} btls
                          </span>
                        </div>
                      );
                    })}

                    {/* Divider line */}
                    <div className="w-px h-full bg-airtable-hairline border-dashed opacity-75 shrink-0 mx-1" />

                    {/* Forecast bars */}
                    {forecastData.forecast_p50.map((u, i) => {
                      const maxVal = Math.max(
                        ...forecastData.historical_units,
                        ...forecastData.forecast_p90,
                        40
                      );
                      const p50Height = Math.min(100, (u / maxVal) * 100);
                      const p90Height = Math.min(100, (forecastData.forecast_p90[i] / maxVal) * 100);
                      return (
                        <div
                          key={`fcst-${i}`}
                          className="flex-1 flex flex-col items-center justify-end group relative min-w-[14px]"
                        >
                          {/* P90 Range Background */}
                          <div
                            style={{ height: `${p90Height}%` }}
                            className="w-full bg-airtable-primary/10 rounded-t-xs absolute bottom-0"
                          />
                          {/* P50 Median Bar */}
                          <div
                            style={{ height: `${p50Height}%` }}
                            className="w-full bg-airtable-primary hover:bg-airtable-primary-active rounded-t-xs transition-all relative z-1"
                          />
                          <span className="absolute -top-7 hidden group-hover:block bg-airtable-primary text-white text-[10px] px-1.5 py-0.5 rounded-sm font-mono z-10 whitespace-nowrap">
                            P50: {u} (P10: {forecastData.forecast_p10[i]} - P90: {forecastData.forecast_p90[i]})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════ */}
      {/* TAB 3: 9-DEPOT MATRIX OVERVIEW                                */}
      {/* ═════════════════════════════════════════════════════════════ */}
      {activeTab === 'matrix' && matrixData && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-airtable-ink">
                Network-Wide 9-Depot x 5-Flavor Inventory & Demand Coverage Matrix
              </h3>
              <p className="text-xs text-airtable-muted">
                Color-coded by stock cover health: Red = Surge Deficit (&lt;5.5d), Yellow = Stagnant Surplus (&gt;18d), Green = Healthy (6-16d).
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="px-2 py-0.5 rounded-sm bg-airtable-coral/10 text-airtable-coral border border-airtable-coral/30 font-medium">
                Deficits: {matrixData.summary.deficit_count}
              </span>
              <span className="px-2 py-0.5 rounded-sm bg-airtable-yellow/20 text-airtable-mustard border border-airtable-yellow/60 font-medium">
                Surpluses: {matrixData.summary.surplus_count}
              </span>
              <span className="px-2 py-0.5 rounded-sm bg-airtable-surface-soft text-airtable-forest border border-airtable-forest/30 font-medium">
                Healthy: {matrixData.summary.healthy_count}
              </span>
            </div>
          </div>

          <div className="rounded-md bg-white border border-airtable-hairline shadow-2xs overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-airtable-surface-soft border-b border-airtable-hairline text-airtable-muted font-medium">
                  <th className="p-2.5 font-medium">Depot Hub</th>
                  <th className="p-2.5 font-medium">Region</th>
                  {FLAVORS.map((f) => (
                    <th key={f.id} className="p-2.5 text-center font-medium">
                      {f.name}
                    </th>
                  ))}
                  <th className="p-2.5 text-right font-medium">Total Stock</th>
                  <th className="p-2.5 text-right font-medium">14d Forecast</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-airtable-hairline">
                {matrixData.depots.map((d) => (
                  <tr key={d.depot_id} className="hover:bg-airtable-surface-soft/40 transition-colors">
                    <td className="p-2.5 font-medium text-airtable-ink">{d.depot_name}</td>
                    <td className="p-2.5 text-airtable-muted">{d.region}</td>
                    {d.flavors.map((fl) => (
                      <td key={fl.flavor_id} className="p-2 text-center">
                        <button
                          onClick={() => {
                            setSelectedDepotId(d.depot_id);
                            setSelectedFlavorId(fl.flavor_id);
                            setActiveTab('forecasting');
                            loadForecast(d.depot_id, fl.flavor_id, 14);
                          }}
                          className={`w-full p-2 rounded-sm text-[11px] font-mono transition-opacity hover:opacity-80 ${
                            fl.status === 'surge_deficit'
                              ? 'bg-airtable-coral/10 text-airtable-coral border border-airtable-coral/30 font-medium'
                              : fl.status === 'surplus_stagnant'
                              ? 'bg-airtable-yellow/20 text-airtable-mustard border border-airtable-yellow/60 font-medium'
                              : 'bg-airtable-surface-soft text-airtable-forest border border-airtable-hairline font-medium'
                          }`}
                        >
                          <div>{fl.stock} btls</div>
                          <div className="text-[10px] opacity-80">{fl.days_of_cover}d cover</div>
                        </button>
                      </td>
                    ))}
                    <td className="p-2.5 text-right font-mono font-medium text-airtable-ink">
                      {d.total_stock.toLocaleString()}
                    </td>
                    <td className="p-2.5 text-right font-mono text-airtable-ink font-medium">
                      {d.total_forecast_14d.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
