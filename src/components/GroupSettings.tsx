import { useState } from 'react';
import type { Group, Member } from '../types';
import { generateId } from '../lib/storage';
import { validateAddress } from '../lib/zcash';

interface Props {
  group: Group;
  onUpdate: (group: Group) => void;
  onDelete: () => void;
  onExport: () => void;
  onShare: () => void;
}

export default function GroupSettings({ group, onUpdate, onDelete, onExport, onShare }: Props) {
  const [name, setName] = useState(group.name);
  const [members, setMembers] = useState<Member[]>(group.members);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const usedMemberIds = new Set<string>();
  for (const exp of group.expenses) {
    usedMemberIds.add(exp.paidBy);
    for (const id of exp.splitAmong) usedMemberIds.add(id);
    if (exp.customSplit) {
      for (const id of Object.keys(exp.customSplit)) usedMemberIds.add(id);
    }
  }

  function addMember() {
    setMembers([...members, { id: generateId(), name: '', address: '' }]);
  }

  function removeMember(id: string) {
    if (usedMemberIds.has(id)) return;
    if (members.length <= 2) return;
    setMembers(members.filter((m) => m.id !== id));
  }

  function updateMember(id: string, field: 'name' | 'address', value: string) {
    setMembers(members.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
    if (field === 'address') {
      const result = validateAddress(value);
      if (!result.valid) {
        setErrors({ ...errors, [id]: result.error! });
      } else {
        const next = { ...errors };
        delete next[id];
        setErrors(next);
      }
    }
  }

  function handleSave() {
    if (!name.trim()) return;

    const validMembers = members.filter((m) => m.name.trim());
    if (validMembers.length < 2) return;

    for (const m of validMembers) {
      if (m.address) {
        const result = validateAddress(m.address);
        if (!result.valid) return;
      }
    }

    onUpdate({
      ...group,
      name: name.trim(),
      members: validMembers.map((m) => ({
        ...m,
        name: m.name.trim(),
        address: m.address?.trim() || undefined,
      })),
    });
  }

  const hasChanges =
    name !== group.name ||
    JSON.stringify(members) !== JSON.stringify(group.members);

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-text-muted mb-1.5">
          Group name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-text-bright focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-muted mb-3">
          Members &amp; addresses
        </label>
        <div className="space-y-2.5">
          {members.map((member) => {
            const isUsed = usedMemberIds.has(member.id);
            return (
              <div key={member.id} className="space-y-1">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={member.name}
                    onChange={(e) => updateMember(member.id, 'name', e.target.value)}
                    placeholder="Name"
                    className="flex-[2] bg-surface border border-border rounded-lg px-3 py-2 text-text-bright placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors text-sm"
                  />
                  <input
                    type="text"
                    value={member.address || ''}
                    onChange={(e) => updateMember(member.id, 'address', e.target.value)}
                    placeholder="u1... unified address"
                    className={`flex-[3] bg-surface border rounded-lg px-3 py-2 text-text-bright placeholder:text-text-muted/50 focus:outline-none transition-colors text-sm font-mono text-xs ${
                      errors[member.id] ? 'border-danger' : 'border-border focus:border-accent'
                    }`}
                  />
                  {!isUsed && members.length > 2 ? (
                    <button
                      type="button"
                      onClick={() => removeMember(member.id)}
                      className="px-2.5 text-text-muted hover:text-danger transition-colors"
                      title="Remove member"
                    >
                      &times;
                    </button>
                  ) : (
                    <div className="w-[34px]" />
                  )}
                </div>
                {errors[member.id] && (
                  <p className="text-xs text-danger pl-1">{errors[member.id]}</p>
                )}
                {isUsed && !member.address && (
                  <p className="text-xs text-accent/70 pl-1">
                    Add a unified address to enable payment QR codes
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addMember}
          className="mt-3 text-sm text-accent hover:text-accent-hover transition-colors"
        >
          + Add member
        </button>
      </div>

      {hasChanges && (
        <button
          onClick={handleSave}
          className="w-full bg-accent text-bg font-semibold rounded-lg py-2.5 hover:bg-accent-hover transition-colors"
        >
          Save changes
        </button>
      )}

      <div className="border-t border-border pt-4 space-y-3">
        <button
          onClick={onShare}
          className="w-full text-sm text-accent hover:text-accent-hover border border-accent/30 hover:border-accent/50 rounded-lg py-2 transition-colors"
        >
          Copy share link
        </button>

        <button
          onClick={onExport}
          className="w-full text-sm text-text-muted hover:text-text-bright border border-border rounded-lg py-2 transition-colors"
        >
          Export group data (JSON)
        </button>

        {!showConfirmDelete ? (
          <button
            onClick={() => setShowConfirmDelete(true)}
            className="w-full text-sm text-danger/70 hover:text-danger border border-danger/20 hover:border-danger/40 rounded-lg py-2 transition-colors"
          >
            Delete this group
          </button>
        ) : (
          <div className="bg-danger-dim border border-danger/30 rounded-lg p-3 space-y-2">
            <p className="text-sm text-danger">Delete "{group.name}" and all its expenses? This can't be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={onDelete}
                className="flex-1 bg-danger text-white text-sm font-semibold rounded-lg py-2 hover:bg-danger/90 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="flex-1 text-sm text-text-muted border border-border rounded-lg py-2 hover:text-text-bright transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
