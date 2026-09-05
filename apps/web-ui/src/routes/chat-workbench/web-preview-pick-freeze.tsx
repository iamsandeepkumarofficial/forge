import type { PreviewPick } from "./preview-nav.js";
import { PreviewFreezeLayer } from "./preview-comment-card.js";

export function PreviewPickFreeze({ pick }: { pick: PreviewPick | null }) {
  if (!pick?.pageShot) return null;
  return (
    <PreviewFreezeLayer
      src={pick.pageShot}
      anchor={pick.anchor}
      viewport={pick.viewport}
    />
  );
}
