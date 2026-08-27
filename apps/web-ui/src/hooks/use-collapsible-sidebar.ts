import { useCallback, useState } from "react";

export function useCollapsibleSidebar(storageKey: string) {
  const [collapsed, setCollapsedState] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  const setCollapsed = useCallback(
    (value: boolean) => {
      setCollapsedState(value);
      try {
        localStorage.setItem(storageKey, value ? "1" : "0");
      } catch {
        void 0;
      }
    },
    [storageKey]
  );

  const toggle = useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  return { collapsed, setCollapsed, toggle };
}
