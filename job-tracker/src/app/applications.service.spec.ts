import { TestBed } from '@angular/core/testing';
import { ApplicationDraft } from './application.model';
import { ApplicationsService } from './applications.service';
import { addDays, today } from './dates';

const draft = (company: string, stage: ApplicationDraft['stage'] = 'wishlist'): ApplicationDraft => ({
  company, role: 'Engineer', stage, location: '', url: '', salary: '', appliedOn: null, followUpOn: null, notes: '',
});

describe('ApplicationsService', () => {
  let service: ApplicationsService;

  beforeEach(() => {
    localStorage.clear();
    service = TestBed.inject(ApplicationsService);
  });

  it('stamps the applied date and a follow-up a week out when an application reaches Applied', () => {
    service.add(draft('Acme'));
    const id = service.all()[0].id;
    service.move(id, 'applied', null);
    const moved = service.all()[0];
    expect(moved.appliedOn).toBe(today());
    expect(moved.followUpOn).toBe(addDays(today(), 7));
  });

  it('keeps dates the user already entered', () => {
    service.add({ ...draft('Acme', 'applied'), appliedOn: '2026-01-05', followUpOn: '2026-01-20' });
    expect(service.all()[0].followUpOn).toBe('2026-01-20');
  });

  it('inserts a moved card before the card it was dropped on', () => {
    service.add(draft('A', 'offer'));
    service.add(draft('B', 'offer'));
    service.add(draft('C'));
    const [a, , c] = service.all();
    service.move(c.id, 'offer', a.id);
    expect(service.all().filter((x) => x.stage === 'offer').map((x) => x.company)).toEqual(['C', 'A', 'B']);
  });

  it('counts applications per stage', () => {
    service.add(draft('A'));
    service.add(draft('B', 'offer'));
    expect(service.countsByStage().get('wishlist')).toBe(1);
    expect(service.countsByStage().get('offer')).toBe(1);
    expect(service.countsByStage().get('closed')).toBe(0);
  });
});
