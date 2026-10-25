import React, { useState, useEffect } from 'react';
import {
  CloudRain,
  Mountain,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  MapPin,
  TrendingUp,
  Compass,
  ArrowRight,
  Sun,
  Flame,
  Radio,
  Sliders,
} from 'lucide-react';
import { fetchCooperativeWeatherWatch, simulateCooperativeWeather } from '../../lib/api';

export default function WeatherWatchPanel() {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simFeedback, setSimFeedback] = useState(null);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchCooperativeWeatherWatch();
      setWeatherData(res);
    } catch (err) {
      console.error('Failed to load weather watch telemetry', err);
      setError(err.message || 'Could not fetch weather telemetry');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async (scenario) => {
    try {
      setSimulating(true);
      const res = await simulateCooperativeWeather(scenario);
      setWeatherData(res.telemetry);
      setSimFeedback(`Weather scenario '${scenario}' applied: ${res.alerts_raised_count} alert(s) evaluated.`);
      setTimeout(() => setSimFeedback(null), 4500);
    } catch (err) {
      console.error('Failed to simulate weather scenario', err);
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    loadData();
    // Poll telemetry every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !weatherData) {
    return (
      <div className="flex h-64 items-center justify-center gap-3 text-sm text-airtable-muted">
        <RefreshCw className="w-5 h-5 animate-spin text-airtable-ink" />
        <span>Polling Cooperative Sourcing Weather Telemetry & IMD Radar...</span>
      </div>
    );
  }

  if (error && !weatherData) {
    return (
      <div className="p-6 rounded-lg bg-rose-50 border border-rose-200 text-center space-y-3">
        <AlertTriangle className="w-6 h-6 text-rose-600 mx-auto" />
        <div className="text-sm font-semibold text-airtable-ink">Unable to load weather telemetry</div>
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

  const { cooperative, telemetry, forecast_7day, mitigation_playbook } = weatherData || {};
  const isBlock = telemetry?.road_status === 'BLOCKED_LANDSLIDE';
  const isCaution = telemetry?.road_status === 'CAUTION_DEBRIS' || telemetry?.road_status === 'HIGH_LANDSLIDE_RISK';

  return (
    <div className="space-y-6">
      {/* ── Control Header: Live Status & Simulation Controls ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-airtable-hairline">
          <div>
            <div className="flex items-center gap-2">
              <span className="section-label">Geological & Meteorological Surveillance</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono font-medium bg-airtable-surface-soft text-airtable-forest border border-airtable-forest/30">
                <Radio className="w-2.5 h-2.5 animate-pulse text-airtable-forest" />
                Live Automated Radar Stream
              </span>
            </div>
            <h3 className="text-base font-medium text-airtable-ink mt-0.5">
              Cooperative Area Weather, Roadblock & Landslide Hazard Surveillance
            </h3>
            <p className="text-xs text-airtable-muted mt-0.5">
              Continuous monitoring of {cooperative?.name} ({cooperative?.location} · {cooperative?.primary_highway}) to detect pre-monsoon landslides before highway cutoff.
            </p>
          </div>

          {/* Refresh & Status */}
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="btn-secondary text-xs font-medium py-1.5 px-3 rounded-md flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync Sensors
            </button>
          </div>
        </div>

        {/* ── Interactive Scenario Simulation Bar ── */}
        <div className="p-3.5 rounded-md bg-airtable-surface-soft border border-airtable-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-mono font-medium text-airtable-ink uppercase block">
              Weather Scenario Injector (Agent Stress Test)
            </span>
            <span className="text-[11px] text-airtable-muted">
              Trigger simulated geological conditions to observe autonomous agent alerting and re-routing.
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleSimulate('clear')}
              disabled={simulating}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-medium bg-white border border-airtable-hairline hover:bg-airtable-surface-soft text-airtable-ink transition-colors shadow-2xs"
            >
              <Sun className="w-3.5 h-3.5 text-airtable-mustard" />
              Clear Skies (0mm)
            </button>
            <button
              onClick={() => handleSimulate('rain_warning')}
              disabled={simulating}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-medium bg-white border border-airtable-yellow/60 hover:bg-airtable-surface-soft text-airtable-mustard transition-colors shadow-2xs"
            >
              <CloudRain className="w-3.5 h-3.5 text-airtable-mustard" />
              Heavy Rain Warning (96mm)
            </button>
            <button
              onClick={() => handleSimulate('landslide_block')}
              disabled={simulating}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-medium bg-white border border-airtable-coral/40 hover:bg-airtable-surface-soft text-airtable-coral transition-colors shadow-2xs"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-airtable-coral" />
              Major Landslide Block (194mm)
            </button>
          </div>
        </div>

        {simFeedback && (
          <div className="p-2.5 rounded-sm bg-airtable-surface-soft border border-airtable-forest/30 text-xs text-airtable-forest font-medium animate-fadeIn">
            ✓ {simFeedback}
          </div>
        )}

        {/* ── Live Weather Telemetry Metric Strips ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 pt-1">
          {/* 1. Highway Passability */}
          <div
            className={`rounded-md p-4 border shadow-2xs ${
              isBlock
                ? 'bg-white border-airtable-coral/40 ring-1 ring-airtable-coral/30'
                : isCaution
                ? 'bg-white border-airtable-yellow/60'
                : 'bg-white border-airtable-hairline'
            }`}
          >
            <span className="text-[10px] font-mono uppercase font-medium block mb-1 text-airtable-muted">
              Highway Status (NH-58)
            </span>
            <div
              className={`text-xl font-mono font-medium leading-none ${
                isBlock ? 'text-airtable-coral' : isCaution ? 'text-airtable-mustard' : 'text-airtable-forest'
              }`}
            >
              {telemetry?.road_passability_pct}% Open
            </div>
            <div className="text-[11px] font-medium mt-1.5 text-airtable-ink line-clamp-1">
              {telemetry?.road_status_label}
            </div>
          </div>

          {/* 2. Landslide Hazard Score */}
          <div className="rounded-md p-4 bg-white border border-airtable-hairline shadow-2xs">
            <span className="text-[10px] font-mono uppercase text-airtable-muted font-medium block mb-1">
              Landslide Hazard Index
            </span>
            <div className="text-xl font-mono font-medium text-airtable-ink leading-none">
              {telemetry?.landslide_hazard_score} / 100
            </div>
            <div
              className={`text-[11px] font-medium mt-1.5 ${
                telemetry?.landslide_hazard_score >= 80
                  ? 'text-airtable-coral'
                  : telemetry?.landslide_hazard_score >= 60
                  ? 'text-airtable-mustard'
                  : 'text-airtable-forest'
              }`}
            >
              Level: {telemetry?.landslide_hazard_level} Hazard
            </div>
          </div>

          {/* 3. 48h Rainfall Accumulation */}
          <div className="rounded-md p-4 bg-white border border-airtable-hairline shadow-2xs">
            <span className="text-[10px] font-mono uppercase text-airtable-muted font-medium block mb-1">
              48h Rain Accumulation
            </span>
            <div className="text-xl font-mono font-medium text-airtable-ink leading-none">
              {telemetry?.rainfall_48h_mm} mm
            </div>
            <div className="text-[11px] text-airtable-muted font-mono mt-1.5">
              24h: {telemetry?.rainfall_24h_mm}mm | 72h: {telemetry?.rainfall_72h_mm}mm
            </div>
          </div>

          {/* 4. Soil Saturation Index */}
          <div className="rounded-md p-4 bg-white border border-airtable-hairline shadow-2xs">
            <span className="text-[10px] font-mono uppercase text-airtable-muted font-medium block mb-1">
              Soil Saturation (API)
            </span>
            <div className="text-xl font-mono font-medium text-airtable-ink leading-none">
              {telemetry?.soil_saturation_api_pct}%
            </div>
            <div className="text-[11px] text-airtable-muted font-medium mt-1.5">
              Critical threshold: &gt;75%
            </div>
          </div>

          {/* 5. Historical May Closure Probability */}
          <div className="rounded-md p-4 bg-white border border-airtable-hairline shadow-2xs">
            <span className="text-[10px] font-mono uppercase text-airtable-muted font-medium block mb-1">
              Historical Closure Risk
            </span>
            <div className="text-xl font-mono font-medium text-airtable-coral leading-none">
              60.0%
            </div>
            <div className="text-[11px] text-airtable-muted font-medium mt-1.5">
              Closed in 3 of last 5 summers
            </div>
          </div>
        </div>
      </div>

      {/* ── Active Roadblock & Mitigation Strategy Callout ── */}
      <div
        className={`rounded-md p-4 border shadow-2xs space-y-3 ${
          isBlock
            ? 'bg-airtable-coral/10 border-airtable-coral/30'
            : isCaution
            ? 'bg-airtable-yellow/20 border-airtable-yellow/60'
            : 'bg-airtable-surface-soft border-airtable-hairline'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isBlock ? (
              <ShieldAlert className="w-5 h-5 text-airtable-coral" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-airtable-forest" />
            )}
            <h4
              className={`text-xs font-mono font-medium uppercase ${
                isBlock ? 'text-airtable-coral' : 'text-airtable-forest'
              }`}
            >
              {isBlock
                ? 'CRITICAL ALERT: ACTIVE HIGHWAY ROADBLOCK IN COOPERATIVE SECTOR'
                : 'SURVEILLANCE ADVISORY & MITIGATION DIRECTIVE'}
            </h4>
          </div>
          <span className="text-xs font-mono font-medium text-airtable-muted">
            {telemetry?.active_roadblocks_count} Active Blockage(s) Reported
          </span>
        </div>

        <div className="text-xs leading-relaxed space-y-2">
          {telemetry?.roadblock_location && telemetry?.roadblock_location !== 'None (All corridors operational)' && (
            <div className="flex items-center gap-2 font-mono font-medium text-airtable-coral">
              <MapPin className="w-3.5 h-3.5 text-airtable-coral flex-shrink-0" />
              <span>Location: {telemetry.roadblock_location}</span>
              <span className="text-airtable-muted">· Estimated Clearance: {telemetry.clearance_eta_hrs}h</span>
            </div>
          )}

          <p className="font-normal text-airtable-ink">
            {mitigation_playbook?.action_recommendation}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t border-airtable-hairline font-mono text-[11px]">
            <div>
              <span className="text-airtable-muted block text-[10px]">Plant Puree Safety Buffer:</span>
              <strong className="text-airtable-ink font-medium">
                {mitigation_playbook?.pulp_buffer_target_days} Days Required
              </strong>
            </div>
            <div>
              <span className="text-airtable-muted block text-[10px]">Foothills Bypass Hub:</span>
              <strong className="text-airtable-ink font-medium">
                {cooperative?.primary_railhead_bypass}
              </strong>
            </div>
            <div>
              <span className="text-airtable-muted block text-[10px]">Averted Panic Air Freight:</span>
              <strong className="text-airtable-forest font-medium">
                ₹{mitigation_playbook?.air_freight_cost_penalty_inr_cr} Cr Protected
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── 7-Day Predictive Weather & Landslide Outlook ── */}
      <div className="rounded-lg bg-white border border-airtable-hairline p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="section-label">7-Day Meteorological Horizon</span>
            <h4 className="text-sm font-medium text-airtable-ink">
              IMD Radar & Predictive Landslide Threat Outlook
            </h4>
          </div>
          <span className="text-xs font-mono text-airtable-muted">
            Joshimath–Chamoli Corridor
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5">
          {forecast_7day &&
            forecast_7day.map((f) => {
              const isSevere = f.risk_tier === 'Severe';
              const isHigh = f.risk_tier === 'High';
              return (
                <div
                  key={f.day}
                  className={`p-3 rounded-md border flex flex-col justify-between ${
                    isSevere
                      ? 'bg-airtable-coral/10 border-airtable-coral/30'
                      : isHigh
                      ? 'bg-airtable-yellow/20 border-airtable-yellow/60'
                      : 'bg-airtable-surface-soft border-airtable-hairline'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono font-medium mb-1">
                      <span>{f.day.split(' ')[0]}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-xs text-[9px] font-medium ${
                          f.imd_alert === 'Red'
                            ? 'bg-airtable-coral text-white'
                            : f.imd_alert === 'Orange'
                            ? 'bg-airtable-mustard text-white'
                            : f.imd_alert === 'Yellow'
                            ? 'bg-airtable-yellow/30 text-airtable-ink border border-airtable-yellow/60'
                            : 'bg-airtable-surface-soft text-airtable-forest border border-airtable-forest/30'
                        }`}
                      >
                        {f.imd_alert}
                      </span>
                    </div>

                    <div className="text-xs font-medium text-airtable-ink mb-2">
                      {f.condition}
                    </div>

                    <div className="space-y-1 text-[10px] font-mono">
                      <div className="flex justify-between">
                        <span className="text-airtable-muted">Rain:</span>
                        <strong className="text-airtable-ink font-medium">{f.rainfall_mm} mm</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-airtable-muted">Temp:</span>
                        <span className="text-airtable-muted">{f.temp_high_c}° / {f.temp_low_c}°</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-airtable-muted">Slide Risk:</span>
                        <strong
                          className={
                            f.landslide_risk_pct > 70
                              ? 'text-airtable-coral font-medium'
                              : f.landslide_risk_pct > 40
                              ? 'text-airtable-mustard font-medium'
                              : 'text-airtable-forest font-medium'
                          }
                        >
                          {f.landslide_risk_pct}%
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-airtable-hairline text-[10px] text-airtable-muted font-normal">
                    {f.highway_passability}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
