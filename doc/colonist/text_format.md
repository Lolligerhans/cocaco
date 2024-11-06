# The format of the "text" type state data

Text log messages are sent with id=130 using type 91 state update (or type 4 set
state), as part of `message.payload.gameLogState`.

> [!EXAMPLE]
>
> ```JSON
> "1": {
>   "text": {
>     "type": 14,
>     ...
>   }
>   "from": 1
> }
> ```

Each log-messages has a key (indicating its position in the log element?). The
value is an object with `text` and `from` keys. The values belonging to
`text.type` are described below. `from` appears to identify the client
originating the message. Maybe the server forwards these messages to some degree
(rather than producing them)?

## Types

- 0: reconnected
  - text
    - type: 0
    - playerColor: 1
  - from: 1
- 1: Buy dev card
  - text
    - type: 1,
    - playerColor: 1
  - from: 1
- 2: Hello message
- 4: Placing
  - playerColor: 1-4
  - pieceEnum: 0-?
    - 0: settlement
    - 2: road
- 5: Buy building
  - text
    - playerColor: (colour enum)
    - pieceEnum
    - isVp: true (indicates if a VP message should be added)
  - from: 1
- 10: rolling
  - playerColor
  - firstDice: 1-6
  - secondDice: 1-6
- 11: Moved robber (the note, not the steal effect)
  - text: {
    - type: 11
    - playerColor: 1
    - pieceEnum: 5
    - tileInfo
      - tileType: 5 (?)
      - diceNumber: 4
      - resourceType: 5
  - from: 1
- 14: Known steal us from them
  - text:
    - type: 14
    - playerColor: 4 (this is the victim)
    - cardEnums: \[ 5 \]
  - from: 1 (this is us)
  - specificRecipients: \[ 1 \],
  - toSpectators: false
- 15: Known steal them to us
  - text
    - type: 15
    - playerColor: 2 (their index)
    - cardEnums: \[ 5 \]
  - from: 2
  - specificRecipients: \[ 1 \]
  - toSpectators: false
- 16: Uniform random unknown steal (only robber or also choose-steal in C&K?)
  - text
    - type: 16
    - playerColorThief: 2
    - playerColorVictim: 4
    - cardBacks: \[ 0 \]
  - from: 2
  - specificRecipients: \[ 1, 3 \]
- 20: Development card played (activation message, not effect)
  - playerColor (color enum)
  - cardEnum: int (card enum)
- 21: YOP effect (get cards)
  - text
    - playerColor: (player/colour enum),
    - cardEnums: \[ 1, 5 \]
  - from: 1 (player enum)
- 44: divider line to start of new turn
  - text
    - type: 44
- 47: Got resource (from tile) message
  - text
    - playerColor
    - cardsToBroadcast: \[ 1, 5, ... \]
    - distributionType: 1 (1 for regular, 0 for initial resources)
  - from
- 49: Blocked by robber (hence no resource gain)
  - tileType: 4 (?)
  - diceNumber: 7
  - resourceType: 4
- 55: Discard resource cards
  - text
    - type: 55
    - playerColor: 1
    - cardEnums: \[ 5, 5, 5, 5 \]
    - areResourceCards: true (?)
  - from: 1
- 86: Getting resources for monopoly
  - text
    - playerColor: int (color enum of stealing player)
    - amountStolen: int
    - cardEnum: int (card enum)
  - from
- 115: Trading (with other players)
  - text
    - playerColor: 3
    - acceptingPlayerColor: 4
    - givenCardEnums: \[ 1, 2 \]
    - receivedCardEnums: \[ 5 \]
  - from: 3
- 116: Trading (with with the bank)
  - text
    - type: 116
    - playerColor
    - givenCardEnums: \[1, 1\]
    - receivedCardEnums: \[ 5 \]
  - from: 1 (player colour index)
- 117: Trade offer counter
  - text
    - type: 117
    - playerColorCreator: 1 (player making the counter offer)
    - playerColorOffered: 3 (player who made the original trade)
    - wantedCardEnums: [ 1, 5 ]
    - offeredCardEnums: [ 2, 3 ]
  - from: 1
- 118: Trade offer (players)
  - text
    - type: 118
    - playerColor: 3
    - wantedCardEnums: [ 1 ]
    - offeredCardEnums: [ 1 ]
  - from: 3
