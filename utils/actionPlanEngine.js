import { readDb } from "./scheduler.js";
import fs from "fs";
import path from "path";

// ============ AI ACTION PLAN ENGINE ============
// Analyzes audit data and generates a prioritized "Top 3 Fixes" action plan.
// Uses a smart scoring algorithm:
//   Score = Impact Weight × Effort Multiplier × Category Bonus
// Where:
//   Impact: High=30, Medium=15, Low=5
//   Effort: Low=3x (quick wins first!), Medium=2x, High=1x
//   Category Bonus: Technical/On-Page/Content get +10 (highest SEO ROI categories)

const IMPACT_SCORE = { High: 30, Medium: 15, Low: 5 };
const EFFORT_MULTIPLIER = { Low: 3, Medium: 2, High: 1 }; // quick wins first
const PRIORITY_CATEGORIES = [
  "Technical",
  "On-Page",
  "Content",
  "Performance",
  "Security",
];

// ─── Inline checklist + metadata (mirrors src/constants/) ───
// This avoids importing frontend modules into the backend.
const CHECK_META = {
  "Content Analysis": {
    impact: "High",
    fix: "Add: Write 300+ words of unique, keyword-rich content.",
    why: "Thin pages rarely rank — Google needs substance to evaluate.",
    effort: "Medium",
    cat: "Content",
    checkKey: "contentAnalysis",
  },
  "Readability Score": {
    impact: "Medium",
    fix: "Simplify: Shorten sentences and use everyday vocabulary.",
    why: "Complex text increases bounce rate, hurting dwell time signals.",
    effort: "Low",
    cat: "Content",
    checkKey: "readability",
  },
  "Keyword Density": {
    impact: "High",
    fix: "Optimize: Include primary keyword 2-3 times naturally.",
    why: "Without keyword signals, Google can't match intent to your page.",
    effort: "Low",
    cat: "On-Page",
    checkKey: "keywordDensity",
  },
  "Meta Tags Check": {
    impact: "High",
    fix: "Write: Add title (<60 chars) and description (<160 chars).",
    why: "Title/desc are the #1 factor in click-through from search results.",
    effort: "Low",
    cat: "On-Page",
    checkKey: "metaTags",
  },
  "Link Profile": {
    impact: "Medium",
    fix: "Build: Add internal links to related pages + outbound links.",
    why: "Internal links spread authority; outbound links show topical relevance.",
    effort: "Medium",
    cat: "Authority",
    checkKey: "linkProfile",
  },
  "Security Headers": {
    impact: "Medium",
    fix: "Configure: Add CSP, X-Frame-Options, HSTS via server config.",
    why: "Missing headers = vulnerable site; Google may flag as unsafe.",
    effort: "High",
    cat: "Authority",
    checkKey: "securityCheck",
  },
  "Sitemap Generator": {
    impact: "High",
    fix: "Create: Generate sitemap.xml and submit to Search Console.",
    why: "Without sitemap, crawlers may miss important pages.",
    effort: "Low",
    cat: "Technical",
    checkKey: "sitemap",
  },
  "Robots.txt Gen": {
    impact: "High",
    fix: "Create: Add robots.txt with proper allow/disallow rules.",
    why: "Missing robots.txt lets bots crawl everything including junk URLs.",
    effort: "Low",
    cat: "Technical",
    checkKey: "robots",
  },
  "Image Compression": {
    impact: "Medium",
    fix: "Add: Write descriptive alt text for every image.",
    why: "Alt text helps Google Images ranking and accessibility compliance.",
    effort: "Low",
    cat: "Images",
    checkKey: "images",
  },
  "Open Graph Tags": {
    impact: "Medium",
    fix: "Add: Include og:title, og:description, og:image tags.",
    why: "Social shares drive traffic; bad previews kill click-through.",
    effort: "Low",
    cat: "Social",
    checkKey: "openGraph",
  },
  "SSL Certificate": {
    impact: "High",
    fix: "Renew: Update SSL certificate before expiry.",
    why: "HTTPS is a confirmed ranking signal; expired certs show warnings.",
    effort: "Low",
    cat: "Security",
    checkKey: "sslCertificate",
  },
  "Structured Data": {
    impact: "High",
    fix: "Implement: Add JSON-LD schema (Organization, Article, etc.).",
    why: "Rich snippets from schema boost CTR by up to 30%.",
    effort: "Medium",
    cat: "Technical",
    checkKey: "structuredData",
  },
  "Mobile-Friendly": {
    impact: "High",
    fix: "Fix: Add viewport meta tag and responsive CSS.",
    why: "Mobile-first indexing means non-mobile sites won't rank.",
    effort: "Medium",
    cat: "Mobile",
    checkKey: "mobileFriendly",
  },
  "Canonical URL": {
    impact: "High",
    fix: "Add: Set self-referencing canonical tag.",
    why: "Duplicate content dilutes ranking power across multiple URLs.",
    effort: "Low",
    cat: "On-Page",
    checkKey: "canonicalUrl",
  },
  "Page Structure": {
    impact: "Medium",
    fix: "Refactor: Use semantic HTML — header, nav, main, footer.",
    why: "Semantic HTML helps crawlers understand page hierarchy.",
    effort: "Medium",
    cat: "Technical",
    checkKey: "pageStructure",
  },
  "Redirect Chain": {
    impact: "Medium",
    fix: "Fix: Point all redirects directly to the final URL.",
    why: "Each redirect hop loses ~10% of link equity and adds latency.",
    effort: "Medium",
    cat: "Technical",
    checkKey: "redirectChain",
  },
  "Favicon Check": {
    impact: "Low",
    fix: "Add: Upload favicon.ico and apple-touch-icon.",
    why: "Favicons improve brand recognition in tabs and bookmarks.",
    effort: "Low",
    cat: "Branding",
    checkKey: "favicon",
  },
  "Language & hreflang": {
    impact: "Low",
    fix: "Set: Add lang attribute on the html element.",
    why: "Helps search engines serve the right language to users.",
    effort: "Low",
    cat: "i18n",
    checkKey: "language",
  },
  "DOM Size Check": {
    impact: "Medium",
    fix: "Reduce: Keep DOM under 1500 elements for speed.",
    why: "Large DOM increases memory usage and slows rendering.",
    effort: "High",
    cat: "Performance",
    checkKey: "domSize",
  },
  "Inline CSS/JS Check": {
    impact: "Medium",
    fix: "Extract: Move inline scripts to external files with defer.",
    why: "Inline code blocks rendering; external files can be cached.",
    effort: "Medium",
    cat: "Performance",
    checkKey: "jsOptimization",
  },
  "Social Media Links": {
    impact: "Low",
    fix: "Add: Include links to active social profiles.",
    why: "Social profiles build brand presence and trust signals.",
    effort: "Low",
    cat: "Social",
    checkKey: "socialLinks",
  },
  "Analytics Detection": {
    impact: "Medium",
    fix: "Install: Add Google Analytics or equivalent tracking.",
    why: "Without analytics, you can't measure what to improve.",
    effort: "Low",
    cat: "Analytics",
    checkKey: "analyticsDetection",
  },
  "Deprecated HTML": {
    impact: "Low",
    fix: "Replace: Swap deprecated tags (font, center) with CSS.",
    why: "Deprecated HTML signals outdated code to crawlers.",
    effort: "Low",
    cat: "Code Quality",
    checkKey: "deprecatedHtml",
  },
  "Compression Check": {
    impact: "Medium",
    fix: "Enable: Turn on gzip/brotli compression on server.",
    why: "Compression cuts page size 60-80%, directly improving load time.",
    effort: "Low",
    cat: "Performance",
    checkKey: "compression",
  },
  "HTTP Headers": {
    impact: "Medium",
    fix: "Set: Configure Cache-Control and ETag headers.",
    why: "Proper caching headers reduce repeat-visit load times.",
    effort: "Low",
    cat: "Security",
    checkKey: "httpHeaders",
  },
  "Custom 404 Page": {
    impact: "Low",
    fix: "Create: Build a custom 404 page with navigation.",
    why: "Good 404s retain users instead of losing them to dead ends.",
    effort: "Low",
    cat: "UX",
    checkKey: "custom404",
  },
  "Image Formats": {
    impact: "Medium",
    fix: "Convert: Switch images to WebP/AVIF format.",
    why: "Modern formats are 25-50% smaller than JPEG/PNG.",
    effort: "Medium",
    cat: "Images",
    checkKey: "imageFormats",
  },
  "Tap Targets": {
    impact: "Medium",
    fix: "Resize: Make all buttons/links at least 48×48px.",
    why: "Small tap targets cause mobile usability failures in GSC.",
    effort: "Low",
    cat: "Mobile",
    checkKey: "tapTargets",
  },
  "Duplicate H1": {
    impact: "High",
    fix: "Fix: Use exactly one H1 per page with primary keyword.",
    why: "Multiple H1s confuse crawler hierarchy and dilute topical focus.",
    effort: "Low",
    cat: "On-Page",
    checkKey: "duplicateH1",
  },
  "Title/Desc Length": {
    impact: "High",
    fix: "Adjust: Keep title 30-60 chars, description 120-160.",
    why: "Truncated or empty SERP snippets hurt click-through rates.",
    effort: "Low",
    cat: "On-Page",
    checkKey: "titleDescLength",
  },
  "Indexability Check": {
    impact: "High",
    fix: "Remove: Delete noindex tag and fix canonical mismatches.",
    why: "Noindex = invisible to Google. Page won't rank at all.",
    effort: "Low",
    cat: "Technical",
    checkKey: "indexability",
  },
  "CLS Risk Factors": {
    impact: "High",
    fix: "Fix: Add width/height to all images, avoid late-loaded CSS.",
    why: "CLS is a Core Web Vital — poor scores trigger ranking demotion.",
    effort: "Medium",
    cat: "Performance",
    checkKey: "clsRisk",
  },
  "Lazy Loading": {
    impact: "Medium",
    fix: "Add: Set loading='lazy' on below-fold images/iframes.",
    why: "Lazy loading improves initial page load speed significantly.",
    effort: "Low",
    cat: "Performance",
    checkKey: "lazyLoading",
  },
  "Content Freshness": {
    impact: "Medium",
    fix: "Add: Include datePublished/dateModified in schema.",
    why: "Fresh content signals relevance; stale dates drop rankings.",
    effort: "Low",
    cat: "Content",
    checkKey: "contentFreshness",
  },
  "E-E-A-T Signals": {
    impact: "High",
    fix: "Create: Add About, Contact, Privacy pages + author info.",
    why: "Google's Quality Raters explicitly check for E-E-A-T signals.",
    effort: "Medium",
    cat: "Authority",
    checkKey: "eeatSignals",
  },
  "Accessibility Basics": {
    impact: "Medium",
    fix: "Add: Include ARIA roles, form labels, focus outlines.",
    why: "Accessibility issues affect 15%+ of users and may trigger penalties.",
    effort: "Medium",
    cat: "Accessibility",
    checkKey: "accessibilityBasics",
  },
  "URL Structure": {
    impact: "Medium",
    fix: "Clean: Use short, lowercase, hyphenated URLs.",
    why: "Clean URLs improve crawlability and user trust in SERPs.",
    effort: "Medium",
    cat: "On-Page",
    checkKey: "urlStructure",
  },
  "Breadcrumb Schema": {
    impact: "Medium",
    fix: "Add: Implement BreadcrumbList JSON-LD markup.",
    why: "Breadcrumb rich snippets improve SERP appearance and CTR.",
    effort: "Low",
    cat: "On-Page",
    checkKey: "breadcrumbSchema",
  },
  "Cookie Consent": {
    impact: "Low",
    fix: "Add: Implement GDPR-compliant cookie consent banner.",
    why: "Missing consent = legal risk in EU/UK markets.",
    effort: "Low",
    cat: "Legal",
    checkKey: "cookieConsent",
  },
  "Entity Schema Depth": {
    impact: "High",
    fix: "Add: Implement Organization, Article, FAQ schema.",
    why: "Rich entity data unlocks Knowledge Panel and FAQ rich results.",
    effort: "Medium",
    cat: "Technical",
    checkKey: "entitySchema",
  },
  "Broken Links": {
    impact: "High",
    fix: "Fix: Repair or remove all broken (404) links on the page.",
    why: "Broken links waste crawl budget and hurt user experience.",
    effort: "Medium",
    cat: "Technical",
    checkKey: "brokenLinks",
  },
};

