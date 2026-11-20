# Security policy

ORBIT automates a user's logged-in browser, so security bugs are treated seriously.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting (**Security → Report a vulnerability**) rather than a public issue. Include:

- affected version/commit,
- a minimal reproduction,
- impact (credential exposure, unintended action, permission bypass, prompt injection, etc.).

We aim to acknowledge within 72 hours and to publish a fix and advisory for confirmed issues.

## Supported versions

The `main` branch and the latest published release receive fixes. There are no long-term support branches.

## Security model (summary)

- Inference goes directly from the extension to the provider the user configured. No ORBIT server exists.
- API keys are stored in `chrome.storage.session` by default, or `chrome.storage.local` if the user opts in. Extension storage is **not** an encrypted vault and is not advertised as one.
- Keys are read only in the side panel/background context. They are never injected into content scripts, page prompts, DOM, logs or diagnostics.
- Models can only emit the typed `orbit_action` protocol. There is no code execution, selector injection or privileged API surface exposed to the model.
- Page content is untrusted input. The system prompt labels it as data and forbids following instructions found in pages; approval policy is enforced in code, not by the model.
- Host access is optional and per-origin. Sensitive actions require explicit approval tied to the specific action.

Full details: [docs/security.md](docs/security.md).

## Out of scope

- Sites deliberately blocking automation, CAPTCHA solving, or bypassing access controls. ORBIT must stop and defer to a human.
- Attacks that require an already-compromised browser profile or a malicious extension with equivalent privileges.
- Cost of provider inference.
