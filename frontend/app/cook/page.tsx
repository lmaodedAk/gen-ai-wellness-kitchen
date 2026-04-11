'use client'
import { useState, useEffect, useRef } from 'react'
import { Volume2, VolumeX, SkipForward, SkipBack, Play, Pause, ChefHat, Globe, Search } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/lib/store'

type Lang = 'en' | 'hi'

interface Step {
  step: number
  title_en: string
  title_hi: string
  instruction_en: string
  instruction_hi: string
  duration_minutes: number
  tip_en: string
  tip_hi: string
}

export default function VoiceCookPage() {
  const searchParams = useSearchParams()
  const recipeFromUrl = searchParams.get('recipe') || ''
  const token = useAuthStore((s: any) =>
    s.accessToken || (typeof window !== 'undefined' ? localStorage.getItem('access_token') : null)
  )

  const [steps, setSteps] = useState<Step[]>([])
  const [meta, setMeta] = useState<{ recipe: string; total_time_minutes: number; difficulty: string; serving_suggestion_en?: string; serving_suggestion_hi?: string } | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [lang, setLang] = useState<Lang>('en')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [recipeName, setRecipeName] = useState(recipeFromUrl)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    synthRef.current = window.speechSynthesis
    if (recipeFromUrl) fetchSteps(recipeFromUrl)
    return () => { synthRef.current?.cancel() }
  }, [recipeFromUrl])

  // auto-speak whenever step or lang changes
  useEffect(() => {
    if (steps.length > 0 && !isMuted) {
      speakStep(currentStep, lang)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, lang, steps])

  async function fetchSteps(name: string) {
    if (!token) { setError('Please log in first'); return }
    setLoading(true)
    setError('')
    setSteps([])
    setMeta(null)
    setCurrentStep(0)
    try {
      const res = await fetch('http://localhost:8000/cook/steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipe_name: name })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || 'Failed')
      if (json.success && json.data?.steps?.length > 0) {
        setSteps(json.data.steps)
        setMeta(json.data)
      } else {
        setError('No steps returned. Please try a different recipe name.')
      }
    } catch (e: any) {
      setError(e.message || 'Could not connect to server')
    } finally {
      setLoading(false)
    }
  }

  function speakStep(index: number, language: Lang) {
    const synth = synthRef.current
    if (!synth || isMuted) return
    synth.cancel()

    const step = steps[index]
    if (!step) return

    const title = language === 'hi' ? step.title_hi : step.title_en
    const instruction = language === 'hi' ? step.instruction_hi : step.instruction_en
    const text = `Step ${step.step}. ${title}. ${instruction}`

    const utter = new SpeechSynthesisUtterance(text)
    utter.rate = 0.82
    utter.pitch = 1.05
    utter.volume = 1

    const voices = synth.getVoices()
    if (language === 'hi') {
      const v = voices.find(v => v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi'))
      if (v) utter.voice = v
    } else {
      const v = voices.find(v => v.lang.startsWith('en-IN') || v.lang.startsWith('en-US'))
      if (v) utter.voice = v
    }

    utter.onstart = () => setIsPlaying(true)
    utter.onend = () => setIsPlaying(false)
    utter.onerror = () => setIsPlaying(false)
    utterRef.current = utter
    synth.speak(utter)
    setIsPlaying(true)
  }

  function nextStep() {
    if (currentStep < steps.length - 1) setCurrentStep(p => p + 1)
  }
  function prevStep() {
    if (currentStep > 0) setCurrentStep(p => p - 1)
  }
  function togglePause() {
    const synth = synthRef.current
    if (!synth) return
    if (isPlaying) { synth.pause(); setIsPlaying(false) }
    else { synth.resume(); setIsPlaying(true); speakStep(currentStep, lang) }
  }

  const step = steps[currentStep]
  const progress = steps.length > 0 ? ((currentStep + 1) / steps.length) * 100 : 0

  return (
    <div className="space-y-5 fade-up max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center shadow">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">AI Voice Cook</h1>
            <p className="text-gray-500 text-xs">Step-by-step audio cooking guide</p>
          </div>
        </div>
        {/* Language toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          <Globe className="w-4 h-4 text-gray-500 ml-1" />
          {(['en', 'hi'] as Lang[]).map(l => (
            <button key={l} onClick={() => { synthRef.current?.cancel(); setIsPlaying(false); setLang(l) }}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${lang === l ? 'bg-white shadow text-brand-600' : 'text-gray-500 hover:text-gray-700'}`}>
              {l === 'en' ? '🇬🇧 English' : '🇮🇳 Hindi'}
            </button>
          ))}
        </div>
      </div>

      {/* Recipe search bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 mb-2">🍳 Enter a recipe to start guided cooking</p>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              value={recipeName}
              onChange={e => setRecipeName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && recipeName.trim() && fetchSteps(recipeName.trim())}
              placeholder="e.g. Paneer Butter Masala, Dal Tadka, Shorshe Ilish..."
              className="flex-1 text-sm outline-none bg-transparent"
            />
          </div>
          <button
            onClick={() => recipeName.trim() && fetchSteps(recipeName.trim())}
            disabled={loading || !recipeName.trim()}
            className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
            {loading ? '⏳' : '▶ Start'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          ❌ {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl p-10 border border-gray-100 text-center space-y-4">
          <div className="w-14 h-14 border-4 border-brand-100 border-t-brand-500 rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm font-medium">AI is generating detailed cooking steps in English & Hindi...</p>
          <p className="text-gray-400 text-xs">This takes about 15-20 seconds for quality steps</p>
        </div>
      )}

      {/* Recipe header */}
      {meta && steps.length > 0 && (
        <div className="bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="font-bold text-brand-700">🍳 {meta.recipe}</span>
            <span className="text-xs text-brand-500 ml-3">{meta.difficulty}</span>
          </div>
          <div className="flex gap-3 text-xs text-brand-600">
            <span>⏱ ~{meta.total_time_minutes} min</span>
            <span>📋 {steps.length} steps</span>
          </div>
        </div>
      )}

      {steps.length > 0 && !loading && (
        <>
          {/* Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Step {currentStep + 1} of {steps.length}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-brand-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Step badges */}
          <div className="flex gap-1.5 flex-wrap">
            {steps.map((_, i) => (
              <button key={i} onClick={() => setCurrentStep(i)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
                  i === currentStep ? 'bg-brand-500 text-white shadow' :
                  i < currentStep ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {i < currentStep ? '✓' : i + 1}
              </button>
            ))}
          </div>

          {/* Main step card */}
          <div className={`rounded-2xl p-6 border-2 transition-all ${isPlaying ? 'border-brand-400 bg-brand-50 shadow-lg' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-brand-500 text-white flex items-center justify-center font-black text-lg shrink-0">
                {currentStep + 1}
              </div>
              <div>
                <p className="font-bold text-base text-gray-800">
                  {lang === 'hi' ? step?.title_hi : step?.title_en}
                </p>
                <p className="text-xs text-gray-400">⏱ ~{step?.duration_minutes} min</p>
              </div>
              {isPlaying && (
                <div className="ml-auto flex gap-1 items-end">
                  {[0,1,2,3,4].map(i => (
                    <div key={i} className="w-1 bg-brand-400 rounded-full animate-bounce"
                      style={{ height: `${10 + (i % 3) * 6}px`, animationDelay: `${i * 100}ms` }} />
                  ))}
                </div>
              )}
            </div>

            <p className="text-sm font-medium text-gray-700 leading-relaxed mb-4">
              {lang === 'hi' ? step?.instruction_hi : step?.instruction_en}
            </p>

            {(step?.tip_en || step?.tip_hi) && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5">
                <p className="text-xs text-amber-700">
                  💡 <strong>Chef Tip:</strong> {lang === 'hi' ? step?.tip_hi : step?.tip_en}
                </p>
              </div>
            )}
          </div>

          {/* Translation reference */}
          {step && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-xs font-bold text-gray-400 mb-2">
                {lang === 'hi' ? '🇬🇧 English Reference' : '🇮🇳 Hindi Reference'}
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                {lang === 'hi' ? step.instruction_en : step.instruction_hi}
              </p>
            </div>
          )}

          {/* Audio Controls */}
          <div className="flex items-center justify-center gap-4">
            <button onClick={prevStep} disabled={currentStep === 0}
              className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition flex items-center justify-center">
              <SkipBack className="w-5 h-5 text-gray-600" />
            </button>
            <button onClick={togglePause}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition shadow-lg ${isPlaying ? 'bg-amber-500 hover:bg-amber-600' : 'bg-brand-500 hover:bg-brand-600'}`}>
              {isPlaying ? <Pause className="w-7 h-7 text-white" /> : <Play className="w-7 h-7 text-white ml-0.5" />}
            </button>
            <button onClick={nextStep} disabled={currentStep === steps.length - 1}
              className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-30 transition flex items-center justify-center">
              <SkipForward className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="flex justify-center gap-3">
            <button onClick={() => { setIsMuted(!isMuted); if (!isMuted) synthRef.current?.cancel(); setIsPlaying(false) }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition ${isMuted ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {isMuted ? 'Voice Off' : 'Voice On'}
            </button>
            <button onClick={() => speakStep(currentStep, lang)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 transition">
              🔁 Repeat Step
            </button>
          </div>

          {currentStep === steps.length - 1 && (
            <div className="bg-green-50 rounded-xl p-5 text-center border border-green-100">
              <div className="text-4xl mb-2">🎉</div>
              <p className="font-bold text-green-700 text-lg">Recipe Complete!</p>
              {meta?.serving_suggestion_en && (
                <p className="text-sm text-green-600 mt-1">
                  {lang === 'hi' ? meta.serving_suggestion_hi : meta.serving_suggestion_en}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Quick start suggestions */}
      {!steps.length && !loading && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 mb-3">💡 Try these recipes</p>
          <div className="flex flex-wrap gap-2">
            {['Dal Tadka', 'Paneer Butter Masala', 'Aloo Paratha', 'Biryani', 'Khichdi', 'Chole Bhature', 'Palak Paneer', 'Masala Chai'].map(r => (
              <button key={r} onClick={() => { setRecipeName(r); fetchSteps(r) }}
                className="px-3 py-1.5 bg-brand-50 text-brand-700 border border-brand-100 rounded-full text-xs font-medium hover:bg-brand-100 transition">
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
