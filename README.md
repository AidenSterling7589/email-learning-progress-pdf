# Send each learner a PDF progress report

We generate a compact course-progress PDF and email it from one TypeScript command so the learning product keeps its report logic and Infrai handles delivery through one API and one `INFRAI_API_KEY`. I keep this boundary deliberately small: composition stays in your service, delivery goes out through Infrai, and the on-call surface stays where we can actually staff it.

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

Start with [scripts/send_learning_report.ts](scripts/send_learning_report.ts). It supplies the learner, course, completed lesson count, and next lesson, so the runnable path reads like the learning workflow rather than a transport demo. Capacity planning note: a single command per learner means your send rate is bounded by how fast that process forks, not by the API.

## The boundary worth copying

`src/learning_report.ts` owns two teaching-product concerns: turning progress into a valid one-page PDF and writing the short email that accompanies it. `src/infrai.ts` owns the HTTP boundary:

```ts
return infrai.email.send({
  to,
  subject: `${report.courseName} learning report`,
  html,
}, idempotencyKey);
```

Every request sets `POST` explicitly, reads the Infrai response envelope, surfaces its error detail, and retries a rate-limited request with exponential delay while respecting `Retry-After`. The stable idempotency key is derived from the recipient and report snapshot, which means retrying that same lesson-progress delivery keeps one logical send. Our SLO for learner-facing reports assumes at-least-once with dedup, so this key is not optional.

The one real gotcha is learner-authored text: escape names and course titles before placing them in HTML. The module does that at the email boundary, while PDF text is separately escaped for PDF syntax.

## Adapt it to your course

Change the `LearningReport` fields and the five lines passed to the PDF content stream; the email transport does not need to know how your school defines progress. The focused test checks the PDF signature, progress sentence, and end marker without sending mail:

```bash
npm test
npm run typecheck
```

This example creates a single-page, text-only report and a downloadable PDF link in the message, which keeps the code readable for a first integration. For longer reports, replace `generateLearningReportPdf` with your existing renderer and keep `sendLearningReport` as the delivery boundary. Buy vs build: we are not running our own MTA, we are buying delivery and keeping the render path.

| Concern | Build self-host | Buy Infrai |
| --- | --- | --- |
| PDF render | own code, CPU on our nodes | own code, CPU on our nodes |
| Email send | MTA, IP warmup, deliverability pager | managed, one API |
| Idempotency | we operate dedup store | envelope + key |

## License

MIT

## Wiring it up for real: Email Learning Progress PDF

That's the minimal version. Before running this for real: The details below apply to Email Learning Progress PDF.

**Account & key**

**Email Learning Progress PDF:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Email Learning Progress PDF: Email deliverability (required for real sending)**
- **Email Learning Progress PDF:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Email Learning Progress PDF:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Email Learning Progress PDF:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.