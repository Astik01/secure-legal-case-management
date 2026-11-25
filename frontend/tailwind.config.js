/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f1f5fa', 100: '#e1eaf5', 200: '#c3d4ea', 300: '#94b2d8', 400: '#5f8ac0',
          500: '#3f6aa5', 600: '#2f5388', 700: '#274570', 800: '#1d3557', 900: '#0f2a4a', 950: '#0a1c33',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: { card: '0 1px 2px rgba(15,42,74,0.06), 0 1px 3px rgba(15,42,74,0.08)' },
    },
  },
  plugins: [],
};
