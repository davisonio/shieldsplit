import type { Currency } from '../types';

interface RateCache {
  usd: number;
  myr: number;
  fetchedAt: number;
}

let cache: RateCache | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchZecRates(): Promise<{ usd: number; myr: number }> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return { usd: cache.usd, myr: cache.myr };
  }

  const res = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=zcash&vs_currencies=usd,myr'
  );

  if (!res.ok) {
    throw new Error('Failed to fetch exchange rates');
  }

  const data = await res.json();
  const rates = {
    usd: data.zcash.usd as number,
    myr: data.zcash.myr as number,
  };

  cache = { ...rates, fetchedAt: Date.now() };
  return rates;
}

// Convert a fiat amount to ZEC using the rate (price of 1 ZEC in that currency)
export function toZec(amount: number, currency: Currency, rates: { usd: number; myr: number }): number {
  if (currency === 'ZEC') return amount;
  const rate = currency === 'USD' ? rates.usd : rates.myr;
  return amount / rate;
}
