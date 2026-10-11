import { Injectable, computed, effect, signal } from '@angular/core';
import { Application, ApplicationDraft, STAGES, Stage } from './application.model';
import { addDays, followUpStatus, today } from './dates';

const STORAGE_KEY = 'job-tracker.applications.v1';
/** A week is a common, polite gap before chasing an application. */
const FOLLOW_UP_AFTER_DAYS = 7;

function load(): Application[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Storage unavailable or corrupt: start fresh.
  }
  return [];
}

@Injectable({ providedIn: 'root' })
export class ApplicationsService {
  private readonly store = signal<Application[]>(load());

  readonly all = this.store.asReadonly();

  readonly countsByStage = computed(() => {
    const counts = new Map<Stage, number>(STAGES.map((s) => [s.id, 0]));
    for (const app of this.store()) counts.set(app.stage, (counts.get(app.stage) ?? 0) + 1);
    return counts;
  });

  /** Overdue first, then due today. */
  readonly dueFollowUps = computed(() => {
    const on = today();
    return this.store()
      .filter((a) => {
        const status = followUpStatus(a, on);
        return status === 'overdue' || status === 'today';
      })
      .sort((a, b) => a.followUpOn!.localeCompare(b.followUpOn!));
  });

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store()));
      } catch {
        // Ignore quota or privacy-mode failures; the board still works in memory.
      }
    });
  }

  add(draft: ApplicationDraft): void {
    const app = this.withStageDefaults({ ...draft, id: crypto.randomUUID(), createdAt: Date.now() });
    this.store.update((apps) => [...apps, app]);
  }

  update(id: string, draft: ApplicationDraft): void {
    this.store.update((apps) => apps.map((a) => (a.id === id ? this.withStageDefaults({ ...a, ...draft }, a.stage) : a)));
  }

  remove(id: string): void {
    this.store.update((apps) => apps.filter((a) => a.id !== id));
  }

  /** Moves an application to `stage`, placing it before `beforeId` (or last in that stage when null). */
  move(id: string, stage: Stage, beforeId: string | null): void {
    this.store.update((apps) => {
      const app = apps.find((a) => a.id === id);
      if (!app) return apps;
      const rest = apps.filter((a) => a.id !== id);
      const index = beforeId ? rest.findIndex((a) => a.id === beforeId) : -1;
      rest.splice(index < 0 ? rest.length : index, 0, this.withStageDefaults({ ...app, stage }, app.stage));
      return rest;
    });
  }

  completeFollowUp(id: string): void {
    this.store.update((apps) => apps.map((a) => (a.id === id ? { ...a, followUpOn: null } : a)));
  }

  snoozeFollowUp(id: string): void {
    const next = addDays(today(), FOLLOW_UP_AFTER_DAYS);
    this.store.update((apps) => apps.map((a) => (a.id === id ? { ...a, followUpOn: next } : a)));
  }

  clear(): void {
    this.store.set([]);
  }

  loadSample(): void {
    const t = today();
    const sample = (
      company: string,
      role: string,
      stage: Stage,
      location: string,
      salary: string,
      appliedDaysAgo: number | null,
      followUpIn: number | null,
      notes = '',
    ): Application => ({
      id: crypto.randomUUID(),
      company,
      role,
      stage,
      location,
      salary,
      url: '',
      appliedOn: appliedDaysAgo == null ? null : addDays(t, -appliedDaysAgo),
      followUpOn: followUpIn == null ? null : addDays(t, followUpIn),
      notes,
      createdAt: Date.now(),
    });
    this.store.set([
      sample('Northwind Labs', 'Frontend Engineer', 'wishlist', 'Remote', '', null, null, 'Referral possible through Priya.'),
      sample('Kestrel Health', 'Angular Developer', 'wishlist', 'Bengaluru', '₹28–34 LPA', null, null),
      sample('Brightline', 'Software Engineer II', 'applied', 'Hyderabad', '', 9, -2),
      sample('Fieldnote', 'UI Engineer', 'applied', 'Remote', '$110k', 4, 3),
      sample('Paperplane', 'Frontend Developer', 'applied', 'Pune', '', 7, 0),
      sample('Orbital Pay', 'Senior Frontend Engineer', 'interviewing', 'Bengaluru', '₹40 LPA', 15, 1, 'Tech round Thursday. Revise RxJS and change detection.'),
      sample('Tandem', 'Full-stack Engineer', 'interviewing', 'Remote', '', 20, null, 'Take-home submitted.'),
      sample('Lumen Analytics', 'Frontend Engineer', 'offer', 'Chennai', '₹32 LPA', 30, 2, 'Offer expires next Friday.'),
      sample('Grove', 'Web Developer', 'closed', 'Remote', '', 25, null, 'Rejected after first round.'),
    ]);
  }

  /** Stamps the applied date and schedules a follow-up the first time an application reaches "Applied". */
  private withStageDefaults(app: Application, previous?: Stage): Application {
    if (app.stage !== 'applied' || previous === 'applied') return app;
    const appliedOn = app.appliedOn ?? today();
    return { ...app, appliedOn, followUpOn: app.followUpOn ?? addDays(appliedOn, FOLLOW_UP_AFTER_DAYS) };
  }
}
