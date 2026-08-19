# Contributing to Tailor AI

Thanks for wanting to help! Tailor AI is MIT-licensed and self-hosted — every contribution makes it better for everyone job-hunting with it.

## Ways to contribute

- **Report bugs** — open an issue with: what you did, what you expected, what happened, and (if possible) the browser console / server logs.
- **Suggest features** — open an issue with the problem you're trying to solve, not just the feature name.
- **Write code** — PRs welcome! Small, focused changes get merged fastest.
- **Docs** — README, this file, `scripts/HOW-TO-INSTALL.md`, and `docs/` all need love.
- **Spread the word** — star the repo, share it with someone who's job-hunting, post about it.

## Getting started

1. Fork the repo and clone it.
2. `npm install` (Node 18+), then `npm run dev` for local development (no Docker needed).
3. Make your change.
4. Run the quality gate before submitting:

```bash
npx tsc --noEmit      # type check — must be clean
npx vitest run        # tests — must all pass
npx vite build        # production build — must succeed
```

5. Open a PR with a clear title and description. Done!

## Code conventions

- TypeScript everywhere (server + client), no `any` where it can be avoided.
- No comments unless they explain a *why* (not a *what*).
- API routes live in `server.ts`; storage in `server/storage/`; screens in `src/components/`.
- New endpoints need a live verification (curl + browser) before the PR is complete.

## Issue labels

- `good first issue` — small, well-scoped, great for your first PR.
- `bug` / `enhancement` / `documentation` — use them so the board stays navigable.

## Questions?

Open a discussion — we're friendly.