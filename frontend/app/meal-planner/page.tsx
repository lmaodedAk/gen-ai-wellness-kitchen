'use client'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { API_URL } from '@/lib/config'

const DAYS = [
  'Monday','Tuesday','Wednesday',
  'Thursday','Friday','Saturday','Sunday'
]
const MEAL_TYPES = ['breakfast','lunch','dinner','snack']
const MEAL_COLORS: Record<string,string> = {
  breakfast: 'bg-amber-50 border-amber-200 text-amber-700',
  lunch:     'bg-green-50 border-green-200 text-green-700',
  dinner:    'bg-blue-50 border-blue-200 text-blue-700',
  snack:     'bg-purple-50 border-purple-200 text-purple-700'
}
const CUISINE_OPTIONS = [
  'any','north_indian','south_indian','bengali',
  'gujarati','mughlai','street_food','chinese',
  'italian','mexican','mediterranean','japanese',
  'thai','continental','american'
]

export default function MealPlannerPage() {
  const user = useAuthStore((s: any) => s.user)
  const token = useAuthStore((s: any) => 
    s.accessToken || 
    (typeof window !== 'undefined' 
      ? localStorage.getItem('access_token') 
      : null)
  )
  const router = useRouter()
  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [dietType, setDietType] = useState<string>(
    user?.dietary_preferences?.includes('vegan')
      ? 'vegan'
      : user?.dietary_preferences?.includes('vegetarian')
      ? 'vegetarian' : 'non-vegetarian'
  )
  const [goal, setGoal] = useState<string>(user?.health_goal || 'maintain')
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(['any'])
  // Set activeDay to today's day of week (0=Mon...6=Sun)
  const todayIndex = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1 })()
  const [activeDay, setActiveDay] = useState(todayIndex)
  const [intake, setIntake] = useState<any[]>([])
  const [loggedMeals, setLoggedMeals] = useState<Set<string>>(new Set())
  const API = process.env.NEXT_PUBLIC_API_URL || API_URL

  useEffect(() => { 
    fetchExistingPlan() 
    fetchIntake()
  }, [])

  async function fetchExistingPlan() {
    const currentToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : token;
    if (!currentToken) return
    try {
      const today = new Date()
      const week = `${today.getFullYear()}-W${String(
        getWeekNumber(today)
      ).padStart(2,'0')}`
      const res = await fetch(
        `${API}/meal-planner/${user?.id}?week=${week}`,
        { headers: { Authorization: `Bearer ${currentToken}` }}
      )
      const data = await res.json()
      if (data.data?.smart_plan) {
        setPlan(data.data.smart_plan)
      }
    } catch(e) {}
  }

  async function fetchIntake() {
    const currentToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : token;
    if (!currentToken) return
    try {
      const res = await fetch(`${API}/health/intake/today`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      })
      const data = await res.json()
      if (data.success) {
        setIntake(data.data.meals || [])
        // Track which meal types are already logged today
        const logged = new Set<string>(data.data.meals?.map((m: any) => m.meal_type) || [])
        setLoggedMeals(logged)
      }
    } catch(e) {}
  }

  async function logMeal(meal: any, mealType: string) {
    const currentToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : token
    if (!currentToken) return
    try {
      const res = await fetch(`${API}/health/intake/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
        body: JSON.stringify({
          meal_type: mealType,
          recipe_title: meal.title,
          calories: meal.calories || 0,
          protein_g: meal.protein_g || 0,
          carbs_g: 0,
          fat_g: 0,
          portion: 1
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`✅ ${meal.title} logged!`)
        setLoggedMeals(prev => new Set([...prev, mealType]))
        setIntake(prev => [...prev, { meal_type: mealType, recipe_title: meal.title, calories: meal.calories }])
      }
    } catch { toast.error('Could not log meal') }
  }

  function getWeekNumber(d: Date) {
    const onejan = new Date(d.getFullYear(), 0, 1)
    return Math.ceil(
      (((d.getTime() - onejan.getTime()) / 86400000)
        + onejan.getDay() + 1) / 7
    )
  }

  async function generatePlan() {
    const currentToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : token;
    if (!currentToken) return
    setLoading(true)
    setPlan(null)
    try {
      const res = await fetch(
        `${API}/meal-planner/auto-fill/smart`,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${currentToken}`
          },
          body: JSON.stringify({
            diet_type: dietType,
            cuisines:  selectedCuisines,
            goal:      goal
          })
        }
      )
      const data = await res.json()
      if (data.success) {
        setPlan(data.data)
        toast.success('7-day meal plan ready! 🎉')
        setShowSettings(false)
      } else {
        toast.error('Could not generate plan')
      }
    } catch(e) {
      toast.error('Generation failed — try again')
    } finally {
      setLoading(false)
    }
  }

  function toggleCuisine(c: string) {
    if (c === 'any') {
      setSelectedCuisines(['any'])
      return
    }
    setSelectedCuisines(prev => {
      const without = prev.filter(x => x !== 'any')
      if (without.includes(c)) {
        const next = without.filter(x => x !== c)
        return next.length ? next : ['any']
      }
      return [...without, c]
    })
  }

  return (
    <div className="space-y-6 fade-up">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            Meal Planner
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            AI-generated weekly plan based on your
            {' '}{user?.health_goal?.replace(/_/g,' ')} goal
          </p>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2">
          ✨ Generate My Week
        </button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div
          className="modal-overlay"
          onClick={e => {
            if (e.target === e.currentTarget)
              setShowSettings(false)
          }}>
          <div className="modal-content space-y-5" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-lg">
              Customize Your Meal Plan
            </h2>

            {/* Goal toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Health Goal
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'weight_loss', label: '⬇️ Lose Weight' },
                  { id: 'muscle_gain', label: '💪 Build Muscle' },
                  { id: 'maintain', label: '⚖️ Maintain' },
                  { id: 'gut_health', label: '🦠 Gut Health' }
                ].map(g => (
                  <button
                    key={g.id}
                    onClick={() => setGoal(g.id)}
                    className={`py-2 rounded-xl text-sm font-medium border transition
                      ${goal === g.id
                        ? 'bg-brand-500 text-white border-brand-500'
                        : 'border-gray-200 text-gray-600 hover:border-brand-300'
                      }`}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Diet toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Diet Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {['vegetarian','non-vegetarian','vegan'].map(d => (
                  <button
                    key={d}
                    onClick={() => setDietType(d)}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition
                      ${dietType === d
                        ? 'bg-brand-500 text-white border-brand-500'
                        : 'border-gray-200 text-gray-600 hover:border-brand-300'
                      }`}>
                    {d === 'vegetarian' ? '🟢 Veg'
                      : d === 'vegan' ? '🌱 Vegan'
                      : '🍗 Non-Veg'}
                  </button>
                ))}
              </div>
            </div>

            {/* Cuisine selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preferred Cuisines
              </label>
              <div className="flex flex-wrap gap-2">
                {CUISINE_OPTIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => toggleCuisine(c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition
                      ${selectedCuisines.includes(c)
                        ? 'bg-brand-500 text-white border-brand-500'
                        : 'border-gray-200 text-gray-600 hover:border-brand-300'
                      }`}>
                    {c === 'any' ? 'Any / All'
                      : c.replace(/_/g,' ')
                        .replace(/\b\w/g, l => l.toUpperCase())
                    }
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 border border-gray-200 rounded-xl py-3 text-sm text-gray-600">
                Cancel
              </button>
              <button
                onClick={generatePlan}
                disabled={loading}
                className="flex-1 btn-primary py-3 text-sm disabled:opacity-60">
                {loading
                  ? '⏳ Generating...'
                  : '✨ Generate Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="bg-white rounded-xl p-8 border border-gray-100 text-center space-y-3">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin mx-auto" />
          <p className="font-medium text-gray-700">
            AI is crafting your 7-day plan...
          </p>
          <p className="text-sm text-gray-400">
            Optimizing for your {user?.health_goal
              ?.replace(/_/g,' ')} goal
          </p>
        </div>
      )}

      {/* Plan display */}
      {plan && !loading && (
        <div className="space-y-4">

          {/* Plan summary */}
          <div className="bg-gradient-to-r from-brand-500 to-green-600 rounded-xl p-5 text-white">
            <h2 className="font-bold text-lg">
              {plan.plan_title}
            </h2>
            <p className="text-sm text-white/80 mt-1">
              {plan.week_tip}
            </p>
            <div className="flex gap-4 mt-3 text-sm">
              <span className="bg-white/20 px-3 py-1 rounded-full">
                🎯 {plan.diet_type}
              </span>
              <span className="bg-white/20 px-3 py-1 rounded-full">
                🔥 {plan.daily_target} kcal/day
              </span>
            </div>
          </div>

          {/* Day tabs - calendar style */}
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {(plan.days || []).map((day: any, i: number) => (
              <button
                key={i}
                onClick={() => setActiveDay(i)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap relative
                  ${activeDay === i
                    ? 'bg-brand-500 text-white'
                    : i === todayIndex
                    ? 'bg-brand-50 border-2 border-brand-400 text-brand-700'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-brand-300'
                  }`}>
                {day.day?.slice(0,3)}
                {i === todayIndex && (
                  <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[8px] bg-brand-500 text-white px-1 rounded-full">
                    Today
                  </span>
                )}
                <span className="block text-xs opacity-70">
                  {day.total_calories} kcal
                </span>
              </button>
            ))}
          </div>

          {/* Active day meals */}
          {plan.days?.[activeDay] && (
            <div className="space-y-3">
              {MEAL_TYPES.map(mealType => {
                const meal = plan.days[activeDay]
                  .meals?.[mealType]
                if (!meal) return null
                return (
                  <div
                    key={mealType}
                    className={`rounded-xl p-4 border ${MEAL_COLORS[mealType]}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold uppercase tracking-wide opacity-60">
                            {mealType}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium
                            ${meal.diet_type === 'vegan'
                              ? 'bg-emerald-100 text-emerald-700'
                              : meal.diet_type === 'veg'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-600'
                            }`}>
                            {meal.diet_type === 'vegan'
                              ? '🌱 Vegan'
                              : meal.diet_type === 'veg'
                              ? '🟢 Veg'
                              : '🔴 Non-veg'}
                          </span>
                        </div>
                        <h3 className="font-semibold text-sm leading-tight">
                          {meal.title}
                        </h3>
                        {meal.hindi_name && (
                          <p className="text-xs opacity-60 mt-0.5">
                            {meal.hindi_name}
                          </p>
                        )}
                        <p className="text-xs mt-2 opacity-70 italic">
                          {meal.why}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 space-y-1">
                        <div className="text-sm font-bold">
                          {meal.calories} kcal
                        </div>
                        <div className="text-xs opacity-60">
                          ⏱ {meal.time_minutes}m
                        </div>
                        <div className="text-[10px] opacity-50 capitalize">
                          {meal.cuisine
                            ?.replace(/_/g,' ')}
                        </div>
                      </div>
                    </div>
                    {/* Two action buttons */}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => {
                          const params = new URLSearchParams({
                            meal: meal.title,
                            meal_type: mealType,
                            cuisine: meal.cuisine || 'any'
                          })
                          window.location.href = `/generate?${params.toString()}`
                        }}
                        className="flex-1 text-xs font-medium py-2 rounded-lg border border-current opacity-70 hover:opacity-100 transition">
                        🍳 Generate Recipe →
                      </button>
                      {activeDay === todayIndex && (
                        loggedMeals.has(mealType)
                          ? <button disabled className="flex-1 text-xs font-medium py-2 rounded-lg bg-green-100 text-green-700 border border-green-200">
                              Logged
                            </button>
                          : <button
                              onClick={() => logMeal(meal, mealType)}
                              className="flex-1 text-xs font-medium py-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition">
                              📋 Log Meal
                            </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Day total */}
              <div className="bg-gray-50 rounded-xl p-4 flex justify-between items-center">
                <span className="text-sm text-gray-600 font-medium">
                  Day Total
                </span>
                <span className="font-bold text-brand-600">
                  {plan.days[activeDay].total_calories} kcal
                  {' '}
                  <span className="text-xs text-gray-400 font-normal">
                    / {plan.daily_target} target
                  </span>
                </span>
              </div>
              
              {/* Daily Log Section */}
              <div className="mt-8 pt-6 border-t border-gray-100">
                <h3 className="font-bold text-lg mb-3">Today&apos;s Log</h3>
                {intake.length === 0 ? (
                  <p className="text-sm text-gray-500">No meals logged today yet.</p>
                ) : (
                  <div className="space-y-2">
                    {intake.map((meal: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center bg-white border border-gray-100 p-3 rounded-lg text-sm">
                        <div>
                          <p className="font-medium">{meal.recipe_title}</p>
                          <p className="text-xs text-gray-400 capitalize">{meal.meal_type} · {new Date(meal.logged_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                        </div>
                        <div className="font-bold text-gray-700">
                          {meal.calories} kcal
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!plan && !loading && (
        <div className="bg-white rounded-xl p-12 border border-gray-100 text-center space-y-4">
          <div className="text-5xl">📅</div>
          <h3 className="font-bold text-lg">
            No meal plan yet
          </h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Click "Generate My Week" to get a 
            personalized 7-day meal plan based on 
            your health goal and food preferences
          </p>
          <button
            onClick={() => setShowSettings(true)}
            className="btn-primary px-6 py-3 text-sm">
            ✨ Generate My Week
          </button>
        </div>
      )}
    </div>
  )
}
