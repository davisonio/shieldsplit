import type { Group } from '../types';
import { validateAddress } from './zcash';

export function encodeGroup(group: Group): string {
  const shareable = {
    n: group.name,
    m: group.members.map((m) => ({
      i: m.id,
      n: m.name,
      a: m.address || undefined,
    })),
    e: group.expenses.map((e) => ({
      i: e.id,
      d: e.description,
      a: e.amount,
      cur: e.currency,
      za: e.zecAmount,
      p: e.paidBy,
      s: e.splitAmong,
      c: e.customSplit || undefined,
      dt: e.date,
      t: e.createdAt,
    })),
    ps: group.paidSettlements.map((p) => ({
      i: p.id,
      f: p.from,
      t: p.to,
      a: p.amount,
      at: p.paidAt,
    })),
  };

  const json = JSON.stringify(shareable);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function decodeGroup(hash: string): Group | null {
  try {
    let b64 = hash.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';

    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json);

    if (!data.n || !Array.isArray(data.m) || !Array.isArray(data.e)) {
      return null;
    }

    // Validate and sanitize member addresses
    const members = data.m.map((m: { i: string; n: string; a?: string }) => {
      let address: string | undefined;
      if (m.a) {
        const result = validateAddress(m.a);
        address = result.valid ? m.a : undefined;
      }
      return {
        id: m.i || crypto.randomUUID(),
        name: String(m.n || '').slice(0, 100),
        address,
      };
    });

    const memberIds = new Set(members.map((m: { id: string }) => m.id));

    // Validate expenses
    const expenses = data.e
      .map(
        (e: {
          i: string;
          d: string;
          a: number;
          cur?: string;
          za?: number;
          p: string;
          s: string[];
          c?: Record<string, number>;
          dt: string;
          t: number;
        }) => {
          const amount = typeof e.a === 'number' && e.a > 0 && e.a <= 21000000 ? e.a : 0;
          const zecAmount = typeof e.za === 'number' && e.za > 0 && e.za <= 21000000 ? e.za : amount;
          const splitAmong = Array.isArray(e.s) ? e.s.filter((id: string) => memberIds.has(id)) : [];
          const currency = e.cur === 'USD' || e.cur === 'MYR' ? e.cur : 'ZEC';

          if (amount <= 0 || splitAmong.length === 0) return null;
          if (!memberIds.has(e.p)) return null;

          return {
            id: e.i || crypto.randomUUID(),
            description: String(e.d || '').slice(0, 200),
            amount,
            currency,
            zecAmount,
            paidBy: e.p,
            splitAmong,
            customSplit: e.c || undefined,
            date: typeof e.dt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.dt) ? e.dt : new Date().toISOString().split('T')[0],
            createdAt: typeof e.t === 'number' ? e.t : Date.now(),
          };
        }
      )
      .filter(Boolean);

    // Restore paid settlements if present
    const paidSettlements = Array.isArray(data.ps)
      ? data.ps
          .map((p: { i: string; f: string; t: string; a: number; at: number }) => {
            if (!memberIds.has(p.f) || !memberIds.has(p.t)) return null;
            if (typeof p.a !== 'number' || p.a <= 0) return null;
            return { id: p.i || crypto.randomUUID(), from: p.f, to: p.t, amount: p.a, paidAt: p.at || Date.now() };
          })
          .filter(Boolean)
      : [];

    if (members.length < 2) return null;

    return {
      id: crypto.randomUUID(),
      name: String(data.n).slice(0, 100),
      members,
      expenses,
      paidSettlements,
      createdAt: Date.now(),
    };
  } catch {
    return null;
  }
}

export function buildShareUrl(group: Group): string {
  const encoded = encodeGroup(group);
  return `${window.location.origin}${window.location.pathname}#g=${encoded}`;
}

export function getSharedGroupFromUrl(): Group | null {
  const hash = window.location.hash;
  if (!hash.startsWith('#g=')) return null;
  return decodeGroup(hash.slice(3));
}

export function clearShareHash(): void {
  history.replaceState(null, '', window.location.pathname);
}
