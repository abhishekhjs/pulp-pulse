import React from 'react';
import { AlertCircle, ShieldAlert } from 'lucide-react';

function polarToXY(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const start = polarToXY(cx, cy, r, startDeg);
  const end   = polarToXY(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export default function AgeClock({ ageDays, quantity, status }) {
  const maxDays    = 30;
  const triggerDay = 18;
  const pct        = Math.min(100, (ageDays / maxDays) * 100);
  const triggerPct = (triggerDay / maxDays) * 100;

  const isAtRisk   = ageDays >= 18 && ageDays < 30;
  const isRejected = ageDays >= 30;

  const daysToTrigger = Math.max(0, triggerDay - ageDays);
  const daysToCliff   = Math.max(0, maxDays - ageDays);

  const START_DEG = 135;
  const TOTAL_DEG = 270;
  const cx = 56, cy = 56, r = 40;

  const fillEnd    = START_DEG + (pct / 100) * TOTAL_DEG;
  const triggerEnd = START_DEG + (triggerPct / 100) * TOTAL_DEG;

  const arcColor = isRejected ? '#aa2d00' : isAtRisk ? '#d9a441' : '#0a2e0e';
  const markerPos = polarToXY(cx, cy, r, triggerEnd);

  return (
    <div
      role="progressbar"
      aria-valuenow={ageDays}
      aria-valuemin="0"
      aria-valuemax="30"
      aria-label={`Batch age ${ageDays} of 30 days, status ${status}`}
      className="rounded-md p-3 bg-airtable-surface-soft border border-airtable-hairline"
    >
      <div className="flex items-center gap-3">
        {/* SVG Arc Gauge */}
        <div className="flex-shrink-0" aria-hidden="true">
          <svg width="112" height="112" viewBox="0 0 112 112">
            {/* Track */}
            <path
              d={arcPath(cx, cy, r, START_DEG, START_DEG + TOTAL_DEG)}
              fill="none"
              stroke="#e0e2e6"
              strokeWidth="6"
              strokeLinecap="round"
            />

            {/* Filled arc */}
            {pct > 0 && (
              <path
                d={arcPath(cx, cy, r, START_DEG, fillEnd)}
                fill="none"
                stroke={arcColor}
                strokeWidth="6"
                strokeLinecap="round"
              />
            )}

            {/* Day-18 trigger marker */}
            <circle
              cx={markerPos.x}
              cy={markerPos.y}
              r="4"
              fill="#d9a441"
              stroke="#ffffff"
              strokeWidth="2"
            />

            {/* Center label */}
            <text
              x={cx}
              y={cy - 3}
              textAnchor="middle"
              fill={arcColor}
              fontSize="20"
              fontWeight="500"
              fontFamily="JetBrains Mono, monospace"
            >
              {ageDays}
            </text>
            <text
              x={cx}
              y={cy + 13}
              textAnchor="middle"
              fill="#41454d"
              fontSize="9"
              fontWeight="500"
              fontFamily="JetBrains Mono, monospace"
              letterSpacing="0.5"
            >
              / 30 DAYS
            </text>

            {/* Status label below arc */}
            <text
              x={cx}
              y={cy + 45}
              textAnchor="middle"
              fill={arcColor}
              fontSize="8.5"
              fontWeight="500"
              fontFamily="Haas, sans-serif"
              letterSpacing="0.8"
            >
              {status?.toUpperCase()}
            </text>
          </svg>
        </div>

        {/* Right side info panel */}
        <div className="flex-1 space-y-2">
          {/* D18 trigger countdown */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-white border border-airtable-hairline text-xs">
            <span className="text-[11px] text-airtable-muted font-medium">D18 Trigger</span>
            {daysToTrigger > 0 ? (
              <span className="font-mono text-[11px] font-medium text-airtable-ink">
                {daysToTrigger}d left
              </span>
            ) : (
              <span className="flex items-center gap-1 font-mono text-[11px] font-medium text-airtable-mustard">
                <AlertCircle className="w-3 h-3 text-airtable-mustard" />
                Active
              </span>
            )}
          </div>

          {/* MT/QC cliff countdown */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-white border border-airtable-hairline text-xs">
            <span className="text-[11px] text-airtable-muted font-medium">QC Cliff</span>
            {daysToCliff > 0 ? (
              <span className="font-mono text-[11px] font-medium text-airtable-ink">
                {daysToCliff}d
              </span>
            ) : (
              <span className="flex items-center gap-1 font-mono text-[11px] font-medium text-airtable-coral">
                <ShieldAlert className="w-3 h-3" />
                Rejected
              </span>
            )}
          </div>

          {/* Quantity */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-white border border-airtable-hairline text-xs">
            <span className="text-[11px] text-airtable-muted font-medium">Stock</span>
            <span className="font-mono text-[11px] font-medium text-airtable-ink">
              {quantity?.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
