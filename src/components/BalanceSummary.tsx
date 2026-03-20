import { useState } from 'react';
import type { Member, Expense } from '../types';
import { computeBalances } from '../lib/settle';
import { formatZec } from '../lib/zcash';

interface Props {
  members: Member[];
  expenses: Expense[];
}

export default function BalanceSummary({ members, expenses }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (expenses.length === 0) {
    return (
      <div className="text-center py-16 text-text-muted">
        <div className="text-4xl mb-3 opacity-50">&#9878;</div>
        <p className="text-sm">Add some expenses to see balances.</p>
      </div>
    );
  }

  const balances = computeBalances(
    members.map((m) => m.id),
    expenses
  );

  const maxAbs = Math.max(
    ...Array.from(balances.values()).map((v) => Math.abs(v)),
    0.00000001
  );

  function getMemberBreakdown(memberId: string) {
    const paid: { desc: string; amount: number }[] = [];
    const owes: { desc: string; amount: number }[] = [];

    for (const exp of expenses) {
      if (exp.paidBy === memberId) {
        paid.push({ desc: exp.description, amount: exp.zecAmount });
      }
      if (exp.customSplit && exp.customSplit[memberId]) {
        owes.push({ desc: exp.description, amount: exp.customSplit[memberId] });
      } else if (!exp.customSplit && exp.splitAmong.includes(memberId)) {
        owes.push({ desc: exp.description, amount: exp.zecAmount / exp.splitAmong.length });
      }
    }

    return { paid, owes };
  }

  return (
    <div className="space-y-2">
      {members.map((member) => {
        const balance = balances.get(member.id) || 0;
        const isPositive = balance > 0.00000001;
        const isNegative = balance < -0.00000001;
        const barWidth = (Math.abs(balance) / maxAbs) * 100;
        const isExpanded = expandedId === member.id;

        return (
          <div
            key={member.id}
            className="bg-surface border border-border rounded-lg overflow-hidden"
          >
            <button
              onClick={() => setExpandedId(isExpanded ? null : member.id)}
              className="w-full px-4 py-3 text-left hover:bg-surface-hover transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-text-bright text-sm font-medium">{member.name}</span>
                <span
                  className={`font-mono text-sm font-semibold ${
                    isPositive ? 'text-success' : isNegative ? 'text-danger' : 'text-text-muted'
                  }`}
                >
                  {isPositive ? '+' : ''}{formatZec(balance)} ZEC
                </span>
              </div>
              <div className="h-1.5 bg-bg rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isPositive ? 'bg-success' : isNegative ? 'bg-danger' : 'bg-text-muted'
                  }`}
                  style={{ width: `${Math.max(barWidth, 2)}%` }}
                />
              </div>
              <div className="text-xs text-text-muted mt-1">
                {isPositive ? 'Gets back' : isNegative ? 'Owes' : 'Settled up'}
                {(isPositive || isNegative) && (
                  <span className="ml-1">{formatZec(Math.abs(balance))} ZEC</span>
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border px-4 py-3 space-y-3">
                {(() => {
                  const { paid, owes } = getMemberBreakdown(member.id);
                  const totalPaid = paid.reduce((s, p) => s + p.amount, 0);
                  const totalOwed = owes.reduce((s, o) => s + o.amount, 0);
                  return (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-success-dim rounded-lg p-2.5">
                          <div className="text-text-muted mb-0.5">Total paid</div>
                          <div className="font-mono text-success font-semibold">
                            {formatZec(totalPaid)} ZEC
                          </div>
                        </div>
                        <div className="bg-danger-dim rounded-lg p-2.5">
                          <div className="text-text-muted mb-0.5">Total share</div>
                          <div className="font-mono text-danger font-semibold">
                            {formatZec(totalOwed)} ZEC
                          </div>
                        </div>
                      </div>

                      {paid.length > 0 && (
                        <div>
                          <div className="text-xs text-text-muted font-medium mb-1">Paid for</div>
                          {paid.map((p, i) => (
                            <div key={i} className="flex justify-between text-xs py-0.5">
                              <span className="text-text">{p.desc}</span>
                              <span className="font-mono text-success">{formatZec(p.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {owes.length > 0 && (
                        <div>
                          <div className="text-xs text-text-muted font-medium mb-1">Share of</div>
                          {owes.map((o, i) => (
                            <div key={i} className="flex justify-between text-xs py-0.5">
                              <span className="text-text">{o.desc}</span>
                              <span className="font-mono text-danger">{formatZec(o.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
