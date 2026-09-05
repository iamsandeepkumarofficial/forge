import {
  useEffect,
  type Dispatch,
  type RefObject,
  type SetStateAction
} from "react";
import type { PreviewPick } from "./preview-nav.js";

export function usePreviewEscapeKey(options: {
  commenting: boolean;
  cropping: boolean;
  setCommenting: Dispatch<SetStateAction<boolean>>;
  setCropping: Dispatch<SetStateAction<boolean>>;
  setPick: Dispatch<SetStateAction<PreviewPick | null>>;
  setDraft: Dispatch<SetStateAction<string>>;
}) {
  const {
    commenting,
    cropping,
    setCommenting,
    setCropping,
    setPick,
    setDraft
  } = options;

  useEffect(() => {
    if (!commenting && !cropping) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (cropping) setCropping(false);
      if (commenting) {
        setCommenting(false);
        setPick(null);
        setDraft("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commenting, cropping, setCommenting, setCropping, setPick, setDraft]);
}

export function usePreviewInspectPost(options: {
  commenting: boolean;
  appUrl: string;
  address: string;
  reloadNonce: number;
  cacheBust: number;
  iframeRef: RefObject<HTMLIFrameElement | null>;
}) {
  const { commenting, appUrl, address, reloadNonce, cacheBust, iframeRef } =
    options;

  useEffect(() => {
    if (!appUrl) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(
        { type: "forge-inspect-set", on: commenting },
        new URL(appUrl).origin
      );
    } catch {
      void 0;
    }
  }, [commenting, appUrl, address, reloadNonce, cacheBust, iframeRef]);
}
