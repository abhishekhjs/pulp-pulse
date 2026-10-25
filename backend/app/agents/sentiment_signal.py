from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.app.models.db import Flavor, Alert, ChannelSale

class SentimentSignalProvider(ABC):
    """
    Abstract contract for sentiment and market momentum signals.
    Enables future drop-in of real NLP/social sentiment APIs without
    modifying downstream consumption in E3 allocation weighting.
    """
    @abstractmethod
    def compute_momentum_score(self, flavor_id: int, db: Session) -> float:
        pass

class DerivedMomentumProvider(SentimentSignalProvider):
    """
    V1 provider deriving momentum score purely from internal velocity telemetry:
    combines B3 QC velocity deviation with G2 MT reorder capture.
    """
    def compute_momentum_score(self, flavor_id: int, db: Session) -> float:
        # 1. B3 QC Velocity Deviation
        b3_alert = (
            db.query(Alert)
            .filter(
                Alert.kpi_code == "B3",
                Alert.linked_entity_type == "flavor",
                Alert.linked_entity_id == flavor_id,
                Alert.status == "open",
            )
            .first()
        )

        qc_momentum = 0.0
        if b3_alert:
            # Positive QC spike translates to strong momentum signal [0.4 to 0.8]
            qc_momentum = 0.65

        # 2. G2 MT Reorder signal (check MT channel recent sales ratio)
        mt_sales = (
            db.query(ChannelSale)
            .filter(ChannelSale.flavor_id == flavor_id, ChannelSale.channel == "MT")
            .order_by(ChannelSale.date.desc())
            .limit(7)
            .all()
        )
        mt_momentum = 0.0
        if mt_sales and len(mt_sales) >= 4:
            recent_avg = sum(s.units_sold for s in mt_sales[:3]) / 3.0
            prior_avg = sum(s.units_sold for s in mt_sales[3:]) / float(len(mt_sales[3:]))
            if prior_avg > 0:
                mt_growth = (recent_avg - prior_avg) / prior_avg
                mt_momentum = max(-0.3, min(0.35, mt_growth))

        combined_score = max(-1.0, min(1.0, qc_momentum + mt_momentum))
        return round(combined_score, 2)

# Default provider instance
_provider: SentimentSignalProvider = DerivedMomentumProvider()

def compute_push_recommendation(flavor_id: int, db: Session) -> Optional[Dict[str, Any]]:
    """
    Returns channel, direction, momentum score, and confidence.
    Feeds into Distribution and Allocation Agent's E3 weighting.
    Confidence is strictly calibrated to be lower than B3's own primary confidence.
    """
    flavor = db.query(Flavor).filter(Flavor.id == flavor_id).first()
    if not flavor:
        return None

    momentum = _provider.compute_momentum_score(flavor_id, db)

    # Check for primary B3 alert
    b3_alert = (
        db.query(Alert)
        .filter(
            Alert.kpi_code == "B3",
            Alert.linked_entity_type == "flavor",
            Alert.linked_entity_id == flavor_id,
            Alert.status == "open",
        )
        .first()
    )

    if b3_alert:
        # Confidence must be lower than B3's own since it is a derived secondary signal (Section 16.6 acceptance)
        confidence = round(b3_alert.confidence_pct * 0.84, 1)
        channel = "QC"
        direction = "increase"
        allocation_boost_pct = int(min(25, max(10, abs(momentum) * 30)))
        rationale = f"Viral QC sell-through deviation (+{momentum*100:.0f}% momentum) triggers prioritized dynamic allocation to Quick Commerce dark stores."
    elif momentum > 0.15:
        confidence = 74.0
        channel = "MT"
        direction = "increase"
        allocation_boost_pct = 10
        rationale = "Positive retail momentum indicates healthy Modern Trade reorder velocity."
    else:
        # Neutral / baseline
        return None

    return {
        "flavor_id": flavor.id,
        "flavor_name": flavor.name,
        "channel": channel,
        "direction": direction,
        "momentum_score": momentum,
        "confidence": confidence,
        "allocation_boost_pct": allocation_boost_pct,
        "rationale": rationale,
        "badge_text": f"{channel} PUSH (+{allocation_boost_pct}%)",
    }
