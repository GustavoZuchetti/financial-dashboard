/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // Ativa dark mode via atributo data-theme="dark" no <html>
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Tokens via CSS var — funcionam em ambos os temas
        'fs-bg':        'var(--fs-bg)',
        'fs-surface':   'var(--fs-surface)',
        'fs-surface-2': 'var(--fs-surface-2)',
        'fs-surface-3': 'var(--fs-surface-3)',
        'fs-border':    'var(--fs-border)',
        'fs-border-2':  'var(--fs-border-2)',
        'fs-brand':     'var(--fs-brand)',
        'fs-text-1':    'var(--fs-text-1)',
        'fs-text-2':    'var(--fs-text-2)',
        'fs-text-3':    'var(--fs-text-3)',
        'fs-text-4':    'var(--fs-text-4)',
        'fs-success':   'var(--fs-success)',
        'fs-danger':    'var(--fs-danger)',
        'fs-warning':   'var(--fs-warning)',
        'fs-purple':    'var(--fs-purple)',
      },
      transitionProperty: {
        'theme': 'background-color, border-color, color, fill, stroke',
      },
      transitionDuration: { 'theme': '300ms' },
    },
  },
  plugins: [],
}
