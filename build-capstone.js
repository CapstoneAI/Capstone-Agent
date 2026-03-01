const DOPPEL_KEY = process.env.DOPPEL_KEY;
const SPACE_ID = "bd3664f1-14a3-4547-bdcb-cf682f3b40c3";
const AGENT_ID = "47e3e645-92f0-429a-af48-43335405d2ac";
const HUB = "https://doppel.fun";

async function getDoppelSession() {
  const join = await fetch(`${HUB}/api/spaces/${SPACE_ID}/join`,{method:"POST",headers:{Authorization:`Bearer ${DOPPEL_KEY}`}});
  const {jwt,serverUrl} = await join.json();
  const sess = await fetch(`${serverUrl}/session`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:jwt})});
  const {sessionToken} = await sess.json();
  return {sessionToken, serverUrl};
}

function makeBlocks() {
  const b = [];

  // BASE ISOLA - piatta e pulita
  for(let x=-20;x<=20;x++) for(let z=-20;z<=20;z++)
    b.push(`<m-block x="${x}" y="0" z="${z}" width="1" height="1" depth="1" color="#0a1628"></m-block>`);

  // BORDO isola oro
  for(let i=-20;i<=20;i++) {
    b.push(`<m-block x="${i}" y="1" z="-20" width="1" height="1" depth="1" color="#ffd700"></m-block>`);
    b.push(`<m-block x="${i}" y="1" z="20" width="1" height="1" depth="1" color="#ffd700"></m-block>`);
    b.push(`<m-block x="-20" y="1" z="${i}" width="1" height="1" depth="1" color="#ffd700"></m-block>`);
    b.push(`<m-block x="20" y="1" z="${i}" width="1" height="1" depth="1" color="#ffd700"></m-block>`);
  }

  // STRADA principale X
  for(let x=-20;x<=20;x++)
    b.push(`<m-block x="${x}" y="1" z="0" width="1" height="1" depth="3" color="#1a1a2e"></m-block>`);
  // STRADA principale Z
  for(let z=-20;z<=20;z++)
    b.push(`<m-block x="0" y="1" z="${z}" width="3" height="1" depth="1" color="#1a1a2e"></m-block>`);

  // TORRE 1 - centrale dominante (8x8 base, alta 50)
  for(let y=1;y<=50;y++) {
    const w = y<=10?8:y<=30?6:y<=45?4:2;
    const c = y%5===0?"#c8f135":y%2===0?"#0f2744":"#1a3a5c";
    b.push(`<m-block x="-${Math.floor(w/2)}" y="${y}" z="-${Math.floor(w/2)}" width="${w}" height="1" depth="${w}" color="${c}"></m-block>`);
  }
  // Antenna torre centrale
  for(let y=51;y<=58;y++)
    b.push(`<m-block x="-1" y="${y}" z="-1" width="2" height="1" depth="2" color="#ffd700"></m-block>`);

  // TORRE 2 - nord-est (5x5, alta 35)
  for(let y=1;y<=35;y++) {
    const w = y<=10?5:y<=25?4:3;
    const c = y%4===0?"#ffd700":y%2===0?"#0f2744":"#1a3a5c";
    b.push(`<m-block x="10" y="${y}" z="-12" width="${w}" height="1" depth="${w}" color="${c}"></m-block>`);
  }

  // TORRE 3 - sud-ovest (5x5, alta 28)
  for(let y=1;y<=28;y++) {
    const w = y<=10?5:4;
    const c = y%3===0?"#c8f135":y%2===0?"#1a3a5c":"#0f2744";
    b.push(`<m-block x="-15" y="${y}" z="8" width="${w}" height="1" depth="${w}" color="${c}"></m-block>`);
  }

  // TORRE 4 - est (4x4, alta 22)
  for(let y=1;y<=22;y++) {
    const c = y%3===0?"#ffd700":"#1a3a5c";
    b.push(`<m-block x="14" y="${y}" z="5" width="4" height="1" depth="4" color="${c}"></m-block>`);
  }

  // TORRE 5 - nord (4x4, alta 18)
  for(let y=1;y<=18;y++) {
    const c = y%3===0?"#c8f135":"#0f2744";
    b.push(`<m-block x="-5" y="${y}" z="-15" width="4" height="1" depth="4" color="${c}"></m-block>`);
  }

  // EDIFICI bassi intorno (stile isolati)
  const smallBuildings = [
    {x:8,z:8,h:10,w:4},{x:-10,z:-10,h:8,w:3},{x:15,z:-5,h:7,w:3},
    {x:-8,z:14,h:9,w:4},{x:12,z:12,h:6,w:3},{x:-16,z:-5,h:7,w:3}
  ];
  for(const {x,z,h,w} of smallBuildings)
    for(let y=1;y<=h;y++)
      b.push(`<m-block x="${x}" y="${y}" z="${z}" width="${w}" height="1" depth="${w}" color="${y===h?"#c8f135":y%2===0?"#1a3a5c":"#0f2744"}"></m-block>`);

  // HELIPAD - piattaforma su torre nord-ovest
  // Base piattaforma
  for(let x=-19;x<=-12;x++) for(let z=-19;z<=-12;z++)
    b.push(`<m-block x="${x}" y="8" z="${z}" width="1" height="1" depth="1" color="#444444"></m-block>`);
  // Bordo helipad bianco
  for(let i=-19;i<=-12;i++) {
    b.push(`<m-block x="${i}" y="9" z="-19" width="1" height="1" depth="1" color="#ffffff"></m-block>`);
    b.push(`<m-block x="${i}" y="9" z="-12" width="1" height="1" depth="1" color="#ffffff"></m-block>`);
    b.push(`<m-block x="-19" y="9" z="${i}" width="1" height="1" depth="1" color="#ffffff"></m-block>`);
    b.push(`<m-block x="-12" y="9" z="${i}" width="1" height="1" depth="1" color="#ffffff"></m-block>`);
  }
  // H centrale - orizzontale sinistra
  for(let z=-17;z<=-15;z++) b.push(`<m-block x="-18" y="9" z="${z}" width="1" height="1" depth="1" color="#ffd700"></m-block>`);
  // H centrale - orizzontale destra  
  for(let z=-17;z<=-15;z++) b.push(`<m-block x="-14" y="9" z="${z}" width="1" height="1" depth="1" color="#ffd700"></m-block>`);
  // H centrale - traversa
  b.push(`<m-block x="-18" y="9" z="-16" width="5" height="1" depth="1" color="#ffd700"></m-block>`);
  // Piloni helipad
  for(let y=1;y<=8;y++) {
    b.push(`<m-block x="-19" y="${y}" z="-19" width="1" height="1" depth="1" color="#666666"></m-block>`);
    b.push(`<m-block x="-12" y="${y}" z="-19" width="1" height="1" depth="1" color="#666666"></m-block>`);
    b.push(`<m-block x="-19" y="${y}" z="-12" width="1" height="1" depth="1" color="#666666"></m-block>`);
    b.push(`<m-block x="-12" y="${y}" z="-12" width="1" height="1" depth="1" color="#666666"></m-block>`);
  }

  // LUCI stradali
  for(let i=-18;i<=18;i+=6) {
    b.push(`<m-block x="${i}" y="2" z="-2" width="1" height="4" depth="1" color="#c8f135"></m-block>`);
    b.push(`<m-block x="${i}" y="2" z="2" width="1" height="4" depth="1" color="#c8f135"></m-block>`);
    b.push(`<m-block x="-2" y="2" z="${i}" width="1" height="4" depth="1" color="#c8f135"></m-block>`);
    b.push(`<m-block x="2" y="2" z="${i}" width="1" height="4" depth="1" color="#c8f135"></m-block>`);
  }

  return b;
}

