import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        groove: {
          50: '#f5f0ff',
          100: '#ede5ff',
          200: '#d8c8ff',
          400: '#a78bfa',
          500: '#7c3aed',
          600: '#6d28d9',
          900: '#2e1065',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
