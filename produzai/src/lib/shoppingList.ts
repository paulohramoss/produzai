import type { WebDietMeal } from '../store/useWebDietStore'

// Lista de compras montada a partir da dieta que já existe.
//
// O obstáculo é o formato: `WebDietMeal.items` é texto livre ("150g de peito de
// frango", "Peito de frango 150 g", "2 ovos"), sem quantidade nem unidade em
// campo próprio. Somar isso exige três passos, nesta ordem:
//
//   1. EXTRAIR  — separar número, unidade e nome de cada linha;
//   2. NORMALIZAR — reduzir "Peito de Frango", "peito de frango" e "peito
//                   de frango " à mesma chave, e kg/l às unidades base;
//   3. AGREGAR  — somar por chave e multiplicar pelos dias da semana.
//
// Nada disso depende de IA: a dieta do usuário tem dezenas de linhas, não
// milhares, e um parser determinístico devolve o mesmo resultado toda vez —
// o que importa numa tela que a pessoa abre todo sábado antes do mercado.

export type Unit = 'g' | 'ml' | 'un' | 'colher' | 'xicara' | 'fatia' | 'scoop' | 'dente'

export interface ParsedIngredient {
  /** Nome como será exibido, com a primeira letra maiúscula. */
  name: string
  /** Chave de agregação — sem acento, sem plural óbvio, minúscula. */
  key: string
  /** Quantidade da linha. `null` quando o texto não trouxe número. */
  qty: number | null
  unit: Unit | null
  raw: string
}

export interface ShoppingItem {
  name: string
  key: string
  /** Total da semana. `null` quando nenhuma linha trazia quantidade. */
  qty: number | null
  unit: Unit | null
  category: Category
  /** Em quantas refeições do dia o item aparece. */
  occurrences: number
  /** Riscado pelo usuário no mercado. */
  checked?: boolean
}

export type Category =
  | 'Hortifrúti' | 'Açougue e peixaria' | 'Laticínios e ovos' | 'Padaria'
  | 'Mercearia' | 'Suplementos' | 'Congelados' | 'Bebidas' | 'Outros'

export const CATEGORY_ORDER: Category[] = [
  'Hortifrúti', 'Açougue e peixaria', 'Laticínios e ovos', 'Padaria',
  'Mercearia', 'Congelados', 'Bebidas', 'Suplementos', 'Outros',
]

// ── 1. Extração ───────────────────────────────────────────────────────────────

/** Sinônimos que o usuário digita → unidade canônica, com o fator de conversão. */
const UNITS: Record<string, { unit: Unit; factor: number }> = {
  g: { unit: 'g', factor: 1 },
  gr: { unit: 'g', factor: 1 },
  grama: { unit: 'g', factor: 1 },
  gramas: { unit: 'g', factor: 1 },
  kg: { unit: 'g', factor: 1000 },
  quilo: { unit: 'g', factor: 1000 },
  quilos: { unit: 'g', factor: 1000 },
  ml: { unit: 'ml', factor: 1 },
  l: { unit: 'ml', factor: 1000 },
  litro: { unit: 'ml', factor: 1000 },
  litros: { unit: 'ml', factor: 1000 },
  un: { unit: 'un', factor: 1 },
  und: { unit: 'un', factor: 1 },
  unid: { unit: 'un', factor: 1 },
  unidade: { unit: 'un', factor: 1 },
  unidades: { unit: 'un', factor: 1 },
  colher: { unit: 'colher', factor: 1 },
  colheres: { unit: 'colher', factor: 1 },
  cs: { unit: 'colher', factor: 1 },
  xicara: { unit: 'xicara', factor: 1 },
  xicaras: { unit: 'xicara', factor: 1 },
  fatia: { unit: 'fatia', factor: 1 },
  fatias: { unit: 'fatia', factor: 1 },
  scoop: { unit: 'scoop', factor: 1 },
  scoops: { unit: 'scoop', factor: 1 },
  dose: { unit: 'scoop', factor: 1 },
  doses: { unit: 'scoop', factor: 1 },
  dente: { unit: 'dente', factor: 1 },
  dentes: { unit: 'dente', factor: 1 },
}

const UNIT_PATTERN = Object.keys(UNITS).sort((a, b) => b.length - a.length).join('|')

