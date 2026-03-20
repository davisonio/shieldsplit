import { useState } from 'react';
import type { Member, Expense, Settlement, PaidSettlement } from '../types';
import { simplifyDebts } from '../lib/settle';
import { buildZcashUri, formatZec } from '../lib/zcash';
import QRCode from './QRCode';

interface Props {
  members: Member[];
  expenses: Expense[];
  groupName: string;
  paidSettlements: PaidSettlement[];
  onMarkPaid: (settlement: Settlement) => void;
  onUnmarkPaid: (paidId: string) => void;
}

export default function SettlementPlan({
  members,
  expenses,
  groupName,
  paidSettlements,
  onMarkPaid,
  onUnmarkPaid,
}: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (expenses.length === 0) {
    return (
      <div className="text-center py-16 text-text-muted">
        <div className="text-4xl mb-3 opacity-50">&#10003;</div>
        <p className="text-sm">Add expenses first, then come here to settle up.</p>
      </div>
    );
  }

  const settlements = simplifyDebts(
    members.map((m) => m.id),
    expenses
  );

  if (settlements.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-3">&#10003;</div>
        <p className="text-sm text-success font-medium">All settled up.</p>
        <p className="text-xs text-text-muted mt-1">No payments needed.</p>
      </div>
    );
  }

  const memberMap = new Map(members.map((m) => [m.id, m]));
  const totalOwed = settlements.reduce((s, t) => s + t.amount, 0);

  function isPaid(s: Settlement): PaidSettlement | undefined {
    return paidSettlements.find(
      (p) =>
        p.from === s.from &&
        p.to === s.to &&
        Math.abs(p.amount - s.amount) < 0.00000001
    );
  }

  const paidCount = settlements.filter((s) => isPaid(s)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-text-muted">
          {settlements.length} payment{settlements.length !== 1 ? 's' : ''} needed
        </span>
        <span className="text-text-muted">
          Total: <span className="text-accent font-mono font-semibold">{formatZec(totalOwed)} ZEC</span>
        </span>
      </div>

      {paidCount > 0 && (
        <div className="bg-success-dim border border-success/20 rounded-lg px-4 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-success">
              {paidCount}/{settlements.length} payments completed
            </span>
            <div className="h-1.5 w-24 bg-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-success rounded-full transition-all"
                style={{ width: `${(paidCount / settlements.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {settlements.map((s: Settlement, idx: number) => {
          const fromMember = memberMap.get(s.from);
          const toMember = memberMap.get(s.to);
          if (!fromMember || !toMember) return null;

          const paid = isPaid(s);
          const hasAddress = !!toMember.address;
          const uri = hasAddress
            ? buildZcashUri(toMember.address!, s.amount, `ShieldSplit: ${groupName} settlement`)
            : null;
          const canPay = hasAddress && uri !== null;
          const isExpanded = expandedIdx === idx;

          return (
            <div
              key={idx}
              className={`bg-surface border border-border rounded-lg overflow-hidden transition-colors ${
                paid ? 'settle-card-paid' : 'settle-card'
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium ${paid ? 'text-text-muted line-through' : 'text-text-bright'}`}>
                      {fromMember.name}
                    </span>
                    <span className="text-text-muted">&rarr;</span>
                    <span className={`font-medium ${paid ? 'text-text-muted line-through' : 'text-text-bright'}`}>
                      {toMember.name}
                    </span>
                    <span className={`font-mono text-sm font-semibold ${paid ? 'text-text-muted' : 'text-accent'}`}>
                      {formatZec(s.amount)} ZEC
                    </span>
                    {paid && (
                      <span className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full">
                        Paid
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {paid ? (
                    <button
                      onClick={() => onUnmarkPaid(paid.id)}
                      className="text-xs text-text-muted hover:text-text-bright transition-colors"
                    >
                      Undo
                    </button>
                  ) : (
                    <>
                      {canPay && (
                        <button
                          onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                          className="text-xs text-accent hover:text-accent-hover transition-colors"
                        >
                          {isExpanded ? 'Hide' : 'Pay'}
                        </button>
                      )}
                      <button
                        onClick={() => onMarkPaid(s)}
                        className="text-xs text-success hover:text-success/80 transition-colors"
                      >
                        Mark paid
                      </button>
                    </>
                  )}
                </div>
              </div>

              {!canPay && !paid && (
                <div className="border-t border-border px-4 py-2 bg-accent-dim">
                  <p className="text-xs text-text-muted">
                    {toMember.name} hasn't added a Zcash address yet. Go to Settings to add one.
                  </p>
                </div>
              )}

              {isExpanded && uri && !paid && (
                <div className="border-t border-border px-4 py-4 flex flex-col items-center gap-3">
                  <QRCode value={uri} size={180} />
                  <a
                    href={uri}
                    className="text-xs text-accent hover:text-accent-hover break-all text-center font-mono transition-colors max-w-full"
                  >
                    {uri.length > 90 ? uri.slice(0, 90) + '\u2026' : uri}
                  </a>
                  <p className="text-xs text-text-muted text-center">
                    Scan with a Zcash wallet or tap the link to pay.
                  </p>
                  <button
                    onClick={() => {
                      onMarkPaid(s);
                      setExpandedIdx(null);
                    }}
                    className="text-sm bg-success/20 text-success hover:bg-success/30 rounded-lg px-4 py-1.5 transition-colors"
                  >
                    I've sent this payment
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
