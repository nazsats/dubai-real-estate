# Dubai AI Broker Assistant — backend API
# Works as-is on Render, Railway, Fly.io, and Google Cloud Run.
FROM python:3.12-slim

# Don't buffer stdout, so logs show up live in the host's log viewer.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies first so this layer stays cached when only app code changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .

# Run as a non-root user.
RUN useradd --create-home --uid 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Hosts inject the port to listen on; default to 8000 for plain `docker run`.
ENV PORT=8000
EXPOSE 8000

# `sh -c` so $PORT is expanded at runtime rather than baked in at build time.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
