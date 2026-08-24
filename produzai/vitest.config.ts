import { defineConfig } from 'vitest/config'

// Config própria dos testes de unidade — separada de vite.config.ts para não
// carregar o plugin PWA nem o resolvedor de buildId a cada `vitest run`.
//
// `include` é restrito a src/: os testes das funções serverless
// (api/**/*.test.mjs) rodam em `npm test`, com `node --test`, e não devem ser
// executados duas vezes por dois runners diferentes.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
