import { createHash } from "node:crypto";
import { infrai } from "./infrai.js";

export type LearningReport = {
  learnerName: string;
  courseName: string;
  lessonsCompleted: number;
  lessonsTotal: number;
  nextLesson: string;
};

function pdfText(value: string): string {
  return value.replace(/[^\x20-\x7e]/g, "?").replace(/([\\()])/g, "\\$1");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] as string);
}

export function generateLearningReportPdf(report: LearningReport): Buffer {
  const progress = `${report.lessonsCompleted} of ${report.lessonsTotal} lessons completed`;
  const lines = [
    "Learning progress report",
    `Learner: ${report.learnerName}`,
    `Course: ${report.courseName}`,
    `Progress: ${progress}`,
    `Next lesson: ${report.nextLesson}`,
  ];
  const stream = lines
    .map((line, index) => `BT /F1 ${index === 0 ? 20 : 12} Tf 72 ${740 - index * 42} Td (${pdfText(line)}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];

  let document = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(document));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(document);
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  document += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(document);
}

export async function sendLearningReport(to: string, report: LearningReport) {
  const pdf = generateLearningReportPdf(report);
  const pdfHref = `data:application/pdf;base64,${pdf.toString("base64")}`;
  const learnerName = escapeHtml(report.learnerName);
  const courseName = escapeHtml(report.courseName);
  const idempotencyKey = createHash("sha256")
    .update(`${to}\n${report.courseName}\n${report.lessonsCompleted}\n${report.lessonsTotal}`)
    .digest("hex");

  return infrai.email.send({
    to,
    subject: `${report.courseName} learning report`,
    html: `<h1>${courseName} progress</h1><p>${learnerName}, your report is ready.</p><p><a href="${pdfHref}" download="learning-report.pdf">Download the PDF report</a></p>`,
  }, idempotencyKey);
}
