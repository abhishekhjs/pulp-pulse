"""
Matplotlib Graph Generation Engine for Project Resilient Pulp.
Generates publication-quality charts for all supply chain modules:
Executive Dashboard, Demand Sensing, Supply & Co-Packers, Inventory Decay,
Multi-Depot Distribution, Transportation Telemetry, and Scenario Replay.
"""

import os
import io
import base64
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import numpy as np

# ── Brand Color Palette ──────────────────────────────────────────────────────
COLOR_PRIMARY = "#1a6641"    # Forest Green / Model Protected / Safe
COLOR_CORAL   = "#aa2d00"    # Coral Red / Alert / Crisis / Breaches
COLOR_BLUE    = "#2563eb"    # Quick Commerce / Telemetry
COLOR_AMBER   = "#d97706"    # Warning / Buffer / Modern Trade
COLOR_PURPLE  = "#7c3aed"    # General Trade / Postponement
COLOR_SLATE   = "#0f172a"    # Slate Ink / Actual Realised
COLOR_MUTED   = "#64748b"    # Secondary text / Baseline
COLOR_GRID    = "#e2e8f0"    # Crisp subtle gridlines
COLOR_BG      = "#ffffff"    # Clean canvas background
COLOR_SOFT_BG = "#f8fafc"    # Card soft background

def _init_plot_style():
    """Sets standard matplotlib rcParams for crisp corporate rendering."""
    plt.rcParams.update({
        'font.sans-serif': ['DejaVu Sans', 'Arial', 'Helvetica', 'sans-serif'],
        'font.family': 'sans-serif',
        'font.size': 10,
        'axes.titlesize': 13,
        'axes.titleweight': 'bold',
        'axes.labelsize': 10,
        'axes.labelweight': 'bold',
        'axes.edgecolor': '#cbd5e1',
        'axes.linewidth': 0.8,
        'axes.grid': True,
        'grid.color': COLOR_GRID,
        'grid.linestyle': '--',
        'grid.linewidth': 0.7,
        'grid.alpha': 0.7,
        'xtick.color': COLOR_MUTED,
        'ytick.color': COLOR_MUTED,
        'xtick.labelsize': 9,
        'ytick.labelsize': 9,
        'figure.facecolor': COLOR_BG,
        'axes.facecolor': COLOR_BG,
        'savefig.facecolor': COLOR_BG,
        'savefig.edgecolor': 'none',
        'savefig.dpi': 160,
    })

_init_plot_style()

def _fig_to_png_bytes(fig) -> bytes:
    """Converts a matplotlib figure to PNG byte buffer and frees memory."""
    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=160, bbox_inches='tight', facecolor=COLOR_BG)
    plt.close(fig)
    buf.seek(0)
    return buf.getvalue()

def _fig_to_base64(fig) -> str:
    """Converts a matplotlib figure to base64 data URI."""
    raw = _fig_to_png_bytes(fig)
    return f"data:image/png;base64,{base64.b64encode(raw).decode('utf-8')}"

# ══════════════════════════════════════════════════════════════════════════════
# 1. EXECUTIVE & DASHBOARD GRAPHS
# ══════════════════════════════════════════════════════════════════════════════

def generate_dashboard_resilience_radar(db=None) -> bytes:
    """Radar chart: Baseline vs Model across 6 operational resilience dimensions."""
    categories = [
        'Demand\nAccuracy',
        'Supply\nCoverage',
        'Inventory\nHealth',
        'Distribution\nBalance',
        'Transport\nSLA',
        'Cost\nControl',
    ]
    baseline = [40, 35, 45, 38, 60, 50]
    model = [82, 90, 88, 85, 95, 87]

    N = len(categories)
    angles = [n / float(N) * 2 * np.pi for n in range(N)]
    angles += angles[:1]

    baseline_cycle = baseline + baseline[:1]
    model_cycle = model + model[:1]

    fig, ax = plt.subplots(figsize=(8, 7), subplot_kw=dict(polar=True))
    ax.set_theta_offset(np.pi / 2)
    ax.set_theta_direction(-1)

    plt.xticks(angles[:-1], categories, color=COLOR_SLATE, size=10, weight='semibold')
    ax.set_rlabel_position(30)
    plt.yticks([20, 40, 60, 80, 100], ["20%", "40%", "60%", "80%", "100%"], color=COLOR_MUTED, size=8)
    plt.ylim(0, 100)

    # Plot Baseline
    ax.plot(angles, baseline_cycle, color=COLOR_CORAL, linewidth=2, linestyle='--', label='Summer Baseline (44.7% avg)')
    ax.fill(angles, baseline_cycle, color=COLOR_CORAL, alpha=0.15)

    # Plot Model Protected
    ax.plot(angles, model_cycle, color=COLOR_PRIMARY, linewidth=2.5, marker='o', markersize=5, label='Agent Model Protected (87.8% avg)')
    ax.fill(angles, model_cycle, color=COLOR_PRIMARY, alpha=0.25)

    plt.title("Operational Resilience Scorecard\nSummer Baseline vs. Agent Model", pad=25, fontsize=13, weight='bold', color=COLOR_SLATE)
    plt.legend(loc='lower center', bbox_to_anchor=(0.5, -0.18), ncol=2, frameon=True, facecolor=COLOR_SOFT_BG, edgecolor=COLOR_GRID, fontsize=9)

    return _fig_to_png_bytes(fig)


def generate_dashboard_waterfall(db=None) -> bytes:
    """Waterfall chart: Summer Baseline to Actual Realised vs Protected Revenue."""
    names = [
        'Summer\nBaseline',
        'Stockout\nLoss',
        'Write-off\nLoss',
        'Air Freight\nPremium',
        'Actual\nRealised',
        'With Model\nProtected'
    ]
    # Waterfall cumulative math
    starts = [0, 561.25, 555.25, 552.05, 0, 0]
    heights = [576.0, 14.75, 6.00, 3.20, 552.05, 573.10]
    colors = [COLOR_MUTED, COLOR_CORAL, COLOR_CORAL, COLOR_CORAL, COLOR_SLATE, COLOR_PRIMARY]
    signs = ['₹576.00', '-₹14.75', '-₹6.00', '-₹3.20', '₹552.05', '₹573.10']

    fig, ax = plt.subplots(figsize=(10, 5.5))
    x = np.arange(len(names))

    bars = ax.bar(x, heights, bottom=starts, color=colors, width=0.55, edgecolor='#000000', linewidth=0.5, zorder=3)

    # Add step connector lines
    for i in range(1, 4):
        prev_bottom = starts[i]
        ax.plot([i - 1 + 0.275, i - 0.275], [prev_bottom + heights[i], prev_bottom + heights[i]], color='#94a3b8', linestyle=':', linewidth=1)

    for i, (b, s) in enumerate(zip(bars, signs)):
        top = starts[i] + heights[i]
        label_y = top + 8 if heights[i] > 20 else top + 10
        ax.text(b.get_x() + b.get_width() / 2, label_y, s, ha='center', va='bottom', fontsize=9.5, weight='bold', color=colors[i])

    # Highlight protection delta
    ax.annotate(
        '+₹21.05 Cr Protected Profit (9.2x ROI)',
        xy=(5, 573.1), xytext=(3.6, 605),
        arrowprops=dict(facecolor=COLOR_PRIMARY, shrink=0.08, width=1.5, headwidth=6),
        fontsize=9.5, weight='bold', color=COLOR_PRIMARY,
        bbox=dict(boxstyle="round,pad=0.4", fc="#d1fae5", ec=COLOR_PRIMARY, lw=1)
    )

    ax.set_xticks(x)
    ax.set_xticklabels(names, fontsize=9.5, color=COLOR_SLATE)
    ax.set_ylabel("Revenue & Profit Contribution (₹ Crore)", fontsize=10, weight='bold', color=COLOR_SLATE)
    ax.set_ylim(0, 640)
    ax.set_title("Summer Season Financial Impact Waterfall (₹576 Cr Summer Base)", fontsize=12.5, weight='bold', color=COLOR_SLATE, pad=12)

    return _fig_to_png_bytes(fig)


