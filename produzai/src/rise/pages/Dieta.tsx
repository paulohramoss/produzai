import { useState, useRef, useEffect, useContext } from 'react'
import { T, C, type Page, displayStyle } from '../data'
import { BarChart3, ClipboardList, Utensils, ShoppingCart } from 'lucide-react'
import { Card, Tag, Bar, Dot } from '../primitives'
import { useWebDietStore, type ComplianceStatus } from '../../store/useWebDietStore'
import { DietaModal } from '../DietaModal'
import { LayoutContext } from '../LayoutContext'
import { parsePdfDiet, estimateMealMacros } from '../../lib/anthropic'
import { WaterCard } from '../components/WaterCard'
import { ShoppingListModal } from '../components/ShoppingListModal'
import { todayKey as localTodayKey } from '../../lib/date'

interface Props {
  setPage: (page: Page) => void
}

const COMPLIANCE_OPTIONS: { status: ComplianceStatus; emoji: string; label: string; color: string }[] = [
  { status: 'perfect', emoji: '✅', label: 'Dieta perfeita',  color: C.green },
  { status: 'good',    emoji: '🟡', label: 'Segui ~90%',      color: C.orange },
  { status: 'alcohol', emoji: '🍺', label: 'Bebi álcool',     color: C.purple },
  { status: 'skipped', emoji: '❌', label: 'Não segui',        color: C.red },
]

const getTodayStr = localTodayKey

function dayLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short' })
}

