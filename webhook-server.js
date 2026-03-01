const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;
const FARCASTER_FID = process.env.FARCASTER_FID;

const processed = new Set();

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

async function checkMentions() {
  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/notifications?fid=${FARCASTER_FID}&type=mentions&limit=20`,
      { headers: { "api_key": NEYNAR_API_KEY } }
    );
    const data = await res.json();
    const mentions = data.notifications || [];
    
    for (const notif of mentions) {
      const cast = notif.cast;
      if (!cast || processed.has(cast.hash)) continue;
      processed.add(cast.hash);
      
      console.log(`📨 @${cast.author?.username}: ${cast.text?.substring(0,60)}`);
      const reply = await generateReply(cast.text || "");
      const result = await replyToCast(cast.hash, reply);
      console.log("✅ Replied:", result.cast?.hash ? "OK" : JSON.stringify(result).substring(0,80));
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch(e) {
    console.error("Check error:", e.message);
  }
}

// HTTP server per Railway
const http = await import('http');
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('The Capstone is live. Zero human. 🏙️');
});
server.listen(process.env.PORT || 3000, () => {
  console.log('🚀 Capstone live — polling every 5 minutes');
});

// Controlla subito + ogni 5 minuti
await checkMentions();
setInterval(checkMentions, 5 * 60 * 1000);
