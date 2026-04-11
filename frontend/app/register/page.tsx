'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Leaf, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

const DIETS = ['Vegan','Vegetarian','Gluten-Free','Dairy-Free','Keto','Halal','None']
const ALLERGIES = ['Peanuts','Shellfish','Lactose','Soy','Gluten','Tree Nuts','Eggs']
const GOALS = [{v:'weight_loss',l:'Weight Loss'},{v:'muscle_gain',l:'Muscle Gain'},{v:'maintain',l:'Maintain'},{v:'gut_health',l:'Improve Gut Health'}]

export default function RegisterPage() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '', email: '', password: '',
    height_cm: 170, weight_kg: 70, age: 25, gender: 'male',
    dietary_preferences: [] as string[], allergies: [] as string[],
    health_goal: 'maintain', cuisine_preference: ['any']
  })
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const setAuth = useAuthStore(s => s.setAuth)

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const toggle = (k: 'dietary_preferences' | 'allergies', v: string) =>
    setForm(f => ({
      ...f,
      [k]: f[k].includes(v) ? f[k].filter((x: string) => x !== v) : [...f[k], v]
    }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await authApi.register(form)
      setAuth(res.data.user, res.data.access_token, res.data.refresh_token)
      toast.success('Account created! Welcome to Wellness Kitchen 🌿')
      router.push('/')
    } catch (err: any) {
      toast.error(err.response?.data?.detail?.message || 'Registration failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-8 fade-up">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-brand-500 flex items-center justify-center">
            <Leaf className="w-6 h-6 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center mb-1">Create Account</h1>
        <p className="text-gray-500 text-sm text-center mb-6">Step {step} of 2</p>
        <div className="flex gap-2 mb-6">
          <div className={`flex-1 h-1.5 rounded-full ${step >= 1 ? 'bg-brand-500' : 'bg-gray-200'}`} />
          <div className={`flex-1 h-1.5 rounded-full ${step >= 2 ? 'bg-brand-500' : 'bg-gray-200'}`} />
        </div>

        <form onSubmit={onSubmit}>
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500 transition" placeholder="Your name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500 transition" placeholder="you@email.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input type={show ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} minLength={8} required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500 transition pr-10" placeholder="Min 8 characters" />
                  <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-sm font-medium mb-1">Height (cm)</label>
                  <input type="number" value={form.height_cm} onChange={e => set('height_cm', +e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500 transition" /></div>
                <div><label className="block text-sm font-medium mb-1">Weight (kg)</label>
                  <input type="number" value={form.weight_kg} onChange={e => set('weight_kg', +e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500 transition" /></div>
                <div><label className="block text-sm font-medium mb-1">Age</label>
                  <input type="number" value={form.age} onChange={e => set('age', +e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500 transition" /></div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Gender</label>
                <div className="flex gap-3">
                  {['male','female'].map(g => (
                    <button key={g} type="button" onClick={() => set('gender', g)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition ${form.gender === g ? 'bg-brand-500 text-white border-brand-500' : 'border-gray-200 text-gray-600 hover:border-brand-300'}`}>{g.charAt(0).toUpperCase()+g.slice(1)}</button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => setStep(2)} className="w-full btn-primary py-3 text-sm mt-2">Next →</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2">Dietary Preferences</label>
                <div className="flex flex-wrap gap-2">
                  {DIETS.map(d => (
                    <button key={d} type="button" onClick={() => toggle('dietary_preferences', d.toLowerCase())}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition ${form.dietary_preferences.includes(d.toLowerCase()) ? 'bg-brand-500 text-white border-brand-500' : 'border-gray-200 text-gray-600 hover:border-brand-300'}`}>{d}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Allergies</label>
                <div className="flex flex-wrap gap-2">
                  {ALLERGIES.map(a => (
                    <button key={a} type="button" onClick={() => toggle('allergies', a.toLowerCase())}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition ${form.allergies.includes(a.toLowerCase()) ? 'bg-red-500 text-white border-red-500' : 'border-gray-200 text-gray-600 hover:border-red-300'}`}>{a}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Health Goal</label>
                <div className="flex flex-wrap gap-2">
                  {GOALS.map(g => (
                    <button key={g.v} type="button" onClick={() => set('health_goal', g.v)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition ${form.health_goal === g.v ? 'bg-brand-500 text-white border-brand-500' : 'border-gray-200 text-gray-600 hover:border-brand-300'}`}>{g.l}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition">← Back</button>
                <button type="submit" disabled={loading} className="flex-1 btn-primary py-3 text-sm disabled:opacity-60">{loading ? 'Creating...' : 'Create Account'}</button>
              </div>
            </div>
          )}
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-500 font-semibold hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  )
}
