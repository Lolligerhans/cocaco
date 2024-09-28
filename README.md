<!-- Lists and tables are longer -->
<!-- markdownlint-disable line-length -->

# ![Icon](assets/coconut_32.png?raw=true) Correctly correlated Catan card chance Counter

![Outdated Screenshot](assets/screenshot.png?raw=true)

## Features

| 🥥 | Correct Catan Counter |
| -: | :- |
| 🂠 | Track cards |
| 🎲 | Analyze dice rolls |
| 🥷 | Record robs |
| ⛵ 🛡 | All expansions |
| 👁 | Spectate games |
| ∫ | Bayesian tracking algorithm |
| 👤 💡 | Include manual deductions |

| Display dense dice data | Rightfully revenge ridiculous robs |
| :-: | :-: |
| ![rolls plot](assets/rolls.png?raw=true) | ![robs table](assets/robs.png?raw=true) |

## Getting started

1. [Linux download](#linux-download) or [Manual download](#manual-download)
2. [Installation](#installation)
3. Start extension after visiting [Colonist][Colonist]

Done!

### Linux download

```bash
#!/usr/bin/env bash
git clone https://github.com/Lolligerhans/cocaco.git &&
cd cocaco &&
git checkout "$(git describe --tags --abbrev=0)";
```

### Manual download

1. Download the newest version as `.zip` file from
[GitHub](https://github.com/Lolligerhans/cocaco/tags).
    - Stable: Version 3
    - Experimental: Version 4 (base game only)
1. Extract the `.zip` file, producing the `cocaco/` folder.

### Installation

Install as temporary extension in your browser:

- [Firefox](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/ "Tutorial")
  - Visit URL [about:debugging#/runtime/this-firefox](about:debugging#/runtime/this-firefox)
  - Temporary Extensions
  - Load Temporary Add-on...
  - Select 'cocaco/manifest.json'
- [Chrome](https://www.cnet.com/tech/services-and-software/how-to-install-chrome-extensions-manually/ "Tutorial") (Version 3 only)
  - Visit URL [chrome://extensions/](chrome://extensions/)
  - Enable developer mode
  - Load unpacked
  - Select the 'cocaco/' directory. (The inner one if there are two.)

> [!NOTE]
> Firefox/Chrome do not allow permanent installation of local extensions.
> Bookmark the URL to repeat these steps more easily after restarting the
> browser. (Developer versions may allow it.)

## Usage

See [doc/usage.md](doc/usage.md).

## Attribution

<!-- <a href="https://www.flaticon.com/free-icons/food-and-restaurant" title="food and restaurant icons"> Food and restaurant icons created by @mingyue - Flaticon</a>  -->
| Resource/Module | Attribution |
| -: | :- |
| Inspiration | [Explorer][Explorer] which we [forked][Original] under the same name up to version 3 |
| Diagram plots | [Plotly][Plotly] |
| Icon | [Food and restaurant icons created by @mingyue - Flaticon](https://www.flaticon.com/free-icons/food-and-restaurant "food and restaurant icons") |
| statistics.js/ | [statistics.js](https://thisancog.github.io/statistics.js/index.html "Documentation") |

<!--
 !  ╭─────────────────────────────────────────────────────────────────────────╮
 !  │ Link collection                                                         │
 !  ╰─────────────────────────────────────────────────────────────────────────╯
-->

[Colonist]: https://colonist.io/ "Colonist homepage"
[Explorer]: https://github.com/glasperfan/explorer "Explorer repository"
[Original]: https://github.com/Lolligerhans/explorer "Old fork"
[Plotly]: https://plotly.com/javascript/ "Plotly homepage"
