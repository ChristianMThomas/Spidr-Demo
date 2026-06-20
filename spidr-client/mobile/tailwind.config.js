/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        spidr: {
          red: '#dc2626',
          'red-dark': '#991b1b',
          dark: '#111111',
          gray: '#1f1f1f',
          'gray-light': '#2a2a2a',
        },
      },
    },
  },
  plugins: [],
};
