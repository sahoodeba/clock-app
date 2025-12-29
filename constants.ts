
import { ClockTheme } from './types';

export const COLORS = {
  GOLD: '#D4AF37',
  SOFT_GOLD: '#E6C97A',
  BLACK: '#0B0B0B',
  DARK_GRAY: '#1A1A1A',
  ACCENT_RED: '#FF4C4C',
};

export const THEMES: ClockTheme[] = [
  {
    id: 'gold',
    name: 'Royal Gold',
    primary: '#D4AF37',
    secondary: '#FAE08A',
    accent: '#FF4C4C'
  },
  {
    id: 'platinum',
    name: 'Platinum Silver',
    primary: '#E5E4E2',
    secondary: '#FFFFFF',
    accent: '#00D1FF'
  },
  {
    id: 'rose',
    name: 'Rose Quartz',
    primary: '#B76E79',
    secondary: '#FFC0CB',
    accent: '#FFD700'
  },
  {
    id: 'midnight',
    name: 'Midnight Aurora',
    primary: '#1E90FF',
    secondary: '#87CEFA',
    accent: '#00FFCC'
  }
];

export const CLOCK_SIZE_PRESETS = {
  SMALL: 200,
  MEDIUM: 280,
  LARGE: 380
};

export const DEFAULT_CLOCK_SIZE = CLOCK_SIZE_PRESETS.MEDIUM;
