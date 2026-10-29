/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        xcode: {
          bg: '#1E1E1E',
          'bg-light': '#F5F5F0',
          sidebar: '#252526',
          'sidebar-light': '#ECECEC',
          surface: '#2D2D2D',
          'surface-light': '#E8E8E3',
          border: '#3C3C3C',
          'border-light': '#D1D1D1',
          // Theme-aware: darker in light mode for 4.5:1 text contrast (see index.css).
          accent: 'rgb(var(--xcode-accent) / <alpha-value>)',
          orange: 'rgb(var(--xcode-orange) / <alpha-value>)',
          text: '#D4D4D4',
          'text-light': '#1C1C1E',
          muted: 'rgb(var(--xcode-muted) / <alpha-value>)',
          green: 'rgb(var(--xcode-green) / <alpha-value>)',
          yellow: 'rgb(var(--xcode-yellow) / <alpha-value>)',
          red: 'rgb(var(--xcode-red) / <alpha-value>)',
          pink: 'rgb(var(--xcode-pink) / <alpha-value>)',
          teal: 'rgb(var(--xcode-teal) / <alpha-value>)',
        },
      },
      fontFamily: {
        mono: ['"SF Mono"', '"JetBrains Mono"', '"Fira Code"', 'Menlo', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        blink: 'blink 1s step-end infinite',
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      maxWidth: {
        prose: '680px',
      },
    },
  },
  plugins: [],
};
