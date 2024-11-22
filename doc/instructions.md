# Instructions

Follow [#Installation](../README.md#installation).

> [!NOTE]
> Version 3 instructions are [here](https://github.com/Lolligerhans/cocaco/blob/v3.4.6/doc/usage.md)

## Starting

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

Move the mouse over the card display to show:

- the chance to steal each resource type
- all possible player hands

## Collusion

> [!CAUTION]
> Collusion is experimental.

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

A table based display can be [configured](#configuration). It does not look as
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
- bars: `luck(n) := 1 / rarity(n) * (n - E[N])`. Colour codes adjusted rarity in
green, yellow, red.
- purple line: KL-Divergence to expectation

## Configuration

No configuration is needed for regular use.

Cocaco can be configured by replacing values in the configuration object
`cocaco_config` in [config.js](../javascript/config.js). These options may be
useful for some users:

<!--markdownlint-disable MD013-->
| Option | Use case |
|-|-|
| `collude.autocollude` | Set to `true` to [collude](instructions.md#collusion) with all players from the start. Fun for bot games. |
| `pipeline` | Set to `"Colony"` to switch to the code used by version 3. More robust than the default. |
| `render.type` | Set to `"table"` to use a numerical resource display. |
| `fixedPlayerName`, `playerName` | See Issue #2 [here](https://github.com/Lolligerhans/cocaco/issues/2). |

<!--
 !  ╭─────────────────────────────────────────────────────────────────────────╮
 !  │ Link collection                                                         │
 !  ╰─────────────────────────────────────────────────────────────────────────╯
-->

[Colonist]: https://colonist.io/ "Colonist website"
