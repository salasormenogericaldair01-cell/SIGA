export default function Brand({ compact = false, inverse = false }) {
  return <span className={`brand-lockup ${inverse ? 'brand-lockup-inverse' : ''}`}>
    <span className="brand-symbol" aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none" focusable="false">
        <rect x="1" y="1" width="46" height="46" rx="14" fill="currentColor" />
        <path d="M9 15.5c5.2-1.8 10.5-.9 15 2.1 4.5-3 9.8-3.9 15-2.1v17.1c-5.3-1.8-10.5-.8-15 2.2-4.5-3-9.7-4-15-2.2V15.5Z" fill="white" />
        <path d="M24 17.6v17.2M14 21c2.1-.3 4.2 0 6.2.9M28 21.9c2-.9 4.1-1.2 6.2-.9" stroke="#172554" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M24 8.5v5.1M17.4 10.5l2.5 3.7M30.6 10.5l-2.5 3.7" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </span>
    {!compact && <span className="brand-wordmark"><strong>SIGA</strong><small>Sistema de Gestión Académica</small></span>}
  </span>;
}
