# Agent Reporting Guidelines

This document summarizes the reporting protocol for AI agents working on this repository.

## Overview

All AI agents (Copilot, etc.) working on this repository must produce standardized reports for every task or PR they create or update. Reports are repository-first and must not rely on PR descriptions.

## Report Requirements

### Where Reports Are Produced

1. **Committed Markdown File (mandatory)**: `docs/agent-reports/<PR-or-task-id>-report.md` (source of truth)
2. **PR Description/Comment (optional)**: May mirror the report but must never block completion

### Report Template Structure

Every report must include these 9 sections:

1. **Summary** (max 8 bullets) – what was implemented/changed
2. **API changes**: method + path + auth (Admin-Key yes/no) + purpose
3. **DB changes**: tables/columns/indexes/constraints + why + idempotency note
4. **UI changes**: pages/routes/components + where reachable
5. **ENV changes**: new vars + where documented (.env.example/README) + server-only?
6. **Breaking changes** vs previous version (deploy/build/router/migrations)
7. **Secrets self-check**: patterns checked (e.g. sk-, pk_, DATABASE_URL, ADMIN_KEY, bearer, token, .env) + result
8. **Top changed files**: path + 1 sentence why
9. **How to test**: exact steps + commands

## Testing Expectations

- If the repo has tests, run them
- If not, perform minimal build checks for server/client where feasible
- Always document what was tested in "How to test" section

## Report Storage

All agent reports are stored in:
```
docs/agent-reports/<PR-or-task-id>-report.md
```

## Non-Negotiables

- Never commit secrets (no real keys/tokens/URLs)
- Do not change deployment approach unless explicitly asked
- Keep DB init idempotent (safe to run on every boot)
- All new server endpoints must enforce Admin-Key auth unless explicitly stated otherwise

## Reference

For complete details, see [.github/copilot-instructions.md](../.github/copilot-instructions.md)
