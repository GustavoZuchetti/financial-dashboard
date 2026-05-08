import './globals.css'
import { Inter } from 'next/font/google'
import { ToastProvider } from '@/components/Toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Facesign — Financeiro',
  description: 'Plataforma de gestão financeira estratégica · Facesign',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {/* Script síncrono: aplica tema ANTES do React hidratar — evita flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var saved = localStorage.getItem('fs-theme');
              var prefer = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
              document.documentElement.setAttribute('data-theme', saved || prefer);
            } catch(e) {
              document.documentElement.setAttribute('data-theme', 'dark');
            }
          })();
        `}} />
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
