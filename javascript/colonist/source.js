// Source for Colonist WebSocket pipeline

"use strict";

/**
 * Source for the Colonist pipeline (see: doc/pipelines.md).
 *
 * Uses @see Reparse as the Data module.
 */
class ColonistSource extends Trigger {

    /**
     * Stores the interpreters for chat message frames. Interpreters generate
     * the Source packets for the Observer module.
     * @type {Object<string,function(*):*}
     */
    static chatInterpreters = {};

    /**
     * Stores the interpreters for game state frames. Interpreters generate the
     * Source packets for the Observer module.
     * @type {Object<string,function(*):*}
     */
    static gameStateInterpreters = {};

    /**
     * Stores the interpreters for log message frames. Interpreters generate the
     * Source packets for the Observer module.
     * @type {Object<string,function(*):*}
     */
    static logInterpreters = {};

    /**
     * Maps the frame log message type to function names responsible for
     * handling them.
     * @type {Object<Number,string>}
     */
    static logTypeMap = {
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

    /**
     * Mapping from turnState enum to human readable string
     * @type {Object<Number,string>}
     */
    static turnStateMap = {
        2: "main",
    };

    /**
     * Mapping from actionState enum to human readable string
     * @type {Object<Number,string>}
     */
    static actionStateMap = {
        0: "main",
    };

    /**
     * Mapping from action enum to human readable string
     * @type {Object<Number,string>}
     */
    static actionMap = {
        0: "sendChatMessage",
        2: "rollDice",
        6: "endTurn",
        49: "tradeOfferCreate",
        50: "tradeOfferRespond",
        51: "tradeOfferFinalise",
        52: "toggleEmbargo",
        68: "forceReload",
    };

    /**
     * Reparsers are registered on construction. Make sure to enable frame input
     * only after constructing the ColonistSource.
     */
    constructor() {
        super();
        this.registerPacketGenerators();
    }

};

// ╭───────────────────────────────────────────────────────────╮
// │ Setup                                                     │
// ╰───────────────────────────────────────────────────────────╯

/**
 * Register reparsers to obtain the necessary frames from the @see Reparse
 * module.
 */
ColonistSource.prototype.registerPacketGenerators = function () {

    // It is generally a good idea to use 'setInterval()' when reacting to data,
    // to ensure that the rest of the frame has been parsed. And even that the
    // same frame has been parsed by the remaining reparsers.

    Reparse.register(
        "receive",
        "ColonistSource-playerUserStates",
        Reparse.applyDoers.isState(), // Require set (type 4, not 91)?
        Reparse.entryPoints.payload,
        // The payload of this type always contains a playerUserStates object
        payload => this.readPlayerUserStatesData(payload),
        packet => {
            this.activateTrigger("playerUserStates", packet);
            return { isDone: true };
        },
    );

    Reparse.register(
        "receive",
        "ColonistSource-gameLogState",
        Reparse.applyDoers.isStateOrDiff(),
        Reparse.entryPoints.gameLogState,
        gameLogState => gameLogState,
        gameLogState => {
            Object.entries(gameLogState).forEach(([logIndex, logMessage]) => {
                const packet = this.readGameLogData(logIndex, logMessage);
                if (packet === null) {
                    return { isDone: false };
                }
                else {
                    this.activateTrigger("gameLogState", packet);
                }
            });
            return { isDone: false };
        },
    );

    Reparse.register(
        // 'gameLogState' is exempt because we reparse it separately
        "receive",
        "ColonistSource-gameState",
        Reparse.applyDoers.isStateOrDiff(),
        Reparse.entryPoints.stateOrDiff,
        (gameState, frame) => {
            const ret = this.readGameStateData(
                gameState,
                // Accept both state and diff frames, but know which it is
                frame.data.type === 91,
            );
            return ret;
        },
        packets => {
            packets.forEach(packet => {
                if (packet === null) {
                    debugger; // TEST: Can this happen?
                    return { isDone: false };
                }
                this.activateTrigger("gameState", packet);
            });
            return { isDone: false };
        },
    );

    Reparse.register(
        "receive",
        "ColonistSource-detectCollude",
        Reparse.applyDoers.isStateOrDiff(),
        Reparse.entryPoints.gameChatState,
        gameChatState => gameChatState,
        gameChatState => {
            Object.entries(gameChatState).forEach(([chatIndex, chatMessage]) => {
                const packet = this.readGameChatData(chatIndex, chatMessage);
                if (packet) {
                    this.activateTrigger("gameChatState", packet);
                } else {
                    // Nothing
                }
            });
            return { isDone: false };
        },
    );

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
    console.assert(logMessage.text.type != null);
    const type = ColonistSource.logTypeMap[logMessage.text.type];
    if (!type || !ColonistSource.logInterpreters[type]) {
        return null;
    }
    const data = {
        index: logIndex,
        type: type, // Log message type, not Source packet type
        payload: ColonistSource.logInterpreters[type](logMessage),
    };
    const packet = {
        // Source packet type
        type: "gameLogState",
        data: data,
    };
    return packet;
}

/**
 * @param {Number} chatIndex
 * @param {Object} chatMessage Chat message as given in the frame
 * @param {Number} chatMessage.type
 * @param {string} chatMessage.message
 * @param {Number} chatMessage.from
 * @return {null|{type:string,data:{index:Number,type:string,payload:*}}}
 */
ColonistSource.prototype.readGameChatData = function (chatIndex, chatMessage) {
    const text = chatMessage.text.message;
    let type;
    if (text.match("^" + cocaco_config.collude.phrases.start + " ")) {
        type = "collusionStart";
    } else if (text.match("^" + cocaco_config.collude.phrases.stop + "$")) {
        type = "collusionStop";
    }
    else {
        return null;
    }
    const data = {
        index: chatIndex,
        type: type,
        payload: ColonistSource.chatInterpreters[type](
            chatMessage.text.from,
            text,
        ),
    };
    const packet = { type: "gameChatState", data: data };
    return packet;
}

/**
 * @param {Object} gameState gameState object of the frame
 * @param {boolean} isUpdate
 * @return {null | {type: "gameState", data: {type: string, payload: *}}}
 */
ColonistSource.prototype.readGameStateData = function (gameState, isUpdate) {
    let packets = [];
    Object.entries(gameState).forEach(([k, v]) => {
        if (!ColonistSource.gameStateInterpreters[k]) {
            return null;
        }
        const data = {
            type: k,
            isUpdate: isUpdate,
            payload: ColonistSource.gameStateInterpreters[k](v, isUpdate),
        };
        packets.push({ type: "gameState", data: data });
    });
    return packets;
}

/**
 * Capture the manual pseudo "frame" that we invoke from the Colonist main
 * module.
 * @param {string} name
 */
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
        cardsWanted : logMessage.text.wantedCardEnums,
    };
    return payload;
}

