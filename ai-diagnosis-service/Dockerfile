FROM python:3.12-slim

WORKDIR /app

# Variables d'environnement Python pour le conteneur
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    PORT=3007

# Installer les dépendances Python (asyncpg utilise des wheels précompilées, pas besoin de libpq-dev)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code source
COPY src/ ./src/

EXPOSE ${PORT}

CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-3007}"]
