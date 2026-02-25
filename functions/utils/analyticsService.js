import { readDb } from "../firestore.js";

// ============ WEBSITE ANALYTICS & INSIGHTS ENGINE ============
// Generates comprehensive analytics insights from audit, uptime, keyword, and backlink data

export async function getWebsiteAnalytics(siteId) {
  const db = await readDb();
  const site = db.websites.find((w) => String(w.id) === String(siteId));
  if (!site) throw new Error("Site not found");

  const reports = (db.reports || [])
    .filter((r) => String(r.websiteId) === String(siteId))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const uptimeRecords = (db.uptime || [])
    .filter((u) => String(u.siteId) === String(siteId))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const keywordRanks = (db.keywordRanks || [])
    .filter((k) => String(k.siteId) === String(siteId))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const backlinks = (db.backlinks || []).filter(
    (b) => String(b.siteId) === String(siteId),
  );

  const latestReport = reports[0];
  const previousReport = reports[1];
  const hostname = new URL(site.url).hostname;

  // ─── Traffic & Visitor Estimation ───
  const trafficEstimate = estimateTraffic(site, keywordRanks, backlinks);

  // ─── Bounce Rate Analysis ───
  const bounceAnalysis = analyzeBounceFactors(latestReport, site);

  // ─── User Experience Score ───
  const uxScore = calculateUXScore(latestReport, uptimeRecords);

  // ─── Exit Page / Drop-off Analysis ───
  const exitAnalysis = analyzeExitFactors(latestReport);

  // ─── Score Trends ───
  const scoreTrends = calculateScoreTrends(reports);

  // ─── Uptime Stats ───
  const uptimeStats = calculateUptimeStats(uptimeRecords);

  // ─── Keyword Performance ───
  const keywordPerformance = analyzeKeywordPerformance(site, keywordRanks);

  // ─── Backlink Health ───
  const backlinkHealth = analyzeBacklinkHealth(backlinks);

  // ─── Improvement Suggestions ───
  const improvements = generateImprovements(
    latestReport,
    bounceAnalysis,
    exitAnalysis,
    uxScore,
    uptimeStats,
    keywordPerformance,
    backlinkHealth,
    trafficEstimate,
  );

  return {
    site: {
      url: site.url,
      hostname,
      lastRun: site.lastRun,
      lastScores: site.lastScores,
    },
    trafficEstimate,
    bounceAnalysis,
    uxScore,
    exitAnalysis,
    scoreTrends,
    uptimeStats,
    keywordPerformance,
    backlinkHealth,
    improvements,
    totalReports: reports.length,
    generated: new Date().toISOString(),
  };
}

// ─── Traffic Estimation based on keyword rankings ───
function estimateTraffic(site, keywordRanks, backlinks) {
  // CTR by position (approximate Google CTR curve)
  const ctrByPosition = {
    1: 0.28,
    2: 0.15,
    3: 0.11,
    4: 0.08,
    5: 0.065,
    6: 0.05,
    7: 0.04,
    8: 0.035,
    9: 0.03,
    10: 0.025,
  };

  const keywords = site.keywords || [];
  let estimatedMonthlyVisits = 0;
  let rankedKeywords = 0;
  let top3Keywords = 0;
  let top10Keywords = 0;

  // Get latest rank per keyword
  const latestRanks = {};
  for (const kr of keywordRanks) {
    if (
      !latestRanks[kr.keyword] ||
      kr.timestamp > latestRanks[kr.keyword].timestamp
    ) {
      latestRanks[kr.keyword] = kr;
    }
  }

  for (const kw of keywords) {
    const rank = latestRanks[kw];
    if (rank && rank.position > 0) {
      rankedKeywords++;
      if (rank.position <= 3) top3Keywords++;
      if (rank.position <= 10) top10Keywords++;

      // Estimate search volume (conservative: 100-500 per keyword)
      const estimatedVolume = 200;
      const ctr = ctrByPosition[Math.min(rank.position, 10)] || 0.01;
      estimatedMonthlyVisits += Math.round(estimatedVolume * ctr * 30);
    }
  }

  // Backlink traffic bonus
  const activeBacklinks = backlinks.filter((b) => b.active).length;
  const backlinkTraffic = activeBacklinks * 5; // ~5 visits per backlink/month

  const totalEstimate = estimatedMonthlyVisits + backlinkTraffic;

  // Traffic quality score
  let qualityScore = 0;
  if (top3Keywords > 0) qualityScore += 40;
  if (top10Keywords >= 3) qualityScore += 20;
  if (activeBacklinks >= 5) qualityScore += 20;
  if (rankedKeywords >= keywords.length * 0.5) qualityScore += 20;

  return {
    estimatedMonthlyVisits: totalEstimate,
    estimatedDailyVisits: Math.round(totalEstimate / 30),
    rankedKeywords,
    totalKeywords: keywords.length,
    top3Keywords,
    top10Keywords,
    activeBacklinks,
    backlinkTraffic,
    qualityScore: Math.min(qualityScore, 100),
    trafficLevel:
      totalEstimate > 5000
        ? "high"
        : totalEstimate > 1000
          ? "medium"
          : totalEstimate > 100
            ? "low"
            : "minimal",
  };
}

