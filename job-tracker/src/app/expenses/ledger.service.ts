import { Injectable, computed, effect, signal } from '@angular/core';
import { Entry, Person, Transfer } from './expense.model';
import { computeBalances, settleUp, splitEqually } from './split';

interface LedgerState {
  groupName: string;
  currency: string;
  people: Person[];
  entries: Entry[];
}

const STORAGE_KEY = 'splitter.ledger.v1';
const EMPTY: LedgerState = { groupName: 'Our shared tab', currency: 'INR', people: [], entries: [] };

function load(): LedgerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    // Storage unavailable or corrupt: start fresh.
  }
  return EMPTY;
}

@Injectable({ providedIn: 'root' })
export class LedgerService {
  private readonly state = signal<LedgerState>(load());

  readonly groupName = computed(() => this.state().groupName);
  readonly currency = computed(() => this.state().currency);
  readonly people = computed(() => this.state().people);
  readonly entries = computed(() => this.state().entries);

  readonly names = computed(() => new Map(this.people().map((p) => [p.id, p.name])));
  readonly balances = computed(() => computeBalances(this.people(), this.entries()));
  readonly transfers = computed(() => settleUp(this.balances()));
  readonly totalSpent = computed(() =>
    this.entries()
      .filter((e) => e.kind === 'expense')
      .reduce((sum, e) => sum + e.amount, 0),
  );

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state()));
      } catch {
        // Ignore quota or privacy-mode failures; the app still works in memory.
      }
    });
  }

  nameOf(id: string): string {
    return this.names().get(id) ?? 'Someone';
  }

  rename(groupName: string): void {
    this.state.update((s) => ({ ...s, groupName }));
  }

  setCurrency(currency: string): void {
    this.state.update((s) => ({ ...s, currency }));
  }

  addPerson(name: string): void {
    const person = { id: crypto.randomUUID(), name: name.trim() };
    this.state.update((s) => ({ ...s, people: [...s.people, person] }));
  }

  /** People who appear in any entry can't be removed, or the balances would no longer add up. */
  isInvolved(id: string): boolean {
    return this.entries().some((e) => e.paidBy === id || id in e.shares);
  }

  removePerson(id: string): void {
    if (this.isInvolved(id)) return;
    this.state.update((s) => ({ ...s, people: s.people.filter((p) => p.id !== id) }));
  }

  addExpense(expense: Pick<Entry, 'description' | 'amount' | 'paidBy' | 'shares'>): void {
    this.addEntry({ ...expense, kind: 'expense' });
  }

  recordPayment(transfer: Transfer): void {
    this.addEntry({
      kind: 'payment',
      description: 'Payment',
      amount: transfer.amount,
      paidBy: transfer.from,
      shares: { [transfer.to]: transfer.amount },
    });
  }

  deleteEntry(id: string): void {
    this.state.update((s) => ({ ...s, entries: s.entries.filter((e) => e.id !== id) }));
  }

  clear(): void {
    this.state.set(EMPTY);
  }

  loadSample(): void {
    const [asha, ben, chitra, dev] = ['Asha', 'Ben', 'Chitra', 'Dev'].map((name) => ({
      id: crypto.randomUUID(),
      name,
    }));
    const everyone = [asha, ben, chitra, dev].map((p) => p.id);
    const now = Date.now();
    const entry = (description: string, amount: number, paidBy: string, ids: string[], ago: number): Entry => ({
      id: crypto.randomUUID(),
      kind: 'expense',
      description,
      amount,
      paidBy,
      shares: splitEqually(amount, ids),
      createdAt: now - ago * 3_600_000,
    });
    this.state.set({
      groupName: 'Goa trip',
      currency: 'INR',
      people: [asha, ben, chitra, dev],
      entries: [
        entry('Villa booking', 2_400_000, asha.id, everyone, 72),
        entry('Scooter rental', 360_000, ben.id, everyone, 48),
        entry('Seafood dinner', 518_000, chitra.id, everyone, 30),
        entry('Parasailing', 300_000, dev.id, [ben.id, dev.id], 20),
      ],
    });
  }

  private addEntry(entry: Omit<Entry, 'id' | 'createdAt'>): void {
    const full = { ...entry, id: crypto.randomUUID(), createdAt: Date.now() };
    this.state.update((s) => ({ ...s, entries: [...s.entries, full] }));
  }
}
