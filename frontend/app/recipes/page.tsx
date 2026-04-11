'use client'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { recipesApi } from '@/lib/api'
import { Search, Eye, Trash2, Heart, Bookmark, Clock, Flame } from 'lucide-react'
import toast from 'react-hot-toast'
import { foodImage } from '@/lib/images'

const FILTERS = ['All','Breakfast','Vegetarian','High Protein','Quick','Low Calorie','High Fiber']

export default function RecipesPage() {
  const user = useAuthStore(s => s.user)
  const [recipes, setRecipes] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState<any>(null)
  const [favorited, setFavorited] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) return
    recipesApi.list(user.id, 0, 50).then(r => setRecipes(r.data?.recipes || [])).catch(() => {})
  }, [user])

  const filtered = recipes.filter(r => {
    if (search && !r.title?.toLowerCase().includes(search.toLowerCase())) return false
    if (filter === 'All') return true
    const tags = (r.health_tags || []).map((t: string) => t.toLowerCase())
    const f = filter.toLowerCase().replace(' ', '-')
    if (filter === 'Breakfast') return r.meal_type === 'breakfast'
    if (filter === 'Quick') return (r.prep_time_minutes || 0) + (r.cook_time_minutes || 0) <= 20
    if (filter === 'Low Calorie') return (r.nutrition?.calories || 999) <= 400
    return tags.includes(f)
  })

  async function handleDelete(id: string) {
    try {
      await recipesApi.delete(id)
      setRecipes(rs => rs.filter(r => r.id !== id))
      toast.success('Recipe deleted')
      if (selected?.id === id) setSelected(null)
    } catch { toast.error('Delete failed') }
  }

  const toggleFav = (id: string) => {
    setFavorited(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-5 fade-up">
      <h1 className="text-2xl font-bold">My Recipes</h1>

      <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 border border-gray-200">
        <Search className="w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search recipes..."
          className="bg-transparent text-sm outline-none w-full" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition ${filter === f ? 'bg-brand-500 text-white border-brand-500' : 'border-gray-200 text-gray-600 hover:border-brand-300'}`}>{f}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No recipes yet</p>
          <p className="text-sm mt-1">Generate your first recipe to see it here!</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map(r => (
            <div key={r.id} className="bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-md transition group">
              <div className="h-44 relative overflow-hidden bg-green-50 cursor-pointer" onClick={() => setSelected(r)}>
                <img src={foodImage(r.title)} alt={r.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e: any) => { e.target.style.display = 'none' }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition" />
                <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1">
                  <Flame className="w-2.5 h-2.5" /> {r.nutrition?.calories || '—'} kcal
                </div>
                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" /> {(r.prep_time_minutes || 0) + (r.cook_time_minutes || 0)} min
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-sm truncate">{r.title}</h3>
                {r.hindi_name && <p className="text-[10px] text-brand-500 mt-0.5">{r.hindi_name}</p>}
                <p className="text-[10px] text-gray-400 mt-0.5">{r.cuisine?.replace(/_/g, ' ')} · {r.meal_type}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(r.health_tags || []).slice(0, 3).map((t: string) => (
                    <span key={t} className="bg-brand-50 text-brand-500 px-1.5 py-0.5 rounded text-[10px] font-medium">{t}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleFav(r.id)}>
                      <Heart className={`w-4 h-4 transition ${favorited.has(r.id) ? 'text-red-500 fill-red-500' : 'text-gray-300 hover:text-red-400'}`} />
                    </button>
                    <Bookmark className="w-4 h-4 text-gray-300 hover:text-brand-500 transition cursor-pointer" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelected(r)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-500 transition">
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                    <button onClick={() => handleDelete(r.id)} className="text-gray-200 hover:text-red-500 transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recipe Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto m-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Hero */}
            <div className="h-48 relative overflow-hidden rounded-t-2xl bg-green-50">
              <img src={foodImage(selected.title)} alt={selected.title}
                className="w-full h-full object-cover" onError={(e: any) => { e.target.style.display = 'none' }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <button onClick={() => setSelected(null)}
                className="absolute top-4 right-4 w-8 h-8 bg-black/30 backdrop-blur rounded-full flex items-center justify-center text-white hover:bg-black/50 transition">✕</button>
              <div className="absolute bottom-4 left-5">
                <h2 className="text-xl font-bold text-white">{selected.title}</h2>
                {selected.hindi_name && <p className="text-green-200 text-sm">{selected.hindi_name}</p>}
              </div>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-gray-500 text-sm">{selected.description}</p>

              <div className="flex gap-3 text-xs text-gray-500">
                <span>⏱ {(selected.prep_time_minutes || 0) + (selected.cook_time_minutes || 0)} min</span>
                <span>·</span>
                <span>🍽 {selected.servings || 2} servings</span>
                <span>·</span>
                <span>🌶 {selected.cuisine?.replace(/_/g, ' ')}</span>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                  { l: 'Calories', v: selected.nutrition?.calories, c: 'text-orange-500' },
                  { l: 'Protein', v: `${selected.nutrition?.protein_g}g`, c: 'text-brand-500' },
                  { l: 'Carbs', v: `${selected.nutrition?.carbs_g}g`, c: 'text-gold-500' },
                  { l: 'Fat', v: `${selected.nutrition?.fat_g}g`, c: 'text-red-400' },
                ].map(n => (
                  <div key={n.l} className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className={`text-lg font-bold ${n.c}`}>{n.v}</div>
                    <div className="text-[10px] text-gray-400">{n.l}</div>
                  </div>
                ))}
              </div>

              <h3 className="font-semibold text-sm mb-2">Ingredients</h3>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {selected.ingredients?.map((i: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2">
                    <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                    <span className="flex-1">{i.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{i.amount} {i.unit}</span>
                  </div>
                ))}
              </div>

              <h3 className="font-semibold text-sm mb-2">Instructions</h3>
              <div className="space-y-3">
                {selected.instructions?.map((s: any) => (
                  <div key={s.step} className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{s.step}</div>
                    <div>
                      <p className="text-sm leading-relaxed">{s.text}</p>
                      {s.tip && <p className="text-xs text-brand-500 mt-1 bg-brand-50 rounded px-2 py-1">💡 {s.tip}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {selected.explainability_note && (
                <div className="bg-brand-50 rounded-lg p-3 border border-brand-100">
                  <p className="text-xs text-brand-600">🧠 <strong>Why this recipe:</strong> {selected.explainability_note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
