import { useColorScheme } from 'react-native';

const light = {
  bg: '#eef1ed',
  surface: '#ffffff',
  sunk: '#e3e8e2',
  fg: '#1a231e',
  muted: '#5b6a61',
  line: '#cfd8d0',
  accent: '#1f5f4a',
  accentFg: '#ffffff',
  accentSoft: '#d6e8df',
  meeple: '#c8452c',
  good: '#2c7a4b',
  warn: '#a06a10',
};

const dark: typeof light = {
  bg: '#111714',
  surface: '#18201c',
  sunk: '#0c110e',
  fg: '#e6ede8',
  muted: '#95a59b',
  line: '#2a362f',
  accent: '#5fbf98',
  accentFg: '#0b1611',
  accentSoft: '#1d3a2e',
  meeple: '#ef7a5f',
  good: '#6fd096',
  warn: '#e2b04f',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const radius = { sm: 8, md: 12, lg: 14 };
export const space = (n: number) => n * 4;
