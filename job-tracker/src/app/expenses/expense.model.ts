export interface Person {
  id: string;
  name: string;
}

/** All amounts are integer minor units (cents/paise) to avoid floating-point drift. */
export interface Entry {
  id: string;
  kind: 'expense' | 'payment';
  description: string;
  amount: number;
  paidBy: string;
  /** How much of `amount` each person is responsible for. Always sums to `amount`. */
  shares: Record<string, number>;
  createdAt: number;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}
