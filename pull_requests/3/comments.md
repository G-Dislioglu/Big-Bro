REVIEW-REPORT

1) Summary
- Strategy Lab (Cards) ergänzt inkl. CRUD, Links und Crossing-Heuristik (ohne KI)
- Neue Express-Routen für Cards, Card-Links, Crossing (alle via x-admin-key)
- DB-Schema um cards, card_links, card_runs erweitert; Tasks/Settings bleiben
- UI: View-Toggle Tasks ↔ Strategy Lab, Card-Grid mit Suche/Filter, Editor, Links-Panel, Crossing-Vorschläge mit Approve/Reject
- README auf v0.2 mit Hinweis Strategy Lab; CONTRIBUTING.md hinzugefügt; .push/.trigger entfernt
- Health-Version auf 0.2.0 angehoben; bestehende Security-Middleware (Helmet/CORS/Rate-Limit) bleibt
- Frontend-API-Client um Card-/Link-/Crossing-Aufrufe erweitert

2) Neue API-Endpunkte
- GET /api/cards – Admin-Key: ja – Cards listen (Filter: tag/type/status)
- POST /api/cards – Admin-Key: ja – Card anlegen
- PATCH /api/cards/:id – Admin-Key: ja – Card aktualisieren
- DELETE /api/cards/:id – Admin-Key: ja – Soft-Delete (status=archived)
- GET /api/cards/:id/links – Admin-Key: ja – Links (outgoing+incoming) für Card
- POST /api/card-links – Admin-Key: ja – Link anlegen
- PATCH /api/card-links/:id – Admin-Key: ja – Link bearbeiten
- DELETE /api/card-links/:id – Admin-Key: ja – Link löschen
- POST /api/crossing/run – Admin-Key: ja – Heuristische Vorschläge (Cards/Links) basierend auf Tags/Typen/Mode

3) DB-Änderungen
- Neue Tabellen: cards (uuid PK, title/type/content/tags/status, timestamps), card_links (uuid PK, FK von/to cards, link_type, strength 1–5, note, timestamps, ON DELETE CASCADE), card_runs (uuid PK, input/output jsonb, created_at)
- Zweck: persistente Idea-/Strategy-Cards, Relationen/Bridging via Links, Logging für spätere Runs
- Init idempotent: CREATE TABLE IF NOT EXISTS in ensureSchema()

4) UI-Änderungen
- Neue Ansicht „Strategy Lab“ (Toggle in UI): Cards-Grid mit Suche/Filter (type/status)
- Card-Editor (Create/Update), Links-Panel (Outgoing/Incoming, Create/Delete), Crossing-Dialog mit Approve/Reject
- Erreichbar über View-Selector Tasks ↔ Strategy Lab in der Hauptseite (App.tsx), sobald angemeldet

5) ENV-Änderungen
- Keine neuen Variablen; weiterhin ADMIN_KEY, DATABASE_URL (optional), PORT, CORS_ORIGIN
- Dokumentation: .env.example unverändert, README ergänzt Hinweis v0.2
- Server-only: ADMIN_KEY, DATABASE_URL, PORT, CORS_ORIGIN (Admin-Key nur im UI-State, nicht persistiert)

6) Breaking Changes vs v0.1
- API erweitert um Cards/Links/Crossing (Admin-Key-pflichtig); Tasks/Settings unverändert
- DB: neue Tabellen erforderlich; bei fehlender DATABASE_URL liefern Card/Link/Crossing-Endpoints 503
- Build/Deploy unverändert (Railway-ready, server serves dist); Health-Version nun 0.2.0
- Router: server.js registriert neue Routen; SPA-Serving unverändert

7) Secrets-Selfcheck
- Geprüfte Muster: „sk-“, „pk_“, „token“, „bearer“, „ADMIN_KEY“, „DATABASE_URL“, „.env“
- Keine Secrets/Real Keys gefunden; .env.example bleibt nur Platzhalter

8) Top 10 geänderte Dateien
- README.md – Version auf 0.2, Hinweis Strategy Lab
- CONTRIBUTING.md – Kurzleitfaden Branch/PR/Env
- client/src/App.tsx – Strategy-Lab-UI (Cards, Links, Crossing, View-Toggle)
- client/src/App.css – Styles für Cards/Links/Crossing
- client/src/services/api.ts – API-Client für Cards/Links/Crossing
- server/src/db.js – ensureSchema um cards/card_links/card_runs erweitert (idempotent)
- server/src/routes/cards.js – CRUD + Links-Listing für Cards
- server/src/routes/card-links.js – CRUD für Card-Links
- server/src/routes/crossing.js – Heuristischer Crossing-Endpoint
- server/src/server.js – Neue Router eingebunden; server/src/routes/health.js Version auf 0.2.0

BLOCKER: keiner erkannt