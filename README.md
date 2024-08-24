# Correctly correlated Colonist card chance counter

![Outdated Screenshot](assets/screenshot.png?raw=true)

## Features

|||
|-:|:-|
| 🂠 | Track cards |
| 🎲 | Analyze dice rolls |
| 🥷 | Record robs |
| ⛵ 🛡 | All expansions |
| 👁 | Spectate games |
| 👤 💡 | Include your own live deductions |

| Display dense dice data | Rightfully revenge ridiculous robs |
|:-------------------------:|:-------------------------:|
| ![rolls plot](assets/rolls.png?raw=true) |  ![robs table](assets/robs.png?raw=true) |

## Getting started

1. [Linux download](#linux-download) or [Manual download](#manual-download)
2. [Install](#install)
3. Run explorer after visiting colonist

### Linux download

```bash
#!/usr/bin/env bash
git clone https://github.com/Lolligerhans/explorer.git
cd explorer
git submodule update --init --recursive
./run.sh install
```

### Manual download

1. [Download from GitHub](https://github.com/Lolligerhans/explorer/tags)
2. Extract the zip file
3. Download links listed in [doc/README](doc/README)

### Install

Install as temporary extension in your browser:

- [Firefox](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)
  - Visist URL [about:debugging#/runtime/this-firefox](about:debugging#/runtime/this-firefox)
  - Temporary Extensions
  - Load Temporary Add-on...
  - Select 'explorer/manifest.json'
- [Chrome](https://www.cnet.com/tech/services-and-software/how-to-install-chrome-extensions-manually/)
  - Visit URL [chrome://extensions/](chrome://extensions/)
  - Enable developer mode
  - Load unpacked
  - Select the 'explorer/' directory. (The inner one if there are two.)

## Usage

- Hide/show resources: click game log
- Show/hide plot/rolls/steals: click road/settlement/city

### Resource table

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

### Rolls plot

- orange blocks: lighter = newer
- greenline: expectation
- blue dots: `rarity(n) := sum {m : p(m) <= p(n)} {p(m)}` where n is the roll count
- red dots: adjusted rarity. binomial probability to be rarity(n) lucky (once or
more) with 11 bernoulli trials. This puts blue into perspective of 11
opportunities.
- bars: Luck factor. Inverse of rarity scaled with amount of cards over
expectation. Proxy for influence of luck on rolls. `1 / rarity(n) * (n - E[N])`.
The bar is colour coded to be yellow if red == 50%. Red when more rare, green
when less rare.
- purple line: KL-Divergence to expectation

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
- toggle plots: click road/settlement/city icons

### Legacy

Recovery mode can reset hands into unknown cards.

- reset card counts: click resource card icon
- reset player names: click 🌎 icon, later reset card counts
