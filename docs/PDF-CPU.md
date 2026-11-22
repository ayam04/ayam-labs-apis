# PDF failure: what is actually proven - 2026-11-22 (round 23)

## Two claims of mine were wrong; here is the evidence

Round 20: "pdf.js needs more than the 10 ms Free-plan budget." (no evidence)
Round 21: retracted as unproven.
Round 22: re-asserted from `wrangler tail` showing `cpuTime 10-20ms, outcome exceededCpu`.
Round 23, measuring a *different* worker the same way:

```
seo-audit /v1/audit on a Wikipedia page   cpu 158ms  wall 356ms  -> 200 OK
seo-audit /v1/readability on 13k chars    cpu   4ms  wall   5ms  -> 200 OK
seo-audit /v1/keywords on 13k chars       cpu   5ms  wall   6ms  -> 200 OK
```

A request that burns **158 ms of CPU succeeds**, so the per-request CPU budget is at least
158 ms. The "10 ms" framing cannot explain these numbers, and the note published in round 22
has to come down.

## What the docparse failures do show

```
wall 165ms  cpu 20ms  outcome exceededCpu   (full 16-page extraction)
wall  42ms  cpu 10ms  outcome exceededCpu
wall  48ms  cpu 10ms  outcome exceededCpu
pages=1 on the same document: 200 OK, twice (1360 ms and 651 ms)
```

The worker dies early with very little CPU consumed, and the *same document* loads fine when
only one page is extracted. That pattern fits memory exhaustion during multi-page extraction
(Workers have 128 MB) better than a CPU ceiling, because a CPU ceiling would show up after the
CPU had been spent, not at 10 ms.

**Hypothesis, not conclusion.** I have not proven it, and I am not going to publish a third
confident diagnosis without a memory measurement I do not have a tool for here.

## What stays

The guard stays, because it is justified by outcome rather than by cause: a document over 400 KB
asked to extract in full returns a readable 413 from our handler instead of dying as a Cloudflare
HTML page. That is true regardless of whether the underlying limit is CPU or memory.

The rationale in the code comment has been rewritten to say exactly that, and the published note
no longer claims a 10 ms budget.

## What I would need to settle it

`allocated memory` is not exposed in tail. The practical test is to bisect page counts on the same
document (1, 2, 4, 8, 16) across several minutes and see whether the failure tracks page count
rather than wall time. I ran that once and got contradictory results inside one window, which is
why the honest status is "intermittent, cause unconfirmed".