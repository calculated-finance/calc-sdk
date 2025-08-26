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

### Swap

Market swap via one or more routes (FIN, Thorchain).

```ts
actions.swap({
  swap_amount: { amount: "1000000", denom: "uatom" },
  minimum_receive_amount: { amount: "950000", denom: "uusdc" },
  routes: [{ fin: { pair_address: "fin1...pair" } }],
});
```

### Limit Orders

Place/refresh a limit order on FIN at a either a fixed or dynamic price.

```ts
actions.limit_order({
  pair_address: "fin1...pair",
  side: "base",
  strategy: { fixed: "10.00" },
  bid_denom: "uusdc",
  bid_amount: "10000000",
});
```

### Distribute

Distribute funds to multiple recipients.

```ts
actions.distribute({
  denoms: ["uusdc"],
  destinations: [
    { recipient: { bank: { address: "cosmos1..." } }, shares: "10000" },
  ],
});
```

## Conditions (if/when to act)

### Schedule

Repeatedly trigger strategy execution on a time, block, or cron schedule.

```ts
conditions.schedule({
  cadence: { blocks: { interval: 10 } },
});
```

### Timestamp elapsed

True after a specific UNIX timestamp (seconds).

```ts
conditions.timestampElapsed("1712345678");
```

### Blocks completed

True after N blocks.

```ts
conditions.blocksCompleted(100);
```

### Can swap

Feasibility check for a prospective swap action.

```ts
conditions.canSwap({
  swap_amount: { amount: "1000000", denom: "uatom" },
  minimum_receive_amount: { amount: "950000", denom: "uusdc" },
  routes: [{ fin: { pair_address: "fin1...pair" } }],
});
```

### Balance available

True if an address (or the strategy, if omitted) has at least the specified amount.

```ts
conditions.balanceAvailable({
  address: "cosmos1...",
  amount: { amount: "1000000", denom: "uusdc" },
});
```

### Strategy status

True if a strategy’s status matches.

```ts
conditions.strategyStatus({
  contract_address: "cosmos1strategy...",
  manager_contract: "cosmos1manager...",
  status: "active",
});
```

### Oracle price

True if an asset price is above/below a threshold.

```ts
conditions.oraclePrice({
  asset: "ATOM/USDC",
  direction: "below",
  price: "10.00",
});
```

### FIN limit order filled

True if a FIN order at price/side has filled (optionally for a specific owner).

```ts
conditions.finLimitOrderFilled({
  pair_address: "fin1...pair",
  side: "base",
  price: "10.00",
});
```

### Asset value ratio

True if an asset ratio is within tolerance from a given oracle.

```ts
conditions.assetValueRatio({
  numerator: "ATOM",
  denominator: "USDC",
  oracle: "thorchain",
  ratio: "10.00",
  tolerance: "0.50",
});
```

## Notes

- Types are defined in calc.d.ts and published with the package.
- On-chain numeric types are strings:
  - Uint128: non-negative integer string.
  - Decimal: fixed-point with up to 18 fractional digits.
