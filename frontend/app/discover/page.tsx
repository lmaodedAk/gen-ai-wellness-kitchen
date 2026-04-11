'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { BrainCircuit, Sparkles, ChefHat, Clock, Flame, RefreshCw } from 'lucide-react'
import { API_URL } from '@/lib/config'

const DIET_COLORS: Record<string, string> = {
  vegan:   'bg-emerald-100 text-emerald-700',
  veg:     'bg-green-100 text-green-700',
  'non-veg': 'bg-red-100 text-red-600',
}
const DIET_LABELS: Record<string, string> = {
  vegan:   'Vegan',
  veg:     'Veg',
  'non-veg': 'Non-veg',
}
const DIFFICULTY_COLORS: Record<string, string> = {
  easy:   'text-green-600',
  medium: 'text-amber-600',
  hard:   'text-red-600',
}

export default function DiscoverPage() {
  const router = useRouter()
  const { token } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')

  // Auto-generate on first load
  useEffect(() => { generateIdeas() }, [])

  async function generateIdeas() {
    const currentToken = typeof window !== 'undefined'
      ? localStorage.getItem('access_token')
      : token
    if (!currentToken) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(API_URL + '/discover/generate', {
        headers: { Authorization: `Bearer ${currentToken}` },
        cache: 'no-store'
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const json = await res.json()
      setData(json.data)
    } catch (e: any) {
      setError('Could not load AI memory suggestions. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 fade-up">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BrainCircuit className="w-6 h-6 text-purple-600" />
            <h1 className="text-2xl font-bold">AI Memory Kitchen</h1>
          </div>
          <p className="text-gray-500 text-sm">
            AI analyzes everything you&apos;ve cooked and generates brand-new ideas inspired by your taste profile
          </p>
        </div>
        <button
          onClick={generateIdeas}
          disabled={loading}
          className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2 disabled:opacity-60"
        >
          {loading
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing memory...</>
            : <><Sparkles className="w-4 h-4" /> Regenerate Ideas</>
          }
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-6 border border-purple-100 animate-pulse">
            <div className="h-4 bg-purple-100 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 animate-pulse space-y-3">
                <div className="h-4 bg-gray-100 rounded w-2/3" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
                <div className="h-16 bg-gray-50 rounded" />
                <div className="h-8 bg-purple-50 rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-5 text-center">
          <p className="text-red-600 text-sm font-medium">{error}</p>
          <button onClick={generateIdeas} className="mt-3 text-sm text-red-500 underline">
            Try again
          </button>
        </div>
      )}

      {/* Memory summary */}
      {data?.based_on && !loading && (
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl p-5 text-white">
          <div className="flex items-center gap-2 mb-2">
            <BrainCircuit className="w-5 h-5 opacity-80" />
            <span className="text-sm font-semibold opacity-80 uppercase tracking-wide">
              Your Taste Memory
            </span>
          </div>
          <p className="text-sm leading-relaxed opacity-90">{data.based_on}</p>
        </div>
      )}

      {/* Discovery cards */}
      {data?.discoveries && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.discoveries.map((dish: any, i: number) => (
            <div
              key={i}
              className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-lg hover:border-purple-200 transition-all cursor-pointer group flex flex-col"
              onClick={() => router.push(
                `/generate?meal=${encodeURIComponent(dish.title)}&cuisine=${encodeURIComponent(dish.cuisine || '')}`
              )}
            >
              {/* Tags row */}
              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${DIET_COLORS[dish.diet_type] || 'bg-gray-100 text-gray-600'}`}>
                  {DIET_LABELS[dish.diet_type] || dish.diet_type}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium capitalize">
                  {dish.meal_type}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">
                  {dish.cuisine?.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Title */}
              <h3 className="font-bold text-base leading-tight text-gray-900 group-hover:text-purple-700 transition">
                {dish.title}
              </h3>
              {dish.hindi_name && (
                <p className="text-xs text-gray-400 mt-0.5">{dish.hindi_name}</p>
              )}

              <p className="text-xs text-gray-500 mt-3 leading-relaxed flex-1 bg-purple-50 rounded-lg p-3 border-l-2 border-purple-300">
                {dish.why_fits}
              </p>

              {/* Inspired by */}
              {dish.inspired_by && (
                <p className="text-[10px] text-indigo-500 mt-2">
                  ✨ Inspired by: {dish.inspired_by}
                </p>
              )}

              {/* Stats */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Flame className="w-3 h-3 text-orange-400" />
                    {dish.calories} kcal
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-400" />
                    {dish.time_minutes}m
                  </span>
                </div>
                <span className={`text-[10px] font-semibold capitalize ${DIFFICULTY_COLORS[dish.difficulty] || 'text-gray-400'}`}>
                  {dish.difficulty}
                </span>
              </div>

              {/* CTA */}
              <button className="mt-3 w-full text-xs font-semibold py-2.5 rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-600 hover:text-white transition flex items-center justify-center gap-1.5">
                <ChefHat className="w-3.5 h-3.5" />
                Generate Full Recipe →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !data && !error && (
        <div className="bg-white rounded-xl p-12 border border-gray-100 text-center space-y-4">
          <BrainCircuit className="w-12 h-12 text-purple-300 mx-auto" />
          <h3 className="font-bold text-lg">No memory yet</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Generate some recipes first! The more you cook, the smarter this gets —
            your AI memory will find your taste patterns and invent dishes you&apos;ll love.
          </p>
          <button
            onClick={() => router.push('/generate')}
            className="btn-primary px-6 py-3 text-sm"
          >
            Generate Your First Recipe
          </button>
        </div>
      )}
    </div>
  )
}
