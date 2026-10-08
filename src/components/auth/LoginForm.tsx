import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPwd: boolean;
  setShowPwd: (fn: (v: boolean) => boolean) => void;
  submitting: boolean;
  error: string;
  idleTimeout: boolean;
  onSubmit: (e: React.FormEvent) => void;
  remember: boolean;
  setRemember: (v: boolean) => void;
  authReady: boolean;
};

const inputCls =
  "h-11 w-full rounded-md border border-input bg-background pl-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const alertCls = "flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm";

export function LoginForm({
  email,
  setEmail,
  password,
  setPassword,
  showPwd,
  setShowPwd,
  submitting,
  error,
  idleTimeout,
  onSubmit,
  remember,
  setRemember,
  authReady,
}: Props) {
  const [caps, setCaps] = useState(false);
  const checkCaps = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.("CapsLock") ?? false);
  return (
    <form className="space-y-4" onSubmit={onSubmit} action="javascript:void(0)" noValidate>
      {idleTimeout && (
        <div className={cn(alertCls, "border-warning/30 bg-warning/10 text-warning")}>
          <AlertCircle className="h-4 w-4 shrink-0" />
          Vous avez été déconnecté automatiquement après 15 minutes d'inactivité.
        </div>
      )}
      {error && (
        <div role="alert" tabIndex={-1} ref={(el) => el?.focus()} className={cn(alertCls, "border-destructive/30 bg-destructive/10 text-destructive")}>
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="login-email" className="block text-sm font-medium text-foreground">
          Adresse e-mail
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="login-email"
            type="email"
            name="email"
            placeholder="exemple@etablissement.ci"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            inputMode="email"
            autoFocus
            required
            data-testid="login-email-input"
            className={cn(inputCls, "pr-3")}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="login-password" className="block text-sm font-medium text-foreground">
            Mot de passe
          </label>
          <a href="/reset-password" className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
            Mot de passe oublié ?
          </a>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="login-password"
            type={showPwd ? "text" : "password"}
            name="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            onKeyUp={checkCaps}
            onKeyDown={checkCaps}
            aria-describedby={caps ? "caps-warning" : undefined}
            required
            data-testid="login-password-input"
            className={cn(inputCls, "pr-10")}
          />
          <button
            type="button"
            onClick={() => setShowPwd((v) => !v)}
            data-testid="toggle-password"
            aria-pressed={showPwd}
            aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {caps && (
          <p id="caps-warning" className="text-xs text-warning">Verr. Maj. activée</p>
        )}
      </div>

      <div>
      <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-foreground">
        <Checkbox
          checked={remember}
          onCheckedChange={(v) => setRemember(v === true)}
          data-testid="login-remember"
        />
        Se souvenir de moi sur cet appareil
      </label>
      <p className="mt-1 pl-6 text-xs text-muted-foreground">À ne pas cocher sur un poste partagé.</p>
      </div>

      <Button
        type="submit"
        disabled={!authReady || submitting}
        data-testid="login-submit-btn"
        className="h-11 w-full shadow-none"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? "Connexion en cours…" : "Se connecter"}
      </Button>
    </form>
  );
}
