<!-- markdownlint-disable link-fragments # Auto table triggers this -->

# Message format

<!--toc:start-->
- [Message format](#message-format)
  - [Frames received by client from server](#frames-received-by-client-from-server)
    - [ID and type](#id-and-type)
    - [Types with id=133](#types-with-id133)
      - [11](#11)
    - [Types with id=130](#types-with-id130)
      - [1](#1)
      - [4 Set game state](#4-set-game-state)
      - [5](#5)
      - [12 Transfer website/meta state](#12-transfer-websitemeta-state)
      - [18 Development card sequence](#18-development-card-sequence)
      - [28](#28)
      - [30](#30)
      - [31 Road placing hints](#31-road-placing-hints)
      - [32](#32)
      - [33](#33)
      - [43 Card movement](#43-card-movement)
      - [44 Game state](#44-game-state)
      - [48 User update](#48-user-update)
      - [73 Illegal chat message](#73-illegal-chat-message)
      - [80](#80)
      - [Receive id 130 type 90: Remote reload](#receive-id-130-type-90-remote-reload)
      - [Type 91: `diff`](#type-91-diff)
    - [Objects](#objects)
      - [actionState](#actionstate)
      - [cards](#cards)
      - [currentState](#currentstate)
      - [diff](#diff)
      - [gameChatState](#gamechatstate)
      - [gameLogState](#gamelogstate)
      - [gameState](#gamestate)
      - [mechanicDevelopmentCardsState](#mechanicdevelopmentcardsstate)
      - [playerStates](#playerstates)
      - [playerUserStates](#playeruserstates)
      - [tradeState](#tradestate)
        - [activeOffers](#activeoffers)
        - [closedOffers](#closedoffers)
      - [turnState](#turnstate)
    - [Values](#values)
      - [Development cards](#development-cards)
      - [Resource cards](#resource-cards)
      - [Buildings](#buildings)
      - [Colours](#colours)
  - [Frames sent from client to server](#frames-sent-from-client-to-server)
    - [`v0`=2, `v1`=2](#v02-v12)
      - [action 2: Create lobby (?)](#action-2-create-lobby)
    - [`v0`=2 `v1`=3 "lobby": Within a game creation dialogue](#v02-v13-lobby-within-a-game-creation-dialogue)
      - [action 23: Change bot difficulty](#action-23-change-bot-difficulty)
    - [`v0`=3 `v1`=1 "in-game": Actions during games](#v03-v11-in-game-actions-during-games)
      - [action 0: Send chat message](#action-0-send-chat-message)
      - [action 2: Roll dice](#action-2-roll-dice)
      - [action 6: End turn](#action-6-end-turn)
      - [action 9: Buy dev card](#action-9-buy-dev-card)
      - [action 10: Press road buy button](#action-10-press-road-buy-button)
      - [action 11: Build road](#action-11-build-road)
      - [action 12](#action-12)
      - [action 14: Press settle buy button](#action-14-press-settle-buy-button)
      - [action 15: Build settlement](#action-15-build-settlement)
      - [action 19: Build city](#action-19-build-city)
      - [action 49: Trade offer](#action-49-trade-offer)
      - [action 50: Trade response](#action-50-trade-response)
      - [action 51: Accept (our) trade](#action-51-accept-our-trade)
      - [action 52: Toggle embargo](#action-52-toggle-embargo)
      - [action 67](#action-67)
      - [action 68: Reload](#action-68-reload)
<!--toc:end-->

## Frames received by client from server

We consider messages received in binary format only. Binary messages can be
decoded to JavaScript objects from [MessagePack][MessagePack].

### ID and type

All messages consist of id and data; most have this form:

```JSON
{
  id: "130",
  data: {
    type: 91,
    payload: {
      …
    },
    sequence: 1
  }
}
```

Messages have an `id` and a `type`. Both indicate the content type.

The id is the top level indicator, distinguishing between in-game data and
meta-, control- or other data. Maybe `id` denotes the source of the message in
the backend code.

The payload level indicator is `type`.

In-game messages have id="130" and a type represented by an integer. The type
determines what keys are present and/or allowed, and how they are interpreted.

`sequence` counts up from 1.

### Types with id=133

Id "133" is about website/browser control.

#### 11

Server status?

- payload
  - `newServerVersion`: 218

### Types with id=130

Id 130 is about in-game data.

#### 1

Game meta: game id, server id, settings, session, should_reset.

- id: "130"
- data
  - type: 1
  - payload
    - gameSettingId: "5f8f"
    - shouldResetGameClient: true
    - databaseGameId: "120000000" (counting upwards)
    - serverId: "012345" (used when sending game actions)
    - isReconnectingSession: false
  - sequence: 3

#### 4 Set game state

Sent at the start to transfer the entire game state (rather than a diff).

- payload
  - playerColor (us?)
  - playOrder: \[ 3, 4, 2, 1\]
  - ...

#### 5

Updates paused state?

#### 12 Transfer website/meta state

Seems to be something about setting up the game at the start.
Also contains lobby games.

#### 18 Development card sequence

Starts the development card related UI cations.

After YOP:

- `payload`
  - `developmentCardUsed`: 15, (development cards enum)
  - `selectCardFormat`
    - `cancelButtonActive`: true,
    - `allowableActionState`: 32, (mono: 33)
    - `amountOfCardsToSelect`: 2,
    - `validCardsToSelect`: \[ 1, 2, 3, 4, 5 \],
    - `showCardBadge`: true, (mono: false)
    - `disableCardTypesIfBankStackIsEmpty`: true (mono: missing this property)

#### 28

Starts the flying card animation.

#### 30

30 - 33 seem to be sent every time after we roll. Maybe some update from/for
each player? Maybe containing server feedback for potentially disallowed
actions?

#### 31 Road placing hints

When not empty, indicates places (indices) to build roads at.

Often empty.

- `payload`: \[22, 23, 70, 50\] (presumably, road edge indices)

#### 32

Empty

#### 33

Also empty?

#### 43 Card movement

Card movements: buy/trade/bank-trade. Including development cards (when
bought/used). Sent multiple times for monopoly. This appears to control the
implementation (rather than the UI or log elements).

`receivingPlayer: 0` means bank.

- "payload": (Here playing a YOP)
  - "givingPlayer": 1
  - "givingCards": \[ 15 \]
  - "receivingPlayer": 0
  - "receivingCards": \[\]

#### 44 Game state

Second id=130 message? Sends a game object.
Karma, player settings, dice settings, bot speed, private, ....

#### 45 End game state

Contains the end of game statistics. It is comparatively large (150kB) because
it contains the replay data.

#### 48 User update

Updates the "us" player as (logged in or temporary) user.

#### 73 Illegal chat message

Sent when trying to chat as spectator.

May also be illegal-generic-action where `type: 15` identifies the illegal chat
action.

```JSON
"frame": {
  "id": "130",
  "data": {
    "type": 73,
    "payload": {
      "type": 15
    },
    "sequence": 27
  }
}
```

#### 80

Payload is `null`.

#### Receive id 130 type 90: Remote reload

Sent in response to server-checked invalid actions like buying messages for
buyables we cannot afford. Is answered by [action 68](#action-68-reload).

```JSON
frame: {
  "id": "130",
  "data": {
    "type": 90,
    "payload": true,
    "sequence": 99
  }
}
```

#### Type 91: `diff`

Contains `diff` object. Client state is updated with all present values.

### Objects

Messages contain a hierarchy of JavaScript objects. Much of it appears to be
directly related to the internal representation of the game state.

#### actionState

Identify set of legal action for the client.

`actionState` 28 is accompanied by a `playerStates` object with `isTakingAction`
set to true for the affected players.

| value | meaning |
|-|-|
| 0 | Awaiting actions during main phase (buy/trade) |
| 1 | Place one initial settlement |
| 3 | Place one initial road |
| 4 | Decide on trade offers ❔ Select edge to build road ❔ |
| 6 | Decide on intersection to build settlement at |
| 7 | Decide on settlement to upgrade to city |
| 24 | Select time to move robber to (after rolling 7) |
| 27 | Select opponent to rob (after moving robber onto them) |
| 28 | Select cards to discard |

#### cards

Array of numbers. All resource, dev and other cards are combined into
one enum.

```JSON
{ cards: [1, 2, ..., 15] }
```

#### currentState

Part of `gameState`.

Informs the client about the state of the game. The client infers from this
object what UI mode (like discarding, robbing, regular) to activate and what
actions to accept from the user (and what actions the server will accept).

`turnState` is missing in (some?) updates. `allocatedTime` is in seconds.
`actionState` determines the action interface of the client. `turnState` is the
logical state within the game.

When the `currentTurnPlayerColor` is not our own colour, it is ignored client
side. What happens during out-of-order actions like discarding?

```JSON
"currentState": {
  "completedTurns": 2,
  "turnState": 0,
  "actionState": 1,
  "currentTurnPlayerColor": 1,
  "startTime": 1700000000000,
  "allocatedTime": 480
}
```

#### diff

Contains a subset of a `gameState` object. Used to update the game state with
the parts present in `diff`. Where type 4 contains `gameState`, type 91 contains
`diff`.

- `payload`
  - `diff`
  - `timeLestInState`

#### gameChatState

Index starts at "0". `from` is the player's colour index.

```JSON
"gameChatState": {
  "0": {
    "text": {
      "type": 0,
      "message": "Message text",
      "from": 1
    }
  },
  ...
}
```

#### gameLogState

Game log states are when setting or updating the content of the game log DOM
element. Its property names reflect the index of each message in the DOM
element. The content of these properties is described [Text
Format](text_format.md) (named after their characteristic "text" property).

- `gameLogState`
  - "0": {}
  - "1": {}

#### gameState

State of the game of Catan. Almost no website/meta information.

- `gameState` = `0x8n` (N sub-segments, up to 0x8f seen)
  - `bankState` : { hideBankCards: false, resourceCards: {…}}
  - `currentState` : { completedTurns: 22, turnState: 2, actionState: 0, …}
  - `diceState` : { diceThrown: true, dice1: 4, dice2: 1}
  - `gameChatState` : { }
  - `gameLogState` : { 0: {…}, 1: {…}, 2: {…}, …}
  - `mapState` : { tileHexStates: {…}, …}
  - `mechanicCityState` : { 1: {…}, 2: {…}, 5: {…}}
  - `mechanicDevelopmentCardsState` : { bankDevelopmentCards: {…}, players: {…}}
  - `mechanicLargestArmyState` : { 1: {}, 2: {}, 5: {}}
  - `mechanicLongestRoadState` : { 1: {…}, 2: {…}, 5: {…}}
  - `mechanicRoadState` : { 1: {…}, 2: {…}, 5: {…}}
  - `mechanicRobberState` : { locationTileIndex: 20, isActive: true}
  - `mechanicSettlementState` : { 1: {…}, 2: {…}, 5: {…}}
  - `playerStates` : { 1: {…}, 2: {…}, 5: {…}}
  - `tradeState` : { activeOffers: {}, closedOffers: {}, embargoState: {…}}

#### mechanicDevelopmentCardsState

Distribution of dev cards. A precomputed deck for the bank. Lists of played and
hidden cards for players. Includes unknowable information and is true to the
order of dev cards for each player.

- `mechanicDevelopmentCardsState`
  - `bankDevelopmentCards`
    - `cards` : \[11,12,13,14,15\]
  - `players`
    - `1`
      - `developmentCards`
        - `cards` : \[11,12,13,14,15\]

> [!NOTE] 2024-09-19
> Colonist includes the secret development cards of each user, as
> well as the order of development cards in the bank.

#### playerStates

Uses each player's color to index into a state object.

Why is the colour defined again inside? Do they always match? Do they always
match the `playerUserStates` `selectedColor`?

```JSON
"playerStates": {
  "1": {
    "color": 1,
    "victoryPointsState": {},
    "bankTradeRatiosState": {
      "1": 4,
      "2": 4,
      "3": 4,
      "4": 4,
      "5": 4
    },
    "resourceCards": {
      "cards": []
    },
    "cardDiscardLimit": 7,
    "isConnected": true,
    "isTakingAction": false
  },
},
```

#### playerUserStates

Array of Objects describing one player each. The `selectedColor` is used as
player index/enum in the other objects.

```JSON
{
  "userId": "12345678",
  "username": "John",
  "icon": 12,
  "selectedColor": 1,
  "isBot": false,
  "deviceType": 1,
  "countryCode": "CountryCode",
  "membership": null,
  "profilePictureUrl": null
},
```

#### tradeState

General format:

```JSON
"tradeState": {
  "activeOffers": {},
  "closedOffers": {},
  "embargoState": {
    "1": {
      "activeEmbargosAgainst": []
    },
    "2": {
      "activeEmbargosAgainst": []
    },
    "3": {
      "activeEmbargosAgainst": []
    },
    "4": {
      "activeEmbargosAgainst": []
    }
  }
}
```

##### activeOffers

`activeOffers` uses unique 4-letter trade IDs as keys. It contains en entry for
each (if within a `diff` object: changed) trade. Being active refers to the
trade being shown to users.

The `playerResponses` keys are colour indices. Note that their values differ in
meaning from the [trade response action](#action-50-trade-response)'s `response`
field.

If the offer was made as a counter offer, the `counterOfferInResponseToTradeId`
field is set to the original trade's ID. In this case, `creator` does *not*
identify the player offering `offeredResources`. The `creator` field of the
referenced trade has to used instead. If the offer is original, the
`counterOfferInResponseToTradeId` field is missing.

| `playerResponses` | desciption |
|-:|:-|
| 0 | Undecided |
| 1 | Accepted |
| 2 | Declined |

```JSON
"activeOffers": {
  "Helo": {
    "id": "Helo",
    "creator": 2,
    "offeredResources": [
      5
    ],
    "wantedResources": [
      2
    ],
    "playerResponses": {
      "1": 0,
      "3": 0,
      "4": 0
    },
    "counterOfferInResponseToTradeId": "Ther",
    "playersCreatingCounterOffer": {
      "1": false,
      "2": false,
      "3": false,
      "4": false
    }
  }
}
```

##### closedOffers

`closedOffers` has the same structure as `activeOffers`, but only contains the
offered and wanted resources. Closed offers are still-valid offers hidden from
the user's view.

When a trade is first opened, it starts out in both `closedOffers` and
`activeOffers`. Later it is removed from `closedOffers`, resulting in display to
the user (?).

```JSON
"closedOffers": {
  "Helo": null
}
```

A trade is removed by setting the (active and closed?) offer with that ID to
`null`.

```JSON
"activeOffers": {
  "Helo": null
}
```

#### turnState

Indicates logical state within the game. Part of `currentState`.

| Value | Meaning |
|-:|:-|
| 0 | Inial placements |
| 1 | Roll phase (including robber) |
| 2 | Main phase (buy/trade) |
| 3 | End of game ❔ |

### Values

Enums encoding resource cards, dev cards, buildings, etc. These may be used as
encoding and as indices.

#### Development cards

| Icon | Decimal | Hex | Card |
|-|-:|:-:|:-|
| ♞ | 11 | 0xb | Knight |
| ⭐ | 12 | 0xc | VP |
| 📈 | 13 | 0xd | Mono |
| 🚧 | 14 | 0xe | Road Builder |
| 🎁 | 15 | 0xf | Year of Plenty |

#### Resource cards

| Icon | Decimal | Card |
|-|-:|:-|
| 🂠  | 0 | Secret |
| 🪵 | 1 | Wood |
| 🧱 | 2 | Brick |
| 🐑 | 3 | Sheep |
| 🌾 | 4 | Wheat |
| 🪨 | 5 | Ore |
| ❔  | 9 | Any (trade offer) |

#### Buildings

Also called "pieceEnum".

| Icon | Decimal | Piece |
|-|-:|-:|
| 🛣 | 0 | Road |
| 🛖 | 2 | Settlement |
| 🏢 | 3 | City |

#### Colours

| Icon | Decimal | Colour |
|-:|-:|:-|
| 🟥 | 1 | Red |
| 🟦 | 2 | Blue |
| 🟧 | 3 | Orange |
| 🟩 | 4 | Green |

## Frames sent from client to server

| byte 0 | byte 1 | byte 2 | bytes 3 - 3+str_len | bytes ... |
|-|-|-|-|-|
| `v0` | `v1` | str_len | `str` | `message` |

Sent frames start with 2 single-byte values. We call them `v0` and `v1`. They
appear a type, maybe the origin of the frame. Each combination has their own set
of messages.

Then a string prefixed with its length. Appears to encode a recipient
server ("lobby", "012345").

The rest is a [MessagePack][MessagePack] fixmap. We call it `message`
(differentiating it from `frame`, which is the entirety of sent data)

Below, known messages by type and action index.

### `v0`=2, `v1`=2

Within the lobby.

#### action 2: Create lobby (?)

```JSON
{
  "v0": 2,
  "v1": 2,
  "str": "lobby",
  "message": {
    "action": 2,
    "payload": {
      "clientVersion": 219,
      "bots": [ 1, 1, 1 ]
    }
  }
}
```

### `v0`=2 `v1`=3 "lobby": Within a game creation dialogue

#### action 23: Change bot difficulty

The last digit of `roomSessionId` indicates the player (colour?) index.

```JSON
"message": {
  "action": 23,
  "payload": {
    "botDifficulty": 0,
    "roomSessionId": "1020007"
  }
}
```

### `v0`=3 `v1`=1 "in-game": Actions during games

Within a game. `sequence` appears to include non-3-1 messages. It does stay
consistent after entering a game (any only receiving 3-1 messages). To count it
accurately we may need to include a content-script on document_start.

```JSON
message: {
  action: <int>,
  payload: <object|int|null>,
  sequence: 2
}
```

#### action 0: Send chat message

```JSON
"v0": 3,
"v1": 1,
"str": "012345",
"message": {
  "action": 0,
  "payload": "Hello world",
  "sequence": 50
}
```

#### action 2: Roll dice

`payload` = true

#### action 6: End turn

`payload` = true

#### action 9: Buy dev card

```JSON
message: {
  "action": 9,
  "payload": true,
  "sequence": 50
}
```

#### action 10: Press road buy button

`payload` = true

#### action 11: Build road

`payload` = position index

#### action 12

#### action 14: Press settle buy button

`payload` = true

#### action 15: Build settlement

`payload` = settlement position index

```JSON
message: {
  "action": 16,
  "payload": 37,
  "sequence": 85
}
```

#### action 19: Build city

`payload` = city spot

#### action 49: Trade offer

`counterOfferInResponseToTradeId` is `null` for original trades.

```JSON
message: {
  "action": 49,
  "payload": {
    "creator": 1,
    "isBankTrade": false,
    "counterOfferInResponseToTradeId": "gNJR",
    "offeredResources": [
      1
    ],
    "wantedResources": [
      3
    ]
  },
  "sequence": 19
}
```

#### action 50: Trade response

Sent to respond to trade offers, including our own trades. Multiple trade offer
`id`s can exist at the same time. `id`s are unique 4-letter strings.

When the host receives an offer for a trade we can not afford, a rejection is
scheduled immediately. I assume the immediately created response is sent within
the same event cycle (?). This is relevant if we schedule a frame with fixed
sequence number to be sent in the next event cycle.

If we send an *additional* decline message, the auto-decline is reverted. We can
then counter-offer in the host GUI.

| `response` | description |
|-:|:-|
| 0 | accept |
| 1 | decline |
| 2 | Begin edit |
| 3 | End edit |

Note that the `response` meaning is different in the received `tradeState`
frames.

Decline (1) is sent automatically and immediately if the trade cannot be
afforded. No decline is sent during an embargo against the offering player.

When making an identical counter offer both the 2 and 3 are sent, and an
accepting message in-between. If the counter offer is novel, it is sent as
a [trade offer](#action-49-trade-offer) in-between.

```JSON
{
  "v0": 3,
  "v1": 1,
  "str": "012345",
  "message": {
    "action": 50,
    "payload": {
      "id": "Helo",
      "response": 1
    },
    "sequence": 14
  }
}
```

#### action 51: Accept (our) trade

Finalizes a trade, that means, accept the accepting response. This establishes
agreement to a trade and leads to immediate realization of the trade.

```JSON
message: {
  "action": 51,
  "payload": {
    "tradeId": "Helo",
    "playerToExecuteTradeWith": 4
  },
  "sequence": 23
}
```

#### action 52: Toggle embargo

Payload is the player (colour) index of the embargoed player.

```JSON
{
  "v0": 3,
  "v1": 1,
  "str": "012345",
  "message": {
    "action": 52,
    "payload": 2,
    "sequence": 15
  }
}
```

#### action 65

❔ Send after the game ends to load the stats
<!-- TODO: verify -->

```JSON
message: {
  "action": 65,
  "payload": true,
  "sequence": 100
}
```

#### action 67

#### action 68: Reload

Outgoing invalid frames are replaced with this action. Invalid frames include

- wrong sequence number
- illegal actions

The `payload` is set to the serverId (game ID?) that is also present in the
`str` portion of sent frames.

```JSON
{
  "v0": 3,
  "v1": 1,
  "str": "012345",
  message: {
    "action": 68,
    "payload": "012345",
    "sequence": 125
  }
}
```

<!--
 !  ╭─────────────────────────────────────────────────────────╮
 !  │ Links                                                   │
 !  ╰─────────────────────────────────────────────────────────╯
-->

[MessagePack]: https://github.com/msgpack/msgpack/blob/master/spec.md#formats "MessagePack specification"
