"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeSwitcher() {
  const { setTheme, resolvedTheme } = useTheme();
  const iconTheme = (resolvedTheme ?? "light") as "light" | "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Toggle theme"
      title={iconTheme === "dark" ? "切换到亮色" : "切换到暗色"}
      onClick={() => {
        // If current mode is "system", resolvedTheme tells us what's active now.
        const current = (resolvedTheme ?? "light") as "light" | "dark";
        setTheme(current === "dark" ? "light" : "dark");
      }}
    >
      {iconTheme === "dark" ? <MoonIcon /> : <SunIcon />}
    </Button>
  );
}

