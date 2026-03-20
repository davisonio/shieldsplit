import { useState } from 'react';
import type { Group, Member } from '../types';
import { generateId } from '../lib/storage';
import { validateAddress } from '../lib/zcash';

interface Props {
  onSave: (group: Group) => void;
  existingGroup?: Group;
}

export default function GroupForm({ onSave, existingGroup }: Props) {
  const [name, setName] = useState(existingGroup?.name || '');
  const [members, setMembers] = useState<Member[]>(
    existingGroup?.members || [
      { id: generateId(), name: '', address: '' },
      { id: generateId(), name: '', address: '' },
    ]
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  function addMember() {
    setMembers([...members, { id: generateId(), name: '', address: '' }]);
  }

  function removeMember(id: string) {
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) return;

    const validMembers = members.filter((m) => m.name.trim());
    if (validMembers.length < 2) return;

    for (const m of validMembers) {
      if (m.address) {
        const result = validateAddress(m.address);
        if (!result.valid) return;
      }
    }

    const group: Group = {
      id: existingGroup?.id || generateId(),
      name: name.trim(),
      members: validMembers.map((m) => ({
        ...m,
        name: m.name.trim(),
        address: m.address?.trim() || undefined,
      })),
      expenses: existingGroup?.expenses || [],
      paidSettlements: existingGroup?.paidSettlements || [],
      createdAt: existingGroup?.createdAt || Date.now(),
    };

    onSave(group);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-text-muted mb-1.5">
          Group name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Friday dinner, Rent, Trip to Lisbon..."
          className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-text-bright placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-muted mb-3">
          Members
        </label>
        <div className="space-y-3">
          {members.map((member, idx) => (
            <div key={member.id} className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={member.name}
                  onChange={(e) => updateMember(member.id, 'name', e.target.value)}
                  placeholder={`Name${idx < 2 ? '' : ' (optional)'}`}
                  className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-text-bright placeholder:text-text-muted/50 focus:outline-none focus:border-accent transition-colors text-sm"
                  required={idx < 2}
                />
                <input
                  type="text"
                  value={member.address || ''}
                  onChange={(e) => updateMember(member.id, 'address', e.target.value)}
                  placeholder="u1... (optional)"
                  className={`flex-1 bg-surface border rounded-lg px-3 py-2 text-text-bright placeholder:text-text-muted/50 focus:outline-none transition-colors text-sm font-mono text-xs ${
                    errors[member.id] ? 'border-danger' : 'border-border focus:border-accent'
                  }`}
                />
                {members.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeMember(member.id)}
                    className="px-2.5 text-text-muted hover:text-danger transition-colors"
                    title="Remove member"
                  >
                    &times;
                  </button>
                )}
              </div>
              {errors[member.id] && (
                <p className="text-xs text-danger pl-1">{errors[member.id]}</p>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addMember}
          className="mt-3 text-sm text-accent hover:text-accent-hover transition-colors"
        >
          + Add member
        </button>
      </div>

      <button
        type="submit"
        className="w-full bg-accent text-bg font-semibold rounded-lg py-2.5 hover:bg-accent-hover transition-colors"
      >
        {existingGroup ? 'Update group' : 'Create group'}
      </button>
    </form>
  );
}
