import { TestBed } from '@angular/core/testing';
import { JobBoardComponent } from './job-board.component';

describe('JobBoardComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [JobBoardComponent] }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(JobBoardComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render a column for every stage', () => {
    const fixture = TestBed.createComponent(JobBoardComponent);
    fixture.detectChanges();
    const headings = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.column h2')).map((h) => h.textContent);
    expect(headings).toEqual(['Wishlist', 'Applied', 'Interviewing', 'Offer', 'Closed']);
  });
});
