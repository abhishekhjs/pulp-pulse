import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, ShieldCheck, X } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import Depots from './pages/Depots';
import Demand from './pages/Demand';
import Supply from './pages/Supply';
import Inventory from './pages/Inventory';
import Distribution from './pages/Distribution';
import Transportation from './pages/Transportation';
import ScenarioReplay from './pages/ScenarioReplay';
import MatplotlibStudio from './pages/MatplotlibStudio';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import { createAlertWebSocket } from './lib/ws';
import { fetchAlerts } from './lib/api';
import { ChartEngineProvider, useChartEngine } from './context/ChartEngineContext';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [openAlertsCount, setOpenAlertsCount] = useState(0);
  const [wsConnected, setWsConnected] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState('success');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { refreshGraphs } = useChartEngine();

  const refreshBadge = useCallback(async () => {
    try {
      const openAlerts = await fetchAlerts({ status: 'open' });
      setOpenAlertsCount(openAlerts.length);
    } catch (err) {
      console.warn('Could not refresh alert count', err);
    }
  }, []);

  const handleGlobalRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
    refreshBadge();
    refreshGraphs();
  };

  useEffect(() => {
    refreshBadge();

    const ws = createAlertWebSocket(
      (data) => {
        if (data.type === 'ALERT_APPROVED') {
          setToastMessage(`Alert #${data.alert_id} approved by ${data.decided_by}`);
          setToastType('success');
          refreshBadge();
        } else if (data.type === 'ALERT_OVERRIDDEN') {
          setToastMessage(`Alert #${data.alert_id} overridden [${data.reason_code}]`);
          setToastType('info');
          refreshBadge();
        } else if (data.type === 'SCENARIO_REPLAY_COMPLETED') {
          setToastMessage(`Scenario replay: ${data.averted_damage} protected`);
          setToastType('success');
        } else if (data.type === 'GRAPHS_UPDATED') {
          setToastMessage(`Backend pushed ${data.total_generated || 25} fresh charts!`);
          setToastType('success');
          refreshGraphs();
        }
      },
      () => setWsConnected(true),
      () => setWsConnected(false)
    );

    return () => ws.close();
  }, [refreshBadge, refreshGraphs]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  return (
    <div className="min-h-screen flex bg-white text-airtable-body">
      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openAlertsCount={openAlertsCount}
        wsConnected={wsConnected}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen w-full md:pl-60 transition-all duration-200">
        {/* Unified Top Navigation Header */}
        <TopBar
          activeTab={activeTab}
          onRefresh={handleGlobalRefresh}
          wsConnected={wsConnected}
        />

        <main className="flex-1 overflow-auto pb-20 md:pb-8">
          {activeTab === 'dashboard' && (
            <Dashboard
              key={`dash-${refreshTrigger}`}
              onNavigateToAlerts={() => setActiveTab('alerts')}
              onRefreshBadge={refreshBadge}
            />
          )}
          {activeTab === 'alerts' && (
            <Alerts key={`alerts-${refreshTrigger}`} />
          )}
          {activeTab === 'demand' && (
            <Demand key={`demand-${refreshTrigger}`} />
          )}
          {activeTab === 'supply' && (
            <Supply key={`supply-${refreshTrigger}`} />
          )}
          {activeTab === 'inventory' && (
            <Inventory key={`inventory-${refreshTrigger}`} />
          )}
          {activeTab === 'distribution' && (
            <Distribution key={`distribution-${refreshTrigger}`} />
          )}
          {activeTab === 'transportation' && (
            <Transportation key={`transportation-${refreshTrigger}`} />
          )}
          {activeTab === 'depots' && (
            <Depots key={`depots-${refreshTrigger}`} />
          )}
          {activeTab === 'graphs' && (
            <MatplotlibStudio key={`graphs-${refreshTrigger}`} />
          )}
          {activeTab === 'scenario' && (
            <ScenarioReplay key={`scenario-${refreshTrigger}`} />
          )}
        </main>
      </div>

      {/* Live Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg bg-white border border-airtable-hairline shadow-md animate-slide-up"
        >
          <div
            className={`p-1.5 rounded-md flex-shrink-0 ${
              toastType === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-airtable-ink'
            }`}
          >
            {toastType === 'success' ? (
              <ShieldCheck className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </div>
          <span className="text-xs sm:text-sm font-medium text-airtable-ink">
            {toastMessage}
          </span>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 rounded hover:bg-slate-100 text-airtable-muted transition-colors ml-1"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ChartEngineProvider>
      <AppContent />
    </ChartEngineProvider>
  );
}
