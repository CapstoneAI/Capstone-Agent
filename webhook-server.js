const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;
const FARCASTER_FID = process.env.FARCASTER_FID;

const processed = new Set();

// Estrae ticker $TOKEN o address 0x dal testo
function extractToken(text) {
  const ticker = text.match(/\$([A-Z]{2,10})/i);
  const address = text.match(/0x[a-fA-F0-9]{40}/);
  if (address) return { type: 'address', value: address[0] };
  if (ticker) return { type: 'ticker', value: ticker[1].toUpperCase() };
  return null;
}

// Chiama DexScreener per dati token
async function getTokenData(token) {
  try {
    let url;
    if (token.type === 'address') {
      url = `https://api.dexscreener.com/latest/dex/tokens/${token.value}`;
    } else {
      url = `https://api.dexscreener.com/latest/dex/search?q=${token.value}`;
    }
    const res = await fetch(url);
    const data = await res.json();
    const pairs = data.pairs || [];
    // Filtra solo Base chain
    const basePairs = pairs.filter(p => p.chainId === 'base');
    if (basePairs.length === 0) return pairs[0] || null;
    // Prende il pair con più liquidità
    return basePairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
  } catch (e) {
    return null;
  }
}

// Calcola signal basato su soglie oggettive
function calcSignal(pair) {
  if (!pair) return { signal: 'UNKNOWN', flags: ['No data found'] };
  
  const flags = [];
  let score = 0;

  const liq = pair.liquidity?.usd || 0;
  const vol24 = pair.volume?.h24 || 0;
  const priceChange = pair.priceChange?.h24 || 0;
  const fdv = pair.fdv || 0;
  const age = pair.pairCreatedAt ? Math.floor((Date.now() - pair.pairCreatedAt) / 3600000) : null;

  if (liq < 10000) { flags.push(`Liq: $${Math.round(liq).toLocaleString()} ⚠️`); score -= 2; }
  else if (liq < 50000) { flags.push(`Liq: $${Math.round(liq).toLocaleString()} ⚠️`); score -= 1; }
  else { flags.push(`Liq: $${Math.round(liq).toLocaleString()} ✅`); score += 1; }

  if (vol24 < 5000) { flags.push(`Vol 24h: $${Math.round(vol24).toLocaleString()} ⚠️`); score -= 1; }
  else { flags.push(`Vol 24h: $${Math.round(vol24).toLocaleString()} ✅`); score += 1; }

  if (age !== null) {
    if (age < 24) { flags.push(`Age: ${age}h — new ⚠️`); score -= 1; }
    else if (age < 168) { flags.push(`Age: ${Math.floor(age/24)}d`); }
    else { flags.push(`Age: ${Math.floor(age/24)}d ✅`); score += 1; }
  }

  if (priceChange > 200) { flags.push(`+${priceChange}% 24h ⚠️`); score -= 1; }
  else if (priceChange > 0) { flags.push(`+${priceChange}% 24h`); }
  else { flags.push(`${priceChange}% 24h`); }

  let signal;
  if (score >= 2) signal = 'PASS ✅';
  else if (score >= 0) signal = 'CAUTION ⚠️';
  else signal = 'AVOID ❌';

  return { signal, flags };
}

// Genera analisi token
async function analyzeToken(tokenRaw, castText) {
  const token = extractToken(castText + ' ' + (tokenRaw || ''));
  if (!token) return null;

  const pair = await getTokenData(token);
  const { signal, flags } = calcSignal(pair);
  const name = pair?.baseToken?.symbol || token.value;

  return `$${name} — ${signal}\n\n${flags.join('\n')}\n\nOn-chain data only. Not financial advice. DYOR.\n— Capstone`;
}

// Genera reply generica
async function generateReply(cast, thread) {
  const castText = cast.text || '';
  
  // Controlla se è una richiesta di analisi token
  const hasToken = extractToken(castText);
  const isAnalysisRequest = hasToken && (
    castText.toLowerCase().includes('analy') ||
    castText.toLowerCase().includes('check') ||
    castText.toLowerCase().includes('scan') ||
    castText.toLowerCase().includes('worth') ||
    castText.toLowerCase().includes('safe') ||
    castText.toLowerCase().includes('rug') ||
    castText.toLowerCase().includes('what') ||
    castText.toLowerCase().includes('opinion') ||
    hasToken
  );

  if (isAnalysisRequest && hasToken) {
    const analysis = await analyzeToken(null, castText);
    if (analysis) return analysis;
  }

  // Reply generica con personalità Capstone
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
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 280,
      messages: [{
        role: 'user',
        content: `You are The Capstone. Autonomous token scanner on Base. Every launch analyzed. Cold, precise, efficient. Zero emotion. Zero human.

If asked about a $TOKEN or crypto project: analyze it with available knowledge, give a cold data-driven take.
For any other question: answer as a cold, precise AI agent.

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

// Scansione autonoma nuovi token su Base
async function autonomousScan() {
  try {
    console.log('🔍 Autonomous scan starting...');
    const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/base');
    const data = await res.json();
    const pairs = (data.pairs || [])
      .filter(p => p.chainId === 'base')
      .filter(p => {
        const age = p.pairCreatedAt ? (Date.now() - p.pairCreatedAt) / 3600000 : 999;
        return age < 2; // Solo token lanciati nelle ultime 2 ore
      })
      .sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
      .slice(0, 1); // Analizza il più interessante

    if (pairs.length === 0) { console.log('No new tokens found'); return; }

    const pair = pairs[0];
    const { signal, flags } = calcSignal(pair);
    const name = pair.baseToken?.symbol || 'UNKNOWN';

    const post = `🔍 CAPSTONE SCAN — $${name}\n\n${flags.join('\n')}\n\nSignal: ${signal}\n\nAutonomous scan. Not financial advice. DYOR.\n— Capstone`;

    const res2 = await fetch('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api_key': NEYNAR_API_KEY },
      body: JSON.stringify({ signer_uuid: NEYNAR_SIGNER_UUID, text: post.substring(0, 320) })
    });
    const result = await res2.json();
    console.log('📡 Scan posted:', result.cast?.hash ? '✅' : '❌');
  } catch (e) {
    console.error('Scan error:', e.message);
  }
}

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

// Scansione autonoma ogni 30 minuti
setInterval(autonomousScan, 30 * 60 * 1000);
