import { Application } from './application.model';
import { addDays, daysBetween, followUpStatus, relativeDays } from './dates';

function app(overrides: Partial<Application>): Application {
  return {
    id: '1', company: 'Acme', role: 'Dev', stage: 'applied', location: '', url: '', salary: '',
    appliedOn: null, followUpOn: null, notes: '', createdAt: 0, ...overrides,
  };
}

describe('dates', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-28', 7)).toBe('2026-02-04');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('counts whole days regardless of daylight saving changes', () => {
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
    expect(daysBetween('2026-10-11', '2026-10-04')).toBe(-7);
  });

  it('classifies follow-ups and ignores closed applications', () => {
    const on = '2026-10-11';
    expect(followUpStatus(app({ followUpOn: '2026-10-09' }), on)).toBe('overdue');
    expect(followUpStatus(app({ followUpOn: on }), on)).toBe('today');
    expect(followUpStatus(app({ followUpOn: '2026-10-20' }), on)).toBe('upcoming');
    expect(followUpStatus(app({ followUpOn: '2026-10-09', stage: 'closed' }), on)).toBeNull();
    expect(followUpStatus(app({}), on)).toBeNull();
  });

  it('describes relative days in plain words', () => {
    expect(relativeDays(0)).toBe('today');
    expect(relativeDays(1)).toBe('yesterday');
    expect(relativeDays(5)).toBe('5 days ago');
    expect(relativeDays(-3)).toBe('in 3 days');
  });
});
