# Pulp Riot Juice Co. — Standard Operating Procedure: Demand Sensing & Channel Allocation
**Document ID:** SOP-MKT-DEM-001 | **Revision:** 3.0 | **Effective:** Summer Season 2027

## 1. Purpose & Scope
Covers daily sales order ingestion, rolling 14-day SARIMAX demand forecasting, and channel allocation rules across Quick Commerce (QC), Modern Trade (MT), and General Trade (GT).

## 2. Channel Allocation Rules
- Baseline share targets: GT 55%, MT 25%, QC 20%.
- Quick Commerce Velocity Trigger: If 3-day rolling QC sell-through exceeds forecast by >25% (KPI B3), the system automatically recalibrates weekly regional depot allocations.
- Acceptable forecast defect rate: <= 3.0% unfulfilled customer demand.

## 3. Defect Classification
1. **DarkStore_Stockout**: Store inventory drops to 0 bottles during operating hours.
2. **Forecast_Underestimation_Lag**: Forecast error variance > 25% over 3 rolling days.
3. **Channel_Allocation_Mismatch**: Wholesale overstocked while retail accounts face backorders.
