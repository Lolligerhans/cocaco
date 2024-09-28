# Message format

<!--toc:start-->
- [Message format](#message-format)
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
    - [80](#80)
    - [Type 91: `diff`](#type-91-diff)
  - [Objects](#objects)
    - [`cards`](#cards)
    - [`diff`](#diff)
    - [`gameLogState`](#gamelogstate)
    - [`gameState`](#gamestate)
    - [`mechanicDevelopmentCardsState`](#mechanicdevelopmentcardsstate)
    - [`playerStates`](#playerstates)
    - [`playerUserStates`](#playeruserstates)
  - [Values](#values)
    - [Development cards](#development-cards)
    - [Resource cards](#resource-cards)
    - [Buildings](#buildings)
    - [Colours](#colours)
<!--toc:end-->

## ID and type

Messages have an `id` and a `type`. Both indicate the content type. The id is
the highest level indicator, distinguishing between in-game data and meta-,
control- or other data.

I speculate id might denote the source of the message in the backend code.

All messages consist of id and data; most have this form:

```JSON
{
  id: "130",
  data: {
    type: 91,
    payload: {
      …
    }
  }
}
```

In-game messages have id="130" and a type represented by an integer. The type
determines what (type of) content is present and/or allowed, and crucially, how
it is interpreted.

## Types with id=133

Id "133" is about website/browser control.

### 11

Server status?

- payload
  - `newServerVersion`: 218

## Types with id=130

Id 130 is about in-game data.

### 1

First id=130 message.
Game meta: game id, server id, settings, session, should_reset.

### 4 Set game state

Sent at the start to transfer the entire game state (rather than a diff).

- payload
  - playerColor (us?)
  - playOrder: \[ 3, 4, 2, 1\]
  - ...

### 5

Updates paused state?

### 12 Transfer website/meta state

Seems to be something about setting up the game at the start.
Also contains lobby games.

### 18 Development card sequence

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

### 28

Starts the flying card animation.

### 30

30 - 33 seem to be sent every time after we roll. Maybe some update from/for
each player? Maybe containing server feedback for potentially disallowed
actions?

### 31 Road placing hints

When not empty, indicates places (indices) to build roads at.

Often empty.

- `payload`: \[22, 23, 70, 50\] (presumably, road edge indices)

### 32

Empty

### 33

Also empty?

### 43 Card movement

Card movements: buy/trade/bank-trade. Including development cards (when
bought/used). Sent multiple times for monopoly.

receivingPlayer: 0 means bank

- "payload": (Here playing a YOP)
  - "givingPlayer": 1
  - "givingCards": \[ 15 \]
  - "receivingPlayer": 0
  - "receivingCards": \[\]

### 44 Game state

Second id=130 message? Appears to send a global game object.
Karma, player settings, dice settings, bot speed, private, ....
I guess the servers uses this to instantiate.

### 48 User update

Updates the "us" player as (logged in or temporary) user.

### 80

Payload is null?

### Type 91: `diff`

Contains `diff` object. Client state is updated with all present values.

## Objects

Messages contain a hierarchy of JavaScript objects. Much of it appears to be
directly related to the internal representation of the game state.

### `cards`

Array of numbers. All resource, dev and other cards are combined into
one enum.

```JSON
{ cards: [1, 2, ..., 15] }
```

### `diff`

Contains a subset of a `gameState` object. Used to update the game state with
the parts present in `diff`. Where type 4 contains `gameState`, type 91 contains
`diff`.

- `payload`
  - `diff`
  - `timeLestInState`

### `gameLogState`

Game log states are when setting or updating the content of the game log DOM
element. Its property names reflect the index of each message in the DOM
element. The content of these properties is described [Text
Format](text_format.md) (named after their characteristic "text" property).

- `gameLogState`
  - "0": {}
  - "1": {}

### `gameState`

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

### `mechanicDevelopmentCardsState`

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

### `playerStates`

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

### `playerUserStates`

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

## Values

Enums encoding resource cards, dev cards, buildings, etc. These may be used as
encoding and as indices.

### Development cards

| Icon | Decimal | Hex | Card |
|-|-:|:-:|:-|
| ♞ | 11 | 0xb | Knight |
| ⭐ | 12 | 0xc | VP |
| 📈 | 13 | 0xd | Mono |
| 🚧 | 14 | 0xe | Road Builder |
| 🎁 | 15 | 0xf | Year of Plenty |

### Resource cards

| Icon | Decimal | Card |
|-|-:|:-|
| 🂠  | 0 | Secret |
| 🪵 | 1 | Wood |
| 🧱 | 2 | Brick |
| 🐑 | 3 | Sheep |
| 🌾 | 4 | Wheat |
| 🪨 | 5 | Ore |

### Buildings

Also called "pieceEnum".

| Icon | Decimal | Piece |
|-|-:|-:|
| 🛣 | 0 | Road |
| 🛖 | 2 | Settlement |
| 🏢 | 3 | City |

### Colours

| Icon | Decimal | Colour |
|-:|-:|:-|
| 🟥 | 1 | Red |
| 🟦 | 2 | Blue |
| 🟧 | 3 | Orange |
| 🟩 | 4 | Green |