export function Dieta({ setPage: _setPage }: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [shoppingOpen, setShoppingOpen] = useState(false)
  const { isMobile } = useContext(LayoutContext)

  const wd          = useWebDietStore(s => s.data)
  const toggleMeal  = useWebDietStore(s => s.toggleMeal)
  const pdfBase64   = useWebDietStore(s => s.pdfBase64)
  const pdfName     = useWebDietStore(s => s.pdfName)
  const setPdf      = useWebDietStore(s => s.setPdf)
  const removePdf   = useWebDietStore(s => s.removePdf)
  const compliance  = useWebDietStore(s => s.compliance)
  const logCompliance = useWebDietStore(s => s.logCompliance)

  const setup      = useWebDietStore(s => s.setup)
  const updateMeal = useWebDietStore(s => s.updateMeal)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const today = getTodayStr()
  const todayLog = compliance.find(c => c.date === today)

  const [editing, setEditing]             = useState(false)
  const [pendingStatus, setPendingStatus] = useState<ComplianceStatus | null>(null)
  const [pendingNote, setPendingNote]     = useState('')
  const [parsing, setParsing]             = useState(false)
  const [parseError, setParseError]       = useState<string | null>(null)
  const [calcingId, setCalcingId]         = useState<string | null>(null)

  async function handleCalcMacros(e: React.MouseEvent, mealId: string, items: string[]) {
    e.stopPropagation()
    setCalcingId(mealId)
    const result = await estimateMealMacros(items)
    setCalcingId(null)
    if (result) updateMeal(mealId, result)
  }

  async function handleImportPdf() {
    if (!pdfBase64) return
    setParsing(true)
    setParseError(null)
    try {
      const result = await parsePdfDiet(pdfBase64)
      if (result) {
        setup(result.goals, result.meals)
      } else {
        setParseError('Não foi possível extrair as refeições. Tente adicionar manualmente.')
      }
    } catch {
      setParseError('Erro ao processar o PDF.')
    } finally {
      setParsing(false)
    }
  }

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
        {shoppingOpen && <ShoppingListModal onClose={() => setShoppingOpen(false)} />}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: T.text['5xl'], fontWeight: T.weight.extrabold, marginBottom: 4, ...displayStyle }}><Utensils size={20} color={C.orange} /> Dieta & Nutrição</div>
            <div style={{ fontSize: T.text.md, color: C.muted }}>Plano alimentar personalizado</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {wd && wd.meals.length > 0 && (
              <button
                onClick={() => setShoppingOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: `${C.green}1F`, border: `1px solid ${C.green}55`, borderRadius: T.radius.sm, padding: "8px 14px", color: C.green, fontSize: T.text.md, fontWeight: T.weight.bold, cursor: "pointer" }}>
                <ShoppingCart size={14} /> Lista de compras
              </button>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ background: pdfBase64 ? `${C.blue}22` : C.card2, border: `1px solid ${pdfBase64 ? C.blue : C.border2}`, borderRadius: T.radius.sm, padding: "8px 14px", color: pdfBase64 ? C.blue : C.text, fontSize: T.text.md, fontWeight: T.weight.semibold, cursor: "pointer" }}>
              📎 {pdfBase64 ? 'Trocar PDF' : 'Anexar PDF'}
            </button>
            {wd ? (
              <>
                <button
                  onClick={() => setEditOpen(true)}
                  style={{ background: C.card2, border: `1px solid ${C.border2}`, borderRadius: T.radius.sm, padding: "8px 14px", color: C.text, fontSize: T.text.md, fontWeight: T.weight.semibold, cursor: "pointer" }}>
                  ✏️ Editar plano
                </button>
                <Tag label="Plano ativo" color={C.green} />
              </>
            ) : (
              <button
                onClick={() => setEditOpen(true)}
                style={{ background: C.green, border: "none", borderRadius: T.radius.sm, padding: "8px 16px", color: "#fff", fontSize: T.text.md, fontWeight: T.weight.bold, cursor: "pointer" }}>
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
              <div style={{ fontSize: T.text.xs, color: C.muted, textTransform: "uppercase", letterSpacing: .8 }}>{m.l}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, margin: "8px 0 6px" }}>
                <span style={{ fontSize: T.text['5xl'], fontWeight: T.weight.extrabold, color: wd ? m.c : C.muted, ...displayStyle }}>
                  {wd ? m.cur : "—"}
                </span>
                {wd && m.goal > 0 && (
                  <span style={{ fontSize: T.text.base, color: C.muted }}>/ {m.goal} {m.unit}</span>
                )}
              </div>
              <Bar pct={wd && m.goal > 0 ? Math.min(Math.round(m.cur / m.goal * 100), 100) : 0} color={m.c} />
              <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 5 }}>
                {wd && m.goal > 0 ? `${Math.round(m.cur / m.goal * 100)}% da meta` : "Configure a dieta"}
              </div>
            </Card>
          ))}
        </div>

        {/* PDF Attachment */}
        {pdfSrc ? (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, background: `${C.blue}18`, borderRadius: T.radius.sm, display: "flex", alignItems: "center", justifyContent: "center", fontSize: T.text['3xl'], flexShrink: 0 }}>📄</div>
                <div>
                  <div style={{ fontWeight: T.weight.bold, fontSize: T.text.md, color: C.text }}>{pdfName}</div>
                  <div style={{ fontSize: T.text.sm, color: C.muted }}>Plano alimentar em PDF</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={handleImportPdf}
                  disabled={parsing}
                  style={{ background: parsing ? C.card2 : `${C.green}18`, border: `1px solid ${parsing ? C.border2 : C.green + '44'}`, borderRadius: T.radius.sm, padding: "6px 14px", color: parsing ? C.muted : C.green, fontSize: T.text.base, fontWeight: T.weight.semibold, cursor: parsing ? "not-allowed" : "pointer" }}>
                  {parsing ? '⏳ Analisando...' : '✨ Importar refeições'}
                </button>
                <button
                  onClick={() => { const a = document.createElement('a'); a.href = pdfSrc!; a.target = '_blank'; a.click() }}
                  style={{ background: `${C.blue}18`, border: `1px solid ${C.blue}44`, borderRadius: T.radius.sm, padding: "6px 14px", color: C.blue, fontSize: T.text.base, fontWeight: T.weight.semibold, cursor: "pointer" }}>
                  Abrir PDF
                </button>
                <button
                  onClick={removePdf}
                  style={{ background: "transparent", border: `1px solid ${C.border2}`, borderRadius: T.radius.sm, padding: "6px 10px", color: C.muted, fontSize: T.text.base, cursor: "pointer" }}>
                  ✕
                </button>
              </div>
            </div>
            {parseError && (
              <div style={{ marginTop: 8, fontSize: T.text.sm, color: C.red }}>{parseError}</div>
            )}
          </Card>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{ display: "flex", alignItems: "center", gap: 12, border: `2px dashed ${C.border2}`, borderRadius: T.radius.lg, padding: "14px 20px", cursor: "pointer", transition: "border-color .15s", marginBottom: 16 }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = C.blue)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = C.border2)}
          >
            <span style={{ fontSize: T.text['5xl'] }}>📎</span>
            <div>
              <div style={{ fontWeight: T.weight.semibold, fontSize: T.text.md, color: C.text }}>Anexar plano alimentar em PDF</div>
              <div style={{ fontSize: T.text.sm, color: C.muted }}>Clique para selecionar o PDF do seu nutricionista · máx. 5MB</div>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.4fr 1fr", gap: 16, marginBottom: 16 }}>
          {/* Meal plan */}
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: T.weight.bold, fontSize: T.text.xl }}>Plano alimentar do dia</div>
              {wd && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: T.text.base, color: C.muted }}>{doneMeals.length}/{wd.meals.length} feitas</span>
                  <Tag label="Manual" color={C.green} />
                </div>
              )}
            </div>

            {wd ? (
              sortedMeals.length > 0 ? sortedMeals.map(m => (
                <div
                  key={m.id}
                  onClick={() => toggleMeal(m.id)}
                  style={{ padding: "14px", background: C.card2, borderRadius: T.radius.lg, marginBottom: 8, borderLeft: `3px solid ${m.done ? C.green : C.border}`, opacity: m.done ? .7 : 1, cursor: "pointer", transition: "opacity .15s, border-color .15s" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: T.text.sm, color: C.muted }}>{m.time}</span>
                      <span style={{ fontWeight: T.weight.bold, fontSize: T.text.lg, textDecoration: m.done ? "line-through" : "none", color: m.done ? C.muted : C.text }}>{m.name}</span>
                      {m.done && <Tag label="✓ feito" color={C.green} />}
                    </div>
                    <span style={{ fontSize: T.text.md, fontWeight: T.weight.extrabold, color: C.orange }}>{m.cal} kcal</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: m.items.length > 0 ? 8 : 0 }}>
                    <span style={{ fontSize: T.text.sm, color: C.blue }}>🥩 {m.prot}g</span>
                    <span style={{ fontSize: T.text.sm, color: C.green }}>🌾 {m.carb}g</span>
                    <span style={{ fontSize: T.text.sm, color: C.purple }}>🫒 {m.fat}g</span>
                    {m.items.length > 0 && (
                      <button
                        onClick={e => handleCalcMacros(e, m.id, m.items)}
                        disabled={calcingId === m.id}
                        style={{ marginLeft: "auto", background: calcingId === m.id ? C.card : `${C.green}18`, border: `1px solid ${calcingId === m.id ? C.border : C.green + '44'}`, borderRadius: T.radius.xs, padding: "2px 8px", color: calcingId === m.id ? C.muted : C.green, fontSize: T.text.xs, fontWeight: T.weight.semibold, cursor: calcingId === m.id ? "not-allowed" : "pointer", flexShrink: 0 }}>
                        {calcingId === m.id ? '⏳' : '✨ Calcular'}
                      </button>
                    )}
                  </div>
                  {m.items.length > 0 && (
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {m.items.map((item, j) => (
                        <span key={j} style={{ fontSize: T.text.xs, color: C.muted2, background: C.card, borderRadius: T.radius['2xs'], padding: "2px 6px", border: `1px solid ${C.border}` }}>{item}</span>
                      ))}
                    </div>
                  )}
                </div>
              )) : (
                <div style={{ textAlign: "center", padding: "24px 0", color: C.muted }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🍽️</div>
                  <div style={{ fontWeight: T.weight.semibold, marginBottom: 6 }}>Nenhuma refeição ainda</div>
                  <div style={{ fontSize: T.text.md }}>Clique em "Editar plano" para adicionar suas refeições</div>
                  <button
                    onClick={() => setEditOpen(true)}
                    style={{ marginTop: 12, background: C.green, border: "none", borderRadius: T.radius.sm, padding: "9px 18px", color: "#fff", fontSize: T.text.md, fontWeight: T.weight.bold, cursor: "pointer" }}>
                    Adicionar refeições
                  </button>
                </div>
              )
            ) : (
              <div style={{ textAlign: "center", padding: "32px 0", color: C.muted }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🥗</div>
                <div style={{ fontWeight: T.weight.semibold, marginBottom: 6 }}>Nenhum plano configurado</div>
                <div style={{ fontSize: T.text.md }}>Configure sua dieta para acompanhar as refeições e macros</div>
                <button
                  onClick={() => setEditOpen(true)}
                  style={{ marginTop: 14, background: C.green, border: "none", borderRadius: T.radius.sm, padding: "10px 20px", color: "#fff", fontSize: T.text.md, fontWeight: T.weight.bold, cursor: "pointer" }}>
                  Configurar Dieta
                </button>
              </div>
            )}
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Hidratação — mesmo card do Hoje, mesma fonte de dados */}
            <WaterCard />

            {/* Check-in de hoje */}
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.lg, marginBottom: 12, ...displayStyle }}><ClipboardList size={17} /> Check-in de hoje</div>

              {!showForm && todayLog ? (
                <div>
                  {(() => {
                    const opt = COMPLIANCE_OPTIONS.find(o => o.status === todayLog.status)!
                    return (
                      <div style={{ padding: "12px 14px", background: `${opt.color}18`, borderRadius: T.radius.md, border: `1px solid ${opt.color}33`, marginBottom: 8 }}>
                        <div style={{ fontSize: T.text['5xl'], marginBottom: 4 }}>{opt.emoji}</div>
                        <div style={{ fontWeight: T.weight.bold, fontSize: T.text.md, color: opt.color }}>{opt.label}</div>
                        {todayLog.note && <div style={{ fontSize: T.text.sm, color: C.muted, marginTop: 5 }}>{todayLog.note}</div>}
                      </div>
                    )
                  })()}
                  <button
                    onClick={handleEdit}
                    style={{ width: "100%", background: C.card2, border: `1px solid ${C.border2}`, borderRadius: T.radius.sm, padding: "7px", fontSize: T.text.base, color: C.muted, cursor: "pointer" }}>
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
                          borderRadius: T.radius.sm,
                          border: `1px solid ${pendingStatus === opt.status ? opt.color : C.border}`,
                          background: pendingStatus === opt.status ? `${opt.color}20` : C.card2,
                          cursor: "pointer",
                          textAlign: "center",
                          transition: "all .15s",
                        }}>
                        <div style={{ fontSize: T.text['3xl'] }}>{opt.emoji}</div>
                        <div style={{ fontSize: T.text.xs, color: pendingStatus === opt.status ? opt.color : C.muted, fontWeight: T.weight.semibold, marginTop: 3, lineHeight: 1.3 }}>{opt.label}</div>
                      </button>
                    ))}
                  </div>
                  {pendingStatus && (
                    <>
                      <input
                        placeholder="Nota opcional..."
                        value={pendingNote}
                        onChange={e => setPendingNote(e.target.value)}
                        style={{ width: "100%", background: C.card2, border: `1px solid ${C.border}`, borderRadius: T.radius.sm, padding: "8px 10px", color: C.text, fontSize: T.text.base, marginBottom: 8, boxSizing: "border-box", outline: "none" }}
                      />
                      <button
                        onClick={handleSaveCompliance}
                        style={{ width: "100%", background: C.green, border: "none", borderRadius: T.radius.sm, padding: "9px", color: "#fff", fontSize: T.text.md, fontWeight: T.weight.bold, cursor: "pointer" }}>
                        Salvar check-in
                      </button>
                    </>
                  )}
                  {!pendingStatus && (
                    <div style={{ textAlign: "center", fontSize: T.text.base, color: C.muted, padding: "6px 0" }}>
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
                  <span style={{ fontSize: T.text.base, fontWeight: T.weight.bold, color: C.green }}>Plano configurado</span>
                </div>
                <div style={{ fontSize: T.text.base, color: C.muted }}>{wd.meals.length} refeições · {doneMeals.length} concluídas</div>
                <div style={{ fontSize: T.text.base, color: C.muted, marginTop: 4 }}>Meta: {goals.cal} kcal · {goals.prot}g prot</div>
                <button
                  onClick={() => setEditOpen(true)}
                  style={{ marginTop: 12, width: "100%", background: C.card2, border: `1px solid ${C.border2}`, borderRadius: T.radius.sm, padding: "8px", fontSize: T.text.base, fontWeight: T.weight.semibold, color: C.text, cursor: "pointer" }}>
                  ✏️ Editar plano
                </button>
              </Card>
            )}

            {/* Progress summary */}
            {wd && goals.cal > 0 && (
              <Card>
                <div style={{ fontWeight: T.weight.bold, fontSize: T.text.lg, marginBottom: 12 }}>Progresso hoje</div>
                {[
                  { l: "Calorias", cur: cur.cal, goal: goals.cal, c: C.orange, u: "kcal" },
                  { l: "Proteína", cur: cur.prot, goal: goals.prot, c: C.blue, u: "g" },
                ].map((m, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: T.text.sm, color: C.muted, marginBottom: 4 }}>
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

        {/* Compliance History */}
        {compliance.length > 0 && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: T.weight.bold, fontSize: T.text.lg, marginBottom: 14, ...displayStyle }}><BarChart3 size={17} /> Histórico de compliance (7 dias)</div>
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
                      borderRadius: T.radius.md,
                      background: isToday ? `${C.blue}12` : C.card2,
                      border: `1px solid ${isToday ? C.blue + '44' : C.border}`,
                    }}
                  >
                    <div style={{ fontSize: T.text['4xl'], marginBottom: 5, opacity: log ? 1 : 0.2 }}>
                      {opt ? opt.emoji : '○'}
                    </div>
                    <div style={{ fontSize: T.text.xs, color: isToday ? C.blue : C.muted, fontWeight: isToday ? 700 : 400 }}>
                      {dayLabel(date)}
                    </div>
                    {isToday && <div style={{ fontSize: T.text['2xs'], color: C.blue, marginTop: 2 }}>hoje</div>}
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
                    <div style={{ fontSize: T.text['3xl'], fontWeight: T.weight.extrabold, color: C.green }}>{perfect}</div>
                    <div style={{ fontSize: T.text.xs, color: C.muted }}>perfeitos</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: T.text['3xl'], fontWeight: T.weight.extrabold, color: C.orange }}>{good}</div>
                    <div style={{ fontSize: T.text.xs, color: C.muted }}>≥90%</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: T.text['3xl'], fontWeight: T.weight.extrabold, color: C.blue }}>{total}</div>
                    <div style={{ fontSize: T.text.xs, color: C.muted }}>registrados</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: T.text['3xl'], fontWeight: T.weight.extrabold, color: C.text }}>{total > 0 ? Math.round(good / total * 100) : 0}%</div>
                    <div style={{ fontSize: T.text.xs, color: C.muted }}>aderência</div>
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
