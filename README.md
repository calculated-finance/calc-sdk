# CALC SDK

Type-safe strategy configuration builder for CALC. Produces validated Node[] graphs from a small DSL. No chain/RPC submission. Bun-first.

## Install

- Requires Bun.
- Clone this repo, then:
  - bun install
  - bun test

## Quick start

```ts
import { strategy } from "./src/strategy";
import { actions } from "./src/actions";
import { conditions } from "./src/conditions";

const s = strategy("DCA ATOM→USDC")
  .when(
    conditions.schedule({
      cadence: {
        blocks: {
          interval: 10,
        },
      },
    })
  )
  .then(
    actions.swap({
      swap_amount: {
        amount: "123211233",
        denom: "rune",
      },
      minimum_receive_amount: {
        amount: "3213321",
        denom: "x/ruji",
      },
      maximum_slippage_bps: 200,
      routes: [
        {
          fin: { pair_address: "thor1...pair" },
        },
      ],
    })
  )
  .then(
    actions.distribute({
      denoms: ["x/ruji"],
      destinations: [
        {
          recipient: { bank: { address: "thor1...owner" } },
          shares: "10000",
        },
      ],
    })
  )
  .build();
```

## DSL

- strategy(label)
  - when(condition) — schedule-only condition
  - if(condition) — any non-schedule condition
  - then(step) — Action or Condition; links on_success (from a condition) or next (from an action)
  - else(step) — attaches on_failure to the most recent condition
  - update(index, step) — replace node payload at index (type-safe: Action→Action, Condition→Condition)
  - validate() — detects cycles (Kahn’s algorithm) and enforces single-entry, fully connected graph
  - build() — runs validate() and returns { label, nodes, owner?, source? }
- StrategyBuilder.from({ label, nodes, ... }) — edit/validate an existing graph

## Helpers

- actions: swap, limit_order, distribute (return Action union shapes)
- conditions: schedule, oracle_price, blocks_completed, balance_available, etc. (return Condition union shapes)
- serde: toUint128(), toDecimal18() for safe numeric serialization

Note

- All on-chain numeric types are strings (Uint128, Decimal with up to 18dp). Normalize via serde helpers.
- Refer to calc.d.ts for exact payload shapes and enums.
