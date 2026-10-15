# Mochi container image — API + OpenAI-compatible server.
#
# Build:  docker build -t mochi .
# Run:    docker run --rm -p 8787:8787 -v "$PWD:/workspace" -w /workspace mochi
# Health: curl http://127.0.0.1:8787/api/health
# Token:  printed on start (also written to /workspace/.mochi/daemon/info.json)
#
# The image runs the TypeScript build with the pure-TS fallbacks (native Rust
# accelerators are compiled separately by `npm run build:native` on hosts with
# cargo); behavior is identical, just without the ~3-5x hot-path speedup.

FROM node:22-bookworm-slim AS build
WORKDIR /app
# Dependency layer first so source edits don't re-install the tree.
COPY package.json package-lock.json tsconfig.json bunfig.toml ./
COPY scripts ./scripts
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Runtime needs dist/, the installed dependency tree (optional tree-sitter
# natives), and scripts/ (browser-driver + release helpers referenced by
# doctor/update at runtime).
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/scripts ./scripts
COPY package.json ./
# 8787 = Mochi's default serve port; --host 0.0.0.0 makes it reachable from
# outside the container (serve defaults to 127.0.0.1 for local safety).
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/cli.js", "serve", "--host", "0.0.0.0", "--port", "8787"]
