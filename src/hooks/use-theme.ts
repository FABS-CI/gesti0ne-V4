import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const THEME_KEY = "gesti-theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_KEY);
  return stored === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.setAttribute("data-theme", theme);
  window.localStorage.setItem(THEME_KEY, theme);
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const storedTheme = getStoredTheme();
    setTheme(storedTheme);
    applyTheme(storedTheme);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
