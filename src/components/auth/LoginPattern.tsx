// Trame décorative de la page de connexion : carrés sur grille, sans dégradé de couleur ni flou.
const ACCENT = [
  [2, 1],
  [7, 3],
  [3, 9],
  [12, 11],
  [18, 2],
];
const BRAND = [
  [5, 12],
  [15, 6],
  [20, 10],
];

export function LoginPattern() {
  return (
    <div
      aria-hidden="true"
      className="login-pattern pointer-events-none absolute inset-0 overflow-hidden"
    >
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="login-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <rect x="17" y="17" width="14" height="14" className="fill-foreground" opacity="0.05" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#login-grid)" />
        {ACCENT.map(([c, r]) => (
          <rect key={`a${c}-${r}`} x={c * 48 + 17} y={r * 48 + 17} width="14" height="14" className="fill-primary" opacity="0.35" />
        ))}
        {BRAND.map(([c, r]) => (
          <rect key={`b${c}-${r}`} x={c * 48 + 17} y={r * 48 + 17} width="14" height="14" className="fill-fabsci-blue" opacity="0.08" />
        ))}
      </svg>
    </div>
  );
}
