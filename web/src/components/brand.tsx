export function Brand() {
  const name = import.meta.env.VITE_INSTITUTION_NAME || 'Portal de Estágios';
  const logo = import.meta.env.VITE_INSTITUTION_LOGO as string | undefined;
  return <div className="brand">{logo ? <img src={logo} alt={name} /> : <span className="brand-wordmark">{name}</span>}<span className="brand-divider" /><span className="product-name">Estágio Flow</span></div>;
}
