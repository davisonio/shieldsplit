import type { Group } from '../types';
import { formatZec } from '../lib/zcash';
import { computeBalances } from '../lib/settle';

interface Props {
  group: Group;
  onShare: () => void;
}

export default function GroupHeader({ group, onShare }: Props) {
  const totalSpent = group.expenses.reduce((s, e) => s + e.zecAmount, 0);
  const balances = computeBalances(
    group.members.map((m) => m.id),
    group.expenses
  );
  const unsettled = Array.from(balances.values())
    .filter((v) => v > 0.00000001)
    .reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-bright">{group.name}</h1>
        <button
          onClick={onShare}
          className="text-sm text-text-muted hover:text-accent border border-border hover:border-accent/30 rounded-lg px-3 py-1.5 transition-colors"
        >
          Share
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-surface-alt rounded-xl p-3 text-center">
          <div className="text-[11px] uppercase tracking-wider text-text-muted mb-1">Members</div>
          <div className="text-2xl font-light text-text-bright">{group.members.length}</div>
        </div>
        <div className="bg-surface-alt rounded-xl p-3 text-center">
          <div className="text-[11px] uppercase tracking-wider text-text-muted mb-1">Spent</div>
          <div className="text-xl font-light text-text-bright font-mono">{formatZec(totalSpent)}</div>
          <div className="text-[10px] text-text-muted">ZEC</div>
        </div>
        <div className="bg-surface-alt rounded-xl p-3 text-center">
          <div className="text-[11px] uppercase tracking-wider text-text-muted mb-1">Unsettled</div>
          <div className={`text-xl font-light font-mono ${unsettled > 0 ? 'text-danger' : 'text-success'}`}>
            {formatZec(unsettled)}
          </div>
          <div className="text-[10px] text-text-muted">ZEC</div>
        </div>
      </div>
    </div>
  );
}
