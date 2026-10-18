import { useState, useEffect, useCallback } from 'react';
import type { Group, Expense, Settlement } from './types';
import { loadState, saveState, generateId } from './lib/storage';
import { formatZec } from './lib/zcash';
import { computeBalances } from './lib/settle';
import { getSharedGroupFromUrl, clearShareHash, buildShareUrl } from './lib/sharing';
import GroupForm from './components/GroupForm';
import ExpenseForm from './components/ExpenseForm';
import ExpenseList from './components/ExpenseList';
import BalanceSummary from './components/BalanceSummary';
import SettlementPlan from './components/SettlementPlan';
import GroupHeader from './components/GroupHeader';
import GroupSettings from './components/GroupSettings';

type View = 'home' | 'new-group' | 'group';
type Tab = 'expenses' | 'balances' | 'settle' | 'settings';

function loadInitialState() {
  const state = loadState();
  // Migrate old groups that lack paidSettlements or expense dates
  const groups: Group[] = state.groups.map((g) => ({
    ...g,
    paidSettlements: g.paidSettlements || [],
    expenses: g.expenses.map((e) => ({
      ...e,
      currency: e.currency || 'ZEC',
      zecAmount: e.zecAmount ?? e.amount,
      date: e.date || new Date(e.createdAt).toISOString().split('T')[0],
    })),
  }));
  return { groups, activeGroupId: state.activeGroupId || null };
}

