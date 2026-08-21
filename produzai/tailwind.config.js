/** @type {import('tailwindcss').Config} */

/* ── The Rise Plan — Tailwind tokens ──────────────────────────────────────────
   MIRROR of the single source of truth. Keep these three files in sync:
     • src/index.css        → CSS custom properties (:root)  ← canonical for CSS
     • src/rise/data.ts (C) → JS color object                ← canonical for inline styles
     • this file            → Tailwind utilities

   Palette is BLACK + ORANGE (athlete energy). There is intentionally
   no indigo/violet here anymore — that was legacy drift.
   ─────────────────────────────────────────────────────────────────────────── */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand — orange ramp centered on #F97316 (brand-500 = C.orange)
        brand: {
          DEFAULT: '#F97316',
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        // Surfaces — near-black stack (mirrors --rise-* / C.*)
        surface: {
          DEFAULT: '#0C0C0C', // --rise-bg      / C.bg
          card:    '#141414', // --rise-card    / C.card
          raised:  '#1C1C1C', // --rise-card-2  / C.card2
          elevated:'#222222', // --rise-card-3  / C.card3
          border:  '#252525', // --rise-border  / C.border
          border2: '#2E2E2E', // --rise-border-2/ C.border2
          hover:   '#1C1C1C',
        },
        // Texto — os tons que C.text / C.muted / C.muted2 já usavam nos estilos
        // inline. Sem eles a migração para classes teria de aproximar com
        // `text-gray-*`, que NÃO são os mesmos valores (#6b7280 ≠ #666666) e
        // fariam a mesma tela ter dois cinzas conforme o trecho.
        fg: {
          DEFAULT: '#F0F0F0', // --rise-text    / C.text
          muted:   '#666666', // --rise-muted   / C.muted
          muted2:  '#999999', // --rise-muted-2 / C.muted2
        },
        // Semantic (mirrors C.*)
        success: '#22C55E',
        info:    '#60A5FA',
        accent:  '#A78BFA',
        pink:    '#F472B6',
        danger:  '#EF4444',
        running: '#FC4C02',
      },
      // Type scale — mirrors T.text in data.ts (px = real values in use)
      fontSize: {
        '2xs':  ['9px',  { lineHeight: '1.3' }],
        xs:     ['10px', { lineHeight: '1.3' }],
        sm:     ['11px', { lineHeight: '1.4' }],
        base:   ['12px', { lineHeight: '1.45' }],
        md:     ['13px', { lineHeight: '1.45' }],
        lg:     ['14px', { lineHeight: '1.5' }],
        xl:     ['15px', { lineHeight: '1.5' }],
        '2xl':  ['16px', { lineHeight: '1.4' }],
        '3xl':  ['18px', { lineHeight: '1.35' }],
        '4xl':  ['20px', { lineHeight: '1.3' }],
        '5xl':  ['22px', { lineHeight: '1.25' }],
        '6xl':  ['26px', { lineHeight: '1.2' }],
        '7xl':  ['32px', { lineHeight: '1.15' }],
      },
      // Radius scale — mirrors T.radius in data.ts
      borderRadius: {
        '2xs': '4px',
        xs:    '6px',
        sm:    '8px',
        md:    '10px',
        lg:    '12px',
        xl:    '14px',
        '2xl': '16px',
        '3xl': '18px',
        '4xl': '20px',
      },
      fontFamily: {
        sans:    ['"Open Sans"', 'system-ui', 'sans-serif'],
        display: ['"Archivo"', '"Open Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
