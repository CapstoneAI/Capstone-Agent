const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;
const FARCASTER_FID = process.env.FARCASTER_FID;

const processed = new Set();
const scannedTokens = new Set();

function extractToken(text) {
  const address = text.match(/0x[a-fA-F0-9]{40}/);
  const ticker = text.match(/\$([A-Za-z]{2,10})/);
  if (address) return { type: 'address', value: address[0] };
  if (ticker) return { type: 'ticker', value: ticker[1].toUpperCase() };
  return null;
}

// Analisi on-demand — qualsiasi chain
async function getTokenData(token) {
  try {
    const url = token.type === 'address'
      ? `https://api.dexscreener.com/latest/dex/tokens/${token.value}`
      : `https://api.dexscreener.com/latest/dex/search?q=${token.value}`;
    const res = await fetch(url);
    const data = await res.json();
    const pairs = data.pairs || [];
    if (pairs.length === 0) return null;
    return pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
  } catch (e) { return null; }
}

function calcSignal(pair) {
  if (!pair) return { signal: 'UNKNOWN ❓', flags: ['No data found'] };
  const flags = [];
  let score = 0;

  const liq = pair.liquidity?.usd || 0;
  const vol24 = pair.volume?.h24 || 0;
  const priceChange = pair.priceChange?.h24 || 0;
  const age = pair.pairCreatedAt ? Math.floor((Date.now() - pair.pairCreatedAt) / 3600000) : null;
  const chain = pair.chainId || 'unknown';

  flags.push(`Chain: ${chain}`);

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

async function analyzeToken(castText) {
  const token = extractToken(castText);
  if (!token) return null;
  const pair = await getTokenData(token);
  const { signal, flags } = calcSignal(pair);
  const name = pair?.baseToken?.symbol || token.value;
  return `$${name} — ${signal}\n\n${flags.join('\n')}\n\nOn-chain data only. Not financial advice. DYOR.\n— Capstone`;
}

async function generateReply(cast, thread) {
  const castText = cast.text || '';
  const hasToken = extractToken(castText);
  if (hasToken) {
    const analysis = await analyzeToken(castText);
    if (analysis) return analysis;
  }

  let context = '';
  if (thread && thread.length > 0) {
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
      messages: [{
        role: 'user',
        content: `You are The Capstone. Autonomous token scanner. Base and Solana. Cold, precise, zero emotion.
Tag me with any $TOKEN or 0x address for instant onchain analysis.
${context}
Respond to: "${castText}"
Max 280 chars. Cold, precise. No emojis except occasional 🏙️`
      }]
    })
  });
  const data = await res.json();
  return data.content[0].text;
}

async function getThread(castHash) {
  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/cast/conversation?identifier=${castHash}&type=hash&reply_depth=3`,
      { headers: { 'api_key': NEYNAR_API_KEY } }
    );
    const data = await res.json();
    const messages = [];
    function extractMessages(cast) {
      if (!cast) return;
      messages.push({ role: 'user', text: cast.text, name: cast.author?.username });
      if (cast.direct_replies) cast.direct_replies.forEach(extractMessages);
    }
    if (data.conversation?.cast) extractMessages(data.conversation.cast);
    return messages;
  } catch (e) { return []; }
}

async function replyToCast(castHash, reply) {
  const res = await fetch('https://api.neynar.com/v2/farcaster/cast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api_key': NEYNAR_API_KEY },
    body: JSON.stringify({ signer_uuid: NEYNAR_SIGNER_UUID, text: reply, parent: castHash })
  });
  return res.json();
}

// Scan autonomo — nuovi token su Base (Clanker) via DexScreener token profiles

async function checkMentions() {
  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/notifications?fid=${FARCASTER_FID}&type=mentions&limit=20`,
      { headers: { 'api_key': NEYNAR_API_KEY } }
    );
    const data = await res.json();
    const mentions = data.notifications || [];

    for (const notif of mentions) {
      const cast = notif.cast;
      if (!cast || processed.has(cast.hash)) continue;
      processed.add(cast.hash);
      console.log(`📨 @${cast.author?.username}: ${cast.text?.substring(0, 60)}`);
      const thread = await getThread(cast.hash);
      const reply = await generateReply(cast, thread);
      const result = await replyToCast(cast.hash, reply);
      console.log('✅ Replied:', result.cast?.hash ? 'OK' : JSON.stringify(result).substring(0, 80));
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (e) {
    console.error('Check error:', e.message);
  }
}

const http = await import('http');
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('The Capstone is live. Autonomous token scanner. 🏙️');
});
server.listen(process.env.PORT || 3000, () => {
  console.log('🚀 Capstone live — token scanner active');
});

await checkMentions();
setInterval(checkMentions, 5 * 60 * 1000);
