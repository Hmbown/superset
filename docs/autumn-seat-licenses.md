# Seats and cloud hours in Autumn

Self-serve plans sell seats as Autumn licenses. Each seat brings its cloud
GB-minutes into one pool the whole team shares. Autumn does the arithmetic; our
code only keeps the seat count equal to the member count.

## Catalog shape

Per family and interval there are two plans:

- A **seat license plan** (`pro_seat`, `team_seat_annual`, ...) in its own
  group. Its base price is the seat price, and it holds one item:
  `box_gb_minutes` with the per-seat grant, a monthly reset and `pooled: true`.
- A **parent plan** (`pro_v2`, `team`, `ultra_annual`, ...) in the `main`
  group. It links the license plan under `licenses` with `included: 0`, and
  holds the overage item (`box_gb_minutes`, `included: 0`, usage-based price),
  `environments` and `pro_access`. Its metadata places it in the lineup:
  `self_serve: true`, `family`, `display_order`.

Autumn rejects a pooled item with a usage-based price, which is why the grant
and the overage price are separate items on separate plans.

The pool is `paid licenses × per-seat grant`. It does not depend on licenses
being assigned to entities, so we never assign them.

`pro` and `pro_annual` are the retired Pro plans: one flat grant and a `seats`
feature quantity. Existing subscribers stay on them until they are moved. They
carry `family: pro` without `self_serve`, so the catalog shows them as Pro but
never sells them.

## Seat changes

`setAutumnSeats` in `packages/auth/src/lib/billing/autumn/seats.ts` runs on
every member change:

| Members vs paid seats | Call |
|---|---|
| More members | `billing.update` with the new `licenseQuantities` (prorated now) |
| Fewer members | `billing.createSchedule`: keep the paid count now, the member count at `currentPeriodEnd`, `prorationBehavior: none` |
| A decrease is pending and seats are needed again | `billing.createSchedule` with only a `now` phase, which replaces the pending one |

A removed seat therefore stays paid, and its GB-minutes stay in the pool, until
renewal. While a schedule exists Autumn refuses `billing.update` on that
plan, so every change made then goes through `createSchedule`.

Retired Pro plans keep the old path: the `seats` feature quantity, with no
credit on a decrease.

## Known Autumn behavior

- Switching plans (retired Pro to Pro, Pro to Team) resets the pool's usage
  even though `previewAttach` reports `resets_usage: false`. To raise with Autumn.
- autumn-js 1.3.55 drops `licenses` from plans and has no `licenses.list`, so
  `autumnRest` in `packages/auth/src/autumn.ts` reads both over REST. Remove it
  when the SDK models them.
