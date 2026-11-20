# Chrome Web Store listing

Paste each field into the dashboard. Chrome truncates the summary at 132 characters
and the dashboard shows only the first two lines of the description in search.

## Name (45 max)

    ORBIT

## Summary (132 max)

    An autonomous agent that works the tab you are watching. Bring your own model
    key. No account, no ORBIT server.

(131 characters with normal spacing.)

## Detailed description

An agent that works the tab you are watching.

Give ORBIT an outcome — "compare these five laptops", "fill this form", "find out
whether this vacuum picks up dog hair" — and it reads the page, clicks, types and
scrolls until the answer is there. You watch every step happen, and every
consequential action asks first.

Bring your own model
ORBIT has no account and no server. Add a key from OpenAI, Anthropic, Gemini,
DeepSeek or any OpenAI-compatible endpoint. The key is stored in this browser and
sent straight to that provider.

What it does
• Reads the page you are on, including offscreen content and same-origin frames
• Clicks, types, scrolls and navigates, one step at a time
• Answers general questions with a background web search when the page cannot
• Returns a sortable table, a chart or a few key figures when that reads better
  than a paragraph
• Follow-ups continue the same conversation instead of starting a new one
• Asks before anything that sends, buys, deletes or transfers
• Keeps a step-by-step timeline with a screenshot of each state
• Stops on a step budget and a spend limit you set

What it will not do
• No silent background tabs. It works the tab you are looking at.
• No telemetry. Nothing is sent anywhere except to the model provider you choose.
• No passwords: it never reads or stores what you type into a password field.

Who it is for
People who would rather say the outcome than do the clicking. Prices, comparisons,
forms, research, repetitive checkout — the work that is simple but endless.

Usage limits and model costs are your provider's. You can stop a task at any moment
by closing the panel or pressing Stop.

## Category

Productivity → Tools (category: Productivity; secondary: Developer Tools if offered)

## Language

English (United States)

## Screenshots (1280×800 or 640×400, up to 5)

1. Home: greeting and composer — "Give it the outcome"
2. A finished task: answer, table, timeline
3. Approval: "It asks before anything consequential"
4. Settings: bring your own model
5. Onboarding: "Bring your own model."

## Promotional images (optional)

Small tile 440×280, marquee 1400×560. Skip on the first submission.

## Distribution

Visibility: Public. Regions: all. Pricing: free.

## Screenshots (upload in this order)

    01-home.png      Type the outcome. It does the work.
    02-working.png   You watch it work.
    03-approval.png  It asks before anything that matters.
    04-answer.png    Tables. Charts. Real answers.
    05-model.png     Bring your own model.

All five are 1280 x 800, the store's preferred size. Regenerate with
`node scripts/store-shots.mjs` while `npm run preview` is running.
