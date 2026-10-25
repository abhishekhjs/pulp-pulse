const API_BASE = '/api';

export async function fetchKpiScorecard() {
  const res = await fetch(`${API_BASE}/kpi/scorecard`);
  if (!res.ok) throw new Error('Failed to fetch KPI scorecard');
  return res.json();
}

export async function fetchKpiHistory(kpiCode) {
  const res = await fetch(`${API_BASE}/kpi/${kpiCode}/history`);
  if (!res.ok) throw new Error(`Failed to fetch history for ${kpiCode}`);
  return res.json();
}

export async function fetchAlerts(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/alerts${query ? `?${query}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

export async function approveAlert(id, payload = {}) {
  const res = await fetch(`${API_BASE}/alerts/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approver: payload.approver || 'planner_1', note: payload.note || '' }),
  });
  if (!res.ok) throw new Error('Failed to approve alert');
  return res.json();
}

export async function overrideAlert(id, payload = {}) {
  const res = await fetch(`${API_BASE}/alerts/${id}/override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: payload.user || 'planner_1',
      reason_code: payload.reason_code || 'other',
      note: payload.note || '',
    }),
  });
  if (!res.ok) throw new Error('Failed to override alert');
  return res.json();
}

export async function fetchDepots() {
  const res = await fetch(`${API_BASE}/depots`);
  if (!res.ok) throw new Error('Failed to fetch depots');
  return res.json();
}

export async function fetchDepotBatches(depotId) {
  const res = await fetch(`${API_BASE}/depots/${depotId}/batches`);
  if (!res.ok) throw new Error('Failed to fetch batches');
  return res.json();
}

export async function fetchTransfers(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/transfers${query ? `?${query}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch transfers');
  return res.json();
}

export async function createTransfer(payload) {
  const res = await fetch(`${API_BASE}/transfers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create transfer');
  return res.json();
}

export async function runScenarioReplay() {
  const res = await fetch(`${API_BASE}/scenario/replay`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to run scenario replay');
  return res.json();
}

export async function fetchScenarioRun(runId) {
  const res = await fetch(`${API_BASE}/scenario/replay/${runId}`);
  if (!res.ok) throw new Error('Failed to fetch scenario replay result');
  return res.json();
}

export async function runMonteCarlo(flavorId, payload = {}) {
  const res = await fetch(`${API_BASE}/forecast/${flavorId}/monte-carlo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to run Monte Carlo stress test');
  return res.json();
}

export async function ingestScan(payload) {
  const res = await fetch(`${API_BASE}/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to ingest scan event');
  return res.json();
}

export async function fetchScans(limit = 20) {
  const res = await fetch(`${API_BASE}/scans?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch scan events');
  return res.json();
}

export async function fetchModuleDemand() {
  const res = await fetch(`${API_BASE}/modules/demand`);
  if (!res.ok) throw new Error('Failed to fetch Demand module data');
  return res.json();
}

export async function fetchModuleSupply() {
  const res = await fetch(`${API_BASE}/modules/supply`);
  if (!res.ok) throw new Error('Failed to fetch Supply module data');
  return res.json();
}

export async function fetchModuleInventory() {
  const res = await fetch(`${API_BASE}/modules/inventory`);
  if (!res.ok) throw new Error('Failed to fetch Inventory module data');
  return res.json();
}

export async function fetchModuleDistribution() {
  const res = await fetch(`${API_BASE}/modules/distribution`);
  if (!res.ok) throw new Error('Failed to fetch Distribution module data');
  return res.json();
}

export async function fetchModuleTransportation() {
  const res = await fetch(`${API_BASE}/modules/transportation`);
  if (!res.ok) throw new Error('Failed to fetch Transportation module data');
  return res.json();
}

export async function fetchFlavorForecast(flavorId, channel = 'QC', horizon = 14, cutoff = null) {
  const query = new URLSearchParams({ channel, horizon_days: horizon });
  if (cutoff) query.append('cutoff', cutoff);
  const res = await fetch(`${API_BASE}/forecast/${flavorId}?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch forecast for flavor ${flavorId}`);
  return res.json();
}

export async function fetchGraphsCatalog() {
  const res = await fetch(`${API_BASE}/graphs/catalog`);
  if (!res.ok) throw new Error('Failed to fetch Matplotlib graphs catalog');
  return res.json();
}

export async function fetchGraphDetail(graphId) {
  const res = await fetch(`${API_BASE}/graphs/${graphId}`);
  if (!res.ok) throw new Error(`Failed to fetch graph detail for ${graphId}`);
  return res.json();
}

export async function regenerateAllGraphs() {
  const res = await fetch(`${API_BASE}/graphs/generate-all`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to regenerate backend graphs');
  return res.json();
}

export function getGraphImageUrl(graphId, params = {}) {
  const query = new URLSearchParams(params).toString();
  return `${API_BASE}/graphs/${graphId}.png${query ? `?${query}` : ''}`;
}

export async function fetchGraphPlotlyFigure(graphId, params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/graphs/${graphId}/plotly${query ? `?${query}` : ''}`);
  if (!res.ok) throw new Error(`Failed to fetch Plotly figure for graph ${graphId}`);
  return res.json();
}

export async function fetchGraphPlotlyData(graphId, params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/graphs/${graphId}/data${query ? `?${query}` : ''}`);
  if (!res.ok) throw new Error(`Failed to fetch data for graph ${graphId}`);
  return res.json();
}

export async function fetchAllGraphsPlotlyData() {
  const res = await fetch(`${API_BASE}/graphs/data/all`);
  if (!res.ok) throw new Error('Failed to fetch all graphs data');
  return res.json();
}

// ── Depot Demand Forecasting & Surplus-to-Deficit Redistribution ───
export async function fetchDepotForecastMatrix() {
  const res = await fetch(`${API_BASE}/depot-forecast/matrix`);
  if (!res.ok) throw new Error('Failed to fetch depot forecast matrix');
  return res.json();
}

export async function fetchDepotFlavorForecast(depotId, flavorId, horizonDays = 14) {
  const res = await fetch(`${API_BASE}/depot-forecast/${depotId}/flavor/${flavorId}?horizon_days=${horizonDays}`);
  if (!res.ok) throw new Error(`Failed to fetch forecast for depot ${depotId} flavor ${flavorId}`);
  return res.json();
}

export async function fetchRebalancingOpportunities(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/depot-forecast/rebalancing/opportunities${query ? `?${query}` : ''}`);
  if (!res.ok) throw new Error('Failed to fetch rebalancing opportunities');
  return res.json();
}

export async function triggerRebalancing() {
  const res = await fetch(`${API_BASE}/depot-forecast/rebalancing/trigger`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to trigger autonomous rebalancing');
  return res.json();
}

export async function simulateSurge(payload) {
  const res = await fetch(`${API_BASE}/depot-forecast/simulate-surge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to simulate demand surge');
  return res.json();
}

export async function approveRedistributionTransfer(transferId, approver = 'supply_lead_1', note = '') {
  const query = new URLSearchParams({ approver, note }).toString();
  const res = await fetch(`${API_BASE}/depot-forecast/rebalancing/approve/${transferId}?${query}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to approve redistribution transfer');
  return res.json();
}

// ── Multi-Modal Logistics & Weather Surveillance ──
export async function fetchCorridors() {
  const res = await fetch(`${API_BASE}/logistics/corridors`);
  if (!res.ok) throw new Error('Failed to fetch corridors list');
  return res.json();
}

export async function fetchOptimizedRoutes(corridorId = 'coop_to_plant', cargoType = null, volumeKg = null, urgencyLevel = 'balanced') {
  const query = new URLSearchParams({
    corridor_id: corridorId,
    urgency_level: urgencyLevel,
  });
  if (cargoType) query.append('cargo_type', cargoType);
  if (volumeKg) query.append('volume_kg', volumeKg);
  const res = await fetch(`${API_BASE}/logistics/routes/optimize?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch optimized routes');
  return res.json();
}

export async function fetchImportQuarterlyTiming(quarter = 'Q2') {
  const res = await fetch(`${API_BASE}/logistics/import-timing?quarter=${quarter}`);
  if (!res.ok) throw new Error('Failed to fetch import quarterly timing');
  return res.json();
}

export async function calculatePoPlacement(targetArrivalDate = '2027-05-20', volumeKg = 24000, ingredient = 'Dragonfruit Pulp') {
  const res = await fetch(`${API_BASE}/logistics/import-timing/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_arrival_date: targetArrivalDate,
      volume_kg: Number(volumeKg),
      ingredient,
    }),
  });
  if (!res.ok) throw new Error('Failed to calculate PO placement');
  return res.json();
}

export async function fetchCooperativeWeatherWatch() {
  const res = await fetch(`${API_BASE}/logistics/weather-watch`);
  if (!res.ok) throw new Error('Failed to fetch cooperative weather watch');
  return res.json();
}

export async function simulateCooperativeWeather(scenario = 'rain_warning') {
  const res = await fetch(`${API_BASE}/logistics/weather-watch/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario }),
  });
  if (!res.ok) throw new Error('Failed to simulate cooperative weather');
  return res.json();
}
