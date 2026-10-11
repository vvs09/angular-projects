import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseFormComponent } from './expense-form/expense-form.component';
import { Entry } from './expense.model';
import { LedgerService } from './ledger.service';
import { MoneyPipe } from './money.pipe';

@Component({
  selector: 'app-expenses',
  imports: [FormsModule, DatePipe, MoneyPipe, ExpenseFormComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './expenses.component.html',
})
export class ExpensesComponent {
  protected readonly ledger = inject(LedgerService);
  protected readonly currencies = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'JPY'];
  protected newPerson = '';

  protected readonly activity = computed(() => [...this.ledger.entries()].sort((a, b) => b.createdAt - a.createdAt));

  protected readonly balanceRows = computed(() => {
    const balances = this.ledger.balances();
    const max = Math.max(1, ...[...balances.values()].map(Math.abs));
    return this.ledger.people().map((p) => {
      const amount = balances.get(p.id) ?? 0;
      return { id: p.id, name: p.name, amount, width: (Math.abs(amount) / max) * 100 };
    });
  });

  addPerson(): void {
    const name = this.newPerson.trim();
    if (!name) return;
    this.ledger.addPerson(name);
    this.newPerson = '';
  }

  describeSplit(entry: Entry): string {
    const names = Object.keys(entry.shares).map((id) => this.ledger.nameOf(id));
    if (names.length === this.ledger.people().length && names.length > 2) return 'split between everyone';
    return `split between ${names.join(', ')}`;
  }

  recipientOf(payment: Entry): string {
    return this.ledger.nameOf(Object.keys(payment.shares)[0]);
  }

  clearAll(): void {
    if (confirm('Delete all people and expenses? This cannot be undone.')) this.ledger.clear();
  }
}
