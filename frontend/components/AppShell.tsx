'use client'
import { useAuthStore } from '@/lib/store'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import { Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { API_URL } from '@/lib/config'

const PUBLIC = ['/login', '/register']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const router = useRouter()
  const path = usePathname()
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [showResults, setShowResults] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  async function handleSearch(q: string) {
    setSearchQuery(q)
    if (q.length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    try {
      const token = localStorage.getItem('access_token')
      const res = await fetch(
        `${API_URL}/rag/search?q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}` }}
      )
      const data = await res.json()
      if (data.success) {
        setSearchResults(data.data?.results || [])
        setShowResults(true)
      }
    } catch(e) {}
  }

  if (!mounted) return null

  if (PUBLIC.includes(path)) return <>{children}</>

  if (!user) {
    router.replace('/login')
    return null
  }

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />
      <div className="ml-[220px] flex-1 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 h-14 bg-cream/80 backdrop-blur flex items-center justify-between px-6 border-b border-gray-200/50">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              onBlur={() => setTimeout(() => setShowResults(false), 200)}
              placeholder="Search recipes, ingredients..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 
                border border-gray-200 rounded-xl text-sm 
                outline-none focus:border-brand-400 transition"
            />
            <Search className="w-4 h-4 text-gray-400 
              absolute left-3 top-3" />
            
            {showResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 
                bg-white rounded-xl shadow-lg border 
                border-gray-100 mt-1 z-50 overflow-hidden">
                {searchResults.slice(0,5).map((r: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => {
                      router.push(
                        `/generate?meal=${encodeURIComponent(
                          r.metadata?.title || searchQuery
                        )}`
                      )
                      setShowResults(false)
                      setSearchQuery('')
                    }}
                    className="w-full text-left px-4 py-3 
                      hover:bg-gray-50 border-b border-gray-50 
                      last:border-0 transition">
                    <p className="text-sm font-medium text-gray-800">
                      {r.metadata?.title || 'Recipe'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.metadata?.cuisine?.replace(/_/g,' ')} · 
                      {r.metadata?.meal_type}
                    </p>
                  </button>
                ))}
                <button
                  onClick={() => {
                    router.push(
                      `/generate?meal=${encodeURIComponent(searchQuery)}`
                    )
                    setShowResults(false)
                  }}
                  className="w-full text-left px-4 py-3 
                    bg-brand-50 text-brand-600 text-sm 
                    font-medium hover:bg-brand-100 transition">
                  Generate recipe for "{searchQuery}" →
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-xs font-bold text-white">
              {user.name[0]}
            </div>
          </div>
        </header>
        {/* Page */}
        <main className="flex-1 p-6 overflow-y-auto" style={{
          background: '#F9FAFB',
          minHeight: '100vh',
          position: 'relative',
          zIndex: 1
        }}>
          {children}
        </main>
      </div>
    </div>
  )
}