// ─── Bounce Rate Analysis ───
function analyzeBounceFactors(report, site) {
  if (!report || !report.audits) {
    return { estimatedBounceRate: null, factors: [], riskLevel: "unknown" };
  }

  const audits = report.audits;
  let bounceScore = 30; // Base bounce rate 30%
  const factors = [];

  // Slow load → higher bounce
  if (audits.compression && !audits.compression.compressed) {
    bounceScore += 12;
    factors.push({
      factor: "No Compression",
      impact: "+12%",
      icon: "🐌",
      description:
        "Uncompressed pages load slowly, users leave before content appears",
    });
  }

  // No meta description → unclear purpose
  if (audits.metaTags && !audits.metaTags.hasDescription) {
    bounceScore += 8;
    factors.push({
      factor: "Missing Meta Description",
      impact: "+8%",
      icon: "📝",
      description:
        "Users can't tell what your page is about from search results",
    });
  }

  // Not mobile-friendly → mobile users bounce
  if (audits.mobileFriendly && !audits.mobileFriendly.exists) {
    bounceScore += 15;
    factors.push({
      factor: "Not Mobile-Friendly",
      impact: "+15%",
      icon: "📱",
      description:
        "60%+ of visitors use mobile — broken mobile layout = instant exit",
    });
  }

  // CLS issues → content shifts annoy users
  if (audits.clsRisk && audits.clsRisk.status === "FAIL") {
    bounceScore += 10;
    factors.push({
      factor: "Layout Shift (CLS)",
      impact: "+10%",
      icon: "📐",
      description:
        "Content jumping around makes users lose their place and leave",
    });
  }

  // No SSL → trust issue
  if (audits.sslCertificate && !audits.sslCertificate.valid) {
    bounceScore += 20;
    factors.push({
      factor: "SSL Not Valid",
      impact: "+20%",
      icon: "🔒",
      description: "Browser shows 'Not Secure' — users immediately leave",
    });
  }

  // Thin content → nothing to engage with
  if (audits.contentAnalysis && (audits.contentAnalysis.wordCount || 0) < 300) {
    bounceScore += 10;
    factors.push({
      factor: "Thin Content",
      impact: "+10%",
      icon: "📄",
      description: "Not enough content to keep visitors engaged on the page",
    });
  }

  // Large DOM → slow rendering
  if (audits.domSize && audits.domSize.status === "FAIL") {
    bounceScore += 5;
    factors.push({
      factor: "Heavy DOM",
      impact: "+5%",
      icon: "⚡",
      description:
        "Too many HTML elements slow down rendering on low-end devices",
    });
  }

  // No images → less engaging
  if (audits.images && (audits.images.totalImages || 0) === 0) {
    bounceScore += 5;
    factors.push({
      factor: "No Images",
      impact: "+5%",
      icon: "🖼️",
      description: "Pages without visuals feel empty — users don't stay",
    });
  }

  // Poor accessibility
  if (audits.tapTargets && audits.tapTargets.status === "FAIL") {
    bounceScore += 5;
    factors.push({
      factor: "Small Tap Targets",
      impact: "+5%",
      icon: "👆",
      description:
        "Buttons/links too small to tap on mobile — frustrates users",
    });
  }

  const estimatedBounceRate = Math.min(bounceScore, 95);

  return {
    estimatedBounceRate,
    factors: factors.sort((a, b) => parseInt(b.impact) - parseInt(a.impact)),
    riskLevel:
      estimatedBounceRate > 70
        ? "critical"
        : estimatedBounceRate > 50
          ? "high"
          : estimatedBounceRate > 35
            ? "medium"
            : "low",
    goodFactors: getGoodFactors(audits),
  };
}

function getGoodFactors(audits) {
  const good = [];
  if (audits.sslCertificate?.valid)
    good.push("✅ SSL Valid — users trust your site");
  if (audits.mobileFriendly?.exists)
    good.push("✅ Mobile-friendly — works on all devices");
  if (audits.compression?.compressed)
    good.push("✅ Compressed — fast load times");
  if (audits.metaTags?.hasTitle && audits.metaTags?.hasDescription)
    good.push("✅ Meta tags present — clear search result appearance");
  if (audits.images?.totalImages > 0 && audits.images?.missingAlt === 0)
    good.push("✅ All images have alt text — accessible");
  return good;
}

