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
| ∫ | Bayesian tracking algorithm |
| 👤 💡 | Include your own live deductions |

| Display dense dice data | Rightfully revenge ridiculous robs |
|:-------------------------:|:-------------------------:|
| ![rolls plot](assets/rolls.png?raw=true) |  ![robs table](assets/robs.png?raw=true) |

## Getting started

1. [Linux download](#linux-download) or [Manual download](#manual-download)
2. [Installation](#installation)
3. Start extension after visiting [Colonist][Colonist]

Done!

### Linux download

```bash
#!/usr/bin/env bash
git clone https://github.com/Lolligerhans/explorer.git;
```

### Manual download

1. Download the newest version as `.zip` file from
   [GitHub](https://github.com/Lolligerhans/explorer/tags).
2. Extract the `.zip` file, producing the `explorer/` folder.

### Installation

Install as temporary extension in your browser:

- [Firefox](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/ "Tutorial")
  - Visit URL
  [about:debugging#/runtime/this-firefox](about:debugging#/runtime/this-firefox)
  - Temporary Extensions
  - Load Temporary Add-on...
  - Select 'explorer/manifest.json'
- [Chrome](https://www.cnet.com/tech/services-and-software/how-to-install-chrome-extensions-manually/ "Tutorial")
  - Visit URL [chrome://extensions/](chrome://extensions/)
  - Enable developer mode
  - Load unpacked
  - Select the 'explorer/' directory. (The inner one if there are two.)

> [!NOTE]
> Firefox/Chrome do not allow permanent installation of local extensions.
> Bookmark the URL to repeat these steps more easily after restarting the
> browser. (Developer versions may allow it.)

## Usage

See [doc/usage.md](/doc/usage.md).

<!--
 !  ╭─────────────────────────────────────────────────────────────────────────╮
 !  │ Link collection                                                         │
 !  ╰─────────────────────────────────────────────────────────────────────────╯
-->

[Colonist]: https://colonist.io/ "Colonist website"
