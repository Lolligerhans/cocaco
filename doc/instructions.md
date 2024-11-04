# Instructions

> [!NOTE]
> Version 3 instructions are [here](https://github.com/Lolligerhans/cocaco/blob/v3.4.6/doc/usage.md)

Follow [#Installation](../README.md#installation). Then:

1. Visit [Colonist][Colonist]
1. Open the 🧩 Extensions pop-up menu. It is located at the top right.
1. Click on the gear  ⚙️  next to `🥥 Correct Card Counter`. Select `Always Allow`.
1. Reload by pressing `F5`

A successful start is indicated by a coconut icon in the background:

![Icon](/assets/coconut_32.png?raw=true)

## Card display

![Screenshot](/assets/screenshots/cards.png)

The display can be toggled by clicking the 🥥 icon in the URL bar.

| Action | Effect |
|-:|:-|
| 🥥 (URL bar) | Hide/show |
| `Ctrl` `+`, `Ctrl` `-` | Resize |

Uncertain cards have a coloured outline:

| Colour | Meaning  |
|-------:|:---------|
|     🟥 | Unlikely |
|     🟨 | Possible |
|     🟩 | Likely   |

## Collusion

> [!CAUTION]
> Collusion is experimental. Colluding effectively prevents manual trading to
> colluding players.

When colluding with other players, Cocaco will autonomously trade resources with
them. The generated trades ensure that all future resource income is distributed
evenly between colluding players. This is meant to reduce bargaining friction
between losing players.

Collude with John and Jess by chatting:

```text
hi John, Jess
```

Stop colluding by chatting:

```text
gg
```

These are sensitive to:

<!--markdownlint-disable MD038-->
- whitespace (` `)
- commas (`,`)
- capitalization (`aA`)

## Table display

![Screenshot](/assets/screenshots/table.png)

A table based display can be [configured](./config.md). It does not look as
nice, but shows more information.

### Interaction

- show/hide extras: click road/settlement/dev-card icon
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

### Understanding resource table

- `4 / 80%` means:
  - count is 4
  - 80% chance to rob this card (exact) (colour coded)
  - certainty > 99.9%, guaranteed if `1 🌎` is shown)
- `4 (67%) / 73%` means:
  - The most likely count is 4
    - The shown combination of marginal probabilities is often impossible
  - 67% marginal probability that count is exactly 4
  - 73% chance to rob this card (across possible states) (colour coded)
- Building columns: Probability the player can afford at least 1. Colour coded.
- Number of possible states: top left table cell. `1 🌎` indicates 100% certainty.

### Understanding rolls plot

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
