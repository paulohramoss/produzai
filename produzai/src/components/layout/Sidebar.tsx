import {
  LayoutDashboard, MessageCircle, CheckSquare, Wallet,
  CalendarDays, TrendingUp, Star, BarChart3, Settings, Zap
} from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import type { Page } from '../../types'

const nav: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard',   label: 'Dashboard',    icon: <LayoutDashboard size={18} /> },
  { id: 'chat',        label: 'Nexus IA',     icon: <MessageCircle size={18} /> },
  { id: 'habits',      label: 'Hábitos',      icon: <CheckSquare size={18} /> },
  { id: 'finance',     label: 'Financeiro',   icon: <Wallet size={18} /> },
  { id: 'calendar',    label: 'Agenda',       icon: <CalendarDays size={18} /> },
  { id: 'investments', label: 'Investimentos',icon: <TrendingUp size={18} /> },
  { id: 'goals',       label: 'Sonhos',       icon: <Star size={18} /> },
  { id: 'reports',     label: 'Relatórios',   icon: <BarChart3 size={18} /> },
]

export default function Sidebar() {
  const { currentPage, setPage, profile } = useAppStore()

  return (
    <aside className="flex flex-col w-60 shrink-0 bg-surface-card border-r border-surface-border h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-surface-border">
        <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        <span className="font-bold text-white text-lg tracking-tight">ProduzAI</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        {nav.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => setPage(item.id)}
          >
            {item.icon}
            {item.label}
            {item.id === 'chat' && (
              <span className="ml-auto w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
            )}
          </button>
        ))}
      </nav>

      {/* User + Settings */}
      <div className="px-3 py-3 border-t border-surface-border flex flex-col gap-1">
        <button
          className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
          onClick={() => setPage('settings')}
        >
          <Settings size={18} />
          Configurações
        </button>
        <div className="flex items-center gap-3 px-3 py-2.5 mt-1">
          <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-xs font-bold text-brand-300">
            {profile.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{profile.name}</p>
            <p className="text-xs text-gray-500">Nível {profile.level} · {profile.xp.toLocaleString()} XP</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