// Determine if a check passed or failed based on report.audits[checkKey]
function didCheckPass(checkKey, taskName, report) {
  if (!report || !report.audits) return null; // unknown
  const audit = report.audits[checkKey];
  if (!audit) return null; // check wasn't run

  // Most checks use audit.status === "PASS"
  if (audit.status !== undefined) return audit.status === "PASS";

  // Sitemap & robots use audit.exists
  if (audit.exists !== undefined) return audit.exists;

  // Image compression: pass if missingAlt === 0
  if (checkKey === "images" && audit.missingAlt !== undefined)
    return audit.missingAlt === 0;

  // Outbound links: pass if externalLinks > 0
  if (checkKey === "linkProfile" && taskName === "Outbound Links")
    return (audit.externalLinks || 0) > 0;

  return null;
}

export function generateActionPlan(siteId) {
  const db = readDb();
  const site = db.websites.find((w) => String(w.id) === String(siteId));
  if (!site) throw new Error("Site not found");

  const reports = (db.reports || [])
    .filter((r) => String(r.websiteId) === String(siteId))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const latestReport = reports[0];
  if (!latestReport) {
    return {
      site: site.url,
      actionPlan: [],
      summary: "No audit data available. Run an audit first.",
      overallHealth: "unknown",
      totalIssues: 0,
    };
  }

  // Build scored list of failed checks using CHECK_META + report.audits
  const failedItems = [];

  for (const [taskName, meta] of Object.entries(CHECK_META)) {
    const passed = didCheckPass(meta.checkKey, taskName, latestReport);
    if (passed === false) {
      // Check FAILED → add to priority list
      const baseScore = IMPACT_SCORE[meta.impact] || 15;
      const effortMultiplier = EFFORT_MULTIPLIER[meta.effort] || 2;
      const categoryBonus = PRIORITY_CATEGORIES.includes(meta.cat) ? 10 : 0;
      const priorityScore = baseScore * effortMultiplier + categoryBonus;

      // Get details from audit data
      const auditData = latestReport.audits[meta.checkKey] || {};
      let details = "";
      if (auditData.details) details = auditData.details;

      failedItems.push({
        task: taskName,
        category: meta.cat,
        impact: meta.impact,
        effort: meta.effort,
        fix: meta.fix,
        why: meta.why,
        details,
        priorityScore,
      });
    }
  }

  // Also check Website Speed (score-based, not audit-based)
  if (latestReport.scores && latestReport.scores.performance < 90) {
    failedItems.push({
      task: "Website Speed",
      category: "Performance",
      impact: "High",
      effort: "High",
      fix: "Optimize: Minify CSS/JS, compress images, enable caching.",
      why: "Speed is a direct ranking factor; slow sites lose 40% of visitors.",
      details: `Performance score: ${Math.round(latestReport.scores.performance)}/100`,
      priorityScore: IMPACT_SCORE.High * EFFORT_MULTIPLIER.High + 10,
    });
  }

  // Sort by priority score (highest first)
  failedItems.sort((a, b) => b.priorityScore - a.priorityScore);

  // Take top 3
  const top3 = failedItems.slice(0, 3);

  const actionPlan = top3.map((item, index) => ({
    priority: index + 1,
    task: item.task,
    category: item.category,
    impact: item.impact,
    effort: item.effort,
    instruction: item.fix,
    reason: item.why,
    details: item.details,
    priorityScore: item.priorityScore,
  }));

  // Overall health
  const scores = latestReport.scores || {};
  const avgScore = Math.round(
    ((scores.seo || 0) +
      (scores.performance || 0) +
      (scores.accessibility || 0) +
      (scores.bestPractices || 0)) /
      4,
  );

  let overallHealth = "critical";
  if (avgScore >= 90) overallHealth = "excellent";
  else if (avgScore >= 75) overallHealth = "good";
  else if (avgScore >= 50) overallHealth = "needs-work";

  // Summary
  const totalFailed = failedItems.length;
  let summary = "";
  if (totalFailed === 0) {
    summary =
      "🎉 All checks passed! Your site is in great shape. Focus on content and backlinks.";
  } else if (totalFailed <= 3) {
    summary = `⚡ Only ${totalFailed} issue(s) found. Fix these and your site will be in excellent shape!`;
  } else if (totalFailed <= 10) {
    summary = `⚠️ ${totalFailed} issues found. Focus on the top 3 below for maximum ranking boost.`;
  } else {
    summary = `🔴 ${totalFailed} issues need attention. Start with these 3 high-priority quick wins below.`;
  }

  // Estimated improvement
  const potentialGain = top3.reduce((sum, item) => {
    if (item.impact === "High") return sum + 8;
    if (item.impact === "Medium") return sum + 4;
    return sum + 2;
  }, 0);

  return {
    site: site.url,
    hostname: new URL(site.url).hostname,
    scores,
    avgScore,
    overallHealth,
    summary,
    totalIssues: totalFailed,
    actionPlan,
    estimatedGain: Math.min(potentialGain, 25),
    allIssues: failedItems.length,
    nextSteps:
      failedItems.length > 3
        ? failedItems.slice(3, 8).map((item) => ({
            task: item.task,
            category: item.category,
            impact: item.impact,
          }))
        : [],
  };
}

