import React from 'react';
import {
  Activity,
  Bell,
  RotateCcw,
  Zap,
  TrendingUp,
  Factory,
  Package,
  Share2,
  Truck,
  LineChart,
} from 'lucide-react';

const NAV_GROUPS = [
  {
    group: 'Command',
    items: [
      { id: 'dashboard', label: 'Scorecard', icon: Activity, description: '31 KPI telemetry' },
      { id: 'alerts', label: 'Alerts & Approvals', icon: Bell, description: 'Human-in-the-loop routing' },
    ],
  },
  {
    group: 'Supply Chain Modules',
    items: [
      { id: 'demand', label: 'Demand', icon: TrendingUp, description: 'SARIMAX & market sensing' },
      { id: 'supply', label: 'Supply', icon: Factory, description: 'Co-packers & puree buffers' },
      { id: 'inventory', label: 'Inventory', icon: Package, description: 'D18 clocks & scan ingest' },
      { id: 'distribution', label: 'Distribution', icon: Share2, description: 'Depot balance & channels' },
      { id: 'transportation', label: 'Transportation', icon: Truck, description: 'Route AI, Import & Weather Watch' },
    ],
  },
  {
    group: 'Visual Studio & Evidence',
    items: [
      { id: 'graphs', label: 'Chart Studio', icon: LineChart, description: '25 supply chain charts', highlight: true },
      { id: 'scenario', label: 'Scenario Replay', icon: RotateCcw, description: 'Case evidence replay' },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export default function Sidebar({ activeTab, setActiveTab, openAlertsCount, wsConnected }) {
  return (
    <>
      {/* Desktop Sidebar (Airtable Spec) */}
      <aside
        className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 flex-col z-30 bg-white border-r border-airtable-hairline overflow-y-auto"
      >
        {/* Brand */}
        <div className="px-5 py-4 flex items-center gap-3 border-b border-airtable-hairline/60 flex-shrink-0">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-airtable-ink text-white font-semibold text-xs tracking-tight">
            PR
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-airtable-ink leading-tight truncate font-title">Pulp Riot</div>
            <div className="text-[11px] text-airtable-muted truncate">Project Resilient Pulp</div>
          </div>
        </div>

        {/* Navigation Groups */}
        <div className="px-3 py-2 flex-1 space-y-4">
          {NAV_GROUPS.map((grp) => (
            <div key={grp.group} className="space-y-0.5">
              <div className="px-2 pt-1 pb-1">
                <span className="section-label text-[10px]">{grp.group}</span>
              </div>
              {grp.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const badge = item.id === 'alerts' ? openAlertsCount : null;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`sidebar-item w-full text-left py-2 ${isActive ? 'active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0 text-airtable-muted" />
                    <span className="flex-1 truncate text-[12.5px]">{item.label}</span>
                    {badge > 0 && (
                      <span className="flex-shrink-0 h-4 min-w-[18px] px-1 rounded-full flex items-center justify-center font-mono text-[9px] font-medium text-white bg-airtable-coral">
                        {badge}
                      </span>
                    )}
                    {item.highlight && !isActive && (
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-airtable-ink" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom: Status */}
        <div className="p-3 border-t border-airtable-hairline/60 space-y-1.5 bg-airtable-surface-soft flex-shrink-0">
          {/* WebSocket Status */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white border border-airtable-hairline">
            <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-airtable-success' : 'bg-airtable-mustard'}`} />
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-airtable-ink leading-tight">
                {wsConnected ? 'Live Stream Active' : 'Connecting'}
              </div>
            </div>
          </div>

          {/* Agent Status */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white border border-airtable-hairline">
            <Zap className="w-3 h-3 text-airtable-ink flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-medium text-airtable-ink leading-tight">31 Monitors Active</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar (Scrollable horizontally) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center bg-white border-t border-airtable-hairline shadow-sm overflow-x-auto py-1 px-1"
        aria-label="Mobile Navigation"
      >
        {ALL_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const badge = item.id === 'alerts' ? openAlertsCount : null;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-shrink-0 min-w-[56px] flex flex-col items-center py-1.5 px-2 relative transition-colors ${
                isActive ? 'text-airtable-ink' : 'text-airtable-muted'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <Icon className="w-4 h-4" />
                {badge > 0 && (
                  <span className="absolute -top-1 -right-2 h-3.5 min-w-[14px] px-0.5 rounded-full flex items-center justify-center font-mono text-[8px] font-medium text-white bg-airtable-coral">
                    {badge}
                  </span>
                )}
              </div>
              <span className={`text-[9px] mt-0.5 leading-none ${isActive ? 'font-medium' : 'font-normal'}`}>
                {item.label.split(' ')[0]}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-airtable-ink" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
