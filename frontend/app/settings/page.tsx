'use client'
import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { healthApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { Check } from 'lucide-react'

const DIETS = ['Vegan','Vegetarian','Gluten-Free','Dairy-Free','Keto','Halal','None']
const ALLERGIES = ['Peanuts','Shellfish','Lactose','Soy','Gluten','Tree Nuts','Eggs']
const GOALS = [{v:'weight_loss',l:'Weight Loss'},{v:'muscle_gain',l:'Muscle Gain'},{v:'maintain',l:'Maintain'},{v:'gut_health',l:'Improve Gut Health'}]

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore()
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    height_cm: user?.height_cm || 170,
    weight_kg: user?.weight_kg || 70,
    dietary_preferences: user?.dietary_preferences || [],
    allergies: user?.allergies || [],
    health_goal: user?.health_goal || 'maintain',
  })
  const [loading, setLoading] = useState(false)
  const [notifs, setNotifs] = useState({ meals: true, expiry: true, suggestions: false })

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const toggle = (k: 'dietary_preferences' | 'allergies', v: string) =>
    setForm(f => ({
      ...f,
      [k]: f[k].includes(v) ? f[k].filter((x: string) => x !== v) : [...f[k], v]
    }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    try {
      const res = await healthApi.updateProfile(user.id, {
        height_cm: form.height_cm,
        weight_kg: form.weight_kg,
        dietary_preferences: form.dietary_preferences,
        allergies: form.allergies,
        health_goal: form.health_goal,
      })
      updateUser({
        height_cm: form.height_cm,
        weight_kg: form.weight_kg,
        dietary_preferences: form.dietary_preferences,
        allergies: form.allergies,
        health_goal: form.health_goal,
        bmi: res.data.bmi,
        bmi_category: res.data.bmi_category,
        daily_calorie_target: res.data.calorie_target,
        macros: { protein_g: res.data.protein_g, carbs_g: res.data.carbs_g, fat_g: res.data.fat_g },
      })
      toast.success('Profile updated! 🎉')
    } catch { toast.error('Update failed') }
    finally { setLoading(false) }
  }

  if (!user) return null

  return (
    <div className="max-w-2xl mx-auto space-y-6 fade-up">
      <h1 className="text-2xl font-bold">Settings</h1>

      <form onSubmit={save} className="space-y-6">
        {/* Profile */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-brand-500 flex items-center justify-center text-white text-xl font-bold">{user.name[0]}</div>
            <button type="button" className="text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">Change Avatar</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Name</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500" /></div>
            <div><label className="block text-sm font-medium mb-1">Email</label>
              <input value={form.email} disabled className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none bg-gray-50 text-gray-400" /></div>
          </div>
        </div>

        {/* Health Profile */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 space-y-5">
          <h2 className="font-semibold text-sm flex items-center gap-2">⚕️ Health Profile</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Height (cm)</label>
              <input type="number" value={form.height_cm} onChange={e => set('height_cm', +e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500" /></div>
            <div><label className="block text-sm font-medium mb-1">Weight (kg)</label>
              <input type="number" value={form.weight_kg} onChange={e => set('weight_kg', +e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500" /></div>
          </div>
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
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 space-y-4">
          <h2 className="font-semibold text-sm flex items-center gap-2">🔔 Notifications</h2>
          {[
            { key: 'meals', label: 'Meal plan reminders', desc: 'Get notified before each meal' },
            { key: 'expiry', label: 'Expiry alerts', desc: 'When pantry items are about to expire' },
            { key: 'suggestions', label: 'New recipe suggestions', desc: 'AI-curated weekly recipe ideas' },
          ].map(n => (
            <div key={n.key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-medium">{n.label}</p>
                <p className="text-xs text-gray-400">{n.desc}</p>
              </div>
              <button type="button" onClick={() => setNotifs(s => ({ ...s, [n.key]: !s[n.key as keyof typeof s] }))}
                className={`w-11 h-6 rounded-full relative transition ${notifs[n.key as keyof typeof notifs] ? 'bg-brand-500' : 'bg-gray-200'}`}>
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${notifs[n.key as keyof typeof notifs] ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          ))}
        </div>

        {/* Connected Devices */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 space-y-3">
          <h2 className="font-semibold text-sm flex items-center gap-2">📱 Connected Devices</h2>
          {['Fitbit','Apple Health'].map(d => (
            <div key={d} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm">{d}</span>
              <button type="button" className="text-xs border border-gray-200 px-3 py-1 rounded-lg text-gray-500 hover:bg-gray-50">Connect</button>
            </div>
          ))}
        </div>

        {/* Save */}
        <button type="submit" disabled={loading}
          className="w-full btn-primary py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
          <Check className="w-4 h-4" /> {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
