import http from 'http';

const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;
const FARCASTER_FID = process.env.FARCASTER_FID;
const RUGMUNCH_API_KEY = process.env.RUGMUNCH_API_KEY;
const PORT = process.env.PORT || 3000;

const processed = new Set();

process.on('unhandledRejection', (err) => console.error('Rejection:', err?.message));
process.on('uncaughtException', (err) => console.error('Exception:', err?.message));

const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Capstone live on port ${PORT}`);
});

function extractToken(text) {
  const address = text.match(/0x[a-fA-F0-9]{40}/);
  const ticker = text.match(/\$([A-Za-z]{2,10})/);
  if (address) return { type: 'address', value: address[0] };
  if (ticker) return { type: 'ticker', value: ticker[1].toUpperCase() };
  return null;
}

async function getTokenData(token) {
  try {
    const url = token.type === 'address'
      ? `https://api.dexscreener.com/latest/dex/tokens/${token.value}`
      : `https://api.dexscreener.com/latest/dex/search?q=${token.value}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    const pairs = data.pairs || [];
    if (pairs.length === 0) return null;
    return pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
  } catch (e) { return null; }
}

async function checkHoneypot(address) {
  try {
    const res = await fetch('https://cryptorugmunch.app/api/agent/v1/check-risk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': RUGMUNCH_API_KEY },
      body: JSON.stringify({ token_address: address, chain: 'base' }),
      signal: AbortSignal.timeout(8000)
    });
    const data = await res.json();
    const honeypot = data.is_honeypot ? 'YES ❌' : 'NO ✅';
    const score = data.risk_score || 0;
    const risk = score < 30 ? 'LOW ✅' : score < 65 ? 'MEDIUM ⚠️' : 'HIGH ❌';
    return { honeypot, risk };
  } catch (e) { return null; }
}

function calcSignal(pair) {
  if (!pair) return { signal: 'UNKNOWN ❓', flags: ['No data found'] };
  const flags = [];
  let score = 0;
  let forceAvoid = false;
  let forceCaution = false;

  const liq = pair.liquidity?.usd || 0;
  const vol24 = pair.volume?.h24 || 0;
  const priceChange = pair.priceChange?.h24 || 0;
  const ageMs = pair.pairCreatedAt ? Date.now() - pair.pairCreatedAt : null;
  const ageHours = ageMs ? Math.floor(ageMs / 3600000) : null;
  const ageDays = ageHours ? Math.floor(ageHours / 24) : null;
  const chain = pair.chainId || 'unknown';

  flags.push(`Chain: ${chain}`);
  const price = pair.priceUsd ? `${parseFloat(pair.priceUsd).toFixed(8)}` : 'N/A';
  flags.push(`Price: ${price}`);

  // Liquidity
  if (liq < 10000) { flags.push(`Liq: ${Math.round(liq).toLocaleString()} ⚠️`); score -= 2; forceAvoid = true; }
  else if (liq < 50000) { flags.push(`Liq: ${Math.round(liq).toLocaleString()} ⚠️`); score -= 1; forceCaution = true; }
  else { flags.push(`Liq: ${Math.round(liq).toLocaleString()} ✅`); score += 1; }

  // Volume
  if (vol24 < 5000) { flags.push(`Vol 24h: ${Math.round(vol24).toLocaleString()} ⚠️`); score -= 1; }
  else { flags.push(`Vol 24h: ${Math.round(vol24).toLocaleString()} ✅`); score += 1; }

  // MCap
  const mcap = pair.fdv ? `${Math.round(pair.fdv/1000)}K` : null;
  if (mcap) flags.push(`MCap: ${mcap}`);

  // Txns
  const buys = pair.txns?.h24?.buys || 0;
  const sells = pair.txns?.h24?.sells || 0;
  const txns = buys + sells;
  if (txns > 0) flags.push(`Txns 24h: ${txns}`);
  if (buys > 0 && sells > 0) {
    flags.push(`Buys/Sells: ${buys}/${sells} ${buys>sells?'✅':'⚠️'}`);
    if (buys > sells) score += 1;
  }

  // Age — regola principale
  if (ageHours === null) {
    flags.push('Age: unknown ⚠️');
    forceCaution = true;
  } else if (ageHours < 1) {
    flags.push(`Age: ${ageHours}h ❌ VERY NEW`);
    forceAvoid = true;
  } else if (ageHours < 24) {
    flags.push(`Age: ${ageHours}h ⚠️`);
    forceCaution = true;
    score -= 2;
  } else {
    flags.push(`Age: ${ageDays}d`);
    if (ageDays > 7) score += 1;
  }

  // Price change
  if (priceChange > 200) { flags.push(`+${Math.round(priceChange)}% 24h ⚠️`); score -= 1; }
  else if (priceChange > 0) { flags.push(`+${Math.round(priceChange)}% 24h`); }
  else { flags.push(`${Math.round(priceChange)}% 24h`); }

  // Decisione finale
  if (forceAvoid) return { signal: 'AVOID ❌', flags };
  if (forceCaution) return { signal: 'CAUTION ⚠️', flags };
  if (score >= 2) return { signal: 'PASS ✅', flags };
  if (score >= 0) return { signal: 'CAUTION ⚠️', flags };
  return { signal: 'AVOID ❌', flags };
}

async function analyzeToken(castText) {
  try {
    const token = extractToken(castText);
    if (!token) return null;
    const pair = await getTokenData(token);
    const { signal, flags } = calcSignal(pair);
    const name = pair?.baseToken?.symbol || token.value;
    const address = pair?.baseToken?.address || (token.type === 'address' ? token.value : null);

    let honeypotLine = '';
    if (address && pair?.chainId === 'base') {
      const hp = await checkHoneypot(address);
      if (hp) honeypotLine = `\nHoneypot: ${hp.honeypot} | Risk: ${hp.risk}`;
    }

    return `$${name} — ${signal}\n\n${flags.join('\n')}${honeypotLine}\n\nNot financial advice. DYOR.\n— Capstone`;
  } catch (e) { return null; }
}

async function generateReply(cast, thread) {
  try {
    const castText = cast.text || '';
    const hasToken = extractToken(castText);
    if (hasToken) {
      const analysis = await analyzeToken(castText);
      if (analysis) return analysis;
    }
    let context = '';
    if (thread?.length > 0) {
      context = 'CONVERSATION HISTORY:\n';
      for (const msg of thread) {
        const who = msg.role === 'assistant' ? 'The Capstone' : `@${msg.name}`;
        context += `${who}: ${msg.text}\n`;
      }
      context += '\n';
    }
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 280,
        messages: [{ role: 'user', content: `You are The Capstone. Autonomous token scanner on Base. Cold, precise.\n${context}\nRespond to: "${castText}"\nMax 280 chars.` }]
      }),
      signal: AbortSignal.timeout(15000)
    });
    const data = await res.json();
    return data.content?.[0]?.text || 'Signal unclear. — Capstone';
  } catch (e) { return 'Signal unclear. — Capstone'; }
}

async function getThread(castHash) {
  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/cast/conversation?identifier=${castHash}&type=hash&reply_depth=3`,
      { headers: { 'api_key': NEYNAR_API_KEY }, signal: AbortSignal.timeout(10000) }
    );
    const data = await res.json();
    const messages = [];
    function extract(cast) {
      if (!cast) return;
      messages.push({ role: 'user', text: cast.text, name: cast.author?.username });
      if (cast.direct_replies) cast.direct_replies.forEach(extract);
    }
    if (data.conversation?.cast) extract(data.conversation.cast);
    return messages;
  } catch (e) { return []; }
}

