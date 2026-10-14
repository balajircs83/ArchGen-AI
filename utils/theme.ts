import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';
const KEY = 'archgen-theme';
const listeners = new Set<() => void>();
const get = () => (document.documentElement.dataset.theme as Theme) || 'dark';

export const setTheme = (t: Theme) => {
  document.documentElement.dataset.theme = t;
  localStorage.setItem(KEY, t);
  listeners.forEach((l) => l());
};

export const initTheme = () => {
  const saved = localStorage.getItem(KEY) as Theme | null;
  document.documentElement.dataset.theme =
    saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
};

export const useTheme = () => {
  const theme = useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, get);
  return [theme, () => setTheme(theme === 'dark' ? 'light' : 'dark')] as const;
};

// Matches the --surface token; used for canvas export backgrounds.
export const surfaceColor = (t: Theme) => (t === 'dark' ? '#171a20' : '#ffffff');
