# Big-Bro v0.1

A monorepo application with Node.js/Express backend and React frontend, designed for task management with Railway deployment support.

## Features

- **Health Monitoring**: Public health check endpoint
- **Task Management**: Create, list, and update tasks
- **Settings Management**: Store and retrieve application settings
- **Authentication**: Admin key-based authentication
- **Database**: PostgreSQL with auto-schema initialization
- **Rate Limiting**: Built-in protection against abuse
- **SPA Support**: Single-page application with client-side routing

## Architecture

```
big-bro/
├── server/           # Node.js + Express backend
│   ├── index.js      # Main server file
│   └── package.json
├── client/           # React + TypeScript frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── ...
│   └── package.json
├── package.json      # Root workspace configuration
├── .env.example      # Environment variables template
└── README.md
```

## Setup

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (optional for local development)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/G-Dislioglu/Big-Bro.git
cd Big-Bro
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

### Environment Variables

Configure these in `.env` or in your Railway project settings:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `ADMIN_KEY` | Yes | Secret key for API authentication | `your-secret-admin-key-here` |
| `PORT` | No | Server port (default: 3000) | `3000` |
| `DATABASE_URL` | No* | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `CORS_ORIGIN` | No | Allowed CORS origin for API | `http://localhost:5173` |

*DATABASE_URL is optional but required for `/api/settings` and `/api/tasks` endpoints. Without it, these endpoints will return 503.

### Railway Deployment

1. Create a new Railway project
2. Add a PostgreSQL database service
3. Deploy this repository
4. Set environment variables in Railway:
   - `ADMIN_KEY`: Your secret admin key
   - `DATABASE_URL`: Auto-provided by Railway's PostgreSQL service
   - `PORT`: Auto-provided by Railway

Railway will automatically:
- Install dependencies
- Build the client
- Start the server
- Provide HTTPS URL

## Development

### Run in development mode (server + client):
```bash
npm run dev
```

This starts:
- Server on http://localhost:3000
- Client on http://localhost:5173 (with API proxy to server)

### Build for production:
```bash
npm run build
```

### Start production server:
```bash
npm start
```

The server serves the built client files and API on the same port.

## API Endpoints

### Public Endpoints

#### GET /api/health
Health check endpoint (no authentication required).

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-14T12:00:00.000Z",
  "database": "connected"
}
```

### Protected Endpoints

All protected endpoints require `x-admin-key` header matching `ADMIN_KEY` environment variable.

#### GET /api/auth/whoami
Verify authentication.

**Headers:**
```
x-admin-key: your-admin-key
```

**Response:**
```json
{
  "authenticated": true,
  "message": "You are authenticated as admin"
}
```

#### GET /api/settings
Get all settings (requires DATABASE_URL).

**Headers:**
```
x-admin-key: your-admin-key
```

**Response:**
```json
{
  "settings": [
    {
      "key": "theme",
      "value": "dark",
      "updated_at": "2024-01-14T12:00:00.000Z"
    }
  ]
}
```

#### PUT /api/settings
Create or update a setting (requires DATABASE_URL).

**Headers:**
```
x-admin-key: your-admin-key
Content-Type: application/json
```

**Body:**
```json
{
  "key": "theme",
  "value": "dark"
}
```

**Response:**
```json
{
  "setting": {
    "key": "theme",
    "value": "dark",
    "updated_at": "2024-01-14T12:00:00.000Z"
  }
}
```

#### GET /api/tasks
Get all tasks (requires DATABASE_URL).

**Headers:**
```
x-admin-key: your-admin-key
```

**Response:**
```json
{
  "tasks": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "title": "Complete documentation",
      "status": "todo",
      "created_at": "2024-01-14T12:00:00.000Z",
      "updated_at": "2024-01-14T12:00:00.000Z"
    }
  ]
}
```

#### POST /api/tasks
Create a new task (requires DATABASE_URL).

**Headers:**
```
x-admin-key: your-admin-key
Content-Type: application/json
```

**Body:**
```json
{
  "title": "Complete documentation",
  "status": "todo"
}
```

**Response:**
```json
{
  "task": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Complete documentation",
    "status": "todo",
    "created_at": "2024-01-14T12:00:00.000Z",
    "updated_at": "2024-01-14T12:00:00.000Z"
  }
}
```

#### PATCH /api/tasks
Update a task (requires DATABASE_URL).

**Headers:**
```
x-admin-key: your-admin-key
Content-Type: application/json
```

**Body:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Updated title",
  "status": "in-progress"
}
```

**Response:**
```json
{
  "task": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Updated title",
    "status": "in-progress",
    "created_at": "2024-01-14T12:00:00.000Z",
    "updated_at": "2024-01-14T12:00:00.000Z"
  }
}
```

## Database Schema

### settings table
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### tasks table
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

The schema is automatically created on server start if DATABASE_URL is configured.

## Scripts

Root workspace scripts:

- `npm run dev` - Run server and client in development mode (concurrently)
- `npm run build` - Build client for production
- `npm start` - Start production server (serves API + static client)
- `npm run lint` - Lint placeholder (add linter as needed)

Server scripts:

- `npm run dev -w server` - Run server in development mode with nodemon
- `npm run start -w server` - Start production server

Client scripts:

- `npm run dev -w client` - Run client in development mode with Vite
- `npm run build -w client` - Build client for production
- `npm run preview -w client` - Preview production build

## Security

- **Authentication**: All protected endpoints require `x-admin-key` header
- **Rate Limiting**: 100 requests per 15 minutes per IP for `/api/*` endpoints
- **Helmet**: Security headers enabled by default
- **CORS**: Configurable via `CORS_ORIGIN` environment variable
- **Input Validation**: Request body validation on all mutation endpoints

## Error Handling

The server provides clear error messages:

- `401 Unauthorized`: Invalid or missing admin key
- `400 Bad Request`: Invalid request body or missing required fields
- `404 Not Found`: Resource not found
- `503 Service Unavailable`: DATABASE_URL not configured (for settings/tasks endpoints)
- `500 Internal Server Error`: Unexpected server errors

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request