def generate_dashboard_kpi_trend(kpi_code: str = 'B3', db=None) -> bytes:
    """Historical 30-day KPI Trend area chart with threshold & target markers."""
    days = [f"D{i+1}" for i in range(30)]
    np.random.seed(42)

    # Simulate realistic 30-day trajectory based on KPI code
    if kpi_code == 'B3':
        title = "KPI B3: Quick Commerce Demand Surge Velocity"
        unit = "%"
        target, trigger = 10.0, 25.0
        # Normal then viral surge starting D12 peaking at D15
        values = [8 + np.sin(i * 0.4) * 3 for i in range(11)]
        values += [32.0, 48.5, 78.2, 84.0, 62.1, 41.0, 31.5]  # Surge
        values += [22.0 - (i - 18) * 1.1 for i in range(18, 30)]
    elif kpi_code == 'D2':
        title = "KPI D2: Batch Freshness Age at Risk"
        unit = " days"
        target, trigger = 12.0, 18.0
        values = [11.0 + i * 0.35 + np.random.normal(0, 0.4) for i in range(30)]
    else:
        title = f"KPI {kpi_code}: 30-Day Operational Telemetry"
        unit = ""
        target, trigger = 85.0, 75.0
        values = [80 + np.sin(i * 0.3) * 8 + np.random.normal(0, 1.5) for i in range(30)]

    fig, ax = plt.subplots(figsize=(10, 5))
    x = np.arange(len(days))

    # Plot trendline and filled gradient
    ax.plot(x, values, color=COLOR_BLUE, linewidth=2.5, marker='o', markersize=4, label='Measured Velocity', zorder=4)
    ax.fill_between(x, values, color=COLOR_BLUE, alpha=0.12, zorder=2)

    # Reference lines
    ax.axhline(target, color=COLOR_PRIMARY, linestyle='--', linewidth=1.5, label=f'Target ({target}{unit})')
    ax.axhline(trigger, color=COLOR_CORAL, linestyle='--', linewidth=1.5, label=f'Alert Trigger ({trigger}{unit})')

    # Breach highlight
    breach_indices = [i for i, v in enumerate(values) if v >= trigger]
    if breach_indices:
        ax.scatter([x[i] for i in breach_indices], [values[i] for i in breach_indices], color=COLOR_CORAL, s=60, zorder=5, label='Threshold Breach')

    ax.set_xticks(x[::3])
    ax.set_xticklabels(days[::3], fontsize=8.5)
    ax.set_ylabel(f"Value ({unit.strip()})", fontsize=9.5, weight='bold', color=COLOR_SLATE)
    ax.set_title(title, fontsize=12, weight='bold', color=COLOR_SLATE, pad=12)
    ax.legend(loc='upper left', frameon=True, facecolor=COLOR_SOFT_BG, edgecolor=COLOR_GRID, fontsize=8.5)

    return _fig_to_png_bytes(fig)


def generate_dashboard_risk_heatmap(db=None) -> bytes:
    """5 Weeks x 7 Days Operational Risk Matrix Heatmap."""
    days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    weeks = ['Week 1 (Calm)', 'Week 2 (Surge Build)', 'Week 3 (Viral Spike)', 'Week 4 (Recovery)', 'Week 5 (Normalized)']

    # Risk counts per day
    grid = np.array([
        [1,  2,  1,  1,  2,  1,  1],
        [3,  4,  8, 12, 15, 11,  9],
        [18, 22, 25, 20, 17, 14, 10],
        [7,  5,  4,  3,  3,  2,  2],
        [2,  1,  1,  2,  1,  1,  1],
    ])

    fig, ax = plt.subplots(figsize=(9, 4.8))

    # Colormap: Calm (Yellow-Orange-Red)
    im = ax.imshow(grid, cmap='YlOrRd', aspect='auto', vmin=0, vmax=25)

    ax.set_xticks(np.arange(len(days)))
    ax.set_yticks(np.arange(len(weeks)))
    ax.set_xticklabels(days, fontsize=9.5, weight='bold', color=COLOR_SLATE)
    ax.set_yticklabels(weeks, fontsize=9, color=COLOR_SLATE)

    # Overlay numbers in cells
    for i in range(len(weeks)):
        for j in range(len(days)):
            val = grid[i, j]
            text_color = "white" if val > 12 else COLOR_SLATE
            ax.text(j, i, f"{val}\nalerts", ha="center", va="center", color=text_color, fontsize=8.5, weight="bold")

    cbar = fig.colorbar(im, ax=ax, fraction=0.03, pad=0.04)
    cbar.set_label("Daily Anomaly / Alert Events", fontsize=9, weight='bold')

    ax.set_title("Multi-Depot Operational Risk Heatmap (5-Week Incident Density)", fontsize=11.5, weight='bold', color=COLOR_SLATE, pad=12)

    return _fig_to_png_bytes(fig)


# ══════════════════════════════════════════════════════════════════════════════
# 2. DEMAND SENSING & FORECASTING GRAPHS
# ══════════════════════════════════════════════════════════════════════════════

def generate_demand_forecast_fan(flavor_id: int = 1, channel: str = 'QC', db=None) -> bytes:
    """SARIMAX Forecast Fan Chart with P10, P50 median, P90 confidence ribbon."""
    history_days = 20
    forecast_days = 14
    total_days = history_days + forecast_days

    x_hist = np.arange(history_days)
    x_fore = np.arange(history_days - 1, total_days)

    # Base historical curve with viral surge
    np.random.seed(101)
    base_hist = 1200 + np.sin(x_hist * 0.3) * 150
    # Viral acceleration at end of history
    base_hist[14:] = base_hist[14:] * np.linspace(1.0, 3.2, len(base_hist[14:]))

    # Forecast projections
    last_val = base_hist[-1]
    p50 = [last_val * (1.05 ** i) * (0.98 ** (i * 0.5)) for i in range(len(x_fore))]
    p10 = [v * 0.82 for v in p50]
    p90 = [v * 1.25 for v in p50]

    fig, ax = plt.subplots(figsize=(10, 5.2))

    # Plot history
    ax.plot(x_hist, base_hist, color=COLOR_SLATE, linewidth=2.2, label='Observed Orders (Actuals)', zorder=4)

    # Plot forecast median and confidence envelope
    ax.plot(x_fore, p50, color=COLOR_PRIMARY, linewidth=2.5, linestyle='-', label='SARIMAX Median (P50)', zorder=4)
    ax.fill_between(x_fore, p10, p90, color=COLOR_PRIMARY, alpha=0.2, label='90% Confidence Interval (P10–P90)', zorder=3)

    # Vertical split line
    ax.axvline(history_days - 1, color=COLOR_MUTED, linestyle=':', linewidth=1.5)
    ax.text(history_days - 1.2, max(p90) * 0.95, "Forecast Horizon →", ha='right', fontsize=9, color=COLOR_MUTED, weight='bold')

    # Viral spike annotation
    ax.annotate(
        "4.2x QC Viral Surge Detected\nAuto-trigger Co-Packer +10%",
        xy=(history_days - 2, base_hist[-2]), xytext=(history_days - 8, base_hist[-2] + 800),
        arrowprops=dict(facecolor=COLOR_CORAL, shrink=0.08, width=1.5, headwidth=6),
        fontsize=8.5, weight='bold', color=COLOR_CORAL,
        bbox=dict(boxstyle="round,pad=0.3", fc="#fee2e2", ec=COLOR_CORAL, lw=1)
    )

    ax.set_xlabel("Days (Historical D1-D20 | Forecast T+1-T+14)", fontsize=9.5, weight='bold')
    ax.set_ylabel("Daily Demand (Bottles/Day)", fontsize=9.5, weight='bold')
    ax.set_title("SARIMAX Multi-Regime Demand Trajectory (Dragon Passion - Quick Commerce)", fontsize=11.5, weight='bold', pad=12)
    ax.legend(loc='upper left', frameon=True, facecolor=COLOR_SOFT_BG, edgecolor=COLOR_GRID, fontsize=8.5)

    return _fig_to_png_bytes(fig)


def generate_demand_channel_series(db=None) -> bytes:
    """Stacked multi-channel demand trajectories: QC, MT, GT."""
    days = np.arange(1, 29)

    # Simulated volumes
    qc = 1000 + np.where(days >= 12, (days - 11) * 350 * np.exp(-(days - 15)**2 / 20), 0) + np.sin(days) * 50
    mt = 1400 + np.sin(days * 0.25) * 80 + (days > 14) * 180
    gt = 900 + np.sin(days * 0.2) * 50

    fig, ax = plt.subplots(figsize=(10, 5))

    ax.plot(days, qc, color=COLOR_BLUE, linewidth=2.5, label='Quick Commerce (QC - Viral Spiker)')
    ax.plot(days, mt, color=COLOR_PRIMARY, linewidth=2.0, label='Modern Trade (MT - Pre-Committed)')
    ax.plot(days, gt, color=COLOR_AMBER, linewidth=1.8, label='General Trade (GT - Steady)')

    # Shaded surge window
    ax.axvspan(12, 18, color=COLOR_CORAL, alpha=0.1, label='Viral Surge Impact Window')

    ax.set_xlabel("Timeline (Day 1 – Day 28)", fontsize=9.5, weight='bold')
    ax.set_ylabel("Daily Channel Orders (Bottles)", fontsize=9.5, weight='bold')
    ax.set_title("Multi-Channel Order Velocity & Demand Surge Spillover", fontsize=11.5, weight='bold', pad=12)
    ax.legend(loc='upper left', frameon=True, facecolor=COLOR_SOFT_BG, edgecolor=COLOR_GRID, fontsize=8.5)

    return _fig_to_png_bytes(fig)


