const BLANK = "about:blank";

export type ElectronPreviewLoadApi = {
  setVisible: (visible: boolean) => Promise<void>;
  loadURL: (url: string) => Promise<void>;
  reload: (ignoreCache?: boolean) => Promise<void>;
};

let opSeq = 0;
let opTail: Promise<void> = Promise.resolve();

export function resetElectronPreviewOpsForTests(): void {
  opSeq += 1;
  opTail = Promise.resolve();
}

function enqueuePreviewOp(
  run: (isCurrent: () => boolean) => Promise<void>
): void {
  const id = ++opSeq;
  const isCurrent = () => id === opSeq;
  opTail = opTail
    .then(() => (isCurrent() ? run(isCurrent) : undefined))
    .catch(() => undefined);
}

export function loadElectronPreviewPage(options: {
  api: ElectronPreviewLoadApi;
  url: string;
  reload?: boolean;
  ignoreCache?: boolean;
}): void {
  const { api, url } = options;
  enqueuePreviewOp(async (isCurrent) => {
    if (!isCurrent()) return;
    if (!url) {
      await api.setVisible(false);
      if (!isCurrent()) return;
      await api.loadURL(BLANK);
      return;
    }
    if (options.reload) {
      await api.reload(options.ignoreCache === true);
      return;
    }
    await api.loadURL(url);
  });
}
