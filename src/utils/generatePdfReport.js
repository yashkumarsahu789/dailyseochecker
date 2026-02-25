import { API_BASE } from "../config";

// ============= PDF REPORT GENERATOR =============
// Opens the server-generated HTML report in a new tab for printing/PDF export
export function generatePdfReport(
  site,
  report,
  checklist,
  itemStatuses,
  auditScore,
) {
  if (!site?.id) {
    alert("No site selected");
    return;
  }

  // Open server-generated HTML report in a new window
  fetch(`${API_BASE}/websites/${site.id}/report`)
    .then((res) => res.json())
    .then((data) => {
      if (!data.html) {
        alert("Failed to generate report");
        return;
      }
      // Open the HTML in a new window and trigger print
      const win = window.open("", "_blank");
      if (win) {
        win.document.write(data.html);
        win.document.close();
        // Auto-trigger print dialog for PDF save
        win.onload = () => win.print();
      } else {
        alert("Pop-up blocked. Please allow pop-ups for this site.");
      }
    })
    .catch((err) => {
      console.error("Report generation failed:", err);
      alert("Failed to generate report: " + err.message);
    });
}
