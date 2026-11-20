import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx,html}', './preview/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          '"Segoe UI"',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: {
        panel: '18px',
        card: '14px',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { opacity: '0.55', transform: 'scale(0.96)' },
          '50%': { opacity: '1', transform: 'scale(1.04)' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        sweep: {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(220%)' },
        },
      },
      animation: {
        breathe: 'breathe 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        rise: 'rise 0.32s cubic-bezier(0.22, 1, 0.36, 1) both',
        sweep: 'sweep 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
