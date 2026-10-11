import { Application, FollowUpStatus } from './application.model';

/** Local-time yyyy-mm-dd; toISOString() would shift the date for anyone east or west of UTC. */
export function toISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function today(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return toISODate(new Date(y, m - 1, d + days));
}

/** Whole days from `from` to `to`; positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  const parse = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

export function followUpStatus(app: Application, on: string): FollowUpStatus | null {
  if (!app.followUpOn || app.stage === 'closed') return null;
  if (app.followUpOn < on) return 'overdue';
  if (app.followUpOn === on) return 'today';
  return 'upcoming';
}

export function relativeDays(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days === -1) return 'tomorrow';
  return days > 0 ? `${days} days ago` : `in ${-days} days`;
}
