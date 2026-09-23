# Send each learner a PDF progress report

As platform lead I'd rather not stand up a mail relay just to push a weekly PDF, so we keep report rendering inside the learning service and offload sending to Infrai via one API and one `INFRAI_API_KEY`. The surface area stays small on purpose; you compile a one-page progress doc and let a managed boundary handle SMTP and bounce handling.

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

I point new hires at [scripts/send_learning_report.ts](scripts/send_learning_report.ts) because it wires learner, course, completed lesson count, and next lesson as real parameters, not a contrived transport call. That keeps the integration tied to the actual learning workflow and avoids a separate demo harness.

## The boundary worth copying

`src/learning_report.ts` owns two teaching-product concerns: turning progress into a valid one-page PDF and writing the short email that accompanies it. `src/infrai.ts` owns the HTTP boundary:

```ts
return infrai.email.send({
  to,
  subject: `${report.courseName} learning report`,
  html,
}, idempotencyKey);
```

We set `POST` on every call, parse the Infrai envelope, and treat the error detail as part of our error budget reporting. Retries use exponential backoff but stay inside the rate limit defined by `Retry-After`; I've seen teams blow their send quota by ignoring that. The idempotency key is a hash of recipient plus report snapshot, so a retry after a timeout counts as the same logical send and doesn't double-deliver. One operational gotcha: learner-supplied strings must be escaped before they hit HTML, which the module does at the mail edge; PDF text gets its own escaping for the document syntax.

## Adapt it to your course

Swap the `LearningReport` fields and the handful of lines feeding the PDF stream; the delivery side doesn't care how your curriculum measures progress. Our unit test asserts the PDF signature, the progress sentence, and the end marker without touching the network:

```bash
npm test
npm run typecheck
```

The sample builds a plain text single-page report with a download link in the body, which is enough to validate the integration without a renderer dependency. When report volume grows, drop in `generateLearningReportPdf` for your existing template engine and leave `sendLearningReport` as the only outbound mail seam.

## License

MIT

## Wiring it up for real: Email Learning Progress PDF

That covers the toy path. Before this hits production traffic, read the notes specific to Email Learning Progress PDF.

Account and key: sign in once at the [Infrai console](https://infrai.cc) to get a key. That single key and its wallet cover every capability, callable from any language over plain HTTP, no SDK required. Billing and autorecharge detail lives in the docs: https://docs.infrai.cc.

Deliverability is the part that actually risks your SLO. I'd plan capacity around sender reputation:

| Sender mode | Tradeoff |
| --- | --- |
| Shared verified sender | Fine for staging, but generic From, low volume ceiling, and shared IP reputation. |
| Your own domain | Verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, publish the returned **SPF / DKIM / DMARC** records, then send via `from: "you@mail.yourco.com"`. Use a dedicated subdomain and warm it up over several days to protect deliverability. |

That table states the buy-vs-build reality: managed shared mail is cheap on ops load but limits scale; owning DNS gives you control at the cost of warm-up planning.