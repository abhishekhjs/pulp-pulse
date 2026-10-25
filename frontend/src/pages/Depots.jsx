import React, { useState, useEffect, useRef } from 'react';
import {
  Warehouse,
  ArrowRightLeft,
  RefreshCw,
  X,
  Package,
  AlertTriangle,
  QrCode,
} from 'lucide-react';
import { fetchDepots, fetchDepotBatches, createTransfer } from '../lib/api';
import DepotTable from '../components/DepotTable';
import AgeClock from '../components/AgeClock';
import ScanModal from '../components/ScanModal';

export default function Depots() {
  const [depots, setDepots] = useState([]);
  const [selectedDepotId, setSelectedDepotId] = useState(null);
  const [batches, setBatches] = useState([]);
  const [loadingDepots, setLoadingDepots] = useState(true);
  const [loadingBatches, setLoadingBatches] = useState(false);

  // Inspection Drawer/Modal state
  const [inspectDrawerOpen, setInspectDrawerOpen] = useState(false);
  const [inspectingDepot, setInspectingDepot] = useState(null);

  // Transfer modal state
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferBatch, setTransferBatch] = useState(null);
  const [toDepotId, setToDepotId] = useState('');
  const [transferQty, setTransferQty] = useState(0);
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  // Section 16.4 Handheld scan modal state
  const [scanModalOpen, setScanModalOpen] = useState(false);

  const batchesSectionRef = useRef(null);

  const loadDepots = async () => {
    try {
      setLoadingDepots(true);
      const data = await fetchDepots();
      setDepots(data);
      if (data.length > 0 && !selectedDepotId) {
        setSelectedDepotId(data[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDepots(false);
    }
  };

  const loadBatches = async (depotId) => {
    if (!depotId) return;
    try {
      setLoadingBatches(true);
      const data = await fetchDepotBatches(depotId);
      setBatches(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBatches(false);
    }
  };

  useEffect(() => {
    loadDepots();
  }, []);

  useEffect(() => {
    if (selectedDepotId) loadBatches(selectedDepotId);
  }, [selectedDepotId]);

  // Handle Escape key for all modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (transferModalOpen) {
          setTransferModalOpen(false);
        } else if (inspectDrawerOpen) {
          setInspectDrawerOpen(false);
        } else if (scanModalOpen) {
          setScanModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [transferModalOpen, inspectDrawerOpen, scanModalOpen]);

  const handleScanSuccess = () => {
    loadDepots();
    if (selectedDepotId) {
      loadBatches(selectedDepotId);
    }
  };

  // Handle card body click: select & smooth-scroll down to batch telemetry
  const handleSelectDepot = (depotId) => {
    setSelectedDepotId(depotId);
    loadBatches(depotId);
    setTimeout(() => {
      batchesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  // Handle explicit "Inspect" button click: open side inspection drawer / modal
  const handleInspectDepot = (depot) => {
    setSelectedDepotId(depot.id);
    setInspectingDepot(depot);
    loadBatches(depot.id);
    setInspectDrawerOpen(true);
  };

  const openTransferModal = (batch, fromDepotId) => {
    setTransferBatch(batch);
    setTransferQty(batch.quantity);
    const activeDepotId = fromDepotId || selectedDepotId;
    const others = depots.filter((d) => d.id !== activeDepotId);
    setToDepotId(others.length > 0 ? String(others[0].id) : '');
    setTransferModalOpen(true);
  };

  const handleCreateTransfer = async (e) => {
    e.preventDefault();
    if (!transferBatch || !toDepotId) return;
    setTransferSubmitting(true);
    try {
      await createTransfer({
        batch_id: transferBatch.id,
        from_depot_id: selectedDepotId,
        to_depot_id: parseInt(toDepotId),
        quantity: parseInt(transferQty),
      });
      setTransferModalOpen(false);
      loadBatches(selectedDepotId);
      loadDepots();
    } catch (err) {
      console.error(err);
    } finally {
      setTransferSubmitting(false);
    }
  };

  const currentDepot = depots.find((d) => d.id === selectedDepotId);
  const activeInspectingDepot = inspectingDepot || currentDepot;

  return (
    <div className="p-5 sm:p-8 space-y-8 pb-16 bg-white min-h-[calc(100vh-4rem)] max-w-[1400px]">
      {/* Subheader info bar */}
      <div className="flex items-center justify-between pb-1 border-b border-airtable-hairline/60">
        <div className="flex items-center gap-2">
          <Warehouse className="w-4 h-4 text-airtable-ink" />
          <span className="section-label">9 Regional Hubs Telemetry</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            id="btn-open-simulate-scan"
            onClick={() => setScanModalOpen(true)}
            className="btn-secondary text-xs flex items-center gap-1.5 py-1 px-2.5 shadow-2xs hover:border-airtable-border-strong cursor-pointer"
            title="Simulate Handheld Barcode / RFID Scanner"
          >
            <QrCode className="w-3.5 h-3.5 text-blue-600" />
            <span>Simulate Handheld Scan</span>
          </button>
          <span className="text-xs text-airtable-muted font-mono hidden sm:inline">
            Arbitrage: ₹1.50/btl transfer vs ₹60.00 write-off avoided
          </span>
        </div>
      </div>

      {/* Depot grid */}
      {loadingDepots ? (
        <div className="flex h-48 items-center justify-center gap-3 text-sm text-airtable-muted">
          <RefreshCw className="w-4 h-4 animate-spin text-airtable-ink" />
          Loading depot telemetry...
        </div>
      ) : (
        <DepotTable
          depots={depots}
          selectedDepotId={selectedDepotId}
          onSelectDepot={handleSelectDepot}
          onInspectDepot={handleInspectDepot}
        />
      )}

      {/* Selected depot batches (Inline section below grid) */}
      {currentDepot && (
        <div
          ref={batchesSectionRef}
          className="rounded-lg bg-white border border-airtable-hairline shadow-xs scroll-mt-20"
        >
          {/* Depot header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-b border-airtable-hairline/80">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-airtable-surface-soft text-airtable-ink border border-airtable-hairline">
                  {currentDepot.region} Region
                </span>
                <span className="text-xs text-airtable-muted font-medium">Batch Inventory Telemetry</span>
              </div>
              <h2 className="text-base font-medium text-airtable-ink">
                Active Batches at {currentDepot.name}
              </h2>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded text-xs bg-airtable-surface-soft border border-airtable-hairline">
              <span className="text-airtable-muted">Total stock:</span>
              <span className="font-mono font-medium text-airtable-ink">
                {currentDepot.total_bottles.toLocaleString()} btls
              </span>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {loadingBatches ? (
              <div className="flex h-40 items-center justify-center gap-3 text-sm text-airtable-muted">
                <RefreshCw className="w-4 h-4 animate-spin text-airtable-ink" />
                Loading batches...
              </div>
            ) : batches.length === 0 ? (
              <div className="p-8 text-center text-xs text-airtable-muted">
                No active batches in inventory at this depot.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {batches.map((batch) => {
                  const isOverAge18 = batch.age_days >= 18;
                  return (
                    <div
                      key={batch.id}
                      className="rounded-lg bg-white border border-airtable-hairline shadow-2xs hover:border-airtable-border-strong transition-colors"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="font-mono text-[10px] text-airtable-muted mb-0.5">
                              Batch #{batch.id}
                            </div>
                            <h4 className="text-sm font-medium text-airtable-ink">{batch.flavor_name}</h4>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-[13px] font-medium text-airtable-ink">
                              {batch.quantity.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-airtable-muted">bottles</div>
                          </div>
                        </div>

                        <AgeClock
                          ageDays={batch.age_days}
                          quantity={batch.quantity}
                          status={batch.status}
                        />

                        <div className="mt-3 pt-3 border-t border-airtable-hairline/60">
                          <div className="text-xs text-airtable-muted mb-2">
                            Bottled: <span className="font-mono text-airtable-body">{batch.bottled_date}</span>
                          </div>
                          <button
                            onClick={() => openTransferModal(batch, currentDepot.id)}
                            className={`w-full ${isOverAge18 ? 'btn-primary' : 'btn-secondary'}`}
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            Transfer (₹1.50/btl)
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Slide-Over Inspection Drawer (Airtable Spec) ────── */}
      {inspectDrawerOpen && activeInspectingDepot && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs animate-fade-in"
          onClick={() => setInspectDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Inspection Drawer for ${activeInspectingDepot.name}`}
        >
          <div
            className="w-full max-w-2xl bg-white h-full shadow-2xl border-l border-airtable-hairline flex flex-col animate-slide-up sm:animate-none overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-airtable-hairline flex items-center justify-between flex-shrink-0 bg-white">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[11px] font-medium px-2 py-0.5 rounded bg-airtable-surface-soft text-airtable-ink border border-airtable-hairline">
                    {activeInspectingDepot.region} Region
                  </span>
                  {activeInspectingDepot.at_risk_count > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#fefce8] text-[#854d0e] border border-[#fef08a]">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {activeInspectingDepot.at_risk_count} at risk
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-medium text-airtable-ink">
                  {activeInspectingDepot.name}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 rounded text-xs bg-airtable-surface-soft border border-airtable-hairline text-airtable-ink font-mono font-medium">
                  {activeInspectingDepot.total_bottles.toLocaleString()} btls
                </div>
                <button
                  onClick={() => setInspectDrawerOpen(false)}
                  className="btn-secondary p-1.5"
                  aria-label="Close inspection drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Cover Days quick stats */}
              <div className="p-4 rounded-lg bg-airtable-surface-soft border border-airtable-hairline">
                <h3 className="text-xs font-medium text-airtable-ink mb-2.5 uppercase tracking-wide">
                  Cover Days Telemetry
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {activeInspectingDepot.flavors?.map((fc) => (
                    <div key={fc.flavor_id} className="p-2.5 bg-white rounded border border-airtable-hairline text-xs">
                      <div className="text-[11px] text-airtable-muted truncate">{fc.flavor_name}</div>
                      <div className="font-mono font-medium text-airtable-ink mt-0.5">{fc.cover_days}d</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Batches Header */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-airtable-ink">
                    Active Batches ({batches.length})
                  </h3>
                  <span className="text-xs text-airtable-muted">
                    Click transfer to rebalance before Day 30
                  </span>
                </div>

                {loadingBatches ? (
                  <div className="flex h-40 items-center justify-center gap-2 text-sm text-airtable-muted">
                    <RefreshCw className="w-4 h-4 animate-spin text-airtable-ink" />
                    Loading batch telemetry...
                  </div>
                ) : batches.length === 0 ? (
                  <div className="p-8 text-center text-xs text-airtable-muted bg-airtable-surface-soft rounded-lg border border-airtable-hairline">
                    No active batches found at this depot.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {batches.map((batch) => {
                      const isOverAge18 = batch.age_days >= 18;
                      return (
                        <div
                          key={batch.id}
                          className="rounded-lg bg-white border border-airtable-hairline p-4 shadow-2xs hover:border-airtable-border-strong transition-colors"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="font-mono text-[10px] text-airtable-muted mb-0.5">
                                Batch #{batch.id}
                              </div>
                              <h4 className="text-sm font-medium text-airtable-ink">{batch.flavor_name}</h4>
                            </div>
                            <div className="text-right">
                              <div className="font-mono text-[13px] font-medium text-airtable-ink">
                                {batch.quantity.toLocaleString()}
                              </div>
                              <div className="text-[10px] text-airtable-muted">bottles</div>
                            </div>
                          </div>

                          <AgeClock
                            ageDays={batch.age_days}
                            quantity={batch.quantity}
                            status={batch.status}
                          />

                          <div className="mt-3 pt-3 border-t border-airtable-hairline/60">
                            <div className="text-xs text-airtable-muted mb-2">
                              Bottled: <span className="font-mono text-airtable-body">{batch.bottled_date}</span>
                            </div>
                            <button
                              onClick={() => openTransferModal(batch, activeInspectingDepot.id)}
                              className={`w-full ${isOverAge18 ? 'btn-primary' : 'btn-secondary'}`}
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              Transfer (₹1.50/btl)
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="px-6 py-3 border-t border-airtable-hairline bg-airtable-surface-soft flex justify-end">
              <button
                onClick={() => setInspectDrawerOpen(false)}
                className="btn-secondary text-xs"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Transfer Modal ──────────────────────────────────── */}
      {transferModalOpen && transferBatch && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in"
          onClick={() => setTransferModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Initiate Inter-Depot Transfer"
        >
          <div
            className="w-full max-w-md rounded-lg p-6 shadow-soft bg-white border border-airtable-hairline animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium text-airtable-ink flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-airtable-ink" />
                Inter-Depot Transfer
              </h3>
              <button
                onClick={() => setTransferModalOpen(false)}
                className="btn-secondary p-1"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Batch info */}
            <div className="p-3.5 rounded mb-4 text-xs space-y-1.5 bg-airtable-surface-soft border border-airtable-hairline">
              <div>
                <span className="text-airtable-muted">Batch:</span>{' '}
                <span className="text-airtable-ink font-mono font-medium">
                  #{transferBatch.id} ({transferBatch.flavor_name})
                </span>
              </div>
              <div>
                <span className="text-airtable-muted">Origin:</span>{' '}
                <span className="text-airtable-ink">{currentDepot?.name}</span>
              </div>
              <div>
                <span className="text-airtable-muted">Age:</span>{' '}
                <span className="text-airtable-ink font-mono">{transferBatch.age_days} days</span>
              </div>
            </div>

            <form onSubmit={handleCreateTransfer} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-airtable-ink mb-1.5">Destination Depot</label>
                <select
                  value={toDepotId}
                  onChange={(e) => setToDepotId(e.target.value)}
                  className="input-base w-full"
                >
                  {depots
                    .filter((d) => d.id !== selectedDepotId)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.region} Region)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-airtable-ink mb-1.5">Quantity (Bottles)</label>
                <input
                  type="number"
                  max={transferBatch.quantity}
                  min={1}
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                  className="input-base w-full"
                />
              </div>

              {/* Economic arbitrage note (Airtable signature-cream) */}
              <div className="p-3.5 rounded bg-[#f5e9d4]/60 border border-[#e8dfcb]">
                <div className="text-[11.5px] text-airtable-ink leading-relaxed">
                  <span className="font-semibold">Arbitrage:</span> Transfer cost ₹
                  {(transferQty * 1.5).toFixed(2)} vs up to ₹
                  {(transferQty * 60).toFixed(2)} write-off avoided.
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferSubmitting}
                  className="btn-primary text-xs"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Section 16.4 Handheld Barcode/RFID Scan Simulation */}
      <ScanModal
        isOpen={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        depots={depots}
        selectedDepotId={selectedDepotId}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
}
