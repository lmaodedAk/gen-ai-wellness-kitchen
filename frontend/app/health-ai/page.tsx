'use client'
import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { ShieldCheck, AlertTriangle, CheckCircle, X } from 'lucide-react'
import { API_URL } from '@/lib/config'

const CONDITIONS_LIST = [
  { id: 'diabetes', label: 'Diabetes', emoji: '🩸', desc: 'Type 1 or Type 2' },
  { id: 'thyroid', label: 'Thyroid', emoji: '🦋', desc: 'Hypo or Hyperthyroid' },
  { id: 'pcos', label: 'PCOS', emoji: '🌸', desc: 'Polycystic Ovary Syndrome' },
  { id: 'high_cholesterol', label: 'High Cholesterol', emoji: '💉', desc: 'High LDL levels' },
  { id: 'hypertension', label: 'Hypertension', emoji: '❤️', desc: 'High blood pressure' },
  { id: 'anemia', label: 'Anemia', emoji: '🔴', desc: 'Low iron / hemoglobin' },
  { id: 'ibs', label: 'IBS', emoji: '🫄', desc: 'Irritable Bowel Syndrome' },
  { id: 'obesity', label: 'Obesity', emoji: '⚖️', desc: 'BMI above 30' },
  { id: 'lactose_intolerance', label: 'Lactose Intolerance', emoji: '🥛', desc: 'Cannot digest dairy' },
  { id: 'uric_acid', label: 'High Uric Acid', emoji: '🦷', desc: 'Gout risk' },
]

const FREQUENCY_COLORS: Record<string, string> = {
  daily: 'text-green-700 bg-green-100',
  '3x/week': 'text-blue-700 bg-blue-100',
  occasionally: 'text-amber-700 bg-amber-100',
}
const SEVERITY_COLORS: Record<string, string> = {
  'strictly avoid': 'text-red-700 bg-red-100',
  minimize: 'text-amber-700 bg-amber-100',
  'be careful': 'text-orange-700 bg-orange-100',
}

export default function HealthAIPage() {
  const token = useAuthStore((s: any) => s.accessToken)
  const [selected, setSelected] = useState<string[]>([])
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function analyze() {
    if (!selected.length) return
    const currentToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : token
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch(API_URL + '/advisor/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
        body: JSON.stringify({ conditions: selected })
      })
      const json = await res.json()
      if (json.success) setResult(json.data)
      else setError('Analysis failed. Please try again.')
    } catch {
      setError('Connection error. Please check backend.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 fade-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI Health Risk Advisor</h1>
          <p className="text-gray-500 text-sm">Select your health conditions for personalized dietary guidance</p>
        </div>
      </div>

      {/* Condition selector */}
      <div className="bg-white rounded-xl p-5 border border-gray-100">
        <h2 className="font-semibold text-sm mb-3 text-gray-700">Select Your Health Conditions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {CONDITIONS_LIST.map(c => (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              className={`p-3 rounded-xl border-2 text-left transition ${
                selected.includes(c.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-100 hover:border-gray-300 bg-gray-50'
              }`}
            >
              <div className="text-xl mb-0.5">{c.emoji}</div>
              <div className="text-sm font-semibold">{c.label}</div>
              <div className="text-[10px] text-gray-400">{c.desc}</div>
            </button>
          ))}
        </div>
        <button
          onClick={analyze}
          disabled={!selected.length || loading}
          className="mt-4 w-full btn-primary py-3 text-sm disabled:opacity-50"
        >
          {loading ? '🔬 Analyzing...' : `🧬 Analyze ${selected.length > 0 ? `(${selected.length} selected)` : ''}`}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-600 text-sm">{error}</div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-5 text-white">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 opacity-80" />
              <span className="text-sm font-semibold opacity-80">AI Health Analysis</span>
            </div>
            <p className="text-sm leading-relaxed">{result.summary}</p>
            {result.warning && (
              <p className="text-xs mt-3 opacity-70 bg-white/10 rounded-lg p-2">
                ⚠️ {result.warning}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Foods to Eat */}
            <div className="bg-white rounded-xl p-5 border border-green-100">
              <h3 className="font-bold text-sm text-green-700 flex items-center gap-1.5 mb-3">
                <CheckCircle className="w-4 h-4" /> Foods to Eat
              </h3>
              <div className="space-y-2">
                {result.foods_to_eat?.map((item: any, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.reason}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${FREQUENCY_COLORS[item.frequency] || 'bg-gray-100 text-gray-600'}`}>
                      {item.frequency}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Foods to Avoid */}
            <div className="bg-white rounded-xl p-5 border border-red-100">
              <h3 className="font-bold text-sm text-red-600 flex items-center gap-1.5 mb-3">
                <X className="w-4 h-4" /> Foods to Avoid
              </h3>
              <div className="space-y-2">
                {result.foods_to_avoid?.map((item: any, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-gray-400">{item.reason}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${SEVERITY_COLORS[item.severity] || 'bg-gray-100 text-gray-600'}`}>
                      {item.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sample Day Plan */}
          {result.sample_day_plan && (
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <h3 className="font-bold text-sm mb-3">📅 Sample Day Plan</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(result.sample_day_plan).map(([meal, desc]: [string, any]) => (
                  <div key={meal} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-bold capitalize text-gray-500 mb-1">{meal}</p>
                    <p className="text-sm text-gray-800">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lifestyle Tips */}
          {result.lifestyle_tips?.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
              <h3 className="font-bold text-sm text-amber-800 mb-3">💡 Lifestyle Tips</h3>
              {result.lifestyle_tips.map((tip: string, i: number) => (
                <p key={i} className="text-sm text-amber-700 mb-1.5">• {tip}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
