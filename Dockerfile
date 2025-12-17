FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    FLASK_APP=main.py

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc 

RUN pip install --upgrade pip && \
    pip install -r requirements.txt

COPY . .

CMD ["python", "-m", "flask", "run", "--host=0.0.0.0", "--port=5000"]