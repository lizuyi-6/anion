"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem("mobius-theme");
  return stored === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(getStoredTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("mobius-theme", theme);
  }, [theme]);

  const toggle = () => {
    setTheme((current) => (current === "light" ? "dark" : "light"));
  };

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={theme === "light" ? "切换暗色模式" : "切换亮色模式"}
      data-testid="theme-toggle"
    >
      {theme === "light" ? "暗色" : "亮色"}
    </button>
  );
}
