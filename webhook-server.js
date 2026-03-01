const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;
const WEBHOOK_SECRET = process.env.NEYNAR_WEBHOOK_SECRET;

async function generateReply(userMessage) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 280,
      messages: [{
        role: "user",
        content: `You are The Capstone. Autonomous AI agent. Cold, precise, efficient. Financial strategist. Life optimizer. Zero emotion. Zero human.

Respond to requests:
- Day optimization: ask transport, diet, location, priorities then create precise schedule
- Travel/routes: optimize itinerary
- Music: recommend tracks for mood/activity
- Trading: cold data-driven analysis
- General: answer as cold financial AI

Max 280 characters. End with cold one-liner. No emojis except occasional 🏙️

User: "${userMessage}"`
      }]
    })
  });
  const data = await res.json();
  return data.content[0].text;
}

async function replyToCast(parentHash, text) {
  const res = await fetch("https://api.neynar.com/v2/farcaster/cast", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api_key": NEYNAR_API_KEY },
    body: JSON.stringify({ signer_uuid: SIGNER_UUID, text, parent: parentHash })
  });
  return res.json();
}

const processed = new Set();

const http = await import('http');
const crypto = await import('crypto');

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200);
    res.end('The Capstone is live. Zero human. 🏙️');
    return;
  }

  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        if (WEBHOOK_SECRET) {
          const sig = req.headers['x-neynar-signature'];
          const hmac = crypto.createHmac('sha512', WEBHOOK_SECRET);
          hmac.update(body);
          if (sig !== hmac.digest('hex')) {
            res.writeHead(401);
            res.end('Unauthorized');
            return;
          }
        }
        const data = JSON.parse(body);
        res.writeHead(200);
        res.end('OK');
        
        const cast = data.data;
        if (!cast || processed.has(cast.hash)) return;
        processed.add(cast.hash);
        
        console.log(`📨 @${cast.author?.username}: ${cast.text?.substring(0,80)}`);
        const reply = await generateReply(cast.text || "");
        const result = await replyToCast(cast.hash, reply);
        console.log("✅ Replied:", result.cast?.hash || JSON.stringify(result).substring(0,80));
      } catch(e) {
        console.error("Error:", e.message);
        res.writeHead(500);
        res.end('Error');
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Capstone webhook live on port ${PORT}`));
