from datetime import datetime, timezone
from bson import ObjectId

async def get_prioritized_ingredients(
    user_id: str, db
) -> dict:
    items = await db["pantry_items"].find(
        {"user_id": ObjectId(user_id)}
    ).to_list(length=100)

    now = datetime.utcnow().replace(tzinfo=timezone.utc)
    scored = []

    for item in items:
        expiry = item.get("expiry_date")
        if expiry is None:
            scored.append({
                "name": item["name"],
                "expiry_score": 1,
                "days_until_expiry": 999
            })
            continue
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        days = (expiry - now).days
        if   days <  0: score = 0
        elif days == 0: score = 10
        elif days <= 2: score = 9
        elif days <= 5: score = 7
        elif days <= 10: score = 4
        else:            score = 1
        scored.append({
            "name":              item["name"],
            "quantity":          item.get("quantity",0),
            "unit":              item.get("unit",""),
            "expiry_score":      score,
            "days_until_expiry": max(0, days)
        })

    scored.sort(key=lambda x: x["expiry_score"], reverse=True)
    critical = [x for x in scored if x["expiry_score"] >= 9]
    soon     = [x for x in scored if 4 <= x["expiry_score"] < 9]

    hint = ""
    if critical:
        names = [x["name"] for x in critical[:3]]
        hint = f"Use {', '.join(names)} today — expiring!"

    return {
        "critical": critical,
        "soon":     soon,
        "all_ingredients": [
            x["name"] for x in scored if x["expiry_score"] > 0
        ],
        "expiry_hint": hint
    }
