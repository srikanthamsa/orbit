# Publish ORBIT 1.0.0

## Done and verified

- **Package**: `.output/orbit-1.0.0-chrome.zip`, 14 files, 192 kB, no source maps.
- **Loads in real Chrome**: `npm run smoke` loads the unpacked build, opens the side panel,
  round-trips storage and reports zero console errors.
- **Manifest** as shipped:
  - `name: ORBIT` · `version: 1.0.0` · `minimum_chrome_version: 116`
  - permissions: sidePanel, storage, tabs, tabGroups, scripting, activeTab, clipboardWrite,
    declarativeNetRequestWithHostAccess
  - `host_permissions`: the four model APIs and `html.duckduckgo.com` only
  - `optional_host_permissions`: `<all_urls>`, granted per site at task start, never at install
- **Store copy**: `LISTING.md` (name, summary, description, category, screenshot order).
- **Privacy policy**: `docs/privacy.md`.
- **Review answers**: `PERMISSION-JUSTIFICATIONS.md`.
- **Screenshots**: five 1280x800 slides in `screenshots/`.

## What is left, in order

1. **Register** at https://chrome.google.com/webstore/devconsole
   One-time **$5**, verified email, 2FA. The publisher name is public: use ORBIT.
2. **Publish the privacy policy** and copy its URL.
   `docs/privacy.md` is on `main`; the URL is
   `https://github.com/srikanthamsa/orbit/blob/main/docs/privacy.md`
   A GitHub blob URL is acceptable. A Pages URL looks better in the listing.
3. **Upload** `.output/orbit-1.0.0-chrome.zip`.
4. **Listing tab** from `LISTING.md`; upload the five slides in order 01 to 05.
5. **Privacy tab** from `PERMISSION-JUSTIFICATIONS.md`:
   - single purpose
   - one justification per permission
   - data usage radios: page content is processed, never sold, never used for anything
     except answering the user's task
   - third-party disclosure: page content is sent to the model provider the user configured
6. **Visibility**: Unlisted for the first submission, then switch to Public once it is approved
   and you have installed it yourself from the store.
7. **Submit**. 1 to 5 days. Broad optional host permissions can add one round of reviewer
   questions; the answers are already written.

## After approval

- Install from the store yourself and run one task on a real site.
- Then flip to Public and tag `v1.0.1` only if a fix is needed.
- Every later release: bump `package.json`, `npm run zip`, upload. The listing, privacy
  answers and screenshots persist between versions.
