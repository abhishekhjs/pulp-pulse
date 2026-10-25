import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  ShieldCheck,
  Flame,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Sparkles,
  Pause,
} from 'lucide-react';
import { runScenarioReplay } from '../lib/api';
import MatplotlibChart from '../components/MatplotlibChart';

const DEFAULT_TRAJECTORY = [
  { week: 'Wk1', unmitigated: 0.2, agent: 0.1 },
  { week: 'Wk2', unmitigated: 0.8, agent: 0.2 },
  { week: 'Wk3', unmitigated: 3.5, agent: 0.4 },
  { week: 'Wk4', unmitigated: 8.2, agent: 0.7 },
  { week: 'Wk5', unmitigated: 12.4, agent: 1.1 },
  { week: 'Wk6', unmitigated: 14.8, agent: 1.4 },
  { week: 'Wk7', unmitigated: 15.2, agent: 1.6 },
  { week: 'Wk8', unmitigated: 16.5, agent: 1.8 },
  { week: 'Wk9', unmitigated: 17.8, agent: 2.0 },
  { week: 'Wk10', unmitigated: 18.2, agent: 2.1 },
  { week: 'Wk11', unmitigated: 19.5, agent: 2.2 },
  { week: 'Wk12', unmitigated: 20.8, agent: 2.3 },
  { week: 'Wk13', unmitigated: 22.1, agent: 2.4 },
  { week: 'Wk14', unmitigated: 23.0, agent: 2.5 },
  { week: 'Wk15', unmitigated: 23.3, agent: 2.55 },
  { week: 'Wk16', unmitigated: 23.31, agent: 2.56 },
];