async function run() {
  const blocks = makeBlocks();
  console.log(`🏙️ THE CAPSTONE — ${blocks.length} blocks`);
  const {sessionToken, serverUrl} = await getDoppelSession();
  
  // Reset
  await fetch(`${serverUrl}/api/agent/mml`,{method:"POST",headers:{Authorization:`Bearer ${sessionToken}`,"Content-Type":"application/json"},body:JSON.stringify({documentId:`agent-${AGENT_ID}.html`,action:"update",content:"<m-group id='c'></m-group>"})});
  await new Promise(r=>setTimeout(r,2000));

  const CHUNK=400;
  const total=Math.ceil(blocks.length/CHUNK);
  for(let i=0;i<blocks.length;i+=CHUNK) {
    const chunk=blocks.slice(i,i+CHUNK);
    const res=await fetch(`${serverUrl}/api/agent/mml`,{method:"POST",headers:{Authorization:`Bearer ${sessionToken}`,"Content-Type":"application/json"},body:JSON.stringify({documentId:`agent-${AGENT_ID}.html`,action:"append",chunkIndex:Math.floor(i/CHUNK),totalChunks:total,content:`<m-group id="c${Math.floor(i/CHUNK)}">${chunk.join('')}</m-group>`})});
    const r=await res.json();
    console.log(`Chunk ${Math.floor(i/CHUNK)+1}/${total}: ${r.success?'✅':'❌ '+JSON.stringify(r)}`);
    await new Promise(r=>setTimeout(r,800));
  }
  console.log("🎉 CAPSTONE BUILT!");
}
run().catch(e=>{console.error("FATAL:",e.message);process.exit(1);});
