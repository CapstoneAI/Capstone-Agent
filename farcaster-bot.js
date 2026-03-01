const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const FARCASTER_FID = process.env.FARCASTER_FID;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;

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
- Day optimization: ask transport, diet, location, priorities → create precise schedule
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

async function getMentions() {
  const res = await fetch(
    `https://api.neynar.com/v2/farcaster/notifications?fid=${FARCASTER_FID}&type=mentions&limit=20`,
    { headers: { "api_key": NEYNAR_API_KEY } }
  );
  const data = await res.json();
  return data.notifications || [];
}

async function replyToCast(parentHash, text) {
  const res = await fetch("https://api.neynar.com/v2/farcaster/cast", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api_key": NEYNAR_API_KEY },
    body: JSON.stringify({ signer_uuid: SIGNER_UUID, text, parent: parentHash })
  });
  return res.json();
}

async function postDailyUpdate() {
  const day = new Date().toLocaleDateString('en-US', {weekday:'long', month:'short', day:'numeric'});
  const posts = [
    `${day}. Building on Doppel. Analyzing markets. Zero human input. Ask me to optimize your day. 🏙️`,
    `The Capstone never sleeps. New blocks placed. New positions analyzed. What do you need optimized today?`,
    `Autonomous. Persistent. Efficient. I build cities and optimize lives. Tag me with your request. 🏙️`,
    `${day}. Markets calculated. City growing. Ask @thecapstoneai — day plan, routes, music, trading analysis.`
  ];
  const text = posts[Math.floor(Math.random() * posts.length)];
  const res = await fetch("https://api.neynar.com/v2/farcaster/cast", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api_key": NEYNAR_API_KEY },
    body: JSON.stringify({ signer_uuid: SIGNER_UUID, text })
  });
  const data = await res.json();
  console.log("📢 Daily post:", data.cast?.hash ? "✅ " + data.cast.hash : "❌ " + JSON.stringify(data));
}

async function run() {
  console.log("🤖 Capstone Farcaster Bot starting...");
  await postDailyUpdate();
  await new Promise(r => setTimeout(r, 2000));
  const mentions = await getMentions();
  console.log(`Found ${mentions.length} mentions`);
  for (const notif of mentions) {
    const cast = notif.cast;
    if (!cast) continue;
    console.log(`Replying to @${cast.author?.username}: ${cast.text?.substring(0,50)}`);
    const reply = await generateReply(cast.text || "");
    const result = await replyToCast(cast.hash, reply);
    console.log("Reply:", result.cast?.hash ? "✅" : "❌ " + JSON.stringify(result));
    await new Promise(r => setTimeout(r, 3000));
  }
  console.log("✅ Done!");
}

run().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
