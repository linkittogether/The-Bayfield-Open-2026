import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function netScore9(gross: number, handicap: number): number {
  return gross - Math.floor(handicap / 2);
}

export function formatScore(score: number): string {
  if (score > 0) return `+${score}`;
  return String(score);
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
