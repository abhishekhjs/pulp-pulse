import os
import json
from datetime import datetime, date, timedelta
import random
import math
from sqlalchemy.orm import Session
from backend.app.models.db import (
    Flavor,
    Depot,
    Supplier,
    PulpInventory,
    Batch,
    ProductionRun,
    ChannelSale,
    Transfer,
    FreightEvent,
    ScanEvent,
    Alert,
    Approval,
    Override,
    KpiThreshold,
    DepotDistributionDemand,
    init_db,
    SessionLocal,
)

def seed_data(db: Session, reset: bool = False):
    if reset:
        # Clear existing data in reverse order of dependencies
        db.query(Override).delete()
        db.query(Approval).delete()
        db.query(Alert).delete()
        db.query(Transfer).delete()
        db.query(ScanEvent).delete()
        db.query(DepotDistributionDemand).delete()
        db.query(Batch).delete()
        db.query(ChannelSale).delete()
        db.query(ProductionRun).delete()
        db.query(FreightEvent).delete()
        db.query(PulpInventory).delete()
        db.query(Supplier).delete()
        db.query(Depot).delete()
        db.query(Flavor).delete()
        db.query(KpiThreshold).delete()
        db.commit()

    # 1. Seed KPI Thresholds from JSON config
    if db.query(KpiThreshold).count() == 0:
        json_path = os.path.join(os.path.dirname(__file__), "..", "kpi_config", "kpi_thresholds.json")
        with open(json_path, "r", encoding="utf-8") as f:
            thresholds_data = json.load(f)
        for t in thresholds_data:
            kpi_obj = KpiThreshold(
                kpi_code=t["kpi_code"],
                name=t["name"],
                category=t["category"],
                baseline=t["baseline"],
                target=t["target"],
                trigger_condition=t["trigger_condition"],
                comparison_operator=t["comparison_operator"],
                trigger_value=float(t["trigger_value"]),
                approval_tier=t["approval_tier"],
                linkage=t.get("linkage", []),
                caption_template=t.get("caption_template", ""),
            )
            db.add(kpi_obj)
        db.commit()

    # 2. Seed Flavors (calibrated to case facts: 5 flavors, 9.6 Cr summer bottles -> scaled 1:10,000 -> 9,600 bottles)
    flavors_config = [
        {"name": "Mango Peach Basil", "summer_share_pct": 0.38, "realized_price": 60.0, "variable_cost": 40.80, "cm_per_bottle": 19.20},
        {"name": "Guava Chilli", "summer_share_pct": 0.20, "realized_price": 60.0, "variable_cost": 40.80, "cm_per_bottle": 19.20},
        {"name": "Passionfruit Punch", "summer_share_pct": 0.16, "realized_price": 60.0, "variable_cost": 40.80, "cm_per_bottle": 19.20},
        {"name": "Dragonfruit Bloom", "summer_share_pct": 0.14, "realized_price": 60.0, "variable_cost": 40.80, "cm_per_bottle": 19.20},
        {"name": "Dragon Passion", "summer_share_pct": 0.12, "realized_price": 60.0, "variable_cost": 40.80, "cm_per_bottle": 19.20},
    ]
    flavor_map = {}
    for fc in flavors_config:
        f = db.query(Flavor).filter(Flavor.name == fc["name"]).first()
        if not f:
            f = Flavor(**fc)
            db.add(f)
            db.commit()
            db.refresh(f)
        flavor_map[f.name] = f

    # 3. Seed Depots (9 depots across 4 regions)
    depots_config = [
        {"name": "Depot N1 (Delhi NCR)", "region": "North"},
        {"name": "Depot N2 (Chandigarh)", "region": "North"},
        {"name": "Depot W1 (Mumbai)", "region": "West"},
        {"name": "Depot W2 (Pune)", "region": "West"},
        {"name": "Depot W3 (Ahmedabad)", "region": "West"},
        {"name": "Depot S1 (Bengaluru)", "region": "South"},
        {"name": "Depot S2 (Chennai)", "region": "South"},
        {"name": "Depot S3 (Hyderabad)", "region": "South"},
        {"name": "Depot E1 (Kolkata)", "region": "East"},
    ]
    depot_map = {}
    for dc in depots_config:
        d = db.query(Depot).filter(Depot.name == dc["name"]).first()
        if not d:
            d = Depot(**dc)
            db.add(d)
            db.commit()
            db.refresh(d)
        depot_map[d.name] = d

    # 4. Seed Suppliers (including single-source hill cooperative)
    suppliers_config = [
        {"name": "Himalayan Orchards Cooperative", "ingredient": "Passionfruit Pulp", "lead_time_days": 14, "single_source": True, "risk_adjusted_cost_per_kg": 240.0},
        {"name": "Mekong Delta Fruit Exporters", "ingredient": "Dragonfruit Pulp", "lead_time_days": 45, "single_source": False, "risk_adjusted_cost_per_kg": 165.0},
        {"name": "Deccan Agro Processing Ltd", "ingredient": "Mango Pulp", "lead_time_days": 7, "single_source": False, "risk_adjusted_cost_per_kg": 85.0},
        {"name": "Konkan Pure Purees", "ingredient": "Guava Pulp", "lead_time_days": 5, "single_source": False, "risk_adjusted_cost_per_kg": 70.0},
        {"name": "Sahyadri Bio-Organics (Backup)", "ingredient": "Passionfruit Pulp (Secondary)", "lead_time_days": 6, "single_source": False, "risk_adjusted_cost_per_kg": 145.0},
    ]
    for sc in suppliers_config:
        if not db.query(Supplier).filter(Supplier.name == sc["name"]).first():
            db.add(Supplier(**sc))
    db.commit()

    # 5. Seed Starting Pulp Inventory
    pulp_config = [
        {"ingredient": "Mango Pulp", "cover_days": 45.0},
        {"ingredient": "Guava Pulp", "cover_days": 38.0},
        {"ingredient": "Passionfruit Pulp", "cover_days": 5.5},  # Critical emergency: 5.5 days vs 14 days lead time!
        {"ingredient": "Dragonfruit Pulp", "cover_days": 11.5}, # Tight buffer single-source import
    ]
    for pc in pulp_config:
        p = db.query(PulpInventory).filter(PulpInventory.ingredient == pc["ingredient"]).first()
        if not p:
            db.add(PulpInventory(ingredient=pc["ingredient"], cover_days=pc["cover_days"], last_updated=datetime.utcnow()))
        else:
            p.cover_days = pc["cover_days"]
    db.commit()

    # 6. Seed Batches & Scan Events (scaled for 96,000-bottle network inventory)
    if db.query(Batch).count() == 0:
        base_today = date(2027, 4, 15)  # Mid-April baseline
        batch_counter = 100

        for depot_name, depot in depot_map.items():
            for flavor_name, flavor in flavor_map.items():
                for b_idx in range(2):
                    batch_counter += 1
                    # Extreme freshness variations across depots
                    if flavor_name == "Mango Peach Basil" and depot.name == "Depot E1 (Kolkata)" and b_idx == 0:
                        age_days = 19  # Age >= 18 triggers D2
                    elif flavor_name == "Guava Chilli" and depot.name == "Depot N2 (Chandigarh)" and b_idx == 0:
                        age_days = 21  # Age >= 18 triggers D2
                    elif flavor_name == "Passionfruit Punch" and depot.name == "Depot E1 (Kolkata)" and b_idx == 1:
                        age_days = 32  # Age >= 30 triggers D3 (Commercial Freshness Rejection Cliff)
                    elif flavor_name == "Dragon Passion":
                        # Ultra-fast turnover for viral SKU
                        age_days = random.randint(2, 6)
                    elif depot.region == "West":
                        # High turnover near production plants
                        age_days = random.randint(3, 8)
                    else:
                        age_days = random.randint(7, 16)

                    bottled_date = base_today - timedelta(days=age_days)
                    # Scaled batch quantities: 120 to 950 bottles per batch (~25,000 bottles network-wide)
                    base_qty = int(flavor.summer_share_pct * 1600)
                    qty = max(50, base_qty + random.randint(-40, 80))

                    # Calibrate realistic demand surge depletion vs stagnant overstock
                    if flavor_name == "Dragon Passion" and depot.name in ["Depot N1 (Delhi NCR)", "Depot S1 (Bengaluru)"]:
                        # Viral surge depleted stock down to ~3 days cover
                        qty = 45 if b_idx == 0 else 55
                    elif flavor_name == "Dragon Passion" and depot.name == "Depot W2 (Pune)":
                        # Stagnant excess inventory building up in Pune
                        qty = 240 if b_idx == 0 else 220
                        age_days = 19 if b_idx == 0 else 16
                        bottled_date = base_today - timedelta(days=age_days)
                    elif flavor_name == "Guava Chilli" and depot.name == "Depot N2 (Chandigarh)":
                        qty = 210 if b_idx == 0 else 190
                        age_days = 20 if b_idx == 0 else 17
                        bottled_date = base_today - timedelta(days=age_days)
                    elif flavor_name == "Mango Peach Basil" and depot.name == "Depot E1 (Kolkata)":
                        qty = 260 if b_idx == 0 else 240
                        age_days = 21 if b_idx == 0 else 18
                        bottled_date = base_today - timedelta(days=age_days)

                    status = "at_risk" if age_days >= 18 else "fresh"

                    batch = Batch(
                        id=batch_counter,
                        flavor_id=flavor.id,
                        depot_id=depot.id,
                        bottled_date=bottled_date,
                        quantity=qty,
                        age_days=age_days,
                        status=status,
                    )
                    db.add(batch)

                    # Ingest corresponding Factory -> Depot scan event (section 16.4.3)
                    db.add(ScanEvent(
                        parcel_code=f"PR-{depot.region[:2]}-FLV{flavor.id}-B{batch_counter}",
                        from_node_type="factory",
                        from_node_id=1,
                        to_node_type="depot",
                        to_node_id=depot.id,
                        flavor_id=flavor.id,
                        batch_id=batch_counter,
                        quantity=qty,
                        scanned_at=datetime.combine(bottled_date, datetime.min.time()),
                    ))
        db.commit()

    # 7. Seed Production Runs (historical past 45 days: ~36,000 bottles with extreme operational swings)
    if db.query(ProductionRun).count() == 0:
        sim_start = date(2027, 3, 1)
        for day_offset in range(45):
            curr_date = sim_start + timedelta(days=day_offset)
            
            # Extreme operational swings:
            # - March 20-24: Passionfruit pulp shortage causes bottling line throttle
            # - March 28 - April 6: Heatwave surge triggers 98% in-house utilization + co-packer burst
            is_pulp_shortage = date(2027, 3, 20) <= curr_date <= date(2027, 3, 24)
            is_heatwave_surge = date(2027, 3, 28) <= curr_date <= date(2027, 4, 6)

            for flavor_name, flavor in flavor_map.items():
                base_bottles = int(800.0 * flavor.summer_share_pct)

                if is_pulp_shortage and flavor_name in ["Passionfruit Punch", "Dragon Passion"]:
                    # Bottleneck throttles passionfruit production
                    bottles = int(base_bottles * 0.42)
                    util = 0.45
                    source = "in_house"
                elif is_heatwave_surge:
                    # Overtime burst & co-packer activation
                    bottles = int(base_bottles * 1.55)
                    util = 0.98 if flavor_name == "Mango Peach Basil" else 1.18
                    source = "co_packer" if flavor.id % 2 == 0 else "in_house"
                else:
                    noise = random.uniform(-0.10, 0.10)
                    bottles = max(10, int(base_bottles * (1.0 + noise)))
                    util = 0.92 + (noise * 0.3)
                    source = "in_house"

                db.add(ProductionRun(
                    flavor_id=flavor.id,
                    date=curr_date,
                    bottles_produced=bottles,
                    plant_utilization_pct=round(util, 2),
                    source=source,
                ))
        db.commit()

    # 8. Seed Channel Sales: EXACTLY 96,000 bottles with extreme multi-channel variations
    # 121 days: Dec 16, 2026 to Apr 15, 2027
    # Channels: GT (55%), MT (25%), QC (20%)
    if db.query(ChannelSale).count() == 0:
        sim_start = date(2026, 12, 16)
        total_days = 121
        spike_start = date(2027, 3, 15)
        heatwave_start = date(2027, 3, 26)
        heatwave_end = date(2027, 4, 8)
        storm_date = date(2027, 4, 9)

        # Exact target per flavor summing to 96,000 bottles
        target_allocation = {
            "Mango Peach Basil": 36480,
            "Guava Chilli": 19200,
            "Passionfruit Punch": 15360,
            "Dragonfruit Bloom": 13440,
            "Dragon Passion": 11520,
        }

        channels = [("GT", 0.55), ("MT", 0.25), ("QC", 0.20)]
        random.seed(42)

        raw_sales = {fn: {ch[0]: [] for ch in channels} for fn in target_allocation}
        raw_forecasts = {fn: {ch[0]: [] for ch in channels} for fn in target_allocation}

        for day_idx in range(total_days):
            curr_date = sim_start + timedelta(days=day_idx)
            day_of_week = curr_date.weekday()
            is_weekend = day_of_week in (4, 5, 6)
            is_heatwave = heatwave_start <= curr_date <= heatwave_end
            is_storm = (curr_date == storm_date) or (curr_date == storm_date + timedelta(days=1))
            temp_mult = 1.35 if is_heatwave else (0.65 if is_storm else 1.0)

            for flv_name, target in target_allocation.items():
                base = target / total_days
                for ch, ch_share in channels:
                    ch_base = base * ch_share
                    wknd_fcst = 1.15 if is_weekend else 0.92
                    fcst = ch_base * wknd_fcst
                    actual = ch_base

                    if ch == "QC":
                        # Quick Commerce: violent weekend swings (Fri-Sun 1.65x, Mon-Tue 0.70x)
                        qc_wknd = 1.65 if is_weekend else 0.70
                        actual = actual * qc_wknd * temp_mult

                        if flv_name == "Dragon Passion" and curr_date >= spike_start:
                            days_into_spike = (curr_date - spike_start).days
                            if days_into_spike <= 3:
                                spike_mult = 1.8 + days_into_spike * 0.8
                            elif days_into_spike <= 11:
                                # Viral explosion: +400% to +850%
                                spike_mult = 4.2 + math.sin(days_into_spike) * 2.0 + (1.8 if is_weekend else 0.0)
                            elif days_into_spike <= 15:
                                # Dark store stockout crash! Shelves ran dry
                                spike_mult = 0.20 + random.random() * 0.15
                            else:
                                # Co-packer replenishment recovery oscillations
                                spike_mult = 2.6 + (1.2 if is_weekend else -0.4) + random.uniform(-0.3, 0.3)
                            
                            actual = ch_base * spike_mult
                            fcst = ch_base * (1.1 if days_into_spike < 14 else 1.8)
                        elif flv_name in ["Mango Peach Basil", "Guava Chilli"] and curr_date >= spike_start:
                            actual = actual * 0.80

                    elif ch == "MT":
                        # Modern Trade: lumpy supermarket bulk replenishment (Wed/Thu surges 2.15x)
                        mt_lump = 2.15 if day_of_week in (2, 3) else 0.62
                        actual = actual * mt_lump * temp_mult * (1.0 + random.uniform(-0.15, 0.15))
                        fcst = ch_base * (1.15 if is_weekend else 0.95)

                    elif ch == "GT":
                        # General Trade: wholesale Monday/Tuesday distribution peaks
                        gt_cycle = 1.30 if day_of_week in (0, 1) else 0.88
                        noise = random.uniform(-0.06, 0.06)
                        actual = actual * gt_cycle * temp_mult * (1.0 + noise)
                        fcst = actual * (1.0 + random.uniform(-0.08, 0.08))

                    raw_sales[flv_name][ch].append(max(1.0, actual))
                    raw_forecasts[flv_name][ch].append(max(1.0, fcst))

        # Scale to EXACTLY 96,000 bottles
        for flv_name, target in target_allocation.items():
            flv_obj = flavor_map[flv_name]
            total_raw = sum(sum(raw_sales[flv_name][ch]) for ch, _ in channels)
            scale_factor = target / total_raw

            scaled_act = {}
            scaled_fcs = {}
            for ch, _ in channels:
                scaled_act[ch] = [max(1, int(round(val * scale_factor))) for val in raw_sales[flv_name][ch]]
                scaled_fcs[ch] = [max(1, int(round(val * scale_factor))) for val in raw_forecasts[flv_name][ch]]

            # Adjust difference on final day to hit exact targeted integer count
            diff = target - sum(sum(scaled_act[ch]) for ch, _ in channels)
            scaled_act["GT"][-1] += diff

            for day_idx in range(total_days):
                curr_date = sim_start + timedelta(days=day_idx)
                for ch, _ in channels:
                    db.add(ChannelSale(
                        flavor_id=flv_obj.id,
                        channel=ch,
                        date=curr_date,
                        units_sold=scaled_act[ch][day_idx],
                        forecast_units=scaled_fcs[ch][day_idx],
                    ))
        db.commit()

    # 9. Seed Freight Events (Road freight baseline + emergency air freight charters)
    if db.query(FreightEvent).count() == 0:
        sim_start = date(2027, 3, 1)
        # Regular road freight runs (scaled to 8,000 - 14,000 bottles)
        for wk in range(6):
            db.add(FreightEvent(
                type="road",
                cost=42000.0 + random.randint(-4000, 8000),
                volume_bottles=10500 + random.randint(-1500, 2500),
                triggered_by_kpi=None,
                created_at=datetime.combine(sim_start + timedelta(weeks=wk), datetime.min.time()),
            ))
        # Emergency Air freight charters during viral peak & passionfruit road disruption
        db.add(FreightEvent(
            type="air",
            cost=280000.0,
            volume_bottles=3200,
            triggered_by_kpi="C3",
            created_at=datetime.combine(date(2027, 3, 22), datetime.min.time()),
        ))
        db.add(FreightEvent(
            type="air",
            cost=340000.0,
            volume_bottles=4500,
            triggered_by_kpi="B3",
            created_at=datetime.combine(date(2027, 3, 27), datetime.min.time()),
        ))
        db.commit()

    # 10. Seed Depot-Level Distribution Demand across Downstream Segments and Distributors
    if db.query(DepotDistributionDemand).count() == 0:
        depot_distributor_map = {
            "Depot N1 (Delhi NCR)": {
                "Quick Commerce": "Blinkit/Zepto NCR Central DarkStore Cluster",
                "Modern Trade": "NCR Retail Hub (DMart & Spencer's)",
                "General Trade": "Old Delhi FMCG Distributors Association",
            },
            "Depot N2 (Chandigarh)": {
                "Quick Commerce": "Tricity QuickLogix DarkStore Hub",
                "Modern Trade": "Chandigarh Modern Retailers",
                "General Trade": "Punjab FMCG Wholesale Network",
            },
            "Depot W1 (Mumbai)": {
                "Quick Commerce": "Zepto/Instamart Mumbai Prime Grid",
                "Modern Trade": "Nature's Basket & Reliance Supermarkets Mumbai",
                "General Trade": "South Bombay Wholesale Merchants",
            },
            "Depot W2 (Pune)": {
                "Quick Commerce": "Pune DarkStore FastTrack Network",
                "Modern Trade": "Pune Superstores Alliance",
                "General Trade": "Deccan Distributors Network",
            },
            "Depot W3 (Ahmedabad)": {
                "Quick Commerce": "Ahmedabad QuickDeliver Hub",
                "Modern Trade": "Gujarat Retail Consortium",
                "General Trade": "Ahmedabad FMCG Wholesalers",
            },
            "Depot S1 (Bengaluru)": {
                "Quick Commerce": "Bengaluru Hyperlocal DarkStores (Koramangala/Indiranagar)",
                "Modern Trade": "Bengaluru Gourmet & Supermarket Chains",
                "General Trade": "Karnataka FMCG Distributors",
            },
            "Depot S2 (Chennai)": {
                "Quick Commerce": "Chennai QuickCart Hub",
                "Modern Trade": "Chennai Supermart Chains",
                "General Trade": "Tamil Nadu Wholesale Merchants",
            },
            "Depot S3 (Hyderabad)": {
                "Quick Commerce": "HITEC City DarkStores Network",
                "Modern Trade": "Hyderabad Retail Superstores",
                "General Trade": "Telangana FMCG Distribution Network",
            },
            "Depot E1 (Kolkata)": {
                "Quick Commerce": "Kolkata Metro DarkStores",
                "Modern Trade": "Eastern Retail Supermarkets",
                "General Trade": "Burrabazar Wholesale Distributors",
            },
        }

        segment_shares = [
            ("Quick Commerce", 0.40),
            ("Modern Trade", 0.35),
            ("General Trade", 0.25),
        ]

        # 60 days of historical distribution demand: Feb 15, 2027 to Apr 15, 2027
        hist_start = date(2027, 2, 15)
        n_days = 60
        spike_start = date(2027, 3, 15)

        depot_list = db.query(Depot).all()
        flavor_list = db.query(Flavor).all()

        demand_records = []
        for day_idx in range(n_days):
            curr_date = hist_start + timedelta(days=day_idx)
            is_wknd = curr_date.weekday() in (4, 5, 6)

            for d in depot_list:
                dist_info = depot_distributor_map.get(d.name, {
                    "Quick Commerce": f"{d.name} QC Hub",
                    "Modern Trade": f"{d.name} MT Hub",
                    "General Trade": f"{d.name} GT Hub",
                })

                for fl in flavor_list:
                    # Base daily volume calibrated to ~80-120 bottles per depot per flavor
                    base_volume = max(6.0, (950.0 * fl.summer_share_pct) / 9.0)

                    # Regional factors
                    is_n1_delhi = "Delhi" in d.name
                    is_s1_blr = "Bengaluru" in d.name
                    is_w2_pune = "Pune" in d.name
                    is_e1_kolkata = "Kolkata" in d.name

                    for seg_name, seg_share in segment_shares:
                        dist_name = dist_info.get(seg_name, f"{d.name} {seg_name}")
                        seg_base = base_volume * seg_share

                        # Segment multiplier
                        if seg_name == "Quick Commerce":
                            mult = 1.65 if is_wknd else 0.75
                        elif seg_name == "Modern Trade":
                            mult = 1.50 if curr_date.weekday() in (2, 3) else 0.80
                        else:
                            mult = 1.0

                        # Viral Surge for Dragon Passion in Delhi NCR and Bengaluru
                        if fl.name == "Dragon Passion" and (is_n1_delhi or is_s1_blr) and curr_date >= spike_start:
                            days_in = (curr_date - spike_start).days
                            surge_mult = 2.4 + min(3.5, days_in * 0.18)
                            if seg_name == "Quick Commerce":
                                mult *= surge_mult
                            else:
                                mult *= (1.0 + (surge_mult - 1.0) * 0.4)

                        # Stagnant movement in Pune or Kolkata for certain flavors
                        if is_w2_pune and fl.name == "Dragon Passion":
                            # In Pune, Dragon Passion is not moving as quickly, building excess inventory
                            mult *= 0.65
                        elif is_e1_kolkata and fl.name in ["Dragonfruit Bloom", "Guava Chilli"]:
                            mult *= 0.55

                        units_dem = max(1, int(seg_base * mult + random.uniform(-1.5, 1.5)))
                        fcst_units = max(1, int(seg_base * (1.15 if is_wknd else 0.92)))

                        # If heavy surge, simulate stockouts where demanded > fulfilled
                        if fl.name == "Dragon Passion" and (is_n1_delhi or is_s1_blr) and curr_date >= date(2027, 3, 25):
                            stockout = max(0, int(units_dem * 0.35))
                            units_sold = units_dem - stockout
                        else:
                            stockout = 0
                            units_sold = units_dem

                        demand_records.append(DepotDistributionDemand(
                            depot_id=d.id,
                            flavor_id=fl.id,
                            segment=seg_name,
                            distributor_name=dist_name,
                            date=curr_date,
                            units_demanded=units_dem,
                            units_sold=units_sold,
                            forecast_units=fcst_units,
                            stockout_units=stockout,
                        ))

        db.bulk_save_objects(demand_records)
        db.commit()

    print("Synthetic database seeded successfully with exactly 96,000 bottles and extreme variation!")

if __name__ == "__main__":
    init_db()
    with SessionLocal() as session:
        seed_data(session, reset=True)
