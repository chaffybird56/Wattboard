/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0B0E14',
        card: 'rgba(255,255,255,0.06)',
        'card-border': 'rgba(255,255,255,0.12)',
        text: '#E6E9EF',
        muted: '#9AA3AF',
        accent: '#82D9FF',
        'accent-2': '#A6E3B8',
        'ribbon-spike': 'rgba(130,217,255,0.20)',
        'ribbon-sag': 'rgba(255,196,0,0.18)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'xs': ['11px', '16px'],
        'sm': ['12px', '18px'],
        'base': ['14px', '20px'],
        'lg': ['18px', '24px'],
        'xl': ['24px', '32px'],
        '2xl': ['32px', '40px'],
      },
      borderRadius: {
        '2xl': '16px',
      },
      boxShadow: {
        'card': '0 8px 30px rgba(0,0,0,0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(4px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
