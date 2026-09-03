import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from "electron";
import {
  previewOverflowItems,
  parseOverflowMenuArg,
  type PreviewMenuAction,
  type PreviewMenuItem
} from "./previewMenuItems.js";

export function popupPreviewOverflowMenu(
  win: BrowserWindow,
  arg: unknown
): Promise<PreviewMenuAction | null> {
  const opts = parseOverflowMenuArg(arg);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: PreviewMenuAction | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const menu = Menu.buildFromTemplate(
      menuTemplate(previewOverflowItems(opts.zoom), finish)
    );
    const popup: {
      window: BrowserWindow;
      x?: number;
      y?: number;
      callback: () => void;
    } = { window: win, callback: () => finish(null) };
    if (opts.x != null) popup.x = opts.x;
    if (opts.y != null) popup.y = opts.y;
    menu.popup(popup);
  });
}

function menuTemplate(
  items: PreviewMenuItem[],
  finish: (value: PreviewMenuAction | null) => void
): MenuItemConstructorOptions[] {
  return items.map((item) => {
    if (item.type === "separator") return { type: "separator" };
    return {
      label: item.label,
      enabled: item.enabled !== false,
      click: () => finish(item.action)
    };
  });
}