def generate_demand_viral_propagation(db=None) -> bytes:
    """Viral spike propagation across 28 days comparing QC 4.2x spike vs MT, GT, Baseline."""
    days = np.arange(1, 29)
    qc_base = 1200
    qc_spike = []
    for d in days:
        if d < 12: qc_spike.append(qc_base)
        elif d == 12: qc_spike.append(qc_base * 1.5)
        elif d == 13: qc_spike.append(qc_base * 2.8)
        elif d == 14: qc_spike.append(qc_base * 4.2)
        elif d == 15: qc_spike.append(qc_base * 3.6)
        elif d == 16: qc_spike.append(qc_base * 2.1)
        elif d <= 20: qc_spike.append(qc_base * 1.6 - (d - 16) * 80)
        else: qc_spike.append(qc_base * 1.1)

    mt = [800 + np.sin(d * 0.4) * 60 + (300 if 13 < d < 18 else 0) for d in days]
    gt = [600 + np.sin(d * 0.3) * 40 for d in days]
    base = [900] * len(days)

    fig, ax = plt.subplots(figsize=(10, 5))

    ax.plot(days, qc_spike, color=COLOR_CORAL, linewidth=2.8, marker='o', markersize=4, label='QC Demand Spike (Peak 5,040 btls/day)')
    ax.plot(days, mt, color=COLOR_PRIMARY, linewidth=2.0, label='Modern Trade (Buffered)')
    ax.plot(days, gt, color=COLOR_AMBER, linewidth=1.8, label='General Trade')
    ax.plot(days, base, color=COLOR_MUTED, linestyle='--', linewidth=1.5, label='Normal Baseline (900 btls/day)')

    # Markers for key agent decisions
    ax.axvline(12, color=COLOR_CORAL, linestyle=':', linewidth=1.5)
    ax.text(12.2, 4500, "D12: Spike Sensed\n(Velocity >25%)", fontsize=8, color=COLOR_CORAL, weight='bold')

    ax.axvline(14, color=COLOR_PRIMARY, linestyle=':', linewidth=1.5)
    ax.text(14.2, 3500, "D14: Co-Packer +10%\nNotice Dispatched", fontsize=8, color=COLOR_PRIMARY, weight='bold')

    ax.set_xlabel("Summer Campaign Timeline (Days 1 to 28)", fontsize=9.5, weight='bold')
    ax.set_ylabel("Order Volume (Bottles/Day)", fontsize=9.5, weight='bold')
    ax.set_title("Viral Spike Propagation Timeline & Early Warning Activation", fontsize=11.5, weight='bold', pad=12)
    ax.legend(loc='upper right', frameon=True, facecolor=COLOR_SOFT_BG, edgecolor=COLOR_GRID, fontsize=8.5)

    return _fig_to_png_bytes(fig)


def generate_demand_flavor_share(db=None) -> bytes:
    """Horizontal bar chart: Flavor Market Share Momentum (Forecast vs Actual)."""
    flavors = [
        'Dragonfruit Bloom',
        'Passionfruit Punch',
        'Guava Chilli',
        'Mango Peach Basil',
        'Dragon Passion'
    ]
    forecast = [15, 15, 22, 30, 18]
    actual = [11, 13, 19, 26, 31]

    y = np.arange(len(flavors))
    height = 0.35

    fig, ax = plt.subplots(figsize=(9, 4.8))

    b1 = ax.barh(y - height/2, forecast, height, color=COLOR_MUTED, label='Pre-Season Plan %', alpha=0.85)
    b2 = ax.barh(y + height/2, actual, height, color=[COLOR_MUTED, COLOR_MUTED, COLOR_MUTED, COLOR_MUTED, COLOR_CORAL], label='Actual Summer Realised %')

    # Add text labels on bars
    for b in b1:
        ax.text(b.get_width() + 0.5, b.get_y() + b.get_height()/2, f"{b.get_width()}%", va='center', fontsize=8.5, color=COLOR_MUTED)
    for b in b2:
        ax.text(b.get_width() + 0.5, b.get_y() + b.get_height()/2, f"{b.get_width()}%", va='center', fontsize=8.5, weight='bold', color=COLOR_SLATE)

    # Highlight Dragon Passion surge
    ax.annotate(
        "+13% Share Shift\n(Unplanned Surge)",
        xy=(31, 4 + height/2), xytext=(24, 3.2),
        arrowprops=dict(facecolor=COLOR_CORAL, shrink=0.08, width=1.2, headwidth=5),
        fontsize=8.5, weight='bold', color=COLOR_CORAL,
        bbox=dict(boxstyle="round,pad=0.3", fc="#fee2e2", ec=COLOR_CORAL, lw=1)
    )

    ax.set_yticks(y)
    ax.set_yticklabels(flavors, fontsize=9.5, weight='bold', color=COLOR_SLATE)
    ax.set_xlabel("Market Share (% of Total Portfolio)", fontsize=9.5, weight='bold')
    ax.set_xlim(0, 38)
    ax.set_title("SKU Flavor Share Momentum: Planned vs. Actual Realised", fontsize=11.5, weight='bold', pad=12)
    ax.legend(loc='lower right', frameon=True, facecolor=COLOR_SOFT_BG, edgecolor=COLOR_GRID, fontsize=8.5)

    return _fig_to_png_bytes(fig)


def generate_demand_decomposition(db=None) -> bytes:
    """12-Week Stacked Demand Decomposition (Base, Seasonality, Temp, Social, Campaign + Orders)."""
    weeks = [f"Wk{i+1}" for i in range(12)]
    x = np.arange(len(weeks))

    base = np.array([500] * 12)
    seasonality = np.array([800 + i * 30 for i in range(12)])
    temp_effect = np.array([int(300 + np.sin(i * 0.5) * 80) for i in range(12)])
    social_trend = np.array([40, 40, 50, 60, 180, 310, 420, 310, 180, 80, 50, 40])
    campaign = np.array([80, 80, 80, 200, 200, 200, 200, 120, 80, 80, 80, 80])

    actual_orders = base + seasonality + temp_effect + social_trend + campaign + np.array([-40, 20, 30, -10, 80, 150, 210, 110, -30, -50, 10, 20])

    fig, ax = plt.subplots(figsize=(10, 5.2))

    p1 = ax.bar(x, base, width=0.55, color='#94a3b8', label='Base Run-rate')
    p2 = ax.bar(x, seasonality, bottom=base, width=0.55, color='#3b82f6', label='Summer Seasonality')
    p3 = ax.bar(x, temp_effect, bottom=base+seasonality, width=0.55, color='#f59e0b', label='Temperature Effect (>38°C)')
    p4 = ax.bar(x, campaign, bottom=base+seasonality+temp_effect, width=0.55, color='#8b5cf6', label='Marketing Campaign')
    p5 = ax.bar(x, social_trend, bottom=base+seasonality+temp_effect+campaign, width=0.55, color=COLOR_CORAL, label='Social Viral Momentum')

    # Line overlay
    ax.plot(x, actual_orders, color=COLOR_SLATE, linewidth=2.5, marker='o', markersize=5, label='Actual Orders Placed', zorder=5)

    ax.set_xticks(x)
    ax.set_xticklabels(weeks, fontsize=9)
    ax.set_ylabel("Demand Volume (Bottles/Week)", fontsize=9.5, weight='bold')
    ax.set_title("12-Week Demand Decomposition: Exogenous Signal Attribution", fontsize=11.5, weight='bold', pad=12)
    ax.legend(loc='upper left', ncol=3, frameon=True, facecolor=COLOR_SOFT_BG, edgecolor=COLOR_GRID, fontsize=8)

    return _fig_to_png_bytes(fig)


# ══════════════════════════════════════════════════════════════════════════════
# 3. SUPPLY & CO-PACKER OPERATIONS GRAPHS
# ══════════════════════════════════════════════════════════════════════════════

def generate_supply_copacker_utilization(db=None) -> bytes:
    """In-House Bottling vs Co-Packer Volume vs 95% Utilization Ceiling."""
    weeks = [f"Wk{i+1}" for i in range(10)]
    x = np.arange(len(weeks))

    in_house = [92, 94, 95, 96, 95, 95, 95, 94, 93, 91]
    copacker = [0, 0, 0, 5, 14, 18, 16, 12, 6, 0]

    fig, ax = plt.subplots(figsize=(10, 5))

    ax.bar(x, in_house, width=0.5, color=COLOR_SLATE, label='In-House Nashik Plant (%)')
    ax.bar(x, copacker, bottom=in_house, width=0.5, color=COLOR_PRIMARY, label='Co-Packer Triggered Volume (%)')

    ax.axhline(95, color=COLOR_CORAL, linestyle='--', linewidth=1.8, label='In-House Max Threshold (95%)')
    ax.axhline(100, color=COLOR_MUTED, linestyle=':', linewidth=1.2, label='100% Nameplate Capacity')

    ax.annotate(
        "Day 20: 14-Day Advance Co-Packer Notice\nPrevents ₹14.75 Cr Stockout",
        xy=(3, 101), xytext=(1.2, 112),
        arrowprops=dict(facecolor=COLOR_PRIMARY, shrink=0.08, width=1.5, headwidth=6),
        fontsize=8.5, weight='bold', color=COLOR_PRIMARY,
        bbox=dict(boxstyle="round,pad=0.3", fc="#d1fae5", ec=COLOR_PRIMARY, lw=1)
    )

    ax.set_xticks(x)
    ax.set_xticklabels(weeks, fontsize=9)
    ax.set_ylabel("Total System Bottling Capacity (%)", fontsize=9.5, weight='bold')
    ax.set_ylim(0, 125)
    ax.set_title("Plant Capacity Utilization & Co-Packer Arbitrage (+10% Surge Activation)", fontsize=11.5, weight='bold', pad=12)
    ax.legend(loc='lower right', frameon=True, facecolor=COLOR_SOFT_BG, edgecolor=COLOR_GRID, fontsize=8.5)

    return _fig_to_png_bytes(fig)


