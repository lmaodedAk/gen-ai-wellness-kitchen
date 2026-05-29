'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { recipesApi, pantryApi } from '@/lib/api'
import { Camera, Type, Recycle, CalendarDays, TrendingUp, Flame, Heart, Eye, Bookmark, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { foodImage } from '@/lib/images'
import { API_URL } from '@/lib/config'

export default function Dashboard() {
  const user = useAuthStore((s: any) => s.user)
  const token = useAuthStore((s: any) => 
    s.accessToken || 
    (typeof window !== 'undefined' 
      ? localStorage.getItem('access_token') 
      : null)
  )
  const router = useRouter()
  const [recipes, setRecipes] = useState<any[]>([])
  const [expiring, setExpiring] = useState<any[]>([])
  const [pantryItems, setPantryItems] = useState<any[]>([])
  const [favorited, setFavorited] = useState<Set<string>>(new Set())
  const [suggestions, setSuggestions] = useState<any>(null)
  const [loadingSugg, setLoadingSugg] = useState(false)
  const [todayIntake, setTodayIntake] = useState<any>(null)
  const [intakeLog, setIntakeLog] = useState<any[]>([])
  const [leftoverSuggestions, setLeftoverSuggestions] = useState<any>(null)
  const [weekLog, setWeekLog] = useState<any[]>(() => {
    // Pre-build empty week so calendar shows immediately
    const today = new Date()
    const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - (6 - i))
      return {
        day: DAYS[(d.getDay() + 6) % 7],
        date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        isToday: i === 6,
        calories: 0,
        meals: []
      }
    })
  })
  const [pageReady, setPageReady] = useState(false)

  function getCurrentMealType() {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 11) return 'breakfast'
    if (hour >= 11 && hour < 15) return 'lunch'
    if (hour >= 15 && hour < 18) return 'snack'
    return 'dinner'
  }
  const currentMealTime = getCurrentMealType()

  async function fetchIntakeLog() {
    try {
      const currentToken = localStorage.getItem('access_token')
      const res = await fetch(
        `${API_URL}/vitals/intake/today`,
        { headers: { Authorization: `Bearer ${currentToken}` } }
      )
      const data = await res.json()
      if (data.success) {
        setIntakeLog(data.data?.meals || [])
        setTodayIntake(data.data)
      }
    } catch(e) {}
  }

  async function fetchLeftoverSuggestions() {
    try {
      const currentToken = localStorage.getItem('access_token')
      const res = await fetch(
        `${API_URL}/leftovers/suggest`,
        { 
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentToken}` 
          } 
        }
      )
      const data = await res.json()
      if (data.success && data.data?.suggestions?.length) {
        setLeftoverSuggestions(data.data)
      }
    } catch(e) {}
  }

  async function fetchSuggestions() {
    const currentToken = typeof window !== 'undefined'
      ? localStorage.getItem('access_token')
      : null
    if (!currentToken) return
    setLoadingSugg(true)
    try {
      const res = await fetch(
        `${API_URL}/suggestions/daily`,
        { 
          headers: { Authorization: `Bearer ${currentToken}` },
          cache: 'no-store'
        }
      )
      const data = await res.json()
      if (data.success) setSuggestions(data.data)
    } catch(e) {
      console.error('Suggestions failed', e)
    } finally {
      setLoadingSugg(false)
    }
  }

  useEffect(() => {
    if (!user) return
    const currentToken = localStorage.getItem('access_token')
    if (!currentToken) return

    // Fire ALL API calls in parallel — site loads instantly
    const headers = { Authorization: `Bearer ${currentToken}` }
    const API = API_URL

    Promise.allSettled([
      recipesApi.list(user.id, 0, 6),
      pantryApi.expiring(5),
      pantryApi.list(user.id),
      fetch(`${API}/vitals/intake/today`, { headers }).then(r => r.json()),
      fetch(`${API}/suggestions/daily`, { headers, cache: 'no-store' }).then(r => r.json()),
      fetch(`${API}/leftovers/suggest`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' } }).then(r => r.json()),
      fetch(`${API}/vitals/cooked-meals?days=7`, { headers }).then(r => r.json()),
    ]).then(([recipesRes, expiringRes, pantryRes, intakeRes, suggRes, leftRes, cookedRes]) => {
      if (recipesRes.status === 'fulfilled') setRecipes(recipesRes.value.data?.recipes || [])
      if (expiringRes.status === 'fulfilled') setExpiring(expiringRes.value.data || [])
      if (pantryRes.status === 'fulfilled') setPantryItems(pantryRes.value.data || [])
      
      let cookedMealsByDate: any = {}
      if (cookedRes?.status === 'fulfilled' && cookedRes.value.success) {
        cookedMealsByDate = cookedRes.value.data || {}
      }

      if (intakeRes.status === 'fulfilled' && intakeRes.value.success) {
        const meals = intakeRes.value.data?.meals || []
        setIntakeLog(meals)
        setTodayIntake(intakeRes.value.data)
      }

      // Fill week log
      setWeekLog(prev => prev.map(d => {
        // Find matching date in cookedRes data
        // d.date is '11 Apr', need to format to YYYY-MM-DD
        const currentYear = new Date().getFullYear();
        const dateObj = new Date(`${d.date} ${currentYear}`);
        // Handle timezone issues to get local YYYY-MM-DD
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const isoDate = `${yyyy}-${mm}-${dd}`;
        
        const meals = cookedMealsByDate[isoDate] || [];
        const cals = meals.reduce((sum: number, m: any) => sum + (m.calories || 0), 0);
        return { ...d, meals, calories: cals };
      }))

      if (suggRes.status === 'fulfilled' && suggRes.value.success) setSuggestions(suggRes.value.data)
      if (leftRes.status === 'fulfilled' && leftRes.value.success && leftRes.value.data?.suggestions?.length) {
        setLeftoverSuggestions(leftRes.value.data)
      }
    }).finally(() => setPageReady(true))
  }, [user])

  if (!user) return null

  const mealCalories = { breakfast: 310, lunch: 420, dinner: 0, snack: 150 }
  const totalConsumed = Object.values(mealCalories).reduce((a, b) => a + b, 0)

  const toggleFav = (id: string) => {
    setFavorited(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function getGreeting() {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    if (h < 21) return 'Good evening'
    return 'Good night'
  }

  // Featured recipe
  const featured = recipes[0]

  return (
    <div className="space-y-5 fade-up">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {getGreeting()}, {user.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            year:    'numeric', 
            month:   'long',
            day:     'numeric'
          })}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: Camera, label: 'Scan Food', href: '/generate' },
          { icon: Type, label: 'Enter Ingredients', href: '/generate' },
          { icon: Recycle, label: 'Optimize Leftovers', href: '/pantry' },
          { icon: CalendarDays, label: 'Meal Plan', href: '/meal-planner' },
        ].map(a => (
          <Link key={a.label} href={a.href}
            className="bg-white rounded-xl p-5 flex flex-col items-center gap-3 hover:shadow-md transition border border-gray-100">
            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center">
              <a.icon className="w-5 h-5 text-brand-500" />
            </div>
            <span className="text-xs font-medium text-gray-700">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Animated Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Your BMI', val: user.bmi || '--', sub: `${user.weight_kg || '--'}kg · ${user.height_cm || '--'}cm`, color: 'from-green-400 to-emerald-600',
            badge: user.bmi_category, badgeColor: 'bg-white/20 text-white' },
          { label: 'Daily Target', val: user.daily_calorie_target || '--', sub: 'kcal per day', color: 'from-orange-400 to-red-500',
            badge: 'Target', badgeColor: 'bg-white/20 text-white' },
          { label: 'Consumed Today', val: todayIntake?.total_cal || 0, sub: `${todayIntake?.remaining || '--'} kcal left`, color: 'from-blue-400 to-indigo-600',
            badge: `${todayIntake?.percentage || 0}%`, badgeColor: 'bg-white/20 text-white' },
          { label: 'Your Goal', val: user.health_goal?.replace(/_/g,' ')?.replace(/\b\w/g,(l:string)=>l.toUpperCase()) || 'Maintain', sub: `Protein: ${user.macros?.protein_g || '--'}g`, color: 'from-purple-400 to-violet-600',
            badge: 'Active', badgeColor: 'bg-white/20 text-white' },
        ].map((s, i) => (
          <div key={s.label}
            className={`bg-gradient-to-br ${s.color} rounded-2xl p-4 text-white relative overflow-hidden`}
            style={{ animationDelay: `${i * 80}ms` }}>
            <div className="text-[10px] font-semibold uppercase tracking-wide opacity-70 mb-1">{s.label}</div>
            <div className="text-2xl font-black mb-0.5 truncate">{s.val}</div>
            <div className="text-[11px] opacity-70">{s.sub}</div>
            <span className={`absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full font-semibold ${s.badgeColor} capitalize`}>
              {s.badge}
            </span>
          </div>
        ))}
      </div>

      {/* Today's Food Log */}
      {todayIntake && (
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h3 className="font-semibold text-sm mb-3">
            Today&apos;s Food Log
          </h3>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all"
                style={{width: `${todayIntake.percentage}%`}}
              />
            </div>
            <span className="text-sm font-bold text-brand-600">
              {todayIntake.total_cal} / {todayIntake.target_cal}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            {todayIntake.remaining > 0 
              ? `${todayIntake.remaining} kcal remaining today`
              : "You've reached your daily calorie target! 🎉"
            }
          </p>
          {todayIntake.meals?.length > 0 && (
            <div className="mt-3 space-y-1">
              {todayIntake.meals.map((m: any, i: number) => (
                <div key={i} className="flex justify-between text-xs text-gray-500">
                  <span className="capitalize">
                    {m.meal_type}: {m.recipe_title}
                  </span>
                  <span>{m.calories} kcal</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 7-Day Week Meal Calendar — always visible */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm">This Week's Meal Log</h2>
          <Link href="/health" className="text-xs text-brand-500 font-medium hover:underline">Full Stats →</Link>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {weekLog.map((day, i) => (
            <div key={i} className={`rounded-xl p-2 text-center transition ${
              day.isToday ? 'bg-brand-500 text-white ring-2 ring-brand-300' : 'bg-gray-50 border border-gray-100'
            }`}>
              <div className={`text-[10px] font-bold ${day.isToday ? 'text-white/70' : 'text-gray-400'}`}>{day.day}</div>
              <div className={`text-xs font-semibold mt-0.5 ${day.isToday ? 'text-white' : 'text-gray-700'}`}>{day.date.split(' ')[0]}</div>
              {day.calories > 0 ?
                <div className={`text-[9px] font-bold mt-1 ${day.isToday ? 'text-green-200' : 'text-green-600'}`}>{day.calories}</div> :
                <div className="text-[9px] mt-1" style={{color: day.isToday ? 'rgba(255,255,255,0.4)' : '#d1d5db'}}>—</div>
              }
              <div className="flex justify-center gap-0.5 mt-1">
                {['breakfast','lunch','dinner','snack'].map(m => {
                  const has = day.meals?.some((ml: any) => ml.meal_type === m)
                  return <div key={m} className={`w-1.5 h-1.5 rounded-full ${
                    has ? (day.isToday ? 'bg-green-300' : 'bg-green-400') : (day.isToday ? 'bg-white/20' : 'bg-gray-200')
                  }`} />
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-2">Dots = meals logged (B·L·D·S). Log meals via Generate Recipe or Meal Planner.</p>
      </div>

      {/* Pantry Status */}
      <div className="bg-white rounded-xl p-5 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Pantry Status</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <Link href="/pantry" className="text-brand-500 font-medium hover:underline">+ Add Ingredient</Link>
            <Link href="/pantry" className="text-brand-500 font-medium hover:underline">View All ›</Link>
          </div>
        </div>
        {expiring.length > 0 && (
          <div className="bg-red-50 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">⚠️</span>
              <span className="text-red-600 font-semibold text-xs">Expiring Soon</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {expiring.map(item => (
                <span key={item.id} className="bg-red-100 text-red-600 px-2.5 py-0.5 rounded-full text-xs font-medium">
                  {item.name} · {item.days_until_expiry}d
                </span>
              ))}
            </div>
            <Link href="/generate" className="inline-flex items-center gap-1.5 bg-brand-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium mt-3 hover:bg-brand-600 transition">
              <Recycle className="w-3 h-3" /> Optimize Now
            </Link>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {pantryItems.slice(0, 7).map(item => (
            <span key={item.id} className="bg-gray-50 text-gray-700 px-2.5 py-1 rounded-full text-xs font-medium border border-gray-100">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500 mr-1.5" />
              {item.name} · {item.quantity}{item.unit}
            </span>
          ))}
          {pantryItems.length > 7 && <span className="text-xs text-gray-400 self-center">+{pantryItems.length - 7} more</span>}
        </div>
      </div>

      {/* Featured Recipe */}
      {featured && (
        <div className="rounded-2xl overflow-hidden relative h-56 group cursor-pointer" onClick={() => router.push('/recipes')}>
          <img src={foodImage(featured.title)} alt={featured.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e: any) => { e.target.style.display = 'none' }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute top-4 left-4">
            <span className="bg-gold-500 text-white text-[10px] px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Today&apos;s AI Pick
            </span>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <h3 className="text-white text-xl font-bold">{featured.title}</h3>
            <p className="text-white/70 text-sm">{featured.nutrition?.calories || '—'} kcal · {(featured.prep_time_minutes || 0) + (featured.cook_time_minutes || 0)} min</p>
            <div className="flex gap-2 mt-2">
              {(featured.health_tags || []).slice(0, 3).map((t: string) => (
                <span key={t} className="bg-white/20 text-white px-2 py-0.5 rounded text-[10px] font-medium backdrop-blur-sm">{t}</span>
              ))}
            </div>
          </div>
          <div className="absolute bottom-4 right-4 text-white/60 text-xs hover:text-white transition">Tap to view →</div>
        </div>
      )}

      {/* Recommended Recipes */}
      {recipes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">Recommended for You</h2>
            <Link href="/recipes" className="text-sm text-brand-500 font-medium hover:underline">View All</Link>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {recipes.slice(0, 3).map(r => (
              <div key={r.id} className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-md transition">
                <div className="h-36 relative overflow-hidden bg-green-50">
                  <img src={foodImage(r.title)} alt={r.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    onError={(e: any) => { e.target.style.display = 'none' }} />
                  <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                    {r.nutrition?.calories || '—'} kcal · {(r.prep_time_minutes || 0) + (r.cook_time_minutes || 0)} min
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-sm truncate">{r.title}</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">{r.created_at?.split('T')[0]}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(r.health_tags || []).slice(0, 3).map((t: string) => (
                      <span key={t} className="bg-brand-50 text-brand-500 px-1.5 py-0.5 rounded text-[10px] font-medium">{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-50">
                    <button onClick={() => toggleFav(r.id)}>
                      <Heart className={`w-3.5 h-3.5 cursor-pointer transition ${favorited.has(r.id) ? 'text-red-500 fill-red-500' : 'text-gray-300 hover:text-red-400'}`} />
                    </button>
                    <Bookmark className="w-3.5 h-3.5 text-gray-300 cursor-pointer hover:text-brand-500 transition" />
                    <span className="text-gray-200">|</span>
                    <Link href="/recipes" className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-500">
                      <Eye className="w-3 h-3" /> View
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Food Calendar */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-base">
              📅 Today's Food Log
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
              })}
            </p>
          </div>
          {todayIntake && (
            <div className="text-right">
              <div className="text-lg font-bold text-brand-600">
                {todayIntake.total_cal || 0}
                <span className="text-xs text-gray-400 font-normal">
                  /{todayIntake.target_cal} kcal
                </span>
              </div>
              <div className="w-32 h-2 bg-gray-100 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, todayIntake.percentage || 0)}%`
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Meal time slots */}
        <div className="grid grid-cols-4 gap-2">
          {['breakfast','lunch','snack','dinner'].map(mealType => {
            const logged = intakeLog.find((m: any) => m.meal_type === mealType)
            const isCurrent = currentMealTime === mealType
            return (
              <div
                key={mealType}
                className={`rounded-xl p-3 text-center border transition
                  ${logged 
                    ? 'bg-brand-50 border-brand-200' 
                    : isCurrent 
                    ? 'bg-amber-50 border-amber-200 border-dashed'
                    : 'bg-gray-50 border-gray-100'
                  }`}>
                <div className="text-lg mb-1">
                  {mealType === 'breakfast' ? '🌅'
                    : mealType === 'lunch' ? '☀️'
                    : mealType === 'snack' ? '🍎'
                    : '🌙'}
                </div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">
                  {mealType}
                </p>
                {logged ? (
                  <>
                    <p className="text-xs font-medium text-gray-800 leading-tight line-clamp-2">
                      {logged.recipe_title}
                    </p>
                    <p className="text-[10px] text-brand-600 mt-1 font-semibold">
                      {logged.calories} kcal
                    </p>
                  </>
                ) : (
                  <p className="text-[10px] text-gray-400">
                    {isCurrent ? 'Time to eat!' : 'Not logged'}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {intakeLog.length === 0 && (
          <div className="mt-3 text-center py-2">
            <p className="text-xs text-gray-400">
              Generate a recipe and click "I ate this" to start tracking
            </p>
          </div>
        )}
      </div>

      {/* Leftover Suggestions */}
      {leftoverSuggestions?.suggestions?.length > 0 && (
        <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🍱</span>
            <div>
              <h2 className="font-bold text-base text-amber-900">
                Cook with Your Leftovers
              </h2>
              <p className="text-xs text-amber-600">
                {leftoverSuggestions.message}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {leftoverSuggestions.suggestions?.map((s: any, i: number) => (
              <div key={i} className="bg-white rounded-xl p-3 border border-amber-100 flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-sm">
                    {s.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {s.hindi_name} · {s.time_minutes}min · {s.difficulty}
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Uses: {s.why}
                  </p>
                </div>
                <button
                  onClick={() => {
                    window.location.href = `/generate?meal=${encodeURIComponent(s.title)}`
                  }}
                  className="ml-3 bg-amber-500 text-white text-xs px-3 py-2 rounded-lg hover:bg-amber-600 transition shrink-0">
                  Cook →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {suggestions && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">
              Right now it's {currentMealTime} time, try these:
            </h2>
            <span className="text-xs bg-brand-50 text-brand-600 px-3 py-1 rounded-full font-medium">
              Based on your {user?.health_goal?.replace(/_/g,' ')} goal
            </span>
          </div>
          
          {suggestions.goal_tip && (
            <div className="bg-gradient-to-r from-brand-500 to-green-600 rounded-xl p-4 text-white">
              <p className="text-sm font-medium">
                💪 {suggestions.goal_tip}
              </p>
            </div>
          )}
          
          {/* Current Meal Time Suggestions Highlighted */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {suggestions.suggestions
              ?.filter((s: any) => s.meal_type === currentMealTime)
              .map((s: any, i: number) => (
              <div key={`current-${i}`} 
                className="bg-brand-50 rounded-xl p-4 border border-brand-200 hover:shadow-md transition cursor-pointer"
                onClick={() => router.push(
                  `/generate?meal=${encodeURIComponent(s.title)}`
                )}>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full capitalize font-semibold shadow-sm">
                    ✨ Suggested for {s.meal_type}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    s.diet_type === 'veg' 
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {s.diet_type === 'veg' ? '🟢 Veg' : '🔴 Non-veg'}
                  </span>
                </div>
                <h3 className="font-semibold text-sm leading-tight text-brand-900">
                  {s.title}
                </h3>
                <p className="text-xs text-brand-600/70 mt-0.5">
                  {s.hindi_name}
                </p>
                <div className="flex gap-2 mt-2 text-xs text-brand-600/80 font-medium">
                  <span>{s.calories} kcal</span>
                  <span>{s.time_minutes}m</span>
                </div>
                <p className="text-[11px] text-brand-700 mt-2 bg-brand-100/50 rounded px-2 py-1 font-medium">
                  {s.why_good}
                </p>
              </div>
            ))}
          </div>

          <h3 className="font-semibold text-gray-400 mt-4 text-sm">Other meal suggestions for today:</h3>
          
          {/* Other Meal Time Suggestions */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 opacity-80 hover:opacity-100 transition">
            {suggestions.suggestions
              ?.filter((s: any) => s.meal_type !== currentMealTime)
              .map((s: any, i: number) => (
              <div key={`other-${i}`} 
                className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition cursor-pointer"
                onClick={() => router.push(
                  `/generate?meal=${encodeURIComponent(s.title)}`
                )}>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                    {s.meal_type}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    s.diet_type === 'veg' 
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {s.diet_type === 'veg' ? '🟢' : '🔴'}
                  </span>
                </div>
                <h3 className="font-semibold text-sm leading-tight">
                  {s.title}
                </h3>
                <div className="flex gap-2 mt-2 text-xs text-gray-500">
                  <span>{s.calories} kcal</span>
                  <span>{s.time_minutes}m</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RAG History Section */}
      {suggestions?.history_suggestions?.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-lg">
                🧠 Based on Your History
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                AI learned from your past meals to suggest these
              </p>
            </div>
            <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
              RAG Powered
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {suggestions.history_suggestions
              .slice(0, 6)
              .map((s: any, i: number) => (
              <div key={`rag-${i}`} 
                className="bg-purple-50 rounded-xl p-4 border border-purple-100 hover:shadow-md transition cursor-pointer"
                onClick={() => router.push(
                  `/generate?meal=${encodeURIComponent(s.title)}`
                )}>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full capitalize">
                    {s.why_good ? s.why_good.split(' ').slice(0, 4).join(' ') + '...' : 'Personalized'}
                  </span>
                </div>
                <h3 className="font-semibold text-sm leading-tight text-purple-900">
                  {s.title}
                </h3>
                <div className="flex gap-2 mt-2 text-xs text-purple-700">
                  <span>🔥 {s.calories} kcal</span>
                  <span>⏱ {s.time_minutes}m</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
