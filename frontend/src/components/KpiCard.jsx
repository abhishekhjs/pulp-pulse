import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert, ChevronRight, Activity, TrendingUp } from 'lucide-react';

function formatTarget(target, code) {
  if (!target) return null;

  // Curated concise target benchmarks for known codes to eliminate noisy run-on sentences
  const knownTargets = {
    B3: 'Threshold: > 25% dev',
    C1: 'Operating Cap: 95% (Buffer 92-95%)',
    C2: 'Notice Window: ≥ 14 days',
    C3: 'Target: 35-42d (Min Safe: 28d)',
    C4: 'Exposure Cap: < 15%',
    C5: 'Policy: Risk-adjusted landed cost',
    C6: 'Pre-Monsoon Buffer: ≥ 35 days',
    D1: 'Dynamic Target: 10–14 days',
    D2: 'Freshness Cliff: 0 batches > 18d',
    D3: 'SLA: 0 store shelf rejections',
    D4: 'Max Excursion: < 2°C over setpoint',
    E1: 'Target: < 6.0d regional variance',
    E2: 'SLA: 100% actioned within 48h',
    E3: 'Dynamic Mix: ≥ 70% velocity weight',
    E4: 'Fair Share: ≥ 90% allocation rate',
    F1: 'Route Protocol: Buffer before monsoon',
    F2: 'Emergency Mix: < 2% total freight',
    F3: 'Backup Readiness: ≥ 80% carrier readiness',
    A1: 'Target: ≥ 97% CM (₹184 Cr)',
    A2: 'Target: < 1.0% stock-out rate',
    A3: 'Target: < ₹0.50 Cr total write-offs',
    A4: 'Standard: 1.0x (Zero air freight)',
    A5: 'Target: 0 permanent listing losses',
  };

  if (knownTargets[code]) {
    return knownTargets[code];
  }

  if (target.length <= 26) {
    return `Target: ${target}`;
  }

  return `Target: ${target.slice(0, 24)}…`;
}

function Sparkline({ data, stroke = '#0f172a', width = 94, height = 36 }) {
  if (!data || data.length < 2) return null;
  const values = data.map((d) => d.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padX = 6;
  const padY = 5;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - padX * 2) + padX;
    const y = height - padY - ((v - min) / range) * (height - padY * 2);
    return { x, y };
  });

  const polylinePoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const yMid = Math.round(height / 2);
  const yTop = Math.round(height * 0.25);
  const yBot = Math.round(height * 0.75);

  return (
    <div className="rounded-[3px] bg-white border border-[#e2e8f0] p-0.5 shadow-none overflow-hidden flex items-center justify-center">
      <svg width={width} height={height} className="block overflow-hidden">
        {/* Plotly-style grid lines */}
        <line x1={0} y1={yTop} x2={width} y2={yTop} stroke="#f1f5f9" strokeWidth="0.8" />
        <line x1={0} y1={yMid} x2={width} y2={yMid} stroke="#e2e8f0" strokeWidth="0.8" strokeDasharray="3 3" />
        <line x1={0} y1={yBot} x2={width} y2={yBot} stroke="#f1f5f9" strokeWidth="0.8" />

        {/* Solid telemetry line: NO shadow, NO gradient fill */}
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polylinePoints}
        />

        {/* Plotly-style markers (lines+markers) */}
        {points.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r={idx === points.length - 1 ? 2.5 : 1.75}
            fill={idx === points.length - 1 ? stroke : '#ffffff'}
            stroke={stroke}
            strokeWidth="1.2"
          />
        ))}
      </svg>
    </div>
  );
}

