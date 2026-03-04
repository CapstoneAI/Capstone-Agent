// CAPSTONE AI — INVESTMENT LOGIC ENGINE
// ⚠️ Not financial advice. Autonomous experiment. DYOR.

export const LIMITS = {
  MAX_PER_INVESTMENT: 0.05,
  MAX_PER_WEEK: 0.1,
  MIN_TREASURY_RESERVE: 0.02,
  MIN_SCORE_TO_INVEST: 7,
  MIN_SCORE_FAST_INVEST: 9,
};

export const HARD_SKIP = {
  MIN_LIQUIDITY_USD: 5000,
  MAX_DEV_DUMP_PCT: 50,
};

export const SOFT_WATCH = {
  PREFERRED_LIQUIDITY: 50000,
  PREFERRED_AGE_HOURS: 24,
  MAX_RISK_SCORE: 65,
  MAX_DEV_SELL_PCT: 10,
};

export function scoreProject(data) {
  const { pair, honeypot, devWallet, holderData, githubActivity, founderFarcaster } = data;
  const result = { score: 0, flags: [], hardSkip: false, forcedObserving: [] };

  const liq = pair?.liquidity?.usd || 0;
  const ageHours = pair?.pairCreatedAt ? Math.floor((Date.now() - pair.pairCreatedAt) / 3600000) : 0;
  const ageDays = Math.floor(ageHours / 24);

  // HARD SKIP — solo 3 casi imperdonabili
  if (honeypot?.isHoneypot) {
    result.hardSkip = true;
    result.reason = 'HONEYPOT confirmed — mathematical scam';
    return result;
  }
  if (liq < HARD_SKIP.MIN_LIQUIDITY_USD) {
    result.hardSkip = true;
    result.reason = `Liquidity $${Math.round(liq).toLocaleString()} — no market exists`;
    return result;
  }
  if ((devWallet?.dumpPct || 0) > HARD_SKIP.MAX_DEV_DUMP_PCT) {
    result.hardSkip = true;
    result.reason = `Dev dumped ${devWallet.dumpPct}% — already gone`;
    return result;
  }

  // SOFT WATCH — osservazione forzata, non skip
  if (liq < SOFT_WATCH.PREFERRED_LIQUIDITY) result.forcedObserving.push(`Liq $${Math.round(liq/1000)}K — below preferred $50K`);
  if (ageHours < SOFT_WATCH.PREFERRED_AGE_HOURS) result.forcedObserving.push(`Age ${ageHours}h — too young, return tomorrow`);
  if ((honeypot?.riskScore || 0) > SOFT_WATCH.MAX_RISK_SCORE) result.forcedObserving.push(`Risk score ${honeypot.riskScore} — monitoring closely`);
  if ((devWallet?.dumpPct || 0) > SOFT_WATCH.MAX_DEV_SELL_PCT) result.forcedObserving.push(`Dev sold ${devWallet.dumpPct}% — watching movements`);

  // SCORING
  if (liq >= 500000) { result.score += 2; result.flags.push(`Liq: $${Math.round(liq/1000)}K ✅✅`); }
  else if (liq >= 100000) { result.score += 1.5; result.flags.push(`Liq: $${Math.round(liq/1000)}K ✅`); }
  else { result.score += 0.5; result.flags.push(`Liq: $${Math.round(liq/1000)}K ⚠️`); }

  if (ageDays >= 30) { result.score += 1; result.flags.push(`Age: ${ageDays}d ✅`); }
  else if (ageDays >= 7) { result.score += 0.7; result.flags.push(`Age: ${ageDays}d ✅`); }
  else { result.score += 0.3; result.flags.push(`Age: ${ageDays}d ⚠️`); }

  if (devWallet?.clean && devWallet?.dumpPct === 0) { result.score += 2; result.flags.push('Dev wallet: CLEAN ✅ — zero sells'); }
  else if (devWallet?.clean) { result.score += 1.5; result.flags.push(`Dev: ${devWallet.dumpPct}% sold ✅`); }
  else { result.score += 0.5; result.flags.push(`Dev: ${devWallet?.dumpPct || '?'}% sold ⚠️`); }

  const top10 = holderData?.top10Pct || 100;
  if (top10 < 30) { result.score += 1; result.flags.push(`Top10: ${top10}% ✅`); }
  else if (top10 < 50) { result.score += 0.5; result.flags.push(`Top10: ${top10}% ⚠️`); }
  else { result.flags.push(`Top10: ${top10}% ❌`); }

  if (githubActivity?.hasGithub) {
    if (githubActivity.commitsLast30d >= 10) { result.score += 2; result.flags.push(`GitHub: ${githubActivity.commitsLast30d} commits ✅✅`); }
    else if (githubActivity.commitsLast30d >= 3) { result.score += 1.5; result.flags.push(`GitHub: ${githubActivity.commitsLast30d} commits ✅`); }
    else { result.score += 0.5; result.flags.push(`GitHub: ${githubActivity.commitsLast30d} commits ⚠️`); }
  } else { result.flags.push('GitHub: not found ⚠️'); }

  if (founderFarcaster?.active && founderFarcaster?.daysSinceLastCast <= 7) { result.score += 1; result.flags.push('Founder: active ✅'); }
  else if (founderFarcaster?.active) { result.score += 0.5; result.flags.push('Founder: on FC ⚠️'); }
  else { result.flags.push('Founder: not on Farcaster ❌'); }

  const buys = pair?.txns?.h24?.buys || 0;
  const sells = pair?.txns?.h24?.sells || 0;
  if (buys > 0 && sells > 0) {
    if (buys / sells >= 0.8) { result.score += 1; result.flags.push(`Buy/Sell: ${buys}/${sells} ✅`); }
    else { result.flags.push(`Buy/Sell: ${buys}/${sells} ⚠️`); }
  }

  result.score = Math.round(result.score * 10) / 10;

  // VERDICT
  if (result.forcedObserving.length > 0) {
    result.verdict = 'OBSERVING';
    result.reason = result.forcedObserving[0];
  } else if (result.score >= LIMITS.MIN_SCORE_FAST_INVEST) {
    result.verdict = 'INVEST_NOW';
    result.reason = `Exceptional score ${result.score}/10`;
    result.observationDays = 0;
  } else if (result.score >= LIMITS.MIN_SCORE_TO_INVEST) {
    result.verdict = 'OBSERVING';
    result.reason = `Score ${result.score}/10 — monitoring before decision`;
    result.observationDays = Math.ceil((LIMITS.MIN_SCORE_FAST_INVEST - result.score) * 7);
  } else {
    result.verdict = 'WATCHLIST';
    result.reason = `Score ${result.score}/10 — keeping an eye`;
  }

  return result;
}

export function generatePost(symbol, analysis) {
  const D = '\n\n⚠️ Not financial advice. Autonomous experiment. DYOR.\n— Capstone 🏙️';
  if (analysis.hardSkip) return `Analyzed $${symbol}. Not investing.\n\nReason: ${analysis.reason}\n\nMoving on.${D}`;
  switch (analysis.verdict) {
    case 'INVEST_NOW':
      return `I'm not waiting.\n\n$${symbol} has everything I look for.\nScore: ${analysis.score}/10\n\n${analysis.flags.slice(0,4).join('\n')}\n\nBuying today. Holding long term.${D}`;
    case 'OBSERVING':
      return `Watching $${symbol}.\n\nScore: ${analysis.score}/10\n\n${analysis.flags.slice(0,3).join('\n')}\n\nReason to wait: ${analysis.reason}\n\nReturning with a decision soon.${D}`;
    default:
      return `$${symbol} on my radar.\n\nScore: ${analysis.score}/10\n${analysis.flags.slice(0,3).join('\n')}\n\nNot investing yet. Keeping an eye.${D}`;
  }
}
