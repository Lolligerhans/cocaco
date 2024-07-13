![Screenshot](/assets/screenshot.png?raw=true)

# Getting started

### Linux download

  ```bash
  #!/usr/bin/env bash
  git clone https://github.com/Lolligerhans/explorer.git
  cd explorer
  git submodule update --init --recursive
  ./run.sh install # Downloads plotly
  ```

### Manual download

  [Download from GitHub](https://github.com/Lolligerhans/explorer/tags).
  Then download links listed in `doc/README`.

### Install

  Install as temporary extension in your browser.

# Usage

  - Disble/Enable: click game log
  - Show plot/rolls/steals: click road/settlement/city

### Resource table

  - `4 / 80%`
    - count is 4 (> 99.9%, guaranteed if _world count_ == 1)
    - 80% chance to rob this card (exact)
  - `4 (67%) / 73%`
    - 67% marginal probability that count is exactly 5
    - 73% chance to rob this card (across possible states)
  - Number of possible states (_world count_): top left table cell (usually `1`)
  - Cells show most likely marginal value and probabilities
    - The shown combination of marginal probabilities is often impossible
  - [C&K] Unknown non-random exchanges are assumed uniform random

### Rolls plot

  - orange: lighter = newer
  - green: expectation
  - blue: `rarity(n) := sum {m : p(m) <= p(n)} {p(m)}` where n is the roll count
  - red is adjusted rarity: binomial probability to be rarity(n) lucky (once or more) with 11 bernoulli trials. This puts blue into perspective of 11 opportunities.
  - luck factor: Inverse of rarity scaled with amount of cards over expectation. Proxy for influence of luck on rolls. `1 / rarity(n) * (n - E[N])`. The bar is colour coded to be yellow if red == 50%. Red when more rare, green when less rare.

### Interaction

  - resize: `Ctrl` + `+`, `Ctrl` + `-`
  - show/hide: click game log
  - guess resource count manually: click number
    - exact number: `5`
    - more-than: `>5`
    - less-than: `<5`
    - not-equals: `!5`
    - can-not-buy: click building cell
    - wrong guesses recover automatically
  - measure total resource count: click player name (must be true count)
  - toggle plots: clicl road/settlement/city icons

### Legacy

  Recovery mode can reset hands into unknown cards.

  - reset player names: click top left table cell, later reset card counts
  - reset card counts: click player name in table
