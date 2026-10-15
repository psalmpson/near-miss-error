# Near Miss Error log

Self-hosted web app for logging pharmacy near-miss errors and producing the monthly summary report.

## Run
```
docker compose up -d --build
```
Open http://SERVER-IP:4400. Data lives in `./data/nearmiss.db` (SQLite), so back up that folder.

## Settings you should change (docker-compose.yml)
- `ADMIN_PIN` – opens **Settings** (gear icon, top right) and is needed to delete records.
- `PHARMACIES` – pharmacies created on first start (comma separated). Manage later in Settings.
- `TZ` – time zone.

## Where things are
- **Log a near miss** – the form, based on the Near Miss Form.
- **Records** – filter by pharmacy, month, error type or search; edit or delete.
- **Monthly report** – tallies in the Summary Report layout; filter by pharmacy; download Excel (summary + full log) or print.
- **Settings** (PIN) – add / rename / hide drugs (paste many at once) and pharmacies. The drug list starts with the 1,442 items from the Summary Report sheet.
