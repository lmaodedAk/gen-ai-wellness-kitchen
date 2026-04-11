'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import {
  LayoutDashboard, ChefHat, Heart, ShoppingBasket,
  CalendarDays, Activity, Settings, LogOut, Leaf, BrainCircuit,
  GraduationCap, ShieldCheck, Mic
} from 'lucide-react'

const NAV = [
  { href: '/',             label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/generate',     label: 'Generate Recipe',  icon: ChefHat },
  { href: '/recipes',      label: 'My Recipes',       icon: Heart },
  { href: '/pantry',       label: 'My Pantry',        icon: ShoppingBasket },
  { href: '/meal-planner', label: 'Meal Planner',     icon: CalendarDays },
  { href: '/discover',     label: 'AI Memory',        icon: BrainCircuit },
  { href: '/tutor',        label: 'AI Tutor',         icon: GraduationCap },
  { href: '/health-ai',   label: 'Health AI',         icon: ShieldCheck },
  { href: '/cook',         label: 'Voice Cook',       icon: Mic },
  { href: '/health',       label: 'Health Stats',     icon: Activity },
  { href: '/settings',     label: 'Settings',         icon: Settings },
]

export default function Sidebar() {
  const path = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] bg-sidebar flex flex-col z-50">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/10">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-green-600 flex items-center justify-center shadow-lg shrink-0">
          <Leaf className="w-4.5 h-4.5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-black text-[12px] leading-tight">GenAI Personalized</p>
          <p className="text-brand-300 font-semibold text-[11px]">Wellness Kitchen</p>
        </div>
        <span className="ml-auto bg-gradient-to-r from-brand-400 to-green-400 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0">AI</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 mt-2 px-3 space-y-0.5 overflow-y-auto">
        {NAV.map(n => {
          const active = n.href === '/' ? path === '/' : path.startsWith(n.href)
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors
                ${active
                  ? 'bg-sidebar-active text-white'
                  : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'
                }`}
            >
              <n.icon className="w-[18px] h-[18px]" />
              {n.label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      {user && (
        <div className="border-t border-white/10 mx-3 py-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-brand-400 flex items-center justify-center text-xs font-bold text-white">
            {user.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user.name}</p>
          </div>
          <button
            onClick={() => { logout(); router.push('/login') }}
            className="text-gray-400 hover:text-white transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </aside>
  )
}
