"use client";

import { useEffect, useState, useCallback, useMemo, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";

// 空的订阅函数，用于 useSyncExternalStore
function subscribe(callback: () => void) {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

// 获取当前系统主题偏好
function getSystemPreference(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// 获取存储的主题 (用于惰性初始化)
function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem("mobius-theme") as Theme) ?? "system";
}

// 检查是否已挂载
function getMountedSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

export function ThemeToggle() {
  // 使用 useSyncExternalStore 订阅系统主题变化
  const systemPreference = useSyncExternalStore(
    subscribe,
    getSystemPreference,
    () => "light" as const,
  );

  // 使用惰性初始化从 localStorage 读取主题
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  // 使用 useSyncExternalStore 追踪挂载状态
  const mounted = useSyncExternalStore(
    () => () => {},
    getMountedSnapshot,
    getServerSnapshot,
  );

  // 计算实际应用的主题
  const resolvedTheme = useMemo((): "light" | "dark" => {
    if (theme === "system") return systemPreference;
    return theme;
  }, [theme, systemPreference]);

  // 应用主题到 DOM
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  // 同步主题状态到 localStorage
  useEffect(() => {
    localStorage.setItem("mobius-theme", theme);
  }, [theme]);

  const toggle = useCallback(() => {
    // 循环切换: light -> dark -> system -> light
    const nextMap: Record<Theme, Theme> = {
      light: "dark",
      dark: "system",
      system: "light",
    };
    setTheme((current) => nextMap[current]);
  }, []);

  const labelMap: Record<Theme, string> = useMemo(() => ({
    light: "亮色",
    dark: "暗色",
    system: "自动",
  }), []);

  if (!mounted) {
    return (
      <button
        type="button"
        className="theme-toggle"
        aria-label="主题切换"
        data-testid="theme-toggle"
      >
        自动
      </button>
    );
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={`当前: ${labelMap[theme]}模式`}
      data-testid="theme-toggle"
    >
      {labelMap[theme]}
    </button>
  );
}
