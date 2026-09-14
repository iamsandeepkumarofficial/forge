import { useCallback } from "react";
import { pickFromElectron } from "./preview-pick.js";
import { capturePickShot } from "./preview-pick.js";
import { shotRectToBounds } from "./preview-overflow.js";
import { PREVIEW_FREEZE_FALLBACK } from "./preview-comment-card.js";
import type {
  ForgeDesktopPreview,
  PreviewPickResult
} from "../../lib/desktop-preview.js";
import type { PreviewPick } from "./preview-nav.js";
import type { Dispatch, SetStateAction } from "react";

export function usePreviewElectronPick(options: {
  previewApi: Pick<ForgeDesktopPreview, "capturePage"> | null;
  setPick: Dispatch<SetStateAction<PreviewPick | null>>;
}) {
  const { previewApi, setPick } = options;

  return useCallback(
    (result: PreviewPickResult) => {
      const mapped = pickFromElectron(result);
      setPick(mapped.pick);
      if (!previewApi) return;
      void previewApi.capturePage().then(
        (img) => {
          setPick((cur) => (cur ? { ...cur, pageShot: img } : cur));
        },
        () => {
          setPick((cur) =>
            cur ? { ...cur, pageShot: PREVIEW_FREEZE_FALLBACK } : cur
          );
        }
      );
      if (!mapped.rect) return;
      void capturePickShot({
        rect: mapped.rect,
        capture: (area) => previewApi.capturePage(shotRectToBounds(area))
      }).then((s) => {
        if (s) setPick((cur) => (cur ? { ...cur, shot: s } : cur));
      });
    },
    [previewApi, setPick]
  );
}
