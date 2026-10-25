import React, { useState, useEffect } from 'react';
import {
  Maximize2,
  RefreshCw,
  X,
  Activity,
} from 'lucide-react';
import { useChartEngine } from '../context/ChartEngineContext';
import { fetchGraphPlotlyFigure } from '../lib/api';
import PlotlyChart from './PlotlyChart';

const HEIGHT_MAP = {
  'h-48': 200,
  'h-56': 230,
  'h-60': 245,
  'h-64': 265,
  'h-72': 295,
  'h-80': 330,
  'h-96': 390,
};

export default function MatplotlibChart({
  graphId,
  title,
  subtitle,
  params = {},
  height = 'h-72',
  className = '',
}) {
  const { graphTimestamp } = useChartEngine();
  const [plotlyFigure, setPlotlyFigure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const queryParams = { ...params, t: graphTimestamp };
  const numericHeight = HEIGHT_MAP[height] || 300;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetchGraphPlotlyFigure(graphId, queryParams)
      .then((res) => {
        if (!cancelled) {
          setPlotlyFigure(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(`Failed to load chart figure for ${graphId}:`, err);
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [graphId, graphTimestamp, JSON.stringify(params)]);

  const handleReload = () => {
    setLoading(true);
    setError(false);
    fetchGraphPlotlyFigure(graphId, queryParams)
      .then((res) => {
        setPlotlyFigure(res);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  return (
    <div className={`relative flex flex-col ${className}`}>
      {/* Chart Sub-header toolbar if title provided */}
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0 pr-2">
          {title && (
            <h4 className="text-xs font-medium text-airtable-ink truncate flex items-center gap-1.5">
              <span>{title}</span>
            </h4>
          )}
          {subtitle && (
            <p className="text-[11px] text-airtable-muted truncate">{subtitle}</p>
          )}
        </div>

        {/* Toolbar controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleReload}
            className="p-1 rounded-sm text-airtable-muted hover:text-airtable-ink hover:bg-airtable-surface-soft transition-colors cursor-pointer"
            title="Reload chart"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsZoomed(true)}
            className="p-1 rounded-sm text-airtable-muted hover:text-airtable-ink hover:bg-airtable-surface-soft transition-colors cursor-pointer"
            title="Expand full screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body Canvas: Interactive Canvas */}
      <div className={`w-full ${height} relative overflow-hidden rounded-md flex items-center justify-center bg-white border border-airtable-hairline`}>
        <div className="w-full h-full relative flex items-center justify-center">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-airtable-surface-soft/80 z-10">
              <RefreshCw className="w-5 h-5 text-airtable-primary animate-spin mb-1.5" />
              <span className="text-[11px] font-mono text-airtable-muted">
                Loading chart...
              </span>
            </div>
          )}

          {error ? (
            <div className="flex flex-col items-center justify-center p-4 text-center">
              <Activity className="w-8 h-8 text-airtable-coral mb-2" />
              <p className="text-xs text-airtable-coral font-medium">Failed to load chart</p>
              <p className="text-[10px] text-airtable-muted mt-1">ID: {graphId}</p>
              <button
                onClick={handleReload}
                className="mt-2 text-[11px] text-airtable-link hover:underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : plotlyFigure ? (
            <PlotlyChart
              data={plotlyFigure.data || []}
              layout={{
                ...(plotlyFigure.layout || {}),
                autosize: true,
                height: numericHeight,
              }}
              height={numericHeight}
            />
          ) : null}
        </div>
      </div>

      {/* Full-Screen Zoom Modal */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-airtable-ink/40 backdrop-blur-xs p-4 sm:p-8"
          onClick={() => setIsZoomed(false)}
        >
          <div
            className="relative bg-white rounded-lg shadow-soft max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-airtable-hairline"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-airtable-hairline bg-airtable-surface-soft">
              <div>
                <h3 className="text-sm font-medium text-airtable-ink">
                  {title || graphId}
                </h3>
                {subtitle && (
                  <p className="text-xs text-airtable-muted">{subtitle}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsZoomed(false)}
                  className="p-1.5 rounded-sm text-airtable-muted hover:text-airtable-ink hover:bg-airtable-surface-soft transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-white min-h-[460px]">
              {plotlyFigure ? (
                <div className="w-full h-full min-h-[480px]">
                  <PlotlyChart
                    data={plotlyFigure.data || []}
                    layout={{
                      ...(plotlyFigure.layout || {}),
                      autosize: true,
                      height: 500,
                    }}
                    height={500}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
