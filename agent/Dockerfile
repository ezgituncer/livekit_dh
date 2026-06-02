FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt ./

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN python voice_agent_configurable.py download-files || echo "WARN: download-files failed for voice_agent_configurable.py"

# No default CMD — each compose service selects its own agent script.