export default function App() {
  const [initial] = useState(loadInitialState);
  const [groups, setGroups] = useState<Group[]>(initial.groups);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(initial.activeGroupId);
  const [view, setView] = useState<View>(initial.activeGroupId ? 'group' : 'home');
  const [expenseFormState, setExpenseFormState] = useState<{ open: boolean; editing?: Expense }>({ open: false });
  const [activeTab, setActiveTab] = useState<Tab>('expenses');
  // Check for shared group in URL
  const [sharedGroup, setSharedGroup] = useState<Group | null>(getSharedGroupFromUrl);
  const [shareToast, setShareToast] = useState(false);

  function handleImportShared() {
    if (!sharedGroup) return;
    setGroups((prev) => [...prev, sharedGroup]);
    setActiveGroupId(sharedGroup.id);
    setView('group');
    setActiveTab('expenses');
    setSharedGroup(null);
    clearShareHash();
  }

  function handleDismissShared() {
    setSharedGroup(null);
    clearShareHash();
  }

  function handleShare() {
    if (!activeGroup) return;
    const url = buildShareUrl(activeGroup);
    navigator.clipboard.writeText(url).then(() => {
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    });
  }

  useEffect(() => {
    saveState({ groups, activeGroupId });
  }, [groups, activeGroupId]);

  const activeGroup = groups.find((g) => g.id === activeGroupId);

  const updateGroup = useCallback(
    (updater: (g: Group) => Group) => {
      setGroups((prev) =>
        prev.map((g) => (g.id === activeGroupId ? updater(g) : g))
      );
    },
    [activeGroupId]
  );

  function handleCreateGroup(group: Group) {
    const newGroup = { ...group, paidSettlements: group.paidSettlements || [] };
    setGroups([...groups, newGroup]);
    setActiveGroupId(newGroup.id);
    setView('group');
    setActiveTab('expenses');
  }

  function handleSaveExpense(expense: Expense) {
    updateGroup((g) => {
      const exists = g.expenses.some((e) => e.id === expense.id);
      return {
        ...g,
        expenses: exists
          ? g.expenses.map((e) => (e.id === expense.id ? expense : e))
          : [...g.expenses, expense],
        paidSettlements: [], // settlements change when expenses change
      };
    });
    setExpenseFormState({ open: false });
  }

  function handleDeleteExpense(expenseId: string) {
    updateGroup((g) => ({
      ...g,
      expenses: g.expenses.filter((e) => e.id !== expenseId),
      paidSettlements: [], // settlements change when expenses change
    }));
  }

  function handleUpdateGroup(updated: Group) {
    setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  }

  function handleDeleteGroup(groupId: string) {
    setGroups(groups.filter((g) => g.id !== groupId));
    if (activeGroupId === groupId) {
      setActiveGroupId(null);
      setView('home');
    }
  }

  function handleMarkPaid(settlement: Settlement) {
    updateGroup((g) => ({
      ...g,
      paidSettlements: [
        ...g.paidSettlements,
        {
          id: generateId(),
          from: settlement.from,
          to: settlement.to,
          amount: settlement.amount,
          paidAt: Date.now(),
        },
      ],
    }));
  }

  function handleUnmarkPaid(paidId: string) {
    updateGroup((g) => ({
      ...g,
      paidSettlements: g.paidSettlements.filter((p) => p.id !== paidId),
    }));
  }

  function handleExport() {
    if (!activeGroup) return;
    const data = JSON.stringify(activeGroup, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeGroup.name.replace(/\s+/g, '-').toLowerCase()}-shieldsplit.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function goHome() {
    setActiveGroupId(null);
    setView('home');
    setActiveTab('expenses');
  }

  function openGroup(id: string) {
    setActiveGroupId(id);
    setView('group');
    setActiveTab('expenses');
  }

  // Home page summary
  function getGroupSummary(group: Group) {
    const total = group.expenses.reduce((s, e) => s + e.zecAmount, 0);
    const balances = computeBalances(
      group.members.map((m) => m.id),
      group.expenses
    );
    const unsettled = Array.from(balances.values())
      .filter((v) => v > 0.00000001)
      .reduce((s, v) => s + v, 0);
    return { total, unsettled };
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-bg/95 backdrop-blur-sm z-40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={goHome} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <svg width="24" height="28" viewBox="0 0 24 28" fill="none" className="shrink-0">
              <path d="M12 1L2 5.5V12.5C2 19.5 6.5 25 12 27C17.5 25 22 19.5 22 12.5V5.5L12 1Z" fill="#F4B728" fillOpacity="0.15" stroke="#F4B728" strokeWidth="1.5"/>
              <path d="M8 14L11 17L16 11" stroke="#F4B728" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-text-bright font-semibold tracking-tight text-[15px]">ShieldSplit</span>
          </button>
          {view === 'group' && activeGroup && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-muted hidden sm:inline">{activeGroup.name}</span>
              <button
                onClick={goHome}
                className="text-sm text-text-muted hover:text-text-bright transition-colors"
              >
                &larr; Groups
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Shared group import banner */}
      {sharedGroup && (
        <div className="bg-accent-dim border-b border-accent/20">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-bright font-medium">
                Someone shared "{sharedGroup.name}" with you
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                {sharedGroup.members.length} members, {sharedGroup.expenses.length} expense{sharedGroup.expenses.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={handleImportShared}
              className="bg-accent text-bg text-sm font-semibold rounded-lg px-4 py-1.5 hover:bg-accent-hover transition-colors shrink-0"
            >
              Import
            </button>
            <button
              onClick={handleDismissShared}
              className="text-text-muted hover:text-text-bright transition-colors text-lg leading-none shrink-0"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Share toast */}
      {shareToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-success text-bg text-sm font-medium px-4 py-2 rounded-lg shadow-lg animate-fade-in">
          Share link copied to clipboard
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-6 flex-1 w-full">
        {/* Home: List groups */}
        {view === 'home' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-text-bright">Your groups</h1>
              <button
                onClick={() => setView('new-group')}
                className="bg-accent text-bg text-sm font-semibold rounded-lg px-4 py-2 hover:bg-accent-hover transition-colors"
              >
                New group
              </button>
            </div>

            {groups.length === 0 ? (
              <div className="text-center py-24">
                <svg width="48" height="56" viewBox="0 0 24 28" fill="none" className="mx-auto mb-5">
                  <path d="M12 1L2 5.5V12.5C2 19.5 6.5 25 12 27C17.5 25 22 19.5 22 12.5V5.5L12 1Z" fill="#F4B728" fillOpacity="0.1" stroke="#F4B728" strokeWidth="1.5"/>
                  <path d="M8 14L11 17L16 11" stroke="#F4B728" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <h2 className="text-lg text-text-bright font-medium mb-1.5">Split expenses, settle in ZEC</h2>
                <p className="text-text-muted text-sm mb-8 max-w-[280px] mx-auto leading-relaxed">
                  Track who paid what. Settle debts with shielded payments. No accounts needed.
                </p>
                <button
                  onClick={() => setView('new-group')}
                  className="bg-accent text-bg text-sm font-semibold rounded-md px-5 py-2.5 hover:bg-accent-hover transition-colors"
                >
                  Create a group
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => {
                  const { total, unsettled } = getGroupSummary(group);
                  return (
                    <button
                      key={group.id}
                      onClick={() => openGroup(group.id)}
                      className="w-full text-left bg-surface border border-border rounded-xl px-4 py-3.5 card-hover hover:border-border-light"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-text-bright font-medium">{group.name}</div>
                          <div className="text-text-muted text-xs mt-0.5">
                            {group.members.length} members &middot; {group.expenses.length} expense{group.expenses.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-text-bright font-mono text-sm">
                            {formatZec(total)} ZEC
                          </div>
                          {unsettled > 0.00000001 && (
                            <div className="text-danger text-xs font-mono mt-0.5">
                              {formatZec(unsettled)} unsettled
                            </div>
                          )}
                          {unsettled < 0.00000001 && group.expenses.length > 0 && (
                            <div className="text-success text-xs mt-0.5">
                              Settled
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Member avatars */}
                      <div className="flex items-center gap-1 mt-2.5">
                        {group.members.slice(0, 6).map((m) => (
                          <div
                            key={m.id}
                            className="w-6 h-6 rounded-full bg-border flex items-center justify-center text-xs font-medium text-text-bright"
                            title={m.name}
                          >
                            {m.name[0]?.toUpperCase()}
                          </div>
                        ))}
                        {group.members.length > 6 && (
                          <span className="text-xs text-text-muted ml-1">
                            +{group.members.length - 6}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* New group form */}
        {view === 'new-group' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                onClick={goHome}
                className="text-text-muted hover:text-text-bright transition-colors"
              >
                &larr;
              </button>
              <h1 className="text-xl font-semibold text-text-bright">New group</h1>
            </div>
            <GroupForm onSave={handleCreateGroup} />
          </div>
        )}

        {/* Group detail */}
        {view === 'group' && activeGroup && (
          <div className="space-y-5">
            <GroupHeader group={activeGroup} onShare={handleShare} />

            {/* Tabs */}
            <div className="flex border-b border-border">
              {(['expenses', 'balances', 'settle', 'settings'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 pb-2.5 text-sm font-medium transition-colors relative ${
                    activeTab === tab
                      ? 'text-text-bright'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {tab === 'expenses'
                    ? 'Expenses'
                    : tab === 'balances'
                      ? 'Balances'
                      : tab === 'settle'
                        ? 'Settle up'
                        : 'Settings'}
                  {activeTab === tab && (
                    <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-accent rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Add expense button (visible on expenses tab) */}
            {activeTab === 'expenses' && (
              <button
                onClick={() => setExpenseFormState({ open: true })}
                className="w-full border border-dashed border-border-light text-text-muted text-sm py-2.5 rounded-lg hover:border-accent/40 hover:text-accent transition-colors"
              >
                + Add expense
              </button>
            )}

            {activeTab === 'expenses' && (
              <ExpenseList
                expenses={activeGroup.expenses}
                members={activeGroup.members}
                onDelete={handleDeleteExpense}
                onEdit={(expense) => setExpenseFormState({ open: true, editing: expense })}
              />
            )}

            {activeTab === 'balances' && (
              <BalanceSummary
                members={activeGroup.members}
                expenses={activeGroup.expenses}
              />
            )}

            {activeTab === 'settle' && (
              <SettlementPlan
                members={activeGroup.members}
                expenses={activeGroup.expenses}
                groupName={activeGroup.name}
                paidSettlements={activeGroup.paidSettlements}
                onMarkPaid={handleMarkPaid}
                onUnmarkPaid={handleUnmarkPaid}
              />
            )}

            {activeTab === 'settings' && (
              <GroupSettings
                group={activeGroup}
                onUpdate={handleUpdateGroup}
                onDelete={() => handleDeleteGroup(activeGroup.id)}
                onExport={handleExport}
                onShare={handleShare}
              />
            )}
          </div>
        )}
      </main>

      {/* Privacy footer */}
      <footer className="border-t border-border">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <p className="text-xs text-text-muted text-center">
            ShieldSplit uses shielded addresses only. Your transaction amounts and memos are private on the Zcash network.
          </p>
        </div>
      </footer>

      {/* Expense form modal */}
      {expenseFormState.open && activeGroup && (
        <ExpenseForm
          members={activeGroup.members}
          onSave={handleSaveExpense}
          onClose={() => setExpenseFormState({ open: false })}
          existing={expenseFormState.editing}
        />
      )}
    </div>
  );
}
