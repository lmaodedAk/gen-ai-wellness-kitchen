ALLERGEN_MAP = {
    "dairy":     ["milk","cream","butter","ghee","paneer","curd","yogurt","cheese"],
    "gluten":    ["wheat","maida","atta","bread","naan","roti","paratha"],
    "peanuts":   ["peanut","groundnut","mungfali"],
    "shellfish": ["prawn","shrimp","crab","lobster"],
    "eggs":      ["egg","anda"],
    "soy":       ["soy","tofu","soya"]
}
NON_VEG  = ["chicken","mutton","fish","egg","prawn","beef","pork","meat"]
HIGH_GI  = ["sugar","maida","white rice","potato","jaggery","honey"]

def check_recipe(recipe: dict, user: dict) -> dict:
    warnings = []
    ing_names = [
        i.get("name","").lower()
        for i in recipe.get("ingredients",[])
    ]
    prefs    = user.get("dietary_preferences", [])
    allergies = user.get("allergies", [])

    for allergy in allergies:
        triggers = ALLERGEN_MAP.get(allergy.lower(), [allergy])
        found = [
            i for i in ing_names
            if any(t in i for t in triggers)
        ]
        if found:
            warnings.append({
                "type": "allergen", "severity": "high",
                "message": f"⚠️ Contains {allergy}: {', '.join(set(found))}"
            })

    if any(p in prefs for p in ["vegetarian","vegan","jain"]):
        # Only warn if user did NOT explicitly request 
        # these ingredients
        explicitly_requested = [
            i.lower() for i in 
            recipe.get("explicitly_requested", [])
        ]
        found = [
            i for i in ing_names 
            if any(n in i for n in NON_VEG)
            and not any(r in i for r in explicitly_requested)
        ]
        if found:
            warnings.append({
                "type": "dietary", "severity": "medium",
                "message": f"ℹ️ Contains non-veg: {', '.join(set(found))} (you requested this)"
            })

    if "diabetic-friendly" in prefs:
        found = [i for i in ing_names if any(h in i for h in HIGH_GI)]
        if found:
            warnings.append({
                "type": "dietary", "severity": "medium",
                "message": f"🍚 High GI ingredients: {', '.join(set(found))}"
            })

    high = [w for w in warnings if w["severity"] == "high"]
    return {
        "warnings":      warnings,
        "is_safe":       len(high) == 0,
        "warning_count": len(warnings)
    }
