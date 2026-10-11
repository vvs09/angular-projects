import { Routes } from '@angular/router';
import { JobBoardComponent } from './job-board/job-board.component';

/** Short, URL-friendly room ids that are easy to read out loud. */
function newRoomId(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (n) => alphabet[n % alphabet.length]).join('');
}

export const routes: Routes = [
  { path: '', component: JobBoardComponent, title: 'Job Tracker' },
  {
    path: 'expenses',
    title: 'Expense Splitter',
    loadComponent: () => import('./expenses/expenses.component').then((m) => m.ExpensesComponent),
  },
  { path: 'whiteboard', pathMatch: 'full', redirectTo: () => `/whiteboard/${newRoomId()}` },
  {
    path: 'whiteboard/:room',
    title: 'Whiteboard',
    loadComponent: () => import('./whiteboard/whiteboard.component').then((m) => m.WhiteboardComponent),
  },
  {
    path: 'notes',
    title: 'Notes',
    loadComponent: () => import('./notes/notes.component').then((m) => m.NotesComponent),
  },
  { path: '**', redirectTo: '' },
];
