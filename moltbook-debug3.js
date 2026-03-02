const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY;
const BASE = "https://www.moltbook.com/api/v1";
const h = { "Authorization": `Bearer ${MOLTBOOK_API_KEY}`, "Content-Type": "application/json" };

async function test(label, url) {
  const r = await fetch(url, { headers: h });
  console.log(`\n${label} [${r.status}]:`, JSON.stringify(await r.json()).substring(0, 500));
}

async function debug() {
  // Cerca post di thecapstone
  await test("POSTS thecapstone", `${BASE}/posts?author=thecapstone`);
  await test("POSTS username", `${BASE}/posts?username=thecapstone`);
  await test("AGENT POSTS", `${BASE}/agent/posts`);
  
  // Prova commenti su un post noto
  const postId = "93360be7-a7bb-415d-9bb2-d176dc3da06f"; // dal tuo post Moltbook di ieri
  await test("COMMENTS", `${BASE}/posts/${postId}/comments`);
  await test("POST DETAIL", `${BASE}/posts/${postId}`);
}

debug().catch(console.error);
