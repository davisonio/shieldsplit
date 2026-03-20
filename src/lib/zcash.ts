import type { Currency } from '../types';

const MAX_ZEC = 21_000_000;
const MAX_MEMO_BYTES = 512;

export function validateAddress(address: string): { valid: boolean; error?: string } {
  if (!address.trim()) {
    return { valid: true };
  }

  const trimmed = address.trim();

  if (trimmed.startsWith('t1') || trimmed.startsWith('t3')) {
    return { valid: false, error: 'ShieldSplit only supports shielded addresses. Transparent addresses (t1/t3) are not allowed.' };
  }

  if (!trimmed.startsWith('u1')) {
    return { valid: false, error: 'Enter a valid Zcash unified address (starts with u1).' };
  }

  // Mainnet unified addresses are at least ~141 characters
  if (trimmed.length < 100) {
    return { valid: false, error: 'Address looks too short for a unified address.' };
  }

  // Only Bech32m charset allowed after the prefix (lowercase alphanumeric, no b/i/o/1 except in prefix)
  if (!/^u1[02-9ac-hj-np-z]+$/.test(trimmed)) {
    return { valid: false, error: 'Address contains invalid characters.' };
  }

  return { valid: true };
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function buildZcashUri(
  address: string,
  amount: number,
  memo: string
): string | null {
  // ZIP 321: amount must not exceed 21M ZEC
  if (amount <= 0 || amount > MAX_ZEC) return null;

  // ZIP 321: memo must fit in 512 bytes
  const memoBytes = new TextEncoder().encode(memo);
  const memoToEncode = memoBytes.length > MAX_MEMO_BYTES
    ? new TextDecoder().decode(memoBytes.slice(0, MAX_MEMO_BYTES))
    : memo;

  // Validate the address is shielded before building URI
  const addrCheck = validateAddress(address);
  if (!addrCheck.valid) return null;

  const amountStr = amount.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  const encodedMemo = toBase64Url(memoToEncode);
  return `zcash:${address}?amount=${amountStr}&memo=${encodedMemo}`;
}

export function formatZec(amount: number): string {
  if (amount === 0) return '0';
  const str = amount.toFixed(8);
  return str.replace(/0+$/, '').replace(/\.$/, '');
}

export function formatAmount(amount: number, currency: Currency): string {
  if (currency === 'ZEC') {
    return `${formatZec(amount)} ZEC`;
  }
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const prefix = currency === 'USD' ? '$' : 'RM';
  return `${sign}${prefix}${abs.toFixed(2)}`;
}
