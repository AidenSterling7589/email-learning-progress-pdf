import assert from "node:assert/strict";
import test from "node:test";
import { generateLearningReportPdf } from "../src/learning_report.js";

test("generates a one-page PDF with the learner's progress", () => {
  const pdf = generateLearningReportPdf({
    learnerName: "Avery Chen",
    courseName: "Introduction to Fractions",
    lessonsCompleted: 7,
    lessonsTotal: 10,
    nextLesson: "Comparing unlike denominators",
  });

  assert.equal(pdf.subarray(0, 8).toString(), "%PDF-1.4");
  assert.match(pdf.toString(), /7 of 10 lessons completed/);
  assert.match(pdf.toString(), /%%EOF/);
});
