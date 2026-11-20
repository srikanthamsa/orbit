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
        mono: ['"SF Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      // Semantic colour tokens. Every value resolves through a CSS variable so the
      // light and dark themes share one set of component classes.
      colors: {
        canvas: 'var(--canvas)',
        chrome: 'var(--chrome)',
        surface: 'var(--surface)',
        raised: 'var(--raised)',
        sunken: 'var(--sunken)',
        field: 'var(--field)',
        'field-hover': 'var(--field-hover)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        fg: 'var(--fg)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-tint': 'var(--accent-tint)',
        'accent-line': 'var(--accent-line)',
        success: 'var(--success)',
        'success-tint': 'var(--success-tint)',
        'success-line': 'var(--success-line)',
        warn: 'var(--warn)',
        'warn-tint': 'var(--warn-tint)',
        'warn-line': 'var(--warn-line)',
        danger: 'var(--danger)',
        'danger-tint': 'var(--danger-tint)',
        'danger-line': 'var(--danger-line)',
      },
      // One type scale for the whole panel: 10.5 / 11 / 12 / 13 / 15 / 17.
      fontSize: {
        micro: ['11px', { lineHeight: '14px' }],
        caption: ['12px', { lineHeight: '17px' }],
        label: ['13px', { lineHeight: '19px' }],
        body: ['14px', { lineHeight: '21px', letterSpacing: '-0.004em' }],
        title: ['17px', { lineHeight: '23px', letterSpacing: '-0.012em' }],
        page: ['21px', { lineHeight: '27px', letterSpacing: '-0.02em' }],
        display: ['28px', { lineHeight: '33px', letterSpacing: '-0.024em' }],
      },
      // Three radii: controls 6, panels 8, large surfaces 12.
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
      },
      boxShadow: {
        pop: 'var(--shadow-pop)',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { opacity: '0.55', transform: 'scale(0.96)' },
          '50%': { opacity: '1', transform: 'scale(1.04)' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'orb-pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.045)' },
        },
      },
      animation: {
        breathe: 'breathe 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        rise: 'rise 0.24s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'orb-pulse': 'orb-pulse 4.2s cubic-bezier(0.22, 1, 0.36, 1) infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
