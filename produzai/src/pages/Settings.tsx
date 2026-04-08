import { useState } from 'react'
import { User, Bell, Shield, Palette, Download, Save } from 'lucide-react'

const SECTIONS = [
  { id: 'profile', label: 'Perfil', icon: <User size={16} /> },
  { id: 'notifications', label: 'Notificações', icon: <Bell size={16} /> },
  { id: 'security', label: 'Segurança', icon: <Shield size={16} /> },
  { id: 'appearance', label: 'Aparência', icon: <Palette size={16} /> },
  { id: 'data', label: 'Dados', icon: <Download size={16} /> },
]

function Toggle({ defaultChecked = false }: { defaultChecked?: boolean }) {
  const [on, setOn] = useState(defaultChecked)
  return (
    <button onClick={() => setOn(p => !p)}
      className={`w-11 h-6 rounded-full transition-all duration-200 relative flex-shrink-0 ${on ? 'bg-brand-600' : 'bg-surface-border'}`}>
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${on ? 'left-6' : 'left-1'}`} />
    </button>
  )
}

export default function Settings() {
  const [section, setSection] = useState('profile')

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="page-title">Configurações</h1>
        <p className="text-sm text-gray-500 mt-1">Personalize sua experiência no ProduzAI</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {/* Sidebar */}
        <div className="card p-3 h-fit">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={`nav-item w-full ${section === s.id ? 'active' : ''}`}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="col-span-3 space-y-4">
          {section === 'profile' && (
            <>
              <div className="card p-5">
                <p className="font-semibold text-white mb-4">Informações Pessoais</p>
                <div className="flex items-center gap-5 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-brand-700 flex items-center justify-center text-xl font-bold text-brand-300">LM</div>
                  <div>
                    <button className="btn-primary text-sm">Alterar foto</button>
                    <p className="text-xs text-gray-500 mt-1">JPG, PNG — máx 2MB</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Nome completo', placeholder: 'Lucas Mendes' },
                    { label: 'E-mail', placeholder: 'lucas@email.com' },
                    { label: 'Telefone', placeholder: '(11) 99999-9999' },
                    { label: 'Profissão', placeholder: 'Designer' },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="text-xs text-gray-500 mb-1.5 block">{f.label}</label>
                      <input className="input-field" defaultValue={f.placeholder} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-5">
                <p className="font-semibold text-white mb-4">Metas Financeiras</p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Orçamento mensal', placeholder: 'R$ 4.000' },
                    { label: 'Meta de poupança', placeholder: 'R$ 2.000/mês' },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="text-xs text-gray-500 mb-1.5 block">{f.label}</label>
                      <input className="input-field" defaultValue={f.placeholder} />
                    </div>
                  ))}
                </div>
              </div>
              <button className="btn-primary"><Save size={16} /> Salvar alterações</button>
            </>
          )}

          {section === 'notifications' && (
            <div className="card p-5 space-y-5">
              <p className="font-semibold text-white">Notificações</p>
              {[
                { label: 'Lembrete de hábitos diários', sub: 'Receba lembretes para manter sua sequência', on: true },
                { label: 'Alertas de gastos', sub: 'Notifique quando atingir 80% do orçamento', on: true },
                { label: 'Resumo semanal', sub: 'Receba um resumo toda segunda-feira', on: true },
                { label: 'Vencimento de faturas', sub: 'Alerta 3 dias antes do vencimento', on: true },
                { label: 'Conquistas e XP', sub: 'Notificações de novos níveis e conquistas', on: false },
                { label: 'Atualizações do produto', sub: 'Novidades e melhorias do ProduzAI', on: false },
              ].map(n => (
                <div key={n.label} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white font-medium">{n.label}</p>
                    <p className="text-xs text-gray-500">{n.sub}</p>
                  </div>
                  <Toggle defaultChecked={n.on} />
                </div>
              ))}
            </div>
          )}

          {section === 'security' && (
            <div className="space-y-4">
              <div className="card p-5 space-y-4">
                <p className="font-semibold text-white">Alterar Senha</p>
                {['Senha atual', 'Nova senha', 'Confirmar nova senha'].map(l => (
                  <div key={l}>
                    <label className="text-xs text-gray-500 mb-1.5 block">{l}</label>
                    <input className="input-field" type="password" placeholder="••••••••" />
                  </div>
                ))}
                <button className="btn-primary"><Save size={16} /> Atualizar senha</button>
              </div>
              <div className="card p-5 space-y-4">
                <p className="font-semibold text-white">Autenticação de Dois Fatores</p>
                <p className="text-sm text-gray-500">Adicione uma camada extra de segurança à sua conta.</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">Ativar 2FA</p>
                    <p className="text-xs text-gray-500">Via aplicativo autenticador</p>
                  </div>
                  <Toggle />
                </div>
              </div>
            </div>
          )}

          {section === 'appearance' && (
            <div className="card p-5 space-y-5">
              <p className="font-semibold text-white">Aparência</p>
              <div>
                <p className="text-sm text-white mb-3">Tema</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Escuro', active: true, bg: 'bg-gray-900', text: 'text-white' },
                    { label: 'Claro', active: false, bg: 'bg-gray-100', text: 'text-gray-800' },
                    { label: 'Sistema', active: false, bg: 'bg-gradient-to-r from-gray-900 to-gray-100', text: 'text-white' },
                  ].map(t => (
                    <button key={t.label}
                      className={`p-4 rounded-xl border-2 transition-all ${t.active ? 'border-brand-500' : 'border-surface-border hover:border-surface-hover'}`}>
                      <div className={`h-10 rounded-lg mb-2 ${t.bg}`} />
                      <p className="text-xs text-gray-300 text-center">{t.label}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm text-white mb-3">Cor de destaque</p>
                <div className="flex gap-3">
                  {['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'].map(c => (
                    <button key={c} className="w-8 h-8 rounded-full border-2 border-transparent hover:border-white transition-all" style={{ background: c }} />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">Sidebar compacta</p>
                  <p className="text-xs text-gray-500">Exibir somente ícones na barra lateral</p>
                </div>
                <Toggle />
              </div>
            </div>
          )}

          {section === 'data' && (
            <div className="space-y-4">
              <div className="card p-5 space-y-4">
                <p className="font-semibold text-white">Exportar Dados</p>
                <p className="text-sm text-gray-500">Exporte todos os seus dados em diferentes formatos.</p>
                {[
                  { label: 'Exportar transações', sub: 'CSV com todos os lançamentos financeiros', fmt: 'CSV' },
                  { label: 'Exportar hábitos', sub: 'Histórico completo de hábitos', fmt: 'CSV' },
                  { label: 'Exportar relatório', sub: 'Relatório completo em PDF', fmt: 'PDF' },
                ].map(e => (
                  <div key={e.label} className="flex items-center justify-between p-3 bg-surface-raised rounded-xl">
                    <div>
                      <p className="text-sm text-white font-medium">{e.label}</p>
                      <p className="text-xs text-gray-500">{e.sub}</p>
                    </div>
                    <button className="btn-ghost text-xs">
                      <Download size={14} /> {e.fmt}
                    </button>
                  </div>
                ))}
              </div>
              <div className="card p-5 border border-red-900/30">
                <p className="font-semibold text-red-400 mb-2">Zona de Perigo</p>
                <p className="text-sm text-gray-500 mb-4">Estas ações são irreversíveis. Prossiga com cuidado.</p>
                <button className="px-4 py-2 rounded-xl border border-red-800/50 text-red-400 hover:bg-red-900/20 text-sm font-semibold transition-all">
                  Excluir minha conta
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
