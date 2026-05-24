import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html','./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary ink scale — replaces navy + generic grays
        ink: {
          50:  '#F8FAFC', 100: '#F1F5F9', 150: '#ECF0F7',
          200: '#E2E8F0', 300: '#CBD5E1', 400: '#94A3B8',
          500: '#64748B', 600: '#475569', 700: '#334155',
          800: '#1E293B', 900: '#0F172A', 950: '#020617',
        },
        // Accent — deeper, more confident indigo
        accent: {
          50:  '#EEEEFF', 100: '#DDDDF8', 200: '#C0BFEF',
          300: '#9B98E8', 400: '#7673DF', 500: '#5855D6',
          600: '#4744C8', 700: '#3835B5', 800: '#2D2A9A',
        },
        // Zinc — neutral scale for borders, surfaces (sharper than ink for light UI)
        zinc: {
          50:'#FAFAFA', 100:'#F4F4F5', 150:'#EFEFEF',
          200:'#E4E4E7', 300:'#D4D4D8', 400:'#A1A1AA',
          500:'#71717A', 600:'#52525B', 700:'#3F3F46',
          800:'#27272A', 900:'#18181B', 950:'#09090B',
        },
        // Semantic
        signal: {
          green:  '#10B981',
          amber:  '#F59E0B',
          red:    '#EF4444',
          blue:   '#3B82F6',
        },
        // Keep brand/navy aliases so existing code doesn't break instantly
        brand: {
          50:  '#EEF2FF', 100: '#E0E7FF', 200: '#C7D2FE', 300: '#A5B4FC',
          400: '#818CF8', 500: '#6366F1', 600: '#4F46E5', 700: '#4338CA',
          800: '#3730A3', 900: '#312E81',
        },
        navy: {
          50:  '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0',
          800: '#1E293B', 900: '#0F172A', 950: '#020617',
        },
      },
      fontFamily: {
        sans:    ['"Plus Jakarta Sans"','"DM Sans"','"Inter"','system-ui','-apple-system','sans-serif'],
        display: ['"Plus Jakarta Sans"','system-ui','sans-serif'],
        mono:    ['"JetBrains Mono"','"Fira Code"','Menlo','monospace'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        'xs':  ['12px', '16px'],
        'sm':  ['13.5px', '20px'],
        'base':['15px',  '24px'],
        'lg':  ['17px',  '26px'],
        'xl':  ['20px',  '28px'],
        '2xl': ['24px',  '32px'],
        '3xl': ['30px',  '38px'],
        '4xl': ['36px',  '44px'],
        '5xl': ['48px',  '56px'],
      },
      borderRadius: {
        'sm':  '6px', DEFAULT: '8px', 'md': '10px',
        'lg':  '12px', 'xl': '16px',  '2xl': '20px',
        '3xl': '24px',
      },
      boxShadow: {
        'card':       '0 1px 2px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.03)',
        'card-hover': '0 4px 24px -4px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        'panel':      '0 8px 40px -4px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.04)',
        'modal':      '0 24px 80px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
        'inner':      'inset 0 1px 2px rgba(0,0,0,0.05)',
        'glow-accent':'0 0 32px rgba(88,85,214,0.25)',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      animation: {
        'fade-in':    'fadeIn 0.25s ease-out',
        'slide-up':   'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        'slide-down': 'slideDown 0.2s ease-out',
        'scale-in':   'scaleIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'tour-pulse': 'tourPulse 2s ease-in-out infinite',
        'float':      'float 3s ease-in-out infinite',
        'shimmer':    'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' },                       to: { opacity: '1' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { from: { opacity: '0', transform: 'translateY(-8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:   { from: { opacity: '0', transform: 'scale(0.95)' }, to: { opacity: '1', transform: 'scale(1)' } },
        tourPulse: { '0%,100%': { boxShadow: '0 0 0 0 rgba(99,102,241,0.4)' }, '50%': { boxShadow: '0 0 0 8px rgba(99,102,241,0)' } },
        float:     { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-6px)' } },
        shimmer:   { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
} satisfies Config
