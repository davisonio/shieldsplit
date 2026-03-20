import type { Expense, Settlement } from '../types';

export function computeBalances(
  memberIds: string[],
  expenses: Expense[]
): Map<string, number> {
  const balances = new Map<string, number>();
  for (const id of memberIds) {
    balances.set(id, 0);
  }

  for (const expense of expenses) {
    // Credit the payer in ZEC
    balances.set(expense.paidBy, (balances.get(expense.paidBy) || 0) + expense.zecAmount);

    if (expense.customSplit && Object.keys(expense.customSplit).length > 0) {
      // Custom split (already in ZEC)
      for (const [memberId, share] of Object.entries(expense.customSplit)) {
        balances.set(memberId, (balances.get(memberId) || 0) - share);
      }
    } else if (expense.splitAmong.length > 0) {
      // Equal split in ZEC
      const share = expense.zecAmount / expense.splitAmong.length;
      for (const memberId of expense.splitAmong) {
        balances.set(memberId, (balances.get(memberId) || 0) - share);
      }
    }
  }

  return balances;
}

export function simplifyDebts(
  memberIds: string[],
  expenses: Expense[]
): Settlement[] {
  const balances = computeBalances(memberIds, expenses);
  const settlements: Settlement[] = [];

  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  for (const [id, balance] of balances) {
    if (balance < -0.00000001) {
      debtors.push({ id, amount: -balance });
    } else if (balance > 0.00000001) {
      creditors.push({ id, amount: balance });
    }
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const transfer = Math.min(debtors[i].amount, creditors[j].amount);

    if (transfer > 0.00000001) {
      settlements.push({
        from: debtors[i].id,
        to: creditors[j].id,
        amount: parseFloat(transfer.toFixed(8)),
      });
    }

    debtors[i].amount -= transfer;
    creditors[j].amount -= transfer;

    if (debtors[i].amount < 0.00000001) i++;
    if (creditors[j].amount < 0.00000001) j++;
  }

  return settlements;
}
