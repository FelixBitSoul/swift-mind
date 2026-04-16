"use client";

import { LaptopIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEME_LABELS: Record<"system" | "light" | "dark", string> = {
  system: "跟随系统",
  light: "亮色",
  dark: "暗色",
};

export function ThemeSwitcher() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const currentTheme = (theme ?? "system") as "system" | "light" | "dark";
  const iconTheme = (resolvedTheme ?? "light") as "light" | "dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Switch theme"
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="data-popup-open:bg-muted data-popup-open:text-foreground"
          />
        }
      >
        {iconTheme === "dark" ? <MoonIcon /> : <SunIcon />}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="min-w-40">
        <DropdownMenuRadioGroup value={currentTheme} onValueChange={(value) => setTheme(value)}>
          <DropdownMenuRadioItem value="system" className="gap-2">
            <LaptopIcon className="size-4" />
            {THEME_LABELS.system}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light" className="gap-2">
            <SunIcon className="size-4" />
            {THEME_LABELS.light}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="gap-2">
            <MoonIcon className="size-4" />
            {THEME_LABELS.dark}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

