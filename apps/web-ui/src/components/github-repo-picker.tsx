import { GithubRepoPickerView } from "./github-repo-picker-view.js";
import { useGithubRepoPicker } from "./use-github-repo-picker.js";

export function GithubRepoPicker(options: {
  open: boolean;
  onClose: () => void;
  onSelect: (fullName: string) => void | Promise<void>;
  connectingSlug?: string | null;
}) {
  const { open, onClose, onSelect, connectingSlug } = options;
  const state = useGithubRepoPicker({ open, connectingSlug });
  if (!open) return null;
  return (
    <GithubRepoPickerView
      state={state}
      onClose={onClose}
      onSelect={onSelect}
      connectingSlug={connectingSlug}
    />
  );
}
