import { Component, ElementRef, inject, signal, viewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Application, ApplicationDraft, STAGES, Stage } from '../application.model';
import { ApplicationsService } from '../applications.service';

function emptyDraft(stage: Stage): ApplicationDraft {
  return { company: '', role: '', stage, location: '', url: '', salary: '', appliedOn: null, followUpOn: null, notes: '' };
}

@Component({
  selector: 'app-application-editor',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './application-editor.component.html',
})
export class ApplicationEditorComponent {
  private readonly applications = inject(ApplicationsService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly stages = STAGES;
  protected readonly editingId = signal<string | null>(null);
  protected readonly error = signal('');
  protected draft: ApplicationDraft = emptyDraft('wishlist');

  openNew(stage: Stage = 'wishlist'): void {
    this.editingId.set(null);
    this.draft = emptyDraft(stage);
    this.show();
  }

  openExisting(app: Application): void {
    this.editingId.set(app.id);
    const { id, createdAt, ...draft } = app;
    this.draft = { ...draft };
    this.show();
  }

  save(): void {
    const draft: ApplicationDraft = {
      ...this.draft,
      company: this.draft.company.trim(),
      role: this.draft.role.trim(),
      // Date inputs report an empty string when cleared.
      appliedOn: this.draft.appliedOn || null,
      followUpOn: this.draft.followUpOn || null,
    };
    if (!draft.company || !draft.role) {
      this.error.set('Add both the company and the role so you can find this later.');
      return;
    }
    const id = this.editingId();
    if (id) this.applications.update(id, draft);
    else this.applications.add(draft);
    this.close();
  }

  remove(): void {
    const id = this.editingId();
    if (id && confirm(`Delete ${this.draft.role} at ${this.draft.company}?`)) {
      this.applications.remove(id);
      this.close();
    }
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  private show(): void {
    this.error.set('');
    this.dialog().nativeElement.showModal();
  }
}
