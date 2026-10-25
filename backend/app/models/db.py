import os
from datetime import datetime, date
from typing import List, Optional
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Float,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    JSON,
    Text,
    text,
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, Session

Base = declarative_base()

class Flavor(Base):
    __tablename__ = "flavors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    summer_share_pct = Column(Float, nullable=False)
    realized_price = Column(Float, default=60.0)
    variable_cost = Column(Float, default=40.80)
    cm_per_bottle = Column(Float, default=19.20)

    batches = relationship("Batch", back_populates="flavor")
    production_runs = relationship("ProductionRun", back_populates="flavor")
    channel_sales = relationship("ChannelSale", back_populates="flavor")


class Depot(Base):
    __tablename__ = "depots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    region = Column(String(50), nullable=False)

    batches = relationship("Batch", back_populates="depot")
    transfers_out = relationship("Transfer", foreign_keys="Transfer.from_depot_id", back_populates="from_depot")
    transfers_in = relationship("Transfer", foreign_keys="Transfer.to_depot_id", back_populates="to_depot")


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    ingredient = Column(String(100), nullable=False)
    lead_time_days = Column(Integer, nullable=False)
    single_source = Column(Boolean, default=False)
    risk_adjusted_cost_per_kg = Column(Float, default=0.0)


class PulpInventory(Base):
    __tablename__ = "pulp_inventory"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ingredient = Column(String(100), nullable=False, unique=True)
    cover_days = Column(Float, nullable=False)
    last_updated = Column(DateTime, default=datetime.utcnow)


class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    flavor_id = Column(Integer, ForeignKey("flavors.id"), nullable=False)
    depot_id = Column(Integer, ForeignKey("depots.id"), nullable=False)
    bottled_date = Column(Date, nullable=False)
    quantity = Column(Integer, nullable=False)
    age_days = Column(Integer, default=0)
    status = Column(String(50), default="fresh")  # fresh, at_risk, rejected, sold, written_off

    flavor = relationship("Flavor", back_populates="batches")
    depot = relationship("Depot", back_populates="batches")
    transfers = relationship("Transfer", back_populates="batch")


class ProductionRun(Base):
    __tablename__ = "production_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    flavor_id = Column(Integer, ForeignKey("flavors.id"), nullable=False)
    date = Column(Date, nullable=False)
    bottles_produced = Column(Integer, nullable=False)
    plant_utilization_pct = Column(Float, nullable=False)
    source = Column(String(50), default="in_house")  # in_house, co_packer

    flavor = relationship("Flavor", back_populates="production_runs")


class ChannelSale(Base):
    __tablename__ = "channel_sales"

    id = Column(Integer, primary_key=True, autoincrement=True)
    flavor_id = Column(Integer, ForeignKey("flavors.id"), nullable=False)
    channel = Column(String(50), nullable=False)  # GT, MT, QC
    date = Column(Date, nullable=False)
    units_sold = Column(Integer, nullable=False)
    forecast_units = Column(Integer, nullable=False)

    flavor = relationship("Flavor", back_populates="channel_sales")


class DepotDistributionDemand(Base):
    __tablename__ = "depot_distribution_demand"

    id = Column(Integer, primary_key=True, autoincrement=True)
    depot_id = Column(Integer, ForeignKey("depots.id"), nullable=False)
    flavor_id = Column(Integer, ForeignKey("flavors.id"), nullable=False)
    segment = Column(String(50), nullable=False)  # Quick Commerce, Modern Trade, General Trade
    distributor_name = Column(String(150), nullable=False)
    date = Column(Date, nullable=False)
    units_demanded = Column(Integer, nullable=False)
    units_sold = Column(Integer, nullable=False)
    forecast_units = Column(Integer, nullable=False)
    stockout_units = Column(Integer, default=0)

    depot = relationship("Depot")
    flavor = relationship("Flavor")