// Generate cross-site internal link suggestions
export function generateLinkSuggestions() {
  const db = readDb();
  const sites = db.websites || [];
  if (sites.length < 2) return [];

  const suggestions = [];

  for (let i = 0; i < sites.length; i++) {
    for (let j = 0; j < sites.length; j++) {
      if (i === j) continue;

      const siteA = sites[i];
      const siteB = sites[j];

      // Same group = likely related
      if (
        siteA.group &&
        siteB.group &&
        siteA.group === siteB.group &&
        siteA.group !== "Ungrouped"
      ) {
        suggestions.push({
          from: new URL(siteA.url).hostname,
          to: new URL(siteB.url).hostname,
          fromUrl: siteA.url,
          toUrl: siteB.url,
          reason: `Same group "${siteA.group}" — add a contextual link to boost both sites`,
          strength: "strong",
        });
      }

      // Tag overlap
      const tagsA = siteA.tags || [];
      const tagsB = siteB.tags || [];
      const commonTags = tagsA.filter((t) => tagsB.includes(t));
      if (commonTags.length > 0) {
        suggestions.push({
          from: new URL(siteA.url).hostname,
          to: new URL(siteB.url).hostname,
          fromUrl: siteA.url,
          toUrl: siteB.url,
          reason: `Shared tags: ${commonTags.map((t) => "#" + t).join(", ")} — link between related content`,
          strength: commonTags.length >= 2 ? "strong" : "medium",
        });
      }
    }
  }

  // Deduplicate
  const seen = new Set();
  const unique = suggestions.filter((s) => {
    const key = [s.from, s.to].sort().join("↔");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, 10);
}

// Fleet-wide overview
export function generateFleetPlan() {
  const db = readDb();
  const sites = db.websites || [];

  const sitePlans = sites.map((site) => {
    try {
      return generateActionPlan(site.id);
    } catch {
      return {
        site: site.url,
        hostname: new URL(site.url).hostname,
        overallHealth: "unknown",
        actionPlan: [],
        summary: "Unable to generate plan",
      };
    }
  });

  const linkSuggestions = generateLinkSuggestions();

  return {
    totalSites: sites.length,
    sitePlans,
    linkSuggestions,
    generated: new Date().toISOString(),
  };
}
