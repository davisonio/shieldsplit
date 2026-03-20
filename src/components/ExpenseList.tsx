import { useState } from 'react';
import type { Expense, Member } from '../types';
import { formatZec, formatAmount } from '../lib/zcash';

interface Props {
  expenses: Expense[];
  members: Member[];
  onDelete: (id: string) => void;
  onEdit: (expense: Expense) => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];

  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function groupByDate(expenses: Expense[]): Map<string, Expense[]> {
  const sorted = expenses.slice().sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    return b.createdAt - a.createdAt;
  });

  const groups = new Map<string, Expense[]>();
  for (const exp of sorted) {
    const key = exp.date;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(exp);
  }
  return groups;
}

export default function ExpenseList({ expenses, members, onDelete, onEdit }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const memberMap = new Map(members.map((m) => [m.id, m.name]));

  if (expenses.length === 0) {
    return (
      <div className="text-center py-16 text-text-muted">
        <div className="text-4xl mb-3 opacity-50">&#9776;</div>
        <p className="text-sm mb-1">No expenses yet.</p>
        <p className="text-xs">Hit "Add expense" to start tracking who paid what.</p>
      </div>
    );
  }

  const dateGroups = groupByDate(expenses);
  const totalZec = expenses.reduce((s, e) => s + e.zecAmount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-muted">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</span>
        <span className="text-text-muted">
          Total: <span className="text-text-bright font-mono">{formatZec(totalZec)} ZEC</span>
        </span>
      </div>

      {Array.from(dateGroups.entries()).map(([dateStr, dayExpenses]) => (
        <div key={dateStr}>
          <div className="text-xs text-text-muted font-medium mb-1.5 pl-1">{formatDate(dateStr)}</div>
          <div className="space-y-1.5">
            {dayExpenses.map((expense) => {
              const isExpanded = expandedId === expense.id;
              const isFiat = expense.currency !== 'ZEC';
              const perPersonZec = expense.customSplit
                ? expense.customSplit
                : Object.fromEntries(
                    expense.splitAmong.map((id) => [id, expense.zecAmount / expense.splitAmong.length])
                  );

              return (
                <div
                  key={expense.id}
                  className="bg-surface border border-border rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : expense.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-text-bright font-medium truncate">
                          {expense.description}
                        </span>
                        <span className="text-text-bright font-mono text-sm shrink-0">
                          {isFiat
                            ? formatAmount(expense.amount, expense.currency)
                            : `${formatZec(expense.amount)} ZEC`}
                        </span>
                        {isFiat && (
                          <span className="text-text-muted font-mono text-xs shrink-0">
                            ({formatZec(expense.zecAmount)} ZEC)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted mt-0.5">
                        Paid by{' '}
                        <span className="text-text">{memberMap.get(expense.paidBy) || '?'}</span>
                      </p>
                    </div>
                    <span className="text-text-muted text-xs shrink-0">
                      {isExpanded ? '\u25B2' : '\u25BC'}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border px-4 py-3 space-y-3">
                      <div>
                        <div className="text-xs text-text-muted mb-2 font-medium">Split breakdown (ZEC)</div>
                        <div className="space-y-1">
                          {Object.entries(perPersonZec).map(([memberId, share]) => (
                            <div key={memberId} className="flex items-center justify-between text-sm">
                              <span className="text-text">
                                {memberMap.get(memberId) || '?'}
                                {memberId === expense.paidBy && (
                                  <span className="text-accent text-xs ml-1">(paid)</span>
                                )}
                              </span>
                              <span className="font-mono text-text-muted text-xs">
                                {formatZec(share)} ZEC
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => onEdit(expense)}
                          className="text-xs text-accent hover:text-accent-hover transition-colors"
                        >
                          Edit
                        </button>
                        <span className="text-border">|</span>
                        <button
                          onClick={() => onDelete(expense.id)}
                          className="text-xs text-danger/70 hover:text-danger transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
