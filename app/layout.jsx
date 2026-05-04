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
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  )
}
