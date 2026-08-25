"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

function subscribe() {
  return () => undefined;
}

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  const toggle = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };
  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="icon-sm"
        className="shrink-0"
        disabled
        aria-hidden
      >
        <Sun className="size-4" />
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className="shrink-0"
      onClick={toggle}
      title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
      aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
    >
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </Button>
  );
}