function generateSparkline(kpi, points = 9) {
  if (!kpi) return [];
  if (kpi.trend_points && Array.isArray(kpi.trend_points) && kpi.trend_points.length >= 4) {
    return kpi.trend_points.map((v) => ({ v }));
  }

  const code = kpi.kpi_code;
  const curr = parseFloat(kpi.value) || 0;

  if (code === 'B3') {
    const curve = [0.04, 0.05, 0.07, 0.11, 0.18, 0.24, 0.28, 0.31, curr || 0.34];
    return curve.map((v) => ({ v }));
  }
  if (code === 'C1') {
    const curve = [0.91, 0.92, 0.93, 0.93, 0.94, 0.95, 0.95, 0.95, curr || 0.96];
    return curve.map((v) => ({ v }));
  }
  if (code === 'C3') {
    const curve = [25.0, 23.5, 21.0, 19.5, 18.0, 16.5, 15.0, 14.5, curr || 14.0];
    return curve.map((v) => ({ v }));
  }
  if (code === 'D1') {
    const curve = [18.5, 18.2, 17.8, 17.2, 16.8, 16.5, 16.2, 16.0, curr || 16.0];
    return curve.map((v) => ({ v }));
  }
  if (code === 'D2') {
    const curve = [1, 2, 3, 5, 8, 11, 14, 16, curr || 18];
    return curve.map((v) => ({ v }));
  }
  if (code === 'E1') {
    const curve = [4.5, 5.2, 6.1, 7.4, 8.8, 9.9, 11.0, 11.8, curr || 12.4];
    return curve.map((v) => ({ v }));
  }
  if (code === 'A1') {
    const curve = [0.5, 0.9, 1.4, 2.0, 2.7, 3.4, 3.9, 4.2, curr || 4.5];
    return curve.map((v) => ({ v }));
  }
  if (code === 'A2') {
    const curve = [0.4, 0.8, 1.3, 2.2, 3.5, 5.1, 6.8, 7.5, curr || 8.0];
    return curve.map((v) => ({ v }));
  }
  if (code === 'A3') {
    const curve = [1200000, 1800000, 2500000, 3400000, 4200000, 5000000, 5600000, 6000000, curr || 6000000];
    return curve.map((v) => ({ v }));
  }
  if (code === 'A4') {
    const curve = [1.0, 1.0, 1.0, 1.0, 1.2, 2.5, 4.0, 4.8, curr || 5.0];
    return curve.map((v) => ({ v }));
  }
  if (code === 'A5') {
    const curve = [0, 1, 2, 4, 6, 8, 9, 10, curr || 11];
    return curve.map((v) => ({ v }));
  }

  const isBreach = kpi.status === 'breach';
  const data = [];
  const baseVal = curr > 0 ? (isBreach ? curr * 0.4 : curr * 0.9) : 10;
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const progression = isBreach ? Math.pow(t, 2) : t;
    const v = baseVal + (curr - baseVal) * progression;
    data.push({ v: Math.max(0, v) });
  }
  return data;
}

