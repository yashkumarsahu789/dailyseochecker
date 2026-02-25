import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { checkMeta } from "../constants/checkMetadata";

// ============= PDF REPORT GENERATOR =============
export function generatePdfReport(
  site,
  report,
  checklist,
  itemStatuses,
  auditScore,
) {
  const doc = new jsPDF();
  const hostname = site ? new URL(site.url).hostname : "unknown";
  const pageWidth = doc.internal.pageSize.getWidth();

  // PDF metadata
  doc.setProperties({
    title: `SEO Audit Report - ${hostname}`,
    subject: "42-Point Technical & Content SEO Audit",
    author: "Life Solve Now",
    keywords: "SEO, Audit, Report, Website, Technical, Content",
    creator: "Life Solve Now SEO Audit Engine v1.0",
  });

  // Categorize items
  const criticalErrors = itemStatuses.filter(
    (i) =>
      i.status.automated &&
      !i.status.pass &&
      checkMeta[i.task]?.impact === "High",
  );
  const warnings = itemStatuses.filter(
    (i) =>
      i.status.automated &&
      !i.status.pass &&
      checkMeta[i.task]?.impact !== "High",
  );
  const passed = itemStatuses.filter(
    (i) => i.status.automated && i.status.pass,
  );

  // ---- Header ----
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 45, "F");
  doc.setFillColor(6, 182, 212);
  doc.rect(0, 42, pageWidth, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("Life Solve Now", 14, 18);
  doc.setFontSize(11);
  doc.setTextColor(6, 182, 212);
  doc.text("42-Point Technical & Content SEO Audit", 14, 27);

  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(`${hostname}  |  ${new Date().toLocaleDateString()}`, 14, 39);

  // ---- Overall Score ----
  const scoreColor =
    auditScore >= 80
      ? [52, 211, 153]
      : auditScore >= 50
        ? [251, 191, 36]
        : [251, 113, 133];
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(14, 52, pageWidth - 28, 38, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(...scoreColor);
  doc.text(`${auditScore}`, 24, 74);

  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("/100  Weighted SEO Score", 52, 68);

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `${criticalErrors.length} Critical  |  ${warnings.length} Warnings  |  ${passed.length} Passed  |  ${checklist.length} Total`,
    52,
    76,
  );

  // ---- Executive Summary ----
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(200, 200, 200);
  const execSummary =
    criticalErrors.length > 0
      ? `This page scores ${auditScore}/100 with ${criticalErrors.length} critical issue${criticalErrors.length > 1 ? "s" : ""} blocking growth.`
      : `This page scores ${auditScore}/100 — no critical issues found. Focus on warnings for further gains.`;
  doc.text(execSummary, 24, 86);

  // ---- Category Scores ----
  if (report && report.scores) {
    const cats = [
      { label: "Performance", score: report.scores.performance },
      { label: "Accessibility", score: report.scores.accessibility },
      { label: "Best Practices", score: report.scores.bestPractices },
      { label: "SEO", score: report.scores.seo },
    ];

    let xPos = 14;
    const boxW = (pageWidth - 28 - 12) / 4;
    doc.setFillColor(30, 41, 59);

    cats.forEach((cat, i) => {
      const x = xPos + i * (boxW + 4);
      doc.roundedRect(x, 96, boxW, 20, 2, 2, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text(cat.label.toUpperCase(), x + boxW / 2, 104, { align: "center" });
      const sc = Math.round(cat.score || 0);
      const sColor =
        sc >= 90 ? [52, 211, 153] : sc >= 50 ? [251, 191, 36] : [251, 113, 133];
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...sColor);
      doc.text(`${sc}`, x + boxW / 2, 113, { align: "center" });
    });
  }

  // ---- Critical Errors Table ----
  let startY = 124;
  if (criticalErrors.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(239, 68, 68);
    doc.text(`CRITICAL ERRORS (${criticalErrors.length})`, 14, startY);
    startY += 4;

    autoTable(doc, {
      startY,
      head: [["#", "Check", "Cat", "What We Found", "What To Do"]],
      body: criticalErrors.map((item, i) => [
        i + 1,
        item.task,
        item.cat,
        item.status.details || "Failed",
        checkMeta[item.task]?.fix || "Fix this issue.",
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [127, 29, 29],
        textColor: [255, 255, 255],
        fontSize: 7,
      },
      bodyStyles: { fontSize: 6.5, textColor: [51, 51, 51] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 28 },
        2: { cellWidth: 18 },
        4: { cellWidth: 42 },
      },
      margin: { left: 14, right: 14 },
    });
    startY = doc.lastAutoTable.finalY + 8;
  }

  // ---- Warnings Table ----
  if (warnings.length > 0) {
    if (startY > 250) {
      doc.addPage();
      startY = 20;
    }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(217, 119, 6);
    doc.text(`WARNINGS (${warnings.length})`, 14, startY);
    startY += 4;

    autoTable(doc, {
      startY,
      head: [["#", "Check", "Cat", "What We Found", "What To Do"]],
      body: warnings.map((item, i) => [
        i + 1,
        item.task,
        item.cat,
        item.status.details || "Needs improvement",
        checkMeta[item.task]?.fix || "Improve this area.",
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [146, 64, 14],
        textColor: [255, 255, 255],
        fontSize: 7,
      },
      bodyStyles: { fontSize: 6.5, textColor: [51, 51, 51] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 28 },
        2: { cellWidth: 18 },
        4: { cellWidth: 42 },
      },
      margin: { left: 14, right: 14 },
    });
    startY = doc.lastAutoTable.finalY + 8;
  }

  // ---- Passed Table ----
  if (passed.length > 0) {
    if (startY > 250) {
      doc.addPage();
      startY = 20;
    }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(34, 197, 94);
    doc.text(`PASSED (${passed.length})`, 14, startY);
    startY += 4;

    autoTable(doc, {
      startY,
      head: [["#", "Check", "Cat", "Details"]],
      body: passed.map((item, i) => [
        i + 1,
        item.task,
        item.cat,
        item.status.details || "OK",
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [21, 128, 61],
        textColor: [255, 255, 255],
        fontSize: 7,
      },
      bodyStyles: { fontSize: 6.5, textColor: [51, 51, 51] },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 30 },
        2: { cellWidth: 20 },
      },
      margin: { left: 14, right: 14 },
    });
    startY = doc.lastAutoTable.finalY + 8;
  }

  // ---- Prioritized Action List (Top 10 Fixes) with Effort ----
  const allFails = [...criticalErrors, ...warnings];
  if (allFails.length > 0) {
    doc.addPage();
    startY = 20;

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 30, "F");
    doc.setFillColor(168, 85, 247);
    doc.rect(0, 27, pageWidth, 3, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text("Prioritized Action List", 14, 18);

    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("Top fixes ranked by SEO impact. Start from #1.", 14, 25);

    startY = 38;

    autoTable(doc, {
      startY,
      head: [["#", "Check", "Impact", "Effort", "Issue", "Recommended Fix"]],
      body: allFails
        .slice(0, 10)
        .map((item, i) => [
          `#${i + 1}`,
          item.task,
          checkMeta[item.task]?.impact || "Medium",
          checkMeta[item.task]?.effort || "Medium",
          (item.status.details || "Failed").substring(0, 50),
          checkMeta[item.task]?.fix || "Review and fix.",
        ]),
      theme: "grid",
      headStyles: {
        fillColor: [88, 28, 135],
        textColor: [255, 255, 255],
        fontSize: 7,
      },
      bodyStyles: { fontSize: 6.5, textColor: [51, 51, 51] },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 25 },
        2: { cellWidth: 13 },
        3: { cellWidth: 13 },
        5: { cellWidth: 42 },
      },
      margin: { left: 14, right: 14 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
  }

  // ---- Footer on all pages with CTA ----
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFillColor(15, 23, 42);
    doc.rect(0, pageH - 16, pageWidth, 16, "F");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Life Solve Now — 42-Point Technical & Content SEO Audit  |  Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageH - 9,
      { align: "center" },
    );
    doc.setFontSize(6.5);
    doc.setTextColor(6, 182, 212);
    doc.text(
      "Need help implementing these fixes? Visit lifeSolveNow.com",
      pageWidth / 2,
      pageH - 4,
      { align: "center" },
    );
  }

  // ---- Save ----
  doc.save(
    `SEO-Audit-${hostname}-${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}
