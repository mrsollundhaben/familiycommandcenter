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

## Prisma-Version

Dieses Projekt verwendet bewusst **Prisma 6.19.3** und pinnt sowohl `prisma` als auch `@prisma/client` exakt auf diese Version. Bitte nicht auf Prisma 7 upgraden, solange `prisma/schema.prisma` noch das klassische Prisma-6-Datasource-Format mit `url = env("DATABASE_URL")` nutzt.

Falls Prisma versehentlich auf Version 7 aktualisiert wurde oder Fehler zur Datasource-URL auftreten, zurück auf Prisma 6 pinnen und den Client neu generieren:

```bash
npm install prisma@6.19.3 @prisma/client@6.19.3
npx prisma generate
```

## Lokaler Test nach iCloud-Sync-Fix

```bash
cd <project>
cp .env.example .env
# .env bearbeiten und iCloud App-spezifisches Passwort eintragen
npm install
npx prisma generate
npm run db:push
npm run db:seed
npm run dev
```

Admin Login und Sync per curl:

```bash
curl -i -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"pin":"123456"}' \
  http://localhost:3000/api/admin/login

curl -i -b cookies.txt -X POST \
  http://localhost:3000/api/admin/sync/icloud

curl -i -b cookies.txt \
  http://localhost:3000/api/admin/sync/status
```

Erwartung:

- Kein Fehler `options.exceptions.forEach is not a function`.
- Status idealerweise `success`, oder `partial` nur bei echten nicht-parsbaren Einzelereignissen.
- `eventsFetched > 0`, wenn iCloud-Termine im Zeitraum vorhanden sind.
- Das Dashboard zeigt importierte Termine unter `/dashboard/today`.

## Turbopack-Panic beim lokalen Adminbereich

Der lokale Entwicklungsstart verwendet bewusst den stabileren Webpack-Compiler:

```bash
npm run dev
```

Das Script ruft `next dev --webpack` auf. Hintergrund: In manchen lokalen Next.js/Turbopack-Versionen kann beim Öffnen von App-Router-Endpunkten wie `/admin` ein Turbopack-Panic mit `Next.js package not found` auftreten. Für dieses Projekt ist Webpack im Entwicklungsmodus die stabilere Standardwahl.

Falls Turbopack bewusst getestet werden soll:

```bash
npm run dev:turbo
```

Wenn nach einem Turbopack-Panic weiterhin Cache-Probleme auftreten, den lokalen Next-Cache löschen und danach wieder mit Webpack starten:

```bash
rm -rf .next
npm run dev
```
