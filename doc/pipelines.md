<!-- markdownlint-disable link-fragments -->
<!-- 🚫 markdownlint-disable no-multiple-blanks -->
<!-- 🚫 markdownlint-disable line-length -->

# Pipelines

<!--toc:start-->
- [Pipelines](#pipelines)
  - [Pipeline steps](#pipeline-steps)
  - [Data](#data)
  - [Source](#source)
  - [Observer](#observer)
    - [Observations](#observations)
      - [List of standard properties](#list-of-standard-properties)
        - [`players` property](#players-property)
        - [`colours` property](#colours-property)
        - [`phase` property](#phase-property)
        - [`trader` property](#trader-property)
        - [`resource` property](#resource-property)
        - [`transfer` property](#transfer-property)
        - [`trade` property](#trade-property)
<!--toc:end-->

Input into the Cocaco extension flows through multiple pipelining steps before
reaching the resource tracker. Each step takes (only) the output of the previous
layer.

Currently there is only one pipeline: `Colonist`.

## Pipeline steps

Pipelines consist of three modules:

1. Data
1. Source
1. Observer

***Data*** Generate Data frames via some raw method of data access, e.g., hooking
WebSockets or parsing DOM element.

***Source*** Convert Data frames output to Source packets with common (but loose)
conventions for naming and structure.

***Observer*** Convert Source packets to observations with common (and strict)
convention for naming, structure and semantic.

The Observer's observations are finally interpreted by the State module to
create the client's view of the active game. The state module is independent of
the source of data and pipeline used.

## Data

A module responsible for the raw data extraction method. They query, hook or
read the host website however necessary to obtain access to the desired data, in
whatever form the data is available. We call each output a Data frame.

## Source

A Source module is responsible for converting Data frames to a simple JS object.
We call each such object a source packet.

Sources should read Data frames with the goal of conveying their meaning,
without introducing their own meaning (the Observer module does that). Sources
may make stateless, simple, 1-to-1 translations when relaying the content of
Data frames.

Sources should drop any data they can identify as obsolete for the intended
purposes. For example, sources should drop Data frames it can identify as chat
messages or UI confetti. Often, this dropping will consist of merely picking the
intended data from the full Data frame.

Sources may interpret names and magic numbers within the Data output for better
consistency with other pars of the input pipeline. Sources must not do so in
a stateful manner, i.e., all transformation should be only functions of the Data
frame.

Sources should emit Source packets in the order corresponding of the data
frames. Sources may opt to cooperate with the Observer to find a more suitable
ordering.

If the naming convention or data format within Data frames change, the Source
should be the place to hide these changes from the later pipeline steps.

## Observer

An Observer module is responsible for converting Source packets from their
specific per-Data format and meaning, to a common set of observation.

Observations typically correspond to atomic in-game events as human players
would experience them, like robbing a player or getting cards.

Observers can contain significant stateful components to implement the desired
observations.

### Observations

Observations specify structure and semantics. Passing observations to the State
module results in application of the corresponding semantic changes to the
represented game state.

```JSON
observation: {
  type: "type",
  payload: {
    ...
  }
}
```

Observation type and payload are defined by the `Observer` base class.

The `start` observation must always be observed first.

#### List of standard properties

> [!TODO]
> Replace by defining JS classes

##### `players` property

A set of [player](#player-property)s. Although the JavaScript array is ordered,
no order is to be inferred from the contents.

```JSON
players: [ <...player> ]
```

##### `colours` property

An object mapping [player](#player-property) names to colours.

```JSON
colours: {
  <name>: <colour>,
  ...
}
```

```JSON
colour: "orange"
colour: "#ff8800"
colour: "rgb(255,128,0)"
```

##### `phase` property

A string representing the game phase. This property breaks generality a bit
since it is dependent on the interface through which the game is presented.

Currently we only differentiate `"main"` which is the moment suitable for
automatic actions, and `""` to not specify a phase.

```JSON
phase: "main"
phase: ""
```

##### `trader` property

A [player](#player-property) or the `"bank"`.

```JSON
trader: <player>
trader: "bank"
```

##### `resource` property

Describes a single resource, or resource type. Observations may require resource
not to be `"unknown"`.

```JSON
resource: "unknown"
resource: "wood"
resource: "brick"
resource: "sheep"
resource: "wheat"
resource: "ore"
resource: "unknown"
```

##### `transfer` property

An monodirectional exchange of [resources](#resources-property) between
[trader](#trader-property)s.

```JSON
transfer: {
  from: <trader>,
  to: <trader>,
  resources: <resources>,
}
```

> [!WARNING] Deprecated
> I believe we just use the class `Trade` instead now.

##### `trade` property

A bidirectional card exchange. Give and take should both be present. For
monodirectional exchanges, use a [transfer](#transfer-property) instead.

If the trade is between a [player](#player-property) and the `"bank"`, the trade
must be from the player's perspective. I.e., both `give.from` and `take.to` must
refer to the player.

> [!WARNING] Deprecated
> I believe we just use the class `Trade` instead now.

```JSON
trade: {
  give: <transfer>,
  take: <transfer>,
}
```
