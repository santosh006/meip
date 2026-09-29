FROM node:22-bookworm-slim AS app
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]

FROM python:3.12-slim AS worker
WORKDIR /app
COPY news_loader/requirements.txt news_loader/requirements.txt
RUN pip install --no-cache-dir -r news_loader/requirements.txt
COPY news_loader news_loader
CMD ["python", "news_loader/worker.py"]
