# Configuration

Casual use of Cocaco does not require configuration.

---

Cocaco can be configured by replacing values in the configuration object
`cocaco_config` in [config.js](../javascript/config.js). These options may be
useful for users:

<!--markdownlint-disable MD013-->
| Option | Use case |
|-|-|
| `collude.autocollude` | Set to `true` to [collude](instructions.md#collusion) with all players from the start. Fun for bot games. |
| `pipeline` | Set to `"Colony"` to switch to the code used by version 3. More robust than the default. |
| `render.type` | Set to `"table"` to use a number based resource display. |
| `fixedPlayerName`, `playerName` | See Issue #2 [here](https://github.com/Lolligerhans/cocaco/issues/2). |
