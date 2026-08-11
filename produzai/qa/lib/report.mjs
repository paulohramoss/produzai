// Coleta de resultados e impressão do relatório.

const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', BOLD = '\x1b[1m', OFF = '\x1b[0m'

export class Report {
  constructor() {
    this.entries = []
    this.current = null
  }

  startScenario(name) {
    this.current = { name, checks: [], error: null, ms: 0 }
    this.entries.push(this.current)
    console.log(`\n${BOLD}▸ ${name}${OFF}`)
    return this.current
  }

  /** Único jeito de um cenário afirmar algo. `detail` aparece sempre que existe. */
  check(name, ok, detail = '') {
    const passed = Boolean(ok)
    this.current.checks.push({ name, ok: passed, detail })
    const mark = passed ? `${GREEN}✓${OFF}` : `${RED}✗${OFF}`
    console.log(`  ${mark} ${name}${detail ? ` ${DIM}— ${detail}${OFF}` : ''}`)
    return passed
  }

  failScenario(err) {
    this.current.error = err instanceof Error ? (err.stack ?? err.message) : String(err)
    console.log(`  ${RED}✗ cenário abortou${OFF} ${DIM}— ${String(err).split('\n')[0]}${OFF}`)
  }

  get failed() {
    return this.entries.filter(e => e.error || e.checks.some(c => !c.ok))
  }

  get totals() {
    const checks = this.entries.flatMap(e => e.checks)
    return { total: checks.length, passed: checks.filter(c => c.ok).length }
  }

  print() {
    const { total, passed } = this.totals
    const failed = this.failed
    console.log(`\n${BOLD}─── Resultado ───${OFF}`)
    console.log(`Cenários: ${this.entries.length - failed.length}/${this.entries.length}   Checks: ${passed}/${total}`)

    if (failed.length === 0) {
      console.log(`${GREEN}${BOLD}QA passou.${OFF}`)
      return true
    }

    console.log(`\n${RED}${BOLD}Falhas:${OFF}`)
    for (const e of failed) {
      console.log(`\n  ${BOLD}${e.name}${OFF}`)
      for (const c of e.checks.filter(x => !x.ok)) {
        console.log(`    ${RED}✗${OFF} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`)
      }
      if (e.error) console.log(`    ${RED}erro:${OFF} ${e.error.split('\n').slice(0, 4).join('\n         ')}`)
    }
    return false
  }

  toJSON() {
    return {
      ranAt: new Date().toISOString(),
      totals: this.totals,
      scenarios: this.entries,
    }
  }
}
