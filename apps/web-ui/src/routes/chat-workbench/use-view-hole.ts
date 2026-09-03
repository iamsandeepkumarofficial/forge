import { useEffect, type RefObject } from "react";
import { boundsFromRect, isUsableHole, type ViewBounds } from "../../lib/desktop-preview.js";

export function useViewHole(options: {
  ref: RefObject<HTMLElement | null>;
  active: boolean;
  setBounds: (rect: ViewBounds) => Promise<void>;
  setVisible: (visible: boolean) => Promise<void>;
}): void {
  const { ref, active, setBounds, setVisible } = options;
  useEffect(() => {
    const el = ref.current;
    if (!el || !active) {
      void setVisible(false);
      return undefined;
    }
    const publish = () => {
      const rect = boundsFromRect(el.getBoundingClientRect());
      void setBounds(rect);
      void setVisible(isUsableHole(rect));
    };
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    window.addEventListener("resize", publish);
    publish();
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", publish);
      void setVisible(false);
    };
  }, [ref, active, setBounds, setVisible]);
}
