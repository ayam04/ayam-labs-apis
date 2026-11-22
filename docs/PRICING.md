# Pricing - final state (2026-11-21)

## No free tier

There is no free plan on any listing. The entry plan is metered.

| Plan | Type | Price | Quota |
| --- | --- | --- | --- |
| BASIC | Pay per Use | **$0.05 per request** | metered, no monthly minimum |
| PRO | Monthly subscription | $25/mo | 25,000 requests |
| ULTRA | Monthly subscription | $75/mo | 100,000 requests |
| MEGA | Monthly subscription | $150/mo | 400,000 requests |

Applied to all five listings: emailcheck, seo-audit, docparse, ai-text, pii-shield.

## How it was done

Monetize > Public Plans > BASIC > Edit > Plan type = **Pay per Use** > Save.
Then the BASIC Requests object becomes a price cell: click it, set 0.05, Save Changes.
RapidAPI defaults a new pay-per-use plan to $0.00003/use, which is why the price must be set explicitly.

## The deprecated row

The public plan picker still shows a greyed **"Basic · Deprecated"** entry carrying the
original 500,000/month config. That is the superseded *version* of the Basic plan: every
edit to a plan retires the previous version, and the retired version stays attached to
anyone who subscribed to it. The only subscriber is our own provider account.

There is no delete control in the UI: the plan dialog only has the type radios, and the
Monetize grid has four columns (BASIC/PRO/ULTRA/MEGA) with no fifth slot for the old
version. Options, in order of effort:

1. Move our own subscription to the current plans (Console > Subscriptions). The retired
   version loses its last subscriber and should drop off the picker.
2. Open a RapidAPI support ticket asking them to purge the deprecated plan version.

## Site copy

marketing/site/public was rewritten to match: the free tier block became
"Pay as you go - $0.05/call - no monthly minimum" on every product page, the pricing
table row was renamed, and the build log article paragraph was rewritten to explain
metering instead of a small free tier.
