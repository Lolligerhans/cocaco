# Usage

Follow [#Installation](../README.md#installation).

After visiting [Colonist][Colonist], find the add-on in the browser toolbar at
the top right. Click on _Catan Card Counter_ to start the tracker. If you choose
"always allow", you may need to reload the website to start.

If a green version number is shown at the top you are done. Otherwise something
went wrong.

## Interaction

- hide/show: click game log
- show/hide extras: click road/settlement/dev-card icon
- resize: `Ctrl` + `+`, `Ctrl` + `-`
- guess resource count manually: click number
  - exact number: `5`
  - more-than: `>5`
  - less-than: `<5`
  - not-equals: `!5`
  - can-not-buy: click building cell
  - wrong guesses recover automatically
- measure total resource count: click player name (must be true count)
- legacy
  - reset card counts: click resource card icon
  - reset player names: click 🌎 icon, later reset card counts

## Resource table

- `4 / 80%`
  - count is 4 (> 99.9%, guaranteed if _world count_ == 1)
  - 80% chance to rob this card (exact)
- `4 (67%) / 73%`
  - 67% marginal probability that count is exactly 4
  - 73% chance to rob this card (across possible states)
- Number of possible states (_world count_): top left table cell (usually `1 🌎`)
- Cells show most likely marginal value and probabilities
  - The shown combination of marginal probabilities is often impossible
- [C&K] Unknown non-random exchanges are assumed uniform random

## Rolls plot

- orange blocks: lighter = newer
- green line: expectation
- blue dots: `rarity(n) := sum {m : p(m) <= p(n)} {p(m)}` where n is the roll count
- red dots: adjusted rarity. Binomial probability to be rarity(n) lucky (once or
more) with 11 Bernoulli trials. This puts blue into perspective of 11
opportunities.
- bars: Luck factor. Inverse of rarity scaled with amount of cards over
expectation. Proxy for influence of luck on rolls. `1 / rarity(n) * (n - E[N])`.
The bar is colour coded to be yellow if red == 50%. Red when more rare, green
when less rare.
- purple line: KL-Divergence to expectation

<!--
 !  ╭─────────────────────────────────────────────────────────────────────────╮
 !  │ Link collection                                                         │
 !  ╰─────────────────────────────────────────────────────────────────────────╯
-->

[Colonist]: https://colonist.io/ "Colonist website"