// P&L stat strip tile matching Airtable Signature Surface Cards
function SignaturePLCard({ label, value, sub, icon: Icon, variant = 'white' }) {
  const styles = {
    coral: 'bg-airtable-coral text-white border-transparent',
    forest: 'bg-airtable-forest text-white border-transparent',
    dark: 'bg-airtable-surface-dark text-white border-transparent',
    white: 'bg-white text-airtable-ink border-airtable-hairline',
  }[variant] || 'bg-white text-airtable-ink border-airtable-hairline';

  const isDark = variant !== 'white';

  return (
    <div className={`rounded-lg p-5 border shadow-xs transition-transform duration-150 flex flex-col justify-between ${styles}`}>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-medium uppercase tracking-wide ${isDark ? 'text-white/80' : 'text-airtable-muted'}`}>
            {label}
          </span>
          {Icon && <Icon className={`w-4 h-4 ${isDark ? 'text-white/80' : 'text-airtable-muted'}`} />}
        </div>
        <div className={`text-[28px] font-medium font-mono leading-none tracking-tight ${isDark ? 'text-white' : 'text-airtable-ink'}`}>
          {value}
        </div>
      </div>
      {sub && (
        <p className={`text-[11px] mt-2.5 leading-snug ${isDark ? 'text-white/80' : 'text-airtable-muted'}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

export default function ScenarioReplay() {
  const [replayData, setReplayData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(null);
  const [autoPlay, setAutoPlay] = useState(false);

  const startReplay = async () => {
    setLoading(true);
    try {
      const data = await runScenarioReplay();
      setReplayData(data);
      setCurrentStep(0);
      setAutoPlay(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    startReplay();
  }, []);

  useEffect(() => {
    let interval = null;
    if (autoPlay && replayData && currentStep !== null) {
      interval = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev < replayData.timeline.length - 1) return prev + 1;
          setAutoPlay(false);
          return prev;
        });
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [autoPlay, currentStep, replayData]);

  const timeline = replayData?.timeline || [];
  const activeEvent = currentStep !== null && timeline[currentStep] ? timeline[currentStep] : null;
  const isFinished = currentStep === timeline.length - 1 && timeline.length > 0;

  return (
    <div className="p-5 sm:p-8 space-y-8 pb-16 bg-white min-h-[calc(100vh-4rem)] max-w-[1400px]">
      {/* Subheader info & play controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-1 border-b border-airtable-hairline/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-airtable-ink" />
            <span className="section-label">Case Evidence Replay Engine</span>
          </div>
          <p className="text-xs text-airtable-muted">
            Last summer actuals vs. autonomous agent layer: March viral surge and May highway closure sequence.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (isFinished) {
                setCurrentStep(0);
                setAutoPlay(true);
              } else {
                setAutoPlay(!autoPlay);
              }
            }}
            disabled={loading || timeline.length === 0}
            className="btn-primary"
          >
            {autoPlay ? (
              <>
                <Pause className="w-4 h-4" /> Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> {isFinished ? 'Replay' : 'Play'}
              </>
            )}
          </button>
          <button
            onClick={startReplay}
            disabled={loading}
            className="btn-secondary"
            title="Reset scenario timeline"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* P&L Financial Strip (Airtable Signature Surface Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SignaturePLCard
          label="Original Case Damage"
          value="₹23.31 Cr"
          sub="₹14.75 Cr CM + ₹6 Cr write-offs + ₹2.56 Cr air penalty"
          icon={TrendingDown}
          variant="coral"
        />
        <SignaturePLCard
          label="Protected Net Profit"
          value="₹20.75 Cr"
          sub="Continuous sensing and proactive buffer deployment"
          icon={TrendingUp}
          variant="forest"
        />
        <SignaturePLCard
          label="Solution ROI"
          value="9.2x"
          sub="Against ₹2.50 Cr Year-1 turnkey vendor budget"
          icon={DollarSign}
          variant="dark"
        />
      </div>

      {/* Timeline scrubber */}
      <div>
        <div className="flex items-center justify-between text-xs text-airtable-muted mb-2.5">
          <span className="font-medium text-airtable-ink">Milestone Scrubber</span>
          <span className="font-mono text-airtable-muted">
            Step {currentStep !== null ? currentStep + 1 : 0} of {timeline.length}
          </span>
        </div>

        {/* Horizontal scrubber track */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {timeline.map((ev, idx) => {
            const isCurrent = currentStep === idx;
            const isPassed = currentStep !== null && currentStep > idx;
            return (
              <button
                key={ev.day}
                onClick={() => {
                  setCurrentStep(idx);
                  setAutoPlay(false);
                }}
                className={`flex-1 min-w-[80px] text-left p-2.5 rounded border text-xs transition-all duration-150 active:scale-[0.98] ${
                  isCurrent
                    ? 'bg-airtable-ink border-airtable-ink text-white shadow-xs'
                    : isPassed
                    ? 'bg-white border-airtable-hairline text-airtable-body hover:bg-airtable-surface-soft'
                    : 'bg-white border-airtable-hairline/80 text-airtable-muted hover:bg-airtable-surface-soft'
                }`}
              >
                <div className={`font-mono text-[10px] ${isCurrent ? 'text-white/70' : 'text-airtable-muted'}`}>
                  Day {ev.day}
                </div>
                <div
                  className={`truncate mt-0.5 font-medium ${
                    isCurrent ? 'text-white' : isPassed ? 'text-airtable-ink' : 'text-airtable-muted'
                  }`}
                >
                  {ev.date}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Side-by-side comparison */}
      {activeEvent && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Without agent */}
          <div className="rounded-lg p-5 bg-white border border-airtable-hairline shadow-xs border-l-4 border-l-airtable-coral">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded bg-[#fdf2f2] text-airtable-coral border border-[#fbd5d5]">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-airtable-coral">
                    Without Agent Layer
                  </div>
                  <h3 className="text-sm font-medium text-airtable-ink">Last Summer Actuals</h3>
                </div>
              </div>
              <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded bg-[#fdf2f2] text-airtable-coral border border-[#fbd5d5]">
                Siloed S&OP
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-[11px] font-medium text-airtable-muted uppercase tracking-wide mb-1">
                  What Actually Happened
                </div>
                <p className="text-xs sm:text-[13px] text-airtable-body leading-relaxed">
                  {activeEvent.case_actual_event}
                </p>
              </div>
              <div className="p-3.5 rounded bg-[#fdf2f2] border border-[#fbd5d5]">
                <div className="text-[10px] uppercase font-medium text-airtable-coral tracking-wide mb-1">
                  Financial & Operational Damage
                </div>
                <div className="text-xs sm:text-[13px] font-medium text-airtable-coral">
                  {activeEvent.case_actual_financial_impact}
                </div>
              </div>
            </div>
          </div>

          {/* With agent */}
          <div className="rounded-lg p-5 bg-white border border-airtable-hairline shadow-xs border-l-4 border-l-airtable-forest">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded bg-[#f0fdf4] text-airtable-forest border border-[#bbf7d0]">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-airtable-forest">
                    With Resilient Pulp
                  </div>
                  <h3 className="text-sm font-medium text-airtable-ink">Agent Recommendation</h3>
                </div>
              </div>
              <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded bg-[#f0fdf4] text-airtable-forest border border-[#bbf7d0]">
                {activeEvent.approval_tier ? `${activeEvent.approval_tier.toUpperCase()} TIER` : 'AUTONOMOUS'}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-[11px] font-medium text-airtable-muted uppercase tracking-wide mb-1">
                  Agent Detection & Intervention
                </div>
                <p className="text-xs sm:text-[13px] text-airtable-body leading-relaxed">
                  {activeEvent.agent_action_recommended}
                </p>
              </div>
              <div className="p-3.5 rounded bg-[#f0fdf4] border border-[#bbf7d0]">
                <div className="text-[10px] uppercase font-medium text-airtable-forest tracking-wide mb-1">
                  Quantified Loss Avoidance
                </div>
                <div className="text-xs sm:text-[13px] font-medium text-airtable-forest">
                  {activeEvent.prevention_saving}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Matplotlib Cumulative Value Erosion Chart */}
      <div className="rounded-lg bg-white border border-airtable-hairline shadow-xs p-5 sm:p-6 space-y-3">
        <MatplotlibChart
          graphId="scenario_replay_comparison"
          title="Summer Crisis Cumulative Value Erosion: Baseline Crisis vs. Agent Protection"
          subtitle="Direct P&L Bridge: ₹20.75 Cr Profit Saved Across Stockouts, Expiry Write-Offs, and Highway Air Freight"
          height="h-80"
        />
      </div>

      {/* Full replay table (Airtable comparison table spec) */}
      <div className="rounded-lg overflow-hidden bg-white border border-airtable-hairline shadow-xs">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-airtable-hairline bg-airtable-surface-soft">
          <span className="text-xs font-medium text-airtable-ink">Complete Replay Timeline</span>
          <span className="text-xs text-airtable-muted ml-1">(March 1 to June 30)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-airtable-hairline bg-white">
                {['Sim Date', 'Last Summer Actuals', 'Agent Recommendation', 'Tier', 'Saved'].map((h) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-[11px] font-medium text-airtable-muted ${
                      h === 'Saved' ? 'text-right' : ''
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeline.map((ev, idx) => (
                <tr
                  key={ev.day}
                  onClick={() => setCurrentStep(idx)}
                  className={`cursor-pointer transition-colors border-b border-airtable-hairline/60 ${
                    currentStep === idx ? 'bg-airtable-surface-soft' : 'hover:bg-slate-50/60'
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-airtable-ink whitespace-nowrap">
                    D{ev.day} / {ev.date}
                  </td>
                  <td className="px-4 py-3 text-airtable-body max-w-[200px] pr-6">{ev.case_actual_event}</td>
                  <td className="px-4 py-3 text-airtable-ink max-w-[240px] pr-6 font-normal">
                    {ev.agent_action_recommended}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono text-[10px] font-medium px-2 py-0.5 rounded bg-airtable-surface-soft text-airtable-muted border border-airtable-hairline">
                      {ev.approval_tier || 'ops'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-airtable-forest font-medium whitespace-nowrap font-mono">
                    {ev.prevention_saving}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
