---
name: state-management
description: Choose and implement client state management — server-state vs UI-state separation, caching layers (TanStack Query/SWR), store design (Zustand/Redux/signals), and the patterns that prevent state bugs. Use when architecting a frontend app, fixing prop-drilling/state-sync pain, or debugging stale-UI bugs.
---

# State Management Procedure

Most "state management" pain is category confusion: server cache treated as app state. Separate the categories and the tooling becomes obvious.

## 1. Classify state first (the whole skill in one step)
- **Server state** (data from the backend): belongs in a data cache (TanStack Query/SWR) — not in your store. Keys + staleness + refetch policy, done.
- **UI state** (modals, selection, input drafts): local where possible (`useState`), lifted only when shared.
- **Global app state** (auth, theme, feature flags): ONE store, small and boring.
- URL state (filters, tabs, pagination) — it's shareable state with free persistence; put it in the router, not the store.

## 2. Server state discipline
- Query keys hierarchical and complete (`['user', id, 'posts', {page}]`) — partial keys are stale-data generators. Invalidation after mutations targets the key PREFIX, never manual refetch spaghetti.
- Optimistic updates with rollback: onMutationError restores the snapshot. The optimistic UI must be indistinguishable from confirmed UI, or don't go optimistic.
- Loading/error/empty are DESIGNED states per query consumer — a component that can't render its error state isn't finished.

## 3. Store design (when you truly need one)
- Zustand/context/signals over Redux boilerplate unless the team runs Redux DevTools time-travel as a workflow. Whatever the lib: selectors read slices (render-exact), never whole-store subscriptions (render-everything).
- Derived state computed, not stored — stored duplicates are the bug farm (two fields where one is a function of the other will desync; ask any bookings system).
- Normalization only at the scale that needs it: entities by ID when two views mutate the same object; otherwise nested is simpler and fine.

## 4. The state bug triad (diagnose before refactoring)
- **Stale UI**: missing invalidation or key — fix the cache contract, don't add another `useEffect` refetch.
- **Prop-drilling hell**: it's usually server state masquerading as props — move it to the query layer and the drilling evaporates.
- **Sync loops** (effect A writes what effect B watches): two effects where one derived value belongs. Delete the state, compute it.

## 5. Forms (the deepest state pit)
- Uncontrolled until proven controlled; a form library (react-hook-form / Formik equivalents) for anything multi-field — hand-rolled form state grows bugs per field.
- Validation: schema at the boundary (zod), single source shared client+server; server errors mapped back to fields — the error that renders as a toast instead of on the field is a UX bug.

## 6. Verify
- The refresh test: full page reload at every interaction point — state survives correctly (URL params) or resets correctly (drafts) by design.
- The two-tab test: mutate in one tab, the other reflects it (server-state cache refetch on focus) or intentionally doesn't.
- Render profiling: React Profiler shows the component subtree re-rendering on unrelated state changes = selector/dependency bug.

## Pitfalls
- Copying server data into the global store "for convenience": now you own cache coherence for data a query library would have managed — the original sin of SPA state bugs.
- useEffect for data fetching in a world with query libraries: race conditions on unmount, no dedup, no cache. Migrate before adding more.
- Persisting the whole store to localStorage: stale-hydration bugs and PII leaks — persist explicit allowlisted slices with versioned migration.
