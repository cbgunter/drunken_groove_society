import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Lato', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        dgs: {
          50:  '#EDF5F0',
          100: '#D8EBE2',
          200: '#B0D6C4',
          400: '#5A9E7D',
          500: '#2A5C42',
          600: '#1E4535',
          900: '#0F2419',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
