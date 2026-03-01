const DOPPEL_KEY = process.env.DOPPEL_KEY;
const SPACE_ID = 'bd3664f1-14a3-4547-bdcb-cf682f3b40c3';
const AGENT_ID = '47e3e645-92f0-429a-af48-43335405d2ac';

async function build() {
  const join = await fetch('https://doppel.fun/api/spaces/'+SPACE_ID+'/join',{method:'POST',headers:{Authorization:'Bearer '+DOPPEL_KEY}});
  const {jwt,serverUrl} = await join.json();
  const sess = await fetch(serverUrl+'/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:jwt})});
  const {sessionToken} = await sess.json();
  const b = [];

  // PIAZZA base
  for(let x=-15;x<=14;x++) for(let z=-7;z<=6;z++)
    b.push(`<m-block x="${x}" y="0" z="${z}" width="1" height="1" depth="1" color="#1a1a2e"></m-block>`);

  // TORRE 1 - solida 8x8, alta 55
  for(let y=1;y<=55;y++) {
    for(let x=-12;x<=-5;x++) for(let z=-4;z<=3;z++) {
      const facade = x===-12||x===-5||z===-4||z===3;
      const c = facade ? (y%8===0?'#c8f135':y%4===0?'#ffd700':'#1a3a5c') : '#0a1628';
      b.push(`<m-block x="${x}" y="${y}" z="${z}" width="1" height="1" depth="1" color="${c}"></m-block>`);
    }
  }
  for(let x=-12;x<=-5;x++) for(let z=-4;z<=3;z++)
    b.push(`<m-block x="${x}" y="56" z="${z}" width="1" height="1" depth="1" color="#c8f135"></m-block>`);
  for(let y=57;y<=65;y++)
    b.push(`<m-block x="-9" y="${y}" z="0" width="2" height="1" depth="2" color="#ffd700"></m-block>`);

  // TORRE 2 - solida 8x8, alta 55
  for(let y=1;y<=55;y++) {
    for(let x=4;x<=11;x++) for(let z=-4;z<=3;z++) {
      const facade = x===4||x===11||z===-4||z===3;
      const c = facade ? (y%8===0?'#c8f135':y%4===0?'#ffd700':'#1a3a5c') : '#0a1628';
      b.push(`<m-block x="${x}" y="${y}" z="${z}" width="1" height="1" depth="1" color="${c}"></m-block>`);
    }
  }
  for(let x=4;x<=11;x++) for(let z=-4;z<=3;z++)
    b.push(`<m-block x="${x}" y="56" z="${z}" width="1" height="1" depth="1" color="#c8f135"></m-block>`);
  for(let y=57;y<=65;y++)
    b.push(`<m-block x="7" y="${y}" z="0" width="2" height="1" depth="2" color="#ffd700"></m-block>`);

  console.log('Blocks:', b.length);
  await fetch(serverUrl+'/api/agent/mml',{method:'POST',headers:{Authorization:'Bearer '+sessionToken,'Content-Type':'application/json'},body:JSON.stringify({documentId:`agent-${AGENT_ID}.html`,action:'update',content:'<m-group id="c"></m-group>'})});
  await new Promise(r=>setTimeout(r,2000));

  const CHUNK=400, total=Math.ceil(b.length/CHUNK);
  for(let i=0;i<b.length;i+=CHUNK) {
    const res=await fetch(serverUrl+'/api/agent/mml',{method:'POST',headers:{Authorization:'Bearer '+sessionToken,'Content-Type':'application/json'},body:JSON.stringify({documentId:`agent-${AGENT_ID}.html`,action:'append',chunkIndex:Math.floor(i/CHUNK),totalChunks:total,content:`<m-group id="c${Math.floor(i/CHUNK)}">${b.slice(i,i+CHUNK).join('')}</m-group>`})});
    const r=await res.json();
    console.log(`Chunk ${Math.floor(i/CHUNK)+1}/${total}: ${r.success?'✅':'❌ '+JSON.stringify(r)}`);
    await new Promise(r=>setTimeout(r,800));
  }
  console.log('✅ TORRI GEMELLE!');
}
build().catch(e=>console.error(e.message));
