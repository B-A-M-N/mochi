---
name: docker-k8s
description: Containerize and orchestrate services — Dockerfile discipline, image size/security, compose for local dev, Kubernetes manifests/helm, and production pod hygiene. Use when containerizing an app, fixing slow/bloated builds, debugging k8s deployments, or writing manifests.
---

# Containers and Kubernetes Procedure

Containers are a packaging contract: same artifact from laptop to prod. K8s is a reconciliation loop: declare state, and make your declarations match reality.

## 1. Dockerfile discipline (every line earns its layer)
- Multi-stage: builder stage with toolchains, runtime stage with ONLY the artifact + runtime deps. Distroless/alpine/scratch bases where the stack allows.
- Layer ordering by volatility: deps lockfiles copied + installed BEFORE source (the cache pays for itself daily). One RUN per logical step, `--no-cache-dir`/`--omit=dev`/rm-var-cache in the SAME layer (later-layer deletes don't shrink images).
- `.dockerignore` complete (node_modules, .git, secrets) — the build context that includes `.git` is a slow leak of both bytes and secrets.
- Non-root USER, and the image runs with a read-only rootfs in production (write to declared volumes/tmpfs only).

## 2. The image as an artifact (build once, promote)
- Tag with the git SHA (immutable), not just `latest` (mutable, untraceable). Build ONCE in CI, promote the SAME digest through staging -> prod (rebuilding per env means you ship different binaries than you tested).
- Scan images in CI (trivy/grype); FAIL on critical CVEs in the app layer; base-image refresh automated weekly (renovate/dockerfile bump) — unpatched base images are the slowest security incident.
- Size matters for pull latency (cold node start = pull + boot): the 1.2GB image is a cold-scale incident multiplier. Measure: `docker history` is the bill.

## 3. Local dev (compose)
- `docker compose up` = the whole stack in one command: app + db + queue + seed data. The dev setup living in someone's head is a bus-factor bug.
- Bind-mount source with reload; volumes for data; healthchecks so dependent services wait. Compose files tested like code (a broken compose is a broken morning for the whole team).

## 4. Kubernetes declarations (the reconciliation mindset)
- Every Deployment: resource requests AND limits (requests = scheduling truth, limits = the OOM dial — set requests from measured usage, not vibes), liveness + readiness probes (readiness = traffic gate, liveness = restart trigger — a liveness probe that checks dependencies restarts your pod in a cascade; don't), and a PodDisruptionBudget for anything that must stay up.
- Graceful shutdown: SIGTERM handler drains connections (readiness flips first, then drain, then exit) — the 30s default termination grace period is a design input, not a detail.
- Config: ConfigMaps/Secrets mounted (env for config, projected volumes for certs); secrets from your secret store synced in (external-secrets), not pasted into YAML.
- Rollouts: `maxSurge`/`maxUnavailable` tuned for capacity; rollback is `kubectl rollout undo` (or Argo/Flux history) — tested BEFORE you need it.

## 5. Debugging pods (the loop)
- CrashLoopBackOff: `kubectl logs --previous` FIRST (the current logs are of the freshly-crashed attempt), describe for events (OOMKilled, probe failures are event-line facts).
- Pending: describe the pod — unschedulable reasons (insufficient resources, taints, affinity) are spelled out in events. ImagePullBackOff: usually a typo'd tag or a missing registry secret.
- Service-traffic debugging: endpoints exist? (`kubectl get endpoints`) — a service with no endpoints is a selector typo, and the DNS is fine.

## 6. Verify
- The rebuild test: fresh clone + `compose up` + seed = working app in <=10 min. This test IS the onboarding doc.
- The zero-downtime drill: rollout a new version during synthetic traffic; assert no 5xx spike (probe/gracefulness bugs show up here and nowhere else).
- The kill drill: `kill -9` a pod under traffic; assert recovery within budget. Containers die randomly in prod — rehearse it.

## Pitfalls
- `latest` in production manifests: untraceable rollbacks and node-cache drift. Digest-pinned for anything real.
- Liveness probes that check downstream dependencies: one slow database = every pod restarting = full outage from a probe config. Liveness = "am I wedged", readiness = "can I serve".
- Building images in prod deploy pipelines per-environment: test/staging/prod got different images and you don't know which one you tested.
