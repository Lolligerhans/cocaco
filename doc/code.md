# Cocaco Code

<!--toc:start-->
- [Cocaco Code](#cocaco-code)
  - [Overview](#overview)
    - [Data flow](#data-flow)
    - [Data representation](#data-representation)
  - [Modules](#modules)
    - [background.js](#backgroundjs)
    - [cocaco.js](#cocacojs)
    - [config](#config)
    - [Collude](#collude)
    - [CollusionPlanner](#collusionplanner)
    - [CollusionTracker](#collusiontracker)
    - [ColonistObserver](#colonistobserver)
    - [ColonistTrade](#colonisttrade)
    - [Connect](#connect)
    - [ConsoleLog](#consolelog)
    - [Delay](#delay)
    - [dependencies](#dependencies)
    - [dump](#dump)
    - [EmbargoTracker](#embargotracker)
    - [FrameQueue](#framequeue)
    - [MessageLog](#messagelog)
    - [Multiverse](#multiverse)
    - [Observer](#observer)
    - [Player](#player)
    - [Players](#players)
    - [RenderCards](#rendercards)
    - [Reparse](#reparse)
    - [ReparseOptions](#reparseoptions)
    - [Replay](#replay)
    - [Resend](#resend)
    - [Resources](#resources)
    - [serialize.js](#serializejs)
    - [socket](#socket)
    - [State](#state)
    - [Toggle](#toggle)
    - [Track](#track)
    - [Trade](#trade)
    - [Trigger](#trigger)
    - [utils.js](#utilsjs)
    - [plot.js](#plotjs)
<!--toc:end-->

Actual code is documented using doc comments similar to JSDoc. This file
provides structural and conceptual overviews. [Overview](#overview) is a high
level conceptual overview of the Project. [Modules](#modules) has notes,
pitfalls and conventions associated with each module.

> [!TIP]
> Testing is easiest by enabling `replay` in the [config
> file](/javascript/config.js), replaying pre-recorded input data.

## Overview

### Data flow

- Raw data comes from a hooked WebSocket in `cocaco.js` (version 4 only) and
DOM access in `colonist/main.js`. Socket data is interfaced by `Reparse`.
- Raw data is processed by `ColonistSource` ➜ `ColonistObserver` to obtain
observations as host independent game events. See [pipelines.md](pipelines.md).
- Observations are interpreted by `State` to deduce required operations. State
uses `Multiverse`, `Track`, `ColluisonPlanner` for implementation and data
analysis.
- State passes results to `RenderCards`, `Render` for display.

### Data representation

- Data units are called `frame`, `packet`, `observation` depending on the level
in the input pipeline (`Data`, `Source`, `Observer`, respectively; lower to
higher level).
- `Player`s are kept in the global `Players` object. It can be queried for
references to its `Player` objects. We use reference semantics; `Player`
objects **must not** be modified.
- `Resoruces`, `Trade` have data classes with value semantics.
- The probabilities over resource card states are provided by `Multiverse`. It
still does its own thing for resource representation internally. Use
`asSlice()` as appropriate. See [algorithms.md](algorithms.md).

## Modules

Most relevant parts/modules are listed here. Parts marked "_unstructured_" are
ad-hoc solutions with unspecific scope or goal. Parts marked to be "a mess" are
convoluted code.

<!--markdownlint-disable line-length-->

| Module | Kind | Description | Specific dependencies | Specifically used by |
|-|-|-|-|-|
| background.js | class | Coordinates data exfiltration (requires background script) | _unstructured_ port communication with content scripts and native application | `dump/` |
| cocaco.js | function | `main()` and _unstructured_ WebSocket code. A mess. | - | Dispatches into `Colonist` |
| cocaco\_config | _global constant data_ object | Flags and other global config | - | * |
| Collude | class | Computes collusion templates | - | `CollusionPlanner` |
| CollusionPlanner | class | Central implementation for all things collusion | `Collude`, `CollusionTracker`, `EmbargoTracker`, `Players` | `State` |
| CollusionTracker | class | Used to halt collusion after manual trades | - | `CollusionPlanner` |
| ColonistObserver | class | provides `Observer` for colonist | `ColonistSource` for source packets, `Observer` interface | Provides observations for `State` |
| ColonistTrade | class | Stateful component to keep track of active trades | `combineObject()` | `ColonistObserver` |
| Connect | class | Wrapper for runtime messaging API | Uses `Trigger` as interface | `State` to get browser action |
| ConsoleLog | class | Drop in replacement for `console.log`, can be toggled in config | `cocaco_config` | * |
| Delay | class | Function decorator suppressing repeat invocations during a delay | - | `State` to limit UI (`Render`/`CardRender`) update frequency |
| dependencies/ | JS libraries | Other people's code as git submodules. Reflects the source of our distributed copies. | - | `plot.js`, `RenderCards`/`Render` |
| dump/ | native application | Python script usable to dump WebSocket data. A bit of a mess. | _unstructured_ interplay with `background.js`, `cocaco.js` | To generate test data for manual inspection and for `Replay` |
| EmbargoTracker | class | Stores embargo state | - | `CollusionPlanner` to respect embargoes |
| FrameQueue | _data_ class | Buffer our generated outgoing frames until a later event loop | - | _unstructured_ |
| MessageLog | class | Deprecated logger. Idea was discarded. | Optional access to a HTML element to log into | `Colony` and other old version 3.x.y code |
| Multiverse | _global data_ class | Bayesian resource tracking | Inconsistent use of Resources | * |
| Observer | _base_ class | defines and implement observations available through observer interface | - | Expected by `State`, realized by `ColonistObserver` |
| Player | _const data_ class | Only used as part of `Players`. Constructed once. | - | `Players` |
| Players | _global const data_ class | global/const/singleton set of players (unenforced) | `Player` | Always used in core to reference a player. Some old parts use player names separately |
| Render | _global_ class | Generates the table based UI elements. Same interface as `RenderCards` but not explicitly specified. Is a mess. | Needs player names + `Multiverse` as data | `State` to update UI. |
| RenderCards | _global_ class | Generates the card based UI elements. Same interface as `Render` but no explicitly specified. Is a bit of a mess. | Needs player names + `Multiver` as data | `State` uses it to update the UI |
| Reparse | _global_ class | Context through which WebSocket frames enter the non-socket code. Complex, imitate existing use. | _unstructured_ | `Resend`, `ColonistSource` |
| ReparseOptions | _data_ class | Wrapper for common function arguments | - | `Reparse`/`Resend` |
| Replay | _global data_ class | Prerecorded sequence of data frames to test passive behaviours without need for actual WebSocket data | `cocaco_config` | _unstructured_ injection depending on config |
| Resend | _global_ class | Convenience wrapper to control (edit, add, drop) and sanity check outgoing data frames. Low level without specific usage pattern. | _unstructured_ | Collusion auto-responses (are a mess) |
| Resources | _data_ class | set of resources | - | **not** by `Multiverse` for legacy reasons |
| serialize.js | functions | WebSocket encode/decode. Mostly MessagePack. | `msgpack.js` library | _unstructured_ WebSocket code in `cocaco.js`, `Resend` |
| socket_{main,isolated}.js | _unstructured_ | Some _unstructured_ orchestration between MAIN and ISOLATED content scripts to hook `window.WebSocket` | `manifest.json` | `Reparse` implements a shared access points to data frames based on these parts |
| State | _global_ class | Core module implementing the effect of observations | `Observer` as data input, most other modules for implementation | Instantiated by `colonist.js` to start tracking |
| Toggle | class | Implements toggle-able flags | - | Used by `RenderCards` to toggle UI elements |
| Track | class | Collection of simple tracking counters. **Not** card tracking (see `Multiverse`) | - | Used by State to collect data points, passed to `CardRender`/`Render` for display |
| Trade | _data_ class | Represents a resource trade or transfer between bank and/or players | `Players`, `Resources` | * |
| Trigger | _base_ class | Derive from this to add event-like processing to a class | - | Data pipelines (`Observer`(s), `ColonistSource`, `State`) use triggers to pass game events. `Connect` uses triggers to pass the browser action |
| utils.js | functions, objects | _Ad hoc_ | - | * |
| plot.js | plot functions | Bundles all plotting. Is a mess. | Expects data + HTML element to fill. Uses the Plotly library | `CardRender`/`Render` use it to fill HTML divs with plots |

### background.js

A background script is needed when using the messaging API for [dump](#dump).

### cocaco.js

Entry point to the extension. Also implements the WebSocket data
exfiltration/infiltration. Generated frames are buffered in a `FrameQueue` and
delayed in the JS event loop relative to the thread obtaining them. This is
needed to ensure that frames are handled in-order. Specifically, we want the
host's post-send code to execute before processing incoming frames and
potentially sending responses. Failing to account for this will result in
mismatched sequence counters by Colonist.

### config

`cocaco_config.js`

Most options are used ad-hoc or for testing. Some are to switch between
behaviours. When we use the replay option for testing, some conflicting options
are overwritten so they do not need to be edited manually whenever testing.

We use the config systematically by having the `ConsoleLog` class check for
values derived from instance names.

### Collude

The exact algorithm could be subject to change. The data structures may not
recover correctly when reloading the browser tab. Collusion states may become
inconsistent between players, leading to side-effects.

In friendly games, `cocaco_config.collude.maxOfferPerSide` should be set to
5 to ensure that discrepancies in resource totals are appropriately addressed.
The default is better for bot games where uneven trades synergise poorly with
bots.

### CollusionPlanner

Main collusion module. Some collusion decisions are made by the `State` methods
themselves.

### CollusionTracker

Used to halt automatic trade responses when an inconsistent (proxy for user
generated) trade occurs. The class was originally planned differently and
became a little bit lean and pointless.

### ColonistObserver

Some stateful components are implemented for trading. There may be confusion
about the trade creator and raw creator. We always use creator to be the player
who's turn it is. Trades are always from that player's perspective (outgoing
resources positive, incoming negative).

Generates the collusion related frames to be injected by `Resend` (somewhat
illogically).

### ColonistTrade

Uses the `combineObject()` function. Works but may bot be robust. When the
extension is started during a game, the existing trades may be missing in the
tradeState, causing some errors to be displayed.

### Connect

### ConsoleLog

Reads [cocaco\_config](#config) to enable/disable initially.

### Delay

### dependencies

`dependencies/*`

To simplify installation, we copy the library code to the Cocaco repository.
The [GitHub zip download](https://github.com/Lolligerhans/cocaco/tags) will
then contain them. The git submodules specify the versions distributed with
Cocaco.

### dump

`dump/cocaco_dump.py`

Cocaco can dump the WebSocket connection to disc. This requires a native
application. The python script `dump/cocaco_dump.py` implements this native
partner application. This application require additional setup by (manually)
following `command_provide_manifest()` from [the runscript](/run.sh) (the
script is not runnable).

### EmbargoTracker

### FrameQueue

Not sure the implementation is actually needed technically.

### MessageLog

Deprecated. Originally meant to handle both logs to console and `HTMLElement`s.
Now we use `ConsoleLog` and modify `HTMLElement`s manually if we want to.

### Multiverse

For legacy reasons, a separate resource system is used. Use `asSlice()` for
conversion. The data object is updated manually. The stats format and
generation code is bad.

### Observer

Derive from and use only the inherited methods to emit observations.

### Player

Handled by `Players` only. Construct only to initialize `Players`. The
`Player.id` is whatever the host used to identify players. For Colonist it is
values of a colour enum.

### Players

We ensure that all relevant data is present on construction. Then we only ever
reference the `Player` objects returned by `Players`. We never modify them or
construct ones manually. We can get players by each of their attributes, but
for our code we stick to using their indices which are assigned 0 to N-1 in
order of assignment in the `Players`' array.

### RenderCards

It will be easier to inspect a concrete instantiation of the card display in
the DOM than reading the code. We hide/show cards and panels by setting CSS
properties. Most of the displayed elements are generated only once during
startup. The naming is not always consistent and generally confusing currently.

### Reparse

Copy the existing reparser registrations when adding a new reparser (the
callback ladder may not be the best idea in retrospect). Reparsers are
automatically unregistered on error. This prevents bricking when unimportant
reparsers fail. But it can also halt execution when a core reparser is stopped.

### ReparseOptions

### Replay

The hardcoded test data contains most interactions of base game, but some dev
cards are missing. To test these dev cards, new data would need to be recorded
with [dump](#dump).

### Resend

There is no high level way to send frames. Is first to register a reparser to
be able to filter and edit frames before the regular reparser see them.

### Resources

Simple data class for a set of resource cards. Used as source for resource
names, costs (TODO) and resource categorization. Most member functions operate
in-place on the `this` object.

### serialize.js

Functions to encode/decode WebSocket messages to frames. WebSocket data is
almost MessagePack encoded. The `str` value is apparently not MessagePack. We
use a hack to process it; might break at any time. See
[message_format.md](colonist/message_format.md#frames-sent-from-client-to-server).

### socket

`socket_{main,isolated}.js`

In the isolated world we define a reference to the hooked WebSocket object, and
export a setter for exfiltration. The main world script has permission to
access window.WebSocket, passing it to the isolated world. Additionally, the
main world script defines the callbacks to be used from the hooked WebSocket.

### State

High level behaviours probably originate here.

### Toggle

The `"global"` flag has a special meaning. The interaction between
`toggleAll()` and the global flag may trip up users.

### Track

The probabilities need for the rolls plot are computed on `updateRollsData()`.
This saves the compute until is is actually needed, but must not be forgotten.

Cards are tracked by `Multiverse`.

### Trade

The `Trade.taker === "bank"` special case must be considered. In some contexts,
a `Trade.giver` or `Trade.taker` might be missing because we use this class for
trade offers, too (which provide only one player).

### Trigger

Register listener with `onTrigger`. Callback is executed when
`activateTrigger()` is invoked. The special `"trigger_always"` name should be
avoided.

We store all incoming socket data until the trigger chain used in
[pipelines](pipelines.md) is constructed. Otherwise we could miss a few initial
frames that arrive before all triggers are prepared..

### utils.js

Whatever has no or few dependencies and does not fit elsewhere.

### plot.js

Plotting functions. They take a `HTMLElemen` to plot into and references to the
necessary tracking objects (read only). Some styling to size is hardcoded.
Positioning is done in CSS.

<!-- vim: set tw=0: -->
