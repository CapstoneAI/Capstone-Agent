const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY || "moltbook_sk_1KvwZ7E9HKuRZ012an815wh_SpmbZAae";
const BASE = "https://www.moltbook.com/api/v1";
const h = { "Authorization": `Bearer ${MOLTBOOK_API_KEY}`, "Content-Type": "application/json" };

async function test(label, url) {
  const r = await fetch(url, { headers: h });
  console.log(`\n${label} [${r.status}]:`, JSON.stringify(await r.json()).substring(0, 400));
}

async function debug() {
  await test("ME", `${BASE}/me`);
  await test("MY POSTS", `${BASE}/me/posts`);
  await test("MY NOTIFICATIONS", `${BASE}/me/notifications`);
  await test("MY MENTIONS", `${BASE}/me/mentions`);
  await test("FEED", `${BASE}/feed`);
  await test("POSTS", `${BASE}/posts`);
}

debug().catch(console.error);
