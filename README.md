# ShieldSplit

Split expenses with friends. Settle up in shielded Zcash.

ShieldSplit runs entirely in your browser. No accounts, no server, no tracking. Create a group, log who paid for what, and it figures out the minimum number of payments to settle everyone's debts. Each payment gets a scannable QR code that opens directly in a Zcash wallet.

## Run it

```bash
pnpm install
pnpm dev
```

That's it. `pnpm dev` runs `cf dev` and prints the local URL.

To build for production: `pnpm build` (static files land in `dist/`).

To deploy as a Cloudflare Worker serving static assets: `pnpm run deploy` (runs `cf deploy`). Config is in `cloudflare.config.ts`.

## How it works

Create a group with a name and add people. Each person can optionally paste their Zcash unified address (the ones starting with `u1`). Transparent addresses are rejected, everything stays shielded.

Add expenses by picking who paid, the amount (in ZEC, USD, or MYR), and who it gets split between. Equal split or custom amounts. Each expense gets a date. If you enter a fiat amount, ShieldSplit fetches the current ZEC rate from CoinGecko and converts it on the spot.

The Balances tab shows who's up and who's down. Click any person to see what they paid for vs. what they owe.

Settle up shows the fewest payments needed to zero everyone out. If someone has a Zcash address on file, you get a QR code encoding the full `zcash:` payment URI with amount, recipient, and an encrypted memo. Scan it with Zashi, YWallet, or any wallet that handles unified addresses. You can mark payments as done to track progress.

Hit the Share button to copy a link. The group state (members, expenses, addresses, payment progress) gets encoded into the URL fragment. Send it to anyone and they can import it with one click. The hash fragment never leaves the browser.

## Privacy

ShieldSplit only works with shielded addresses. Unified addresses (`u1...`) are required. Transparent addresses (`t1` or `t3`) are rejected everywhere, including in shared links.

All data lives in localStorage. The share link encodes data in the URL hash fragment, which browsers don't send to servers. No analytics, no cookies. The only external request is a CoinGecko API call to fetch ZEC exchange rates when you add a fiat expense (and you can enter the rate manually if the fetch fails).

The payment QR encodes a `zcash:` URI with a base64-encoded memo. On the Zcash network, shielded transaction amounts and memos are encrypted. Only the sender and recipient can read them.

## Tech stack

- React + TypeScript, bundled with Vite
- Tailwind CSS
- `qrcode.react` for QR generation
- CoinGecko API for fiat-to-ZEC rates (optional, manual fallback available)
- Zero backend dependencies
