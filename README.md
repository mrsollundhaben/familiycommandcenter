# Family Command Center

Lokales, Node.js/Next.js-basiertes Familien-Dashboard für iCloud-Kalender und lokale Aufgaben.

## Erste lokale Schritte

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

## MVP-Grundlagen

- `/dashboard` und `/dashboard/today`: kindgerechte Tagesansicht
- `/admin`: geschützter Elternbereich über `ADMIN_PIN`
- `/api/dashboard/today`: aggregierte Dashboard-Daten
- `/api/tasks/:id/done`: Aufgaben können von Kindern abgehakt werden
- `/api/admin/sync/icloud`: read-only Sync-Grenze für iCloud/CalDAV

Keine iCloud-Secrets werden im Browser ausgeliefert. iCloud-Zugangsdaten werden ausschließlich über Environment Variables gelesen.
