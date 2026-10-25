import React, { useState } from 'react';
import {
  X,
  QrCode,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Truck,
  Building2,
  Store,
  Layers,
} from 'lucide-react';
import { ingestScan } from '../lib/api';

const FLAVORS = [
  { id: 1, name: 'Mango Peach Basil', code: 'MPB' },
  { id: 2, name: 'Guava Chilli', code: 'GC' },
  { id: 3, name: 'Passionfruit Punch', code: 'PP' },
  { id: 4, name: 'Dragonfruit Bloom', code: 'DFB' },
  { id: 5, name: 'Dragon Passion', code: 'DP' },
];

export default function ScanModal({ isOpen, onClose, depots = [], selectedDepotId, onScanSuccess }) {
  const [scanType, setScanType] = useState('factory_to_depot'); // 'factory_to_depot' | 'depot_to_distributor'
  const [flavorId, setFlavorId] = useState(1);
  const [quantity, setQuantity] = useState(5000);
  const [channel, setChannel] = useState('MT');
  const [depotId, setDepotId] = useState(selectedDepotId || (depots[0]?.id || 1));
  const [parcelCode, setParcelCode] = useState(
    () => `PULP-SCAN-${Math.floor(1000 + Math.random() * 9000)}`
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanResult, setScanResult] = useState(null);

  if (!isOpen) return null;

  const currentDepot = depots.find((d) => d.id === Number(depotId)) || depots[0];

  const handleGenerateBarcode = () => {
    const prefix = scanType === 'factory_to_depot' ? 'FAC' : 'DEP';
    setParcelCode(`PULP-${prefix}-${Math.floor(100000 + Math.random() * 900000)}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setScanResult(null);

    try {
      const payload = {
        parcel_code: parcelCode,
        from_node_type: scanType === 'factory_to_depot' ? 'factory' : 'depot',
        from_node_id: scanType === 'factory_to_depot' ? 1 : Number(depotId),
        to_node_type: scanType === 'factory_to_depot' ? 'depot' : 'distributor',
        to_node_id: scanType === 'factory_to_depot' ? Number(depotId) : 1,
        flavor_id: Number(flavorId),
        quantity: Number(quantity),
        channel: channel,
      };

      const result = await ingestScan(payload);
      setScanResult(result);
      if (onScanSuccess) {
        onScanSuccess(result);
      }
      // Regenerate parcel code for next scan
      const prefix = scanType === 'factory_to_depot' ? 'FAC' : 'DEP';
      setParcelCode(`PULP-${prefix}-${Math.floor(100000 + Math.random() * 900000)}`);
    } catch (err) {
      setError(err.message || 'Failed to ingest scan event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-airtable-ink/40 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Simulate Handheld Barcode and RFID Scanner"
    >
      <div
        className="w-full max-w-xl rounded-lg p-6 shadow-soft bg-white border border-airtable-hairline animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-airtable-hairline mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-medium px-2 py-0.5 rounded-xs bg-airtable-surface-soft text-airtable-link border border-airtable-hairline">
                TELEMETRY INGESTION
              </span>
              <span className="text-xs text-airtable-muted font-mono">
                Handheld RFID / Barcode Ingestion
              </span>
            </div>
            <h2 className="text-lg font-medium text-airtable-ink">
              Simulate Physical Barcode Scan
            </h2>
            <p className="text-xs text-airtable-muted mt-0.5">
              Physical movement write-path: atomic batch update and zero-polling Inventory Freshness evaluation.
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-secondary p-1.5 cursor-pointer"
            aria-label="Close scan simulator"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scan Type Segmented Control */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-airtable-surface-soft border border-airtable-hairline mb-5 text-xs font-medium">
          <button
            type="button"
            id="scan-mode-factory"
            onClick={() => {
              setScanType('factory_to_depot');
              handleGenerateBarcode();
            }}
            className={`py-2 px-3 rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
              scanType === 'factory_to_depot'
                ? 'bg-white text-airtable-ink shadow-2xs border border-airtable-hairline font-medium'
                : 'text-airtable-muted hover:text-airtable-ink'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-airtable-link" />
            <span>Factory → Depot (Intake)</span>
          </button>
          <button
            type="button"
            id="scan-mode-depot"
            onClick={() => {
              setScanType('depot_to_distributor');
              handleGenerateBarcode();
            }}
            className={`py-2 px-3 rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
              scanType === 'depot_to_distributor'
                ? 'bg-white text-airtable-ink shadow-2xs border border-airtable-hairline font-medium'
                : 'text-airtable-muted hover:text-airtable-ink'
            }`}
          >
            <Store className="w-3.5 h-3.5 text-airtable-forest" />
            <span>Depot → Distributor (Dispatch)</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Barcode/Parcel Input Row */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-airtable-ink flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-airtable-muted" />
                <span>Parcel / Barcode Code</span>
              </label>
              <button
                type="button"
                onClick={handleGenerateBarcode}
                className="text-[11px] font-mono text-airtable-link hover:text-airtable-link-active underline cursor-pointer"
              >
                Regenerate ID
              </button>
            </div>
            <input
              id="scan-parcel-code"
              type="text"
              value={parcelCode}
              onChange={(e) => setParcelCode(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs font-mono rounded-sm border border-airtable-hairline bg-white text-airtable-ink focus:outline-none focus:ring-1 focus:ring-airtable-info-border focus:border-airtable-info-border"
            />
          </div>

          {/* Node Movement Grid */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-sm bg-airtable-surface-soft border border-airtable-hairline text-xs">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-airtable-muted block mb-1">
                From Location
              </span>
              <div className="flex items-center gap-1.5 font-medium text-airtable-ink">
                {scanType === 'factory_to_depot' ? (
                  <>
                    <Building2 className="w-3.5 h-3.5 text-airtable-link" />
                    <span>Surat Bottling Plant (Factory #1)</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-3.5 h-3.5 text-airtable-forest" />
                    <span>{currentDepot?.name || 'Selected Depot'}</span>
                  </>
                )}
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-airtable-muted block mb-1">
                To Location
              </span>
              <div className="flex items-center gap-1.5 font-medium text-airtable-ink">
                {scanType === 'factory_to_depot' ? (
                  <select
                    id="scan-target-depot"
                    value={depotId}
                    onChange={(e) => setDepotId(e.target.value)}
                    className="w-full bg-white px-2 py-1 rounded-sm border border-airtable-hairline text-xs text-airtable-ink focus:outline-none focus:border-airtable-info-border"
                  >
                    {depots.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.city})
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <Store className="w-3.5 h-3.5 text-airtable-forest" />
                    <span>Metro Distributor Hub #{depotId}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Flavor & Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-airtable-ink block mb-1.5">
                Flavor SKU
              </label>
              <select
                id="scan-flavor-select"
                value={flavorId}
                onChange={(e) => setFlavorId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-sm border border-airtable-hairline bg-white text-airtable-ink focus:outline-none focus:ring-1 focus:ring-airtable-info-border focus:border-airtable-info-border"
              >
                {FLAVORS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-airtable-ink block mb-1.5">
                Quantity (Bottles)
              </label>
              <input
                id="scan-quantity-input"
                type="number"
                min="100"
                step="500"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono rounded-sm border border-airtable-hairline bg-white text-airtable-ink focus:outline-none focus:ring-1 focus:ring-airtable-info-border focus:border-airtable-info-border"
              />
            </div>
          </div>

          {scanType === 'depot_to_distributor' && (
            <div>
              <label className="text-xs font-medium text-airtable-ink block mb-1.5">
                Target Retail Channel
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['MT', 'QC', 'GT'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setChannel(c)}
                    className={`py-1.5 text-xs font-mono rounded-sm border text-center transition-all cursor-pointer ${
                      channel === c
                        ? 'bg-airtable-primary text-white border-airtable-primary font-medium'
                        : 'bg-white text-airtable-ink border-airtable-hairline hover:bg-airtable-surface-soft'
                    }`}
                  >
                    {c === 'MT' ? 'Modern Trade (MT)' : c === 'QC' ? 'Quick Commerce (QC)' : 'General Trade (GT)'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-sm bg-airtable-coral/10 border border-airtable-coral/30 flex items-start gap-2 text-xs text-airtable-coral">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {scanResult && (
            <div
              id="scan-result-card"
              className="p-3.5 rounded-sm bg-airtable-forest/10 border border-airtable-forest/30 animate-fade-in"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="w-4 h-4 text-airtable-forest" />
                <span className="text-xs font-medium text-airtable-forest">
                  Scan Ingested & Evaluated Atomically
                </span>
              </div>
              <p className="text-xs text-airtable-body leading-relaxed mb-2">
                {scanResult.message}
              </p>
              <div className="flex items-center gap-3 text-[11px] font-mono text-airtable-forest flex-wrap pt-1.5 border-t border-airtable-forest/20">
                <span>Scan ID: #{scanResult.scan_id}</span>
                <span>Batch: #{scanResult.batch_id}</span>
                <span>Status: {scanResult.batch_status}</span>
                <span>Units: {scanResult.batch_quantity?.toLocaleString()}</span>
                {scanResult.units_sold_updated !== null && (
                  <span>Sales +{scanResult.units_sold_updated?.toLocaleString()}</span>
                )}
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-airtable-hairline">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs px-3 py-2 cursor-pointer"
            >
              Close
            </button>
            <button
              id="btn-submit-scan"
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-medium rounded-lg text-white bg-airtable-primary hover:bg-airtable-primary-active active:bg-airtable-primary-active disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {loading ? (
                <span>Ingesting Scan...</span>
              ) : (
                <>
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Transmit Scan Event</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
