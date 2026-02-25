// ============= GENERIC AUTO-CHECK HANDLER =============
// Handles checks 33-42 automatically via checkKey matching
function getGenericCheckStatus(item, report) {
  if (!report || !item.checkKey || !report.audits[item.checkKey]) return null;
  const a = report.audits[item.checkKey];

  // 33. Indexability
  if (item.checkKey === "indexability") {
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Noindex: ${a.hasNoindex ? "✗ YES" : "✓ No"} | Canonical: ${a.canonicalTag} | Mismatch: ${a.canonicalMismatch ? "✗" : "✓"}`,
    };
  }

  // 34. CLS Risk
  if (item.checkKey === "clsRisk") {
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Imgs w/o dimensions: ${a.imagesWithoutDimensions}/${a.totalImages} | CSS in body: ${a.cssInBody} | Font links: ${a.fontLinks}`,
    };
  }

  // 35. Lazy Loading
  if (item.checkKey === "lazyLoading") {
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Lazy: ${a.lazyLoaded}/${a.totalImages} imgs | Eager: ${a.eagerLoaded} | FetchPriority: ${a.hasFetchPriority ? "✓" : "✗"} | Iframes: ${a.lazyIframes}/${a.totalIframes}`,
    };
  }

  // 36. Content Freshness
  if (item.checkKey === "contentFreshness") {
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Modified: ${a.daysSinceModified != null ? a.daysSinceModified + " days ago" : "Unknown"} | Published: ${a.datePublished || "N/A"} | Updated: ${a.dateModified || "N/A"}`,
    };
  }

  // 37. E-E-A-T
  if (item.checkKey === "eeatSignals") {
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Signals: ${a.signalCount}/4 | About: ${a.hasAboutPage ? "✓" : "✗"} Contact: ${a.hasContactPage ? "✓" : "✗"} Privacy: ${a.hasPrivacyPage ? "✓" : "✗"} Author: ${a.hasAuthorSchema || a.hasAuthorMeta ? "✓" : "✗"}`,
    };
  }

  // 38. Accessibility
  if (item.checkKey === "accessibilityBasics") {
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Score: ${a.score}/4 | ARIA: ${a.ariaRoles} roles | Labels missing: ${a.formsWithoutLabels} | Focus outline: ${a.focusOutlineRemoved ? "✗ Removed" : "✓ OK"} | Lang: ${a.hasLangAttr ? "✓" : "✗"}`,
    };
  }

  // 39. URL Structure
  if (item.checkKey === "urlStructure") {
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Length: ${a.urlLength} chars | Depth: ${a.pathDepth} | Params: ${a.paramCount} | Clean: ${a.hasCleanUrl ? "✓" : "✗"}`,
    };
  }

  // 40. Breadcrumb
  if (item.checkKey === "breadcrumbSchema") {
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `JSON-LD: ${a.hasBreadcrumbSchema ? "✓" : "✗"} (${a.breadcrumbItems} items) | HTML nav: ${a.hasBreadcrumbNav ? "✓" : "✗"}`,
    };
  }

  // 41. Cookie Consent
  if (item.checkKey === "cookieConsent") {
    return {
      automated: true,
      pass: a.status === "PASS",
      details: a.hasCookieConsent
        ? `Detected: ${a.detected.join(", ")}`
        : "No cookie consent banner detected",
    };
  }

  // 42. Entity Schema
  if (item.checkKey === "entitySchema") {
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Types: ${a.totalTypes} | Important: ${a.importantCount} (${a.importantFound.join(", ") || "None"})`,
    };
  }

  return null;
}

