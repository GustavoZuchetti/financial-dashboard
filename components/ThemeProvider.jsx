'use client'
import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const ThemeContext = createContext({ theme: 'dark', toggle: () => {} })
export const useTheme = () => useContext(ThemeContext)

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('fs-theme') || 'dark'
    setTheme(saved)
    document.documentElement.setAttribute('data-theme', saved)
    setMounted(true)
  }, [])

  const toggle = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('fs-theme', next)
      document.documentElement.setAttribute('data-theme', next)
      return next
    })
  }, [])

  // Não renderiza até montar para evitar hydration mismatch
  if (!mounted) return <>{children}</>

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}
