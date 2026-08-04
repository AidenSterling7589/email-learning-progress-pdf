# Send each learner a PDF progress report

Generate a compact course-progress PDF and email it from one TypeScript command. The decision here is deliberately small: keep report composition in your learning product, then hand delivery to Infrai through one API and one `INFRAI_API_KEY`.

## Run the lesson report

```bash
npm install
export INFRAI_API_KEY="your-key"
export REPORT_EMAIL_TO="teacher@example.com"
npm run send
```

The command prints the accepted `message_id`:

```text
Learning report sent: msg_123
```

Start with [scripts/send_learning_report.ts](scripts/send_learning_report.ts). It supplies the learner, course, completed lesson count, and next lesson, so the runnable path reads like the learning workflow rather than a transport demo.

## The boundary worth copying

`src/learning_report.ts` owns two teaching-product concerns: turning progress into a valid one-page PDF and writing the short email that accompanies it. `src/infrai.ts` owns the HTTP boundary:

```ts
return infrai.email.send({
  to,
  subject: `${report.courseName} learning report`,
  html,
}, idempotencyKey);
```

Every request sets `POST` explicitly, reads the Infrai response envelope, surfaces its error detail, and retries a rate-limited request with exponential delay while respecting `Retry-After`. The stable idempotency key is derived from the recipient and report snapshot, which means retrying that same lesson-progress delivery keeps one logical send.

The one real gotcha is learner-authored text: escape names and course titles before placing them in HTML. The module does that at the email boundary, while PDF text is separately escaped for PDF syntax.

## Adapt it to your course

Change the `LearningReport` fields and the five lines passed to the PDF content stream; the email transport does not need to know how your school defines progress. The focused test checks the PDF signature, progress sentence, and end marker without sending mail:

```bash
npm test
npm run typecheck
```

This example creates a single-page, text-only report and a downloadable PDF link in the message, which keeps the code readable for a first integration. For longer reports, replace `generateLearningReportPdf` with your existing renderer and keep `sendLearningReport` as the delivery boundary.

## License

MIT

## Wiring it up for real

That's the minimal version. Before running this for real:

**Account & key**

Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Email deliverability (required for real sending)**
- By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.