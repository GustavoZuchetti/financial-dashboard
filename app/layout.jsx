import './globals.css'
import { ToastProvider } from '@/components/Toast'
import { OrgProvider } from '@/lib/org-context'

export const metadata = {
  title: 'Facesign — Financeiro',
  description: 'Plataforma de gestão financeira estratégica · Facesign',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>
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
        <OrgProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </OrgProvider>
      </body>
    </html>
  )
}
