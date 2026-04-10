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
        background: '#111214',
        surface: '#1a1b1e',
        'surface-2': '#222326',
        border: '#2a2b2e',
        primary: '#00e676',
        'primary-dark': '#00c853',
        danger: '#ff5252',
        warning: '#ff9800',
        muted: '#6b7280',
        'text-primary': '#f4f4f5',
        'text-secondary': '#a1a1aa',
      },
    },
  },
  plugins: [],
}
