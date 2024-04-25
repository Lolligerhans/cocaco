![Screenshot](/assets/screenshot.png?raw=true)

# Installation

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

  Activate the extension while browsing. The landing page of colonist will show
  a version (`CoCaCo v1.13.1`). When no version shows, explorer is broken.

  Display begins automatically after inittial placements are made. Update
  interval is 10 seconds.

### Resource table

  - `4 / 80%`
    - count is 4 (> 99.9%, guaranteed if _world count_ == 1)
    - 80% chance to rob this card (exact)
  - `4 (67%) / 73%`
    - 67% marginal probability that count is exactly 5
    - 73% chance to rob this card (across possible states)
  - Number of possible states (_world count_): top left table cell (usually `1`)
  - Cells show largest marginal probability. Marginal distributions are unimodal
    - The shown combination of marginal values is often impossible

### Resource plot

  - orange lighter = newer
  - green is expectation
  - blue is rarity(N) == `sum {n : p(n) <= p(N)} {p(n)}` where N is the roll count
  - red is adjusted rarity: binomial probability to be rarity(n) lucky (once or more) with 11
bernoulli trials. This puts blue into perspective of 11 numbers. About half of games end with highest red > 50%, hald end with highest red < 50%.
  - luck factor: Inverse of rarity scaled with amount of cards over expectation.
  Proxy for influence of luck on rolls. `1 / rarity(n) * (N - E[n==N])`. The bar is colour coded to be yellow if red == 50%. Red when more rare, red when less rare. For example, 20% rarity while having 3 cards over green leads to luck 15.

### Rob table

  - total `4+2`: Rolled 7 four times, played 2 knights. This coutner breaks once
  a player steals nothing.
  - green: robbed relatively more
  - red: robbed relatively less

### Interaction

  - Resize: `Ctrl` + `+`, `Ctrl` + `-`
  - show/hide: click game log in top right corner (disabled during startup)
  - guess resource count manually: click number
    - exact number: `5`
    - more-than: `>5`
    - less-than: `<5`
    - not-equals: `!5`
    - can-not-buy: click building cell
    - wrong guesses recover automatically
  - update display immediately: click robs table

### Legacy

  Recovery mode can reset hands into unknown cards.

  - reset player names: click top left table cell, later reset card counts
  - reset card counts: click player name in table
    - may overflow internal values when holding many cards

### Limitations

  - Up to 4 players (as sanity check)
  - Base game only (🪵 🧱 🐑 🌾 🪨, no special rules)
    - [C&K version](https://github.com/superferret1/explorer)
  - Assumes cards are dropped on `7` when >= 8 total (relevant after monopoly when total is unknown)
  - Assumes 19 total cards per resource (else might overflow)

# Errors

  When an alert opens explorer is broken.
