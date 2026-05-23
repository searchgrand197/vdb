# Gunicorn configuration — optimised for 1 CPU core / 4 GB RAM server.
#
# Usage:
#   gunicorn -c gunicorn.conf.py config.wsgi:application
#
# Formula: workers = (2 × CPU cores) + 1
workers = 3

# gthread allows each worker to handle multiple requests concurrently using
# threads, which is ideal for I/O-bound Django views (DB queries, file reads).
worker_class = "gthread"
threads = 2

# Bind address (override with GUNICORN_BIND env var or --bind CLI flag in prod)
bind = "0.0.0.0:8000"

# Kill a worker that takes longer than this to handle a request.
timeout = 120

# Keep TCP connections open for up to 5 s — reduces TLS/TCP handshake latency
# on repeat requests from the same client (browser, nginx upstream).
keepalive = 5

# Auto-restart a worker after this many requests to prevent memory leaks.
max_requests = 1000
max_requests_jitter = 100

# Write access logs to stdout so they appear in Docker/systemd journal.
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Preload the Django application into memory before forking workers.
# Reduces per-request import overhead and lowers total RAM usage via
# copy-on-write page sharing between workers.
preload_app = True
