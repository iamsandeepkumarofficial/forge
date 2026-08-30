import { WINDOW_HEIGHT, WINDOW_WIDTH } from "./types.js";

export type ForgeWindowOptions = {
  title: string;
  width: number;
  height: number;
  webPreferences: {
    preload: string;
    contextIsolation: true;
    nodeIntegration: false;
    sandbox: true;
  };
};

export function browserWindowOptions(preloadPath: string): ForgeWindowOptions {
  return {
    title: "Forge",
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  };
}
