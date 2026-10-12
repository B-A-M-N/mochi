---
name: mobile-app-dev
description: Build and debug mobile apps (iOS/Android) — native, React Native, or Flutter; simulator workflows, device debugging, signing/build pipelines, and store submission. Use when developing, debugging, or shipping a mobile application.
---

# Mobile App Development Procedure

Mobile adds constraints web never has: OS lifecycle, device fragmentation, store review, and users who notice every 1% of battery.

## 1. Pick the stack by the app's center of gravity
- Native (Swift/Kotlin): platform features, performance ceilings, long-lived apps.
- React Native/Expo: web-team synergy, fast iteration; native modules escape-hatch. Flutter: pixel-consistency across platforms, non-standard UI.
- Decide ONCE per app; hybrid-by-committee produces neither performance nor velocity.

## 2. Dev loop (simulator + device from day one)
- iOS: Simulator (Cmd+R hot reload) + REAL device weekly — touch targets, keyboard dismissal, and push permissions only behave on hardware.
- Android: emulator with Play images + a mid-tier physical device (your app must survive the cheap phone, not just the flagship).
- Profile early: Xcode Instruments / Android Profiler for the 3 killers — main-thread jank, memory leaks on rotation/navigation, battery drain from background work.

## 3. Lifecycle discipline (where mobile bugs live)
- App backgrounding: save state BEFORE background (iOS gives seconds); kill network on `background`, resume correctly on `foreground`. Every "works when I keep the app open" bug is lifecycle mishandling.
- Permissions: request IN CONTEXT (explain why first), handle the denial path as a designed state, never beg with repeated prompts.
- Deep links and push: each is a navigation entry point needing the same loading/error/empty states as cold start.

## 4. State and offline
- Offline-first for anything users create: local persistence (SQLite/WatermelonDB/Drift), queue mutations, sync with conflict policy (last-write-wins for non-critical, server-merge for critical).
- Optimistic UI on every mutation with rollback on failure — mobile networks are tunnels, not pipes.

## 5. Build and release pipeline
- iOS: certificates + provisioning via Xcode automatic signing or fastlane match; TestFlight for every release candidate (real crash reporting before store review).
- Android: Play App Bundle, signing key in Play App Signing (never lose the upload key), internal testing track first.
- CI builds: versioned by build number, dSYM/dSYM mapping uploaded to the crash reporter THE SAME build, or crashes will be symbolicated garbage.
- Store review: privacy manifest / data-safety forms accurate (reviewers check); rejection reasons addressed with a reply, not a resubmit lottery.

## Pitfalls
- Testing only on the newest device/OS: the crash cluster is always the 3-year-old phone on last year's OS.
- Ignoring app-size bloat (assets, unused ABIs) — every 10MB is conversion loss on store pages with slow connections.
- Push-notification payloads treated as trusted: they're user-visible content — validate/escape like any other input.
