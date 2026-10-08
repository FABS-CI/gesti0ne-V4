export function LoginStyles() {
  return (
    <style>{`
      .login-pattern {
        -webkit-mask-image: radial-gradient(ellipse 55% 50% at 50% 45%, transparent 35%, #000 100%);
        mask-image: radial-gradient(ellipse 55% 50% at 50% 45%, transparent 35%, #000 100%);
      }
      .fill-fabsci-blue { fill: var(--fabsci-blue-electric, currentColor); }
      @media (max-width: 639px) {
        .login-pattern { opacity: .5; }
        .login-card-box { padding: 24px !important; }
      }
      @media (prefers-reduced-motion: reduce) {
        .login-page-root * { transition: none !important; animation: none !important; }
      }
    `}</style>
  );
}
