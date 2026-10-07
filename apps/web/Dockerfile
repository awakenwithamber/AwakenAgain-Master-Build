# Amber's Alchemy Apothecary — Next.js standalone container
# Provider-neutral: runs on any Node/Docker host (Coolify, VPS, etc.).
# Build:  docker build -t apothecary .
# Run:    docker run -p 3000:3000 \
#           -e NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_... \
#           -e NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com \
#           apothecary
# In Coolify, set the two NEXT_PUBLIC_* values as environment variables
# (they are inlined at build time) and redeploy after changing them.

# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Public (browser-safe) env vars are inlined into the client bundle at build
# time. Coolify: define these as build-time environment variables.
ARG NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=""
ARG NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
ENV NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=$NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- run ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Dev-only JSONL order ledger writes next to cwd; keep the workdir writable
# for the app user. Production order store binding is still NEEDS VERIFICATION
# (see MIGRATION_LEDGER.md) — set ORDERS_LEDGER_PATH to a mounted volume.
RUN chown nextjs:nodejs /app
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
