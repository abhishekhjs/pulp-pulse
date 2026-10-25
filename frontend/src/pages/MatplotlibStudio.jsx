import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle,
  FileImage,
  TrendingUp,
  Factory,
  Package,
  Share2,
  Truck,
  RotateCcw,
  Zap,
  Check,
  Copy,
} from 'lucide-react';
import { fetchGraphsCatalog } from '../lib/api';
import { useChartEngine } from '../context/ChartEngineContext';
import MatplotlibChart from '../components/MatplotlibChart';

const CATEGORY_ICONS = {
  'Executive Overview': Zap,
  'Demand Sensing': TrendingUp,
  'Supply Operations': Factory,
  'Inventory Management': Package,
  'Distribution & Logistics': Share2,
  'Transportation & Fleet': Truck,
  'Stress Testing & Evidence': RotateCcw,
};

const CATEGORIES = [
  'All',
  'Executive Overview',
  'Demand Sensing',
  'Supply Operations',
  'Inventory Management',
  'Distribution & Logistics',
  'Transportation & Fleet',
  'Stress Testing & Evidence',
];

export default function MatplotlibStudio() {
  const { graphTimestamp, triggerRegeneration, regenerating } = useChartEngine();
  const [graphs, setGraphs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [lastRegenerated, setLastRegenerated] = useState(null);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const data = await fetchGraphsCatalog();
      setGraphs(data.graphs || []);
    } catch (err) {
      console.error('Failed to load graphs catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, [graphTimestamp]);

  const handleRegenerateAll = async () => {
    try {
      await triggerRegeneration();
      setLastRegenerated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to regenerate graphs:', err);
    }
  };

  const handleCopyEndpoint = (id) => {
    const url = `${window.location.origin}/api/graphs/${id}/plotly`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredGraphs = graphs.filter((g) => {
    const matchesCategory =
      selectedCategory === 'All' || g.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="p-5 sm:p-8 space-y-6 max-w-[1600px] mx-auto bg-white min-h-[calc(100vh-4rem)]">
      {/* ── Top Hero Banner ────────────────────────────────────────── */}
      <div className="rounded-xl p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white shadow-lg border border-slate-700/50">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Interactive Telemetry Engine</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-title">
              Supply Chain Chart Studio
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              All 25 analytical supply chain charts are generated dynamically from live SQLite database records with interactive hover tooltips, pan, and zoom.
            </p>

            {/* Telemetry pill badges */}
            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-mono text-slate-300">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>25 Total Master Graphs</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700">
                <span>Source: Live SQLite Historical Telemetry</span>
              </div>
              {lastRegenerated && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-900/60 text-emerald-200 border border-emerald-700">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Pushed Live: {lastRegenerated}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <button
              onClick={handleRegenerateAll}
              disabled={regenerating}
              className="flex items-center justify-center gap-2.5 px-5 py-3 rounded-lg font-medium text-sm text-slate-900 bg-emerald-400 hover:bg-emerald-300 shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
              <span>{regenerating ? 'Regenerating in Backend...' : 'Regenerate All 25 Graphs Live'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Filters & Controls ─────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-2 border-b border-airtable-hairline">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat;
            const count =
              cat === 'All'
                ? graphs.length
                : graphs.filter((g) => g.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-airtable-ink text-white shadow-xs'
                    : 'bg-slate-100 text-airtable-muted hover:text-airtable-ink hover:bg-slate-200'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72 flex-shrink-0">
          <Search className="w-4 h-4 text-airtable-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search graph name or metric..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-airtable-hairline rounded-md focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-airtable-ink"
          />
        </div>
      </div>

      {/* ── Graphs Grid ────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 text-airtable-ink animate-spin" />
          <p className="text-xs font-mono text-airtable-muted">Loading supply chain graphics catalog...</p>
        </div>
      ) : filteredGraphs.length === 0 ? (
        <div className="py-16 text-center text-airtable-muted text-xs">
          No graphs found matching "{searchQuery}".
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredGraphs.map((graph) => {
            const Icon = CATEGORY_ICONS[graph.category] || FileImage;
            const isCopied = copiedId === graph.id;

            return (
              <div
                key={graph.id}
                className="rounded-lg bg-white border border-airtable-hairline shadow-xs hover:shadow-md transition-shadow flex flex-col overflow-hidden"
              >
                {/* Card Meta Bar */}
                <div className="px-4 py-2.5 border-b border-airtable-hairline/80 flex items-center justify-between gap-3 bg-slate-50/70">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700">
                      <Icon className="w-3 h-3" />
                      <span>{graph.category}</span>
                    </span>
                    <span className="text-[10px] font-mono text-airtable-muted truncate">
                      ID: {graph.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyEndpoint(graph.id)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors cursor-pointer"
                      title="Copy API Endpoint URL"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>API</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Dual Engine Matplotlib / Plotly Chart */}
                <div className="p-4 flex-1">
                  <MatplotlibChart
                    graphId={graph.id}
                    title={graph.title}
                    subtitle={graph.description}
                    height="h-72"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
