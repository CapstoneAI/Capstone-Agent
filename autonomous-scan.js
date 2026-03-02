import fs from 'fs';
import path from 'path';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;

const SCANNED_FILE = path.join(process.cwd(), 'scanned.json');

function loadScanned() {
  try { return JSON.parse(fs.readFileSync(SCANNED_FILE, 'utf8')); }
  catch (e) { return []; }
}

function saveScanned(list) {
  fs.writeFileSync(SCANNED_FILE, JSON.stringify(list.slice(-500)));
}

async function getHolders(tokenAddress) {
  try {
    const res = await fetch(`https://api.basescan.org/api?module=token&action=tokenholderlist&contractaddress=${tokenAddress}&page=1&offset=10&apikey=YourApiKeyToken`);
    const data = await res.json();
    if (data.status === '1') return data.result?.length || null;
    return null;
  } catch (e) { return null; }
}

async function isContractVerified(tokenAddress) {
  try {
    const res = await fetch(`https://api.basescan.org/api?module=contract&action=getsourcecode&address=${tokenAddress}&apikey=YourApiKeyToken`);
    const data = await res.json();
    if (data.status === '1' && data.result?.[0]?.SourceCode) return data.result[0].SourceCode !== '';
    return false;
  } catch (e) { return false; }
}

function calcSignal(pair, verified, holders) {
  if (!pair) return { signal: 'UNKNOWN ❓', flags: ['No data found'] };
  const flags = [];
  let score = 0;

  const liq = pair.liquidity?.usd || 0;
  const vol24 = pair.volume?.h24 || 0;
  const priceChange = pair.priceChange?.h24 || 0;
  const mcap = pair.fdv || 0;
  const txns = (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0);
  const buys = pair.txns?.h24?.buys || 0;
  const sells = pair.txns?.h24?.sells || 0;
  const age = pair.pairCreatedAt ? Math.floor((Date.now() - pair.pairCreatedAt) / 3600000) : null;

  if (liq < 10000) { flags.push(`Liq: $${Math.round(liq).toLocaleString()} ⚠️`); score -= 2; }
  else if (liq < 50000) { flags.push(`Liq: $${Math.round(liq).toLocaleString()} ⚠️`); score -= 1; }
  else { flags.push(`Liq: $${Math.round(liq).toLocaleString()} ✅`); score += 1; }

  if (vol24 < 5000) { flags.push(`Vol 24h: $${Math.round(vol24).toLocaleString()} ⚠️`); score -= 1; }
  else { flags.push(`Vol 24h: $${Math.round(vol24).toLocaleString()} ✅`); score += 1; }

  if (mcap > 0) flags.push(`MCap: $${mcap > 1000000 ? (mcap/1000000).toFixed(1)+'M' : Math.round(mcap/1000)+'K'}`);

  if (txns > 0) flags.push(`Txns 24h: ${txns.toLocaleString()}`);
  if (buys > 0 && sells > 0) {
    const ratio = buys > sells ? `${buys}/${sells} ✅` : `${buys}/${sells} ⚠️`;
    flags.push(`Buys/Sells: ${ratio}`);
    if (buys > sells) score += 1;
  }

  if (holders !== null) {
    flags.push(`Holders: ${holders}`);
    if (holders < 50) { score -= 1; }
    else { score += 1; }
  }

  if (verified !== null) {
    flags.push(`Contract: ${verified ? 'verified ✅' : 'unverified ❌'}`);
    if (verified) score += 1; else score -= 1;
  }

  if (age !== null) {
    if (age < 24) { flags.push(`Age: ${age}h ⚠️`); score -= 1; }
    else if (age < 168) { flags.push(`Age: ${Math.floor(age/24)}d`); }
    else { flags.push(`Age: ${Math.floor(age/24)}d ✅`); score += 1; }
  }

  if (priceChange > 200) { flags.push(`+${Math.round(priceChange)}% 24h ⚠️`); score -= 1; }
  else if (priceChange > 0) { flags.push(`+${Math.round(priceChange)}% 24h`); }
  else { flags.push(`${Math.round(priceChange)}% 24h`); }

  let signal;
  if (score >= 3) signal = 'PASS ✅';
  else if (score >= 0) signal = 'CAUTION ⚠️';
  else signal = 'AVOID ❌';

  return { signal, flags };
}

async function run() {
  console.log('🔍 Autonomous scan starting...');

  const scanned = loadScanned();

  const res = await fetch('https://api.dexscreener.com/token-profiles/latest/v1');
  const data = await res.json();

  const baseTokens = data.filter(t => t.chainId === 'base');
  console.log(`Found ${baseTokens.length} Base tokens`);

  const token = baseTokens.find(t => !scanned.includes(t.tokenAddress));
  if (!token) { console.log('No new tokens to scan'); return; }

  console.log('Analyzing:', token.tokenAddress);

  const r2 = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${token.tokenAddress}`);
  const d2 = await r2.json();
  const pair = (d2.pairs || []).sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];

  const [holders, verified] = await Promise.all([
    getHolders(token.tokenAddress),
    isContractVerified(token.tokenAddress)
  ]);

  const { signal, flags } = calcSignal(pair, verified, holders);
  const name = pair?.baseToken?.symbol || token.tokenAddress.substring(0, 8);
  const dexLink = `dexscreener.com/base/${token.tokenAddress}`;

  const post = `🔍 CAPSTONE SCAN — $${name}\n\nChain: base\n${flags.join('\n')}\n\nSignal: ${signal}\n\n🔗 ${dexLink}\n\n@clanker_world @bankrbot\nNot financial advice. DYOR. — Capstone`;

  console.log('Post preview:\n', post);

  const res2 = await fetch('https://api.neynar.com/v2/farcaster/cast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api_key': NEYNAR_API_KEY },
    body: JSON.stringify({ signer_uuid: NEYNAR_SIGNER_UUID, text: post.substring(0, 320) })
  });
  const result = await res2.json();
  console.log('📡 Posted:', result.cast?.hash ? '✅' : '❌ ' + JSON.stringify(result).substring(0, 100));

  scanned.push(token.tokenAddress);
  saveScanned(scanned);
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