def generate_supply_copacker_share(db=None) -> bytes:
    """Donut chart: Production allocation across plants and co-packers."""
    labels = ['Nashik Main Plant', 'Pune Co-Packer Alpha', 'Bengaluru Co-Packer Beta', 'Cold Puree Reserve']
    sizes = [68, 16, 11, 5]
    colors = [COLOR_SLATE, COLOR_PRIMARY, COLOR_BLUE, COLOR_AMBER]

    fig, ax = plt.subplots(figsize=(7, 5))
    wedges, texts, autotexts = ax.pie(
        sizes, labels=labels, autopct='%1.0f%%', startangle=140,
        colors=colors, textprops=dict(color=COLOR_SLATE, weight='bold', fontsize=9),
        wedgeprops=dict(width=0.4, edgecolor='white', linewidth=2)
    )

    for at in autotexts:
        at.set_color('white')
        at.set_fontsize(9.5)

    ax.text(0, 0, "1.8M btls/mo\nCapacity", ha='center', va='center', fontsize=10.5, weight='bold', color=COLOR_SLATE)
    ax.set_title("Production Allocation & Contract Bottler Volume Share", fontsize=11.5, weight='bold', pad=14)

    return _fig_to_png_bytes(fig)


def generate_supply_lead_times(db=None) -> bytes:
    """Raw Material Lead Times (days) vs Buffer Threshold."""
    materials = [
        'Tamper-Evident Caps',
        'Basil Herb Extract',
        'Glass Bottles (250ml)',
        'Alphonso Mango Puree',
        'Passionfruit Puree (NE Highway)'
    ]
    lead_times = [12, 10, 14, 7, 21]
    safe_buffer = [15, 15, 15, 15, 15]

    y = np.arange(len(materials))

    fig, ax = plt.subplots(figsize=(9, 4.8))

    bar_colors = [COLOR_PRIMARY if lt <= 14 else COLOR_CORAL for lt in lead_times]
    bars = ax.barh(y, lead_times, height=0.45, color=bar_colors, edgecolor='#000000', linewidth=0.5)

    ax.axvline(15, color=COLOR_CORAL, linestyle='--', linewidth=1.5, label='Safety Stock Lead-Time Ceiling (15 Days)')

    for b in bars:
        w = b.get_width()
        ax.text(w + 0.4, b.get_y() + b.get_height()/2, f"{w} days", va='center', fontsize=9, weight='bold', color=COLOR_SLATE)

    # Highlight passionfruit vulnerability
    ax.annotate(
        "May Landslide Risk!\nRequires 35-42d Puree Cover",
        xy=(21, 4), xytext=(15.5, 3.2),
        arrowprops=dict(facecolor=COLOR_CORAL, shrink=0.08, width=1.2, headwidth=5),
        fontsize=8.5, weight='bold', color=COLOR_CORAL,
        bbox=dict(boxstyle="round,pad=0.3", fc="#fee2e2", ec=COLOR_CORAL, lw=1)
    )

    ax.set_yticks(y)
    ax.set_yticklabels(materials, fontsize=9, weight='bold', color=COLOR_SLATE)
    ax.set_xlabel("Replenishment Lead Time (Days)", fontsize=9.5, weight='bold')
    ax.set_xlim(0, 26)
    ax.set_title("Upstream Puree & Packaging Lead Times (Postponement Vulnerability)", fontsize=11.5, weight='bold', pad=12)
    ax.legend(loc='lower right', frameon=True, facecolor=COLOR_SOFT_BG, edgecolor=COLOR_GRID, fontsize=8.5)

    return _fig_to_png_bytes(fig)


def generate_supply_risk_matrix(db=None) -> bytes:
    """Supplier Risk Matrix Scatter: Reliability % vs Lead Time days."""
    suppliers = [
        {'name': 'NE Passionfruit Co-op', 'rel': 76, 'lt': 21, 'spend': 14.2, 'risk': 'high'},
        {'name': 'Ratnagiri Mango Trust', 'rel': 94, 'lt': 7,  'spend': 18.5, 'risk': 'low'},
        {'name': 'Hindustan Glass Ltd',   'rel': 91, 'lt': 14, 'spend': 9.8,  'risk': 'med'},
        {'name': 'Deccan Herbals',        'rel': 88, 'lt': 10, 'spend': 4.1,  'risk': 'low'},
        {'name': 'Apex Closures India',   'rel': 96, 'lt': 8,  'spend': 3.5,  'risk': 'low'},
        {'name': 'Pune Cold Stores',      'rel': 92, 'lt': 5,  'spend': 6.2,  'risk': 'low'},
    ]

    fig, ax = plt.subplots(figsize=(9, 5))

    # Quadrant shading
    ax.axvspan(70, 85, color='#fee2e2', alpha=0.35)
    ax.axhspan(15, 25, color='#fee2e2', alpha=0.35)

    for s in suppliers:
        color = COLOR_CORAL if s['risk'] == 'high' else COLOR_PRIMARY if s['risk'] == 'low' else COLOR_AMBER
        size = s['spend'] * 35
        ax.scatter(s['rel'], s['lt'], s=size, color=color, alpha=0.8, edgecolors=COLOR_SLATE, linewidth=1.2)
        ax.text(s['rel'] + 0.6, s['lt'] + 0.3, f"{s['name']}\n(₹{s['spend']} Cr)", fontsize=8, weight='bold', color=COLOR_SLATE)

    ax.axvline(85, color=COLOR_MUTED, linestyle=':', linewidth=1)
    ax.axhline(15, color=COLOR_MUTED, linestyle=':', linewidth=1)

    ax.text(72, 23, "CRITICAL BOTTLENECK\n(Single-Source Risk)", fontsize=9, weight='bold', color=COLOR_CORAL)
    ax.text(90, 6, "PREFERRED PARTNERS\n(High Reliability)", fontsize=9, weight='bold', color=COLOR_PRIMARY)

    ax.set_xlabel("Supplier Delivery Reliability Rate (%)", fontsize=9.5, weight='bold')
    ax.set_ylabel("Average Lead Time (Days)", fontsize=9.5, weight='bold')
    ax.set_xlim(70, 100)
    ax.set_ylim(4, 25)
    ax.set_title("Vendor Risk Matrix (Bubble Size = Annual Procurement Spend)", fontsize=11.5, weight='bold', pad=12)

    return _fig_to_png_bytes(fig)


def generate_supply_dual_axis(db=None) -> bytes:
    """Supplier Dual-Axis Performance: Lead Time (bar) vs Defect Rate (line)."""
    vendors = ['NE Co-op', 'Ratnagiri', 'Hindustan', 'Deccan', 'Apex', 'Pune Cold']
    lead_times = [21, 7, 14, 10, 8, 5]
    defect_rates = [4.8, 1.2, 1.9, 2.4, 0.8, 0.5]

    x = np.arange(len(vendors))

    fig, ax1 = plt.subplots(figsize=(9, 4.8))
    ax2 = ax1.twinx()

    b = ax1.bar(x, lead_times, width=0.45, color=COLOR_SLATE, label='Replenishment Lead Time (Days)', alpha=0.85)
    l = ax2.plot(x, defect_rates, color=COLOR_CORAL, linewidth=2.5, marker='s', markersize=6, label='Defect / Inspection Breach Rate (%)')

    ax1.set_ylabel("Lead Time (Days)", fontsize=9.5, weight='bold', color=COLOR_SLATE)
    ax2.set_ylabel("Defect / Rejection Rate (%)", fontsize=9.5, weight='bold', color=COLOR_CORAL)
    ax2.set_ylim(0, 6)
    ax1.set_xticks(x)
    ax1.set_xticklabels(vendors, fontsize=9, weight='bold')

    ax1.set_title("Vendor Performance Dual-Axis: Lead Times & Quality Defect Rates", fontsize=11.5, weight='bold', pad=12)

    # Combined legend
    lines, labels = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines + lines2, labels + labels2, loc='upper right', frameon=True, facecolor=COLOR_SOFT_BG, edgecolor=COLOR_GRID, fontsize=8.5)

    return _fig_to_png_bytes(fig)


# ══════════════════════════════════════════════════════════════════════════════
# 4. INVENTORY & FRESHNESS DECAY GRAPHS
# ══════════════════════════════════════════════════════════════════════════════

