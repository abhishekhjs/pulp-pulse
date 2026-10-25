import React from 'react';
import { RefreshCw } from 'lucide-react';

const PAGE_META = {
  dashboard: {
    title: 'Executive Scorecard',
    sub: '31-metric continuous telemetry across 5 operational domains',
  },
  alerts: {
    title: 'Alerts & Approvals',
    sub: 'Human-in-the-loop decision routing by authority tier and DMAC recalibration',
  },
  demand: {
    title: 'Demand Sensing & Forecasting',
    sub: '14-day SARIMAX trajectories, exogenous weighting, and Monte Carlo buffer optimization',
  },
  supply: {
    title: 'Supply & Co-Packer Operations',
    sub: 'Plant utilization, aseptic puree buffers, blending schedules, and landed cost telemetry',
  },
  inventory: {
    title: 'Inventory & Freshness Clocks',
    sub: 'Batch freshness tracking, D18 cliff triggers, and handheld RFID/barcode scan ingestion',
  },
  distribution: {
    title: 'Multi-Channel Distribution',
    sub: 'Regional depot balancing, inter-depot rebalancing transfers, and fair-share fulfillment',
  },
  transportation: {
    title: 'Transportation & Cold Chain',
    sub: 'Reefer fleet thermal sensors, corridor risk windows, and air freight premium tracking',
  },
  graphs: {
    title: 'Supply Chain Chart Studio',
    sub: 'All 25 operational supply chain performance and telemetry charts',
  },
  scenario: {
    title: 'Scenario Replay',
    sub: 'Last summer actuals vs. autonomous agent layer: case evidence',
  },
};

export default function TopBar({ activeTab, onRefresh, refreshing, wsConnected }) {
  const page = PAGE_META[activeTab] || PAGE_META.dashboard;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-5 sm:px-8 h-16 flex-shrink-0 bg-white border-b border-airtable-hairline">
      <div className="min-w-0">
        <h1 className="text-base sm:text-lg font-medium text-airtable-ink leading-tight truncate">
          {page.title}
        </h1>
        <p className="text-xs text-airtable-muted truncate hidden sm:block mt-0.5">
          {page.sub}
        </p>
      </div>

      <div className="flex items-center gap-2.5 flex-shrink-0 ml-4">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="btn-secondary"
            title="Refresh scorecard telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}
      </div>
    </header>
  );
}
