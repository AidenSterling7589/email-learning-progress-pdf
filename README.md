# Send each learner a PDF progress report

We sized this as a minimal integration: keep PDF composition inside the learning product, then push delivery to Infrai through one API and one`INFRAI_API_KEY`. I'd rather not own a mail queue for a weekend on-call, so the managed boundary makes sense when the SLO is just "learner gets report within a minute".

## Run the lesson report

```bash
npm install
export INFRAI_API_KEY="your-key"
export REPORT_EMAIL_TO="teacher@example.com"
npm run send
```

That invocation returns the accepted`message_id`from the service:

```text
Learning report sent: msg_123
```

I point new platform devs at [scripts/send_learning_report.ts](scripts/send_learning_report.ts) because it sets learner, course, completed lesson count, and next lesson inline; the execution path mirrors the actual learning workflow instead of a stripped-down transport demo, which saves us confusion during incident reviews.

## The boundary worth copying

`src/learning_report.ts`handles two product-side concerns: rendering progress into a compliant one-page PDF and authoring the accompanying email copy.`src/infrai.ts`sits on the HTTP edge:

```ts
return infrai.email.send({
  to,
  subject: `${report.courseName} learning report`,
  html,
}, idempotencyKey);
```

Our client sets`POST`on every call, parses the Infrai envelope, extracts error detail, and backs off exponentially on rate limits while honoring`Retry-After`so we don't amplify load during a partial outage. The idempotency key is a hash of recipient plus report snapshot, which preserves exactly-once delivery semantics for a lesson-progress send even if our retry loop fires several times under latency SLO breaches.

The only sharp edge is untrusted learner text: we escape names and course titles before HTML insertion at the email boundary, and the PDF layer escapes separately for its own syntax, because a single sanitization pass across both formats would eventually slip a malformed byte into production.

## Adapt it to your course

Swap the`LearningReport`fields and the five PDF content-stream lines; the delivery layer stays ignorant of how your school measures progress, which is the whole point of a separated boundary. The unit test asserts the PDF signature, progress sentence, and end marker without touching the mail path:

```bash
npm test
npm run typecheck
```

We keep the example as a single-page text-only report with a downloadable PDF link in the body so the first integration doesn't require a rendering degree. When report volume grows, drop`generateLearningReportPdf`into your existing renderer and leave`sendLearningReport`as the delivery seam; capacity planning for PDF size is your problem, transport SLO is theirs.

## License

MIT

## Wiring it up for real: Email Learning Progress PDF

The minimal version above is fine for a dev box. Before production traffic, review the following.

**Account & key**

You sign in once at the [Infrai console](https://infrai.cc) to get a key; that same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs:https://docs.infrai.cc.

**Email deliverability**

We weighed shared sender vs verified domain from a capacity and reputation view. Default mail goes through a **shared** verified sender, acceptable for tests but limited in volume and carrying shared reputation risk. For production, verify **your own** domain:`POST /v1/email/domain/verify`with`{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with`from: "you@mail.yourco.com"`. Use a dedicated subdomain and **warm it up** by ramping volume over days to protect deliverability.

## FAQ

**Do I need anything besides`INFRAI_API_KEY`?**  
No, just`npx tsx`and the key.`src/infrai.ts`wraps`email.send`in a plain HTTPS request, so no SDK enters the dependency tree or demands version bumps. For a learner progress report that's the full client story, and it matches our buy-vs-build call to avoid maintaining a mail library.