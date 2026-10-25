import React, { useMemo } from 'react';
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';

const Plot = createPlotlyComponent(Plotly);

const BASE_LAYOUT = {
  font: {
    family: '"Haas", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    size: 11,
    color: '#181d26',
  },
  paper_bgcolor: '#ffffff',
  plot_bgcolor: '#ffffff',
  autosize: true,
  margin: { l: 50, r: 25, t: 30, b: 40, pad: 2 },
  hovermode: 'closest',
  hoverlabel: {
    bgcolor: '#181d26',
    bordercolor: '#181d26',
    font: { color: '#ffffff', size: 11, family: '"Haas", -apple-system, BlinkMacSystemFont, sans-serif' },
  },
  xaxis: {
    showgrid: true,
    gridcolor: '#dddddd',
    gridwidth: 0.8,
    linecolor: '#dddddd',
    linewidth: 1,
    zerolinecolor: '#dddddd',
    tickfont: { size: 10, color: '#41454d' },
    title: { font: { size: 11, color: '#181d26', weight: 'normal' } },
  },
  yaxis: {
    showgrid: true,
    gridcolor: '#dddddd',
    gridwidth: 0.8,
    linecolor: '#dddddd',
    linewidth: 1,
    zerolinecolor: '#dddddd',
    tickfont: { size: 10, color: '#41454d' },
    title: { font: { size: 11, color: '#181d26', weight: 'normal' } },
  },
  legend: {
    bgcolor: '#f8fafc',
    bordercolor: '#dddddd',
    borderwidth: 1,
    font: { size: 10, color: '#181d26' },
    orientation: 'h',
    yanchor: 'bottom',
    y: 1.02,
    xanchor: 'right',
    x: 1,
  },
};

const DEFAULT_CONFIG = {
  responsive: true,
  displayModeBar: false,
  displaylogo: false,
};

export default function PlotlyChart({
  data = [],
  layout = {},
  config = {},
  style = {},
  className = '',
  height = 300,
}) {
  const mergedLayout = useMemo(() => {
    return {
      ...BASE_LAYOUT,
      ...layout,
      xaxis: { ...BASE_LAYOUT.xaxis, ...layout.xaxis },
      yaxis: { ...BASE_LAYOUT.yaxis, ...layout.yaxis },
      legend: { ...BASE_LAYOUT.legend, ...layout.legend },
      margin: { ...BASE_LAYOUT.margin, ...layout.margin },
    };
  }, [layout]);

  const mergedConfig = useMemo(
    () => ({
      ...DEFAULT_CONFIG,
      ...config,
    }),
    [config]
  );

  return (
    <div className={`w-full overflow-hidden ${className}`} style={{ height, ...style }}>
      <Plot
        data={data}
        layout={mergedLayout}
        config={mergedConfig}
        useResizeHandler
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
