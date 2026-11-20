# Apple Intelligence copy and type system

Evidence pulled 2026-11-20 with `treg call treg.web.extract` (route: tinyfish, $0.00) on
`https://www.apple.com/apple-intelligence/`. Everything below quotes that page; nothing is inferred
unless marked.

## What the copy does

**Sentence case everywhere, except feature names.** Section heads are sentence case ("Take action in
more apps."). Feature names are proper nouns and Title Cased ("Visual Intelligence", "Private Cloud
Compute", "Image Playground", "Spatial Reframing", "Call Context").

**Verb first.** Every head starts with the verb the reader will do:
"Just ask Siri." · "Describe a shortcut." · "Fix passwords with a tap." · "Communicate across
languages." · "Tap into broad world knowledge." · "Reframe your photo even after it's been taken."
· "Write with Siri virtually anywhere you type."

**Three beats, then stop.** Taglines are two or three clipped clauses:
"Truly helpful. Truly yours." · "Powerful, durable, and delightful." · "Feature stacked. Value
packed." · "Foldable. Posable. And durable." · "Amazing performance. Durable design."

**Capability as ease, not spec.** "with a tap", "just by asking", "in just about any style", "just
describe what you need in your own words", "without the hassle". Numbers appear only when they are a
fact (39-hour battery), never as a boast.

**One em dash for scope.** "Next-generation Apple Intelligence enhances the apps you use most —
like Photos, Messages, and Safari."

**Second person, present tense, active.** "Siri can find relevant answers…", "Messages and Mail
offer suggestions…". Never "users", never "leverage", never "seamless".

**Privacy is a headline, not a bullet.** "Great powers come with great privacy." followed by three
parallel facts: "Your data is never stored / Used only for your requests / Verifiable privacy
promise".

**Limits are quiet footnotes.** "Available in English". "Usage limits may apply." "Coming in a
future software update." No apology, no warning colour.

**Absent, always:** exclamation marks, emoji, "AI-powered", "supercharge", "unleash", "revolutionary",
"seamless", "effortlessly", "Oops", scare quotes, and any sentence that addresses "the user".

**CTAs are one or two words, verb only.** "Learn more" · "Buy" · "Continue". Never "Get started now!"

## What the type does

- Apple's stack (SF Pro) at 13px for UI labels, 15–17px body, 21–28px display, 600 weight at most.
- Display sizes carry negative tracking; body sits at normal tracking.
- Labels are sentence case, medium weight, muted — not tracked uppercase.
- Generous whitespace; hairlines and one accent only; colour reserved for state.

## Applied to ORBIT

| Was | Is |
|---|---|
| `ORBIT — Browser Agent` | `ORBIT` |
| `RECENT` / `TIMELINE` / `RESULT` / `PAGE` | `Recent` / `Timeline` / `Result` / `Page` |
| `Needs approval` | `Needs your approval` |
| `Waiting for your decision` | `Waiting on you` |
| `Reached the 20-step limit. Review what happened, then continue or stop.` | `That's the 20-step limit. Pick up where it stopped, or call it done.` |
| `Ask a follow-up about this task…` | `Ask a follow-up` |
| `Picks up from the last step with a fresh allowance.` | `Ten more steps from where it stopped.` |
| `Chrome performs its own permission prompt. ORBIT never receives a key or cookie.` | `Chrome asks on its own. ORBIT never sees a key or a cookie.` |
| `Stop when the estimated cost passes this, in USD. 0 turns it off.` | `Stops when the estimate passes this. 0 turns it off.` |
| `Ask before submits, sends, purchases, deletions and transfers.` | `Ask before anything that sends, buys or deletes.` |
| `Saving runs a live connection test.` | `Saving tests the connection.` |
| `Failed` | `Couldn't finish` |
