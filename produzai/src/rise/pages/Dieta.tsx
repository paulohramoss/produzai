<<<<<<< HEAD
import { useState, useRef, useEffect } from 'react'
=======
import { useState, useContext } from 'react'
>>>>>>> e189c45cca12979c14c0fe49c725a92330ce0de6
import { C, type Page } from '../data'
import { Card, Tag, Bar, Dot } from '../primitives'
import { useWebDietStore, type ComplianceStatus } from '../../store/useWebDietStore'
import { DietaModal } from '../DietaModal'
import { LayoutContext } from '../LayoutContext'

interface Props {
  setPage: (page: Page) => void
}

const COMPLIANCE_OPTIONS: { status: ComplianceStatus; emoji: string; label: string; color: string }[] = [
  { status: 'perfect', emoji: '✅', label: 'Dieta perfeita',  color: C.green },
  { status: 'good',    emoji: '🟡', label: 'Segui ~90%',      color: C.orange },
  { status: 'alcohol', emoji: '🍺', label: 'Bebi álcool',     color: C.purple },
  { status: 'skipped', emoji: '❌', label: 'Não segui',        color: C.red },
]

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short' })
}

export function Dieta({ setPage: _setPage }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const { isMobile } = useContext(LayoutContext)

  const wd          = useWebDietStore(s => s.data)
  const toggleMeal  = useWebDietStore(s => s.toggleMeal)
  const pdfBase64   = useWebDietStore(s => s.pdfBase64)
  const pdfName     = useWebDietStore(s => s.pdfName)
  const setPdf      = useWebDietStore(s => s.setPdf)
  const removePdf   = useWebDietStore(s => s.removePdf)
  const compliance  = useWebDietStore(s => s.compliance)
  const logCompliance = useWebDietStore(s => s.logCompliance)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const today = getTodayStr()
  const todayLog = compliance.find(c => c.date === today)

  const [editing, setEditing]             = useState(false)
  const [pendingStatus, setPendingStatus] = useState<ComplianceStatus | null>(null)
  const [pendingNote, setPendingNote]     = useState('')

  useEffect(() => {
    setEditing(false)
    setPendingStatus(null)
    setPendingNote('')
  }, [today])

  const showForm = !todayLog || editing

  function handleEdit() {
    setPendingStatus(todayLog!.status)
    setPendingNote(todayLog!.note ?? '')
    setEditing(true)
  }

  function handleSaveCompliance() {
    if (!pendingStatus) return
    logCompliance({ date: today, status: pendingStatus, note: pendingNote })
    setEditing(false)
    setPendingStatus(null)
    setPendingNote('')
  }

  function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (file.size > 5 * 1024 * 1024) {
      alert('PDF muito grande. Tente um arquivo menor que 5MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setPdf(result.split(',')[1], file.name)
    }
    reader.readAsDataURL(file)
  }

  const doneMeals = wd?.meals.filter(m => m.done) ?? []
  const cur = {
    cal:  doneMeals.reduce((s, m) => s + m.cal,  0),
    prot: doneMeals.reduce((s, m) => s + m.prot, 0),
    carb: doneMeals.reduce((s, m) => s + m.carb, 0),
    fat:  doneMeals.reduce((s, m) => s + m.fat,  0),
  }
  const goals = wd?.goals ?? { cal: 0, prot: 0, carb: 0, fat: 0 }
  const sortedMeals = [...(wd?.meals ?? [])].sort((a, b) => a.time.localeCompare(b.time))

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  const pdfSrc = pdfBase64 ? `data:application/pdf;base64,${pdfBase64}` : null

  return (
    <>
      {editOpen && wd && <DietaModal onClose={() => setEditOpen(false)} />}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={handlePdfUpload}
      />

      <div>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🥗 Dieta & Nutrição</div>
            <div style={{ fontSize: 13, color: C.muted }}>Plano alimentar personalizado</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ background: pdfBase64 ? `${C.blue}22` : C.card2, border: `1px solid ${pdfBase64 ? C.blue : C.border2}`, borderRadius: 8, padding: "8px 14px", color: pdfBase64 ? C.blue : C.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              📎 {pdfBase64 ? 'Trocar PDF' : 'Anexar PDF'}
            </button>
            {wd ? (
              <>
                <button
                  onClick={() => setEditOpen(true)}
                  style={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 8, padding: "8px 14px", color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  ✏️ Editar plano
                </button>
                <Tag label="Plano ativo" color={C.green} />
              </>
            ) : (
              <button
                onClick={() => setEditOpen(true)}
                style={{ background: C.green, border: "none", borderRadius: 8, padding: "8px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                + Configurar dieta
              </button>
            )}
          </div>
        </div>

        {/* Macros KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
          {[
            { l: "Calorias",    cur: cur.cal,  goal: goals.cal,  unit: "kcal", c: C.orange },
            { l: "Proteína",    cur: cur.prot, goal: goals.prot, unit: "g",    c: C.blue },
            { l: "Carboidrato", cur: cur.carb, goal: goals.carb, unit: "g",    c: C.green },
            { l: "Gordura",     cur: cur.fat,  goal: goals.fat,  unit: "g",    c: C.purple },
          ].map((m, i) => (
            <Card key={i} style={{ opacity: wd ? 1 : .5 }}>
              <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: .8 }}>{m.l}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "8px 0 6px" }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: wd ? m.c : C.muted }}>
                  {wd ? m.cur : "—"}
                </span>
                {wd && m.goal > 0 && (
                  <span style={{ fontSize: 12, color: C.muted }}>/ {m.goal} {m.unit}</span>
                )}
              </div>
              <Bar pct={wd && m.goal > 0 ? Math.min(Math.round(m.cur / m.goal * 100), 100) : 0} color={m.c} />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>
                {wd && m.goal > 0 ? `${Math.round(m.cur / m.goal * 100)}% da meta` : "Configure a dieta"}
              </div>
            </Card>
          ))}
        </div>

<<<<<<< HEAD
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 16 }}>
=======
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1fr", gap: 16 }}>
>>>>>>> e189c45cca12979c14c0fe49c725a92330ce0de6
          {/* Meal plan */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Plano alimentar do dia</div>
              {wd && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: C.muted }}>{doneMeals.length}/{wd.meals.length} feitas</span>
                  <Tag label="Manual" color={C.green} />
                </div>
              )}
            </div>

            {wd ? (
              sortedMeals.length > 0 ? sortedMeals.map(m => (
                <div
                  key={m.id}
                  onClick={() => toggleMeal(m.id)}
                  style={{ padding: "14px", background: C.card2, borderRadius: 12, marginBottom: 8, borderLeft: `3px solid ${m.done ? C.green : C.border}`, opacity: m.done ? .7 : 1, cursor: "pointer", transition: "opacity .15s, border-color .15s" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, color: C.muted }}>{m.time}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, textDecoration: m.done ? "line-through" : "none", color: m.done ? C.muted : C.text }}>{m.name}</span>
                      {m.done && <Tag label="✓ feito" color={C.green} />}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.orange }}>{m.cal} kcal</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, marginBottom: m.items.length > 0 ? 8 : 0 }}>
                    <span style={{ fontSize: 11, color: C.blue }}>🥩 {m.prot}g</span>
                    <span style={{ fontSize: 11, color: C.green }}>🌾 {m.carb}g</span>
                    <span style={{ fontSize: 11, color: C.purple }}>🫒 {m.fat}g</span>
                  </div>
                  {m.items.length > 0 && (
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {m.items.map((item, j) => (
                        <span key={j} style={{ fontSize: 10, color: C.muted2, background: C.card, borderRadius: 4, padding: "2px 6px", border: `1px solid ${C.border}` }}>{item}</span>
                      ))}
                    </div>
                  )}
                </div>
              )) : (
                <div style={{ textAlign: "center", padding: "24px 0", color: C.muted }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🍽️</div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Nenhuma refeição ainda</div>
                  <div style={{ fontSize: 13 }}>Clique em "Editar plano" para adicionar suas refeições</div>
                  <button
                    onClick={() => setEditOpen(true)}
                    style={{ marginTop: 12, background: C.green, border: "none", borderRadius: 8, padding: "9px 18px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Adicionar refeições
                  </button>
                </div>
              )
            ) : (
              <div style={{ textAlign: "center", padding: "32px 0", color: C.muted }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🥗</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Nenhum plano configurado</div>
                <div style={{ fontSize: 13 }}>Configure sua dieta para acompanhar as refeições e macros</div>
                <button
                  onClick={() => setEditOpen(true)}
                  style={{ marginTop: 14, background: C.green, border: "none", borderRadius: 8, padding: "10px 20px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Configurar Dieta
                </button>
              </div>
            )}
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Hydration (static for now) */}
            <Card style={{ opacity: wd ? 1 : .5 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Hidratação</div>
              <div style={{ textAlign: "center", margin: "8px 0" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: C.blue }}>2,4L</div>
                <div style={{ fontSize: 12, color: C.muted }}>de 3,5L · 69%</div>
              </div>
              <Bar pct={69} color={C.blue} h={8} />
            </Card>

            {/* Check-in de hoje */}
            <Card>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>📋 Check-in de hoje</div>

              {!showForm && todayLog ? (
                <div>
                  {(() => {
                    const opt = COMPLIANCE_OPTIONS.find(o => o.status === todayLog.status)!
                    return (
                      <div style={{ padding: "12px 14px", background: `${opt.color}18`, borderRadius: 10, border: `1px solid ${opt.color}33`, marginBottom: 8 }}>
                        <div style={{ fontSize: 22, marginBottom: 4 }}>{opt.emoji}</div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: opt.color }}>{opt.label}</div>
                        {todayLog.note && <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>{todayLog.note}</div>}
                      </div>
                    )
                  })()}
                  <button
                    onClick={handleEdit}
                    style={{ width: "100%", background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 8, padding: "7px", fontSize: 12, color: C.muted, cursor: "pointer" }}>
                    Editar
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                    {COMPLIANCE_OPTIONS.map(opt => (
                      <button
                        key={opt.status}
                        onClick={() => setPendingStatus(opt.status)}
                        style={{
                          padding: "10px 6px",
                          borderRadius: 8,
                          border: `1px solid ${pendingStatus === opt.status ? opt.color : C.border}`,
                          background: pendingStatus === opt.status ? `${opt.color}20` : C.card2,
                          cursor: "pointer",
                          textAlign: "center",
                          transition: "all .15s",
                        }}>
                        <div style={{ fontSize: 18 }}>{opt.emoji}</div>
                        <div style={{ fontSize: 10, color: pendingStatus === opt.status ? opt.color : C.muted, fontWeight: 600, marginTop: 3, lineHeight: 1.3 }}>{opt.label}</div>
                      </button>
                    ))}
                  </div>
                  {pendingStatus && (
                    <>
                      <input
                        placeholder="Nota opcional..."
                        value={pendingNote}
                        onChange={e => setPendingNote(e.target.value)}
                        style={{ width: "100%", background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 12, marginBottom: 8, boxSizing: "border-box", outline: "none" }}
                      />
                      <button
                        onClick={handleSaveCompliance}
                        style={{ width: "100%", background: C.green, border: "none", borderRadius: 8, padding: "9px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        Salvar check-in
                      </button>
                    </>
                  )}
                  {!pendingStatus && (
                    <div style={{ textAlign: "center", fontSize: 12, color: C.muted, padding: "6px 0" }}>
                      Como foi sua alimentação hoje?
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Status card */}
            {wd && (
              <Card style={{ background: `${C.green}11`, border: `1px solid ${C.green}33` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Dot color={C.green} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.green }}>Plano configurado</span>
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>{wd.meals.length} refeições · {doneMeals.length} concluídas</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Meta: {goals.cal} kcal · {goals.prot}g prot</div>
                <button
                  onClick={() => setEditOpen(true)}
                  style={{ marginTop: 12, width: "100%", background: C.card2, border: `1px solid ${C.border2}`, borderRadius: 8, padding: "8px", fontSize: 12, fontWeight: 600, color: C.text, cursor: "pointer" }}>
                  ✏️ Editar plano
                </button>
              </Card>
            )}

            {/* Progress summary */}
            {wd && goals.cal > 0 && (
              <Card>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Progresso hoje</div>
                {[
                  { l: "Calorias", cur: cur.cal, goal: goals.cal, c: C.orange, u: "kcal" },
                  { l: "Proteína", cur: cur.prot, goal: goals.prot, c: C.blue, u: "g" },
                ].map((m, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginBottom: 4 }}>
                      <span>{m.l}</span>
                      <span style={{ color: m.c }}>{m.cur}/{m.goal}{m.u}</span>
                    </div>
                    <Bar pct={m.goal > 0 ? Math.min(Math.round(m.cur / m.goal * 100), 100) : 0} color={m.c} h={5} />
                  </div>
                ))}
              </Card>
            )}
          </div>
        </div>

        {/* PDF Viewer */}
        {pdfSrc ? (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>📄</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{pdfName}</span>
                <Tag label="Plano PDF" color={C.blue} />
              </div>
              <button
                onClick={removePdf}
                style={{ background: "transparent", border: `1px solid ${C.border2}`, borderRadius: 6, padding: "4px 10px", color: C.muted, fontSize: 12, cursor: "pointer" }}>
                ✕ Remover
              </button>
            </div>
            <iframe
              src={pdfSrc}
              width="100%"
              height="640"
              style={{ border: "none", borderRadius: 8, background: C.card2 }}
              title={pdfName ?? 'Plano alimentar'}
            />
          </Card>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{ border: `2px dashed ${C.border2}`, borderRadius: 12, padding: "32px 20px", textAlign: "center", cursor: "pointer", transition: "border-color .15s", marginBottom: 16 }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = C.blue)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = C.border2)}
          >
            <div style={{ fontSize: 36, marginBottom: 10 }}>📎</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: C.text }}>Anexar plano alimentar em PDF</div>
            <div style={{ fontSize: 12, color: C.muted }}>Clique para selecionar o PDF do seu nutricionista · máx. 5MB</div>
          </div>
        )}

        {/* Compliance History */}
        {compliance.length > 0 && (
          <Card>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>📊 Histórico de compliance (7 dias)</div>
            <div style={{ display: "flex", gap: 8 }}>
              {last7.map(date => {
                const log = compliance.find(c => c.date === date)
                const opt = log ? COMPLIANCE_OPTIONS.find(o => o.status === log.status) : null
                const isToday = date === today
                return (
                  <div
                    key={date}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "10px 4px",
                      borderRadius: 10,
                      background: isToday ? `${C.blue}12` : C.card2,
                      border: `1px solid ${isToday ? C.blue + '44' : C.border}`,
                    }}
                  >
                    <div style={{ fontSize: 20, marginBottom: 5, opacity: log ? 1 : 0.2 }}>
                      {opt ? opt.emoji : '○'}
                    </div>
                    <div style={{ fontSize: 10, color: isToday ? C.blue : C.muted, fontWeight: isToday ? 700 : 400 }}>
                      {dayLabel(date)}
                    </div>
                    {isToday && <div style={{ fontSize: 9, color: C.blue, marginTop: 2 }}>hoje</div>}
                  </div>
                )
              })}
            </div>
            {(() => {
              const total = last7.filter(d => compliance.find(c => c.date === d)).length
              const perfect = last7.filter(d => compliance.find(c => c.date === d && c.status === 'perfect')).length
              const good = last7.filter(d => compliance.find(c => c.date === d && (c.status === 'perfect' || c.status === 'good'))).length
              return (
                <div style={{ display: "flex", gap: 16, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{perfect}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>perfeitos</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.orange }}>{good}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>≥90%</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.blue }}>{total}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>registrados</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{total > 0 ? Math.round(good / total * 100) : 0}%</div>
                    <div style={{ fontSize: 10, color: C.muted }}>aderência</div>
                  </div>
                </div>
              )
            })()}
          </Card>
        )}
      </div>
    </>
  )
}