// ─── UX Score ───
function calculateUXScore(report, uptimeRecords) {
  if (!report) return { score: 0, breakdown: {} };

  const scores = report.scores || {};
  const performanceWeight = 0.3;
  const accessibilityWeight = 0.25;
  const bestPracticesWeight = 0.2;
  const seoWeight = 0.25;

  const weightedScore = Math.round(
    (scores.performance || 0) * performanceWeight +
      (scores.accessibility || 0) * accessibilityWeight +
      (scores.bestPractices || 0) * bestPracticesWeight +
      (scores.seo || 0) * seoWeight,
  );

  // Uptime factor
  const recentUptime = uptimeRecords.slice(0, 100);
  const uptimeOk = recentUptime.filter((u) => u.ok).length;
  const uptimePercent =
    recentUptime.length > 0
      ? Math.round((uptimeOk / recentUptime.length) * 100)
      : 100;

  return {
    score: weightedScore,
    breakdown: {
      performance: Math.round(scores.performance || 0),
      accessibility: Math.round(scores.accessibility || 0),
      bestPractices: Math.round(scores.bestPractices || 0),
      seo: Math.round(scores.seo || 0),
      uptime: uptimePercent,
    },
    level:
      weightedScore >= 90
        ? "excellent"
        : weightedScore >= 70
          ? "good"
          : weightedScore >= 50
            ? "needs-work"
            : "poor",
  };
}

// ─── Exit / Drop-off Analysis ───
function analyzeExitFactors(report) {
  if (!report || !report.audits) return { factors: [], riskScore: 0 };

  const audits = report.audits;
  const factors = [];

  // Missing CTA / internal links
  if (audits.linkProfile) {
    const internalLinks = audits.linkProfile.internalLinks || 0;
    if (internalLinks < 3) {
      factors.push({
        area: "Navigation Dead End",
        severity: "high",
        icon: "🚪",
        description: "Too few internal links — users have nowhere to go next",
        fix: "Add 3-5 contextual internal links pointing to related pages",
      });
    }
  }

  // No structured data → less engaging SERP → wrong expectations
  if (audits.structuredData && !audits.structuredData.exists) {
    factors.push({
      area: "Misleading Search Results",
      severity: "medium",
      icon: "🏷️",
      description:
        "Without structured data, search snippets may not match content",
      fix: "Add JSON-LD schema to improve search result accuracy",
    });
  }

  // Broken links
  if (audits.brokenLinks && (audits.brokenLinks.broken || 0) > 0) {
    factors.push({
      area: "Broken Links",
      severity: "high",
      icon: "💔",
      description: `${audits.brokenLinks.broken} broken link(s) — users hit dead ends and leave`,
      fix: "Fix or remove all broken links immediately",
    });
  }

  // No custom 404
  if (audits.custom404 && !audits.custom404.exists) {
    factors.push({
      area: "Default 404 Page",
      severity: "medium",
      icon: "🚫",
      description:
        "Default error pages lose 100% of visitors — no way to recover",
      fix: "Create a custom 404 page with navigation and search",
    });
  }

  // Poor readability
  if (audits.readability && audits.readability.status === "FAIL") {
    factors.push({
      area: "Hard to Read",
      severity: "medium",
      icon: "📖",
      description: "Complex text causes rapid exit — users give up reading",
      fix: "Simplify sentences, use shorter paragraphs, add headings",
    });
  }

  // No breadcrumbs
  if (audits.breadcrumbSchema && !audits.breadcrumbSchema.exists) {
    factors.push({
      area: "No Breadcrumb Navigation",
      severity: "low",
      icon: "🧭",
      description: "Users can't see where they are or navigate back easily",
      fix: "Add breadcrumb navigation with BreadcrumbList schema",
    });
  }

  // Slow page
  if (report.scores?.performance < 50) {
    factors.push({
      area: "Slow Page Load",
      severity: "high",
      icon: "⏳",
      description: "53% of users leave if a page takes over 3 seconds to load",
      fix: "Optimize images, enable caching, minify CSS/JS",
    });
  }

  const riskScore = factors.reduce(
    (sum, f) =>
      sum + (f.severity === "high" ? 30 : f.severity === "medium" ? 15 : 5),
    0,
  );

  return {
    factors: factors.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.severity] || 2) - (order[b.severity] || 2);
    }),
    riskScore: Math.min(riskScore, 100),
    riskLevel:
      riskScore > 60 ? "critical" : riskScore > 30 ? "warning" : "good",
  };
}

