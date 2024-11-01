# Usage

Follow [#Installation](../README.md#installation).

Visit [Colonist][Colonist] and find the add-on in the browser toolbar at the top
right. Click on `🥥 Correct Card Counter` to start the tracker. If you select
"always allow", you must reload the website.

A successful start is indicated by a coconut icon in the background:

![Icon](/assets/coconut_32.png?raw=true)

---

Instructions for version 3:

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

## Understanding resource table

- `4 / 80%` means:
  - count is 4
  - 80% chance to rob this card (exact)
  - certainty > 99.9%, guaranteed if `1 🌎` is shown)
- `4 (67%) / 73%` means:
  - The most likely count is 4
  - 67% marginal probability that count is exactly 4
  - 73% chance to rob this card (across possible states)
- Number of possible states: top left table cell. `1 🌎` indicates 100% certainty.
- The shown combination of marginal probabilities is often impossible

## Understanding rolls plot

- orange blocks: lighter = newer
- green line: expectation
- blue dots: `rarity(n) := sum {m : p(m) <= p(n)} {p(m)}` where n is the roll count
- red dots: adjusted rarity. Binomial probability to be rarity(n) lucky (once or
more) with 11 Bernoulli trials. This puts blue into perspective of 11
opportunities.
- blue/red lines: Progression of highest blue/red dot.
- bars: `luck/n) := 1 / rarity(n) * (n - E[N])`. Colour codes adjusted rarity in
green, yellow, red.
- purple line: KL-Divergence to expectation

<!--
 !  ╭─────────────────────────────────────────────────────────────────────────╮
 !  │ Link collection                                                         │
 !  ╰─────────────────────────────────────────────────────────────────────────╯
-->

[Colonist]: https://colonist.io/ "Colonist website"
