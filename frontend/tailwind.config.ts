import type { Config } from 'tailwindcss'
import { PITWALL_COLORS, SERIES_THEME_COLORS } from './src/lib/theme'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pitwall: {
          bg: PITWALL_COLORS.bg,
          surface: PITWALL_COLORS.surface,
          'surface-2': PITWALL_COLORS.surface2,
          border: PITWALL_COLORS.border,
          text: PITWALL_COLORS.text,
          'text-muted': PITWALL_COLORS.textMuted,
          accent: PITWALL_COLORS.accent,
        },
        f1: SERIES_THEME_COLORS.f1,
        wec: SERIES_THEME_COLORS.wec,
        imsa: SERIES_THEME_COLORS.imsa,
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
