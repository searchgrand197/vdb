# Hospital Management System (HMS)
# naveen code
Django REST API backend + React admin UI.

## Backend

```bash
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

- API: `http://127.0.0.1:8000/api/v1/`
- OpenAPI: `http://127.0.0.1:8000/api/v1/docs/`

## Frontend (React admin)

See **[frontend/README.md](frontend/README.md)**.

```bash
cd frontend
npm install
npm run dev
```

Open **http://127.0.0.1:5173** — Vite proxies `/api/*` to the Django server on port 8000.

## Deployment

- Hostinger VPS (Django + Gunicorn + Nginx): `docs/HOSTINGER_DJANGO_DEPLOY.md`
- One-shot setup script: `scripts/deploy_hostinger.sh`
