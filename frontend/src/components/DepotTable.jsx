import React from 'react';
import { Warehouse, AlertTriangle, Package, ChevronRight } from 'lucide-react';

const STATUS_COLORS = {
  critical:  { bar: '#aa2d00', text: 'text-airtable-coral' },
  excessive: { bar: '#d9a441', text: 'text-airtable-mustard' },
  healthy:   { bar: '#0a2e0e', text: 'text-airtable-forest' },
};

export default function DepotTable({ depots, selectedDepotId, onSelectDepot, onInspectDepot }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {depots.map((depot) => {
        const isSelected = selectedDepotId === depot.id;
        const hasRisk    = depot.at_risk_count > 0;

        return (
          <div
            key={depot.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelectDepot(depot.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectDepot(depot.id);
              }
            }}
            aria-label={`Select ${depot.name}, ${depot.region} Region`}
            aria-pressed={isSelected}
            className={`rounded-md cursor-pointer transition-all duration-150 active:scale-[0.99] bg-white border shadow-xs hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-airtable-ink ${
              isSelected
                ? 'border-airtable-ink ring-1 ring-airtable-ink shadow-soft'
                : 'border-airtable-hairline hover:border-airtable-border-strong'
            }`}
          >
            <div className="p-4 sm:p-5">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-2 rounded-md flex-shrink-0 border ${
                      isSelected
                        ? 'bg-airtable-surface-soft border-airtable-ink text-airtable-ink'
                        : 'bg-airtable-surface-soft border-airtable-hairline text-airtable-muted'
                    }`}
                  >
                    <Warehouse className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium leading-tight text-airtable-ink">
                      {depot.name}
                    </h3>
                    <span className="text-[11px] text-airtable-muted">{depot.region} Region</span>
                  </div>
                </div>

                {hasRisk && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-airtable-yellow/20 text-airtable-ink border border-airtable-yellow/60">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {depot.at_risk_count} at risk
                  </span>
                )}
              </div>

              {/* Stock pill */}
              <div className="flex items-center justify-between px-3 py-2 rounded-md mb-3 text-xs bg-airtable-surface-soft border border-airtable-hairline">
                <div className="flex items-center gap-1.5 text-airtable-body">
                  <Package className="w-3.5 h-3.5 text-airtable-muted" />
                  <span>Finished Goods</span>
                </div>
                <span className="font-mono font-medium text-airtable-ink">
                  {depot.total_bottles.toLocaleString()} btls
                </span>
              </div>

              {/* Flavor cover bars */}
              <div className="space-y-2">
                <div className="text-[10px] font-medium text-airtable-muted uppercase tracking-wide">
                  Cover Days (Target: 7-14d)
                </div>
                {depot.flavors.map((fc) => {
                  const sc = STATUS_COLORS[fc.status] || STATUS_COLORS.healthy;
                  const fillPct = Math.min(100, (fc.cover_days / 25) * 100);
                  return (
                    <div key={fc.flavor_id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-airtable-body font-normal truncate max-w-[140px]">
                          {fc.flavor_name}
                        </span>
                        <span className={`font-mono font-medium text-[11px] ${sc.text}`}>
                          {fc.cover_days}d
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden bg-airtable-surface-strong">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${fillPct}%`,
                            background: sc.bar,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="mt-3 pt-3 flex items-center justify-between text-xs border-t border-airtable-hairline/60">
                <span className="text-airtable-muted font-mono text-[11px]">{depot.batches_count} batches</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onInspectDepot) {
                      onInspectDepot(depot);
                    } else {
                      onSelectDepot(depot.id);
                    }
                  }}
                  className="inline-flex items-center gap-1 font-medium text-xs px-2.5 py-1 rounded-sm bg-airtable-primary text-white hover:bg-airtable-primary-active active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
                >
                  <span>Inspect</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
