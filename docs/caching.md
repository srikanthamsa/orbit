# Prompt caching

DeepSeek bills a cache hit at about a tenth of the input rate, so a long agent
run is mostly a caching problem. This is what the request has to look like for
that to work, and how to check it.

## What DeepSeek actually does

From the API docs (Context Caching):

- The disk cache stores **cache prefix units**, saved at the end of a request's
  input and at the end of its output.
- A later request hits **only if it fully matches a stored unit**. A prefix that
  diverges anywhere does not hit, however long the shared part is.
- Common-prefix detection can persist a shared prefix after two requests, and
  long inputs also get units carved at fixed intervals.
- `usage.prompt_cache_hit_tokens` and `prompt_cache_miss_tokens` report the split.

The consequence is blunt: **a request that rewrites its tail cannot extend a
previous unit**. If each turn ends with a fresh page block and the next turn puts
a new step at that same position, every request is a rewrite and only the system
prompt survives. That was the 22% in the dashboard.

## The shape that works

```
system                     immutable
user  objective + initial page   immutable
assistant  STEP 1 ACTION … RESULT …   appended once
user  PAGE: <the page that action produced>   appended once
assistant  STEP 2 …
user  PAGE: …
```

Each request is the previous request plus one pair. The page the model acts on is
the last `PAGE:` message, so the next request extends the previous one exactly and
matches its stored unit.

Rules that follow from it, and are enforced by tests in `tests/cache.test.ts`:

- Previously sent messages are never edited, truncated, reordered or dropped.
- History is never windowed: step 1 stays in the transcript at 40 steps.
- Observations are capped (`STEP_OBSERVATION_LIMIT`) at read time, identically for
  every step, so the cap never rewrites an old message.
- Screenshots belong to the step that produced them, so they are cached too.
- A freshly captured page is only appended when it differs from the page the last
  step already sent. An identical copy would move the cacheable end for nothing.
- A correction retry appends one user message at the end; the prefix is untouched.

## The ceiling

Every turn must send the page it is acting on, and that page is new each time, so
it can never be cached. The reachable hit rate is therefore

```
hit = system + objective + history of steps
miss = newest step + the newest page
```

With a ~4,300-token prefix, a ~3,400-token page and ~500 tokens per step, per-turn
reuse climbs from about 45% at step 2 to about 90% at step 10 and 95% at step 20.
**95–99% is not reachable on short runs**, and forcing it would mean cutting the
live page or the history, which costs correctness. What is reachable is the cost:
at 95% of tokens cached at a tenth of list, a 20-step run bills roughly a third
of what the old shape billed.

## Measuring

```bash
DEEPSEEK_API_KEY=sk-... node scripts/cache-probe.mjs 12
```

The probe builds the real request bodies with the real builders, sends them in
sequence like a session, and prints per-turn hit/miss from the API plus whether
each request extended the previous one. It prints nothing if no key is set, so
nothing can be claimed without a measurement.

In the app, the task footer shows `NN% cached` for the run, and every turn is kept
in `cacheTurns` with its hit, miss, retry flag and prefix identity, so a dropped
turn can be traced to the request that caused it.
