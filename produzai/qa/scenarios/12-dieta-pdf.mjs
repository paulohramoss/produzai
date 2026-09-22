// PDF de dieta: agora sobe pro Firebase Storage em vez de virar base64 no
// localStorage, o que abre espaço pra dietas mais complexas (até 20MB) sem
// estourar a cota do navegador. Aqui cobrimos as validações client-side —
// o dublê de Storage não conhece bytes reais, então o parse por IA em si
// (rota /api/*) fica fora do QA, como de costume.

import { openSession } from '../lib/app.mjs'

export default {
  name: 'Dieta: anexar PDF do plano alimentar',

  async run({ browser, baseUrl, slug, track, check }) {
    const s = track(await openSession(browser, { baseUrl, scenarioSlug: slug }))
    const { page } = s

    await s.open('Dieta')
    const fileInput = page.locator('input[type="file"]')

    check('texto do limite mostra 20MB', await page.getByText(/máx\. 20MB/).isVisible())

    // ── Arquivo grande demais é rejeitado antes de subir ────────────────────
    const tooBig = Buffer.alloc(21 * 1024 * 1024, 'a')
    await fileInput.setInputFiles({ name: 'dieta-grande.pdf', mimeType: 'application/pdf', buffer: tooBig })
    await page.waitForTimeout(500)
    check('PDF acima de 20MB é rejeitado com aviso',
      await page.getByText(/PDF muito grande/).isVisible())
    check('nenhum PDF fica anexado após rejeição', await page.getByText('Trocar PDF').count() === 0)

    // ── Tipo errado (mimeType não é PDF) também é rejeitado ─────────────────
    const wrongType = Buffer.from('not a pdf')
    await fileInput.setInputFiles({ name: 'foto.pdf', mimeType: 'image/png', buffer: wrongType })
    await page.waitForTimeout(500)
    check('arquivo que não é PDF é rejeitado', await page.getByText('Selecione um arquivo PDF').isVisible())

    // ── PDF válido dentro do limite sobe normalmente ────────────────────────
    const validPdf = Buffer.from('%PDF-1.4 conteúdo de teste')
    await fileInput.setInputFiles({ name: 'plano-nutricional.pdf', mimeType: 'application/pdf', buffer: validPdf })
    await page.waitForTimeout(900)
    await s.shot('01-pdf-anexado')

    check('botão vira "Trocar PDF" após upload', await page.getByText('Trocar PDF').isVisible())
    check('nome do arquivo aparece no card', await page.getByText('plano-nutricional.pdf').isVisible())
    check('ações do PDF aparecem (importar, abrir, remover)',
      await page.getByRole('button', { name: /Importar refeições/ }).isVisible()
      && await page.getByRole('button', { name: 'Abrir PDF' }).isVisible())

    // ── Remover limpa o estado ───────────────────────────────────────────────
    await page.getByRole('button', { name: '✕' }).click()
    await page.waitForTimeout(400)
    check('remover volta pro estado "anexar PDF"',
      await page.getByText('Anexar plano alimentar em PDF').isVisible())
  },
}
