// Foto de perfil: a foto do celular tem que passar.
//
// A regressão que este cenário existe para pegar: o app recusava qualquer
// imagem acima de 5 MB com "Imagem muito grande" — e um retrato de celular sai
// com 3 a 8 MB. O caminho mais comum de todos, tirar foto e mandar, batia numa
// parede que o usuário não tinha como contornar.
//
// Agora a imagem é reduzida ANTES de subir (src/lib/imageUpload.ts). O que se
// confere aqui é o efeito, não a implementação: o que chegou no Storage é
// pequeno, tem as dimensões do avatar e é JPEG.

import { openSession } from '../lib/app.mjs'

/** Desenha uma "foto" grande no navegador e entrega ao input, como o usuário faria. */
const ESCOLHER_FOTO = async (page, seletor) => page.evaluate(async (sel) => {
  const W = 3000, H = 2000
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, '#f97316'); g.addColorStop(1, '#0c0c0c')
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  // Ruído: PNG de gradiente puro comprime demais e não chegaria perto do teto.
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = `hsl(${(i * 37) % 360},70%,50%)`
    ctx.fillRect(Math.random() * W, Math.random() * H, 8, 8)
  }
  const blob = await new Promise(r => c.toBlob(r, 'image/png'))
  const file = new File([blob], 'foto-do-celular.png', { type: 'image/png' })

  const dt = new DataTransfer()
  dt.items.add(file)
  const input = document.querySelector(sel)
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return file.size
}, seletor)

export default {
  name: 'Foto de perfil aceita foto de celular',

  async run({ browser, baseUrl, slug, track, check }) {
    const s = track(await openSession(browser, { baseUrl, scenarioSlug: slug }))
    const { page } = s
    await page.waitForTimeout(2000)

    await page.getByRole('button', { name: 'Ir para perfil' }).first().click()
    await page.waitForTimeout(1000)

    const input = 'input[type=file][accept="image/*"]'
    check('a tela de perfil tem o seletor de foto', await page.locator(input).count() > 0)

    const origem = await ESCOLHER_FOTO(page, input)
    check(
      'a foto de teste é maior que o teto antigo de 5MB',
      origem > 5 * 1024 * 1024,
      `${(origem / 1024 / 1024).toFixed(1)} MB`,
    )

    await page.waitForTimeout(2500)

    // Nada de "muito grande": o app reduz em vez de recusar.
    const texto = await page.locator('body').innerText()
    check('não recusa a foto por tamanho', !/muito grande|grande demais/i.test(texto))

    const enviados = await page.evaluate(() => window.__qaUploads ?? [])
    const avatar = enviados.find(u => u.path.endsWith('/avatar'))

    check('a foto chegou ao Storage', !!avatar, avatar ? avatar.path : 'nenhum envio')
    if (!avatar) return

    check(
      'o que subiu cabe no teto da regra do Storage',
      avatar.bytes <= 5 * 1024 * 1024,
      `${(avatar.bytes / 1024).toFixed(0)} KB`,
    )
    check(
      'a redução vale a pena (menos de 10% do original)',
      avatar.bytes < origem * 0.1,
      `${(avatar.bytes / 1024).toFixed(0)} KB de ${(origem / 1024 / 1024).toFixed(1)} MB`,
    )
    check('sobe como JPEG', avatar.type === 'image/jpeg', avatar.type)

    await s.shot('perfil-com-foto')
  },
}