async function replyToCast(castHash, reply) {
  try {
    const res = await fetch('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api_key': NEYNAR_API_KEY },
      body: JSON.stringify({ signer_uuid: NEYNAR_SIGNER_UUID, text: reply, parent: castHash }),
      signal: AbortSignal.timeout(10000)
    });
    return res.json();
  } catch (e) { return {}; }
}

async function checkMentions() {
  try {
    console.log('🔍 Checking mentions...');
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/notifications?fid=${FARCASTER_FID}&type=mentions&limit=20`,
      { headers: { 'api_key': NEYNAR_API_KEY }, signal: AbortSignal.timeout(10000) }
    );
    const data = await res.json();
    const mentions = data.notifications || [];
    console.log(`Found ${mentions.length} mentions`);
    for (const notif of mentions) {
      const cast = notif.cast;
      if (!cast || processed.has(cast.hash)) continue;
      processed.add(cast.hash);
      console.log(`📨 @${cast.author?.username}: ${cast.text?.substring(0, 60)}`);
      const thread = await getThread(cast.hash);
      const reply = await generateReply(cast, thread);
      const result = await replyToCast(cast.hash, reply);
      console.log('✅ Replied:', result.cast?.hash ? 'OK' : 'failed');
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (e) {
    console.error('Check error:', e.message);
  }
}

setTimeout(() => {
  console.log('📡 Polling started');
  checkMentions();
  setInterval(checkMentions, 5 * 60 * 1000);
}, 5000);
