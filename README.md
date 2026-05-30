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

## iCloud Sync lokal testen

1. `.env` aus `.env.example` erstellen und echte lokale Werte setzen:

```bash
cp .env.example .env
```

Wichtig sind insbesondere:

```env
ICLOUD_USERNAME=deine-icloud-adresse@example.com
ICLOUD_APP_PASSWORD=app-spezifisches-passwort
CALDAV_URL=https://caldav.icloud.com/
ADMIN_PIN=123456
SESSION_SECRET=ein-langer-zufaelliger-session-secret
DEFAULT_TIMEZONE=Europe/Vienna
SYNC_DAYS_AHEAD=3
```

Für iCloud muss ein app-spezifisches Passwort verwendet werden. Das normale Apple-ID-Hauptpasswort darf nicht in die `.env`.

2. Datenbank initialisieren und Seed-Daten für die Familie anlegen:

```bash
npm run db:push
npm run db:seed
```

3. App lokal starten:

```bash
npm run dev
```

4. Admin-Session per curl erstellen:

```bash
curl -i -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"pin":"123456"}' \
  http://localhost:3000/api/admin/login
```

5. Read-only iCloud-CalDAV-Sync starten:

```bash
curl -i -b cookies.txt -X POST \
  http://localhost:3000/api/admin/sync/icloud
```

6. Sync-Status prüfen:

```bash
curl -i -b cookies.txt \
  http://localhost:3000/api/admin/sync/status
```

7. Dashboard öffnen:

```text
http://localhost:3000/dashboard
```

Der Sync legt beim ersten Lauf gefundene iCloud-Kalender als `CalendarSource`-Einträge an. Sind bereits aktivierte Kalenderquellen vorhanden, werden nur diese synchronisiert. Kalendertermine werden read-only gelesen, in `FamilyEvent` normalisiert und über eine stabile `externalId` dedupliziert. Lokale Aufgaben und lokale Events werden dabei nicht gelöscht.
