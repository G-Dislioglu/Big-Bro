# Big-Bro – Copilot Instructions (Repo-wide)

## Non-negotiables
- Never commit secrets. No real keys/tokens/URLs.
- Do not change deployment approach unless explicitly asked.
- Keep DB init idempotent (safe to run on every boot).
- All new server endpoints must enforce Admin-Key auth unless explicitly stated otherwise.

## Reporting Protocol (MANDATORY for every task/PR you create or update)
At the end of EVERY task, you MUST produce an "AGENT REPORT" committed to the repo:

- Create `docs/agent-reports/<PR-or-task-id>-report.md` using the Report Template below. This repo file is the source of truth.
- Updating the PR description/comment with the same content is optional and must never block completion.

### Report Template (always use these headings)
1) Summary (max 8 bullets) – what was implemented/changed
2) API changes: method + path + auth (Admin-Key yes/no) + purpose
3) DB changes: tables/columns/indexes/constraints + why + idempotency note
4) UI changes: pages/routes/components + where reachable
5) ENV changes: new vars + where documented (.env.example/README) + server-only?
6) Breaking changes vs previous version (deploy/build/router/migrations)
7) Secrets self-check: patterns checked (e.g. sk-, pk_, DATABASE_URL, ADMIN_KEY, bearer, token, .env) + result
8) Top changed files: path + 1 sentence why
9) How to test (exact steps + commands)

## Testing expectations
- If the repo has tests, run them. If not, do a minimal build check for server/client where feasible and report what you ran in "How to test".