def generate_inventory_depot_stock(db=None) -> bytes:
    """Depot Inventory Stock vs Oldest Batch Age across all 9 regional depots."""
    depots = ['Delhi (N)', 'Bengaluru (S)', 'Mumbai (W)', 'Kolkata (E)', 'Nagpur (C)', 'Chennai', 'Hyderabad', 'Pune', 'Ahmedabad']
    stock = [48000, 22000, 52000, 31000, 38000, 26000, 29000, 41000, 34000]
    oldest_age = [14, 19, 12, 16, 11, 18, 15, 13, 14]

    x = np.arange(len(depots))

    fig, ax1 = plt.subplots(figsize=(10, 5.2))
    ax2 = ax1.twinx()

    bar_colors = [COLOR_CORAL if s < 25000 else COLOR_PRIMARY for s in stock]
    ax1.bar(x, stock, width=0.5, color=bar_colors, alpha=0.85, label='Finished Stock (Bottles)')

    ax2.plot(x, oldest_age, color=COLOR_SLATE, linewidth=2.5, marker='o', markersize=5, label='Oldest Batch Age (Days)')
    ax2.axhline(18, color=COLOR_CORAL, linestyle='--', linewidth=1.5, label='D18 Freshness Trigger (Rebalance Required)')

    ax1.set_ylabel("Depot Stock (Bottles)", fontsize=9.5, weight='bold', color=COLOR_PRIMARY)
    ax2.set_ylabel("Oldest Batch Age (Days)", fontsize=9.5, weight='bold', color=COLOR_SLATE)
    ax2.set_ylim(5, 25)
    ax1.set_xticks(x)
    ax1.set_xticklabels(depots, rotation=25, ha='right', fontsize=8.5, weight='bold')

    ax1.set_title("9-Depot Network Inventory Balance & Batch Freshness Age", fontsize=11.5, weight='bold', pad=12)

    return _fig_to_png_bytes(fig)


def generate_inventory_shelf_life(db=None) -> bytes:
    """Shelf-Life decay cascade over 8 weeks (Fresh, D18 Warning, D25 Critical, Expired)."""
    weeks = [f"Wk{i+1}" for i in range(8)]
    x = np.arange(len(weeks))

    # Without agent intervention, older stock builds up
    fresh = np.array([210, 190, 160, 130, 140, 155, 180, 200])
    warning = np.array([45, 60, 85, 95, 75, 55, 40, 35])
    critical = np.array([12, 22, 42, 68, 52, 30, 18, 10])
    expired = np.array([2, 5, 18, 38, 25, 12, 4, 1])

    fig, ax = plt.subplots(figsize=(10, 5))

    ax.stackplot(
        x, fresh, warning, critical, expired,
        labels=['Fresh (<15d cover)', 'D18 Warning Zone (15–25d)', 'Critical Distress Risk (25–30d)', 'Breached D30 Cliff (Write-off)'],
        colors=['#10b981', '#f59e0b', '#ef4444', '#7f1d1d'],
        alpha=0.85
    )

    ax.annotate(
        "Peak Summer Write-off Spike (₹6.0 Cr)\nAverted by Proactive D18 Rebalancing",
        xy=(3, 310), xytext=(3.5, 335),
        arrowprops=dict(facecolor=COLOR_CORAL, shrink=0.08, width=1.5, headwidth=6),
        fontsize=8.5, weight='bold', color=COLOR_CORAL,
        bbox=dict(boxstyle="round,pad=0.3", fc="#fee2e2", ec=COLOR_CORAL, lw=1)
    )

    ax.set_xticks(x)
    ax.set_xticklabels(weeks, fontsize=9)
    ax.set_ylabel("Total Inventory in Circulation (Thousand Bottles)", fontsize=9.5, weight='bold')
    ax.set_title("Shelf-Life Decay Cascade: Commercial Freshness Degradation", fontsize=11.5, weight='bold', pad=12)
    ax.legend(loc='upper right', frameon=True, facecolor=COLOR_SOFT_BG, edgecolor=COLOR_GRID, fontsize=8.5)

    return _fig_to_png_bytes(fig)


def generate_inventory_pareto(db=None) -> bytes:
    """Batch Risk Pareto Analysis (Top at-risk batches vs Cumulative exposure %)."""
    batches = [f"B-{101+i}" for i in range(10)]
    risk_amount = [1.85, 1.42, 0.95, 0.62, 0.44, 0.31, 0.22, 0.15, 0.11, 0.08]  # ₹ Lakhs
    cum_pct = np.cumsum(risk_amount) / np.sum(risk_amount) * 100

    x = np.arange(len(batches))

    fig, ax1 = plt.subplots(figsize=(10, 5))
    ax2 = ax1.twinx()

    ax1.bar(x, risk_amount, width=0.5, color=COLOR_CORAL, alpha=0.85, label='Potential Loss per Batch (₹ Lakhs)')
    ax2.plot(x, cum_pct, color=COLOR_SLATE, linewidth=2.5, marker='o', markersize=5, label='Cumulative Loss Exposure (%)')

    ax2.axhline(80, color=COLOR_PRIMARY, linestyle='--', linewidth=1.5, label='80% Pareto Threshold')

    ax1.set_ylabel("Write-off Financial Risk (₹ Lakhs)", fontsize=9.5, weight='bold', color=COLOR_CORAL)
    ax2.set_ylabel("Cumulative Exposure (%)", fontsize=9.5, weight='bold', color=COLOR_SLATE)
    ax2.set_ylim(0, 110)
    ax1.set_xticks(x)
    ax1.set_xticklabels(batches, fontsize=9, weight='bold')

    ax1.set_title("Batch Freshness Risk Pareto: Top Expiry Vulnerabilities", fontsize=11.5, weight='bold', pad=12)

    lines, labels = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines + lines2, labels + labels2, loc='center right', frameon=True, facecolor=COLOR_SOFT_BG, edgecolor=COLOR_GRID, fontsize=8.5)

    return _fig_to_png_bytes(fig)


# ══════════════════════════════════════════════════════════════════════════════
# 5. MULTI-CHANNEL DISTRIBUTION GRAPHS
# ══════════════════════════════════════════════════════════════════════════════

def generate_distribution_network(db=None) -> bytes:
    """Inter-Depot Transfer Flow Network Map (North, South, East, West, Central)."""
    fig, ax = plt.subplots(figsize=(9, 5.5))

    nodes = {
        'North (Delhi)': {'x': 0.5, 'y': 0.85, 'stock': '48k btls', 'status': 'SURPLUS', 'color': '#dbeafe', 'edge': COLOR_BLUE},
        'South (Bengaluru)': {'x': 0.5, 'y': 0.15, 'stock': '22k btls', 'status': 'DEFICIT [ALERT]', 'color': '#fee2e2', 'edge': COLOR_CORAL},
        'West (Mumbai)': {'x': 0.18, 'y': 0.5, 'stock': '52k btls', 'status': 'SURPLUS', 'color': '#dbeafe', 'edge': COLOR_BLUE},
        'East (Kolkata)': {'x': 0.82, 'y': 0.5, 'stock': '31k btls', 'status': 'BALANCED', 'color': '#d1fae5', 'edge': COLOR_PRIMARY},
        'Central (Nagpur Hub)': {'x': 0.5, 'y': 0.5, 'stock': '38k btls', 'status': 'ROUTER', 'color': '#f1f5f9', 'edge': COLOR_SLATE},
    }

    # Draw nodes
    for name, n in nodes.items():
        circle = plt.Circle((n['x'], n['y']), 0.1, color=n['color'], ec=n['edge'], lw=2, zorder=3)
        ax.add_patch(circle)
        ax.text(n['x'], n['y'] + 0.02, name.split(' ')[0], ha='center', va='center', fontsize=9.5, weight='bold', color=COLOR_SLATE)
        ax.text(n['x'], n['y'] - 0.03, n['stock'], ha='center', va='center', fontsize=8, color=COLOR_MUTED)
        ax.text(n['x'], n['y'] - 0.06, n['status'], ha='center', va='center', fontsize=7.5, weight='bold', color=n['edge'])

    # Flow arrows toward South Deficit Depot
    arrows = [
        ('North (Delhi)', 'Central (Nagpur Hub)', '12,000 btls', COLOR_PRIMARY),
        ('Central (Nagpur Hub)', 'South (Bengaluru)', '20,000 btls', COLOR_PRIMARY),
        ('West (Mumbai)', 'South (Bengaluru)', '8,000 btls', COLOR_BLUE),
        ('East (Kolkata)', 'Central (Nagpur Hub)', '5,000 btls', COLOR_PRIMARY),
    ]

    for src, dst, label, c in arrows:
        x1, y1 = nodes[src]['x'], nodes[src]['y']
        x2, y2 = nodes[dst]['x'], nodes[dst]['y']
        dx, dy = (x2 - x1) * 0.72, (y2 - y1) * 0.72
        ax.arrow(x1, y1, dx, dy, head_width=0.025, head_length=0.03, fc=c, ec=c, length_includes_head=True, lw=1.8, zorder=2)
        mid_x, mid_y = (x1 + x2) / 2 + 0.03, (y1 + y2) / 2
        ax.text(mid_x, mid_y, label, fontsize=8, weight='bold', color=c, bbox=dict(boxstyle="round,pad=0.2", fc="white", ec=c, lw=0.8))

    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')
    ax.set_title("Inter-Depot Rebalancing Network: Proactive Flow to South Deficit", fontsize=11.5, weight='bold', pad=12)

    return _fig_to_png_bytes(fig)


