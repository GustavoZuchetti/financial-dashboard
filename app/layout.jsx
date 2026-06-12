import './globals.css'
import { ToastProvider } from '@/components/Toast'
import { OrgProvider } from '@/lib/org-context'

export const metadata = {
  title: 'Facesign — Financeiro',
  description: 'Plataforma de gestão financeira estratégica · Facesign',
  icons: { icon: '/favicon.ico' },
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
