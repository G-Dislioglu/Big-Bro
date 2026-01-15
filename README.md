# Big-Bro v0.1

A monorepo application with Node.js/Express backend and React frontend, designed for task management with Railway deployment support.

---

## Status

This repository is actively deployed on Railway.  
Any commit to the `main` branch triggers a fresh redeploy.

---

## Features

- **Health Monitoring**: Public health check endpoint
- **Task Management**: Create, list, and update tasks
- **Settings Management**: Store and retrieve application settings
- **Authentication**: Admin key-based authentication
- **Database**: PostgreSQL with auto-schema initialization
- **Rate Limiting**: Built-in protection against abuse
- **SPA Support**: Single-page application with client-side routing

---

## Architecture

big-bro/
├── server/ # Node.js + Express backend
│ ├── index.js # Main server file
│ └── package.json
├── client/ # React + TypeScript frontend
│ ├── src/
│ │ ├── App.tsx
│ │ ├── main.tsx
│ │ └── ...
│ └── package.json
├── README.md
└── package.json

yaml
Code kopieren

---

## Deployment

The application is deployed automatically via GitHub → Railway.

Any commit to the `main` branch triggers a redeploy.

---

_Last update: redeploy trigger_
