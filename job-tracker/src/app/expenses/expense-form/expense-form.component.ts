import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LedgerService } from '../ledger.service';
import { MoneyPipe } from '../money.pipe';
import { formatMoney, splitEqually, toMinorUnits } from '../split';

@Component({
  selector: 'app-expense-form',
  imports: [FormsModule, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './expense-form.component.html',
})
export class ExpenseFormComponent {
  protected readonly ledger = inject(LedgerService);

  description = '';
  amount: number | null = null;
  paidBy = '';
  mode: 'equal' | 'exact' = 'equal';
  /** Track who is left out rather than who is in, so newly added people are included by default. */
  readonly excluded = new Set<string>();
  exact: Record<string, number | null> = {};

  protected readonly error = signal('');

  get total(): number {
    return toMinorUnits(this.amount);
  }

  get exactRemaining(): number {
    const assigned = Object.values(this.exact).reduce<number>((sum, v) => sum + (toMinorUnits(v) || 0), 0);
    return (this.total || 0) - assigned;
  }

  toggle(id: string): void {
    if (this.excluded.has(id)) this.excluded.delete(id);
    else this.excluded.add(id);
  }

  submit(): void {
    const people = this.ledger.people();
    const total = this.total;
    const currency = this.ledger.currency();

    if (!this.description.trim()) return this.error.set('Add a short description, like "Dinner" or "Taxi".');
    if (!(total > 0)) return this.error.set('Enter an amount greater than zero.');
    if (!people.some((p) => p.id === this.paidBy)) return this.error.set('Choose who paid.');

    let shares: Record<string, number>;
    if (this.mode === 'equal') {
      const ids = people.filter((p) => !this.excluded.has(p.id)).map((p) => p.id);
      if (ids.length === 0) return this.error.set('Pick at least one person to split with.');
      shares = splitEqually(total, ids);
    } else {
      shares = {};
      for (const p of people) {
        const share = toMinorUnits(this.exact[p.id]);
        if (share < 0) return this.error.set(`${p.name}'s share can't be negative.`);
        if (share > 0) shares[p.id] = share;
      }
      const diff = this.exactRemaining;
      if (diff !== 0) {
        const fix = diff > 0 ? `${formatMoney(diff, currency)} is still unassigned` : `shares are ${formatMoney(-diff, currency)} over`;
        return this.error.set(`The shares need to add up to ${formatMoney(total, currency)}: ${fix}.`);
      }
    }

    this.ledger.addExpense({ description: this.description.trim(), amount: total, paidBy: this.paidBy, shares });
    this.description = '';
    this.amount = null;
    this.exact = {};
    this.error.set('');
  }
}
