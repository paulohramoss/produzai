import Sidebar from './Sidebar'
import { useAppStore } from '../../store/useAppStore'

// Pages
import Dashboard from '../../pages/Dashboard'
import Chat from '../../pages/Chat'
import Habits from '../../pages/Habits'
import Finance from '../../pages/Finance'
import Calendar from '../../pages/Calendar'
import Investments from '../../pages/Investments'
import Goals from '../../pages/Goals'
import Reports from '../../pages/Reports'
import Settings from '../../pages/Settings'

const pageMap = {
  dashboard:   <Dashboard />,
  chat:        <Chat />,
  habits:      <Habits />,
  finance:     <Finance />,
  calendar:    <Calendar />,
  investments: <Investments />,
  goals:       <Goals />,
  reports:     <Reports />,
  settings:    <Settings />,
}

export default function Layout() {
  const { currentPage } = useAppStore()

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {pageMap[currentPage]}
      </main>
    </div>
  )
}
