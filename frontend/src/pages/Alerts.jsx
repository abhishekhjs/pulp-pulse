import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { fetchAlerts, approveAlert, overrideAlert } from '../lib/api';
import ApprovalCard from '../components/ApprovalCard';

const STATUS_TABS = [
  { value: 'open',       label: 'Pending' },
  { value: 'approved',   label: 'Approved' },
  { value: 'overridden', label: 'Overridden' },
];

const CATEGORY_TABS = [
  { value: 'all',                label: 'All Categories' },
  { value: 'demand',             label: 'Demand (B)' },
  { value: 'supply',             label: 'Supply (C)' },
  { value: 'inventory',          label: 'Inventory (D)' },
  { value: 'distribution',       label: 'Distribution (E/F)' },
  { value: 'governance',         label: 'Governance (A/H)' },
  { value: 'dmac_recalibration', label: 'DMAC Recalibration' },
];

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (tierFilter) params.tier = tierFilter;
      const data = await fetchAlerts(params);
      setAlerts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [statusFilter, tierFilter]);

  const handleApprove = async (alertId) => {
    await approveAlert(alertId, { approver: 'Lead Planner' });
    loadAlerts();
  };

  const handleOverride = async (alertId, payload) => {
    await overrideAlert(alertId, payload);
    loadAlerts();
  };

  const getAlertCategory = (kpiCode) => {
    if (kpiCode === 'dmac_recalibration') return 'dmac_recalibration';
    if (kpiCode.startsWith('B')) return 'demand';
    if (kpiCode.startsWith('C')) return 'supply';
    if (kpiCode.startsWith('D')) return 'inventory';
    if (kpiCode.startsWith('E') || kpiCode.startsWith('F')) return 'distribution';
    if (kpiCode.startsWith('A') || kpiCode.startsWith('H')) return 'governance';
    return 'governance';
  };

  const filteredAlerts = alerts.filter((a) => {
    if (categoryFilter !== 'all') {
      const cat = getAlertCategory(a.kpi_code);
      if (cat !== categoryFilter) return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.message.toLowerCase().includes(q) ||
      a.kpi_code.toLowerCase().includes(q) ||
      (a.approval?.tier || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] bg-white">
      {/* Sticky toolbar (Airtable sub-nav rail spec) */}
      <div className="sticky top-16 z-10 px-5 sm:px-8 py-3 flex flex-col gap-2.5 bg-white/95 backdrop-blur-xs border-b border-airtable-hairline">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Status pill tabs */}
          <div className="flex items-center gap-1 p-1 rounded-md bg-airtable-surface-soft border border-airtable-hairline">
            {STATUS_TABS.map((tab) => {
              const isActive = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-all duration-150 active:scale-[0.98] ${
                    isActive
                      ? 'bg-white text-airtable-ink shadow-xs border border-airtable-hairline/80'
                      : 'text-airtable-muted hover:text-airtable-ink'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Right side: search + tier filter */}
          <div className="flex items-center gap-2 sm:ml-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-airtable-muted" />
              <input
                type="text"
                placeholder="Search KPI code or message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-base pl-8 pr-3 py-1.5 text-xs w-full sm:w-60"
              />
            </div>

            <div className="relative flex items-center">
              <SlidersHorizontal className="w-3.5 h-3.5 absolute left-3 text-airtable-muted pointer-events-none" />
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="input-base pl-8 pr-7 py-1.5 text-xs appearance-none cursor-pointer"
              >
                <option value="">All Tiers</option>
                <option value="planner">Planner (4h SLA)</option>
                <option value="supply_lead">Supply Lead (12h SLA)</option>
                <option value="coo">COO (24h SLA)</option>
              </select>
            </div>

            <button
              onClick={loadAlerts}
              className="btn-secondary p-2 cursor-pointer"
              title="Reload alert queue"
              aria-label="Reload alert queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Category Pills (Section 16.5 6th Category: dmac_recalibration) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-0.5 border-t border-airtable-hairline/50">
          <span className="text-[11px] font-mono uppercase tracking-wider text-airtable-muted mr-1 shrink-0">
            Domain:
          </span>
          {CATEGORY_TABS.map((cat) => {
            const isActive = categoryFilter === cat.value;
            const isDmac = cat.value === 'dmac_recalibration';
            return (
              <button
                key={cat.value}
                id={`cat-filter-${cat.value}`}
                onClick={() => setCategoryFilter(cat.value)}
                className={`px-2.5 py-1 rounded text-xs whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  isActive
                    ? isDmac
                      ? 'bg-indigo-600 text-white font-medium shadow-xs'
                      : 'bg-slate-900 text-white font-medium shadow-xs'
                    : isDmac
                    ? 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 font-medium'
                    : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 sm:p-8 space-y-4 pb-16 max-w-[1400px]">
        {/* Count line */}
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-3.5 h-3.5 text-airtable-ink" />
          <span className="text-xs text-airtable-body font-medium">
            {filteredAlerts.length} {statusFilter} item{filteredAlerts.length !== 1 ? 's' : ''}
            {tierFilter && ` for ${tierFilter.replace('_', ' ')} tier`}
          </span>
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center gap-3 text-sm text-airtable-muted">
            <RefreshCw className="w-4 h-4 animate-spin text-airtable-ink" />
            Synchronizing decision queue...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="rounded-lg p-12 flex flex-col items-center text-center bg-white border border-airtable-hairline shadow-xs">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-emerald-50 border border-emerald-200">
              <CheckCircle className="w-5 h-5 text-emerald-700" />
            </div>
            <h3 className="text-sm font-medium text-airtable-ink mb-1">Queue is clear</h3>
            <p className="text-xs text-airtable-muted max-w-sm leading-relaxed">
              All multi-agent telemetry thresholds are operating within safe tolerances for the selected filter.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map((alert) => (
              <ApprovalCard
                key={alert.id}
                alert={alert}
                onApprove={handleApprove}
                onOverride={handleOverride}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
