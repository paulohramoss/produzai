// Geração e revogação do link read-only do treinador.
//
// O que sobe é um resumo congelado (ver lib/coachShare.ts). Publicar de novo é
// barato, então cada abertura desta seção com link ativo republica os últimos
// dias — o treinador abre o mesmo link e vê o estado atual.

import { useState, useEffect, useCallback } from 'react'
import { Share2 } from 'lucide-react'
import { T, C } from '../data'
import { Card } from '../primitives'
import { useAuthStore } from '../../store/useAuthStore'
import { useWorkoutStore } from '../../store/useWorkoutStore'
import { useWebDietStore } from '../../store/useWebDietStore'
import {
  getProfile, saveProfile, saveCoachShare, deleteCoachShare, getDailyHistory,
} from '../../lib/db'
import { lastNDays } from '../../lib/date'
import {
  buildCoachSnapshot, generateShareToken, shareUrl, SHARE_WINDOW_DAYS,
} from '../../lib/coachShare'
import { toast } from '../../lib/toast'

export function CoachShareCard() {
  const user        = useAuthStore(s => s.user)
  const displayName = useAuthStore(s => s.displayName)
  const workouts    = useWorkoutStore(s => s.workouts)
  const compliance  = useWebDietStore(s => s.compliance)

  const [token, setToken]     = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)

  const publish = useCallback(async (shareToken: string) => {
    if (!user) return
    const dates = lastNDays(SHARE_WINDOW_DAYS)
    const dailyHistory = await getDailyHistory(dates)
    await saveCoachShare(shareToken, buildCoachSnapshot({
      uid: user.uid,
      athleteName: displayName || user.displayName || 'Atleta',
      dates,
      workouts,
      dailyHistory,
      compliance,
    }))
  }, [user, displayName, workouts, compliance])

  useEffect(() => {
    let active = true
    async function load() {
      const profile = await getProfile()
      if (!active) return
      setToken(profile?.coachShareToken ?? null)
      setLoading(false)
      // Link já existe: republica em silêncio para o treinador ver o atual.
      if (profile?.coachShareToken) publish(profile.coachShareToken)
    }
    load()
    return () => { active = false }
  }, [publish])

  async function handleCreate() {
    setWorking(true)
    const next = generateShareToken()
    await publish(next)
    await saveProfile({ coachShareToken: next })
    setToken(next)
    setWorking(false)
    await copy(shareUrl(next), 'Link criado e copiado!')
  }

  async function handleRefresh() {
    if (!token) return
    setWorking(true)
    await publish(token)
    setWorking(false)
    toast.success('🔄 Resumo atualizado para o treinador')
  }

  async function handleRevoke() {
    if (!token) return
    setWorking(true)
    await deleteCoachShare(token)
    await saveProfile({ coachShareToken: '' })
    setToken(null)
    setWorking(false)
    setConfirmRevoke(false)
    toast.info('🔒 Link revogado — quem tinha o endereço não vê mais nada')
  }

  async function copy(url: string, message: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(`🔗 ${message}`)
    } catch {
      // Área de transferência bloqueada (http, permissão negada): o link continua
      // visível na tela para copiar à mão.
      toast.info('Copie o link manualmente abaixo')
    }
  }

  if (loading) {
    return <div style={{ fontSize: T.text.md, color: C.muted }}>Verificando link...</div>
  }

  if (!token) {
    return (
      <div>
        <div style={{ fontSize: T.text.base, color: C.muted, lineHeight: 1.65, marginBottom: 14 }}>
          Gere um endereço público com um resumo dos seus últimos {SHARE_WINDOW_DAYS} dias —
          treinos, observações e dor relatada, prontidão, hidratação e dieta. Seu treinador
          abre no navegador, sem instalar nada e sem criar conta.
        </div>
        <div style={{ fontSize: T.text.sm, color: C.orange, lineHeight: 1.6, marginBottom: 14 }}>
          ⚠️ Quem tiver o link vê esses dados, sem senha. Compartilhe só com quem você
          quer que acompanhe — e revogue quando quiser.
        </div>
        <button
          onClick={handleCreate}
          disabled={working}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '12px', borderRadius: T.radius.md, border: 'none',
            background: working ? C.border2 : C.green, color: '#fff',
            fontSize: T.text.lg, fontWeight: T.weight.bold, cursor: working ? 'default' : 'pointer',
          }}
        >
          <Share2 size={16} /> {working ? 'Gerando...' : 'Gerar link para o treinador'}
        </button>
      </div>
    )
  }

  const url = shareUrl(token)

  return (
    <div>
      <div style={{ fontSize: T.text.sm, color: C.green, fontWeight: T.weight.bold, marginBottom: 10 }}>
        ● Link ativo · atualizado agora
      </div>

      <Card style={{
        background: C.card2, padding: '10px 12px', marginBottom: 12,
        fontSize: T.text.sm, color: C.muted2, wordBreak: 'break-all', boxShadow: 'none',
      }}>
        {url}
      </Card>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button
          onClick={() => copy(url, 'Link copiado!')}
          style={{
            flex: 1, minWidth: 130, padding: '10px', borderRadius: T.radius.md, border: 'none',
            background: C.green, color: '#fff', fontSize: T.text.md, fontWeight: T.weight.bold, cursor: 'pointer',
          }}
        >
          🔗 Copiar link
        </button>
        <button
          onClick={handleRefresh}
          disabled={working}
          style={{
            flex: 1, minWidth: 130, padding: '10px', borderRadius: T.radius.md,
            border: `1px solid ${C.border2}`, background: 'transparent', color: C.muted,
            fontSize: T.text.md, fontWeight: T.weight.semibold, cursor: working ? 'default' : 'pointer',
          }}
        >
          {working ? '...' : '🔄 Atualizar agora'}
        </button>
      </div>

      {confirmRevoke ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setConfirmRevoke(false)}
            style={{
              flex: 1, padding: '10px', borderRadius: T.radius.md, border: `1px solid ${C.border2}`,
              background: 'transparent', color: C.muted, fontSize: T.text.md, fontWeight: T.weight.semibold, cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleRevoke}
            disabled={working}
            style={{
              flex: 2, padding: '10px', borderRadius: T.radius.md, border: 'none',
              background: C.red, color: '#fff', fontSize: T.text.md, fontWeight: T.weight.bold,
              cursor: working ? 'default' : 'pointer',
            }}
          >
            {working ? 'Revogando...' : 'Confirmar — o link para de funcionar'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmRevoke(true)}
          style={{
            width: '100%', padding: '10px', borderRadius: T.radius.md, border: `1px solid ${C.red}44`,
            background: 'transparent', color: C.red, fontSize: T.text.md, fontWeight: T.weight.semibold, cursor: 'pointer',
          }}
        >
          Revogar link
        </button>
      )}
    </div>
  )
}
