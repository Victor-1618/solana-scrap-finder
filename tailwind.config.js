/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        solana: {
          green: "#14F195",
          purple: "#9945FF",
          dark: "#08090a",
          card: "#121417",
          border: "#20242a",
          text: "#f0f2f5",
          muted: "#94a3b8",
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(20, 241, 149, 0.2), 0 0 10px rgba(153, 69, 255, 0.2)' },
          '100%': { boxShadow: '0 0 15px rgba(20, 241, 149, 0.4), 0 0 25px rgba(153, 69, 255, 0.4)' },
        }
      }
    },
  },
  plugins: [],
}
