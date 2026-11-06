export function LoginStyles() {
  return (
    <style>{`
      .login-pattern {
        -webkit-mask-image: radial-gradient(ellipse 55% 50% at 50% 45%, transparent 35%, #000 100%);
        mask-image: radial-gradient(ellipse 55% 50% at 50% 45%, transparent 35%, #000 100%);
      }
      .fill-fabsci-blue { fill: var(--fabsci-blue-electric, currentColor); }
      /* Habillage « verre dépoli » : thème sombre propre à la page de connexion. */
      .login-glass {
        --background: oklch(0.17 0.045 264);
        --foreground: oklch(0.98 0.005 262);
        --muted-foreground: oklch(0.78 0.025 262);
        --border: oklch(1 0 0 / 0.14);
        --input: oklch(1 0 0 / 0.22);
        --ring: oklch(0.82 0.13 205);
        --primary: oklch(0.82 0.13 205);
        --primary-foreground: oklch(0.15 0.03 264);
        background-image:
          radial-gradient(60% 50% at 15% 10%, oklch(0.32 0.1 250 / 0.55), transparent 70%),
          radial-gradient(50% 45% at 90% 90%, oklch(0.4 0.09 205 / 0.35), transparent 70%);
        color: var(--foreground);
      }
      .login-glass input[type="email"],
      .login-glass input[type="text"],
      .login-glass input[type="password"] { background: oklch(1 0 0 / 0.06); }
      .login-glass-card {
        border-radius: 1.25rem;
        overflow: hidden;
        border: 1px solid oklch(1 0 0 / 0.12);
        background: oklch(0.2 0.045 264 / 0.88);
        box-shadow: 0 24px 60px -20px rgb(2 6 23 / 0.7), inset 0 1px 0 oklch(1 0 0 / 0.06);
        animation: login-glass-in 260ms ease-out both;
      }
      @supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
        .login-glass-card {
          background: oklch(0.2 0.045 264 / 0.7);
          -webkit-backdrop-filter: blur(16px) saturate(140%);
          backdrop-filter: blur(16px) saturate(140%);
        }
      }
      .login-glass-welcome {
        flex-direction: column;
        justify-content: center;
        gap: 1.5rem;
        padding: 2.5rem;
        border-right: 1px solid oklch(1 0 0 / 0.1);
        background: linear-gradient(135deg, oklch(1 0 0 / 0.07), oklch(1 0 0 / 0.01) 60%);
      }
      @keyframes login-glass-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: none; }
      }
      @media (max-width: 767px) {
        .login-glass-card { background: oklch(0.2 0.045 264 / 0.88); }
      }
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
