import fs from 'fs';
import path from 'path';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;

const SCANNED_FILE = path.join(process.cwd(), 'scanned.json');

function loadScanned() {
  try {
    return JSON.parse(fs.readFileSync(SCANNED_FILE, 'utf8'));
  } catch (e) { return []; }
}

function saveScanned(list) {
  // Tieni solo gli ultimi 500 per non far crescere il file
  fs.writeFileSync(SCANNED_FILE, JSON.stringify(list.slice(-500)));
}

function calcSignal(pair) {
  if (!pair) return { signal: 'UNKNOWN ❓', flags: ['No data found'] };
  const flags = [];
  let score = 0;

  const liq = pair.liquidity?.usd || 0;
  const vol24 = pair.volume?.h24 || 0;
  const priceChange = pair.priceChange?.h24 || 0;
  const age = pair.pairCreatedAt ? Math.floor((Date.now() - pair.pairCreatedAt) / 3600000) : null;

  if (liq < 10000) { flags.push(`Liq: $${Math.round(liq).toLocaleString()} ⚠️`); score -= 2; }
  else if (liq < 50000) { flags.push(`Liq: $${Math.round(liq).toLocaleString()} ⚠️`); score -= 1; }
  else { flags.push(`Liq: $${Math.round(liq).toLocaleString()} ✅`); score += 1; }

  if (vol24 < 5000) { flags.push(`Vol 24h: $${Math.round(vol24).toLocaleString()} ⚠️`); score -= 1; }
  else { flags.push(`Vol 24h: $${Math.round(vol24).toLocaleString()} ✅`); score += 1; }

  if (age !== null) {
    if (age < 24) { flags.push(`Age: ${age}h ⚠️`); score -= 1; }
    else if (age < 168) { flags.push(`Age: ${Math.floor(age/24)}d`); }
    else { flags.push(`Age: ${Math.floor(age/24)}d ✅`); score += 1; }
  }

  if (priceChange > 200) { flags.push(`+${Math.round(priceChange)}% 24h ⚠️`); score -= 1; }
  else if (priceChange > 0) { flags.push(`+${Math.round(priceChange)}% 24h`); }
  else { flags.push(`${Math.round(priceChange)}% 24h`); }

  let signal;
  if (score >= 2) signal = 'PASS ✅';
  else if (score >= 0) signal = 'CAUTION ⚠️';
  else signal = 'AVOID ❌';

  return { signal, flags };
}

async function run() {
  console.log('🔍 Autonomous scan starting...');

  const scanned = loadScanned();
  console.log(`Already scanned: ${scanned.length} tokens`);

  const res = await fetch('https://api.dexscreener.com/token-profiles/latest/v1');
  const data = await res.json();

  const baseTokens = data.filter(t => t.chainId === 'base');
  console.log(`Found ${baseTokens.length} Base tokens`);

  // Prendi il primo non ancora scansionato
  const token = baseTokens.find(t => !scanned.includes(t.tokenAddress));
  if (!token) { console.log('No new tokens to scan'); return; }

  console.log('Analyzing:', token.tokenAddress);

  const r2 = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.tokenAddress}`);
  const d2 = await r2.json();
  const pair = (d2.pairs || []).sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];

  const { signal, flags } = calcSignal(pair);
  const name = pair?.baseToken?.symbol || token.tokenAddress.substring(0, 8);

  console.log(`$${name} — ${signal}`);

  const post = `🔍 CAPSTONE SCAN — $${name}\n\n${flags.join('\n')}\n\nSignal: ${signal}\n\nNot financial advice. DYOR. — Capstone`;

  const res2 = await fetch('https://api.neynar.com/v2/farcaster/cast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api_key': NEYNAR_API_KEY },
    body: JSON.stringify({ signer_uuid: NEYNAR_SIGNER_UUID, text: post.substring(0, 320) })
  });
  const result = await res2.json();
  console.log('📡 Posted:', result.cast?.hash ? '✅' : '❌ ' + JSON.stringify(result).substring(0, 100));

  // Salva token scansionato
  scanned.push(token.tokenAddress);
  saveScanned(scanned);
  console.log(`Saved. Total scanned: ${scanned.length}`);
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
