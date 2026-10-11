import { Entry, Person, Transfer } from './expense.model';

/** Splits `total` across `ids`, handing leftover cents to the first people so shares sum exactly. */
export function splitEqually(total: number, ids: string[]): Record<string, number> {
  const base = Math.floor(total / ids.length);
  let remainder = total - base * ids.length;
  return Object.fromEntries(ids.map((id) => [id, base + (remainder-- > 0 ? 1 : 0)]));
}

/** Net position per person: positive means they are owed money, negative means they owe. */
export function computeBalances(people: Person[], entries: Entry[]): Map<string, number> {
  const balances = new Map(people.map((p) => [p.id, 0]));
  const add = (id: string, delta: number) => balances.set(id, (balances.get(id) ?? 0) + delta);
  for (const entry of entries) {
    add(entry.paidBy, entry.amount);
    for (const [id, share] of Object.entries(entry.shares)) add(id, -share);
  }
  return balances;
}

/** Greedily matches the largest debtor with the largest creditor to keep the number of payments small. */
export function settleUp(balances: Map<string, number>): Transfer[] {
  const byAmountDesc = (a: { amount: number }, b: { amount: number }) => b.amount - a.amount;
  const debtors = [...balances]
    .filter(([, b]) => b < 0)
    .map(([id, b]) => ({ id, amount: -b }))
    .sort(byAmountDesc);
  const creditors = [...balances]
    .filter(([, b]) => b > 0)
    .map(([id, b]) => ({ id, amount: b }))
    .sort(byAmountDesc);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    transfers.push({ from: debtors[i].id, to: creditors[j].id, amount });
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }
  return transfers;
}

export function toMinorUnits(value: number | null | undefined): number {
  return value == null || Number.isNaN(value) ? NaN : Math.round(value * 100);
}

export function formatMoney(minor: number, currency: string, signed = false): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(minor / 100);
}
