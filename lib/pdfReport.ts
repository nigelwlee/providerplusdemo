import { jsPDF } from "jspdf";
import type { AnalysisReport, StandardFinding, StandardStatus } from "./types";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 18;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const NAVY: [number, number, number] = [14, 36, 57];
const ORANGE: [number, number, number] = [240, 128, 33];
const GREEN: [number, number, number] = [2, 122, 72];
const RED: [number, number, number] = [180, 35, 24];
const GREY: [number, number, number] = [120, 120, 120];
const BEIGE: [number, number, number] = [239, 236, 233];

const STATUS_STYLE: Record<StandardStatus, { label: string; color: [number, number, number] }> = {
  met: { label: "MET", color: GREEN },
  partial: { label: "PARTIAL", color: ORANGE },
  gap: { label: "GAP", color: RED },
  not_addressed: { label: "NOT ADDRESSED", color: GREY },
};

export function generateReportPdf(report: AnalysisReport) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_HEIGHT - MARGIN) {
      addFooter(doc);
      doc.addPage();
      y = MARGIN;
    }
  };

  const addFooter = (d: jsPDF) => {
    d.setFontSize(7);
    d.setTextColor(...GREY);
    const footerText =
      "Demonstration only. Not compliance, legal or audit advice. Standards dataset is condensed from publicly available NDIS Commission material.";
    const lines = d.splitTextToSize(footerText, CONTENT_WIDTH);
    d.text(lines, MARGIN, PAGE_HEIGHT - 12);
  };

  // Header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_WIDTH, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Audit-Ready Gap Checker", MARGIN, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Provider+ | NDIS Practice Standards gap analysis (demonstration)", MARGIN, 22);
  const generated = new Date(report.generatedAt);
  doc.setFontSize(9);
  doc.text(
    `Generated ${generated.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })} | Pathway: ${
      report.pathway === "certification" ? "Certification audit" : "Verification audit"
    }`,
    MARGIN,
    29
  );
  y = 44;

  // Module coverage summary
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Modules assessed", MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const moduleLines = doc.splitTextToSize(report.modulesAnalysed.join("  •  "), CONTENT_WIDTH);
  doc.text(moduleLines, MARGIN, y);
  y += moduleLines.length * 5 + 6;

  // Readiness + score
  const readinessColor =
    report.summary.overallReadiness === "audit-ready"
      ? GREEN
      : report.summary.overallReadiness === "minor gaps"
        ? ORANGE
        : RED;

  doc.setFillColor(...BEIGE);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 22, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...readinessColor);
  doc.text(`${report.summary.score}/100`, MARGIN + 6, y + 14);
  doc.setFontSize(11);
  doc.text(report.summary.overallReadiness.toUpperCase(), MARGIN + 40, y + 14);
  y += 30;

  // Executive summary
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Executive summary", MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const execLines = doc.splitTextToSize(report.summary.executiveSummary, CONTENT_WIDTH);
  doc.text(execLines, MARGIN, y);
  y += execLines.length * 5 + 8;

  // Top 3 risks
  ensureSpace(30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Top risks", MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  report.summary.topThreeRisks.forEach((risk, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${risk}`, CONTENT_WIDTH - 4);
    ensureSpace(lines.length * 5 + 2);
    doc.text(lines, MARGIN + 2, y);
    y += lines.length * 5 + 2;
  });
  y += 4;

  // Counts strip
  const counts = countByStatus(report.standards);
  ensureSpace(10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...GREEN);
  doc.text(`${counts.met} met`, MARGIN, y);
  doc.setTextColor(...ORANGE);
  doc.text(`${counts.partial} partial`, MARGIN + 30, y);
  doc.setTextColor(...RED);
  doc.text(`${counts.gap} gaps`, MARGIN + 62, y);
  doc.setTextColor(...GREY);
  doc.text(`${counts.not_addressed} not addressed`, MARGIN + 90, y);
  y += 10;

  // Divider
  doc.setDrawColor(...BEIGE);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 8;

  // Standards detail, grouped by division
  const divisions = groupByDivision(report.standards);
  for (const [division, standards] of divisions) {
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...NAVY);
    doc.text(division, MARGIN, y);
    y += 7;

    for (const std of standards) {
      const style = STATUS_STYLE[std.status];
      ensureSpace(16);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...NAVY);
      const nameLines = doc.splitTextToSize(std.standardName, CONTENT_WIDTH - 32);
      doc.text(nameLines, MARGIN, y);

      doc.setFontSize(8);
      doc.setTextColor(...style.color);
      doc.text(style.label, PAGE_WIDTH - MARGIN - doc.getTextWidth(style.label), y - 3.5);

      y += nameLines.length * 5 + 3;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const findingLines = doc.splitTextToSize(std.findings, CONTENT_WIDTH);
      ensureSpace(findingLines.length * 4.6 + 4);
      doc.text(findingLines, MARGIN, y);
      y += findingLines.length * 4.6 + 3;

      if (std.status !== "met" && std.suggestedFix) {
        const fixLines = doc.splitTextToSize(`Recommended action: ${std.suggestedFix}`, CONTENT_WIDTH - 6);
        ensureSpace(fixLines.length * 4.6 + 6);
        doc.setFillColor(...BEIGE);
        doc.roundedRect(MARGIN, y - 3.5, CONTENT_WIDTH, fixLines.length * 4.6 + 4, 2, 2, "F");
        doc.setFont("helvetica", "italic");
        doc.setTextColor(...NAVY);
        doc.text(fixLines, MARGIN + 3, y + 1);
        y += fixLines.length * 4.6 + 8;
      } else {
        y += 4;
      }
    }
    y += 2;
  }

  addFooter(doc);

  doc.save(`audit-ready-gap-report-${new Date(report.generatedAt).toISOString().slice(0, 10)}.pdf`);
}

function countByStatus(standards: StandardFinding[]) {
  return standards.reduce(
    (acc, s) => {
      acc[s.status] += 1;
      return acc;
    },
    { met: 0, partial: 0, gap: 0, not_addressed: 0 } as Record<StandardStatus, number>
  );
}

function groupByDivision(standards: StandardFinding[]): Array<[string, StandardFinding[]]> {
  const order: string[] = [];
  const map = new Map<string, StandardFinding[]>();
  for (const s of standards) {
    const key = s.division || "Other";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(s);
  }
  return order.map((key) => [key, map.get(key)!]);
}
