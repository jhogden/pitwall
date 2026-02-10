import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pitwall: {
          bg: '#0a0a0f',
          surface: '#141420',
          'surface-2': '#1e1e2e',
          border: '#2a2a3a',
          text: '#e4e4ef',
          'text-muted': '#8888a0',
          accent: '#6366f1',
        },
        f1: '#E10600',
        wec: '#00548F',
        imsa: '#DA291C',
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
