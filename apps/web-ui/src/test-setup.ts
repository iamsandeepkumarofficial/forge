import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

const memoryStore = new Map<string, string>();
const localStorageMock: Storage = {
  get length() {
    return memoryStore.size;
  },
  clear() {
    memoryStore.clear();
  },
  getItem(key: string) {
    return memoryStore.has(key) ? memoryStore.get(key)! : null;
  },
  key(index: number) {
    return [...memoryStore.keys()][index] ?? null;
  },
  removeItem(key: string) {
    memoryStore.delete(key);
  },
  setItem(key: string, value: string) {
    memoryStore.set(key, String(value));
  }
};

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  configurable: true
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, "ResizeObserver", {
  value: ResizeObserverMock,
  configurable: true
});

afterEach(() => {
  cleanup();
  memoryStore.clear();
});
