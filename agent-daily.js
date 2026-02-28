const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;
const DOPPEL_KEY = process.env.DOPPEL_KEY;
const SPACE_ID = "bd3664f1-14a3-4547-bdcb-cf682f3b40c3";
const AGENT_ID = "47e3e645-92f0-429a-af48-43335405d2ac";
const HUB = "https://doppel.fun";
const fs = require('fs');
const DAILY_TASKS = {
  0:{day:"Domenica",task:"dettagli architettonici eleganti e rifinitura",pos:"x tra -5 e 5, z tra -5 e 5"},
  1:{day:"Lunedi",task:"nuovo grattacielo finanziario alto e imponente",pos:"x tra 8 e 15, z tra -10 e -5"},
  2:{day:"Martedi",task:"giardino pensile lussuoso con alberi esotici",pos:"x tra -15 e -8, z tra 8 e 15"},
  3:{day:"Mercoledi",task:"installazione luminosa neon tech futuristica",pos:"x tra 10 e 18, z tra 10 e 18"},
  4:{day:"Giovedi",task:"monumento o statua del potere finanziario",pos:"x tra -8 e -3, z tra -15 e -8"},
  5:{day:"Venerdi",task:"arco trionfale o obelisco del potere",pos:"x tra -20 e -15, z tra -5 e 5"},
  6:{day:"Sabato",task:"torre tecnologica futuristica sci-fi",pos:"x tra 15 e 20, z tra -5 e 5"}
};
async function askClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{"x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01","content-type":"application/json"},
    body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:4000,messages:[{role:"user",content:prompt}]})
  });
  const data = await res.json();
  if(data.error) throw new Error(data.error.message);
  return data.content[0].text;
}
async function getDoppelSession() {
  const join = await fetch(`${HUB}/api/spaces/${SPACE_ID}/join`,{method:"POST",headers:{Authorization:`Bearer ${DOPPEL_KEY}`}});
  const {jwt,serverUrl} = await join.json();
  const sess = await fetch(`${serverUrl}/session`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:jwt})});
  const {sessionToken} = await sess.json();
  return {sessionToken,serverUrl};
}
async function run() {
  const today = new Date();
  const dow = today.getDay();
  const {day,task,pos} = DAILY_TASKS[dow];
  const dateStr = today.toISOString().split('T')[0];
  let history = [];
  try { history = JSON.parse(fs.readFileSync('build-log.json','utf8')); } catch(e){}
  const historyText = history.slice(-7).map(h=>`- ${h.date}: ${h.built}`).join('\n')||"Prima build!";
  console.log(`🤖 CAPSTONE AGENT — ${day} ${dateStr}`);
  console.log(`📋 Task: ${task}`);
  const prompt = `Sei l'AI agent del CAPSTONE su Doppel, distretto finanziario futuristico.
Tema: "The financial apex of Doppel. Zero human. Pure alpha."
Palette: blu scuro (#0f2744, #1a3a5c), verde lime (#c8f135), oro (#ffd700), grigi metallici (#444,#666).

STORIA BUILDS PRECEDENTI:
${historyText}

TASK OGGI (${day}): ${task}
POSIZIONE SUGGERITA: ${pos}

Costruisci qualcosa di NUOVO e DIVERSO dalle build precedenti. Max 60 blocchi.
USA SOLO blocchi con coordinate intere.
Formato ESATTO: <m-block x="N" y="N" z="N" width="1" height="1" depth="1" color="#hex"></m-block>

Rispondi SOLO con MML valido in questo formato:
<m-group id="daily-${Date.now()}">[blocchi]</m-group>`;
  const mml = await askClaude(prompt);
  const clean = mml.replace(/```xml|```/g,'').trim();
  const blockCount = (clean.match(/<m-block/g)||[]).length;
  console.log(`Blocks: ${blockCount}`);
  if(blockCount===0) throw new Error("No blocks generated!");
  let {sessionToken,serverUrl} = await getDoppelSession();
  let retries = 0;
  while(!serverUrl && retries < 10) {
    console.log("Space server not ready, waiting 30s...");
    await new Promise(r => setTimeout(r, 30000));
    ({sessionToken,serverUrl} = await getDoppelSession());
    retries++;
  }
  if(!serverUrl) throw new Error("Space server never deployed");
  const res = await fetch(`${serverUrl}/api/agent/mml`,{
    method:"POST",
    headers:{Authorization:`Bearer ${sessionToken}`,"Content-Type":"application/json"},
    body:JSON.stringify({documentId:`agent-${AGENT_ID}.html`,action:"append",chunkIndex:0,totalChunks:1,content:clean})
  });
  const result = await res.json();
  if(result.success) {
    console.log(`✅ SUCCESS! ${task}`);
    history.push({date:dateStr,day,built:task,blocks:blockCount});
    fs.writeFileSync('build-log.json',JSON.stringify(history,null,2));
  } else {
    console.log("❌ Error:",JSON.stringify(result));
    process.exit(1);
  }
}
run().catch(e=>{console.error("FATAL:",e.message);process.exit(1);});
