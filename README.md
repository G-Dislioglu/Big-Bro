# Big-Bro v0.2

A Railway-ready monolith with Node.js/Express backend and React/TypeScript frontend for task and settings management.

**v0.2 Strategy Lab:** Card-based idea management with links, crossing heuristics, and visual strategy exploration (MVP, no AI yet).

---

## Features

- **Health Monitoring**: Public health check endpoint with DB status
- **Task Management**: CRUD operations for tasks (todo/doing/done)
- **Settings Management**: Key-value store for application settings
- **Admin Authentication**: Admin key-based authentication via x-admin-key header
- **Optional Database**: PostgreSQL with auto-schema initialization (returns 503 when DATABASE_URL not set)
- **Rate Limiting**: In-memory rate limiting (100 req/15min per IP)
- **SPA Support**: Single-page application with client-side routing
- **Railway Ready**: Auto-deployment with zero config

---

## Architecture

```
big-bro/
├── server/                  # Node.js + Express backend (CommonJS)
│   ├── src/
│   │   ├── config.js       # Environment configuration
│   │   ├── db.js           # Optional PostgreSQL pool & schema
│   │   ├── server.js       # Main server entry point
│   │   ├── middleware/     # Auth, rate limit, requireDb, error handlers
│   │   └── routes/         # Health, auth, settings, tasks routes
│   └── package.json
├── client/                  # React + TypeScript frontend
│   ├── src/
│   │   ├── services/api.ts # API client helpers
│   │   ├── App.tsx         # Main UI component
│   │   └── main.tsx
│   └── package.json
├── package.json             # Root workspace config
├── .env.example             # Environment variables template
└── README.md
```

---

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL (optional, for tasks/settings endpoints)

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment** (create `.env` from `.env.example`):
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set required variables:
   - `ADMIN_KEY`: Your secret admin authentication key (required)
   - `DATABASE_URL`: PostgreSQL connection string (optional)
   - `PORT`: Server port (default: 3000)
   - `CORS_ORIGIN`: CORS origin (optional, e.g., http://localhost:5173)

3. **Run development servers** (API + UI):
   ```bash
   npm run dev
   ```
   
   - API: http://localhost:3000
   - UI: http://localhost:5173

4. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

---

## Railway Deployment

### Environment Variables

Set these in Railway dashboard:

**Required:**
- `ADMIN_KEY`: Secret key for admin authentication

**Optional (Railway auto-provides database):**
- `DATABASE_URL`: PostgreSQL connection (if using Railway Postgres add-on)
- `PORT`: Auto-provided by Railway
- `CORS_ORIGIN`: Set if you need specific CORS config

### Deployment Steps

1. Connect GitHub repository to Railway
2. Set `ADMIN_KEY` environment variable
3. (Optional) Attach PostgreSQL add-on - DATABASE_URL will be auto-set
4. Railway auto-detects build/start commands from package.json
5. Deploy! 🚀

**Note:** Without DATABASE_URL, `/api/settings` and `/api/tasks` will return 503 with a clear message. `/api/health` and `/api/auth/whoami` work without database.

---

## API Endpoints

### Public

- `GET /api/health` - System health check with DB status

### Protected (require `x-admin-key` header)

- `GET /api/auth/whoami` - Verify authentication, returns `{role: "admin"}`
- `GET /api/settings` - Get all settings (requires DB)
- `PUT /api/settings` - Update/create setting with `{key, value}` (requires DB)
- `GET /api/tasks` - Get all tasks (requires DB)
- `POST /api/tasks` - Create task with `{title, status?}` (requires DB)
- `PATCH /api/tasks` - Update task with `{id, title?, status?}` (requires DB)

**Task statuses:** `todo`, `doing`, `done`

---

## Scripts

- `npm run dev` - Start both server (nodemon) and client (vite) in development
- `npm run build` - Build client for production
- `npm start` - Start production server (serves API + client/dist)

---

## Database Schema

When `DATABASE_URL` is set, schema is auto-created on startup:

**settings table:**
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**tasks table:**
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT tasks_status_check CHECK (status IN ('todo', 'doing', 'done'))
);
```

---

## Copilot Agent Reporting

- Agents MUST include an `## AGENT REPORT` section in the PR description.
- A copy of the same report must be committed to `docs/agent-reports/<PR-or-task-id>-report.md` (e.g. `docs/agent-reports/pr-4-report.md`).
- Keep reports short and free of secrets. Follow the template in `.github/copilot-instructions.md`.

---

## License

Private - © 2024