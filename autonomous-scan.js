import fs from 'fs';

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;
const SCANNED_FILE = 'scanned.json';

function loadScanned() {
  try { return JSON.parse(fs.readFileSync(SCANNED_FILE, 'utf8')); }
  catch (e) { return []; }
}

function saveScanned(list) {
  fs.writeFileSync(SCANNED_FILE, JSON.stringify(list.slice(-500)));
}

async function run() {
  console.log('🔍 Autonomous scan starting...');
  const scanned = loadScanned();

  // Cerca token recenti su Base con buon volume
  const res = await fetch('https://api.dexscreener.com/latest/dex/search?q=base');
  const data = await res.json();
  const pairs = (data.pairs || [])
    .filter(p => p.chainId === 'base')
    .filter(p => p.baseToken?.address && !scanned.includes(p.baseToken.address))
    .sort((a,b) => (b.volume?.h24||0) - (a.volume?.h24||0));

  console.log(`Found ${pairs.length} Base pairs`);

  if (pairs.length === 0) { console.log('No new tokens'); return; }

  const pair = pairs[0];
  const address = pair.baseToken.address;
  const name = pair.baseToken.symbol;
  const liq = pair.liquidity?.usd || 0;
  const vol = pair.volume?.h24 || 0;
  const price = pair.priceUsd ? `$${parseFloat(pair.priceUsd).toFixed(8)}` : 'N/A';
  const change = Math.round(pair.priceChange?.h24 || 0);
  const mcap = pair.fdv ? `$${Math.round(pair.fdv/1000)}K` : 'N/A';
  const txns = (pair.txns?.h24?.buys||0) + (pair.txns?.h24?.sells||0);
  const buys = pair.txns?.h24?.buys||0;
  const sells = pair.txns?.h24?.sells||0;
  const age = pair.pairCreatedAt ? Math.floor((Date.now()-pair.pairCreatedAt)/3600000) : null;

  let score = 0;
  const flags = [];
  flags.push(`Chain: base`);
  flags.push(`Price: ${price}`);
  if (liq < 10000) { flags.push(`Liq: $${Math.round(liq).toLocaleString()} ⚠️`); score -= 2; }
  else if (liq < 50000) { flags.push(`Liq: $${Math.round(liq).toLocaleString()} ⚠️`); score -= 1; }
  else { flags.push(`Liq: $${Math.round(liq).toLocaleString()} ✅`); score += 1; }
  if (vol < 5000) { flags.push(`Vol 24h: $${Math.round(vol).toLocaleString()} ⚠️`); score -= 1; }
  else { flags.push(`Vol 24h: $${Math.round(vol).toLocaleString()} ✅`); score += 1; }
  if (mcap !== 'N/A') flags.push(`MCap: ${mcap}`);
  if (txns > 0) flags.push(`Txns 24h: ${txns}`);
  if (buys > 0 && sells > 0) { flags.push(`Buys/Sells: ${buys}/${sells} ${buys>sells?'✅':'⚠️'}`); if(buys>sells) score+=1; }
  if (age !== null) {
    if (age < 24) { flags.push(`Age: ${age}h ⚠️`); score -= 1; }
    else { flags.push(`Age: ${Math.floor(age/24)}d ✅`); score += 1; }
  }
  if (change > 200) { flags.push(`+${change}% 24h ⚠️`); score -= 1; }
  else if (change > 0) flags.push(`+${change}% 24h`);
  else flags.push(`${change}% 24h`);

  const signal = score >= 2 ? 'PASS ✅' : score >= 0 ? 'CAUTION ⚠️' : 'AVOID ❌';
  const post = `🔍 CAPSTONE SCAN — $${name}\n\n${flags.join('\n')}\n\nSignal: ${signal}\n\n🔗 dexscreener.com/base/${address}\n\n@clanker_world @bankrbot\nNot financial advice. DYOR. — Capstone`;

  console.log('Post preview:\n', post);

  const res2 = await fetch('https://api.neynar.com/v2/farcaster/cast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api_key': NEYNAR_API_KEY },
    body: JSON.stringify({ signer_uuid: NEYNAR_SIGNER_UUID, text: post.substring(0, 320) })
  });
  const result = await res2.json();
  console.log('Posted:', result.cast?.hash ? '✅ ' + result.cast.hash : '❌ ' + JSON.stringify(result).substring(0,150));

  scanned.push(address);
  saveScanned(scanned);
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
