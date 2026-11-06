import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      variant="outline"
      onClick={toggle}
      className="h-9 rounded-md px-3"
      aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
      title={isDark ? "Mode clair" : "Mode sombre"}
    >
      {isDark ? "Clair" : "Sombre"}
    </Button>
  );
}
