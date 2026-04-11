'use client'
import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '@/lib/store'
import { recipesApi } from '@/lib/api'
import { Image as ImageIcon, Type, ChefHat, Sparkles, Upload, BookmarkPlus, ShoppingCart, Mic, RefreshCw, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { foodImage as recipeImage } from '@/lib/images'
import { API_URL } from '@/lib/config'

const TABS = [
  { id: 'ingredients', label: 'By Ingredients', icon: Type },
  { id: 'name', label: 'By Meal Name', icon: ChefHat },
  { id: 'image', label: 'By Image', icon: ImageIcon },
]
const CUISINES = ['any','north_indian','south_indian','bengali','gujarati','mughlai','street_food','continental','chinese','italian']

export default function GeneratePage() {
  const user = useAuthStore((s: any) => s.user)
  const token = useAuthStore((s: any) => 
    s.accessToken || 
    (typeof window !== 'undefined' 
      ? localStorage.getItem('access_token') 
      : null)
  )
  const [tab, setTab] = useState('ingredients')
  const [ingredients, setIngredients] = useState('')
  const [mealName, setMealName] = useState('')
  const [cuisine, setCuisine] = useState('any')
  const [mealType, setMealType] = useState('lunch')
  const [maxTime, setMaxTime] = useState(45)
  const [preferExpiring, setPreferExpiring] = useState(true)
  const [loading, setLoading] = useState(false)
  const [recipe, setRecipe] = useState<any>(null)
  const [steps, setSteps] = useState<string[]>([])
  const [showLeftoverModal, setShowLeftoverModal] = useState(false)
  const [leftoverItems, setLeftoverItems] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [imageFile, setImageFile] = useState<File|null>(null)
  const [imagePreview, setImagePreview] = useState<string|null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Smart Substitution
  const [subIngredient, setSubIngredient] = useState('')
  const [subResult, setSubResult] = useState<any>(null)
  const [subLoading, setSubLoading] = useState(false)
  const [showSubPanel, setShowSubPanel] = useState(false)
  // Grocery List
  const [groceryList, setGroceryList] = useState<any>(null)
  const [groceryLoading, setGroceryLoading] = useState(false)
  const [showGrocery, setShowGrocery] = useState(false)

  const [pantryItems, setPantryItems] = useState<any[]>([])

  useEffect(() => {
    // Load pantry items for quick-add
    if (user?.id) {
      const t = localStorage.getItem('access_token')
      fetch(`${API_URL}/pantry/${user.id}`, {
        headers: { Authorization: `Bearer ${t}` }
      }).then(r => r.json()).then(d => {
        if (d.success) setPantryItems(d.data || [])
      }).catch(() => {})
    }
  }, [user])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mealParam = params.get('meal')
    const mealTypeParam = params.get('meal_type')
    const cuisineParam = params.get('cuisine')
    
    if (mealParam) {
      setTab('name')
      setMealName(mealParam)
      if (mealTypeParam) setMealType(mealTypeParam)
      if (cuisineParam) setCuisine(cuisineParam)
      
      // Auto-trigger generation after 500ms
      setTimeout(() => {
        document.getElementById('generate-btn')?.click()
      }, 500)
    }
  }, [])

  async function generate() {
    if (!user) return
    setLoading(true)
    setRecipe(null)
    setSteps([])
    try {
      const body: any = { cuisine, meal_type: mealType, max_time: maxTime }

      // Always pass whatever the user typed, regardless of tab
      if (tab === 'ingredients' && ingredients.trim()) {
        body.ingredients = ingredients.split(',').map((s: string) => s.trim()).filter(Boolean)
      }
      if (tab === 'name' && mealName.trim()) {
        body.meal_name = mealName.trim()
        body.ingredients = [mealName.trim()]
      }
      // For image tab with no input, tell it to use pantry
      if (tab === 'image') {
        if (imagePreview) {
          // Convert to base64 for backend
          body.image_base64 = imagePreview
          body.ingredients = ['detect from image']
        } else {
          toast.error('Please upload a food image first')
          setLoading(false)
          return
        }
      }

      setSteps(s => [...s, '🥘 Checking your pantry...'])
      await new Promise(r => setTimeout(r, 300))
      setSteps(s => [...s, '💪 Analyzing health profile...'])
      await new Promise(r => setTimeout(r, 300))
      setSteps(s => [...s, '🔍 Finding similar recipes...'])
      await new Promise(r => setTimeout(r, 300))
      setSteps(s => [...s, '👨‍🍳 Crafting your recipe...'])

      const res = await recipesApi.generate(body)
      setRecipe(res.data)
      setSteps(s => [...s, '✅ Recipe ready!'])
      toast.success('Recipe generated! 🎉')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Generation failed — try again')
      setSteps(s => [...s, '❌ ' + (err.response?.data?.detail || 'Error')])
    } finally { setLoading(false) }
  }

  function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB')
      return
    }
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 fade-up">
      <div>
        <h1 className="text-2xl font-bold">Generate Recipe</h1>
        <p className="text-gray-500 text-sm mt-1">Tell us what you have, and we&apos;ll craft the perfect meal for you.</p>
      </div>

      {/* Tabs */}
      <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-white">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition ${tab === t.id ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl p-6 border border-gray-100">
        {tab === 'ingredients' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Enter Ingredients (comma-separated)</label>
            <textarea
              value={ingredients} onChange={e => setIngredients(e.target.value)}
              placeholder="e.g. chicken, garlic, onion, tomatoes..."
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500 transition resize-none h-28"
            />

            {/* Pantry Quick-Add */}
            {pantryItems.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold text-gray-500 mb-1.5">🗄️ From My Pantry — click to add:</p>
                <div className="flex flex-wrap gap-1.5">
                  {pantryItems.slice(0, 20).map((item: any) => (
                    <button key={item.id} type="button"
                      onClick={() => {
                        const existing = ingredients.trim()
                        setIngredients(existing ? `${existing}, ${item.name}` : item.name)
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                        ingredients.includes(item.name)
                          ? 'bg-brand-100 border-brand-300 text-brand-700'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-brand-50 hover:border-brand-200'
                      }`}>
                      {item.name}
                      <span className="ml-1 text-gray-400">{item.quantity}{item.unit}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1 mt-1.5">
              💡 Whatever you type here overrides your dietary 
              preferences. Type chicken to get a real chicken 
              recipe even if your profile is vegetarian.
            </p>
          </div>
        )}
        {tab === 'name' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Meal Name</label>
            <input
              value={mealName} onChange={e => setMealName(e.target.value)}
              placeholder="e.g. Chicken Biryani, Butter Chicken, Dal Makhani..."
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500 transition"
            />
            <p className="text-xs text-gray-400 mt-1.5">Type any dish name and AI will generate the recipe</p>
          </div>
        )}
        {tab === 'image' && (
          <div className="space-y-3">
            <div
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 text-center cursor-pointer transition ${dragOver ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-300'} ${imagePreview ? 'p-4' : 'p-10'}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const file = e.dataTransfer.files[0]
                if (file) handleImageFile(file)
              }}
            >
              {imagePreview ? (
                <div className="relative w-full">
                  <img 
                    src={imagePreview} 
                    alt="Food preview"
                    className="w-full max-h-48 object-cover rounded-lg"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setImageFile(null)
                      setImagePreview(null)
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-600">
                    ✕
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    {imageFile?.name}
                  </p>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                    <Upload className="w-7 h-7 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Drop a food photo here</p>
                    <p className="text-xs text-gray-400 mt-1">or click to browse from your folder</p>
                    <p className="text-xs text-gray-300 mt-0.5">JPG, PNG, WEBP up to 10MB</p>
                  </div>
                </>
              )}
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageFile(file)
              }}
            />
            
            {imagePreview && (
              <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
                ✅ Image ready — click Generate Recipe and AI will detect ingredients from it
              </p>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-5 border border-gray-100 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Cuisine</label>
            <select value={cuisine} onChange={e => setCuisine(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500">
              {CUISINES.map(c => <option key={c} value={c}>{c === 'any' ? 'Any Cuisine' : c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Meal Type</label>
            <select value={mealType} onChange={e => setMealType(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500">
              {['breakfast','lunch','dinner','snack'].map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Max Time (min)</label>
            <input type="number" value={maxTime} onChange={e => setMaxTime(+e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500" />
          </div>
        </div>
        <div className="flex items-center justify-between py-2 border-t border-gray-100">
          <span className="text-sm text-gray-700">Prefer recipes using expiring pantry items</span>
          <button type="button" onClick={() => setPreferExpiring(!preferExpiring)}
            className={`w-11 h-6 rounded-full relative transition ${preferExpiring ? 'bg-brand-500' : 'bg-gray-200'}`}>
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${preferExpiring ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Generate Button */}
      <button id="generate-btn" onClick={generate} disabled={loading}
        className="w-full btn-primary py-3.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
        {loading ? (
          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full spin-slow" /> Generating...</>
        ) : (
          <><Sparkles className="w-4 h-4" /> Generate Recipe</>
        )}
      </button>

      {/* Steps */}
      {steps.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-gray-600 fade-up">
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* Result */}
      {recipe && (
        <div className="bg-white rounded-xl overflow-hidden border border-gray-100 space-y-5 fade-up">
          {/* Hero image */}
          <div className="h-52 relative bg-gradient-to-br from-brand-100 to-green-50">
            <img src={recipeImage(recipe.title)} alt={recipe.title}
              className="w-full h-full object-cover" onError={(e: any) => { e.target.style.display = 'none' }} />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-5">
              <h2 className="text-xl font-bold text-white">{recipe.title}</h2>
              {recipe.hindi_name && <p className="text-green-200 text-sm">{recipe.hindi_name}</p>}
              <div className="flex gap-3 mt-2">
                {(recipe.health_tags || []).slice(0, 4).map((t: string) => (
                  <span key={t} className="bg-white/20 text-white px-2 py-0.5 rounded text-[10px] font-medium backdrop-blur-sm">{t}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <p className="text-gray-500 text-sm">{recipe.description}</p>

            <div className="grid grid-cols-4 gap-3">
              {[
                { l: 'Calories', v: `${recipe.nutrition?.calories || 0}`, c: 'text-orange-500' },
                { l: 'Protein', v: `${recipe.nutrition?.protein_g || 0}g`, c: 'text-brand-500' },
                { l: 'Carbs', v: `${recipe.nutrition?.carbs_g || 0}g`, c: 'text-gold-500' },
                { l: 'Fat', v: `${recipe.nutrition?.fat_g || 0}g`, c: 'text-red-400' },
              ].map(n => (
                <div key={n.l} className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className={`text-xl font-bold ${n.c}`}>{n.v}</div>
                  <div className="text-[10px] text-gray-400 mt-1">{n.l}</div>
                </div>
              ))}
            </div>

            {recipe && (
              <div className="space-y-2">
                <button
                  onClick={async () => {
                    const currentToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : token
                    try {
                      const res = await fetch(`${API_URL}/recipes/${recipe.id}/cooked`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentToken}` },
                        body: JSON.stringify({ meal_type: mealType })
                      })
                      if (res.ok) {
                        toast.success('Cooked! Added to AI Memory & Daily Tracker ✅')
                      } else {
                        toast.error('Failed to log cooked meal')
                      }
                    } catch (e) {
                      toast.error('Error logging cooked meal')
                    }
                  }}
                  className="w-full bg-brand-500 hover:bg-brand-600 text-white rounded-xl py-3 text-sm font-semibold transition flex items-center justify-center gap-2 shadow-sm">
                  I Cooked This (Log & Save to Memory)
                </button>
                <button
                  onClick={async () => {
                    const currentToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : token
                    try {
                      await fetch(`${API_URL}/recipes/${recipe.id}/save`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${currentToken}` }
                      })
                      toast.success('Recipe saved for later!')
                    } catch (e) {
                      toast.error('Failed to save recipe')
                    }
                  }}
                  className="w-full border-2 border-brand-500 text-brand-600 rounded-xl py-2 text-sm font-semibold hover:bg-brand-50 transition flex items-center justify-center gap-2">
                  Bookmark for Later
                </button>
                {/* Action buttons row */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={async () => {
                      const currentToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : token
                      setGroceryLoading(true)
                      setShowGrocery(true)
                      try {
                        const res = await fetch(API_URL + '/recipes/extras/grocery-list', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
                          body: JSON.stringify({
                            recipe_title: recipe.title,
                            ingredients: recipe.ingredients || []
                          })
                        })
                        const json = await res.json()
                        if (json.success) setGroceryList(json.data)
                      } catch { toast.error('Could not generate grocery list') }
                      finally { setGroceryLoading(false) }
                    }}
                    className="py-2.5 text-xs font-medium rounded-xl bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition flex items-center justify-center gap-1">
                    <ShoppingCart className="w-3.5 h-3.5" /> Grocery List
                  </button>
                  <button
                    onClick={() => window.open(`/cook?recipe=${encodeURIComponent(recipe.title)}`, '_blank')}
                    className="py-2.5 text-xs font-medium rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition flex items-center justify-center gap-1">
                    <Mic className="w-3.5 h-3.5" /> Voice Cook
                  </button>
                  <button
                    onClick={() => setShowSubPanel(!showSubPanel)}
                    className="py-2.5 text-xs font-medium rounded-xl bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition flex items-center justify-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5" /> Substitute
                  </button>
                </div>

                {/* Smart Substitution Panel */}
                {showSubPanel && (
                  <div className="bg-purple-50 rounded-xl p-4 border border-purple-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-purple-800">🔄 Smart Ingredient Substitution</p>
                      <button onClick={() => { setShowSubPanel(false); setSubResult(null) }}>
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={subIngredient}
                        onChange={e => setSubIngredient(e.target.value)}
                        placeholder="I don't have... (e.g. butter, cream, eggs)"
                        className="flex-1 border border-purple-200 rounded-lg px-3 py-2 text-sm outline-none bg-white"
                      />
                      <button
                        onClick={async () => {
                          if (!subIngredient.trim()) return
                          const currentToken = typeof window !== 'undefined' ? localStorage.getItem('access_token') : token
                          setSubLoading(true)
                          setSubResult(null)
                          try {
                            const res = await fetch(API_URL + '/recipes/extras/substitute', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentToken}` },
                              body: JSON.stringify({ ingredient: subIngredient, recipe_context: recipe.title })
                            })
                            const json = await res.json()
                            if (json.success) setSubResult(json.data)
                          } catch { toast.error('Substitution failed') }
                          finally { setSubLoading(false) }
                        }}
                        disabled={subLoading}
                        className="bg-purple-600 text-white px-4 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 transition">
                        {subLoading ? '...' : 'Find'}
                      </button>
                    </div>
                    {subResult && (
                      <div className="space-y-2">
                        {subResult.substitutes?.map((s: any, i: number) => (
                          <div key={i} className="bg-white rounded-lg p-3 border border-purple-100">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className="text-sm font-semibold">{s.name}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                s.availability === 'easy' ? 'bg-green-100 text-green-700' :
                                s.availability === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-600'
                              }`}>{s.availability}</span>
                            </div>
                            <p className="text-xs text-purple-600 font-medium">{s.ratio}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{s.taste_impact}</p>
                          </div>
                        ))}
                        {subResult.tip && <p className="text-xs text-gray-500 italic">💡 {subResult.tip}</p>}
                      </div>
                    )}
                  </div>
                )}

                {/* Grocery List Modal */}
                {showGrocery && (
                  <div className="bg-green-50 rounded-xl p-4 border border-green-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-green-800">🛒 Grocery List: {recipe.title}</p>
                      <button onClick={() => setShowGrocery(false)}><X className="w-4 h-4 text-gray-400" /></button>
                    </div>
                    {groceryLoading ? (
                      <div className="flex items-center gap-2 text-green-600 text-sm">
                        <div className="w-4 h-4 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
                        Generating smart grocery list...
                      </div>
                    ) : groceryList ? (
                      <>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto">
                          {groceryList.grocery_list?.map((item: any, i: number) => (
                            <div key={i} className="bg-white rounded-lg px-3 py-2 flex items-center justify-between border border-green-100">
                              <div>
                                <p className="text-sm font-medium">{item.item}</p>
                                {item.can_substitute && <p className="text-[10px] text-gray-400">Alt: {item.can_substitute}</p>}
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-semibold text-green-700">{item.quantity} {item.unit}</p>
                                {item.estimated_cost_inr && <p className="text-[10px] text-gray-400">₹{item.estimated_cost_inr}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-green-200">
                          <p className="text-sm font-bold text-green-800">
                            Est. Total: ₹{groceryList.total_estimated_cost_inr}
                          </p>
                          <button
                            onClick={() => {
                              const text = groceryList.grocery_list?.map((i: any) => `${i.item}: ${i.quantity} ${i.unit}`).join('\n')
                              navigator.clipboard.writeText(text)
                              toast.success('Copied to clipboard!')
                            }}
                            className="text-xs text-green-600 underline">Copy list</button>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 text-xs text-gray-500">
              <span>{(recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)} min</span>
              <span>·</span>
              <span>🍽 {recipe.servings || 2} servings</span>
              <span>·</span>
              <span>🌶 {recipe.cuisine?.replace(/_/g, ' ')}</span>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-3">Ingredients</h3>
              <div className="grid grid-cols-2 gap-2">
                {recipe.ingredients?.map((i: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-2.5">
                    <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                    <span className="flex-1">{i.name} {i.hindi_name && <span className="text-gray-400">({i.hindi_name})</span>}</span>
                    <span className="text-xs text-gray-400 shrink-0">{i.amount} {i.unit}</span>
                    {i.is_expiring && <span className="text-[9px] bg-red-100 text-red-500 px-1 rounded">expiring</span>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-3">Instructions</h3>
              <div className="space-y-4">
                {recipe.instructions?.map((s: any) => (
                  <div key={s.step} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {s.step}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm leading-relaxed">{s.text}</p>
                      {s.tip && (
                        <p className="text-xs text-brand-500 mt-1 bg-brand-50 rounded px-2 py-1">
                          💡 {s.tip}
                        </p>
                      )}
                      {s.hindi_instruction && (
                        <p className="text-xs text-orange-600 mt-1 bg-orange-50 rounded px-2 py-1 font-medium">
                          🇮🇳 {s.hindi_instruction}
                        </p>
                      )}
                      {s.time_minutes > 0 && (
                         <span className="text-[10px] text-gray-400">
                           {s.time_minutes} min
                         </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {recipe.serving_suggestion && (
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                <p className="text-xs text-amber-700">🍽 <strong>Serving:</strong> {recipe.serving_suggestion}</p>
              </div>
            )}

            {recipe.storage_tip && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <p className="text-xs text-blue-700">❄️ <strong>Storage:</strong> {recipe.storage_tip}</p>
              </div>
            )}

            {recipe?.reference_search && (
              <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                <p className="text-xs text-red-700 flex items-center gap-2">
                  <span>▶️</span>
                  <strong>Watch how to make it:</strong>
                  <a 
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(recipe.reference_search)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-red-900">
                    Search on YouTube →
                  </a>
                </p>
              </div>
            )}

            {recipe.explainability_note && (
              <div className="bg-brand-50 rounded-lg p-3 border border-brand-100">
                <p className="text-xs text-brand-600"><strong>Why this recipe:</strong> {recipe.explainability_note}</p>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="font-semibold text-sm text-amber-800 mb-2">
                🍱 Had leftovers from this meal?
              </h3>
              <p className="text-xs text-amber-600 mb-3">
                Tell us what was left over and AI will suggest 
                what to cook next time with it!
              </p>
              <button
                onClick={() => setShowLeftoverModal(true)}
                className="bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-600 transition">
                + Log Leftovers
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leftover Modal */}
      {showLeftoverModal && (
        <div className="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) setShowLeftoverModal(false)
        }}>
          <div className="modal-content space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg">Log Leftovers 🍱</h3>
            <p className="text-sm text-gray-500">
              What ingredients were left after making <strong>{recipe?.title}</strong>?
            </p>
            <textarea
              value={leftoverItems}
              onChange={e => setLeftoverItems(e.target.value)}
              placeholder="e.g. 200g chicken, 1 cup rice, some curry sauce..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm h-24 outline-none focus:border-brand-500"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeftoverModal(false)}
                className="flex-1 border border-gray-200 rounded-lg py-2.5 text-sm">
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!leftoverItems.trim()) return
                  const currentToken = typeof window !== 'undefined'
                    ? localStorage.getItem('access_token')
                    : token
                  const items = leftoverItems.split(',')
                    .map((s: string) => ({
                      name: s.trim(),
                      amount: 1,
                      unit: 'portion'
                    }))
                    .filter((i: any) => i.name)
                  try {
                    const res = await fetch(
                      `${API_URL}/leftovers/log`,
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${currentToken}`
                        },
                        body: JSON.stringify({
                          recipe_name: recipe?.title || 'Unknown',
                          leftover_ingredients: items
                        })
                      }
                    )
                    const data = await res.json()
                    if (data.success) {
                      toast.success('Leftovers saved! 🍱 Check your pantry')
                      setShowLeftoverModal(false)
                      setLeftoverItems('')
                    } else {
                      toast.error('Failed to save leftovers')
                    }
                  } catch(e) {
                    toast.error('Could not connect to server')
                    console.error(e)
                  }
                }}
                className="flex-1 bg-brand-500 text-white rounded-lg py-2.5 text-sm font-medium">
                Save Leftovers
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
