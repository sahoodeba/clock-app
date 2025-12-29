
export interface TimeState {
  seconds: number;
  minutes: number;
  hours: number;
}

export interface ClockTheme {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
}

export interface Alarm {
  id: string;
  label: string;
  hour: number;
  minute: number;
  date?: string; // ISO format date string YYYY-MM-DD
  isActive: boolean;
}

export interface Lap {
  splitTime: number;
  duration: number;
}

export interface StopwatchState {
  startTime: number | null;
  elapsedTime: number;
  isRunning: boolean;
  laps: Lap[];
}

export interface WeatherData {
  temp: number;
  condition: string;
  location: string;
  sourceUrl?: string;
}

export interface MoonData {
  phase: number; // 0 to 1
  phaseName: string;
  illumination: number; // 0 to 100
}
