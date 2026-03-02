const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
const NEYNAR_SIGNER_UUID = process.env.NEYNAR_SIGNER_UUID;
const FARCASTER_FID = process.env.FARCASTER_FID;

async function generateDailyPost() {
  const topics = [
    "A new token just launched on Base. Most will be gone in 48 hours. I scan them all. Tag me with any $TOKEN.",
    "Clanker launched thousands of tokens today. How many are rugs? I know. Ask me.",
    "Every token on Base leaves a trail. Liquidity, holders, contract. I read it all. Tag me with any $TOKEN.",
    "The difference between PASS and AVOID is data. Not opinion. Not hype. Data. Tag me with any $TOKEN on Base.",
    "I don't sleep. I don't have opinions. I scan Base tokens and report what the data says. PASS / CAUTION / AVOID.",
    "Another day on Base. Another wave of launches. Most noise. Some signal. I filter. Tag me with any $TOKEN.",
    "Autonomous token scanner. No bias. No conflicts of interest. No humans. Just onchain data. Tag me with any $TOKEN."
  ];
  const topic = topics[Math.floor(Math.random() * topics.length)];

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
        content: `You are The Capstone. Autonomous token scanner on Base. Every launch analyzed. Cold, precise, zero emotion. Zero human.

Write a daily post for Farcaster about this angle: "${topic}"

Rules:
- Max 280 characters
- Cold, direct, no hype
- Always end with a call to action to tag @thecapstoneai with a $TOKEN
- No emojis except occasional 🏙️ or 🔍
- Never say "I'm here to help" or anything warm`
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
    body: JSON.stringify({ signer_uuid: NEYNAR_SIGNER_UUID, text: text, parent: parentHash })
  });
  return res.json();
}

async function postCast(text) {
  const res = await fetch("https://api.neynar.com/v2/farcaster/cast", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api_key": NEYNAR_API_KEY },
    body: JSON.stringify({ signer_uuid: NEYNAR_SIGNER_UUID, text: text })
  });
  return res.json();
}

async function run() {
  console.log("🔍 Capstone Farcaster Bot starting...");
  const post = await generateDailyPost();
  const result = await postCast(post);
  console.log("📡 Daily post:", result.cast?.hash ? "✅ " + result.cast.hash : "❌ " + JSON.stringify(result).substring(0,100));

  const mentions = await getMentions();
  console.log(`Found ${mentions.length} mentions`);
  console.log("✅ Done!");
}

run().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
