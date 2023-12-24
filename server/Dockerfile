FROM python:3.10-slim

WORKDIR /usr/src/app

COPY server.py .
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 37043

ENV REDIS_URL=redis://redis

CMD ["python", "./server.py"]