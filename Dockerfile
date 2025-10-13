FROM python:3.11-slim

WORKDIR /app

# System deps (optional): tzdata for proper timezone handling
RUN apt-get update && apt-get install -y --no-install-recommends tzdata && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV FLASK_APP=app
EXPOSE 5000

# Run the Flask app using the factory (no need for 'flask run' CLI in container)
CMD ["python", "-c", "from app import create_app; app=create_app(); app.run(host='0.0.0.0', port=5000)"]