ColonistSource.logInterpreters.tradeCounter = function (logMessage) {
    const payload = {
        // Countering player
        player: { index: logMessage.text.playerColorCreator },
        cards: logMessage.text.offeredCardEnums,
        // Creator of the original trade
        originalPlayerId: logMessage.text.playerColorOffered,
        cards_wanted: logMessage.text.wantedCardEnums,
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
        playerId: logMessage.text.playerColorThief,
        victimId: logMessage.text.playerColorVictim,
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
// │ Chat-message interpreters                                 │
// ╰───────────────────────────────────────────────────────────╯

ColonistSource.chatInterpreters.collusionStart = function (player, text) {
    let others = [];
    const regEx = new RegExp(
        / (?<name>[^,]+)/g,
    );
    // console.debug("Searching", text);
    const search = text.matchAll(regEx);
    for (const other of search) {
        // console.debug("Adding", other.groups.name, other);
        others.push(other.groups.name);
    }
    // console.debug("ColonistSource: Start colluding with", others);
    const payload = {
        player: player,
        others: others,
    };
    return payload;
}

ColonistSource.chatInterpreters.collusionStop = function (player, text) {
    text; // Unused
    const payload = {
        player: player,
    };
    return payload;
}

// ╭───────────────────────────────────────────────────────────╮
// │ Game state interpreters                                   │
// ╰───────────────────────────────────────────────────────────╯

ColonistSource.gameStateInterpreters.currentState = function (currentState) {
    // Leave undefined what is missing. Set to null what is available but
    // irrelevant. Observer should store and incrementally update what is not
    // undefined.
    let turnState = ColonistSource.turnStateMap[currentState.turnState];
    let actionState = ColonistSource.actionStateMap[currentState.actionState];
    turnState ??= null;
    actionState ??= null;
    const payload = {
        currentTurnPlayerColor: currentState.currentTurnPlayerColor,
        // Use undefined if not there
        turnState: currentState.turnState === undefined ? undefined : turnState,
        actionState: currentState.actionState === undefined ? undefined : actionState,
    };
    return payload;
}

ColonistSource.gameStateInterpreters.tradeState = function (tradeState) {
    // TODO: Remap indices to something readable
    return tradeState;
}

// ╭───────────────────────────────────────────────────────────╮
// │ Interface                                                 │
// ╰───────────────────────────────────────────────────────────╯

