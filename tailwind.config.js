/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          800: '#1a1a2e',
          900: '#0f0f23',
          950: '#0a0a1a',
        },
        sos: {
          red: '#E63946',
          glow: '#ff1a1a',
        },
        ph: {
          blue: '#0038A8',
          red: '#CE1126',
          yellow: '#FFD700',
          white: '#FFFFFF',
        },
        dispatch: {
          bg: '#0f1117',
          card: '#1a1d28',
          border: '#2a2d3a',
          text: '#e1e4ed',
          muted: '#8b8fa3',
        },
      },
      animation: {
        'pulse-sos': 'pulseSos 2s ease-in-out infinite',
        'ping-slow': 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      keyframes: {
        pulseSos: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(230, 57, 70, 0.4)' },
          '50%': { boxShadow: '0 0 60px rgba(230, 57, 70, 0.8), 0 0 100px rgba(230, 57, 70, 0.4)' },
        },
      },
    },
  },
  plugins: [],
};
