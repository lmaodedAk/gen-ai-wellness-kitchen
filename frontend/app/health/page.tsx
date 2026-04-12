'use client'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { healthApi } from '@/lib/api'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts'
import { Flame, Zap, Target, TrendingUp, Plus } from 'lucide-react'
import { API_URL } from '@/lib/config'

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const MEAL_EMOJIS: Record<string, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍎'
}

// Estimate calories burnt from activity type
const ACTIVITY_OPTIONS = [
  { label: 'Walking 30m', cal: 150, emoji: '🚶' },
  { label: 'Running 30m', cal: 300, emoji: '🏃' },
  { label: 'Cycling 30m', cal: 240, emoji: '🚴' },
  { label: 'Yoga 45m', cal: 180, emoji: '🧘' },
  { label: 'Gym 1hr', cal: 400, emoji: '💪' },
  { label: 'Swimming 30m', cal: 280, emoji: '🏊' },
  { label: 'Dancing 30m', cal: 220, emoji: '💃' },
  { label: 'HIIT 20m', cal: 320, emoji: '⚡' },
]

export default function HealthPage() {
  const user = useAuthStore(s => s.user)
  const token = useAuthStore((s: any) => s.accessToken)
  const [stats, setStats] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [view, setView] = useState<'Weekly'|'Monthly'>('Weekly')
  const [todayIntake, setTodayIntake] = useState<any>(null)
  const [weekLog, setWeekLog] = useState<any[]>([])
  const [caloriesBurnt, setCaloriesBurnt] = useState(0)
  const [showActivityLog, setShowActivityLog] = useState(false)
  const [loggedActivities, setLoggedActivities] = useState<Array<{label:string,cal:number,emoji:string}>>([]
  )
  const [customActivity, setCustomActivity] = useState('')
  const [customCal, setCustomCal] = useState('')
  const [aiMealRec, setAiMealRec] = useState<string>('')
  const [loadingRec, setLoadingRec] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [activeTab, setActiveTab] = useState<'today'|'week'|'trends'>('today')
  const [isEditingTarget, setIsEditingTarget] = useState(false)
  const [newTarget, setNewTarget] = useState('')
  // Manual meal logging
  const [showLogMeal, setShowLogMeal] = useState(false)
  const [logMealName, setLogMealName] = useState('')
  const [logMealCal, setLogMealCal] = useState('')
  const [logMealType, setLogMealType] = useState('lunch')
  const [logMealLoading, setLogMealLoading] = useState(false)

  async function fetchIntake() {
    const tok = localStorage.getItem('access_token')
    if (!tok) return
    try {
      const res = await fetch(`${API_URL}/health/intake/today`, {
        headers: { Authorization: `Bearer ${tok}` }
      })
      const data = await res.json()
      if (data.success) setTodayIntake(data.data)
    } catch {}
  }

  useEffect(() => { 
    fetchIntake() 
    // Refresh when user logs a meal from another page
    window.addEventListener('intake-updated', fetchIntake)
    return () => window.removeEventListener('intake-updated', fetchIntake)
  }, [])

  useEffect(() => {
    if (!user) return
    const currentToken = localStorage.getItem('access_token') || token || ''
    setLoadError(false)

    // Clear activities if new day
    const savedDate = localStorage.getItem('wellness_activities_date')
    const today = new Date().toDateString()
    if (savedDate !== today) {
      localStorage.removeItem('wellness_activities')
      localStorage.setItem('wellness_activities_date', today)
    }

    // Use allSettled — one failure never blanks the whole page
    Promise.allSettled([
      healthApi.stats(user.id),
      healthApi.history(user.id, view === 'Weekly' ? 7 : 30)
    ]).then(([statsRes, histRes]) => {
      if (statsRes.status === 'fulfilled' && statsRes.value?.data) {
        setStats(statsRes.value.data)
      } else {
        // Fallback: compute stats from user profile stored in Zustand
        const fallback = buildFallbackStats(user)
        setStats(fallback)
        setLoadError(true)
      }
      if (histRes.status === 'fulfilled') setHistory(histRes.value?.data || [])
    })

    // Load saved activities from localStorage
    try {
      const saved = localStorage.getItem('wellness_activities')
      if (saved) {
        const acts = JSON.parse(saved)
        setLoggedActivities(acts)
        setCaloriesBurnt(acts.reduce((s: number, a: any) => s + a.cal, 0))
      }
    } catch {}

    buildWeekLog(currentToken)
  }, [user, view])

  async function logMealManually() {
    const cal = parseInt(logMealCal)
    if (!logMealName.trim() || isNaN(cal) || cal <= 0) return
    const currentToken = localStorage.getItem('access_token') || token || ''
    setLogMealLoading(true)
    try {
      const res = await fetch(`${API_URL}/health/intake/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
        body: JSON.stringify({
          meal_type: logMealType,
          recipe_title: logMealName.trim(),
          calories: cal,
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          portion: 1.0
        })
      })
      const data = await res.json()
      if (data.success) {
        // Use the updated totals returned directly from backend
        setTodayIntake(data.data)
        setLogMealName('')
        setLogMealCal('')
        setShowLogMeal(false)
        await buildWeekLog(currentToken)
      }
    } catch {} finally { setLogMealLoading(false) }
  }

  function buildFallbackStats(u: any) {
    // Compute stats locally from user profile when backend is unreachable
    const w = u.weight_kg || 70, h = u.height_cm || 170
    const bmi = Math.round((w / ((h/100) ** 2)) * 10) / 10
    const cat = bmi < 18.5 ? 'underweight' : bmi < 25 ? 'normal' : bmi < 30 ? 'overweight' : 'obese'
    const target = u.daily_calorie_target || 2000
    return {
      bmi, bmi_category: cat,
      calorie_target: target,
      protein_g: u.macros?.protein_g || Math.round(w * 1.0),
      carbs_g: u.macros?.carbs_g || 200,
      fat_g: u.macros?.fat_g || 65,
      weight_kg: w, height_cm: h,
    }
  }

  async function buildWeekLog(currentToken: string) {
    try {
      const res = await fetch(API_URL + '/health/intake/today', {
        headers: { Authorization: `Bearer ${currentToken}` }
      })
      const data = await res.json()
      const todayMeals = data.success ? data.data?.meals || [] : []
      
      // Build 7-day display (today is real, others are placeholder)
      const today = new Date()
      const week = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today)
        d.setDate(today.getDate() - (6 - i))
        const isToday = i === 6
        return {
          day: DAYS[(d.getDay() + 6) % 7],
          date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          isToday,
          meals: isToday ? todayMeals : [],
          calories: isToday ? data.data?.total_cal || 0 : 0,
        }
      })
      setWeekLog(week)
    } catch {}
  }

  function logActivity(act: typeof ACTIVITY_OPTIONS[0]) {
    const updated = [...loggedActivities, act]
    setLoggedActivities(updated)
    const total = updated.reduce((s, a) => s + a.cal, 0)
    setCaloriesBurnt(total)
    localStorage.setItem('wellness_activities', JSON.stringify(updated))
    setShowActivityLog(false)
  }

  function addCustomActivity() {
    const cal = parseInt(customCal)
    if (isNaN(cal) || cal <= 0) return
    const act = { label: customActivity.trim() || 'Custom Activity', cal, emoji: '🏋️' }
    logActivity(act)
    setCustomActivity('')
    setCustomCal('')
  }

  async function getAiMealRecommendation(remaining: number) {
    const currentToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : token
    setLoadingRec(true)
    setAiMealRec('')
    try {
      const res = await fetch(API_URL + '/tutor/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
        body: JSON.stringify({
          question: `I have ${remaining} calories remaining in my daily budget. 
Suggest 3 healthy Indian meal options I can eat that would fit within these calories.
For each: dish name, approximate calories, and why it's a healthy choice.
Be brief and practical.`
        })
      })
      const json = await res.json()
      if (json.success) setAiMealRec(json.data.answer || '')
    } catch {} finally { setLoadingRec(false) }
  }

  async function saveNewTarget() {
    if(!newTarget) return;
    const currentToken = localStorage.getItem('access_token') || token || '';
    try {
      const res = await fetch(`${API_URL}/health/profile/${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
        body: JSON.stringify({ manual_calorie_target: parseInt(newTarget) })
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
        setIsEditingTarget(false);
        // Also refresh intake totals so remaining reflects new target
        await fetchIntake();
      }
    } catch {}
  }

  if (!user) return (
    <div className="space-y-4">
      {Array.from({length:5}).map((_, i) => (
        <div key={i} className="bg-white rounded-xl h-24 animate-pulse border border-gray-100" />
      ))}
    </div>
  )

  // Show skeleton while loading
  if (!stats) return (
    <div className="space-y-4">
      {Array.from({length:5}).map((_, i) => (
        <div key={i} className="bg-white rounded-xl h-24 animate-pulse border border-gray-100" />
      ))}
    </div>
  )

  const consumed = todayIntake?.total_cal || 0
  const target = stats.calorie_target || 2000
  const netCalories = consumed - caloriesBurnt
  const remaining = Math.max(0, target - netCalories)
  const consumedPct = Math.min(100, Math.round((netCalories / target) * 100))
  const bmiColor = stats.bmi_category === 'normal' ? '#16a34a' : stats.bmi_category === 'overweight' ? '#d97706' : '#dc2626'

  const macroData = [
    { name: 'Protein', value: stats.protein_g || 0, color: '#16a34a', unit: 'g' },
    { name: 'Carbs', value: stats.carbs_g || 0, color: '#e8a020', unit: 'g' },
    { name: 'Fat', value: stats.fat_g || 0, color: '#f97316', unit: 'g' },
  ]

  return (
    <div className="space-y-5 fade-up">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Health Stats</h1>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['today','week','trends'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${activeTab === t ? 'bg-white shadow text-brand-700' : 'text-gray-500'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ======= TODAY TAB ======= */}
      {activeTab === 'today' && (
        <div className="space-y-4">
          {/* Top stats row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Consumed', val: consumed, unit: 'kcal', color: 'text-orange-500', bg: 'bg-orange-50', emoji: '🍽️' },
              { label: 'Burnt', val: caloriesBurnt, unit: 'kcal', color: 'text-red-500', bg: 'bg-red-50', emoji: '🔥' },
              { label: 'Net', val: netCalories, unit: 'kcal', color: 'text-brand-600', bg: 'bg-brand-50', emoji: '⚡' },
              { label: 'Remaining', val: remaining, unit: 'kcal', color: 'text-green-600', bg: 'bg-green-50', emoji: '🎯' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-white`}>
                <div className="text-xl mb-0.5">{s.emoji}</div>
                <div className={`text-xl font-black ${s.color}`}>{s.val.toLocaleString()}</div>
                <div className="text-[10px] text-gray-500">{s.unit}</div>
                <div className="text-[10px] font-semibold text-gray-600 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Calorie ring progress */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center gap-6">
              {/* Ring */}
              <div className="relative w-32 h-32 flex-shrink-0">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#f0f0f0" strokeWidth="10" />
                  <circle cx="60" cy="60" r="50" fill="none"
                    stroke={consumedPct > 100 ? '#dc2626' : '#2d6a4f'}
                    strokeWidth="10"
                    strokeDasharray={`${Math.PI * 100}`}
                    strokeDashoffset={`${Math.PI * 100 * (1 - consumedPct / 100)}`}
                    strokeLinecap="round"
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-gray-800">{consumedPct}%</span>
                  <span className="text-[10px] text-gray-400">of goal</span>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="text-gray-600 font-semibold flex items-center gap-2">
                       Daily Goal
                       {!isEditingTarget && (
                           <button onClick={() => { setIsEditingTarget(true); setNewTarget(target.toString()) }} className="text-[10px] text-brand-600 hover:underline">✏️ Edit</button>
                       )}
                    </span>
                    {isEditingTarget ? (
                      <div className="flex gap-1">
                        <input value={newTarget} onChange={e => setNewTarget(e.target.value)} type="number" 
                               className="w-16 border rounded px-2 py-0.5 text-xs outline-none focus:border-brand-500" autoFocus />
                        <button onClick={saveNewTarget} className="text-[10px] bg-brand-600 hover:bg-brand-700 font-semibold text-white rounded px-2 py-0.5">Save</button>
                        <button onClick={() => setIsEditingTarget(false)} className="text-[10px] text-gray-500 hover:text-gray-700 bg-gray-100 rounded px-2 py-0.5">Cancel</button>
                      </div>
                    ) : (
                      <span className="font-bold">{target.toLocaleString()} kcal</span>
                    )}
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, consumedPct)}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {macroData.map(m => (
                    <div key={m.name} className="text-center">
                      <div className="text-sm font-bold" style={{color: m.color}}>{m.value}{m.unit}</div>
                      <div className="text-[10px] text-gray-400">{m.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Calories Burnt tracker */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Flame className="w-4 h-4 text-red-500" /> Calories Burnt Today
                <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs font-bold">{caloriesBurnt} kcal</span>
              </h2>
              <button onClick={() => setShowActivityLog(!showActivityLog)}
                className="flex items-center gap-1 text-xs text-brand-600 font-semibold hover:underline">
                <Plus className="w-3.5 h-3.5" /> Log Activity
              </button>
            </div>

            {/* Manual custom calorie input — kcal FIRST so it's obvious */}
            <div className="bg-red-50 rounded-xl p-3 mb-3 border border-red-100">
              <p className="text-[10px] font-bold text-red-600 mb-2">✍️ Quick log — enter calories burnt</p>
              <div className="flex gap-2 items-center">
                <div className="flex-1 relative">
                  <input
                    value={customCal}
                    onChange={e => setCustomCal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustomActivity()}
                    type="number" min="1" placeholder="How many kcal did you burn?"
                    className="w-full border-2 border-red-300 rounded-lg px-3 py-2.5 text-sm font-bold outline-none bg-white focus:border-red-500 text-red-700 placeholder:text-red-300 placeholder:font-normal" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-400 font-semibold">kcal</span>
                </div>
                <input
                  value={customActivity}
                  onChange={e => setCustomActivity(e.target.value)}
                  placeholder="Activity (optional)"
                  className="w-36 border border-red-200 rounded-lg px-3 py-2.5 text-xs outline-none bg-white" />
                <button onClick={addCustomActivity}
                  className="px-4 py-2.5 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 active:scale-95 transition">
                  + Add
                </button>
              </div>
            </div>

            {/* Logged activities chips */}
            {loggedActivities.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {loggedActivities.map((a, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-red-50 border border-red-100 rounded-full px-3 py-1 text-xs">
                    <span>{a.emoji}</span>
                    <span className="font-medium">{a.label}</span>
                    <span className="text-red-500 font-bold">-{a.cal}</span>
                    <button onClick={() => {
                      const updated = loggedActivities.filter((_, idx) => idx !== i)
                      setLoggedActivities(updated)
                      setCaloriesBurnt(updated.reduce((s, act) => s + act.cal, 0))
                      localStorage.setItem('wellness_activities', JSON.stringify(updated))
                    }} className="text-gray-400 hover:text-red-500 ml-1">×</button>
                  </div>
                ))}
              </div>
            )}

            {showActivityLog && (
              <div className="grid grid-cols-4 gap-2">
                {ACTIVITY_OPTIONS.map(act => (
                  <button key={act.label} onClick={() => logActivity(act)}
                    className="p-2.5 rounded-xl bg-gray-50 hover:bg-red-50 border border-gray-100 hover:border-red-200 transition text-center">
                    <div className="text-xl mb-1">{act.emoji}</div>
                    <div className="text-[10px] font-medium text-gray-700 leading-tight">{act.label}</div>
                    <div className="text-[10px] text-red-500 font-bold mt-0.5">-{act.cal} kcal</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* AI Meal Recommendation based on remaining calories */}
          <div className="bg-gradient-to-br from-brand-50 to-green-50 rounded-2xl p-5 border border-brand-100">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <h2 className="font-bold text-sm text-brand-700">🤖 What Can I Eat Today?</h2>
                <p className="text-xs text-brand-500 mt-0.5">
                  {remaining > 0 ? `You have ${remaining.toLocaleString()} kcal remaining after exercise` : "You've hit your calorie goal! 🎉"}
                </p>
              </div>
              <button
                onClick={() => getAiMealRecommendation(remaining)}
                disabled={loadingRec || remaining <= 0}
                className="text-xs bg-brand-500 text-white px-4 py-2 rounded-lg hover:bg-brand-600 disabled:opacity-50 transition font-medium"
              >
                {loadingRec ? '⏳ Thinking...' : '✨ Get AI Suggestions'}
              </button>
            </div>
            {aiMealRec ? (
              <div className="bg-white rounded-xl p-4 text-sm text-gray-700 leading-relaxed border border-brand-100 whitespace-pre-line">
                {aiMealRec}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">Enter your calories burnt above, then click to get AI-powered meal suggestions for what to eat with your remaining calories.</p>
            )}
          </div>

          {/* Manual Meal Logging */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm">📝 Log a Meal</h2>
              <button onClick={() => setShowLogMeal(!showLogMeal)}
                className="text-xs bg-brand-500 text-white px-3 py-1.5 rounded-lg hover:bg-brand-600 transition font-medium">
                {showLogMeal ? 'Cancel' : '+ Log Meal'}
              </button>
            </div>
            {showLogMeal && (
              <div className="space-y-3">
                <input
                  value={logMealName} onChange={e => setLogMealName(e.target.value)}
                  placeholder="Meal name (e.g. Dal Chawal, Oats)..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500" />
                <div className="flex gap-2">
                  <select value={logMealType} onChange={e => setLogMealType(e.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500">
                    {['breakfast','lunch','dinner','snack'].map(m => (
                      <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>
                    ))}
                  </select>
                  <input
                    value={logMealCal} onChange={e => setLogMealCal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && logMealManually()}
                    type="number" min="1" placeholder="Calories (kcal)"
                    className="w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-500" />
                  <button onClick={logMealManually} disabled={logMealLoading}
                    className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-bold hover:bg-brand-600 disabled:opacity-60 transition">
                    {logMealLoading ? '...' : 'Add'}
                  </button>
                </div>
                <p className="text-[10px] text-gray-400">This will update your calorie meter immediately ✅</p>
              </div>
            )}
          </div>

          {/* Today's meals logged */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <h2 className="font-bold text-sm mb-4">📋 Today's Meals</h2>
            <div className="grid grid-cols-2 gap-2">
              {['breakfast','lunch','snack','dinner'].map(meal => {
                const logged = todayIntake?.meals?.filter((m: any) => m.meal_type === meal) || []
                return (
                  <div key={meal} className={`rounded-xl p-3 border ${
                    logged.length > 0 ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold capitalize text-gray-600">
                        {MEAL_EMOJIS[meal]} {meal}
                      </span>
                      {logged.length > 0 && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded-full">✓ Logged</span>}
                    </div>
                    {logged.length > 0
                      ? logged.map((m: any, i: number) => (
                          <div key={i}>
                            <p className="text-xs font-medium truncate">{m.recipe_title}</p>
                            <p className="text-[10px] text-gray-500">{m.calories} kcal</p>
                          </div>
                        ))
                      : <p className="text-[10px] text-gray-400">Not logged yet</p>
                    }
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======= WEEK TAB ======= */}
      {activeTab === 'week' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <h2 className="font-bold text-sm mb-4">📅 7-Day Meal Log Calendar</h2>
            <div className="grid grid-cols-7 gap-2">
              {weekLog.map((day, i) => (
                <div key={i} className={`rounded-xl p-2 text-center transition ${
                  day.isToday ? 'bg-brand-500 text-white' : 'bg-gray-50 border border-gray-100'
                }`}>
                  <div className={`text-[10px] font-bold mb-1 ${day.isToday ? 'text-white/80' : 'text-gray-400'}`}>
                    {day.day}
                  </div>
                  <div className={`text-xs font-semibold ${day.isToday ? 'text-white' : 'text-gray-600'}`}>
                    {day.date.split(' ')[0]}
                  </div>
                  {day.calories > 0 ? (
                    <div className={`text-[9px] mt-1 font-bold ${day.isToday ? 'text-green-200' : 'text-green-600'}`}>
                      {day.calories} kcal
                    </div>
                  ) : (
                    <div className="text-[9px] mt-1 text-gray-300">—</div>
                  )}
                  {/* Meal dots */}
                  <div className="flex justify-center gap-0.5 mt-1.5">
                    {['breakfast','lunch','dinner','snack'].map(m => {
                      const hasIt = day.meals?.some((ml: any) => ml.meal_type === m)
                      return (
                        <div key={m} className={`w-1.5 h-1.5 rounded-full ${
                          hasIt ? (day.isToday ? 'bg-green-300' : 'bg-green-400') : (day.isToday ? 'bg-white/30' : 'bg-gray-200')
                        }`} />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-3 text-[11px] text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Meal logged</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200 inline-block" /> Not logged</span>
            </div>
          </div>

          {/* Today meals detail in week view */}
          {weekLog.find(d => d.isToday)?.meals?.length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <h3 className="font-bold text-sm mb-3">Today's Logged Meals</h3>
              <div className="space-y-2">
                {weekLog.find(d => d.isToday)?.meals.map((m: any, i: number) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{MEAL_EMOJIS[m.meal_type] || '🍽️'}</span>
                      <div>
                        <p className="text-sm font-medium">{m.recipe_title}</p>
                        <p className="text-[10px] text-gray-400 capitalize">{m.meal_type}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-orange-500">{m.calories} kcal</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======= TRENDS TAB ======= */}
      {activeTab === 'trends' && (
        <div className="space-y-4">
          {/* BMI + Target */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-gray-100 text-center">
              <h2 className="font-semibold text-xs text-gray-500 mb-3">CURRENT BMI</h2>
              <div className="text-4xl font-black" style={{ color: bmiColor }}>{stats.bmi}</div>
              <div className="text-sm font-semibold mt-1 capitalize" style={{ color: bmiColor }}>
                {stats.bmi_category}
              </div>
              <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100,((stats.bmi-15)/25)*100)}%`, backgroundColor: bmiColor }} />
              </div>
              <div className="flex justify-between text-[9px] text-gray-300 mt-1 px-1">
                {[15, 18.5, 25, 30, 40].map(v => <span key={v}>{v}</span>)}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <h2 className="font-semibold text-xs text-gray-500 mb-3">DAILY TARGETS</h2>
              <div className="space-y-2">
                {[
                  { label: 'Calorie Goal', val: `${stats.calorie_target} kcal`, color: '#2d6a4f' },
                  { label: 'BMR', val: `${stats.bmr} kcal`, color: '#6366f1' },
                  { label: 'TDEE', val: `${stats.tdee} kcal`, color: '#f97316' },
                ].map(s => (
                  <div key={s.label} className="flex justify-between text-xs border-b border-gray-50 pb-1.5">
                    <span className="text-gray-500">{s.label}</span>
                    <span className="font-bold" style={{color: s.color}}>{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Macro breakdown donut */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <h2 className="font-semibold text-sm mb-4">Macro Targets</h2>
            <div className="flex items-center gap-6">
              <PieChart width={120} height={120}>
                <Pie data={macroData} cx={55} cy={55} innerRadius={35} outerRadius={55}
                  dataKey="value" paddingAngle={2}>
                  {macroData.map((m, i) => <Cell key={i} fill={m.color} />)}
                </Pie>
              </PieChart>
              <div className="flex-1 space-y-3">
                {macroData.map(m => (
                  <div key={m.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{backgroundColor: m.color}} />
                        {m.name}
                      </span>
                      <span className="font-bold">{m.value}g</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, (m.value/(macroData.reduce((a,b)=>a+b.value,0)||1))*100)}%`,
                          backgroundColor: m.color
                        }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* BMI History Chart */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm">BMI History</h2>
              <div className="flex gap-1">
                {(['Weekly','Monthly'] as const).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition ${view === v ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5, 10)} tick={{ fontSize: 10 }} />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="bmi" stroke="#2d6a4f" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-10 text-gray-400 text-sm">
                <p className="text-3xl mb-2">📊</p>
                Update your profile weight regularly to see trends
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
