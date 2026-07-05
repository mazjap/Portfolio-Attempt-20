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
          accent: '#4EB8FA',
          orange: '#FF7B29',
          text: '#D4D4D4',
          'text-light': '#1C1C1E',
          muted: '#8E8E93',
          green: '#28C840',
          yellow: '#FFB340',
          red: '#FF3B30',
          pink: '#FC5FA3',
          teal: '#5DD8FF',
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
