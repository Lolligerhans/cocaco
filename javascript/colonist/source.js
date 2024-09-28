// Source for Colonist WebSocket pipeline

"use strict";

class ColonistSource extends Trigger {
    // Functions producing the log message Source packets
    static logInterpreters = {};
    // Function name used to interpret each log-message type
    static typemap = {
        1: "buyDev",
        5: "buyBuilding",
        10: "roll",
        14: "stealAgainstThem",
        15: "stealAgainstUs",
        16: "stealRandom",
        21: "yop",
        47: "got",
        55: "discard",
        86: "mono",
        115: "tradePlayer",
        116: "tradeBank",
        117: "tradeCounter",
        118: "tradeOffer",
    };
    constructor() {
        super();
        this.registerPacketGenerators();
    }
};

// ╭───────────────────────────────────────────────────────────╮
// │ Setup                                                     │
// ╰───────────────────────────────────────────────────────────╯

// Register reparsers for log elements
ColonistSource.prototype.registerPacketGenerators = function () {
    new Reparse(
        "ColonistSource-playerUserStates",
        Reparse.applyDoers.isState(),
        Reparse.entryPoints.payload,
        payload => this.readPlayerUserStatesData(payload),
        packet => {
            this.activateTrigger("playerUserStates", packet);
            return true; // Done -> matched reparser only once
        },
    ).register();
    new Reparse(
        "ColonistSource-gameLogState",
        Reparse.applyDoers.isStateOrDiff(),
        Reparse.entryPoints.gameLogState,
        gameLogState => gameLogState,
        gameLogState => {
            Object.entries(gameLogState).forEach(([logIndex, logMessage]) => {
                const packet = this.readGameLogData(logIndex, logMessage)
                if (packet) {
                    this.activateTrigger("gameLogState", packet);
                }
                else {
                    // Nothing
                }
            });
            return false; // Not done -> repeat reparser
        },
    ).register();
    // HACK: Allow the user to enter username manually to determine "us". It may
    //       be that the first entry of playerUserStates
    //       is always "us", but for now we use the DOM element.
    this.onTrigger("internalPlayerUsername", packet => {
        this.activateTrigger("playerUsername", packet);
        return true;
    });
}

// ╭───────────────────────────────────────────────────────────╮
// │ Packet generators                                         │
// ╰───────────────────────────────────────────────────────────╯

// Use 'onTrigger' to obtain the Source packets

ColonistSource.prototype.readPlayerUserStatesData = function (payload) {
    const packet = {
        type: "playerUserStates",
        data: payload,
    };
    return packet;
}

ColonistSource.prototype.readGameLogData = function (logIndex, logMessage) {
    console.assert(logMessage.text);
    console.assert(logMessage.text.type != null); // Neither undefined nor null
    const type = ColonistSource.typemap[logMessage.text.type];
    if (!type || !ColonistSource.logInterpreters[type]) {
        return null;
    }
    const data = {
        index: logIndex,
        type: type, // Log message type, not Source packet type
        payload: ColonistSource.logInterpreters[type](logMessage),
    };
    const packet = { type: "gameLogState", data: data };
    return packet;
}

ColonistSource.prototype.setPlayerUsername = function (name) {
    const packet = {
        type: "playerUsername",
        data: name,
    };
    this.activateTrigger("internalPlayerUsername", packet);
}

// ╭───────────────────────────────────────────────────────────╮
// │ Log-message interpreters                                  │
// ╰───────────────────────────────────────────────────────────╯

ColonistSource.logInterpreters.roll = function (logMessage) {
    const sum = logMessage.text.firstDice + logMessage.text.secondDice;
    const payload = {
        player: {
            index: logMessage.text.playerColor,
        },
        number: sum,
    };
    return payload;
}

ColonistSource.logInterpreters.got = function (logMessage) {
    console.assert(logMessage.text.type === 47);
    const payload = {
        player: logMessage.text.playerColor,
        cards: logMessage.text.cardsToBroadcast,
    };
    return payload;
}

ColonistSource.logInterpreters.tradeBank = function (logMessage) {
    const payload = {
        player: { index: logMessage.text.playerColor },
        give: logMessage.text.givenCardEnums,
        take: logMessage.text.receivedCardEnums,
    };
    return payload;
}

ColonistSource.logInterpreters.yop = function (logMessage) {
    const payload = {
        player: { index: logMessage.text.playerColor },
        cards: logMessage.text.cardEnums
    };
    return payload;
}

ColonistSource.logInterpreters.mono = function (logMessage) {
    const cardList = new Array(
        logMessage.text.amountStolen
    ).fill(logMessage.text.cardEnum);
    const payload = {
        player: { index: logMessage.text.playerColor },
        cards: cardList,
        card: logMessage.text.cardEnum,
    };
    return payload;
}

ColonistSource.logInterpreters.tradeOffer = function (logMessage) {
    const payload = {
        player: { index: logMessage.text.playerColor },
        cards: logMessage.text.offeredCardEnums,
    };
    return payload;
}

ColonistSource.logInterpreters.tradeCounter = function (logMessage) {
    const payload = {
        player: { index: logMessage.text.playerColorCreator },
        cards: logMessage.text.offeredCardEnums,
    };
    return payload;
}

ColonistSource.logInterpreters.tradePlayer = function (logMessage) {
    const payload = {
        player: { index: logMessage.text.playerColor },
        cards: logMessage.text.givenCardEnums,
        target_player: { index: logMessage.text.acceptingPlayerColor },
        target_cards: logMessage.text.receivedCardEnums,
    };
    return payload;
}

ColonistSource.logInterpreters.discard = function (logMessage) {
    console.assert(logMessage.text.areResourceCards === true);
    const payload = {
        player: { index: logMessage.text.playerColor },
        cards: logMessage.text.cardEnums,
    };
    return payload;
}

ColonistSource.logInterpreters.buyDev = function (logMessage) {
    const payload = {
        player: { index: logMessage.text.playerColor },
    };
    return payload;
}

ColonistSource.logInterpreters.buyBuilding = function (logMessage) {
    const payload = {
        player: { index: logMessage.text.playerColor },
        building: { index: logMessage.text.pieceEnum },
    };
    return payload;
}

ColonistSource.logInterpreters.stealRandom = function (logMessage) {
    console.assert(logMessage.specificRecipients);
    const payload = {
        player: { index: logMessage.text.playerColorThief },
        victim: { index: logMessage.text.playerColorVictim },
        cards: logMessage.text.cardBacks,
    };
    console.assert(payload.cards.length === 1, "We can only steal 1 card");
    console.assert(payload.cards[0] === 0, "Steal is unknown");
    return payload;
}

ColonistSource.logInterpreters.stealAgainstUs = function (logMessage) {
    console.assert(logMessage.toSpectators === false);
    const payload = {
        // Only the thief is listed
        player: { index: logMessage.text.playerColor },
        cards: logMessage.text.cardEnums,
    };
    return payload;
}

ColonistSource.logInterpreters.stealAgainstThem = function (logMessage) {
    console.assert(logMessage.toSpectators === false);
    const payload = {
        // Only the victim is listed
        player: { index: logMessage.text.playerColor },
        cards: logMessage.text.cardEnums,
    };
    return payload;
}

// ╭───────────────────────────────────────────────────────────╮
// │ Interface                                                 │
// ╰───────────────────────────────────────────────────────────╯

