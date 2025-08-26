# CALC SDK

Type-safe strategy configuration builder for CALC. Build and validate `Node[]` graphs from a small DSL.

What is a CALC strategy?

- A strategy is a directed graph of nodes executed by CALC contracts.
- Nodes are either Conditions (branch on state/time) or Actions (do work).
- Edges define flow: conditions branch to `on_success`/`on_failure`; actions have a linear `next`.
- This SDK helps you construct valid strategy graphs (`Node[]`) to submit with your own on-chain client.

## Example: DCA (schedule → swap → distribute)

```ts
import { strategy, actions, conditions } from "@calc_fi/strategy-builder";

strategy("DCA RUNE→USDC")
  .when(
    conditions.schedule({
      cadence: { blocks: { interval: 10 } },
    })
  )
  .then(
    actions.swap({
      swap_amount: { amount: "1000000", denom: "rune" },
      minimum_receive_amount: { amount: "950000", denom: "eth-usdc" },
      routes: [{ fin: { pair_address: "fin1...pair" } }],
    })
  )
  .then(
    actions.distribute({
      denoms: ["uusdc"],
      destinations: [
        { recipient: { bank: { address: "cosmos1..." } }, shares: "10000" },
      ],
    })
  )
  .build();
```

## Strategy Builder DSL

- `strategy(label)`
  - `when(condition)` — add a schedule condition (entry or chained)
  - `if(condition)` — add any non-schedule condition
  - `then(step)` — Action or Condition
    - from a condition: sets `on_success`
    - from an action: sets `next`
  - `else(step)` — attaches `on_failure` to the most recent condition
  - `update(index, step)` — replace node payload at index (Action→Action, Condition→Condition)
  - `validate()` — Kahn’s algorithm for cycles; enforces single entry and full connectivity
  - `build()` — validates and returns a strategy: `{ label, nodes, owner?, source? }`
- `StrategyBuilder.from({ label, nodes, ... })` — edit/validate an existing graph

## Actions (what you can do)

`actions.swap(Swap)`

- Market swap via one or more routes.
- Key fields: swap_amount, minimum_receive_amount, routes (e.g., { fin: { pair_address } }), optional maximum_slippage_bps, adjustment.

  ```ts
  actions.swap({
    swap_amount: { amount: "1000000", denom: "uatom" },
    minimum_receive_amount: { amount: "950000", denom: "uusdc" },
    routes: [{ fin: { pair_address: "fin1...pair" } }],
  });
  ```

`actions.limit_order(FinLimitOrder)`

- Place/refresh a limit order on FIN at a strategy price.
- Key fields: pair_address, side ("base" | "quote"), strategy (PriceStrategy), bid_denom, optional bid_amount, min_fill_ratio.

  ```ts
  actions.limit_order({
    pair_address: "fin1...pair",
    side: "base",
    strategy: { fixed: "10.00" },
    bid_denom: "uusdc",
    bid_amount: "10000000",
  });
  ```

`actions.distribute(Distribution)`

- Split balances to recipients by shares.
- Key fields: denoms, destinations[{ recipient, shares, label? }].
- Example:
  ```ts
  actions.distribute({
    denoms: ["uusdc"],
    destinations: [
      { recipient: { bank: { address: "cosmos1..." } }, shares: "10000" },
    ],
  });
  ```

## Conditions (if/when to act)

`conditions.schedule(Schedule)`

- Time/block cadence trigger (entry point for most strategies).
- Key field: cadence (e.g., { blocks: { interval: 10 } } or { time: { secs: 3600, nanos: 0 }}).

`conditions.timestampElapsed(Timestamp)`

- True after a specific timestamp.
- Example: `{ timestamp_elapsed: "1712345678" }`

`conditions.blocksCompleted(number)`

- True after N total blocks have elapsed on the target chain.

`conditions.canSwap(Swap)`

- Feasibility check for a prospective swap.

`conditions.balanceAvailable({ address?, amount })`

- True if an address has at least amount. If address is unspecified, checks the strategy address balance.

`conditions.strategyStatus({ contract_address, manager_contract, status })`

- True if a strategy status matches ("active" | "paused").

`conditions.oraclePrice({ asset, direction, price })`

- True if asset price is above/below a threshold.

`conditions.finLimitOrderFilled({ pair_address, side, price, owner? })`

- True if a FIN order at price/side has filled. If owner is unspecified, checks the strategy address orders.

`conditions.assetValueRatio({ numerator, denominator, oracle, ratio, tolerance })`

- True if an asset ratio is within tolerance.

## Notes

- Types are defined in calc.d.ts and published with the package.
- On-chain numeric types are strings:
  - Uint128: non-negative integer string.
  - Decimal: fixed-point with up to 18 fractional digits.