export default function KpiCard({ kpi, onClick }) {
  const isBreach = kpi.status === 'breach';
  const isWarning = kpi.status === 'warning';

  const sparkData = useMemo(() => generateSparkline(kpi, 9), [kpi]);

  const formatValue = (val, unit) => {
    if (val === undefined || val === null) return '—';
    if (unit === 'ratio') {
      const pct = (val * 100).toFixed(1);
      return `${val > 0 ? '+' : ''}${pct}%`;
    }
    if (unit === '₹') {
      if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
      if (val >= 100000) return `₹${(val / 100000).toFixed(1)} L`;
      return `₹${val.toLocaleString()}`;
    }
    if (unit === 'days') return `${val} days`;
    if (unit === 'batches') return `${val} ${val === 1 ? 'batch' : 'batches'}`;
    if (unit === 'x') return `${val}x`;
    if (unit === '%') return `${val}%`;
    return `${val} ${unit}`;
  };

  const statusConfig = isBreach
    ? {
        badgeClass: 'bg-airtable-coral/10 text-airtable-coral border-airtable-coral/30',
        valueColor: 'text-airtable-coral',
        lineColor: '#aa2d00',
        icon: <ShieldAlert className="w-3.5 h-3.5 text-airtable-coral" />,
        label: 'BREACH',
      }
    : isWarning
    ? {
        badgeClass: 'bg-airtable-yellow/30 text-airtable-ink border-airtable-yellow/60',
        valueColor: 'text-airtable-ink',
        lineColor: '#d97706',
        icon: <AlertTriangle className="w-3.5 h-3.5 text-airtable-mustard" />,
        label: 'WARNING',
      }
    : {
        badgeClass: 'bg-airtable-forest/10 text-airtable-forest border-airtable-forest/30',
        valueColor: 'text-airtable-ink',
        lineColor: '#0f172a',
        icon: <CheckCircle className="w-3.5 h-3.5 text-airtable-forest" />,
        label: 'HEALTHY',
      };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick && onClick();
        }
      }}
      aria-label={`KPI ${kpi.kpi_code}: ${kpi.name}, status ${kpi.status}`}
      className="group relative rounded-md cursor-pointer transition-all duration-200 bg-white border border-airtable-hairline shadow-xs hover:border-airtable-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-airtable-ink overflow-hidden flex flex-col justify-between"
    >
      <div className="p-4 sm:p-5 flex flex-col flex-1 justify-between gap-3.5">
        {/* Header: Title, Status Badge & Sentiment */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base sm:text-lg font-semibold text-airtable-ink group-hover:text-airtable-link transition-colors tracking-tight leading-snug">
            {kpi.name}
          </h3>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${statusConfig.badgeClass}`}
            >
              {statusConfig.icon}
              {statusConfig.label}
            </span>

            {kpi.sentiment_badge && (
              <span
                id={`sentiment-badge-${kpi.kpi_code}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-mono font-medium bg-airtable-surface-soft text-airtable-link border border-airtable-hairline whitespace-nowrap"
                title={
                  typeof kpi.sentiment_badge === 'object'
                    ? kpi.sentiment_badge.rationale || kpi.sentiment_badge.text
                    : 'Market Sentiment Momentum Signal'
                }
              >
                <TrendingUp className="w-3 h-3 text-airtable-link" />
                {typeof kpi.sentiment_badge === 'object'
                  ? kpi.sentiment_badge.text
                  : kpi.sentiment_badge}
              </span>
            )}
          </div>
        </div>

        {/* Hero Telemetry & Trend Sparkline */}
        <div className="flex items-end justify-between gap-3 pt-1">
          <div className="min-w-0">
            <div className={`text-2xl font-medium font-mono tracking-tight leading-none ${statusConfig.valueColor}`}>
              {formatValue(kpi.value, kpi.unit)}
            </div>

            {kpi.target && (
              <div
                className="text-[11px] font-mono text-airtable-muted mt-1.5 flex items-center gap-1.5 truncate"
                title={kpi.target}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-airtable-surface-strong inline-block shrink-0" />
                <span className="truncate">{formatTarget(kpi.target, kpi.kpi_code)}</span>
              </div>
            )}
          </div>

          <div
            className="flex-shrink-0 flex items-center justify-end"
            aria-hidden="true"
          >
            <Sparkline
              data={sparkData}
              stroke={statusConfig.lineColor}
              width={94}
              height={36}
            />
          </div>
        </div>

        {/* Structured Context Diagnostic */}
        <div className="rounded-sm bg-airtable-surface-soft border border-airtable-hairline p-2.5 text-xs text-airtable-body leading-relaxed min-h-[48px] flex items-start gap-2">
          <Activity className="w-3.5 h-3.5 text-airtable-muted mt-0.5 shrink-0" />
          <p
            id={`kpi-caption-${kpi.kpi_code}`}
            className="text-airtable-body line-clamp-2 leading-relaxed"
          >
            {kpi.caption || kpi.name}
          </p>
        </div>

        {/* Footer: Drilldown Cue */}
        <div className="flex items-center justify-end pt-2.5 border-t border-airtable-hairline text-xs">
          <div className="flex items-center gap-1 text-[11px] font-medium text-airtable-muted group-hover:text-airtable-link transition-colors">
            <span>Explore telemetry</span>
            <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
}
