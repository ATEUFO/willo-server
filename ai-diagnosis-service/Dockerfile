FROM python:3.11-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=3007
EXPOSE ${PORT}

CMD ["sh", "-c", "uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-3007}"]

