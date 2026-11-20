# Publish checklist

The package is built: `.output/orbit-0.3.0-chrome.zip` (191 kB, 14 files, no source maps,
no dev-only code). Everything a reviewer reads is in this folder.

## Only you can do these

1. **Register.** https://chrome.google.com/webstore/devconsole — one-time **$5** fee,
   email verified, 2FA on the account. A publisher name is public, so use the brand
   (ORBIT) rather than a personal name if that is the intent.
2. **Host the privacy policy** at a public URL. A GitHub repo file works:
   push `store/PRIVACY.md` and use the blob URL, or turn on Pages and use the page URL.
   Chrome rejects a submission with no reachable policy URL.
3. **Upload** `.output/orbit-0.3.0-chrome.zip` in the dashboard.
4. **Fill the listing** from `LISTING.md`; upload the five images in `screenshots/`
   (already 1280×800).
5. **Fill the privacy tab** from `PERMISSION-JUSTIFICATIONS.md`: single purpose,
   one justification per permission, the data-usage radio buttons, and the third-party
   disclosure (page content goes to the user's own model provider).
6. **Choose visibility.** Public, all regions, free. Unlisted is the safer first run if
   you want to test installs before anyone can find it.
7. **Submit for review.** Typically 1–5 days; broad optional host permissions can add
   a round of questions from a human reviewer.

## Before you upload

- Consider `npm version 1.0.0 --no-git-tag-version`. A store listing showing 0.3.0
  reads as a beta to anyone browsing.
- The manifest is already review-friendly: **no `<all_urls>` in `host_permissions`** —
  site access is optional and requested per origin at task start. Keep it that way;
  moving it into `host_permissions` is the single most common cause of rejection for
  browser agents.
- Nothing loads code from a server: the "remote code" answer is a clean No.
- `minimum_chrome_version` is 116 for the side panel API.

## After it is live

- Every later release: bump the version, `npx wxt zip`, upload the new zip. The listing
  and privacy answers persist.
- Keep `.output/` out of git; `store/` is fine to commit.