def generate_distribution_fill_rate(db=None) -> bytes:
    """Multi-channel fill rate trend across 8 weeks (QC, MT, GT) vs 95% Target."""
    weeks = [f"Wk{i+1}" for i in range(8)]
    x = np.arange(len(weeks))

    qc_fill = [96, 91, 71, 74, 86, 93, 95, 96]
    mt_fill = [97, 95, 89, 88, 92, 95, 96, 97]
    gt_fill = [95, 94, 91, 90, 93, 94, 95, 95]

    fig, ax = plt.subplots(figsize=(10, 5))
    w = 0.25

    ax.bar(x - w, qc_fill, width=w, color=COLOR_BLUE, label='Quick Commerce Fill %')
    ax.bar(x, mt_fill, width=w, color=COLOR_PRIMARY, label='Modern Trade Fill %')
    ax.bar(x + w, gt_fill, width=w, color=COLOR_AMBER, label='General Trade Fill %')

    ax.axhline(95, color=COLOR_PRIMARY, linestyle='--', linewidth=1.5, label='95% SLA Fulfillment Target')

    # Viral spike window
    ax.axvspan(1.5, 3.5, color=COLOR_CORAL, alpha=0.15)
    ax.text(2.5, 63, "Viral Surge Crisis\n(QC drops to 71%)", ha='center', fontsize=8.5, weight='bold', color=COLOR_CORAL)

    ax.set_xticks(x)
    ax.set_xticklabels(weeks, fontsize=9)
    ax.set_ylabel("Order Fill Rate (%)", fontsize=9.5, weight='bold')
    ax.set_ylim(60, 102)
    ax.set_title("Multi-Channel Order Fulfillment SLA Trajectory", fontsize=11.5, weight='bold', pad=12)
    ax.legend(loc='lower right', frameon=True, facecolor=COLOR_SOFT_BG, edgecolor=COLOR_GRID, fontsize=8.5)

    return _fig_to_png_bytes(fig)


def generate_distribution_gap_bubble(db=None) -> bytes:
    """Regional Demand vs Stock Cover bubble scatter plot."""
    regions = [
        {'name': 'South (Bengaluru)', 'demand': 62000, 'cover': 5.5,  'risk': 850, 'color': COLOR_CORAL},
        {'name': 'North (Delhi)',     'demand': 48000, 'cover': 16.5, 'risk': 250, 'color': COLOR_BLUE},
        {'name': 'West (Mumbai)',     'demand': 54000, 'cover': 14.0, 'risk': 300, 'color': COLOR_PRIMARY},
        {'name': 'East (Kolkata)',    'demand': 32000, 'cover': 13.5, 'risk': 280, 'color': COLOR_PRIMARY},
        {'name': 'Central (Nagpur)',  'demand': 28000, 'cover': 15.0, 'risk': 200, 'color': COLOR_PRIMARY},
        {'name': 'Chennai',           'demand': 36000, 'cover': 7.2,  'risk': 650, 'color': COLOR_AMBER},
    ]

    fig, ax = plt.subplots(figsize=(9, 5))

    # Shaded risk zones
    ax.axhspan(4, 8, color='#fee2e2', alpha=0.35)
    ax.text(22000, 4.5, "CRITICAL STOCKOUT ZONE (<8 Days Cover)", fontsize=8.5, weight='bold', color=COLOR_CORAL)

    for r in regions:
        ax.scatter(r['demand'], r['cover'], s=r['risk'], color=r['color'], alpha=0.75, edgecolors=COLOR_SLATE, linewidth=1.2)
        ax.text(r['demand'] + 1000, r['cover'] + 0.3, f"{r['name']}\n({r['cover']}d cover)", fontsize=8.5, weight='bold', color=COLOR_SLATE)

    ax.axhline(8, color=COLOR_CORAL, linestyle='--', linewidth=1.5, label='Minimum Safe Stock Buffer (8 Days)')

    ax.set_xlabel("Regional Weekly Demand (Bottles)", fontsize=9.5, weight='bold')
    ax.set_ylabel("Current Stock Cover (Days)", fontsize=9.5, weight='bold')
    ax.set_xlim(20000, 68000)
    ax.set_ylim(4, 20)
    ax.set_title("Regional Supply-Demand Gap & Stockout Vulnerability Matrix", fontsize=11.5, weight='bold', pad=12)
    ax.legend(loc='upper right', frameon=True, facecolor=COLOR_SOFT_BG, edgecolor=COLOR_GRID, fontsize=8.5)

    return _fig_to_png_bytes(fig)


# ══════════════════════════════════════════════════════════════════════════════
# 6. TRANSPORTATION & COLD CHAIN TELEMETRY
# ══════════════════════════════════════════════════════════════════════════════

def generate_transportation_temp_telemetry(db=None) -> bytes:
    """48-Hour Cold Chain IoT Reefer Temperature Curve (MH-12-Q-4082)."""
    hours = np.arange(0, 49)
    np.random.seed(88)

    # Base cold temperature ~ 4.0 C with excursion at hour 24-29
    temp = 4.0 + np.sin(hours * 0.3) * 0.6 + np.random.normal(0, 0.25, len(hours))
    temp[24:30] += np.array([2.5, 4.8, 5.2, 4.1, 2.2, 0.8])  # Compressor excursion

    fig, ax = plt.subplots(figsize=(10, 5))

    # Safe operating band
    ax.axhspan(2.0, 6.0, color='#d1fae5', alpha=0.45, label='Safe Transit Window (2.0°C – 6.0°C)')

    ax.plot(hours, temp, color=COLOR_BLUE, linewidth=2.2, label='Reefer Sensor Log')

    ax.axhline(4.0, color=COLOR_PRIMARY, linestyle='--', linewidth=1.5, label='Setpoint Target (4.0°C)')
    ax.axhline(8.0, color=COLOR_CORAL, linestyle='--', linewidth=1.8, label='Critical Excursion Limit (8.0°C)')

    # Excursion markers
    breaches = [i for i, t in enumerate(temp) if t >= 8.0]
    if breaches:
        ax.scatter([hours[i] for i in breaches], [temp[i] for i in breaches], color=COLOR_CORAL, s=80, zorder=5, label='Thermal Breach Incident')

    ax.annotate(
        "Compressor Glitch Detected (Hour 26)\nAuto-Reroute to Pune Cold Hub",
        xy=(26, temp[26]), xytext=(29, 9.2),
        arrowprops=dict(facecolor=COLOR_CORAL, shrink=0.08, width=1.5, headwidth=6),
        fontsize=8.5, weight='bold', color=COLOR_CORAL,
        bbox=dict(boxstyle="round,pad=0.3", fc="#fee2e2", ec=COLOR_CORAL, lw=1)
    )

    ax.set_xlabel("Transit Elapsed Time (Hours 0 – 48)", fontsize=9.5, weight='bold')
    ax.set_ylabel("Cargo Chamber Temperature (°C)", fontsize=9.5, weight='bold')
    ax.set_ylim(0, 11)
    ax.set_title("IoT Cold-Chain Telemetry: Route MH-12 (Pune → Bengaluru Corridor)", fontsize=11.5, weight='bold', pad=12)
    ax.legend(loc='lower left', frameon=True, facecolor=COLOR_SOFT_BG, edgecolor=COLOR_GRID, fontsize=8)

    return _fig_to_png_bytes(fig)


def generate_transportation_freight_cost(db=None) -> bytes:
    """Logistics Cost Trade-Off: Air Emergency vs Reefer Road Freight."""
    corridors = ['NE → Nashik (Puree)', 'Nashik → Delhi', 'Pune → Bengaluru', 'Nashik → Kolkata']
    road_cost = [1.50, 1.20, 1.40, 1.60]      # ₹/bottle
    air_cost = [7.50, 6.20, 7.10, 8.00]       # ₹/bottle (5x premium)

    x = np.arange(len(corridors))
    w = 0.35

    fig, ax = plt.subplots(figsize=(9, 4.8))

    b1 = ax.bar(x - w/2, road_cost, width=w, color=COLOR_PRIMARY, label='Standard Reefer Road (₹1.50/btl)')
    b2 = ax.bar(x + w/2, air_cost, width=w, color=COLOR_CORAL, label='Emergency Air Freight (₹7.50/btl, 5x Penalty)')

    for b in b1:
        ax.text(b.get_x() + b.get_width()/2, b.get_height() + 0.15, f"₹{b.get_height():.2f}", ha='center', fontsize=8.5, weight='bold', color=COLOR_PRIMARY)
    for b in b2:
        ax.text(b.get_x() + b.get_width()/2, b.get_height() + 0.15, f"₹{b.get_height():.2f}", ha='center', fontsize=8.5, weight='bold', color=COLOR_CORAL)

    # Highlight avoidance
    ax.annotate(
        "₹2.56 Cr Air Premium Averted\nby 42-day Puree Buffer",
        xy=(0 + w/2, 7.5), xytext=(0.6, 8.4),
        arrowprops=dict(facecolor=COLOR_PRIMARY, shrink=0.08, width=1.5, headwidth=6),
        fontsize=8.5, weight='bold', color=COLOR_PRIMARY,
        bbox=dict(boxstyle="round,pad=0.3", fc="#d1fae5", ec=COLOR_PRIMARY, lw=1)
    )

    ax.set_xticks(x)
    ax.set_xticklabels(corridors, fontsize=9, weight='bold')
    ax.set_ylabel("Logistics Cost per Unit (₹/Bottle)", fontsize=9.5, weight='bold')
    ax.set_ylim(0, 10)
    ax.set_title("Corridor Freight Cost Arbitrage: Upstream Road vs. Emergency Air", fontsize=11.5, weight='bold', pad=12)
    ax.legend(loc='upper right', frameon=True, facecolor=COLOR_SOFT_BG, edgecolor=COLOR_GRID, fontsize=8.5)

    return _fig_to_png_bytes(fig)


