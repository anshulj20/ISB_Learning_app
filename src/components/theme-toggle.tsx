"use client";

import { useEffect, useState } from "react";

type ThemeChoice = "system" | "light" | "dark";
const STORAGE_KEY = "theme";
const ORDER: ThemeChoice[] = ["system", "light", "dark"];
const LABEL: Record<ThemeChoice, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", choice);
  }
}

export function ThemeToggle() {
  // Start "system" on the server render; the blocking script in layout.tsx
  // already set the real attribute before paint, so this just needs to
  // sync its own label after mount — no flash either way.
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeChoice | null;
    if (stored && ORDER.includes(stored)) setChoice(stored);
  }, []);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];
    setChoice(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  return (
    <button
      onClick={cycle}
      className="text-xs text-text/50 hover:text-text px-2 py-1.5 -mx-2 rounded transition-colors text-left"
      title="Cycle theme: system / light / dark"
    >
      Theme: {LABEL[choice]}
    </button>
  );
}
