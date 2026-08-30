const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("forgeDesktop", {
  pickFolder: () => ipcRenderer.invoke("desktop:pickFolder"),
  getStatus: () => ipcRenderer.invoke("desktop:getStatus"),
  preview: {
    setBounds: (rect) => ipcRenderer.invoke("preview:setBounds", rect),
    setVisible: (visible) => ipcRenderer.invoke("preview:setVisible", visible),
    loadURL: (url) => ipcRenderer.invoke("preview:loadURL", url),
    reload: (ignoreCache) => ipcRenderer.invoke("preview:reload", ignoreCache),
    goBack: () => ipcRenderer.invoke("preview:goBack"),
    goForward: () => ipcRenderer.invoke("preview:goForward"),
    setZoom: (percent) => ipcRenderer.invoke("preview:setZoom", percent),
    setDevtoolsBounds: (rect) =>
      ipcRenderer.invoke("preview:setDevtoolsBounds", rect),
    setDevtoolsVisible: (visible) =>
      ipcRenderer.invoke("preview:setDevtoolsVisible", visible),
    capturePage: (rect) => ipcRenderer.invoke("preview:capturePage", rect),
    clearStorage: (origin) => ipcRenderer.invoke("preview:clearStorage", origin),
    startPick: () => ipcRenderer.invoke("preview:startPick"),
    cancelPick: () => ipcRenderer.invoke("preview:cancelPick"),
    showOverflowMenu: (opts) => ipcRenderer.invoke("preview:overflowMenu", opts),
    onNavigated: (fn) => {
      const listen = (_event, info) => fn(info);
      ipcRenderer.on("preview:navigated", listen);
      return () => ipcRenderer.removeListener("preview:navigated", listen);
    }
  }
});
