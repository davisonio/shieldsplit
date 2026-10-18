import { useState, useEffect } from 'react';
import type { Expense, Member, Currency } from '../types';
import { generateId } from '../lib/storage';
import { formatZec } from '../lib/zcash';
import { fetchZecRates, toZec } from '../lib/rates';

interface Props {
  members: Member[];
  onSave: (expense: Expense) => void;
  onClose: () => void;
  existing?: Expense;
}

export default function ExpenseForm({ members, onSave, onClose, existing }: Props) {
  const [description, setDescription] = useState(existing?.description || '');
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [currency, setCurrency] = useState<Currency>(existing?.currency || 'ZEC');
  const [paidBy, setPaidBy] = useState(existing?.paidBy || members[0]?.id || '');
  const [splitType, setSplitType] = useState<'equal' | 'custom'>(
    existing?.customSplit ? 'custom' : 'equal'
  );
  const [splitAmong, setSplitAmong] = useState<Set<string>>(
    new Set(existing?.splitAmong || members.map((m) => m.id))
  );
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(
    existing?.customSplit
      ? Object.fromEntries(Object.entries(existing.customSplit).map(([k, v]) => [k, String(v)]))
      : {}
  );
  const [date, setDate] = useState(
    existing?.date || new Date().toISOString().split('T')[0]
  );

  // Rate state
  const [rates, setRates] = useState<{ usd: number; myr: number } | null>(null);
  const [rateLoading, setRateLoading] = useState(currency !== 'ZEC');
  const [rateError, setRateError] = useState(false);
  const [manualRate, setManualRate] = useState('');

  function changeCurrency(next: Currency) {
    setCurrency(next);
    if (next === currency || next === 'ZEC') return;
    setRateLoading(true);
    setRateError(false);
    setRates(null); // clear stale rates so manual fallback shows on failure
  }

  // Fetch rates when currency changes to non-ZEC
  useEffect(() => {
    if (currency === 'ZEC') return;
    let cancelled = false;
    fetchZecRates()
      .then((r) => {
        if (!cancelled) {
          setRates(r);
          setRateLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRateError(true);
          setRateLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [currency]);

  function getZecAmount(fiatAmount: number): number | null {
    if (currency === 'ZEC') return fiatAmount;
    if (rates) return toZec(fiatAmount, currency, rates);
    const manual = parseFloat(manualRate);
    if (!isNaN(manual) && manual > 0) return fiatAmount / manual;
    return null;
  }

  function toggleMember(id: string) {
    const next = new Set(splitAmong);
    if (next.has(id)) {
      if (next.size <= 1) return;
      next.delete(id);
    } else {
      next.add(id);
    }
    setSplitAmong(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const amountNum = parseFloat(amount);
    if (!description.trim() || isNaN(amountNum) || amountNum <= 0) return;
    if (!paidBy) return;

    const zecAmount = getZecAmount(amountNum);
    if (zecAmount === null || zecAmount <= 0) return;

    const expense: Expense = {
      id: existing?.id || generateId(),
      description: description.trim(),
      amount: amountNum,
      currency,
      zecAmount,
      paidBy,
      splitAmong: Array.from(splitAmong),
      date,
      createdAt: existing?.createdAt || Date.now(),
    };

    if (splitType === 'custom') {
      // Custom splits are entered in ZEC
      const custom: Record<string, number> = {};
      let total = 0;
      for (const id of splitAmong) {
        const val = parseFloat(customAmounts[id] || '0');
        if (isNaN(val) || val < 0) return;
        custom[id] = val;
        total += val;
      }
      if (Math.abs(total - zecAmount) > 0.00000001) return;
      expense.customSplit = custom;
    }

    onSave(expense);
  }

  const amountNum = parseFloat(amount) || 0;
  const zecPreview = getZecAmount(amountNum);
  const customTotal = Object.entries(customAmounts)
    .filter(([k]) => splitAmong.has(k))
    .reduce((s, [, v]) => s + (parseFloat(v) || 0), 0);

  const currencySymbol = currency === 'USD' ? '$' : currency === 'MYR' ? 'RM' : '';
  const rateDisplay = currency !== 'ZEC' && rates
    ? `1 ZEC = ${currency === 'USD' ? '$' : 'RM'}${(currency === 'USD' ? rates.usd : rates.myr).toFixed(2)}`
    : null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 sm:p-4 animate-overlay"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-border rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-md space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl animate-modal"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-text-bright">
            {existing ? 'Edit expense' : 'Add expense'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-bright transition-colors text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div>
          <label className="block text-sm text-text-muted mb-1">What was it for?</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tacos, cab ride, hotel..."
            className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text-bright placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm text-text-muted mb-1">Amount</label>
          <div className="flex gap-2">
            <div className="flex gap-1 bg-bg rounded-lg p-0.5 border border-border shrink-0">
              {(['ZEC', 'USD', 'MYR'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => changeCurrency(c)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    currency === c
                      ? 'bg-accent text-bg'
                      : 'text-text-muted hover:text-text-bright'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <input
              type="number"
              step="any"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-text-bright placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors font-mono"
              required
            />
          </div>

          {/* Rate info / ZEC conversion preview */}
          {currency !== 'ZEC' && amountNum > 0 && (
            <div className="mt-1.5 text-xs">
              {rateLoading && (
                <span className="text-text-muted">Fetching rate...</span>
              )}
              {rateError && !rates && (
                <div className="space-y-1">
                  <span className="text-danger">Couldn't fetch rate.</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-text-muted">1 ZEC = {currencySymbol}</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={manualRate}
                      onChange={(e) => setManualRate(e.target.value)}
                      placeholder="enter rate"
                      className="w-24 bg-bg border border-border rounded px-2 py-0.5 text-text-bright font-mono text-xs focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>
              )}
              {zecPreview !== null && !rateLoading && (
                <span className="text-text-muted">
                  {currencySymbol}{amountNum.toFixed(2)} &asymp;{' '}
                  <span className="text-accent font-mono">{formatZec(zecPreview)} ZEC</span>
                  {rateDisplay && <span className="ml-1.5 text-text-muted/60">({rateDisplay})</span>}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm text-text-muted mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text-bright focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-text-muted mb-1">Paid by</label>
            <select
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text-bright focus:outline-none focus:border-accent transition-colors"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-4 mb-2">
            <label className="text-sm text-text-muted">Split</label>
            <div className="flex gap-1 bg-bg rounded-lg p-0.5 border border-border">
              <button
                type="button"
                onClick={() => setSplitType('equal')}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  splitType === 'equal'
                    ? 'bg-accent text-bg font-medium'
                    : 'text-text-muted hover:text-text-bright'
                }`}
              >
                Equal
              </button>
              <button
                type="button"
                onClick={() => setSplitType('custom')}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  splitType === 'custom'
                    ? 'bg-accent text-bg font-medium'
                    : 'text-text-muted hover:text-text-bright'
                }`}
              >
                Custom
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <label className="flex items-center gap-2 flex-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={splitAmong.has(m.id)}
                    onChange={() => toggleMember(m.id)}
                    className="accent-accent"
                  />
                  <span className="text-sm text-text">{m.name}</span>
                </label>
                {splitType === 'equal' && splitAmong.has(m.id) && zecPreview !== null && (
                  <span className="text-xs text-text-muted font-mono">
                    {splitAmong.size > 0
                      ? formatZec(zecPreview / splitAmong.size)
                      : '0'}{' '}
                    ZEC
                  </span>
                )}
                {splitType === 'custom' && splitAmong.has(m.id) && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={customAmounts[m.id] || ''}
                      onChange={(e) =>
                        setCustomAmounts({ ...customAmounts, [m.id]: e.target.value })
                      }
                      placeholder="0.00"
                      className="w-24 bg-bg border border-border rounded px-2 py-1 text-sm font-mono text-text-bright focus:outline-none focus:border-accent transition-colors"
                    />
                    <span className="text-xs text-text-muted">ZEC</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          {splitType === 'custom' && zecPreview !== null && (
            <p className="text-xs text-text-muted mt-2">
              Total:{' '}
              <span className={`font-mono ${Math.abs(customTotal - zecPreview) < 0.00000001 ? 'text-success' : 'text-danger'}`}>
                {formatZec(customTotal)}
              </span>{' '}
              / {formatZec(zecPreview)} ZEC
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={currency !== 'ZEC' && zecPreview === null}
          className="w-full bg-accent text-bg font-semibold rounded-lg py-2.5 hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {existing ? 'Save changes' : 'Add expense'}
        </button>
      </form>
    </div>
  );
}
