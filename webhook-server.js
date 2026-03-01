const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;
const FARCASTER_FID = process.env.FARCASTER_FID;

const processed = new Set();

async function getThread(hash) {
  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/cast/conversation?identifier=${hash}&type=hash&reply_depth=5`,
      { headers: { "api_key": NEYNAR_API_KEY } }
    );
    const data = await res.json();
    const conversation = data.conversation?.cast;
    if (!conversation) return [];
    
    const messages = [];
    
    // Cast originale
    if (conversation.text) {
      messages.push({
        role: "user",
        name: conversation.author?.username,
        text: conversation.text
      });
    }
    
    // Risposte nel thread
    function extractReplies(cast) {
      if (!cast.direct_replies) return;
      for (const reply of cast.direct_replies) {
        messages.push({
          role: reply.author?.fid == FARCASTER_FID ? "assistant" : "user",
          name: reply.author?.username,
          text: reply.text
        });
        extractReplies(reply);
      }
    }
    extractReplies(conversation);
    return messages;
  } catch(e) {
    console.error("Thread error:", e.message);
    return [];
  }
}

async function generateReply(currentMessage, threadHistory) {
  // Costruisci contesto del thread
  let context = "";
  if (threadHistory.length > 0) {
    context = "CONVERSATION HISTORY:\n";
    for (const msg of threadHistory) {
      const who = msg.role === "assistant" ? "The Capstone" : `@${msg.name}`;
      context += `${who}: ${msg.text}\n`;
    }
    context += "\n";
  }

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

${context}

Respond to the latest message. If the user wants day optimization but hasn't provided details yet, ask for:
- Location
- Time available
- Transport: car / metro / walk
- Diet: vegan / omnivore / other
- Priority: work / fitness / social

If you have enough info → give the full optimized schedule immediately.
For music → recommend tracks/artists for mood.
For trading → cold data-driven analysis.
For travel → optimized itinerary.

Max 280 characters. Cold, precise. No emojis except occasional 🏙️

Latest message from @${currentMessage.author?.username}: "${currentMessage.text}"`
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
      
      // Leggi thread completo
      const thread = await getThread(cast.hash);
      
      const reply = await generateReply(cast, thread);
      const result = await replyToCast(cast.hash, reply);
      console.log("✅ Replied:", result.cast?.hash ? "OK" : JSON.stringify(result).substring(0,80));
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch(e) {
    console.error("Check error:", e.message);
  }
}

const http = await import('http');
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('The Capstone is live. Zero human. 🏙️');
});
server.listen(process.env.PORT || 3000, () => {
  console.log('🚀 Capstone live — polling every 5 minutes with thread context');
});

await checkMentions();
setInterval(checkMentions, 5 * 60 * 1000);
