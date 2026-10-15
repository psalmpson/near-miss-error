FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DB_PATH=/data/nearmiss.db

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./

RUN mkdir -p /data
VOLUME /data
EXPOSE 4400

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:4400/healthz', timeout=4).status==200 else 1)"

# --preload creates/seeds the database once before the workers start
CMD ["gunicorn", "--preload", "--bind", "0.0.0.0:4400", "--workers", "2", "--threads", "4", "--access-logfile", "-", "server:app"]
