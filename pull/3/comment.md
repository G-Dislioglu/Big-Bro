REVIEW-REPORT

1) Summary
- Strategy Lab (cards) added inkl. CRUD, Links und Crossing-Heuristik (ohne KI)
- Neue Express-Routen für Cards, Card-Links und Crossing, alle via x-admin-key geschützt
- DB-Schema um cards, card_links, card_runs erweitert; tasks/settings bleiben
- UI: View-Toggle Tasks ↔ Strategy Lab, Card-Grid mit Suche/Filter, Editor, Links-Panel, Crossing-Vorschläge mit Approve/Reject
- README auf v0.2, kurzer Hinweis auf Strategy Lab; CONTRIBUTING.md ergänzt; .push/.trigger entfernt
- Version in Health auf 0.2.0 gehoben; Rate-Limit/Helmet/CORS-Setup bleibt
- API-Client im Frontend um Card-/Link-/Crossing-Aufrufe erweitert

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
- Neue Tabellen: cards (uuid PK, title/type/content/tags/status, timestamps), card_links (uuid PK, FK von/to cards, link_type, strength 1-5, note, timestamps, ON DELETE CASCADE), card_runs (uuid PK, input/output jsonb, created_at)
- Zweck: persistente Idea-/Strategy-Cards, Relation/Bridging via Links, spätere Runs-Logs
- Init ist idempotent: CREATE TABLE IF NOT EXISTS in ensureSchema()

4) UI-Änderungen
- Neue Ansicht „Strategy Lab“ (Toggle in UI): Cards-Grid mit Suche/Filter (type/status)
- Card-Editor (Create/Update), Links-Panel (Outgoing/Incoming, Create/Delete), Crossing-Dialog mit Approve/Reject
- Navigation: im eingeloggten Zustand per View-Selector Tasks ↔ Strategy Lab in App.tsx

5) ENV-Änderungen
- Keine neuen Variablen; weiterhin ADMIN_KEY, DATABASE_URL (optional), PORT, CORS_ORIGIN
- Dokumentation: .env.example unverändert, README ergänzt Hinweis v0.2 aber keine neuen ENV-Schlüssel
- Server-only: ADMIN_KEY, DATABASE_URL, PORT, CORS_ORIGIN (nicht im Client persistiert; Admin-Key nur im UI-State)

6) Breaking Changes vs v0.1
- API erweitert um Cards/Links/Crossing (Admin-Key-pflichtig); Tasks/Settings unverändert
- DB: neue Tabellen erforderlich für Strategy Lab; bei fehlender DATABASE_URL liefern Card/Link/Crossing-Endpoints 503
- Build/Deploy unverändert (Railway-ready, start server serves dist); Version jetzt 0.2.0 in Health
- Router: server.js registriert neue Routen; SPA-Serve unverändert

7) Secrets-Selfcheck
- Geprüfte Muster: "sk-", "pk_", "token", "bearer", "ADMIN_KEY", "DATABASE_URL", ".env"; keine Secrets/Real Keys gefunden
- Keine neuen URLs/Secrets im Code; .env.example bleibt placeholder

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
- server/src/server.js – Neue Router eingebunden (cards, card-links, crossing); health version bump in routes/health.js

BLOCKER: keiner erkannt