// ─── Score Trends ───
function calculateScoreTrends(reports) {
  if (reports.length < 2) return { trend: "neutral", changes: {}, history: [] };

  const latest = reports[0]?.scores || {};
  const previous = reports[1]?.scores || {};

  const changes = {};
  for (const key of ["performance", "accessibility", "bestPractices", "seo"]) {
    const curr = Math.round(latest[key] || 0);
    const prev = Math.round(previous[key] || 0);
    changes[key] = {
      current: curr,
      previous: prev,
      change: curr - prev,
      direction: curr > prev ? "up" : curr < prev ? "down" : "stable",
    };
  }

  const avgChange =
    Object.values(changes).reduce((s, c) => s + c.change, 0) /
    Object.keys(changes).length;

  // Last 10 reports for chart
  const history = reports
    .slice(0, 10)
    .reverse()
    .map((r) => ({
      date: r.timestamp
        ? new Date(r.timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "",
      seo: Math.round(r.scores?.seo || 0),
      performance: Math.round(r.scores?.performance || 0),
      accessibility: Math.round(r.scores?.accessibility || 0),
      bestPractices: Math.round(r.scores?.bestPractices || 0),
    }));

  return {
    trend:
      avgChange > 2 ? "improving" : avgChange < -2 ? "declining" : "stable",
    changes,
    history,
  };
}

// ─── Uptime Stats ───
function calculateUptimeStats(records) {
  if (records.length === 0)
    return {
      totalChecks: 0,
      upCount: 0,
      downCount: 0,
      uptimePercent: 100,
      avgResponseTime: 0,
      incidents: [],
    };

  const upCount = records.filter((r) => r.ok).length;
  const downCount = records.length - upCount;
  const uptimePercent =
    records.length > 0
      ? parseFloat(((upCount / records.length) * 100).toFixed(2))
      : 100;

  const responseTimes = records
    .filter((r) => r.responseTime > 0)
    .map((r) => r.responseTime);
  const avgResponseTime =
    responseTimes.length > 0
      ? Math.round(
          responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length,
        )
      : 0;

  // Find downtime incidents
  const incidents = records
    .filter((r) => !r.ok)
    .slice(0, 10)
    .map((r) => ({
      timestamp: r.timestamp,
      status: r.status,
      responseTime: r.responseTime,
    }));

  return {
    totalChecks: records.length,
    upCount,
    downCount,
    uptimePercent,
    avgResponseTime,
    incidents,
    responseTimeLevel:
      avgResponseTime < 500
        ? "fast"
        : avgResponseTime < 1500
          ? "average"
          : "slow",
  };
}

// ─── Keyword Performance ───
function analyzeKeywordPerformance(site, keywordRanks) {
  const keywords = site.keywords || [];
  if (keywords.length === 0)
    return { keywords: [], summary: "No keywords tracked" };

  const keywordData = keywords.map((kw) => {
    const ranks = keywordRanks.filter((r) => r.keyword === kw);
    const latest = ranks[0];
    const previous = ranks[1];

    return {
      keyword: kw,
      currentPosition: latest?.position || 0,
      previousPosition: previous?.position || 0,
      change: previous ? (previous.position || 0) - (latest?.position || 0) : 0,
      direction: !previous
        ? "new"
        : (latest?.position || 0) < (previous.position || 0)
          ? "up"
          : (latest?.position || 0) > (previous.position || 0)
            ? "down"
            : "stable",
      lastChecked: latest?.timestamp,
    };
  });

  // Sort: ranked first, then by position
  keywordData.sort((a, b) => {
    if (a.currentPosition === 0 && b.currentPosition === 0) return 0;
    if (a.currentPosition === 0) return 1;
    if (b.currentPosition === 0) return -1;
    return a.currentPosition - b.currentPosition;
  });

  const improving = keywordData.filter((k) => k.direction === "up").length;
  const declining = keywordData.filter((k) => k.direction === "down").length;
  const ranked = keywordData.filter((k) => k.currentPosition > 0).length;

  return {
    keywords: keywordData,
    improving,
    declining,
    ranked,
    total: keywords.length,
    summary:
      ranked === 0
        ? "No keywords ranking yet"
        : `${ranked}/${keywords.length} ranking · ${improving} improving · ${declining} declining`,
  };
}

// ─── Backlink Health ───
function analyzeBacklinkHealth(backlinks) {
  const active = backlinks.filter((b) => b.active);
  const lost = backlinks.filter((b) => !b.active);

  const recentGains = active.filter(
    (b) =>
      new Date(b.firstSeen) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  ).length;

  const recentLosses = lost.filter(
    (b) =>
      b.lostDate &&
      new Date(b.lostDate) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  ).length;

  const uniqueDomains = new Set(active.map((b) => b.sourceDomain)).size;

  return {
    active: active.length,
    lost: lost.length,
    recentGains,
    recentLosses,
    uniqueDomains,
    health:
      active.length >= 10 ? "strong" : active.length >= 3 ? "growing" : "weak",
    trend:
      recentGains > recentLosses
        ? "growing"
        : recentGains < recentLosses
          ? "declining"
          : "stable",
  };
}

// ─── Improvement Suggestions Engine ───
function generateImprovements(
  report,
  bounceAnalysis,
  exitAnalysis,
  uxScore,
  uptimeStats,
  keywordPerformance,
  backlinkHealth,
  trafficEstimate,
) {
  const suggestions = [];

  // Traffic improvements
  if (trafficEstimate.qualityScore < 40) {
    suggestions.push({
      category: "Traffic",
      priority: "high",
      icon: "📈",
      title: "Boost Organic Traffic",
      description:
        "Your traffic quality score is low. Track more keywords and build backlinks to increase organic visitors.",
      actions: [
        "Add 5-10 relevant keywords to track",
        "Create content targeting long-tail keywords",
        "Build backlinks from relevant domains",
      ],
    });
  }

  // Bounce rate improvements
  if (bounceAnalysis.estimatedBounceRate > 50) {
    suggestions.push({
      category: "Bounce Rate",
      priority: "high",
      icon: "🚪",
      title: "Reduce High Bounce Rate",
      description: `Estimated ${bounceAnalysis.estimatedBounceRate}% bounce rate — fix these issues to keep visitors on your site.`,
      actions: bounceAnalysis.factors.slice(0, 3).map((f) => f.description),
    });
  }

  // Exit improvements
  if (exitAnalysis.riskScore > 30) {
    suggestions.push({
      category: "User Retention",
      priority: "medium",
      icon: "🔄",
      title: "Reduce Exit Rate",
      description:
        "Users are leaving your site due to navigation and content issues.",
      actions: exitAnalysis.factors.slice(0, 3).map((f) => f.fix),
    });
  }

  // UX improvements
  if (uxScore.score < 70) {
    suggestions.push({
      category: "User Experience",
      priority: "medium",
      icon: "✨",
      title: "Improve User Experience",
      description: `UX score is ${uxScore.score}/100. Focus on the weakest areas.`,
      actions: Object.entries(uxScore.breakdown)
        .filter(([_, v]) => v < 70)
        .map(([k, v]) => `Improve ${k}: currently ${v}/100`),
    });
  }

  // Uptime improvements
  if (uptimeStats.uptimePercent < 99) {
    suggestions.push({
      category: "Reliability",
      priority: "high",
      icon: "📡",
      title: "Fix Uptime Issues",
      description: `Uptime is ${uptimeStats.uptimePercent}% — each downtime incident loses visitors permanently.`,
      actions: [
        "Investigate hosting provider reliability",
        "Set up redundancy or CDN",
        "Monitor server error logs",
      ],
    });
  }

  // Speed improvements
  if (uptimeStats.avgResponseTime > 1000) {
    suggestions.push({
      category: "Speed",
      priority: "medium",
      icon: "⚡",
      title: "Improve Page Speed",
      description: `Average response: ${uptimeStats.avgResponseTime}ms — slow sites lose 40% of visitors.`,
      actions: [
        "Enable server-side caching",
        "Use a CDN for static assets",
        "Optimize database queries",
      ],
    });
  }

  // Keyword improvements
  if (keywordPerformance.declining > 0) {
    suggestions.push({
      category: "SEO Rankings",
      priority: "medium",
      icon: "🔑",
      title: "Recover Declining Keywords",
      description: `${keywordPerformance.declining} keyword(s) are losing rank — take action before they drop further.`,
      actions: [
        "Update content for declining keywords",
        "Build internal links to pages targeting those keywords",
        "Check if competitors have published better content",
      ],
    });
  }

  // Backlink improvements
  if (backlinkHealth.health === "weak") {
    suggestions.push({
      category: "Authority",
      priority: "medium",
      icon: "🔗",
      title: "Build More Backlinks",
      description:
        "Few backlinks = low domain authority. You need more quality links.",
      actions: [
        "Guest post on relevant industry blogs",
        "Create shareable infographics or tools",
        "Reach out to sites linking to competitors",
      ],
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort(
    (a, b) =>
      (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2),
  );

  return suggestions;
}
