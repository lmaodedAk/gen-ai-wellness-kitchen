'use client'
import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { pantryApi } from '@/lib/api'
import { Plus, Search, Trash2, Pencil } from 'lucide-react'
import { freshnessColor } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

const CATS = ['All','Vegetables','Grains','Legumes','Dairy','Oils','Other']

export default function PantryPage() {
  const user = useAuthStore((s: any) => s.user)
  const token = useAuthStore((s: any) => 
    s.accessToken || 
    (typeof window !== 'undefined' 
      ? localStorage.getItem('access_token') 
      : null)
  )
  const router = useRouter()
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  const [items, setItems] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('All')
  const [showAdd, setShowAdd] = useState(false)
  const [leftovers, setLeftovers] = useState<any[]>([])
  const [loadingLeftovers, setLoadingLeftovers] = useState(false)
  const [newItem, setNewItem] = useState({
    name: '',
    hindi_name: '',
    quantity: 0,
    unit: 'g',
    category: 'Vegetables',
    expiry_date: '',
    is_staple: false
  })
  const [quickSearch, setQuickSearch] = useState('')
  const [showQuickSuggestions, setShowQuickSuggestions] = useState(false)

  const COMMON_ITEMS = [
    { name: 'Milk', unit: 'ml', quantity: 500, category: 'Dairy' },
    { name: 'Onion', unit: 'g', quantity: 200, category: 'Vegetables' },
    { name: 'Tomato', unit: 'g', quantity: 200, category: 'Vegetables' },
    { name: 'Rice', unit: 'g', quantity: 500, category: 'Grains' },
    { name: 'Dal (Moong)', unit: 'g', quantity: 250, category: 'Legumes' },
    { name: 'Dal (Masoor)', unit: 'g', quantity: 250, category: 'Legumes' },
    { name: 'Atta (Wheat Flour)', unit: 'g', quantity: 500, category: 'Grains' },
    { name: 'Oil (Sunflower)', unit: 'ml', quantity: 500, category: 'Oils' },
    { name: 'Ghee', unit: 'g', quantity: 200, category: 'Dairy' },
    { name: 'Garlic', unit: 'g', quantity: 100, category: 'Vegetables' },
    { name: 'Ginger', unit: 'g', quantity: 100, category: 'Vegetables' },
    { name: 'Potato', unit: 'g', quantity: 300, category: 'Vegetables' },
    { name: 'Paneer', unit: 'g', quantity: 200, category: 'Dairy' },
    { name: 'Curd (Yogurt)', unit: 'g', quantity: 250, category: 'Dairy' },
    { name: 'Eggs', unit: 'pieces', quantity: 6, category: 'Other' },
    { name: 'Chicken', unit: 'g', quantity: 500, category: 'Other' },
    { name: 'Lemon', unit: 'pieces', quantity: 4, category: 'Vegetables' },
    { name: 'Green Chilli', unit: 'pieces', quantity: 10, category: 'Vegetables' },
    { name: 'Coriander (Dhania)', unit: 'g', quantity: 50, category: 'Vegetables' },
    { name: 'Cumin (Jeera)', unit: 'g', quantity: 50, category: 'Other' },
    { name: 'Mustard Seeds', unit: 'g', quantity: 50, category: 'Other' },
    { name: 'Turmeric Powder', unit: 'g', quantity: 50, category: 'Other' },
    { name: 'Chilli Powder', unit: 'g', quantity: 50, category: 'Other' },
    { name: 'Garam Masala', unit: 'g', quantity: 50, category: 'Other' },
    { name: 'Bread', unit: 'slices', quantity: 8, category: 'Grains' },
    { name: 'Butter', unit: 'g', quantity: 100, category: 'Dairy' },
    { name: 'Oats', unit: 'g', quantity: 200, category: 'Grains' },
    { name: 'Banana', unit: 'pieces', quantity: 4, category: 'Vegetables' },
    { name: 'Apple', unit: 'pieces', quantity: 3, category: 'Vegetables' },
    { name: 'Spinach', unit: 'g', quantity: 200, category: 'Vegetables' },
    { name: 'Capsicum', unit: 'pieces', quantity: 2, category: 'Vegetables' },
    { name: 'Carrot', unit: 'g', quantity: 200, category: 'Vegetables' },
  ]

  const quickSuggestions = quickSearch.length > 1
    ? COMMON_ITEMS.filter(i => i.name.toLowerCase().includes(quickSearch.toLowerCase())).slice(0, 6)
    : COMMON_ITEMS.slice(0,8)

  useEffect(() => {
    if (!user) return
    load()
    fetchLeftovers()
  }, [user])

  function load() {
    if (!user) return
    pantryApi.list(user.id).then(r => setItems(r.data || [])).catch(() => {})
  }

  async function fetchLeftovers() {
    setLoadingLeftovers(true)
    try {
      const currentToken = typeof window !== 'undefined'
        ? localStorage.getItem('access_token')
        : null
      if (!currentToken) {
        setLoadingLeftovers(false)
        return
      }
      const res = await fetch(
        `http://localhost:8000/leftovers/my`,
        { 
          headers: { 
            Authorization: `Bearer ${currentToken}` 
          }
        }
      )
      const data = await res.json()
      if (data.success) {
        setLeftovers(data.data || [])
      }
    } catch(e) {
      console.error('Leftovers fetch failed', e)
    } finally {
      setLoadingLeftovers(false)
    }
  }

  const expiring = items.filter(i => i.freshness_status === 'expiring' || i.freshness_status === 'expired')
  const filtered = items.filter(i => {
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false
    if (cat !== 'All' && i.category?.toLowerCase() !== cat.toLowerCase()) return false
    return true
  })

  async function addItem(e: React.FormEvent) {
    e.preventDefault()
    try {
      await pantryApi.add({ ...newItem, expiry_date: newItem.expiry_date ? new Date(newItem.expiry_date).toISOString() : undefined })
      toast.success('Item added!')
      setShowAdd(false)
      setNewItem({ name: '', hindi_name: '', quantity: 0, unit: 'g', category: 'Vegetables', expiry_date: '', is_staple: false })
      load()
    } catch { toast.error('Failed to add item') }
  }

  async function deleteItem(id: string) {
    try {
      await pantryApi.delete(id)
      setItems(is => is.filter(i => i.id !== id))
      toast.success('Removed')
    } catch { toast.error('Failed') }
  }

  async function quickAddItem(item: typeof COMMON_ITEMS[0]) {
    try {
      await pantryApi.add({ 
        name: item.name,
        hindi_name: '',
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        is_staple: false
      })
      toast.success(`✅ ${item.name} added to pantry!`)
      setQuickSearch('')
      setShowQuickSuggestions(false)
      load()
    } catch { toast.error('Failed to add') }
  }

  return (
    <div className="space-y-5 fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Pantry</h1>
          <p className="text-gray-500 text-sm">{items.length} items tracked</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {/* Quick Add Search */}
      <div className="bg-brand-50 rounded-xl p-4 border border-brand-100">
        <p className="text-xs font-bold text-brand-700 mb-2">⚡ Quick Add</p>
        <div className="relative">
          <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 border border-brand-200">
            <Search className="w-4 h-4 text-brand-400" />
            <input
              value={quickSearch}
              onChange={e => { setQuickSearch(e.target.value); setShowQuickSuggestions(true) }}
              onFocus={() => setShowQuickSuggestions(true)}
              onBlur={() => setTimeout(() => setShowQuickSuggestions(false), 200)}
              placeholder="Type ingredient to quick-add (e.g. milk, onion, rice)..."
              className="bg-transparent text-sm outline-none w-full"
            />
          </div>
          {showQuickSuggestions && (
            <div className="absolute top-full left-0 right-0 bg-white rounded-xl shadow-lg border border-gray-100 mt-1 z-50 overflow-hidden">
              {quickSuggestions.map((item, i) => (
                <button
                  key={i}
                  onMouseDown={() => quickAddItem(item)}
                  className="w-full text-left px-4 py-2.5 hover:bg-brand-50 border-b border-gray-50 last:border-0 flex items-center justify-between transition"
                >
                  <div>
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{item.category}</span>
                  </div>
                  <span className="text-xs text-brand-500 font-medium">{item.quantity} {item.unit} +</span>
                </button>
              ))}
              {quickSearch && !quickSuggestions.find(s => s.name.toLowerCase() === quickSearch.toLowerCase()) && (
                <button
                  onMouseDown={() => quickAddItem({ name: quickSearch, unit: 'g', quantity: 100, category: 'Other' })}
                  className="w-full text-left px-4 py-2.5 hover:bg-brand-50 flex items-center justify-between transition">
                  <span className="text-sm font-medium text-brand-600">Add "{quickSearch}" as new item</span>
                  <Plus className="w-4 h-4 text-brand-500" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-2.5 border border-gray-200">
        <Search className="w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pantry..."
          className="bg-transparent text-sm outline-none w-full" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {CATS.map(c => (
          <button key={c} onClick={() => setCat(c)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition ${cat === c ? 'bg-brand-500 text-white border-brand-500' : 'border-gray-200 text-gray-600 hover:border-brand-300'}`}>{c}</button>
        ))}
      </div>

      {/* Expiring alerts */}
      {expiring.length > 0 && (
        <div className="bg-red-50 rounded-xl p-4 border border-red-100">
          <div className="flex items-center gap-2 mb-2">
            <span>⚠️</span>
            <span className="text-red-600 font-semibold text-sm">Expiring Soon</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {expiring.map(i => (
              <span key={i.id} className="bg-red-100 text-red-600 px-2.5 py-0.5 rounded-full text-xs font-medium">
                {i.name} · {i.days_until_expiry}d
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Items Grid */}
      <div className="grid grid-cols-4 gap-3">
        {filtered.map(item => (
          <div key={item.id} className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-sm transition group">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-sm">{item.name}</h3>
                <p className="text-xs text-gray-400">{item.quantity} {item.unit}</p>
              </div>
              <button onClick={() => deleteItem(item.id)} className="text-gray-200 group-hover:text-red-400 transition">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-400">{item.category}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${freshnessColor(item.freshness_status)}`}>
                {item.freshness_status === 'expiring' ? '● Expiring' : item.freshness_status === 'use_soon' ? '● Use Soon' : item.freshness_status === 'expired' ? '● Expired' : '● Fresh'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Logged Leftovers */}
      {leftovers.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              🍱 Logged Leftovers
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {leftovers.length} items
              </span>
            </h2>
            <button
              onClick={() => router.push('/generate')}
              className="text-xs text-brand-600 font-medium hover:underline">
              Get recipe suggestions →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {leftovers.map((lft: any) => (
              <div key={lft.id}
                className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-amber-900">
                      From: {lft.recipe_name}
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      {new Date(lft.logged_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {lft.leftover_ingredients?.map((ing: any, i: number) => (
                        <span key={i}
                          className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full">
                          {ing.name}
                          {ing.amount > 0 && ` · ${ing.amount} ${ing.unit}`}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const currentToken = localStorage.getItem('access_token')
                      await fetch(
                        `http://localhost:8000/leftovers/${lft.id}/used`,
                        {
                          method: 'PUT',
                          headers: {
                            Authorization: `Bearer ${currentToken}`
                          }
                        }
                      )
                      toast.success('Marked as used ✅')
                      fetchLeftovers()
                    }}
                    className="text-xs text-gray-400 hover:text-red-500 ml-3 mt-0.5 transition shrink-0">
                    ✓ Used
                  </button>
                </div>
                <button
                  onClick={() => {
                    const ings = lft.leftover_ingredients
                      ?.map((i: any) => i.name)
                      .join(', ')
                    router.push(
                      `/generate?meal=${encodeURIComponent(ings)}&tab=ingredients`
                    )
                  }}
                  className="mt-3 w-full text-xs font-medium py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition">
                  🍳 Cook something with these leftovers
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {leftovers.length === 0 && !loadingLeftovers && (
        <div className="mt-6 bg-amber-50 rounded-xl p-5 border border-amber-100 text-center">
          <p className="text-sm text-amber-700 font-medium">
            🍱 No leftovers logged yet
          </p>
          <p className="text-xs text-amber-500 mt-1">
            After generating a recipe, scroll down and click &quot;Log Leftovers&quot; to track what was left over
          </p>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="modal-overlay backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <form onSubmit={addItem} onClick={e => e.stopPropagation()}
            className="modal-content shadow-2xl space-y-4">
            <h2 className="text-lg font-bold">Add Pantry Item</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
              <input
                type="text"
                value={newItem.name}
                onChange={e => setNewItem({...newItem, name: e.target.value})}
                placeholder="e.g. Chicken Breast, Spinach, Rice..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500 transition"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hindi Name 
                <span className="text-gray-400 font-normal"> (optional)</span>
              </label>
              <input
                type="text"
                value={newItem.hindi_name || ''}
                onChange={e => setNewItem({...newItem, hindi_name: e.target.value})}
                placeholder="e.g. मुर्गा, पालक, चावल..."
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500 transition"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label><input type="number" value={newItem.quantity} onChange={e => setNewItem(f => ({ ...f, quantity: +e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <select value={newItem.unit} onChange={e => setNewItem(f => ({ ...f, unit: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500">
                  {['g','kg','ml','L','pcs','cups','tbsp','tsp'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={newItem.category} onChange={e => setNewItem(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500">
                {CATS.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label><input type="date" value={newItem.expiry_date} onChange={e => setNewItem(f => ({ ...f, expiry_date: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500" /></div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button type="submit" className="flex-1 btn-primary py-2.5 text-sm">Add Item</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
