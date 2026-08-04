import { sendLearningReport } from "../src/learning_report.js";

const to = process.env.REPORT_EMAIL_TO;
if (!to) throw new Error("REPORT_EMAIL_TO is required");

const result = await sendLearningReport(to, {
  learnerName: "Avery Chen",
  courseName: "Introduction to Fractions",
  lessonsCompleted: 7,
  lessonsTotal: 10,
  nextLesson: "Comparing unlike denominators",
});

console.log(`Learning report sent: ${result.message_id}`);
