import { useState } from "react";
import { postPreviewChatMessage } from "./preview-comment-bus.js";
import { formatPreviewComment, type PreviewPick } from "./preview-nav.js";

export function usePreviewCommentState(onCommentSent?: () => void) {
  const [commenting, setCommenting] = useState(false);
  const [pick, setPick] = useState<PreviewPick | null>(null);
  const [draft, setDraft] = useState("");
  const [cropping, setCropping] = useState(false);
  const sendComment = () => {
    if (!pick) return;
    postPreviewChatMessage(formatPreviewComment(pick, draft));
    setDraft("");
    setPick(null);
    setCommenting(false);
    onCommentSent?.();
  };
  return {
    commenting,
    setCommenting,
    pick,
    setPick,
    draft,
    setDraft,
    cropping,
    setCropping,
    sendComment
  };
}
