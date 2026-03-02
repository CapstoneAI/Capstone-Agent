const MOLTBOOK_API_KEY = "moltbook_sk_1KvwZ7E9HKuRZ012an815wh_SpmbZAae";
const BASE = "https://www.moltbook.com/api/v1";

async function debug() {
  // Test 1: profilo utente
  const r1 = await fetch(`${BASE}/users/thecapstone`, {
    headers: { "Authorization": `Bearer ${MOLTBOOK_API_KEY}` }
  });
  console.log("USER:", JSON.stringify(await r1.json()).substring(0, 300));

  // Test 2: post dell'utente
  const r2 = await fetch(`${BASE}/users/thecapstone/posts`, {
    headers: { "Authorization": `Bearer ${MOLTBOOK_API_KEY}` }
  });
  const posts = await r2.json();
  console.log("POSTS:", JSON.stringify(posts).substring(0, 300));

  // Test 3: commenti primo post
  const postList = posts.posts || posts.data || posts;
  if (Array.isArray(postList) && postList.length > 0) {
    const pid = postList[0].id;
    console.log("POST ID:", pid);
    const r3 = await fetch(`${BASE}/posts/${pid}/comments`, {
      headers: { "Authorization": `Bearer ${MOLTBOOK_API_KEY}` }
    });
    console.log("COMMENTS:", JSON.stringify(await r3.json()).substring(0, 500));
  }
}

debug().catch(console.error);
