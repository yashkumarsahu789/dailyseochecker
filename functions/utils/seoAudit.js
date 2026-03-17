import * as cheerio from "cheerio";
import axios from "axios";
import https from "https";

/**
 * Self-contained SEO Audit Engine
 * Calculates Performance, Accessibility, Best Practices, SEO scores
 * by analyzing HTML directly — no Chrome or external APIs needed
 */
export async function runSeoAudit(url) {
  const results = {
    url,
    timestamp: new Date().toISOString(),
    scores: { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 },
    audits: {},
    errors: [],
  };

  try {
    console.log(`[Audit] Starting audit for ${url}...`);

    // ========== Fetch HTML and measure response ==========
    const startTime = Date.now();
    const htmlResponse = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
      timeout: 20000,
    });
    const loadTime = Date.now() - startTime;
    const html = htmlResponse.data;
    const $ = cheerio.load(html);
    const htmlSize = Buffer.byteLength(html, "utf8");

    console.log(
      `[Audit] Page fetched in ${loadTime}ms, size: ${(htmlSize / 1024).toFixed(1)}KB`,
    );

    // ========== 1. PERFORMANCE SCORE ==========
    let perfScore = 100;
    // Response time: > 3s = -40, > 1.5s = -20, > 800ms = -10
    if (loadTime > 3000) perfScore -= 40;
    else if (loadTime > 1500) perfScore -= 20;
    else if (loadTime > 800) perfScore -= 10;

    // Page size: > 3MB = -30, > 1MB = -15, > 500KB = -5
    if (htmlSize > 3 * 1024 * 1024) perfScore -= 30;
    else if (htmlSize > 1024 * 1024) perfScore -= 15;
    else if (htmlSize > 500 * 1024) perfScore -= 5;

    // Inline scripts/styles (blocking render)
    const inlineScripts = $("script:not([src])").length;
    const inlineStyles = $("style").length;
    if (inlineScripts > 5) perfScore -= 10;
    if (inlineStyles > 3) perfScore -= 5;

    // External resources count
    const externalScripts = $("script[src]").length;
    const externalStyles = $('link[rel="stylesheet"]').length;
    if (externalScripts > 15) perfScore -= 10;
    if (externalStyles > 5) perfScore -= 5;

    // Image optimization hints
    const totalImages = $("img").length;
    const lazyImages = $('img[loading="lazy"]').length;
    if (totalImages > 5 && lazyImages === 0) perfScore -= 10;

    results.scores.performance = Math.max(0, Math.min(100, perfScore));
    results.audits.performance = {
      loadTimeMs: loadTime,
      pageSizeKB: Math.round(htmlSize / 1024),
      inlineScripts,
      inlineStyles,
      externalScripts,
      externalStyles,
      totalImages,
      lazyImages,
    };

    // ========== 2. SEO SCORE ==========
    let seoScore = 100;

    // Title tag
    const title = $("title").text().trim();
    if (!title) seoScore -= 25;
    else if (title.length < 10) seoScore -= 15;
    else if (title.length > 60) seoScore -= 5;

    // Meta description
    const description = $('meta[name="description"]').attr("content");
    if (!description) seoScore -= 20;
    else if (description.length < 50) seoScore -= 10;
    else if (description.length > 160) seoScore -= 5;

    // H1 tag
    const h1Count = $("h1").length;
    if (h1Count === 0) seoScore -= 15;
    else if (h1Count > 1) seoScore -= 5;

    // Heading hierarchy
    const hasH2 = $("h2").length > 0;
    if (!hasH2 && $("p").length > 3) seoScore -= 5;

    // Canonical URL
    const canonical = $('link[rel="canonical"]').attr("href");
    if (!canonical) seoScore -= 5;

    // Lang attribute
    const lang = $("html").attr("lang");
    if (!lang) seoScore -= 5;

    // Meta viewport
    const viewport = $('meta[name="viewport"]').attr("content");
    if (!viewport) seoScore -= 10;

    // Open Graph
    const ogTitle = $('meta[property="og:title"]').attr("content");
    if (!ogTitle) seoScore -= 5;

    results.scores.seo = Math.max(0, Math.min(100, seoScore));
    results.audits.metaTags = {
      title: title || "Missing",
      titleLength: title ? title.length : 0,
      description: description || "Missing",
      descriptionLength: description ? description.length : 0,
      hasH1: h1Count > 0,
      h1Count,
      hasCanonical: !!canonical,
      hasLang: !!lang,
      hasViewport: !!viewport,
      hasOgTitle: !!ogTitle,
      status: title && description ? "PASS" : "WARN",
    };

    // ========== 3. ACCESSIBILITY SCORE ==========
    let a11yScore = 100;

    // Image alt tags
    const imagesWithoutAlt = [];
    $("img").each((i, img) => {
      if (!$(img).attr("alt")) {
        imagesWithoutAlt.push($(img).attr("src") || "unknown");
      }
    });
    const altMissingPct =
      totalImages > 0 ? imagesWithoutAlt.length / totalImages : 0;
    if (altMissingPct > 0.5) a11yScore -= 25;
    else if (altMissingPct > 0) a11yScore -= 10;

    // Form labels
    const inputs = $(
      "input:not([type=hidden]):not([type=submit]):not([type=button])",
    );
    const inputsWithoutLabel = [];
    inputs.each((i, input) => {
      const id = $(input).attr("id");
      const ariaLabel = $(input).attr("aria-label");
      const ariaLabelledBy = $(input).attr("aria-labelledby");
      if (
        !ariaLabel &&
        !ariaLabelledBy &&
        (!id || $(`label[for="${id}"]`).length === 0)
      ) {
        inputsWithoutLabel.push(id || $(input).attr("name") || "unnamed");
      }
    });
    if (inputsWithoutLabel.length > 0) a11yScore -= 15;

    // Color contrast (can't fully check, just check for small text without styles)
    // Skip button/link without text
    const emptyLinks = $("a:empty:not([aria-label])").length;
    const emptyButtons = $("button:empty:not([aria-label])").length;
    if (emptyLinks > 0) a11yScore -= 10;
    if (emptyButtons > 0) a11yScore -= 5;

    // ARIA landmarks
    const hasMain = $("main, [role=main]").length > 0;
    const hasNav = $("nav, [role=navigation]").length > 0;
    if (!hasMain) a11yScore -= 5;
    if (!hasNav && $("a").length > 5) a11yScore -= 5;

    // Document language
    if (!lang) a11yScore -= 10;

    results.scores.accessibility = Math.max(0, Math.min(100, a11yScore));
    results.audits.images = {
      total: totalImages,
      missingAlt: imagesWithoutAlt.length,
      missingAltList: imagesWithoutAlt.slice(0, 10),
      status: imagesWithoutAlt.length === 0 ? "PASS" : "WARN",
    };

    // ========== 4. BEST PRACTICES SCORE ==========
    let bpScore = 100;

    // HTTPS check
    if (!url.startsWith("https://")) bpScore -= 20;

    // Doctype
    if (!html.toLowerCase().includes("<!doctype html>")) bpScore -= 10;

    // Charset
    const charset =
      $("meta[charset]").attr("charset") ||
      $('meta[http-equiv="Content-Type"]').attr("content");
    if (!charset) bpScore -= 5;

    // Console errors detection (check for deprecated APIs in scripts)
    const hasDocWrite = html.includes("document.write");
    if (hasDocWrite) bpScore -= 10;

    // External scripts on HTTP (mixed content risk)
    let mixedContent = 0;
    $('script[src^="http://"]').each(() => mixedContent++);
    $('link[href^="http://"]').each(() => mixedContent++);
    if (mixedContent > 0) bpScore -= 15;

    // Favicon
    const hasFavicon =
      $('link[rel="icon"], link[rel="shortcut icon"]').length > 0;
    if (!hasFavicon) bpScore -= 5;

    results.scores.bestPractices = Math.max(0, Math.min(100, bpScore));

    // ========== 5. Robots.txt Check ==========
    try {
      const robotsUrl = new URL("/robots.txt", url).href;
      await axios.get(robotsUrl, { timeout: 10000 });
      results.audits.robots = { exists: true, status: "PASS", url: robotsUrl };
    } catch (e) {
      results.audits.robots = {
        exists: false,
        status: "FAIL",
        error: e.message,
      };
    }

    // ========== 6. Sitemap.xml Check ==========
    try {
      const sitemapUrl = new URL("/sitemap.xml", url).href;
      await axios.get(sitemapUrl, { timeout: 10000 });
      results.audits.sitemap = {
        exists: true,
        status: "PASS",
        url: sitemapUrl,
      };
    } catch (e) {
      results.audits.sitemap = {
        exists: false,
        status: "FAIL",
        error: e.message,
      };
    }

    // ========== 7. CONTENT ANALYSIS (replaces Plagiarism Check) ==========
    try {
      // Extract visible text
      $("script, style, noscript").remove();
      const bodyText = $("body").text().replace(/\s+/g, " ").trim();
      const words = bodyText.split(/\s+/).filter((w) => w.length > 2);
      const wordCount = words.length;
      const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
      const uniqueRatio = wordCount > 0 ? uniqueWords.size / wordCount : 0;

      // Sentences
      const sentences = bodyText
        .split(/[.!?]+/)
        .filter((s) => s.trim().length > 5);

      results.audits.contentAnalysis = {
        wordCount,
        uniqueWords: uniqueWords.size,
        uniqueRatio: Math.round(uniqueRatio * 100),
        sentenceCount: sentences.length,
        avgWordsPerSentence:
          sentences.length > 0 ? Math.round(wordCount / sentences.length) : 0,
        status: wordCount > 300 && uniqueRatio > 0.3 ? "PASS" : "WARN",
      };
    } catch (e) {
      results.audits.contentAnalysis = { status: "ERROR", error: e.message };
    }

    // ========== 8. KEYWORD DENSITY (replaces Keyword Position) ==========
    try {
      const textForKeywords = $("body").text().replace(/\s+/g, " ").trim();
      const kwWords = textForKeywords
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .filter(
          (w) =>
            ![
              "this",
              "that",
              "with",
              "from",
              "your",
              "have",
              "will",
              "been",
              "more",
              "when",
              "each",
              "than",
              "them",
              "into",
              "also",
              "about",
              "which",
              "their",
              "there",
              "would",
              "could",
              "should",
              "these",
              "those",
              "other",
              "some",
              "such",
              "only",
              "very",
              "just",
              "most",
              "much",
              "like",
              "what",
              "http",
              "https",
              "www",
            ].includes(w),
        );

      const freq = {};
      kwWords.forEach((w) => {
        freq[w] = (freq[w] || 0) + 1;
      });

      const totalKw = kwWords.length;
      const topKeywords = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({
          word,
          count,
          density:
            totalKw > 0 ? ((count / totalKw) * 100).toFixed(1) + "%" : "0%",
        }));

      const topDensity =
        topKeywords.length > 0 ? parseFloat(topKeywords[0].density) : 0;

      results.audits.keywordDensity = {
        totalWords: totalKw,
        topKeywords,
        topDensity,
        stuffing: topDensity > 3,
        status:
          topKeywords.length === 0 ? "WARN" : topDensity > 3 ? "FAIL" : "PASS",
      };
    } catch (e) {
      results.audits.keywordDensity = { status: "ERROR", error: e.message };
    }

    // ========== 9. LINK PROFILE (replaces Backlink Check) ==========
    try {
      // Re-load original HTML for link analysis
      const freshHtml = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $fresh = cheerio.load(freshHtml);
      const domain = new URL(url).hostname;
      let internalLinks = 0;
      let externalLinks = 0;
      let nofollowLinks = 0;
      const externalDomains = new Set();

      $fresh("a[href]").each((i, el) => {
        const href = $fresh(el).attr("href") || "";
        const rel = ($fresh(el).attr("rel") || "").toLowerCase();
        if (rel.includes("nofollow")) nofollowLinks++;

        try {
          if (href.startsWith("http")) {
            const linkDomain = new URL(href).hostname;
            if (linkDomain.includes(domain) || domain.includes(linkDomain)) {
              internalLinks++;
            } else {
              externalLinks++;
              externalDomains.add(linkDomain);
            }
          } else if (href.startsWith("/") || href.startsWith("#")) {
            internalLinks++;
          }
        } catch (e) {
          // skip malformed URLs
        }
      });

      results.audits.linkProfile = {
        totalLinks: internalLinks + externalLinks,
        internalLinks,
        externalLinks,
        nofollowLinks,
        externalDomains: [...externalDomains].slice(0, 20),
        status: internalLinks > 0 ? "PASS" : "WARN",
      };
    } catch (e) {
      results.audits.linkProfile = { status: "ERROR", error: e.message };
    }

    // ========== 10. SECURITY & SPAM CHECK (replaces Spam Score) ==========
    try {
      const headResponse = await axios.head(url, { timeout: 10000 });
      const headers = headResponse.headers;
      const securityChecks = {
        https: url.startsWith("https://"),
        hsts: !!headers["strict-transport-security"],
        xFrameOptions: !!headers["x-frame-options"],
        xContentType: !!headers["x-content-type-options"],
        csp: !!headers["content-security-policy"],
      };
      const passed = Object.values(securityChecks).filter(Boolean).length;
      const total = Object.keys(securityChecks).length;

      results.audits.securityCheck = {
        ...securityChecks,
        score: Math.round((passed / total) * 100),
        passed,
        total,
        status: passed >= 3 ? "PASS" : "WARN",
      };
    } catch (e) {
      results.audits.securityCheck = { status: "ERROR", error: e.message };
    }

    // ========== 11. READABILITY SCORE (replaces Article Rewriting) ==========
    try {
      const readText = $("body").text().replace(/\s+/g, " ").trim();
      const readWords = readText.split(/\s+/).filter((w) => w.length > 0);
      const readSentences = readText
        .split(/[.!?]+/)
        .filter((s) => s.trim().length > 3);
      const syllableCount = readWords.reduce((sum, word) => {
        // Simple syllable estimation
        const w = word.toLowerCase().replace(/[^a-z]/g, "");
        if (w.length <= 3) return sum + 1;
        let count = w
          .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
          .replace(/^y/, "")
          .match(/[aeiouy]{1,2}/g);
        return sum + (count ? count.length : 1);
      }, 0);

      const avgWordsPerSentence =
        readSentences.length > 0 ? readWords.length / readSentences.length : 0;
      const avgSyllablesPerWord =
        readWords.length > 0 ? syllableCount / readWords.length : 0;

      // Flesch Reading Ease: 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
      const fleschScore = Math.round(
        206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord,
      );
      const clampedScore = Math.max(0, Math.min(100, fleschScore));

      let level = "Very Difficult";
      if (clampedScore >= 80) level = "Easy";
      else if (clampedScore >= 60) level = "Standard";
      else if (clampedScore >= 40) level = "Fairly Difficult";
      else if (clampedScore >= 20) level = "Difficult";

      results.audits.readability = {
        fleschScore: clampedScore,
        level,
        avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
        avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 10) / 10,
        status: clampedScore >= 50 ? "PASS" : "WARN",
      };
    } catch (e) {
      results.audits.readability = { status: "ERROR", error: e.message };
    }

    // ========== 12. OPEN GRAPH & SOCIAL TAGS ==========
    try {
      const freshHtml2 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $og = cheerio.load(freshHtml2);

      const ogTags = {
        ogTitle: $og('meta[property="og:title"]').attr("content") || null,
        ogDescription:
          $og('meta[property="og:description"]').attr("content") || null,
        ogImage: $og('meta[property="og:image"]').attr("content") || null,
        ogUrl: $og('meta[property="og:url"]').attr("content") || null,
        ogType: $og('meta[property="og:type"]').attr("content") || null,
        twitterCard: $og('meta[name="twitter:card"]').attr("content") || null,
        twitterTitle: $og('meta[name="twitter:title"]').attr("content") || null,
      };

      const present = Object.values(ogTags).filter(Boolean).length;
      const total = Object.keys(ogTags).length;

      results.audits.openGraph = {
        ...ogTags,
        tagsFound: present,
        tagsTotal: total,
        status: present >= 3 ? "PASS" : "WARN",
      };
    } catch (e) {
      results.audits.openGraph = { status: "ERROR", error: e.message };
    }

    // ========== 13. SSL CERTIFICATE CHECK ==========
    try {
      if (url.startsWith("https://")) {
        const sslData = await new Promise((resolve, reject) => {
          const urlObj = new URL(url);
          const req = https.request(
            {
              hostname: urlObj.hostname,
              port: 443,
              method: "HEAD",
              rejectUnauthorized: false,
            },
            (res) => {
              const cert = res.socket.getPeerCertificate();
              if (cert && cert.valid_to) {
                const expiryDate = new Date(cert.valid_to);
                const daysLeft = Math.ceil(
                  (expiryDate - Date.now()) / (1000 * 60 * 60 * 24),
                );
                resolve({
                  issuer: cert.issuer?.O || cert.issuer?.CN || "Unknown",
                  validFrom: cert.valid_from,
                  validTo: cert.valid_to,
                  daysUntilExpiry: daysLeft,
                  subject: cert.subject?.CN || "Unknown",
                  status:
                    daysLeft > 30 ? "PASS" : daysLeft > 0 ? "WARN" : "FAIL",
                });
              } else {
                resolve({
                  status: "WARN",
                  error: "Could not read certificate",
                });
              }
            },
          );
          req.on("error", (e) =>
            resolve({ status: "ERROR", error: e.message }),
          );
          req.setTimeout(10000, () => {
            req.destroy();
            resolve({ status: "ERROR", error: "Timeout" });
          });
          req.end();
        });
        results.audits.sslCertificate = sslData;
      } else {
        results.audits.sslCertificate = {
          status: "FAIL",
          error: "Site not using HTTPS",
        };
      }
    } catch (e) {
      results.audits.sslCertificate = { status: "ERROR", error: e.message };
    }

    // ========== 14. STRUCTURED DATA (Schema.org / JSON-LD) ==========
    try {
      const freshHtml3 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $sd = cheerio.load(freshHtml3);
      const jsonLdScripts = [];
      $sd('script[type="application/ld+json"]').each((i, el) => {
        try {
          const parsed = JSON.parse($sd(el).html());
          jsonLdScripts.push({
            type: parsed["@type"] || "Unknown",
            name: parsed.name || parsed.headline || null,
          });
        } catch (e) {
          /* skip invalid JSON-LD */
        }
      });

      const hasMicrodata = $sd("[itemscope]").length > 0;
      const microdataTypes = [];
      $sd("[itemtype]").each((i, el) => {
        microdataTypes.push($sd(el).attr("itemtype"));
      });

      results.audits.structuredData = {
        jsonLdCount: jsonLdScripts.length,
        jsonLdTypes: jsonLdScripts,
        hasMicrodata,
        microdataTypes: microdataTypes.slice(0, 10),
        status: jsonLdScripts.length > 0 || hasMicrodata ? "PASS" : "WARN",
      };
    } catch (e) {
      results.audits.structuredData = { status: "ERROR", error: e.message };
    }

    // ========== 15. MOBILE-FRIENDLINESS ==========
    try {
      const freshHtml4 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $mob = cheerio.load(freshHtml4);
      const viewport = $mob('meta[name="viewport"]').attr("content") || "";
      const hasViewport = viewport.length > 0;
      const hasWidthDevice = viewport.includes("width=device-width");
      const hasInitialScale = viewport.includes("initial-scale=");

      // Check for fixed-width elements
      const fixedWidthElements = [];
      $mob("[style]").each((i, el) => {
        const style = $mob(el).attr("style") || "";
        if (
          style.match(/width:\s*\d{4,}px/) ||
          style.match(/min-width:\s*\d{4,}px/)
        ) {
          fixedWidthElements.push($mob(el).prop("tagName"));
        }
      });

      // Touch targets (small links/buttons)
      const smallFontTags = $mob("*[style*='font-size']").filter((i, el) => {
        const style = $mob(el).attr("style") || "";
        const match = style.match(/font-size:\s*(\d+)px/);
        return match && parseInt(match[1]) < 12;
      }).length;

      // Responsive CSS check
      const hasResponsiveCSS =
        freshHtml4.includes("@media") || $mob("link[media]").length > 0;

      let mobileScore = 0;
      if (hasViewport) mobileScore += 30;
      if (hasWidthDevice) mobileScore += 20;
      if (hasInitialScale) mobileScore += 10;
      if (fixedWidthElements.length === 0) mobileScore += 20;
      if (smallFontTags === 0) mobileScore += 10;
      if (hasResponsiveCSS) mobileScore += 10;

      results.audits.mobileFriendly = {
        hasViewport,
        hasWidthDevice,
        hasInitialScale,
        fixedWidthElements: fixedWidthElements.length,
        smallFontTags,
        hasResponsiveCSS,
        score: mobileScore,
        status: mobileScore >= 60 ? "PASS" : "WARN",
      };
    } catch (e) {
      results.audits.mobileFriendly = { status: "ERROR", error: e.message };
    }

    // ========== 16. CANONICAL URL CHECK ==========
    try {
      const freshHtml5 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $can = cheerio.load(freshHtml5);
      const canonical = $can('link[rel="canonical"]').attr("href");
      const urlObj = new URL(url);

      let isValid = false;
      let isSelf = false;
      if (canonical) {
        try {
          const canUrl = new URL(canonical, url);
          isValid = true;
          isSelf =
            canUrl.href === urlObj.href || canUrl.pathname === urlObj.pathname;
        } catch (e) {
          isValid = false;
        }
      }

      results.audits.canonicalUrl = {
        found: !!canonical,
        value: canonical || "Not set",
        isValid,
        isSelfReferencing: isSelf,
        status: canonical && isValid ? "PASS" : "WARN",
      };
    } catch (e) {
      results.audits.canonicalUrl = { status: "ERROR", error: e.message };
    }

    // ========== 17. PAGE STRUCTURE ANALYSIS ==========
    try {
      const freshHtml6 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $ps = cheerio.load(freshHtml6);

      const headings = {
        h1: $ps("h1").length,
        h2: $ps("h2").length,
        h3: $ps("h3").length,
        h4: $ps("h4").length,
        h5: $ps("h5").length,
        h6: $ps("h6").length,
      };
      const totalHeadings = Object.values(headings).reduce((a, b) => a + b, 0);

      results.audits.pageStructure = {
        headings,
        totalHeadings,
        forms: $ps("form").length,
        tables: $ps("table").length,
        iframes: $ps("iframe").length,
        lists: $ps("ul, ol").length,
        paragraphs: $ps("p").length,
        buttons: $ps("button, input[type=submit]").length,
        semanticTags: {
          header: $ps("header").length > 0,
          footer: $ps("footer").length > 0,
          main: $ps("main").length > 0,
          nav: $ps("nav").length > 0,
          article: $ps("article").length > 0,
          section: $ps("section").length > 0,
          aside: $ps("aside").length > 0,
        },
        status: headings.h1 >= 1 && totalHeadings >= 2 ? "PASS" : "WARN",
      };
    } catch (e) {
      results.audits.pageStructure = { status: "ERROR", error: e.message };
    }

    // ========== 18. REDIRECT CHAIN CHECK ==========
    try {
      const redirects = [];
      let currentUrl = url;
      for (let i = 0; i < 10; i++) {
        const resp = await axios.get(currentUrl, {
          maxRedirects: 0,
          validateStatus: (s) => s >= 200 && s < 400,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        });
        if (resp.status >= 300 && resp.status < 400 && resp.headers.location) {
          redirects.push({
            from: currentUrl,
            to: resp.headers.location,
            status: resp.status,
          });
          currentUrl = new URL(resp.headers.location, currentUrl).href;
        } else {
          break;
        }
      }

      results.audits.redirectChain = {
        redirectCount: redirects.length,
        chain: redirects,
        finalUrl: currentUrl,
        status: redirects.length <= 1 ? "PASS" : "WARN",
      };
    } catch (e) {
      // No redirects or error — that's fine
      results.audits.redirectChain = {
        redirectCount: 0,
        chain: [],
        finalUrl: url,
        status: "PASS",
      };
    }

    // ========== 19. FAVICON CHECK ==========
    try {
      const freshHtml7 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $fav = cheerio.load(freshHtml7);
      const faviconLinks = [];
      $fav('link[rel*="icon"]').each((i, el) => {
        faviconLinks.push({
          rel: $fav(el).attr("rel"),
          href: $fav(el).attr("href"),
          type: $fav(el).attr("type") || null,
          sizes: $fav(el).attr("sizes") || null,
        });
      });

      // Also check /favicon.ico
      let defaultFavicon = false;
      try {
        const favResp = await axios.head(new URL("/favicon.ico", url).href, {
          timeout: 5000,
        });
        defaultFavicon = favResp.status === 200;
      } catch (e) {
        defaultFavicon = false;
      }

      const hasAppleTouchIcon = $fav('link[rel="apple-touch-icon"]').length > 0;

      results.audits.favicon = {
        found: faviconLinks.length > 0 || defaultFavicon,
        linkTags: faviconLinks.length,
        defaultFaviconIco: defaultFavicon,
        hasAppleTouchIcon,
        icons: faviconLinks.slice(0, 5),
        status: faviconLinks.length > 0 || defaultFavicon ? "PASS" : "FAIL",
      };
    } catch (e) {
      results.audits.favicon = { status: "ERROR", error: e.message };
    }

    // ========== 20. LANGUAGE & HREFLANG TAGS ==========
    try {
      const freshHtml8 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $lang = cheerio.load(freshHtml8);
      const htmlLang = $lang("html").attr("lang") || null;
      const contentLanguage =
        $lang('meta[http-equiv="content-language"]').attr("content") || null;

      const hreflangTags = [];
      $lang('link[rel="alternate"][hreflang]').each((i, el) => {
        hreflangTags.push({
          lang: $lang(el).attr("hreflang"),
          href: $lang(el).attr("href"),
        });
      });

      results.audits.language = {
        htmlLang,
        contentLanguage,
        hreflangCount: hreflangTags.length,
        hreflangTags: hreflangTags.slice(0, 10),
        hasXDefault: hreflangTags.some((t) => t.lang === "x-default"),
        status: htmlLang ? "PASS" : "WARN",
      };
    } catch (e) {
      results.audits.language = { status: "ERROR", error: e.message };
    }

    // ========== 21. DOM SIZE CHECK ==========
    try {
      const freshHtml9 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $dom = cheerio.load(freshHtml9);
      const totalElements = $dom("*").length;
      const maxDepth = (() => {
        let max = 0;
        $dom("*").each((i, el) => {
          let depth = 0;
          let node = el;
          while (node.parent) {
            depth++;
            node = node.parent;
          }
          if (depth > max) max = depth;
          if (i > 500) return false; // limit scan
        });
        return max;
      })();

      results.audits.domSize = {
        totalElements,
        maxDepth,
        status:
          totalElements <= 1500
            ? "PASS"
            : totalElements <= 3000
              ? "WARN"
              : "FAIL",
      };
    } catch (e) {
      results.audits.domSize = { status: "ERROR", error: e.message };
    }

    // ========== 22. JAVASCRIPT OPTIMIZATION ==========
    try {
      const freshHtml10 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $js = cheerio.load(freshHtml10);
      let totalScripts = 0,
        asyncScripts = 0,
        deferScripts = 0,
        inlineScripts = 0,
        renderBlocking = 0;

      $js("script").each((i, el) => {
        totalScripts++;
        const src = $js(el).attr("src");
        const hasAsync = $js(el).attr("async") !== undefined;
        const hasDefer = $js(el).attr("defer") !== undefined;
        const isModule = $js(el).attr("type") === "module";

        if (!src) {
          inlineScripts++;
          return;
        }
        if (hasAsync) asyncScripts++;
        else if (hasDefer || isModule) deferScripts++;
        else renderBlocking++;
      });

      results.audits.jsOptimization = {
        totalScripts,
        asyncScripts,
        deferScripts,
        inlineScripts,
        renderBlocking,
        inlineStyles: $js("style").length,
        inlineCssSize: (() => {
          let s = 0;
          $js("style").each((i, el) => {
            s += ($js(el).html() || "").length;
          });
          return Math.round(s / 1024);
        })(),
        inlineJsSize: (() => {
          let s = 0;
          $js("script:not([src])").each((i, el) => {
            s += ($js(el).html() || "").length;
          });
          return Math.round(s / 1024);
        })(),
        status: renderBlocking === 0 && inlineScripts <= 3 ? "PASS" : "WARN",
      };
    } catch (e) {
      results.audits.jsOptimization = { status: "ERROR", error: e.message };
    }

    // ========== 23. SOCIAL MEDIA LINKS ==========
    try {
      const freshHtml11 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $social = cheerio.load(freshHtml11);
      const socialPlatforms = {
        facebook: /facebook\.com/i,
        twitter: /twitter\.com|x\.com/i,
        instagram: /instagram\.com/i,
        linkedin: /linkedin\.com/i,
        youtube: /youtube\.com/i,
        pinterest: /pinterest\.com/i,
        tiktok: /tiktok\.com/i,
        github: /github\.com/i,
      };

      const found = {};
      $social("a[href]").each((i, el) => {
        const href = $social(el).attr("href") || "";
        for (const [platform, regex] of Object.entries(socialPlatforms)) {
          if (regex.test(href) && !found[platform]) {
            found[platform] = href;
          }
        }
      });

      const platformCount = Object.keys(found).length;
      results.audits.socialLinks = {
        platforms: found,
        count: platformCount,
        status: platformCount >= 2 ? "PASS" : "WARN",
      };
    } catch (e) {
      results.audits.socialLinks = { status: "ERROR", error: e.message };
    }

    // ========== 24. ANALYTICS & TRACKING DETECTION ==========
    try {
      const freshHtml12 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const analytics = {
        googleAnalytics:
          /google-analytics\.com|gtag|ga\('|analytics\.js|G-[A-Z0-9]+|UA-\d+/i.test(
            freshHtml12,
          ),
        googleTagManager: /googletagmanager\.com|GTM-[A-Z0-9]+/i.test(
          freshHtml12,
        ),
        facebookPixel: /fbq\(|facebook\.net\/|connect\.facebook/i.test(
          freshHtml12,
        ),
        hotjar: /hotjar\.com|hj\(/i.test(freshHtml12),
        clarity: /clarity\.ms/i.test(freshHtml12),
        plausible: /plausible\.io/i.test(freshHtml12),
        matomo: /matomo|piwik/i.test(freshHtml12),
      };

      const detected = Object.entries(analytics)
        .filter(([, v]) => v)
        .map(([k]) => k);
      results.audits.analyticsDetection = {
        ...analytics,
        detected,
        count: detected.length,
        status: detected.length > 0 ? "PASS" : "WARN",
      };
    } catch (e) {
      results.audits.analyticsDetection = { status: "ERROR", error: e.message };
    }

    // ========== 25. DEPRECATED HTML CHECK ==========
    try {
      const freshHtml13 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $dep = cheerio.load(freshHtml13);
      const deprecatedTags = [
        "font",
        "center",
        "marquee",
        "blink",
        "strike",
        "big",
        "tt",
        "frame",
        "frameset",
        "applet",
        "basefont",
        "dir",
        "isindex",
      ];
      const found = {};
      for (const tag of deprecatedTags) {
        const count = $dep(tag).length;
        if (count > 0) found[tag] = count;
      }

      // Check deprecated attributes
      const deprecatedAttrs = [];
      $dep("[bgcolor]").length > 0 && deprecatedAttrs.push("bgcolor");
      $dep("[align]").length > 0 && deprecatedAttrs.push("align");
      $dep("[valign]").length > 0 && deprecatedAttrs.push("valign");
      $dep("body[background]").length > 0 && deprecatedAttrs.push("background");
      $dep("[border]").not("table").length > 0 &&
        deprecatedAttrs.push("border");

      results.audits.deprecatedHtml = {
        deprecatedTags: found,
        deprecatedTagCount: Object.keys(found).length,
        deprecatedAttrs,
        deprecatedAttrCount: deprecatedAttrs.length,
        status:
          Object.keys(found).length === 0 && deprecatedAttrs.length === 0
            ? "PASS"
            : "WARN",
      };
    } catch (e) {
      results.audits.deprecatedHtml = { status: "ERROR", error: e.message };
    }

    // ========== 26. COMPRESSION CHECK (Gzip/Brotli) ==========
    try {
      const compResp = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)",
          "Accept-Encoding": "gzip, deflate, br",
        },
        timeout: 10000,
        decompress: false,
        responseType: "arraybuffer",
      });
      const contentEncoding = compResp.headers["content-encoding"] || "none";
      const rawSize = compResp.data.byteLength;
      const contentLength = parseInt(
        compResp.headers["content-length"] || rawSize,
      );

      results.audits.compression = {
        encoding: contentEncoding,
        isCompressed: contentEncoding !== "none",
        compressedSizeKB: Math.round(rawSize / 1024),
        status: contentEncoding !== "none" ? "PASS" : "WARN",
      };
    } catch (e) {
      results.audits.compression = { status: "ERROR", error: e.message };
    }

    // ========== 27. HTTP HEADERS ANALYSIS ==========
    try {
      const headerResp = await axios.head(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
        timeout: 10000,
      });
      const h = headerResp.headers;

      results.audits.httpHeaders = {
        cacheControl: h["cache-control"] || "Not set",
        hasCacheControl: !!h["cache-control"],
        etag: h["etag"] ? "Present" : "Not set",
        hasEtag: !!h["etag"],
        expires: h["expires"] || "Not set",
        server: h["server"] || "Hidden",
        poweredBy: h["x-powered-by"] || "Hidden",
        serverHidden: !h["server"],
        poweredByHidden: !h["x-powered-by"],
        status:
          (!!h["cache-control"] || !!h["etag"]) && !h["x-powered-by"]
            ? "PASS"
            : "WARN",
      };
    } catch (e) {
      results.audits.httpHeaders = { status: "ERROR", error: e.message };
    }

    // ========== 28. CUSTOM 404 PAGE CHECK ==========
    try {
      const random404 = `${url.replace(/\/$/, "")}/this-page-does-not-exist-${Date.now()}`;
      const resp404 = await axios.get(random404, {
        validateStatus: () => true,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
        timeout: 10000,
      });

      const is404 = resp404.status === 404;
      const hasContent = resp404.data && resp404.data.length > 200;
      const $404 = cheerio.load(resp404.data || "");
      const has404Text = /404|not found|page.*not.*found|doesn.*exist/i.test(
        $404("body").text(),
      );

      results.audits.custom404 = {
        returns404Status: is404,
        httpStatus: resp404.status,
        hasCustomContent: hasContent && has404Text,
        pageSize: resp404.data ? resp404.data.length : 0,
        status: is404 && hasContent ? "PASS" : is404 ? "WARN" : "FAIL",
      };
    } catch (e) {
      results.audits.custom404 = { status: "ERROR", error: e.message };
    }

    // ========== 29. IMAGE FORMATS CHECK ==========
    try {
      const freshHtml14 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $imgFmt = cheerio.load(freshHtml14);
      let totalImgs = 0,
        modernFormat = 0,
        oldFormat = 0;
      const oldFormatList = [];

      $imgFmt("img[src], source[srcset]").each((i, el) => {
        const src = $imgFmt(el).attr("src") || $imgFmt(el).attr("srcset") || "";
        totalImgs++;
        if (/\.(webp|avif|svg)/i.test(src)) modernFormat++;
        else if (/\.(jpg|jpeg|png|gif|bmp|tiff)/i.test(src)) {
          oldFormat++;
          if (oldFormatList.length < 5)
            oldFormatList.push(src.split("/").pop());
        }
      });

      // Also check <picture> sources
      $imgFmt("picture source[type]").each((i, el) => {
        const type = $imgFmt(el).attr("type") || "";
        if (type.includes("webp") || type.includes("avif")) modernFormat++;
      });

      results.audits.imageFormats = {
        totalImages: totalImgs,
        modernFormat,
        oldFormat,
        oldFormatList,
        status:
          totalImgs === 0 || oldFormat === 0
            ? "PASS"
            : modernFormat > oldFormat
              ? "WARN"
              : "FAIL",
      };
    } catch (e) {
      results.audits.imageFormats = { status: "ERROR", error: e.message };
    }

    // ========== 30. TAP TARGETS / CLICKABLE ELEMENTS ==========
    try {
      const freshHtml15 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $tap = cheerio.load(freshHtml15);
      let totalClickable = 0,
        smallTargets = 0;

      $tap(
        "a, button, input, select, textarea, [onclick], [role='button']",
      ).each((i, el) => {
        totalClickable++;
        const style = $tap(el).attr("style") || "";
        // Check for explicitly small sizing
        const heightMatch = style.match(/height:\s*(\d+)px/);
        const widthMatch = style.match(/width:\s*(\d+)px/);
        if (
          (heightMatch && parseInt(heightMatch[1]) < 44) ||
          (widthMatch && parseInt(widthMatch[1]) < 44)
        ) {
          smallTargets++;
        }
        // Check font-size too small for links
        const fontSize = style.match(/font-size:\s*(\d+)px/);
        if (fontSize && parseInt(fontSize[1]) < 11) smallTargets++;
      });

      // Check for adjacent links without spacing
      const adjacentLinks = $tap("a + a").length;

      results.audits.tapTargets = {
        totalClickable,
        smallTargets,
        adjacentLinks,
        status: smallTargets === 0 && adjacentLinks <= 3 ? "PASS" : "WARN",
      };
    } catch (e) {
      results.audits.tapTargets = { status: "ERROR", error: e.message };
    }

    // ========== 31. DUPLICATE H1 CHECK ==========
    try {
      const freshHtml16 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $h1 = cheerio.load(freshHtml16);
      const h1Tags = [];
      $h1("h1").each((i, el) => {
        h1Tags.push($h1(el).text().trim());
      });

      const h1Count = h1Tags.length;
      const isDuplicate = h1Count > 1 && new Set(h1Tags).size < h1Count;

      results.audits.duplicateH1 = {
        count: h1Count,
        tags: h1Tags.slice(0, 5),
        hasDuplicates: isDuplicate,
        status: h1Count === 1 ? "PASS" : h1Count === 0 ? "WARN" : "FAIL",
      };
    } catch (e) {
      results.audits.duplicateH1 = { status: "ERROR", error: e.message };
    }

    // ========== 32. TITLE & DESCRIPTION LENGTH CHECK ==========
    try {
      const freshHtml17 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $td = cheerio.load(freshHtml17);
      const tdTitle = $td("title").text().trim();
      const tdDesc = $td('meta[name="description"]').attr("content") || "";

      const titleLen = tdTitle.length;
      const descLen = tdDesc.length;
      const titleOk = titleLen >= 30 && titleLen <= 60;
      const descOk = descLen >= 120 && descLen <= 160;

      results.audits.titleDescLength = {
        title: tdTitle,
        titleLength: titleLen,
        titleOptimal: titleOk,
        titleIssue:
          titleLen < 30 ? "Too short" : titleLen > 60 ? "Too long" : "OK",
        description:
          tdDesc.substring(0, 80) + (tdDesc.length > 80 ? "..." : ""),
        descLength: descLen,
        descOptimal: descOk,
        descIssue:
          descLen < 120 ? "Too short" : descLen > 160 ? "Too long" : "OK",
        status: titleOk && descOk ? "PASS" : "WARN",
      };
    } catch (e) {
      results.audits.titleDescLength = { status: "ERROR", error: e.message };
    }

    // ========== 33. INDEXABILITY CHECK ==========
    try {
      const freshHtml18 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
          validateStatus: () => true,
        })
      ).data;
      const $idx = cheerio.load(freshHtml18);
      const robotsMeta = $idx('meta[name="robots"]').attr("content") || "";
      const hasNoindex = robotsMeta.toLowerCase().includes("noindex");
      const hasNofollow = robotsMeta.toLowerCase().includes("nofollow");
      const canonicalTag = $idx('link[rel="canonical"]').attr("href") || "";
      const canonicalMismatch =
        canonicalTag &&
        !url.startsWith(canonicalTag) &&
        !canonicalTag.startsWith(url.replace(/\/$/, ""));

      // Check X-Robots-Tag header
      let xRobotsTag = "";
      try {
        const headResp = await axios.head(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 5000,
        });
        xRobotsTag = headResp.headers["x-robots-tag"] || "";
      } catch (e) {
        /* ignore */
      }

      const headerNoindex = xRobotsTag.toLowerCase().includes("noindex");

      results.audits.indexability = {
        robotsMeta,
        hasNoindex,
        hasNofollow,
        headerNoindex,
        xRobotsTag,
        canonicalTag: canonicalTag || "Not set",
        canonicalMismatch,
        status:
          hasNoindex || headerNoindex
            ? "FAIL"
            : canonicalMismatch
              ? "WARN"
              : "PASS",
      };
    } catch (e) {
      results.audits.indexability = { status: "ERROR", error: e.message };
    }

    // ========== 34. CLS RISK FACTORS ==========
    try {
      const freshHtml19 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $cls = cheerio.load(freshHtml19);
      let imagesWithoutDimensions = 0;
      let totalImgsCls = 0;
      const missingDimList = [];

      $cls("img").each((i, el) => {
        totalImgsCls++;
        const w = $cls(el).attr("width");
        const h = $cls(el).attr("height");
        if (!w || !h) {
          imagesWithoutDimensions++;
          if (missingDimList.length < 3)
            missingDimList.push(
              $cls(el).attr("src")?.split("/").pop() || "unknown",
            );
        }
      });

      // Late-loading CSS (CSS in body)
      const cssInBody = $cls("body link[rel='stylesheet']").length;
      // Fonts without display swap
      const fontLinks = $cls("link[href*='fonts']").length;

      results.audits.clsRisk = {
        imagesWithoutDimensions,
        totalImages: totalImgsCls,
        missingDimList,
        cssInBody,
        fontLinks,
        status:
          imagesWithoutDimensions === 0 && cssInBody === 0 ? "PASS" : "WARN",
      };
    } catch (e) {
      results.audits.clsRisk = { status: "ERROR", error: e.message };
    }

    // ========== 35. LAZY LOADING CHECK ==========
    try {
      const freshHtml20 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $lazy = cheerio.load(freshHtml20);
      let totalImgsLazy = 0,
        lazyLoaded = 0,
        eagerLoaded = 0,
        noLoading = 0;
      let hasFetchPriority = false;

      $lazy("img").each((i, el) => {
        totalImgsLazy++;
        const loading = $lazy(el).attr("loading");
        const priority = $lazy(el).attr("fetchpriority");
        if (loading === "lazy") lazyLoaded++;
        else if (loading === "eager") eagerLoaded++;
        else noLoading++;
        if (priority) hasFetchPriority = true;
      });

      // Check iframes too
      let lazyIframes = 0,
        totalIframesLazy = 0;
      $lazy("iframe").each((i, el) => {
        totalIframesLazy++;
        if ($lazy(el).attr("loading") === "lazy") lazyIframes++;
      });

      results.audits.lazyLoading = {
        totalImages: totalImgsLazy,
        lazyLoaded,
        eagerLoaded,
        noLoadingAttr: noLoading,
        hasFetchPriority,
        lazyIframes,
        totalIframes: totalIframesLazy,
        status:
          totalImgsLazy === 0 || lazyLoaded > 0 || totalImgsLazy <= 2
            ? "PASS"
            : "WARN",
      };
    } catch (e) {
      results.audits.lazyLoading = { status: "ERROR", error: e.message };
    }

    // ========== 36. CONTENT FRESHNESS ==========
    try {
      let lastModified = null;
      try {
        const headResp = await axios.head(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 5000,
        });
        lastModified = headResp.headers["last-modified"] || null;
      } catch (e) {
        /* ignore */
      }

      const freshHtml21 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $fresh = cheerio.load(freshHtml21);

      // Check schema dates
      let datePublished = null,
        dateModified = null;
      $fresh('script[type="application/ld+json"]').each((i, el) => {
        try {
          const json = JSON.parse($fresh(el).html());
          const items = Array.isArray(json) ? json : [json];
          items.forEach((item) => {
            if (item.datePublished) datePublished = item.datePublished;
            if (item.dateModified) dateModified = item.dateModified;
          });
        } catch (e) {
          /* ignore */
        }
      });

      // Check time/date elements
      const timeElements = $fresh("time[datetime]").length;

      const daysSinceModified = lastModified
        ? Math.round(
            (Date.now() - new Date(lastModified).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : null;

      results.audits.contentFreshness = {
        lastModifiedHeader: lastModified,
        daysSinceModified,
        datePublished,
        dateModified,
        timeElements,
        status:
          dateModified ||
          datePublished ||
          (daysSinceModified !== null && daysSinceModified < 180)
            ? "PASS"
            : "WARN",
      };
    } catch (e) {
      results.audits.contentFreshness = { status: "ERROR", error: e.message };
    }

    // ========== 37. E-E-A-T SIGNALS ==========
    try {
      const freshHtml22 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $eeat = cheerio.load(freshHtml22);
      const allLinks = [];
      $eeat("a[href]").each((i, el) =>
        allLinks.push(($eeat(el).attr("href") || "").toLowerCase()),
      );

      const hasAboutPage = allLinks.some((h) =>
        /about|about-us|who-we-are/i.test(h),
      );
      const hasContactPage = allLinks.some((h) =>
        /contact|contact-us|get-in-touch/i.test(h),
      );
      const hasPrivacyPage = allLinks.some((h) =>
        /privacy|privacy-policy/i.test(h),
      );
      const hasTermsPage = allLinks.some((h) =>
        /terms|terms-of-service|tos/i.test(h),
      );

      // Author detection
      let hasAuthorSchema = false;
      $eeat('script[type="application/ld+json"]').each((i, el) => {
        try {
          const json = JSON.parse($eeat(el).html());
          const items = Array.isArray(json) ? json : [json];
          items.forEach((item) => {
            if (item.author || item["@type"] === "Person")
              hasAuthorSchema = true;
          });
        } catch (e) {
          /* ignore */
        }
      });

      const hasAuthorMeta = $eeat('meta[name="author"]').length > 0;
      const hasAuthorByline =
        $eeat('[class*="author"], [rel="author"], .byline, .author').length > 0;

      const signals = [
        hasAboutPage,
        hasContactPage,
        hasPrivacyPage,
        hasAuthorSchema || hasAuthorMeta || hasAuthorByline,
      ].filter(Boolean).length;

      results.audits.eeatSignals = {
        hasAboutPage,
        hasContactPage,
        hasPrivacyPage,
        hasTermsPage,
        hasAuthorSchema,
        hasAuthorMeta,
        hasAuthorByline,
        signalCount: signals,
        status: signals >= 3 ? "PASS" : signals >= 1 ? "WARN" : "FAIL",
      };
    } catch (e) {
      results.audits.eeatSignals = { status: "ERROR", error: e.message };
    }

    // ========== 38. ACCESSIBILITY BASICS ==========
    try {
      const freshHtml23 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $a11y = cheerio.load(freshHtml23);

      // ARIA roles
      const ariaRoles = $a11y("[role]").length;
      const ariaLabels = $a11y("[aria-label], [aria-labelledby]").length;

      // Form labels
      let formsWithoutLabels = 0;
      $a11y(
        "input:not([type='hidden']):not([type='submit']):not([type='button'])",
      ).each((i, el) => {
        const id = $a11y(el).attr("id");
        const ariaLabel = $a11y(el).attr("aria-label");
        const placeholder = $a11y(el).attr("placeholder");
        if (
          !ariaLabel &&
          !placeholder &&
          (!id || $a11y(`label[for="${id}"]`).length === 0)
        ) {
          formsWithoutLabels++;
        }
      });

      // Focus outline removal detection
      const cssContent = freshHtml23.toLowerCase();
      const focusOutlineRemoved =
        cssContent.includes("outline: none") ||
        cssContent.includes("outline:none") ||
        cssContent.includes("outline: 0");

      // Skip links
      const hasSkipLink =
        $a11y(
          'a[href="#main"], a[href="#content"], .skip-link, .skip-to-content',
        ).length > 0;

      // Lang attribute
      const hasLangAttr = !!$a11y("html").attr("lang");

      const score = [
        ariaRoles > 0,
        formsWithoutLabels === 0,
        !focusOutlineRemoved,
        hasLangAttr,
      ].filter(Boolean).length;

      results.audits.accessibilityBasics = {
        ariaRoles,
        ariaLabels,
        formsWithoutLabels,
        focusOutlineRemoved,
        hasSkipLink,
        hasLangAttr,
        score,
        status: score >= 3 ? "PASS" : score >= 2 ? "WARN" : "FAIL",
      };
    } catch (e) {
      results.audits.accessibilityBasics = {
        status: "ERROR",
        error: e.message,
      };
    }

    // ========== 39. URL STRUCTURE ==========
    try {
      const parsedUrl = new URL(url);
      const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
      const urlLength = url.length;
      const hasParams = parsedUrl.search.length > 0;
      const paramCount = [...parsedUrl.searchParams].length;
      const hasCleanUrl =
        !/[A-Z]/.test(parsedUrl.pathname) &&
        !/[_]/.test(parsedUrl.pathname) &&
        !/%20/.test(parsedUrl.pathname);
      const pathDepth = pathSegments.length;
      const hasTrailingSlash =
        parsedUrl.pathname.endsWith("/") && parsedUrl.pathname !== "/";
      const hasFileExtension =
        /\.\w{2,4}$/.test(parsedUrl.pathname) &&
        !/\.(html|htm|php|asp)$/i.test(parsedUrl.pathname);

      results.audits.urlStructure = {
        urlLength,
        pathDepth,
        paramCount,
        hasCleanUrl,
        hasTrailingSlash,
        hasFileExtension,
        hasParams,
        status:
          urlLength <= 75 && pathDepth <= 4 && hasCleanUrl && paramCount === 0
            ? "PASS"
            : "WARN",
      };
    } catch (e) {
      results.audits.urlStructure = { status: "ERROR", error: e.message };
    }

    // ========== 40. BREADCRUMB SCHEMA ==========
    try {
      const freshHtml24 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $bc = cheerio.load(freshHtml24);
      let hasBreadcrumbSchema = false;
      let breadcrumbItems = 0;

      $bc('script[type="application/ld+json"]').each((i, el) => {
        try {
          const json = JSON.parse($bc(el).html());
          const items = Array.isArray(json) ? json : [json];
          items.forEach((item) => {
            if (item["@type"] === "BreadcrumbList") {
              hasBreadcrumbSchema = true;
              breadcrumbItems = (item.itemListElement || []).length;
            }
          });
        } catch (e) {
          /* ignore */
        }
      });

      // Also check for HTML breadcrumbs
      const hasBreadcrumbNav =
        $bc(
          '[class*="breadcrumb"], nav[aria-label*="breadcrumb"], .breadcrumbs, ol.breadcrumb',
        ).length > 0;

      results.audits.breadcrumbSchema = {
        hasBreadcrumbSchema,
        breadcrumbItems,
        hasBreadcrumbNav,
        status: hasBreadcrumbSchema
          ? "PASS"
          : hasBreadcrumbNav
            ? "WARN"
            : "WARN",
      };
    } catch (e) {
      results.audits.breadcrumbSchema = { status: "ERROR", error: e.message };
    }

    // ========== 41. COOKIE CONSENT ==========
    try {
      const freshHtml25 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const htmlLower = freshHtml25.toLowerCase();

      const consentPatterns = [
        "cookieconsent",
        "cookie-consent",
        "cookie-banner",
        "cookiebanner",
        "gdpr",
        "cookie-notice",
        "cookie-policy",
        "cc-banner",
        "onetrust",
        "cookiebot",
        "iubenda",
        "trustarc",
        "termly",
        "quantcast",
        "didomi",
        "usercentrics",
      ];

      const detected = consentPatterns.filter((p) => htmlLower.includes(p));
      const hasCookieConsent = detected.length > 0;

      results.audits.cookieConsent = {
        detected: detected.slice(0, 5),
        hasCookieConsent,
        status: hasCookieConsent ? "PASS" : "WARN",
      };
    } catch (e) {
      results.audits.cookieConsent = { status: "ERROR", error: e.message };
    }

    // ========== 42. ENTITY SCHEMA DEPTH ==========
    try {
      const freshHtml26 = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $ent = cheerio.load(freshHtml26);
      const schemaTypes = {};

      $ent('script[type="application/ld+json"]').each((i, el) => {
        try {
          const json = JSON.parse($ent(el).html());
          const processItem = (item) => {
            if (item["@type"]) {
              const type = Array.isArray(item["@type"])
                ? item["@type"].join(", ")
                : item["@type"];
              schemaTypes[type] = (schemaTypes[type] || 0) + 1;
            }
            if (item["@graph"]) item["@graph"].forEach(processItem);
          };
          if (Array.isArray(json)) json.forEach(processItem);
          else processItem(json);
        } catch (e) {
          /* ignore */
        }
      });

      const importantTypes = [
        "Organization",
        "Person",
        "Product",
        "FAQ",
        "FAQPage",
        "HowTo",
        "Article",
        "NewsArticle",
        "BlogPosting",
        "BreadcrumbList",
        "WebSite",
        "WebPage",
        "LocalBusiness",
      ];
      const foundImportant = importantTypes.filter((t) => schemaTypes[t]);
      const totalTypes = Object.keys(schemaTypes).length;

      results.audits.entitySchema = {
        allTypes: schemaTypes,
        totalTypes,
        importantFound: foundImportant,
        importantCount: foundImportant.length,
        status:
          foundImportant.length >= 3
            ? "PASS"
            : foundImportant.length >= 1
              ? "WARN"
              : "FAIL",
      };
    } catch (e) {
      results.audits.entitySchema = { status: "ERROR", error: e.message };
    }

    // ========== BROKEN LINKS CHECK ==========
    try {
      console.log("[Audit] Checking for broken links...");
      const freshHtmlBL = (
        await axios.get(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
          timeout: 10000,
        })
      ).data;
      const $bl = cheerio.load(freshHtmlBL);
      const baseUrl = new URL(url);
      const allLinks = [];

      $bl("a[href]").each((i, el) => {
        const href = ($bl(el).attr("href") || "").trim();
        if (
          !href ||
          href.startsWith("#") ||
          href.startsWith("mailto:") ||
          href.startsWith("tel:") ||
          href.startsWith("javascript:")
        )
          return;
        try {
          const resolved = new URL(href, baseUrl.origin).href;
          if (!allLinks.includes(resolved)) allLinks.push(resolved);
        } catch (e) {
          /* skip malformed */
        }
      });

      // Check up to 50 links with HEAD requests
      const linksToCheck = allLinks.slice(0, 50);
      const brokenList = [];
      const agent = new https.Agent({ rejectUnauthorized: false });

      await Promise.allSettled(
        linksToCheck.map(async (link) => {
          try {
            const resp = await axios.head(link, {
              timeout: 8000,
              maxRedirects: 5,
              validateStatus: () => true,
              httpsAgent: agent,
              headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
            });
            if (resp.status >= 400) {
              brokenList.push({ url: link, status: resp.status });
            }
          } catch (e) {
            // Try GET as fallback (some servers reject HEAD)
            try {
              const resp2 = await axios.get(link, {
                timeout: 8000,
                maxRedirects: 5,
                validateStatus: () => true,
                httpsAgent: agent,
                headers: {
                  "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)",
                },
              });
              if (resp2.status >= 400) {
                brokenList.push({ url: link, status: resp2.status });
              }
            } catch (e2) {
              brokenList.push({ url: link, status: "TIMEOUT" });
            }
          }
        }),
      );

      results.audits.brokenLinks = {
        totalChecked: linksToCheck.length,
        totalOnPage: allLinks.length,
        brokenCount: brokenList.length,
        brokenLinks: brokenList.slice(0, 20),
        status: brokenList.length === 0 ? "PASS" : "FAIL",
      };
      console.log(
        `[Audit] Broken links: ${brokenList.length}/${linksToCheck.length} checked`,
      );
    } catch (e) {
      results.audits.brokenLinks = { status: "ERROR", error: e.message };
    }

    // ========== SITE CRAWL (Mini-Crawler) ==========
    try {
      console.log("[Audit] Starting mini-crawler...");
      const crawlBaseUrl = new URL(url);
      const crawlDomain = crawlBaseUrl.hostname;

      // Extract internal links from already-fetched HTML
      const internalPaths = new Set();
      $("a[href]").each((i, el) => {
        const href = ($(el).attr("href") || "").trim();
        if (
          !href ||
          href.startsWith("#") ||
          href.startsWith("mailto:") ||
          href.startsWith("tel:") ||
          href.startsWith("javascript:")
        )
          return;
        try {
          const resolved = new URL(href, crawlBaseUrl.origin);
          if (
            resolved.hostname === crawlDomain &&
            resolved.pathname !== crawlBaseUrl.pathname
          ) {
            internalPaths.add(resolved.origin + resolved.pathname);
          }
        } catch (e) {
          /* skip */
        }
      });

      // Pick top 5 unique internal pages
      const pagesToCrawl = [...internalPaths].slice(0, 5);
      console.log(
        `[Audit] Found ${internalPaths.size} internal links, crawling ${pagesToCrawl.length}...`,
      );

      const crawledPages = [];
      const allTitles = [];
      const allDescs = [];

      // Add homepage data first
      const homeTitle = $("title").text().trim();
      const homeMeta = $('meta[name="description"]').attr("content") || "";
      allTitles.push({ url: url, title: homeTitle });
      allDescs.push({ url: url, desc: homeMeta });
      crawledPages.push({
        url: url,
        status: 200,
        loadTime: loadTime,
        title: homeTitle,
        metaDesc: homeMeta,
        isHome: true,
      });

      // Crawl each sub-page
      const crawlAgent = new https.Agent({ rejectUnauthorized: false });
      await Promise.allSettled(
        pagesToCrawl.map(async (pageUrl) => {
          const pageStart = Date.now();
          try {
            const resp = await axios.get(pageUrl, {
              timeout: 10000,
              maxRedirects: 5,
              httpsAgent: crawlAgent,
              headers: { "User-Agent": "Mozilla/5.0 (compatible; SeoBot/1.0)" },
              validateStatus: () => true,
            });
            const pageTime = Date.now() - pageStart;
            const pageHtml = resp.data;
            const $page = cheerio.load(
              typeof pageHtml === "string" ? pageHtml : "",
            );

            const pageTitle = $page("title").text().trim();
            const pageDesc =
              $page('meta[name="description"]').attr("content") || "";

            allTitles.push({ url: pageUrl, title: pageTitle });
            allDescs.push({ url: pageUrl, desc: pageDesc });

            crawledPages.push({
              url: pageUrl,
              status: resp.status,
              loadTime: pageTime,
              title: pageTitle || "(missing)",
              metaDesc: pageDesc || "(missing)",
              isHome: false,
            });
          } catch (e) {
            crawledPages.push({
              url: pageUrl,
              status: "ERROR",
              loadTime: Date.now() - pageStart,
              title: "(unreachable)",
              metaDesc: "(unreachable)",
              isHome: false,
              error: e.message,
            });
          }
        }),
      );

      // Detect duplicate titles
      const titleMap = {};
      allTitles.forEach(({ url: u, title }) => {
        if (title && title !== "(missing)") {
          if (!titleMap[title]) titleMap[title] = [];
          titleMap[title].push(u);
        }
      });
      const dupTitles = Object.entries(titleMap)
        .filter(([, urls]) => urls.length > 1)
        .map(([title, urls]) => ({ title, pages: urls }));

      // Detect duplicate descriptions
      const descMap = {};
      allDescs.forEach(({ url: u, desc }) => {
        if (desc && desc !== "(missing)") {
          if (!descMap[desc]) descMap[desc] = [];
          descMap[desc].push(u);
        }
      });
      const dupDescs = Object.entries(descMap)
        .filter(([, urls]) => urls.length > 1)
        .map(([desc, urls]) => ({
          desc: desc.substring(0, 80) + "...",
          pages: urls,
        }));

      // Pages missing titles or descriptions
      const missingTitles = crawledPages.filter(
        (p) => !p.title || p.title === "(missing)",
      ).length;
      const missingDescs = crawledPages.filter(
        (p) => !p.metaDesc || p.metaDesc === "(missing)",
      ).length;
      const brokenPages = crawledPages.filter(
        (p) => p.status !== 200 && p.status !== "ERROR",
      ).length;
      const errorPages = crawledPages.filter(
        (p) => p.status === "ERROR",
      ).length;

      const issues =
        dupTitles.length +
        dupDescs.length +
        missingTitles +
        missingDescs +
        brokenPages +
        errorPages;

      results.audits.siteCrawl = {
        totalInternalLinks: internalPaths.size,
        pagesCrawled: crawledPages.length,
        pages: crawledPages,
        duplicateTitles: dupTitles,
        duplicateDescriptions: dupDescs,
        missingTitles,
        missingDescriptions: missingDescs,
        brokenPages,
        errorPages,
        totalIssues: issues,
        status: issues === 0 ? "PASS" : "FAIL",
      };
      console.log(
        `[Audit] Mini-crawl done: ${crawledPages.length} pages, ${issues} issues`,
      );
    } catch (e) {
      results.audits.siteCrawl = {
        status: "ERROR",
        error: e.message,
        pages: [],
      };
    }

    console.log("[Audit] Complete for", url);
    console.log("[Audit] Scores:", results.scores);
    console.log("[Audit] Total checks:", Object.keys(results.audits).length);
  } catch (error) {
    console.error("[Audit] Failed for", url, error.message);
    results.errors.push({
      message: error.message,
      stack: error.stack,
    });
  }

  return results;
}