def generate_transportation_transit_sla(db=None) -> bytes:
    """Bullet chart: Actual Transit Hours vs Target SLA vs Critical Window."""
    corridors = [
        'Bengaluru → Chennai',
        'Nashik → Mumbai',
        'Pune → Hyderabad',
        'Nashik → Kolkata',
        'Nashik → Delhi',
        'Pune → Bengaluru'
    ]
    target_sla = [12, 10, 24, 48, 36, 28]
    actual_hrs = [11, 9, 23, 56, 38, 31]
    critical_max = [18, 16, 32, 60, 48, 36]

    y = np.arange(len(corridors))

    fig, ax = plt.subplots(figsize=(9, 5))

    # Background critical limit
    ax.barh(y, critical_max, height=0.55, color='#fee2e2', label='Critical Freshness Limit (Max Window)')
    # Target SLA
    ax.barh(y, target_sla, height=0.4, color='#cbd5e1', label='Agreed SLA Target')
    # Actual performance marker
    for i, act in enumerate(actual_hrs):
        color = COLOR_CORAL if act > target_sla[i] else COLOR_PRIMARY
        ax.plot([act, act], [i - 0.28, i + 0.28], color=color, linewidth=4, zorder=4)

    ax.plot([], [], color=COLOR_CORAL, linewidth=3, label='Actual Transit Hours (Breach if Red)')

    ax.set_yticks(y)
    ax.set_yticklabels(corridors, fontsize=9, weight='bold', color=COLOR_SLATE)
    ax.set_xlabel("Transit Duration (Hours)", fontsize=9.5, weight='bold')
    ax.set_title("Logistics Corridor SLA Adherence (Reefer Transit Velocity)", fontsize=11.5, weight='bold', pad=12)
    ax.legend(loc='lower right', frameon=True, facecolor=COLOR_SOFT_BG, edgecolor=COLOR_GRID, fontsize=8.5)

    return _fig_to_png_bytes(fig)


# ══════════════════════════════════════════════════════════════════════════════
# 7. MONTE CARLO & SCENARIO REPLAY GRAPHS
# ══════════════════════════════════════════════════════════════════════════════

def generate_monte_carlo_distribution(flavor_id: int = 1, db=None) -> bytes:
    """1,000-Iteration Monte Carlo Fan Chart and Outcome Histogram."""
    np.random.seed(42)
    n_sims = 1000
    n_days = 14
    days = np.arange(1, n_days + 1)

    # Simulate 1000 paths
    daily_vol = np.zeros((n_sims, n_days))
    base = 1500
    for s in range(n_sims):
        drift = np.random.normal(1.02, 0.04)
        vol = base
        for d in range(n_days):
            vol *= drift * (1.0 + np.random.normal(0, 0.08))
            daily_vol[s, d] = vol

    p10 = np.percentile(daily_vol, 10, axis=0)
    p25 = np.percentile(daily_vol, 25, axis=0)
    p50 = np.percentile(daily_vol, 50, axis=0)
    p75 = np.percentile(daily_vol, 75, axis=0)
    p90 = np.percentile(daily_vol, 90, axis=0)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(11, 4.8), gridspec_kw={'width_ratios': [1.8, 1]})

    # Subplot 1: Fan Chart
    ax1.plot(days, p50, color=COLOR_PRIMARY, linewidth=2.5, label='Median Simulation (P50)')
    ax1.fill_between(days, p25, p75, color=COLOR_PRIMARY, alpha=0.3, label='Interquartile Range (P25–P75)')
    ax1.fill_between(days, p10, p90, color=COLOR_PRIMARY, alpha=0.15, label='Tail Envelope (P10–P90)')

    ax1.set_xlabel("Simulation Horizon (Days T+1 to T+14)", fontsize=9, weight='bold')
    ax1.set_ylabel("Projected Daily Demand (Bottles)", fontsize=9, weight='bold')
    ax1.set_title("14-Day Monte Carlo Trajectory Ensembles (1,000 Runs)", fontsize=10.5, weight='bold')
    ax1.legend(loc='upper left', frameon=True, facecolor=COLOR_SOFT_BG, edgecolor=COLOR_GRID, fontsize=8)

    # Subplot 2: Terminal Day Distribution Histogram
    terminal = daily_vol[:, -1]
    ax2.hist(terminal, bins=25, color=COLOR_BLUE, alpha=0.75, edgecolor='white')
    var_95 = np.percentile(terminal, 95)
    ax2.axvline(var_95, color=COLOR_CORAL, linestyle='--', linewidth=1.8, label=f'95% VaR: {var_95:.0f} btls')
    ax2.axvline(np.median(terminal), color=COLOR_SLATE, linestyle=':', linewidth=1.5, label=f'Median: {np.median(terminal):.0f}')

    ax2.set_xlabel("Day 14 Final Demand (Bottles)", fontsize=9, weight='bold')
    ax2.set_ylabel("Frequency", fontsize=9, weight='bold')
    ax2.set_title("Terminal Demand Risk Density", fontsize=10.5, weight='bold')
    ax2.legend(loc='upper right', frameon=True, facecolor=COLOR_SOFT_BG, edgecolor=COLOR_GRID, fontsize=7.5)

    fig.suptitle("Monte Carlo Stress Simulation & Value-at-Risk Calibration", fontsize=12, weight='bold', color=COLOR_SLATE, y=1.02)

    return _fig_to_png_bytes(fig)


def generate_scenario_replay(db=None) -> bytes:
    """Summer Crisis Progression: Actual Unmitigated Crisis vs Agent-Orchestrated Protection."""
    weeks = [f"Wk{i+1}" for i in range(16)]
    x = np.arange(len(weeks))

    # Loss trajectories over the 16-week summer crisis
    # Crisis sequence: Wk2-6 Viral Spike (₹14.75 Cr), Wk8-11 Highway closure (₹2.56 Cr), Wk12-16 Write-offs (₹6.0 Cr)
    loss_unmitigated = [0.2, 0.8, 3.5, 8.2, 12.4, 14.8, 15.2, 16.5, 17.8, 18.2, 19.5, 20.8, 22.1, 23.0, 23.3, 23.31]
    loss_agent = [0.1, 0.2, 0.4, 0.7, 1.1, 1.4, 1.6, 1.8, 2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.55, 2.56]

    fig, ax = plt.subplots(figsize=(10, 5.2))

    ax.plot(x, loss_unmitigated, color=COLOR_CORAL, linewidth=2.8, marker='o', markersize=4, label='Last Summer Actuals (Unmitigated ₹23.31 Cr Loss)')
    ax.plot(x, loss_agent, color=COLOR_PRIMARY, linewidth=2.8, marker='s', markersize=4, label='Autonomous Agent Orchestration (₹2.56 Cr Loss)')

    # Shaded savings envelope
    ax.fill_between(x, loss_agent, loss_unmitigated, color=COLOR_PRIMARY, alpha=0.18)

    ax.annotate(
        "₹20.75 Cr Profit Saved (9.2x ROI)\n• ₹14.75 Cr Quick Commerce Sales\n• ₹6.00 Cr Expiry Write-Offs Avoided\n• ₹2.56 Cr Highway Air Freight Cut",
        xy=(15, 23.31), xytext=(7.5, 15.5),
        arrowprops=dict(facecolor=COLOR_PRIMARY, shrink=0.08, width=1.8, headwidth=7),
        fontsize=9, weight='bold', color=COLOR_PRIMARY,
        bbox=dict(boxstyle="round,pad=0.4", fc="#d1fae5", ec=COLOR_PRIMARY, lw=1.2)
    )

    ax.set_xticks(x[::2])
    ax.set_xticklabels(weeks[::2], fontsize=9)
    ax.set_ylabel("Cumulative P&L Loss Exposure (₹ Crore)", fontsize=9.5, weight='bold')
    ax.set_ylim(0, 26)
    ax.set_title("Summer Season Cumulative Value Erosion: Baseline Crisis vs. Agent Protection", fontsize=11.5, weight='bold', pad=12)
    ax.legend(loc='upper left', frameon=True, facecolor=COLOR_SOFT_BG, edgecolor=COLOR_GRID, fontsize=8.5)

    return _fig_to_png_bytes(fig)


# ══════════════════════════════════════════════════════════════════════════════
# MASTER REGISTRY & BULK EXPORT
# ══════════════════════════════════════════════════════════════════════════════

