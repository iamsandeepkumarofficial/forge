import {
  useEffect,
  type Dispatch,
  type RefObject,
  type SetStateAction
} from "react";
import type { PreviewPick } from "./preview-nav.js";
import { handlePreviewInspectMessage } from "./preview-inspect-message.js";
import {
  usePreviewEscapeKey,
  usePreviewInspectPost
} from "./use-preview-inspect-effects.js";

function usePreviewInspectMessages(options: {
  commenting: boolean;
  appUrl: string;
  addressRef: RefObject<string>;
  historyRef: RefObject<string[]>;
  histIndexRef: RefObject<number>;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  setHistory: Dispatch<SetStateAction<string[]>>;
  setHistIndex: Dispatch<SetStateAction<number>>;
  setAddress: Dispatch<SetStateAction<string>>;
  setPick: Dispatch<SetStateAction<PreviewPick | null>>;
}) {
  const {
    commenting,
    appUrl,
    addressRef,
    historyRef,
    histIndexRef,
    iframeRef,
    setHistory,
    setHistIndex,
    setAddress,
    setPick
  } = options;

  useEffect(() => {
    if (!appUrl) return;
    const origin = new URL(appUrl).origin;
    const onMessage = (e: MessageEvent) => {
      handlePreviewInspectMessage({
        e,
        origin,
        commenting,
        addressRef,
        historyRef,
        histIndexRef,
        iframeRef,
        setHistory,
        setHistIndex,
        setAddress,
        setPick
      });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [
    commenting,
    appUrl,
    addressRef,
    historyRef,
    histIndexRef,
    iframeRef,
    setHistory,
    setHistIndex,
    setAddress,
    setPick
  ]);
}

export function useWebPreviewInspect(options: {
  commenting: boolean;
  cropping: boolean;
  appUrl: string;
  address: string;
  reloadNonce: number;
  cacheBust: number;
  addressRef: RefObject<string>;
  historyRef: RefObject<string[]>;
  histIndexRef: RefObject<number>;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  setCommenting: Dispatch<SetStateAction<boolean>>;
  setCropping: Dispatch<SetStateAction<boolean>>;
  setPick: Dispatch<SetStateAction<PreviewPick | null>>;
  setDraft: Dispatch<SetStateAction<string>>;
  setHistory: Dispatch<SetStateAction<string[]>>;
  setHistIndex: Dispatch<SetStateAction<number>>;
  setAddress: Dispatch<SetStateAction<string>>;
}) {
  usePreviewEscapeKey(options);
  usePreviewInspectPost(options);
  usePreviewInspectMessages(options);
}
