// CAPSTONE AI — ONCHAIN INTELLIGENCE MODULE
// Dev wallet movements + Top holders analysis via Basescan

const BASESCAN_API = process.env.BASESCAN_API_KEY;
const BASESCAN_URL = 'https://api.basescan.org/api';

// ─── DEV WALLET ANALYSIS ─────────────────────────────────────────────────────
export async function analyzeDevWallet(tokenAddress) {
  try {
    // 1. Trova il deployer del contratto
    const deployRes = await fetch(
      `${BASESCAN_URL}?module=contract&action=getcontractcreation&contractaddresses=${tokenAddress}&apikey=${BASESCAN_API}`,
      { signal: AbortSignal.timeout(10000) }
    );
    const deployData = await deployRes.json();
    const devAddress = deployData?.result?.[0]?.contractCreator;
    if (!devAddress) return { clean: true, dumpPct: 0, note: 'deployer not found' };

    // 2. Prendi le transazioni del dev wallet
    const txRes = await fetch(
      `${BASESCAN_URL}?module=account&action=tokentx&address=${devAddress}&contractaddress=${tokenAddress}&sort=asc&apikey=${BASESCAN_API}`,
      { signal: AbortSignal.timeout(10000) }
    );
    const txData = await txRes.json();
    const txs = txData?.result || [];

    if (txs.length === 0) return { clean: true, dumpPct: 0, devAddress, note: 'no token transfers' };

    // 3. Calcola buy/sell del dev
    let totalReceived = 0n;
    let totalSent = 0n;

    for (const tx of txs) {
      const value = BigInt(tx.value || 0);
      if (tx.to?.toLowerCase() === devAddress.toLowerCase()) totalReceived += value;
      if (tx.from?.toLowerCase() === devAddress.toLowerCase()) totalSent += value;
    }

    const dumpPct = totalReceived > 0n
      ? Number((totalSent * 100n) / totalReceived)
      : 0;

    const lastTx = txs[txs.length - 1];
    const lastActivity = lastTx
      ? new Date(parseInt(lastTx.timeStamp) * 1000).toLocaleDateString()
      : 'unknown';

    return {
      devAddress,
      clean: dumpPct < 10,
      dumpPct: Math.min(dumpPct, 100),
      totalTxs: txs.length,
      lastActivity,
      note: dumpPct === 0 ? 'zero sells since launch' : `sold ${dumpPct}% of holdings`
    };

  } catch (e) {
    console.error('DevWallet error:', e.message);
    return { clean: true, dumpPct: 0, note: 'analysis failed' };
  }
}

// ─── TOP HOLDERS ANALYSIS ─────────────────────────────────────────────────────
export async function analyzeHolders(tokenAddress) {
  try {
    const res = await fetch(
      `${BASESCAN_URL}?module=token&action=tokenholderlist&contractaddress=${tokenAddress}&page=1&offset=10&apikey=${BASESCAN_API}`,
      { signal: AbortSignal.timeout(10000) }
    );
    const data = await res.json();
    const holders = data?.result || [];

    if (holders.length === 0) return { top10Pct: 50, holders: [], note: 'no holder data' };

    // Prendi supply totale
    const supplyRes = await fetch(
      `${BASESCAN_URL}?module=stats&action=tokensupply&contractaddress=${tokenAddress}&apikey=${BASESCAN_API}`,
      { signal: AbortSignal.timeout(10000) }
    );
    const supplyData = await supplyRes.json();
    const totalSupply = BigInt(supplyData?.result || 0);

    if (totalSupply === 0n) return { top10Pct: 50, holders: [], note: 'supply not found' };

    // Calcola % top 10
    let top10Total = 0n;
    const holderList = [];

    for (const h of holders.slice(0, 10)) {
      const bal = BigInt(h.TokenHolderQuantity || 0);
      top10Total += bal;
      const pct = Number((bal * 10000n) / totalSupply) / 100;
      holderList.push({
        address: h.TokenHolderAddress,
        pct: pct.toFixed(2)
      });
    }

    const top10Pct = Number((top10Total * 10000n) / totalSupply) / 100;

    return {
      top10Pct: parseFloat(top10Pct.toFixed(2)),
      holders: holderList,
      note: top10Pct < 30 ? 'well distributed' : top10Pct < 50 ? 'moderate concentration' : 'high concentration'
    };

  } catch (e) {
    console.error('Holders error:', e.message);
    return { top10Pct: 50, holders: [], note: 'analysis failed' };
  }
}

// ─── GITHUB ACTIVITY ──────────────────────────────────────────────────────────
export async function analyzeGithub(githubUrl) {
  try {
    if (!githubUrl) return { hasGithub: false, commitsLast30d: 0, contributors: 0 };

    // Estrai owner/repo dall'URL
    const match = githubUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return { hasGithub: false, commitsLast30d: 0, contributors: 0 };

    const [, owner, repo] = match;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Commits ultimi 30 giorni
    const commitsRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?since=${since}&per_page=100`,
      {
        headers: { 'User-Agent': 'CapstoneAI' },
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!commitsRes.ok) return { hasGithub: true, commitsLast30d: 0, contributors: 0, note: 'repo private or not found' };

    const commits = await commitsRes.json();
    const commitsLast30d = Array.isArray(commits) ? commits.length : 0;

    // Contributors
    const contribRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=10`,
      {
        headers: { 'User-Agent': 'CapstoneAI' },
        signal: AbortSignal.timeout(10000)
      }
    );
    const contributors = contribRes.ok ? (await contribRes.json()).length : 0;

    return {
      hasGithub: true,
      commitsLast30d,
      contributors,
      repoUrl: `https://github.com/${owner}/${repo}`,
      note: commitsLast30d >= 10 ? 'active development' : commitsLast30d >= 3 ? 'moderate activity' : 'low activity'
    };

  } catch (e) {
    console.error('GitHub error:', e.message);
    return { hasGithub: false, commitsLast30d: 0, contributors: 0 };
  }
}