GRAPH_REGISTRY: Dict[str, Dict[str, Any]] = {
    # Executive
    "dashboard_resilience_radar": {
        "id": "dashboard_resilience_radar",
        "title": "Operational Resilience Scorecard (Radar)",
        "category": "Executive Overview",
        "description": "Baseline vs Model Protected across 6 core operational dimensions.",
        "fn": generate_dashboard_resilience_radar
    },
    "dashboard_waterfall": {
        "id": "dashboard_waterfall",
        "title": "Summer Revenue & Profit Impact Waterfall",
        "category": "Executive Overview",
        "description": "P&L bridge from ₹576 Cr Summer Base through losses to protected revenue.",
        "fn": generate_dashboard_waterfall
    },
    "dashboard_kpi_trend": {
        "id": "dashboard_kpi_trend",
        "title": "Historical KPI 30-Day Trend Telemetry",
        "category": "Executive Overview",
        "description": "Continuous 30-day KPI historical values with breach and target thresholds.",
        "fn": generate_dashboard_kpi_trend
    },
    "dashboard_risk_heatmap": {
        "id": "dashboard_risk_heatmap",
        "title": "Multi-Depot Operational Risk Heatmap",
        "category": "Executive Overview",
        "description": "5-Week daily anomaly event density across network nodes.",
        "fn": generate_dashboard_risk_heatmap
    },

    # Demand
    "demand_forecast_fan": {
        "id": "demand_forecast_fan",
        "title": "SARIMAX Forecast Fan Chart",
        "category": "Demand Sensing",
        "description": "Historical actual orders with P10/P50/P90 confidence envelope.",
        "fn": generate_demand_forecast_fan
    },
    "demand_channel_series": {
        "id": "demand_channel_series",
        "title": "Multi-Channel Demand Velocity Series",
        "category": "Demand Sensing",
        "description": "Quick Commerce, Modern Trade, and General Trade order trends.",
        "fn": generate_demand_channel_series
    },
    "demand_viral_propagation": {
        "id": "demand_viral_propagation",
        "title": "Viral Spike Propagation Timeline",
        "category": "Demand Sensing",
        "description": "Day 1-28 surge detection, propagation, and autonomous co-packer response.",
        "fn": generate_demand_viral_propagation
    },
    "demand_flavor_share": {
        "id": "demand_flavor_share",
        "title": "Flavor Market Share Momentum",
        "category": "Demand Sensing",
        "description": "Planned pre-season share vs actual summer shift (+13% Dragon Passion).",
        "fn": generate_demand_flavor_share
    },
    "demand_decomposition": {
        "id": "demand_decomposition",
        "title": "Demand Decomposition Breakdown",
        "category": "Demand Sensing",
        "description": "Attribution to base, summer seasonality, temperature, social, and campaigns.",
        "fn": generate_demand_decomposition
    },

    # Supply
    "supply_copacker_utilization": {
        "id": "supply_copacker_utilization",
        "title": "Bottling Output & Co-Packer Surge Utilization",
        "category": "Supply Operations",
        "description": "Nashik plant utilization hitting 95% triggering 14-day advance co-packer capacity.",
        "fn": generate_supply_copacker_utilization
    },
    "supply_copacker_share": {
        "id": "supply_copacker_share",
        "title": "Production Bottling Allocation Share",
        "category": "Supply Operations",
        "description": "Donut distribution of volume across plant, co-packers, and cold puree buffer.",
        "fn": generate_supply_copacker_share
    },
    "supply_lead_times": {
        "id": "supply_lead_times",
        "title": "Raw Material Lead Times & Buffer Threshold",
        "category": "Supply Operations",
        "description": "Postponement lead times: Puree vs bottles vs caps against safety stock.",
        "fn": generate_supply_lead_times
    },
    "supply_risk_matrix": {
        "id": "supply_risk_matrix",
        "title": "Vendor Risk Matrix & Spend Bubble Analysis",
        "category": "Supply Operations",
        "description": "Reliability vs Lead Time matrix identifying single-source co-op bottleneck.",
        "fn": generate_supply_risk_matrix
    },
    "supply_dual_axis": {
        "id": "supply_dual_axis",
        "title": "Vendor Performance Dual-Axis",
        "category": "Supply Operations",
        "description": "Replenishment lead time vs batch quality rejection rates.",
        "fn": generate_supply_dual_axis
    },

    # Inventory
    "inventory_depot_stock": {
        "id": "inventory_depot_stock",
        "title": "9-Depot Inventory Stock & Batch Freshness Age",
        "category": "Inventory Management",
        "description": "Finished stock volume vs oldest batch age in days with D18 trigger line.",
        "fn": generate_inventory_depot_stock
    },
    "inventory_shelf_life": {
        "id": "inventory_shelf_life",
        "title": "Shelf-Life Decay Cascade (Aging Inventory Curves)",
        "category": "Inventory Management",
        "description": "Fresh stock vs D18 Warning vs Critical write-off risk over summer weeks.",
        "fn": generate_inventory_shelf_life
    },
    "inventory_pareto": {
        "id": "inventory_pareto",
        "title": "Batch Risk Pareto Analysis (ABC Concentration)",
        "category": "Inventory Management",
        "description": "Loss exposure by batch and cumulative 80/20 risk concentration.",
        "fn": generate_inventory_pareto
    },

    # Distribution
    "distribution_network": {
        "id": "distribution_network",
        "title": "Inter-Depot Rebalancing Network Map",
        "category": "Distribution & Logistics",
        "description": "Proactive 25,000 bottle transfer routing to patch the South depot deficit.",
        "fn": generate_distribution_network
    },
    "distribution_fill_rate": {
        "id": "distribution_fill_rate",
        "title": "Multi-Channel Order Fill Rate Trend",
        "category": "Distribution & Logistics",
        "description": "QC vs MT vs GT SLA fulfillment trajectory throughout viral surge.",
        "fn": generate_distribution_fill_rate
    },
    "distribution_gap_bubble": {
        "id": "distribution_gap_bubble",
        "title": "Regional Demand vs Stock Cover Gap Analysis",
        "category": "Distribution & Logistics",
        "description": "Bubble chart identifying depots below the 8-day critical cover line.",
        "fn": generate_distribution_gap_bubble
    },

    # Transportation
    "transportation_temp_telemetry": {
        "id": "transportation_temp_telemetry",
        "title": "IoT Cold-Chain Thermal Sensor Telemetry",
        "category": "Transportation & Fleet",
        "description": "48-Hour continuous sensor temperature logs with 8°C excursion breach alert.",
        "fn": generate_transportation_temp_telemetry
    },
    "transportation_freight_cost": {
        "id": "transportation_freight_cost",
        "title": "Freight Cost Arbitrage: Road vs Air",
        "category": "Transportation & Fleet",
        "description": "Reefer road (₹1.50/btl) vs emergency air freight (₹7.50/btl) trade-off.",
        "fn": generate_transportation_freight_cost
    },
    "transportation_transit_sla": {
        "id": "transportation_transit_sla",
        "title": "Corridor Transit SLA Bullet Chart",
        "category": "Transportation & Fleet",
        "description": "Actual transit hours vs target SLA vs critical window across 6 corridors.",
        "fn": generate_transportation_transit_sla
    },

    # Simulation & Evidence
    "monte_carlo_distribution": {
        "id": "monte_carlo_distribution",
        "title": "Monte Carlo Stress Test & VaR Distribution",
        "category": "Stress Testing & Evidence",
        "description": "1,000-run simulation fan trajectory and terminal risk density histogram.",
        "fn": generate_monte_carlo_distribution
    },
    "scenario_replay_comparison": {
        "id": "scenario_replay_comparison",
        "title": "Summer Crisis P&L Bridge: Actual vs Protected",
        "category": "Stress Testing & Evidence",
        "description": "Cumulative loss comparison demonstrating ₹20.75 Cr profit protection (9.2x ROI).",
        "fn": generate_scenario_replay
    },
}


def generate_all_graphs(export_dir: Optional[str] = None, db=None) -> List[Dict[str, Any]]:
    """
    Executes matplotlib generation for all 25 registered graphs.
    Saves PNG files to export_dir if specified, and returns catalog metadata.
    """
    if export_dir:
        os.makedirs(export_dir, exist_ok=True)

    results = []
    for graph_id, meta in GRAPH_REGISTRY.items():
        try:
            fn = meta["fn"]
            png_bytes = fn(db=db)
            file_path = None
            if export_dir:
                filename = f"{graph_id}.png"
                target_path = os.path.join(export_dir, filename)
                with open(target_path, "wb") as f:
                    f.write(png_bytes)
                file_path = f"/graphs/{filename}"

            results.append({
                "id": graph_id,
                "title": meta["title"],
                "category": meta["category"],
                "description": meta["description"],
                "file_path": file_path,
                "endpoint": f"/api/graphs/{graph_id}.png",
                "size_bytes": len(png_bytes),
                "generated_at": datetime.utcnow().isoformat() + "Z",
                "status": "success"
            })
        except Exception as e:
            print(f"Error generating graph {graph_id}: {e}")
            results.append({
                "id": graph_id,
                "title": meta["title"],
                "category": meta["category"],
                "description": meta["description"],
                "file_path": None,
                "endpoint": f"/api/graphs/{graph_id}.png",
                "size_bytes": 0,
                "generated_at": datetime.utcnow().isoformat() + "Z",
                "status": "error",
                "error": str(e)
            })

    return results
