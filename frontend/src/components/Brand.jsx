export default function Brand({ compact = false, inverse = false }) {
  return <span className={`brand-lockup ${inverse ? 'brand-lockup-inverse' : ''} ${compact ? 'brand-lockup-compact' : ''}`}>
    <img className="brand-logo" src="/images/siga-logo.png" alt="SIGA — Sistema de Gestión Académica" />
  </span>;
}
