export type Currency = 'ZEC' | 'USD' | 'MYR';

export interface Member {
  id: string;
  name: string;
  address?: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number; // original amount in the expense's currency
  currency: Currency;
  zecAmount: number; // converted to ZEC (used for all balance math)
  paidBy: string;
  splitAmong: string[];
  customSplit?: Record<string, number>; // shares in ZEC
  date: string; // YYYY-MM-DD
  createdAt: number;
}

export interface Group {
  id: string;
  name: string;
  members: Member[];
  expenses: Expense[];
  paidSettlements: PaidSettlement[];
  createdAt: number;
}

export interface PaidSettlement {
  id: string;
  from: string;
  to: string;
  amount: number;
  paidAt: number;
}

export interface AppState {
  groups: Group[];
  activeGroupId: string | null;
}

export interface Settlement {
  from: string;
  to: string;
  amount: number;
}
