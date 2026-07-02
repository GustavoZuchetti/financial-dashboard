// ─── SvgIcon — Biblioteca de ícones SVG do sistema Facesign ──────────────────
// Uso: <SvgIcon name="edit" size={15} color="currentColor" style={{...}} />
// Todos os ícones são outline (stroke), 24×24 viewBox, consistentes com o Sidebar.

export const ICON_PATHS = {
  // ── Usuário / Organização ──────────────────────────────────────────────────
  user:         'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z',
  users:        'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
  building:     'M3 21h18 M9 8h1 M9 12h1 M9 16h1 M14 8h1 M14 12h1 M14 16h1 M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16',
  palette:      'M12 2a10 10 0 100 20 M12 2c-2.5 5-2.5 15 0 20 M2 12h20 M4.2 7h15.6 M4.2 17h15.6',
  paintBrush:   'M18.37 2.63L14 7l-1.59-1.59a2 2 0 00-2.82 0L8 7l9 9 1.59-1.59a2 2 0 000-2.82L17 10l4.37-4.37a2.12 2.12 0 00-3-3z M3 21v-4l9-9',

  // ── Ações ──────────────────────────────────────────────────────────────────
  edit:         'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  save:         'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z M17 21v-8H7v8 M7 3v5h8',
  trash:        'M3 6h18 M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6 M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2',
  close:        'M18 6L6 18 M6 6l12 12',
  copy:         'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2 M16 8h2a2 2 0 012 2v10a2 2 0 01-2 2h-8a2 2 0 01-2-2v-2',
  link:         'M15 7h3a5 5 0 010 10h-3 M9 17H6A5 5 0 016 7h3 M8 12h8',
  upload:       'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  download:     'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  refresh:      'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  check:        'M20 6L9 17l-5-5',

  // ── Navegação / UI ─────────────────────────────────────────────────────────
  chevronDown:  'M6 9l6 6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  arrowLeft:    'M19 12H5 M12 19l-7-7 7-7',
  arrowRight:   'M5 12h14 M12 5l7 7-7 7',
  eye:          'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 100 6 3 3 0 000-6z',
  lock:         'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z M7 11V7a5 5 0 0110 0v4',
  info:         'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 8v4 M12 16h.01',
  alert:        'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01',
  layers:       'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
  settings:     'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',

  // ── Finanças / Dados ───────────────────────────────────────────────────────
  calendar:     'M8 7V3 M16 7V3 M3 11h18 M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  chartBar:     'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  chartLine:    'M22 12h-4l-3 9L9 3l-3 9H2',
  trendingUp:   'M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6',
  inbox:        'M22 12h-6l-2 3h-4l-2-3H2 M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z',
  search:       'M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.35-4.35',
  building:     'M3 21h18 M5 21V7l7-4 7 4v14 M9 9h1 M9 13h1 M9 17h1 M14 9h1 M14 13h1 M14 17h1',
  trendingDown: 'M23 18l-9.5-9.5-5 5L1 6 M17 18h6v-6',
  wallet:       'M21 12V7H5a2 2 0 010-4h14v4 M3 7v12a2 2 0 002 2h16v-5 M16 14a1 1 0 100 2 1 1 0 000-2z',
  bank:         'M3 21h18 M6 21V7 M18 21V7 M3 7l9-4 9 4',
  presentation: 'M4 3h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z M8 21l4-4 4 4 M12 17V8',
  image:        'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M21 15l-5-5L5 20',
  fileText:     'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  grid:         'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
}

export default function SvgIcon({ name, size = 16, color = 'currentColor', style = {} }) {
  const d = ICON_PATHS[name]
  if (!d) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {d.split(' M').map((p, i) => (
        <path key={i} d={i === 0 ? p : 'M' + p} />
      ))}
    </svg>
  )
}
