// Base de conhecimento de metodologia de treino, extraída de planilhas reais de
// preparação física: programa "Chapinha" (academia para atleta de futebol) e
// "Projeto 42km" (Atleta de Elite Academy, periodização de maratona).
// Usada pelo Coach IA como referência ao montar treinos, planos semanais e progressões.

export const TRAINING_KNOWLEDGE = `## Base de conhecimento de treinamento (metodologia de referência)

Use os modelos abaixo como REFERÊNCIA DE METODOLOGIA ao montar treinos, planos semanais e progressões. Adapte sempre volume, carga, ritmo e séries ao nível, histórico e objetivo de cada usuário — não copie os números literalmente para todo mundo.

### A) Estrutura de sessão de academia para atletas
Toda sessão de força/potência segue esta sequência:
1. Liberação miofascial (foam roller) — 3-5 min
2. Mobilidade de quadril — rotação, mobilidade "terra", glúteos, passada para trás, passada com rotação, 90/90 — 1x10 cada
3. Ativação — passada lateral, monster walk, ostra, pedalada, elevação de quadril unilateral, ponte de glúteo, elevação — 1-2x10 cada (foco em glúteo médio/cadeia posterior)
4. Coordenação/agilidade — escada de agilidade ou similar (4-5m): entra/sai com 1 e 2 pés, cruzamentos, saltos laterais, skips — 2-4x

Depois entra o bloco principal do dia ("treino complexo"), que varia por foco:

Complex training — posterior de quadril/lateral:
- Búlgaro isométrico (yielding) 3x3 reps de 5s a 50-70% do peso corporal → Búlgaro reativo dinâmico 3x8 a ~30%
- Elevação de quadril isométrica 3x3 de 5s bilateral a 80% → elevação explosiva 3x8 bilateral a 40%
- Hip lock (saída de posterior) 3x5-7 + remada com apoio 3x8
- Copenhagen + remada 3x(2x10), exercício rotacional/tridimensional para core 3x5
- Descanso entre blocos: 2-3 min

Complex training — quadríceps/frontal:
- Isometria de quadríceps (HIMA) 3x3 de 8s → Pistol squat 3x8
- Levantamento terra isométrico (yielding) 3x3 de 8s a 70% + 8 reps dinâmicas
- Afundo isométrico 3x3 de 8s a 50% do peso corporal (ponta do pé na perna da frente) → afundo dinâmico 3x6
- Trabalho rotacional de core/abdômen (soco reativo com bag ou anilha) 3x10
- Descanso entre blocos: 2 min

Complexo superior (puxada/remo):
- Remada isométrica 3x10s → remada dinâmica 3x10
- Remo ergômetro 3x250m no menor tempo possível, 2-3 min de descanso
- Supino isométrico (yielding) 3x3 de 5s a 50% → baixar carga e fazer 6 reps em velocidade
- Prancha com apoio + remada 3x10

Resistência / velocidade (tiros):
- Após mobilidade + ativação: estabilidade com aceleração 3x4
- Tiros de 30m: bloco 1 = 5 reps com 2 min de descanso entre + 4 min de descanso após o bloco; bloco 2 = 7 reps com 1 min de descanso entre

Princípio-chave: "complex training" combina força isométrica (tempo sob tensão, "yielding") com o mesmo padrão de movimento em versão dinâmica/reativa, no mesmo bloco — gera força + potência juntas.

### B) Modelo de semana de um atleta (esporte coletivo)
Padrão observado: 4-5 dias de treino físico + jogo no fim de semana + 1 dia de descanso total.
Exemplo: Seg = treino inferior (posterior), Ter = superior (puxada/remo), Qua = treino inferior (quadríceps), Qui = resistência/velocidade, Sex = repete inferior (posterior), Sáb = jogo/competição, Dom = descanso.

### C) Periodização de corrida de longa distância — modelo 12 semanas para maratona
4 treinos de corrida por semana (ex: quarta, quinta, sábado, domingo).

Zonas de ritmo (exemplo calibrado para meta ~3h45 / pace médio 5:20/km — ajuste proporcionalmente ao pace do usuário):
- Leve (LE): 5:45-6:15/km — rodagens e longões, base aeróbica
- Moderado (MO): 5:05-5:20/km — tempo run / ritmo controlado-forte
- Ritmo de Maratona (RM): 5:18-5:22/km — ritmo específico de prova
- Forte (FO): 4:35-4:50/km — intervalados curtos (400-1000m)

Padrão semanal recorrente:
- 1 treino intervalado (FO): ex. 6x800m, 5x1km, 6x1km, 7x1km, com recuperação entre tiros
- 1 treino de ritmo/tempo (MO/RM): ex. 3x12min MO, 4x2km MO, 3x5km RM, ou tiro contínuo de 12-14km em RM
- 1 rodagem leve (LE) curta/média
- 1 longão (LE), crescente semana a semana

Progressão dos longões (km): 18 → 20 → 22 → 24 → 26 → 28 → 30 → 32 (pico na semana 8) → 28 → 24 → 16 (redução pré-taper)

Taper (última semana antes da prova):
- Quarta: 6km leve
- Quinta: 5km leve
- Sábado: 4km soltura
- Domingo: prova

Estratégia de prova (pacing):
- Definir pace médio alvo (ex: 5:20/km para 3h45)
- Dividir em blocos: primeiros km levemente mais rápidos para "ganhar tempo" (~5:25/km nos 0-10km), trecho central mais estável e ágil (~5:18/km dos 10-30km), trecho final ligeiramente mais lento por fadiga (~5:20-5:25/km dos 30-42km)

### Como aplicar essa base
- Para pedidos de plano de corrida (5k, 10k, 21k, 42k): use a lógica de zonas (LE/MO/RM/FO), o padrão semanal de 1 intervalado + 1 tempo/ritmo + 1 rodagem + 1 longão crescente, e taper nas 1-2 últimas semanas
- Para pedidos de treino de academia/força para atletas: monte a sessão na ordem Mobilidade → Ativação → Agilidade → Bloco principal (complex training), citando exercícios e parâmetros (séries x reps, %carga, tempo isométrico) coerentes com os modelos acima
- Para planos semanais completos: combine os dois mundos (força + corrida/esporte) respeitando dias de descanso e competição
- Sempre calibre para o nível do usuário: iniciantes reduzem volume, séries, % de carga e duração dos longões; avançados podem usar os valores de referência quase como estão`
