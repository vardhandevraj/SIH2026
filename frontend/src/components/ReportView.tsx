import { useState } from "react";
import { Download, Printer, Loader2 } from "lucide-react";
import type { InvestigationReport } from "../api/types";

export function ReportView({ report }: { report: InvestigationReport }) {
  const [exporting, setExporting] = useState(false);

  const downloadPdf = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const margin = 48;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const maxWidth = pageWidth - margin * 2;
      let y = margin;

      doc.setFillColor(10, 14, 24);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      doc.setTextColor(99, 102, 241);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("CHAINTRACE - INVESTIGATION REPORT", margin, y);
      y += 20;
      doc.setFontSize(11);
      doc.setTextColor(226, 232, 240);
      doc.text(report.title, margin, y);
      y += 16;
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date(report.createdAt).toLocaleString()}`, margin, y);
      y += 24;

      for (const section of report.sections) {
        if (y > pageHeight - 80) {
          doc.addPage();
          y = margin;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(99, 102, 241);
        doc.text(section.title, margin, y);
        y += 16;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(203, 213, 225);
        for (const line of section.lines) {
          for (const part of doc.splitTextToSize(line, maxWidth)) {
            if (y > pageHeight - 60) {
              doc.addPage();
              y = margin;
            }
            doc.text(String(part), margin, y);
            y += 14;
          }
        }
        y += 10;
      }

      y += 6;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(248, 113, 113);
      for (const part of doc.splitTextToSize(report.disclaimer, maxWidth)) {
        if (y > pageHeight - 40) {
          doc.addPage();
          y = margin;
        }
        doc.text(String(part), margin, y);
        y += 12;
      }

      doc.save(`chaintrace-report-${report.id.slice(0, 8)}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={downloadPdf}
          disabled={exporting}
          className="btn-gradient flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} {exporting ? "Preparing..." : "Download PDF"}
        </button>
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">
          <Printer size={15} /> Print
        </button>
        <span className="ml-2 text-xs text-slate-500">Report ID: {report.id.slice(0, 13)}</span>
      </div>

      <div className="glass rounded-xl p-6">
        <div className="border-b border-slate-800 pb-4">
          <div className="text-lg font-bold text-white">ChainTrace — Investigation Report</div>
          <div className="mt-1 text-sm text-slate-400">{report.title}</div>
          <div className="mt-0.5 text-xs text-slate-500">Generated: {new Date(report.createdAt).toLocaleString()}</div>
        </div>
        {report.sections.map((s) => (
          <div key={s.key} className="border-b border-slate-800/60 py-4 last:border-0">
            <h3 className="mb-2 text-sm font-semibold text-accent-cyan">{s.title}</h3>
            <ul className="space-y-1">
              {s.lines.map((line, i) => (
                <li key={i} className="text-xs leading-relaxed text-slate-300">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-300">{report.disclaimer}</div>
      </div>
    </div>
  );
}