import { Component, computed, inject, signal, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Application, STAGES, Stage } from '../application.model';
import { ApplicationEditorComponent } from '../application-editor/application-editor.component';
import { ApplicationsService } from '../applications.service';
import { daysBetween, followUpStatus, relativeDays, today } from '../dates';

@Component({
  selector: 'app-job-board',
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, ApplicationEditorComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './job-board.component.html',
})
export class JobBoardComponent {
  protected readonly applications = inject(ApplicationsService);
  private readonly editor = viewChild.required(ApplicationEditorComponent);

  protected readonly stages = STAGES;
  protected readonly today = today();
  protected readonly query = signal('');
  /** The browser fires a click when a drag ends over the card; this lets us ignore it. */
  private lastDragEnd = 0;

  protected readonly columns = computed(() => {
    const q = this.query().trim().toLowerCase();
    const matches = (a: Application) =>
      !q || [a.company, a.role, a.location, a.notes].some((field) => field.toLowerCase().includes(q));
    const columns = new Map<Stage, Application[]>(STAGES.map((s) => [s.id, []]));
    for (const app of this.applications.all()) if (matches(app)) columns.get(app.stage)!.push(app);
    return columns;
  });

  protected readonly pipeline = computed(() => {
    const counts = this.applications.countsByStage();
    return STAGES.map((s) => ({ ...s, count: counts.get(s.id) ?? 0 })).filter((s) => s.count > 0);
  });

  protected readonly inProgress = computed(
    () => this.applications.all().filter((a) => a.stage === 'applied' || a.stage === 'interviewing').length,
  );

  addTo(stage?: Stage): void {
    this.editor().openNew(stage);
  }

  open(app: Application): void {
    if (Date.now() - this.lastDragEnd < 250) return;
    this.editor().openExisting(app);
  }

  dragEnded(): void {
    this.lastDragEnd = Date.now();
  }

  drop(event: CdkDragDrop<Stage, Stage, string>): void {
    const id = event.item.data;
    const stage = event.container.data;
    // Resolve the drop position against what is visible, so it works while the board is filtered.
    const visible = this.columns().get(stage)!.filter((a) => a.id !== id);
    this.applications.move(id, stage, visible[event.currentIndex]?.id ?? null);
  }

  appliedLabel(app: Application): string {
    if (!app.appliedOn) return 'Not applied yet';
    return `Applied ${relativeDays(daysBetween(app.appliedOn, this.today))}`;
  }

  followUpLabel(app: Application): string | null {
    const status = followUpStatus(app, this.today);
    if (!status) return null;
    if (status === 'today') return 'Follow up today';
    const days = Math.abs(daysBetween(this.today, app.followUpOn!));
    if (status === 'overdue') return `Follow-up overdue by ${days} ${days === 1 ? 'day' : 'days'}`;
    return `Follow up ${relativeDays(-days)}`;
  }

  followUpClass(app: Application): string {
    return followUpStatus(app, this.today) ?? '';
  }

  clearAll(): void {
    if (confirm('Delete every application? This cannot be undone.')) this.applications.clear();
  }
}
