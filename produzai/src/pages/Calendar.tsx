import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Check, X } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

const TYPE_STYLES: Record<string, string> = {
  work: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  health: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  finance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  personal: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

const TYPE_LABELS: Record<string, string> = {
  work: 'Trabalho', health: 'Saúde', finance: 'Financeiro', personal: 'Pessoal'
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function Calendar() {
  const { events, toggleEvent } = useAppStore()
  const [current, setCurrent] = useState(new Date(2026, 3, 1)) // April 2026
  const [selected, setSelected] = useState<number | null>(8)
  const [showAdd, setShowAdd] = useState(false)

  const year = current.getFullYear()
  const month = current.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1)

  const selectedDateStr = selected ? `${year}-${String(month + 1).padStart(2, '0')}-${String(selected).padStart(2, '0')}` : ''
  const dayEvents = events.filter(e => e.date === selectedDateStr)
  const allEvents = events.filter(e => e.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))

  function hasEvents(day: number) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.some(e => e.date === ds)
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="page-title">Agenda</h1>
          <p className="text-sm text-gray-500 mt-1">Calendário conectado às suas metas</p>
        </div>
        <button className="btn-primary self-start md:self-auto" onClick={() => setShowAdd(true)}><Plus size={16} /> Novo Evento</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Calendar */}
        <div className="col-span-1 md:col-span-2 card p-5">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-white text-lg">{MONTHS[month]} {year}</h2>
            <div className="flex gap-2">
              <button className="btn-ghost p-2" onClick={() => setCurrent(new Date(year, month - 1))}><ChevronLeft size={16} /></button>
              <button className="btn-ghost p-2" onClick={() => setCurrent(new Date(year, month + 1))}><ChevronRight size={16} /></button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-2">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />
              const isToday = day === 8 && month === 3
              const isSel = day === selected
              const hasEv = hasEvents(day)
              return (
                <button key={i} onClick={() => setSelected(day)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-all relative
                    ${isSel ? 'bg-brand-600 text-white' : isToday ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30' : 'text-gray-300 hover:bg-surface-hover'}`}>
                  {day}
                  {hasEv && <span className={`w-1 h-1 rounded-full mt-0.5 ${isSel ? 'bg-white' : 'bg-brand-400'}`} />}
                </button>
              )
            })}
          </div>

          {/* Month overview */}
          <div className="mt-5 pt-5 border-t border-surface-border">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Todos os eventos do mês</p>
            <div className="space-y-2">
              {allEvents.length === 0 && <p className="text-sm text-gray-600">Nenhum evento este mês.</p>}
              {allEvents.map(e => (
                <div key={e.id} className={`flex items-center gap-3 p-2.5 rounded-xl border ${TYPE_STYLES[e.type]} ${e.done ? 'opacity-50' : ''}`}>
                  <button onClick={() => toggleEvent(e.id)} className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${e.done ? 'bg-emerald-500 border-emerald-500' : 'border-current'}`}>
                    {e.done && <Check size={10} className="text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${e.done ? 'line-through' : ''}`}>{e.title}</p>
                    <p className="text-xs opacity-70">{TYPE_LABELS[e.type]} · {e.time}</p>
                  </div>
                  <span className="text-xs opacity-70">{new Date(e.date + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Selected day events */}
          <div className="card p-5">
            <p className="font-semibold text-white mb-3">
              {selected ? `Dia ${selected} de ${MONTHS[month]}` : 'Selecione um dia'}
            </p>
            {dayEvents.length === 0 && <p className="text-sm text-gray-600">Nenhum evento.</p>}
            <div className="space-y-2">
              {dayEvents.map(e => (
                <div key={e.id} className={`p-3 rounded-xl border ${TYPE_STYLES[e.type]}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{e.title}</p>
                    <button onClick={() => toggleEvent(e.id)}>
                      {e.done ? <Check size={14} /> : <span className="text-xs">○</span>}
                    </button>
                  </div>
                  <p className="text-xs opacity-70 mt-0.5">{e.time} · {TYPE_LABELS[e.type]}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Type legend */}
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Categorias</p>
            <div className="space-y-2">
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <div key={k} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${TYPE_STYLES[k]}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {v}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="card-raised p-6 w-full max-w-sm mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-white">Novo Evento</p>
              <button onClick={() => setShowAdd(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            <input className="input-field" placeholder="Título do evento" />
            <div className="grid grid-cols-2 gap-3">
              <input className="input-field" type="date" defaultValue="2026-04-08" />
              <input className="input-field" type="time" defaultValue="09:00" />
            </div>
            <select className="input-field">
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="btn-primary w-full justify-center" onClick={() => { alert('Evento criado! (demo)'); setShowAdd(false) }}>
              Criar Evento
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
