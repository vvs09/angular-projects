import { Entry, Person } from './expense.model';
import { computeBalances, settleUp, splitEqually, toMinorUnits } from './split';

const people: Person[] = ['a', 'b', 'c'].map((id) => ({ id, name: id.toUpperCase() }));

function expense(amount: number, paidBy: string, shares: Record<string, number>): Entry {
  return { id: crypto.randomUUID(), kind: 'expense', description: '', amount, paidBy, shares, createdAt: 0 };
}

describe('splitEqually', () => {
  it('hands leftover cents to the first people so the total is exact', () => {
    expect(splitEqually(1000, ['a', 'b', 'c'])).toEqual({ a: 334, b: 333, c: 333 });
  });
});

describe('computeBalances', () => {
  it('credits the payer and debits each share', () => {
    const balances = computeBalances(people, [expense(900, 'a', splitEqually(900, ['a', 'b', 'c']))]);
    expect(balances.get('a')).toBe(600);
    expect(balances.get('b')).toBe(-300);
    expect(balances.get('c')).toBe(-300);
  });

  it('always nets to zero across the group', () => {
    const balances = computeBalances(people, [
      expense(1001, 'a', splitEqually(1001, ['a', 'b', 'c'])),
      expense(250, 'b', { a: 100, c: 150 }),
    ]);
    expect([...balances.values()].reduce((s, b) => s + b, 0)).toBe(0);
  });
});

describe('settleUp', () => {
  it('produces transfers that clear every balance', () => {
    const balances = new Map([
      ['a', 700],
      ['b', -500],
      ['c', -200],
    ]);
    expect(settleUp(balances)).toEqual([
      { from: 'b', to: 'a', amount: 500 },
      { from: 'c', to: 'a', amount: 200 },
    ]);
  });

  it('returns nothing when everyone is square', () => {
    expect(settleUp(new Map([['a', 0], ['b', 0]]))).toEqual([]);
  });
});

describe('toMinorUnits', () => {
  it('rounds away floating-point noise', () => {
    expect(toMinorUnits(0.1 + 0.2)).toBe(30);
    expect(toMinorUnits(null)).toBeNaN();
  });
});
