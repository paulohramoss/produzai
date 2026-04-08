import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, Mic, Zap, Sparkles } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { ChatMessage } from '../types'

const quickActions = [
  'Qual meu saldo este mês?',
  'Quantos hábitos completei hoje?',
  'Mostre minha meta mais próxima',
  'Resumo da semana',
]

const botResponses: Record<string, string> = {
  saldo: 'Seu saldo este mês está em **R$ 7.148,50**. Você teve R$ 9.700,00 de entradas e R$ 2.551,50 em gastos. Ainda está dentro do orçamento! 💰',
  hábito: 'Hoje você completou **5 de 7 hábitos** (71%). Os pendentes são: Dieta e Meditar. Ainda dá tempo! 💪',
  meta: 'Sua meta mais próxima é a **Reserva de Emergência**: você já tem R$ 18.000 dos R$ 24.000 planejados. Faltam R$ 6.000 e você tem até agosto. 🎯',
  semana: 'Resumo da semana:\n- ✅ Hábitos: 68% de média\n- 💸 Gastos: R$ 851,50 (dentro do plano)\n- 🔥 Sequência: 14 dias\n- ⚡ XP ganho: +320 pontos\n\nSemana sólida, continue assim!',
  default: 'Entendido! Estou analisando seus dados para trazer a melhor resposta. Tente ser mais específico ou use uma das sugestões rápidas acima. 🤖',
}

function getBotReply(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes('saldo') || lower.includes('mês') || lower.includes('dinheiro') || lower.includes('gasto')) return botResponses.saldo
  if (lower.includes('hábito') || lower.includes('hoje') || lower.includes('complet')) return botResponses.hábito
  if (lower.includes('meta') || lower.includes('sonho') || lower.includes('próxim')) return botResponses.meta
  if (lower.includes('semana') || lower.includes('resumo')) return botResponses.semana
  return botResponses.default
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center flex-shrink-0">
          <Zap size={14} className="text-brand-300" />
        </div>
      )}
      <div className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
        isUser
          ? 'bg-brand-600 text-white rounded-tr-sm'
          : 'bg-surface-raised border border-surface-border text-gray-200 rounded-tl-sm'
      }`}>
        {msg.content.split('\n').map((line, i) => {
          const parts = line.split(/\*\*(.*?)\*\*/)
          return (
            <p key={i} className={i > 0 ? 'mt-1' : ''}>
              {parts.map((p, j) => j % 2 === 1 ? <strong key={j} className="text-white font-semibold">{p}</strong> : p)}
            </p>
          )
        })}
        <p className={`text-xs mt-1.5 ${isUser ? 'text-brand-200' : 'text-gray-600'}`}>{msg.timestamp}</p>
      </div>
    </div>
  )
}

export default function Chat() {
  const { messages, addMessage, profile } = useAppStore()
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  function sendMessage(text?: string) {
    const content = text || input.trim()
    if (!content) return
    setInput('')

    const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    addMessage({ id: `u${Date.now()}`, role: 'user', content, timestamp: now })

    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      addMessage({ id: `b${Date.now()}`, role: 'assistant', content: getBotReply(content), timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) })
    }, 1200 + Math.random() * 600)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-8 py-4 md:py-5 border-b border-surface-border flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-600/30 flex items-center justify-center">
          <Sparkles size={18} className="text-brand-400" />
        </div>
        <div>
          <p className="font-bold text-white">Nexus IA</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400">Online · disponível 24h</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6 space-y-4">
        {messages.map(m => <MessageBubble key={m.id} msg={m} />)}
        {isTyping && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center flex-shrink-0">
              <Zap size={14} className="text-brand-300" />
            </div>
            <div className="bg-surface-raised border border-surface-border px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1">
              {[0, 150, 300].map(d => (
                <span key={d} className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick actions */}
      <div className="px-4 md:px-8 py-2 flex gap-2 overflow-x-auto">
        {quickActions.map(q => (
          <button key={q} onClick={() => sendMessage(q)}
            className="whitespace-nowrap text-xs px-3 py-1.5 rounded-full border border-surface-border text-gray-400 hover:border-brand-600 hover:text-brand-400 transition-all">
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 md:px-8 py-4 md:py-5 border-t border-surface-border">
        <div className="flex items-center gap-3 bg-surface-raised border border-surface-border rounded-2xl px-4 py-3">
          <button className="text-gray-500 hover:text-gray-300 transition-colors"><Paperclip size={18} /></button>
          <input
            className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm focus:outline-none"
            placeholder={`Fale com o Nexus, ${profile.name.split(' ')[0]}...`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          />
          <button className="text-gray-500 hover:text-gray-300 transition-colors"><Mic size={18} /></button>
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim()}
            className="w-8 h-8 rounded-xl bg-brand-600 disabled:opacity-40 hover:bg-brand-500 flex items-center justify-center transition-all">
            <Send size={14} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
