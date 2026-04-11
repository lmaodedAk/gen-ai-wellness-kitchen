async def compute_health_profile(user: dict) -> dict:
    """Compute BMI, calorie targets and macros. Safe — uses defaults for missing fields."""
    w   = float(user.get("weight_kg") or 70)
    h   = float(user.get("height_cm") or 170)
    age = int(user.get("age") or 25)
    gender = user.get("gender") or "male"
    goal   = user.get("health_goal") or "maintain"

    h_m = h / 100
    bmi = round(w / (h_m * h_m), 1)

    if bmi < 18.5:   cat = "underweight"
    elif bmi < 25:   cat = "normal"
    elif bmi < 30:   cat = "overweight"
    else:            cat = "obese"

    if gender == "male":
        bmr = 10*w + 6.25*h - 5*age + 5
    else:
        bmr = 10*w + 6.25*h - 5*age - 161

    tdee = bmr * 1.4
    if user.get("manual_calorie_target"):
        cals = int(user["manual_calorie_target"])
    else:
        cals = round({
            "weight_loss": tdee - 500,
            "muscle_gain": tdee + 300,
            "maintain":    tdee,
            "gut_health":  tdee
        }.get(goal, tdee))

    protein_g = round(w * 1.0)
    fat_g     = round((cals * 0.30) / 9)
    carbs_g   = round((cals - protein_g*4 - fat_g*9) / 4)

    return {
        "bmi":            bmi,
        "bmi_category":   cat,
        "weight_kg":      w,
        "height_cm":      h,
        "bmr":            round(bmr),
        "tdee":           round(tdee),
        "calorie_target": cals,
        "protein_g":      protein_g,
        "carbs_g":        carbs_g,
        "fat_g":          fat_g,
        "meal_split": {
            "breakfast": round(cals * 0.25),
            "lunch":     round(cals * 0.35),
            "dinner":    round(cals * 0.30),
            "snack":     round(cals * 0.10)
        }
    }