export function getChecklistStatus(item, report) {
  if (!report) return { automated: false, pass: false, details: null };

  // 10. Website Speed
  if (item.task === "Website Speed") {
    const score = report.scores["performance"];
    return {
      automated: true,
      pass: score >= 90,
      details: `Speed Score: ${Math.round(score)}/100`,
    };
  }

  // 4. Meta Tags Check
  if (item.task === "Meta Tags Check" && report.audits["metaTags"]) {
    const audit = report.audits["metaTags"];
    return {
      automated: true,
      pass: audit.status === "PASS",
      details: `Title (${audit.titleLength} chars), Desc (${audit.descriptionLength} chars), H1: ${audit.h1Count || 0}, Lang: ${audit.hasLang ? "✓" : "✗"}, Viewport: ${audit.hasViewport ? "✓" : "✗"}`,
    };
  }

  // 1. Content Analysis
  if (item.task === "Content Analysis" && report.audits["contentAnalysis"]) {
    const a = report.audits["contentAnalysis"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Words: ${a.wordCount}, Unique: ${a.uniqueRatio}%, Sentences: ${a.sentenceCount}, Avg words/sentence: ${a.avgWordsPerSentence}`,
    };
  }

  // 3. Keyword Density
  if (item.task === "Keyword Density" && report.audits["keywordDensity"]) {
    const a = report.audits["keywordDensity"];
    const top3 = (a.topKeywords || [])
      .slice(0, 3)
      .map((k) => `${k.word} (${k.density})`)
      .join(", ");
    return {
      automated: true,
      pass: a.status === "PASS",
      details: a.stuffing
        ? `⚠️ Keyword stuffing detected! Top: ${top3}`
        : `Top keywords: ${top3 || "None found"}`,
    };
  }

  // Broken Links
  if (item.task === "Broken Links" && report.audits["brokenLinks"]) {
    const a = report.audits["brokenLinks"];
    const broken = (a.brokenLinks || [])
      .slice(0, 3)
      .map((l) => {
        const short =
          l.url.length > 40 ? l.url.substring(0, 40) + "..." : l.url;
        return `${short} (${l.status})`;
      })
      .join(", ");
    return {
      automated: true,
      pass: a.status === "PASS",
      details:
        a.brokenCount === 0
          ? `All ${a.totalChecked} links OK ✓`
          : `${a.brokenCount} broken out of ${a.totalChecked} checked: ${broken}`,
    };
  }

  // 5. Link Profile
  if (item.task === "Link Profile" && report.audits["linkProfile"]) {
    const a = report.audits["linkProfile"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Internal: ${a.internalLinks}, External: ${a.externalLinks}, Nofollow: ${a.nofollowLinks}, Domains: ${(a.externalDomains || []).length}`,
    };
  }

  // 6. Outbound Links (uses linkProfile)
  if (item.task === "Outbound Links" && report.audits["linkProfile"]) {
    const a = report.audits["linkProfile"];
    const domains = (a.externalDomains || []).slice(0, 5).join(", ");
    return {
      automated: true,
      pass: a.externalLinks > 0,
      details: `${a.externalLinks} outbound links → ${domains || "None"}`,
    };
  }

  // 7. Security Headers
  if (item.task === "Security Headers" && report.audits["securityCheck"]) {
    const a = report.audits["securityCheck"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Score: ${a.score}/100 | HTTPS: ${a.https ? "✓" : "✗"}, HSTS: ${a.hsts ? "✓" : "✗"}, CSP: ${a.csp ? "✓" : "✗"}, X-Frame: ${a.xFrameOptions ? "✓" : "✗"}`,
    };
  }

  // 8. Sitemap Generator
  if (item.task === "Sitemap Generator" && report.audits["sitemap"]) {
    const audit = report.audits["sitemap"];
    return {
      automated: true,
      pass: audit.exists,
      details: audit.exists ? "Sitemap found" : "Sitemap (404) not found",
    };
  }

  // 9. Robots.txt Gen
  if (item.task === "Robots.txt Gen" && report.audits["robots"]) {
    const audit = report.audits["robots"];
    return {
      automated: true,
      pass: audit.exists,
      details: audit.exists ? "Robots.txt found" : "Robots.txt (404) not found",
    };
  }

  // 11. Image Compression
  if (item.task === "Image Compression" && report.audits["images"]) {
    const audit = report.audits["images"];
    const pass = audit.missingAlt === 0;
    return {
      automated: true,
      pass: pass,
      details: pass
        ? "All images have alt tags"
        : `${audit.missingAlt} images missing alt tags`,
    };
  }

  // 2. Readability Score
  if (item.task === "Readability Score" && report.audits["readability"]) {
    const a = report.audits["readability"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Flesch: ${a.fleschScore}/100 (${a.level}) | Avg ${a.avgWordsPerSentence} words/sentence`,
    };
  }

  // 12. Open Graph Tags
  if (item.task === "Open Graph Tags" && report.audits["openGraph"]) {
    const a = report.audits["openGraph"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `${a.tagsFound}/${a.tagsTotal} tags found | OG Title: ${a.ogTitle ? "✓" : "✗"}, Image: ${a.ogImage ? "✓" : "✗"}, Twitter: ${a.twitterCard ? "✓" : "✗"}`,
    };
  }

  // 13. SSL Certificate
  if (item.task === "SSL Certificate" && report.audits["sslCertificate"]) {
    const a = report.audits["sslCertificate"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details:
        a.daysUntilExpiry != null
          ? `Issuer: ${a.issuer} | Expires: ${a.daysUntilExpiry} days | ${a.subject}`
          : `${a.error || "Check failed"}`,
    };
  }

  // 14. Structured Data
  if (item.task === "Structured Data" && report.audits["structuredData"]) {
    const a = report.audits["structuredData"];
    const types = (a.jsonLdTypes || []).map((t) => t.type).join(", ");
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `JSON-LD: ${a.jsonLdCount} (${types || "None"}) | Microdata: ${a.hasMicrodata ? "✓" : "✗"}`,
    };
  }

  // 15. Mobile-Friendly
  if (item.task === "Mobile-Friendly" && report.audits["mobileFriendly"]) {
    const a = report.audits["mobileFriendly"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Score: ${a.score}/100 | Viewport: ${a.hasViewport ? "✓" : "✗"}, Responsive: ${a.hasResponsiveCSS ? "✓" : "✗"}, Fixed-width: ${a.fixedWidthElements}`,
    };
  }

  // 16. Canonical URL
  if (item.task === "Canonical URL" && report.audits["canonicalUrl"]) {
    const a = report.audits["canonicalUrl"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details: a.found
        ? `${a.value} | Self: ${a.isSelfReferencing ? "✓" : "✗"}`
        : "Canonical tag not found",
    };
  }

  // 17. Page Structure
  if (item.task === "Page Structure" && report.audits["pageStructure"]) {
    const a = report.audits["pageStructure"];
    const h = a.headings || {};
    const sem = a.semanticTags || {};
    const semCount = Object.values(sem).filter(Boolean).length;
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `H1:${h.h1} H2:${h.h2} H3:${h.h3} | Semantic: ${semCount}/7 | P:${a.paragraphs} Lists:${a.lists}`,
    };
  }

  // 18. Redirect Chain
  if (item.task === "Redirect Chain" && report.audits["redirectChain"]) {
    const a = report.audits["redirectChain"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details:
        a.redirectCount === 0
          ? "No redirects (direct access)"
          : `${a.redirectCount} redirect(s) → ${a.finalUrl}`,
    };
  }

  // 19. Favicon Check
  if (item.task === "Favicon Check" && report.audits["favicon"]) {
    const a = report.audits["favicon"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Found: ${a.found ? "✓" : "✗"} | Link tags: ${a.linkTags} | favicon.ico: ${a.defaultFaviconIco ? "✓" : "✗"} | Apple: ${a.hasAppleTouchIcon ? "✓" : "✗"}`,
    };
  }

  // 20. Language & hreflang
  if (item.task === "Language & hreflang" && report.audits["language"]) {
    const a = report.audits["language"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Lang: ${a.htmlLang || "Not set"} | hreflang: ${a.hreflangCount} tags | x-default: ${a.hasXDefault ? "✓" : "✗"}`,
    };
  }

  // 21. DOM Size Check
  if (item.task === "DOM Size Check" && report.audits["domSize"]) {
    const a = report.audits["domSize"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Elements: ${a.totalElements} | Max depth: ${a.maxDepth} | ${a.totalElements <= 1500 ? "Good" : a.totalElements <= 3000 ? "Large" : "Too large"}`,
    };
  }

  // 22. Inline CSS/JS Check
  if (item.task === "Inline CSS/JS Check" && report.audits["jsOptimization"]) {
    const a = report.audits["jsOptimization"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Scripts: ${a.totalScripts} (Blocking: ${a.renderBlocking}) | Inline CSS: ${a.inlineCssSize || 0}KB, JS: ${a.inlineJsSize || 0}KB | Styles: ${a.inlineStyles || 0}`,
    };
  }

  // 23. Social Media Links
  if (item.task === "Social Media Links" && report.audits["socialLinks"]) {
    const a = report.audits["socialLinks"];
    const platforms = Object.keys(a.platforms || {}).join(", ");
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `${a.count} platforms: ${platforms || "None found"}`,
    };
  }

  // 24. Analytics Detection
  if (
    item.task === "Analytics Detection" &&
    report.audits["analyticsDetection"]
  ) {
    const a = report.audits["analyticsDetection"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details:
        a.count > 0
          ? `Found: ${a.detected.join(", ")}`
          : "No analytics detected",
    };
  }

  // 25. Deprecated HTML
  if (item.task === "Deprecated HTML" && report.audits["deprecatedHtml"]) {
    const a = report.audits["deprecatedHtml"];
    const tags = Object.keys(a.deprecatedTags || {}).join(", ");
    return {
      automated: true,
      pass: a.status === "PASS",
      details:
        a.deprecatedTagCount === 0 && a.deprecatedAttrCount === 0
          ? "No deprecated HTML found ✓"
          : `Tags: ${tags || "None"} | Attrs: ${a.deprecatedAttrs?.join(", ") || "None"}`,
    };
  }

  // 26. Compression Check
  if (item.task === "Compression Check" && report.audits["compression"]) {
    const a = report.audits["compression"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Encoding: ${a.encoding} | Compressed: ${a.isCompressed ? "✓" : "✗"} | Size: ${a.compressedSizeKB}KB`,
    };
  }

  // 27. HTTP Headers
  if (item.task === "HTTP Headers" && report.audits["httpHeaders"]) {
    const a = report.audits["httpHeaders"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Cache: ${a.hasCacheControl ? "✓" : "✗"} | ETag: ${a.hasEtag ? "✓" : "✗"} | Server hidden: ${a.serverHidden ? "✓" : "✗"} | X-Powered-By hidden: ${a.poweredByHidden ? "✓" : "✗"}`,
    };
  }

  // 28. Custom 404 Page
  if (item.task === "Custom 404 Page" && report.audits["custom404"]) {
    const a = report.audits["custom404"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Status: ${a.httpStatus} | Custom content: ${a.hasCustomContent ? "✓" : "✗"} | Size: ${Math.round(a.pageSize / 1024)}KB`,
    };
  }

  // 29. Image Formats
  if (item.task === "Image Formats" && report.audits["imageFormats"]) {
    const a = report.audits["imageFormats"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Total: ${a.totalImages} | Modern (webp/avif): ${a.modernFormat} | Old (jpg/png): ${a.oldFormat}${a.oldFormatList?.length ? " (" + a.oldFormatList.join(", ") + ")" : ""}`,
    };
  }

  // 30. Tap Targets
  if (item.task === "Tap Targets" && report.audits["tapTargets"]) {
    const a = report.audits["tapTargets"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Clickable: ${a.totalClickable} | Small targets: ${a.smallTargets} | Adjacent links: ${a.adjacentLinks}`,
    };
  }

  // 31. Duplicate H1
  if (item.task === "Duplicate H1" && report.audits["duplicateH1"]) {
    const a = report.audits["duplicateH1"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details:
        a.count === 1
          ? `✓ Single H1: "${a.tags[0]}"`
          : a.count === 0
            ? "✗ No H1 tag found"
            : `✗ ${a.count} H1 tags found: ${a.tags.join(", ")}`,
    };
  }

  // 32. Title/Desc Length
  if (item.task === "Title/Desc Length" && report.audits["titleDescLength"]) {
    const a = report.audits["titleDescLength"];
    return {
      automated: true,
      pass: a.status === "PASS",
      details: `Title: ${a.titleLength} chars (${a.titleIssue}) | Desc: ${a.descLength} chars (${a.descIssue})`,
    };
  }

  // Try generic handler for checks 33-42
  const generic = getGenericCheckStatus(item, report);
  if (generic) return generic;

  return { automated: false, pass: false, details: null, method: item.method };
}
