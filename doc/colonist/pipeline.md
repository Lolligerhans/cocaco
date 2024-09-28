<!-- The auto generated table likes to produce this error -->
<!-- markdownlint-disable link-fragments -->

# Colonist Pipeline

<!--toc:start-->
- [Colonist Pipeline](#colonist-pipeline)
  - [WebSocket](#websocket)
    - [Data](#data)
    - [Source](#source)
    - [Observer](#observer)
  - [TODO: DOM (Version 3)](#todo-dom-version-3)
<!--toc:end-->

One [pipeline](../pipelines.md) is implemented for [Colonist][Colonist]. For
completeness we list the DOM implementation here despite not adhering to the
pipeline structure.

| Method | Advantage | Disadvantage |
|:-|:-:|:-:|
| WebSocket | fast, thorough | opaque, unofficial |
| DOM | simple, transparent | slow, hacky |

## WebSocket

The Colonist WebSocket pipeline is coordinated in `colonist.js`.

Currently, it emulates the DOM "pipeline" by ignoring the more detailed data
when playing a monopoly card. As a byproduct, we (almost) only pay attention to
only the log message updates.

### Data

The `Reparse` class is used as Data module. Reparsers hook WebSocket
communication and allow some rudimentary filtering. We use them to obtain
updates to selects parts of the game state.

Reparsers work by instantiating `Reparse` and calling `register()` on the
instance. Instantiation takes a filters; typically we would choose from the list
of predefined filter functions, or use no-op/identity functions to obtain
unfiltered data.

### Source

The Source module uses the Data module's filtering to obtain updates to the log
element, and player related frames. It translates colonists log message type and
extracts the useful bits from each.

We derive from `Trigger` to provide a set of triggers (i.e., events). Each
trigger corresponds to a type of message found in the game log element. The
player related source packets get their own triggers. Upon receiving a data
frame from the Data module, the corresponding trigger is activated, and only the
extracted parts are provided.

Player related Data frames are needed for deducing the player names and colour
maps for the `start` observation.

We manually pass the "us" player name from the DOM element because it is left
implicit in the Data frames.

### Observer

Subscribes to the Source module's triggers. In effect, the observer is alerted
for each log message (by a Source packet of corresponding type), obtaining only
the relevant contents.

Each trigger corresponds to a handler tasked to generate the appropriate
observation. The prototype of base class `Observer` help constructing valid
observations.

The player related handlers update the observer's internal state to allow some
pipeline specific, stateful logic for deducing the "us" player and the colour
mapping.

## TODO: DOM (Version 3)

<!--
 !  ╭─────────────────────────────────────────────────────────╮
 !  │ Links                                                   │
 !  ╰─────────────────────────────────────────────────────────╯
-->

[Colonist]: https://colonist.io/ "Colonist homepage"