class Transfer(Base):
    __tablename__ = "transfers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)
    flavor_id = Column(Integer, ForeignKey("flavors.id"), nullable=True)
    from_depot_id = Column(Integer, ForeignKey("depots.id"), nullable=False)
    to_depot_id = Column(Integer, ForeignKey("depots.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    cost_per_bottle = Column(Float, default=1.50)
    status = Column(String(50), default="recommended")  # recommended, approved, in_transit, completed
    alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=True)
    net_benefit = Column(Float, nullable=True)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="transfers")
    flavor = relationship("Flavor")
    from_depot = relationship("Depot", foreign_keys=[from_depot_id], back_populates="transfers_out")
    to_depot = relationship("Depot", foreign_keys=[to_depot_id], back_populates="transfers_in")


class FreightEvent(Base):
    __tablename__ = "freight_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String(50), nullable=False)  # road, air
    cost = Column(Float, nullable=False)
    volume_bottles = Column(Integer, nullable=False)
    triggered_by_kpi = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ScanEvent(Base):
    __tablename__ = "scan_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    parcel_code = Column(String(100), nullable=False)
    from_node_type = Column(String(50), nullable=False)  # factory, depot, distributor
    from_node_id = Column(Integer, nullable=False)
    to_node_type = Column(String(50), nullable=False)    # depot, distributor, retailer
    to_node_id = Column(Integer, nullable=False)
    flavor_id = Column(Integer, ForeignKey("flavors.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)
    quantity = Column(Integer, nullable=False)
    scanned_at = Column(DateTime, default=datetime.utcnow)

    flavor = relationship("Flavor")
    batch = relationship("Batch")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    kpi_code = Column(String(50), nullable=False)
    severity = Column(String(50), nullable=False)  # info, warning, critical
    message = Column(Text, nullable=False)
    confidence_pct = Column(Float, default=85.0)
    linked_entity_type = Column(String(50), nullable=False)  # flavor, depot, batch, supplier
    linked_entity_id = Column(Integer, nullable=True)
    status = Column(String(50), default="open")  # open, approved, rejected, overridden, resolved
    triggered_at = Column(DateTime, default=datetime.utcnow)

    approvals = relationship("Approval", back_populates="alert", cascade="all, delete-orphan")
    overrides = relationship("Override", back_populates="alert", cascade="all, delete-orphan")


class Override(Base):
    __tablename__ = "overrides"

    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=False)
    user = Column(String(100), default="planner_1")
    reason_code = Column(String(100), nullable=False)  # data_wrong, already_handled, context_missing, other
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    alert = relationship("Alert", back_populates="overrides")


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=False)
    tier = Column(String(50), nullable=False)  # planner, supply_lead, coo
    status = Column(String(50), default="pending")  # pending, approved, rejected
    sla_hours = Column(Integer, default=24)
    sla_deadline = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    decided_at = Column(DateTime, nullable=True)
    decided_by = Column(String(100), nullable=True)
    note = Column(Text, nullable=True)

    alert = relationship("Alert", back_populates="approvals")


class KpiThreshold(Base):
    __tablename__ = "kpi_thresholds"

    id = Column(Integer, primary_key=True, autoincrement=True)
    kpi_code = Column(String(50), unique=True, nullable=False)
    name = Column(String(150), nullable=False)
    category = Column(String(50), nullable=False)  # financial, demand, supply, inventory, distribution, transportation, system, governance
    baseline = Column(Text, nullable=False)
    target = Column(Text, nullable=False)
    trigger_condition = Column(Text, nullable=False)
    comparison_operator = Column(String(10), nullable=False)  # >, <, >=, <=, ==, !=
    trigger_value = Column(Float, nullable=False)
    approval_tier = Column(String(50), nullable=False)  # planner, supply_lead, coo, ops
    linkage = Column(JSON, default=list)
    caption_template = Column(Text, nullable=True)


class ScenarioRun(Base):
    __tablename__ = "scenario_runs"

    id = Column(String(100), primary_key=True)
    run_date = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), default="completed")
    summary = Column(JSON, default=dict)
    day_by_day = Column(JSON, default=list)


# SQLite Database Initialization
DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "..", "..", "pulp_riot.db"))
DATABASE_URL = f"sqlite:///{os.path.abspath(DB_PATH)}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)
    # Ensure added columns exist in SQLite transfers table
    with engine.connect() as conn:
        for col_name, col_type in [
            ("flavor_id", "INTEGER"),
            ("alert_id", "INTEGER"),
            ("net_benefit", "FLOAT"),
            ("reason", "TEXT"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE transfers ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
