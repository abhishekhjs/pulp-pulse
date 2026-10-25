import React, { createContext, useContext, useState, useCallback } from 'react';
import { regenerateAllGraphs } from '../lib/api';

const ChartEngineContext = createContext({
  engine: 'plotly',
  setEngine: () => {},
  toggleEngine: () => {},
  graphTimestamp: Date.now(),
  refreshGraphs: () => {},
  regenerating: false,
  triggerRegeneration: async () => {},
});

export function ChartEngineProvider({ children }) {
  const [engine, setEngine] = useState('plotly');
  const [graphTimestamp, setGraphTimestamp] = useState(Date.now());
  const [regenerating, setRegenerating] = useState(false);

  const toggleEngine = useCallback(() => {
    setEngine((prev) => (prev === 'matplotlib' ? 'plotly' : 'matplotlib'));
  }, []);

  const refreshGraphs = useCallback(() => {
    setGraphTimestamp(Date.now());
  }, []);

  const triggerRegeneration = useCallback(async () => {
    setRegenerating(true);
    try {
      const res = await regenerateAllGraphs();
      setGraphTimestamp(Date.now());
      return res;
    } finally {
      setRegenerating(false);
    }
  }, []);

  return (
    <ChartEngineContext.Provider
      value={{
        engine,
        setEngine,
        toggleEngine,
        graphTimestamp,
        refreshGraphs,
        regenerating,
        triggerRegeneration,
      }}
    >
      {children}
    </ChartEngineContext.Provider>
  );
}

export function useChartEngine() {
  return useContext(ChartEngineContext);
}
