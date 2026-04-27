import { useState } from 'react'
import { C, type Page } from '../data'
import { Card, Tag, Bar, Dot } from '../primitives'
import { useWebDietStore } from '../../store/useWebDietStore'
import { DietaModal } from '../DietaModal'

interface Props { connected: string[]; setPage: (p: Page) => void }

export function WebDietPage({ connected, setPage }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const wd       = useWebDietStore(s => s.data)
  const clear    = useWebDietStore(s => s.clear)
  const wdOn     = connected.includes('webdiet')

  if (!wdOn) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: C.muted }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🥗</div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Dieta não configurada</div>
        <div style={{ fontSize: 13, marginBottom: 20 }}>Configure suas metas e refeições para acompanhar sua nutrição.</div>
        <button onClick={() => setPage('integracoes')} style={{ background: C.webdiet, border: 'none', borderRadius: 10, padding: '12px 24px', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          Configurar Dieta →
        </button>
      </div>
    )
  }

  if (!wd) return null

  const meals     = [...wd.meals].sort((a, b) => a.time.localeCompare(b.time))
  const done      = meals.filter(m => m.done)
  const pending   = meals.filter(m => !m.done)
  const calEaten  = done.reduce((s, m) => s + m.cal, 0)
  const protEaten = done.reduce((s, m) => s + m.prot, 0)
  const carbEaten = done.reduce((s, m) => s + m.carb, 0)
  const fatEaten  = done.reduce((s, m) => s + m.fat, 0)
  const compliance = meals.length > 0 ? Math.round(done.length / meals.length * 100) : 0

  return (
    <>
      {editOpen && <DietaModal onClose={() => setEditOpen(false)} />}

      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🥗 WebDiet</div>
            <div style={{ fontSize: 13, color: C.muted }}>Plano alimentar e macros</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setEditOpen(true)} style={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: C.text, cursor: 'pointer' }}>
              ✏️ Editar plano
            </button>
            <Tag label="Manual · Dados locais" color={C.webdiet} />
          </div>
        </div>

        {/* Status bar */}
        <div style={{ background: `${C.webdiet}11`, border: `1px solid ${C.webdiet}33`, borderRadius: 12, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Dot color={C.green} />
          <span style={{ fontSize: 12, fontWeight: 600, color: C.green }}>Plano ativo</span>
          <span style={{ fontSize: 12, color: C.muted }}>{done.length}/{meals.length} refeições feitas hoje</span>
          <span style={{ fontSize: 12, color: C.muted }}>·</span>
          <span style={{ fontSize: 12, color: C.muted }}>Meta: {wd.goals.cal} kcal · {wd.goals.prot}g prot</span>
          <button onClick={() => setPage('dieta')} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', fontSize: 12, color: C.webdiet, cursor: 'pointer', fontWeight: 600 }}>
            Ver dieta diária →
          </button>
        </div>

        {/* Macro KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { l: 'Calorias',    cur: calEaten,  goal: wd.goals.cal,  u: 'kcal', c: C.orange },
            { l: 'Proteína',    cur: protEaten, goal: wd.goals.prot, u: 'g',    c: C.blue },
            { l: 'Carboidrato', cur: carbEaten, goal: wd.goals.carb, u: 'g',    c: C.green },
            { l: 'Gordura',     cur: fatEaten,  goal: wd.goals.fat,  u: 'g',    c: C.purple },
          ].map((m, i) => {
            const pct = m.goal > 0 ? Math.min(Math.round(m.cur / m.goal * 100), 100) : 0
            return (
              <Card key={i}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>{m.l}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: m.c, marginBottom: 2 }}>
                  {m.cur}<span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}>/{m.goal}{m.u}</span>
                </div>
                <Bar pct={pct} color={m.c} h={5} />
                <div style={{ fontSize: 10, color: C.muted, marginTop: 5 }}>{pct}%</div>
              </Card>
            )
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
          {/* Full meal list */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Plano completo</div>
              <span style={{ fontSize: 12, color: C.muted }}>{compliance}% cumprido</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <Bar pct={compliance} color={compliance >= 80 ? C.green : C.orange} h={5} />
            </div>
            {meals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: C.muted }}>
                <button onClick={() => setEditOpen(true)} style={{ background: C.webdiet, border: 'none', borderRadius: 8, padding: '10px 18px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Adicionar refeições
                </button>
              </div>
            ) : (
              meals.map(m => (
                <div key={m.id} style={{ padding: '12px', background: C.card2, borderRadius: 10, marginBottom: 6, borderLeft: `3px solid ${m.done ? C.webdiet : C.border}`, opacity: m.done ? .75 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: C.muted }}>{m.time}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, textDecoration: m.done ? 'line-through' : 'none', color: m.done ? C.muted : C.text }}>{m.name}</span>
                      {m.done && <Tag label="✓" color={C.green} />}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: C.orange }}>{m.cal} kcal</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <span style={{ fontSize: 10, color: C.blue }}>P:{m.prot}g</span>
                    <span style={{ fontSize: 10, color: C.green }}>C:{m.carb}g</span>
                    <span style={{ fontSize: 10, color: C.purple }}>G:{m.fat}g</span>
                  </div>
                  {m.items.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                      {m.items.map((item, j) => (
                        <span key={j} style={{ fontSize: 9, color: C.muted2, background: C.card, borderRadius: 4, padding: '1px 5px', border: `1px solid ${C.border}` }}>{item}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </Card>

          {/* Right sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Summary */}
            <Card style={{ background: `${C.webdiet}0D`, border: `1px solid ${C.webdiet}33` }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Resumo do plano</div>
              {[
                { l: 'Total de refeições', v: meals.length },
                { l: 'Feitas hoje',       v: done.length, c: C.green },
                { l: 'Pendentes',         v: pending.length, c: C.orange },
                { l: 'Calorias totais',   v: `${meals.reduce((s, m) => s + m.cal, 0)} kcal` },
                { l: 'Proteína total',    v: `${meals.reduce((s, m) => s + m.prot, 0)}g` },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < 4 ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ fontSize: 12, color: C.muted }}>{r.l}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: r.c ?? C.text }}>{r.v}</span>
                </div>
              ))}
            </Card>

            {/* Pending meals */}
            {pending.length > 0 && (
              <Card>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>⏳ Ainda faltam</div>
                {pending.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{m.time} · {m.name}</div>
                    </div>
                    <span style={{ fontSize: 11, color: C.orange, fontWeight: 700 }}>{m.cal} kcal</span>
                  </div>
                ))}
                <div style={{ marginTop: 10, fontSize: 12, color: C.muted }}>
                  {pending.reduce((s, m) => s + m.cal, 0)} kcal restantes
                </div>
              </Card>
            )}

            {/* Disconnect */}
            <button
              onClick={() => { clear(); setPage('integracoes') }}
              style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px', fontSize: 12, color: C.muted, cursor: 'pointer', width: '100%' }}>
              Remover plano alimentar
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
