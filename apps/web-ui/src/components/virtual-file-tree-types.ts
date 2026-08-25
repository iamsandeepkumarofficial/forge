import type { ReactNode } from "react";

export interface TreeEntry {
  name: string;
  path: string;
  isDir: boolean;
  meta?: unknown;
}
export type GetChildren = (path: string) => Promise<TreeEntry[]>;
export const ROW_H = 22;
export const OVERSCAN = 8;
export const N_12 = 12;
export const N_14 = 14;
export const N_400 = 400;

export interface Row {
  key: string;
  name: string;
  path: string;
  depth: number;
  isDir: boolean;
  meta?: unknown;
  state: "ok" | "loading" | "error";
}

export type VirtualFileTreeProps = {
  getChildren: GetChildren;
  onSelectFile: (path: string) => void;
  selectedPath?: string;
  renderMeta?: (meta: unknown) => ReactNode;
  defaultExpanded?: boolean;
  resetKey?: string;
};