/** Remove acentos — "maçã" e "maca" precisam cair na mesma chave. */
function deaccent(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function toNumber(raw: string): number {
  return parseFloat(raw.replace(',', '.'))
}

/** Palavras que não são ingrediente e sujariam a lista. */
const NOISE = /^(a gosto|à vontade|a vontade|opcional|livre|sem|nada)$/i

const LEADING_QTY = new RegExp(
  `^(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_PATTERN})?\\s*(?:de\\s+|da\\s+|do\\s+)?(.+)$`,
  'i',
)
const TRAILING_QTY = new RegExp(
  `^(.+?)[\\s—–-]+(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_PATTERN})\\.?$`,
  'i',
)

export function parseIngredient(raw: string): ParsedIngredient | null {
  const text = raw.trim().replace(/\s+/g, ' ')
  if (!text || NOISE.test(text)) return null

  let qty: number | null = null
  let unit: Unit | null = null
  let name = text

  const trailing = TRAILING_QTY.exec(text)
  const leading = LEADING_QTY.exec(text)

  if (trailing) {
    // "Peito de frango 150 g"
    const u = UNITS[deaccent(trailing[3]).toLowerCase()]
    name = trailing[1]
    qty = toNumber(trailing[2]) * u.factor
    unit = u.unit
  } else if (leading) {
    // "150g de peito de frango" ou "2 ovos" (sem unidade explícita)
    const rawUnit = leading[2]
    const u = rawUnit ? UNITS[deaccent(rawUnit).toLowerCase()] : undefined
    name = leading[3]
    qty = toNumber(leading[1]) * (u?.factor ?? 1)
    unit = u?.unit ?? 'un'
  }

  name = cleanName(name)
  if (!name) return null

  return { name: capitalize(name), key: normalizeKey(name), qty, unit, raw: text }
}

/** Tira pontuação solta, preposição no começo, observação entre parênteses e
 *  qualificador sem quantidade no fim ("brócolis a gosto" é brócolis). */
function cleanName(s: string): string {
  return s
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+(?:a\s+gosto|à\s+vontade|a\s+vontade|opcional|se\s+quiser)\.?$/i, '')
    .replace(/^(?:de|da|do|dos|das)\s+/i, '')
    .replace(/[.,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── 2. Normalização ───────────────────────────────────────────────────────────

/** Plurais que aparecem de verdade numa dieta. Nada de stemmer genérico. */
const PLURAL_FIXES: [RegExp, string][] = [
  [/ oes$/, ' ao'], [/oes$/, 'ao'],
  [/aes$/, 'ao'],
  [/ais$/, 'al'], [/eis$/, 'el'], [/ois$/, 'ol'], [/uis$/, 'ul'],
  [/ns$/, 'm'],
  [/res$/, 'r'], [/zes$/, 'z'], [/ses$/, 's'],
  [/s$/, ''],
]

function singular(word: string): string {
  if (word.length <= 3) return word
  for (const [re, to] of PLURAL_FIXES) {
    if (re.test(word)) return word.replace(re, to)
  }
  return word
}

export function normalizeKey(name: string): string {
  return deaccent(name)
    .toLowerCase()
    // "batata-doce" e "batata doce" são a mesma compra.
    .replace(/[-–—]/g, ' ')
    .split(' ')
    .filter(w => w && !/^(de|da|do|dos|das|e|com|em|no|na)$/.test(w))
    .map(singular)
    .join(' ')
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Categorias ────────────────────────────────────────────────────────────────

const CATEGORY_RULES: [Category, RegExp][] = [
  ['Açougue e peixaria', /\b(frango|peito|coxa|sobrecoxa|carne|patinho|alcatra|acem|coxao|file|filet|picanha|maminha|costela|linguica|bacon|peixe|salmao|tilapia|atum|sardinha|camarao|porco|lombo|peru|hamburguer|bife|moida|pernil)\b/],
  ['Hortifrúti', /\b(alface|tomate|cebola|alho|cenoura|brocoli|couve|espinafre|abobrinha|abobora|batata|inhame|mandioca|aipim|beterraba|pepino|pimentao|repolho|chuchu|vagem|quiabo|berinjela|rucula|agriao|banana|maca|laranja|mamao|manga|abacaxi|melancia|melao|uva|morango|abacate|limao|pera|kiwi|acai|goiaba|maracuja|tangerina|salsinha|cebolinha|coentro|manjericao|gengibre|cogumelo|champignon|fruta|legume|verdura|salada)\b/],
  ['Laticínios e ovos', /\b(ovo|clara|gema|leite|queijo|requeijao|iogurte|coalhada|manteiga|creme de leite|ricota|mussarela|muçarela|cottage|parmesao|nata)\b/],
  ['Padaria', /\b(pao|paes|baguete|torrada|bisnaguinha|croissant|tapioca|wrap|tortilha|bolo)\b/],
  ['Congelados', /\b(congelad|sorvete|polpa|acai congelado|nugget|empanado)\b/],
  ['Bebidas', /\b(agua|suco|refrigerante|cafe|cha|cerveja|vinho|isotonic|energetico|coco)\b/],
  ['Suplementos', /\b(whey|creatina|bcaa|glutamina|albumina|caseina|hipercalorico|pre-treino|pre treino|maltodextrina|dextrose|omega|multivitaminico|colageno|termogenico|suplemento|protein)\b/],
  ['Mercearia', /\b(arroz|feijao|lentilha|grao de bico|macarrao|massa|aveia|granola|farinha|acucar|adocante|sal|azeite|oleo|vinagre|molho|extrato|milho|ervilha|amendoim|castanha|nozes|amendoa|pasta de amendoim|mel|geleia|biscoito|bolacha|cacau|chocolate|cuscuz|quinoa|chia|linhaca|tempero|cominho|oregano|pimenta|canela|caldo|atum em lata|sardinha em lata|leite condensado)\b/],
]

export function categorize(key: string): Category {
  for (const [category, re] of CATEGORY_RULES) {
    if (re.test(key)) return category
  }
  return 'Outros'
}

// ── 3. Agregação ──────────────────────────────────────────────────────────────

/**
 * Junta os ingredientes de um dia de dieta e multiplica pelos dias pedidos.
 *
 * O plano de refeições do app é diário e se repete; a lista de compras é
 * semanal. `days` é o multiplicador — 7 para a semana cheia, 5 se a pessoa come
 * fora no fim de semana.
 *
 * Chave de soma = nome normalizado + unidade. Se o mesmo ingrediente aparece em
 * gramas numa refeição e em colheres na outra, viram DUAS linhas: somar 150g com
 * 2 colheres daria um número que não existe, e uma lista errada é pior do que
 * uma lista com duas linhas.
 */
export function buildShoppingList(meals: WebDietMeal[], days = 7): ShoppingItem[] {
  const acc = new Map<string, ShoppingItem>()

  for (const meal of meals) {
    for (const raw of meal.items) {
      const parsed = parseIngredient(raw)
      if (!parsed) continue

      const mapKey = `${parsed.key}|${parsed.unit ?? ''}`
      const existing = acc.get(mapKey)

      if (existing) {
        existing.occurrences += 1
        if (parsed.qty !== null) existing.qty = (existing.qty ?? 0) + parsed.qty
      } else {
        acc.set(mapKey, {
          name: parsed.name,
          key: parsed.key,
          qty: parsed.qty,
          unit: parsed.unit,
          category: categorize(parsed.key),
          occurrences: 1,
        })
      }
    }
  }

  return [...acc.values()]
    .map(item => ({
      ...item,
      qty: item.qty === null ? null : roundQty(item.qty * days),
      occurrences: item.occurrences * days,
    }))
    .sort((a, b) =>
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
      a.name.localeCompare(b.name, 'pt-BR'))
}

function roundQty(n: number): number {
  return Math.round(n * 100) / 100
}

/** Quantidade legível: 1500 g vira "1,5 kg". */
export function formatQty(item: ShoppingItem): string {
  if (item.qty === null) {
    return item.occurrences > 1 ? `${item.occurrences}×` : ''
  }
  const n = item.qty
  if (item.unit === 'g' && n >= 1000) return `${fmt(n / 1000)} kg`
  if (item.unit === 'ml' && n >= 1000) return `${fmt(n / 1000)} L`
  if (item.unit === 'un') return `${fmt(n)} un`
  if (item.unit === null) return fmt(n)
  const plural = n > 1 && ['colher', 'xicara', 'fatia', 'scoop', 'dente'].includes(item.unit)
  const label = plural
    ? { colher: 'colheres', xicara: 'xícaras', fatia: 'fatias', scoop: 'scoops', dente: 'dentes' }[item.unit as string] ?? item.unit
    : item.unit === 'xicara' ? 'xícara' : item.unit
  return `${fmt(n)} ${label}`
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',').replace(/,0$/, '')
}

/** Texto plano para mandar no WhatsApp ou colar em qualquer lugar. */
export function shoppingListToText(items: ShoppingItem[], days: number): string {
  const lines = [`🛒 Lista de compras — ${days} dias`, '']
  for (const category of CATEGORY_ORDER) {
    const group = items.filter(i => i.category === category)
    if (group.length === 0) continue
    lines.push(`*${category}*`)
    for (const item of group) {
      const q = formatQty(item)
      lines.push(`• ${item.name}${q ? ` — ${q}` : ''}`)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}
