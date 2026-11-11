// tailwind.config.ts — SCKDA palette (same as the Hundi app) plus gold & silver metallics.
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        maroon: {
          50: '#fdf2f2', 100: '#fde8e8', 200: '#fbd5d5', 300: '#f8b4b4', 400: '#f27777', 500: '#e8404a',
          600: '#c8252e', 700: '#7B1E22', 800: '#6b191d', 900: '#5a1519', 950: '#2a080a',
        },
        saffron: { 300: '#f4ca7a', 400: '#F0B84C', 500: '#E8A33D', 600: '#d08a29', 700: '#a96e1e' },
        cream: { 50: '#FDFBF7', 100: '#f5f0e6', 200: '#ede5d4', 300: '#e2d6bd' },
        gold: { 100: '#fbf1d3', 200: '#f5e1a4', 300: '#ecc96a', 400: '#dcae3f', 500: '#c8962a', 600: '#a8791c', 700: '#7d5913', 800: '#553c0c' },
        silver: { 100: '#f3f5f7', 200: '#e3e7eb', 300: '#c9d0d7', 400: '#a4aeb8', 500: '#7f8a96', 600: '#616b76', 700: '#454d56' },
        charcoal: '#2B2B2B',
      },
      fontFamily: {
        sans: ['Noto Sans Kannada', 'Inter', 'system-ui', 'sans-serif'],
        kannada: ['Noto Sans Kannada', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(220,174,63,.35), 0 20px 50px -12px rgba(90,21,25,.45)',
        soft: '0 1px 2px rgba(43,43,43,.04), 0 8px 24px -8px rgba(43,43,43,.12)',
      },
      keyframes: {
        sheen: { '0%': { transform: 'translateX(-120%) skewX(-20deg)' }, '60%,100%': { transform: 'translateX(260%) skewX(-20deg)' } },
        rise: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        spinSlow: { to: { transform: 'rotate(360deg)' } },
        glint: { '0%,100%': { opacity: '.25' }, '50%': { opacity: '1' } },
      },
      animation: {
        sheen: 'sheen 4.5s ease-in-out infinite',
        rise: 'rise .5s cubic-bezier(.2,.7,.2,1) both',
        'spin-slower': 'spinSlow 120s linear infinite',
        glint: 'glint 3s ease-in-out infinite',
      },
      screens: { tablet: '600px' },
    },
  },
  plugins: [],
} satisfies Config;
