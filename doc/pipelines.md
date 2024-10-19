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
        - [`player` property](#player-property)
        - [`players` property](#players-property)
        - [`colours` property](#colours-property)
        - [`phase` property](#phase-property)
        - [`trader` property](#trader-property)
        - [`resource` property](#resource-property)
        - [`resources` property](#resources-property)
        - [`transfer` property](#transfer-property)
        - [`trade` property](#trade-property)
        - [`buyable` property](#buyable-property)
      - [List of standard observations](#list-of-standard-observations)
        - [`buy` observation](#buy-observation)
        - [`collude` observation](#collude-observation)
        - [`collusionAcceptance` observation](#collusionacceptance-observation)
        - [`collusionOffer` observation](#collusionoffer-observation)
        - [`discard` observation](#discard-observation)
        - [`got` observation](#got-observation)
        - [`mono` observation](#mono-observation)
        - [`offer` observation](#offer-observation)
        - [`roll` observation](#roll-observation)
        - [`start` observation](#start-observation)
        - [`steal` observation](#steal-observation)
        - [`turn` observation](#turn-observation)
        - [`trade` observation](#trade-observation)
        - [`yop` observation](#yop-observation)
<!--toc:end-->

Input into the Cocaco extension flows through multiple pipelining steps before
reaching the resource tracker. Each step takes (only) the output of the previous
layer. While the pipeline is a linear sequence of processing steps, some
branching may be incurred by using multiple of such pipelines at the same time.

Currently there is only one pipeline: `Colonist`.

## Pipeline steps

Pipelines consist of three modules:

1. Data
1. Source
1. Observer

<!--FIXME: Definitions dont work on gitlab. Work on github?-->
Data
: Generate Data frames via some raw method of data access, e.g., hooking
WebSockets or parsing DOM element.

Source
: Convert Data frames output to Source packets with common (but loose)
conventions for naming and structure.

Observer
: Convert Source packets to observations with common (and strict) convention for
naming, structure and semantic.

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

A Observer module is responsible for finally converting Source packets from
their specific per-Data format and meaning, to a standardized set of
observation.

Observations typically correspond to atomic in-game events as human players
would experience them, like robbing a player or getting cards.

Observers should not introduce additional splitting of in-game events into
multiple sub-events (e.g., split robbing into robber movement + card transfer).
Observers may not splice sub-events from within Source packets if the intended
semantics can be faithfully modeled by the available observations.

Observation types should not target a specific input pipeline. Rather, they
should be constructed in a generic way applicable to all forms of input.

Observations may have special or unexpected form or semantics in order to
accommodate technical requirements/limitations of an input pipeline.
Implementing the necessary logic in the Observer (and the thereby enabled use of
standard observations) must be preferred when reasonable.

### Observations

Standard observations specify structure and semantics. Passing observations to
the State module results in immediate application of the corresponding semantic
changes to the represented game state.

```JSON
observation: {
  type: "type",
  payload: {
    ...
  }
}
```

Parts of an observation may be missing. The corresponding effects on the State
objects are silently skipped. It is the responsibility of the Observer to ensure
that the included subset of properties is sufficient for allowing the desired
semantic effects on the game state.

While different observations may have identical effects on the resource counts
(e.g., building vs. discarding resources), their effects on other counters may
differ (e.g., counting discarded cards vs. counting VPs).

The [start](#start-observation) observation must always be observed first.

#### List of standard properties

For brevity, the following list of standard properties is defined for
observations. When given, the validity conditions must be met in order to
for the property to be valid.

Standard properties must be valid in all observations. Standard properties may
be omitted when the intended semantics do not depend on them.

##### `player` property

Uniquely identifies a player.

```JSON
player: {
  name: <string>,
  index: <int>,
}
```

Valid: Either name or index must set. Indices must be set by the `players`
observation before use in subsequent observations (not yet implemented
observation).

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

##### `resources` property

Describes a multiset of [resource](#resource-property)s (resource cards). No
semantic order is implied even though the JavaScript object is ordered. The
empty array is allowed, meaning no resources.

```JSON
resource: [ <...resource> ]
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

##### `trade` property

A bidirectional card exchange. Give and take should both be present. For
monodirectional exchanges, use a [transfer](#transfer-property) instead.

If the trade is between a [player](#player-property) and the `"bank"`, the trade
must be from the player's perspective. I.e., both `give.from` and `take.to` must
refer to the player.

```JSON
trade: {
  give: <transfer>,
  take: <transfer>,
}
```

##### `buyable` property

Describes a singe buyable object.

```JSON
buyable: "road"
buyable: "settlement"
buyable: "city"
buyable: "devcard"
```

#### List of standard observations

Observations consist of a type and a payload. This is meant to help the State
module to handle observations based on their type.

When applicable, the semantic effects of each observation listed below are
prepended with a list of dependency properties that must be present for its
application. When no dependencies are listed, the observation must be provided
in full.

> [!TODO]
> The exact semantics and dependencies are sometimes missing here. Add them
> later when we know what exact semantics we need effects.

##### `buy` observation

A single player buys/builds any of the objects available in-game. If cost is
missing, a default value is used.

```JSON
observation: {
  type: "buy",
  payload: {
    player: <player>,
    object: <buyable>,
    cost: <resources>,
  },
}
```

- cost: Use the specified resource instead of the default cost.

##### `collude` observation

The player issues a collusion instruction. It is the observers responsibility to
ensure that `players` includes the user. If the selected pair is already
colluding, nothing happens.

```JSON
observation: {
  type: "collude",
  payload: {
    players: <players>,
  },
}
```

##### `collusionAcceptance` observation

Another player accepted a trade.

<!-- TODO: Add details once we know the details -->

##### `collusionOffer` observation

<!-- FIXME: This is no longer the collusion model. Rewrite once we know better
how we want collusion to work exactly. -->

Another player created a collusion-abiding trade. `accept` is a function
callback for the state to accept on the action. By calling `accept()`, the trade
is accepted (attempted).

The observation does not mean: A player offers to collude.

```JSON
collusionOffer: {
  player: <player>,
  trade: <trade>,
  decide: <function>
}
```

##### `discard` observation

A single player discards resources. If the discard limit is omitted, a default
value is used (the discard limit may be used to infer a range for the amount of
cads a player might have had before discarding).

> [!TODO]
> Must allow setting the discard limit for C&K.

```JSON
observation: {
  type: "discard",
  payload: {
    player: <player>,
    resources: <resources>,
    limit: <int>,
  },
}
```

##### `got` observation

A single player obtains cards in an unspecified manner.

```JSON
observation: {
  type: "got",
  payload: {
    player: <player>,
    resources: <resources>,
  },
}
```

##### `mono` observation

A player plays a monopoly. The `resource` field specifies the resource type.
`resources` gives a list of the stolen resources (i.e., `resource` repeated
N times). If `resources` is missing, the resource type alone is taken into
account.

```JSON
observation: {
  type: "mono",
  payload: {
    player: <player>,
    resource: <resource>,
    resources: <resources>,
  },
}
```

##### `offer` observation

A player makes a trade offer to the other players. If targets are missing, all
other players are assumed to be targets. If isCounter is missing, false is
assumed.

```JSON
observation: {
  type: "offer",
  payload: {
    offer: <trade>,
    targets: <players>,
    isCounter: <bool>,
  },
}
```

##### `roll` observation

A player rolls the dice at the start of their turn (possibly after playing
a knight).

```JSON
observation: {
  type: "roll",
  payload: {
    player: <player>,
    number: <int>,
  },
}
```

##### `start` observation

A new game starts. Every player begins with 0 resources. Ideally, colours should
match the host interface. If missing, black is used as colour.

Must be the first observation and emitted exactly once. It allows the state to
initialize its own components.

The `us` property identifies our own name. This is meant to be set from the DOM
parsing result. It is unneeded for passive tracking and only used in colluding.

```JSON
observation: {
  type: "start",
  payload: {
    us: <player>,
    players: <players>,
    colours: <colours>,
  },
}
```

##### `steal` observation

One player steals from another player a single resource via an unspecified
mechanic. If the stolen resource is missing, an unknown, uniform random steal is
assumed.

```JSON
observation: {
  type: "steal",
  payload: {
    thief: <player>,
    victim: <player>,
    resource: <resource>,
  },
}
```

##### `turn` observation

Identifies to moment for actions. The phase is `"main"` refers the build/trade
phase where emitting actions for trades would be appropriate. Phase empty `""`
is used to omit specifying a phase. `player` identifies who's turn it is.

This observation breaks the state generality a little bit.

```JSON
observation: {
  type: "turn",
  payload: {
    player: <player>,
    phase: "main",
    phase: "",
  },
}
```

##### `trade` observation

A player trades resources with another player, or with the bank.
A monodirectional trade can be specified by omitting either give or take.

```JSON
observation: {
  type: "trade",
  payload: {
    give: <transfer>,
    take: <transfer>,
  },
}
```

##### `yop` observation

`player` uses a "Year of Plenty" development card. `resources` contains the
resources chosen from the bank.

```JSON
observation: {
  type: "yop",
  payload: {
    player: <player>,
    resources: <resources>,
  }
}
```
