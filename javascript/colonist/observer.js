// Observer for WebSocket Source reproducing DOM log message parsing.

"use strict";

class ColonistObserver extends Observer {

    static cardMap = {
        0: "secret",
        1: "wood",
        2: "brick",
        3: "sheep",
        4: "wheat",
        5: "ore",
        9: "unknown"
    };

    static cardMapInverse = invertObject(
        ColonistObserver.cardMap,
        i => Number.parseInt(i),
    );

    static buildingMap = {
        0: "road",
        2: "settlement",
        3: "city",
    };

    static colourMap = {
        1: "#e27174",
        2: "#223697",
        3: "#E09742",
        4: "#62b95d",
        5: "#3e3e3e",
    };

    static getColour(colourIndex) {
        if (Object.hasOwn(ColonistObserver.colourMap, colourIndex)) {
            return ColonistObserver.colourMap[colourIndex];
        } else {
            console.warn("ColonistObserver: Unknown colour index", colourIndex);
            return "black";
        }
    }

    // Handler for each kind of source packet
    static sourceObserver = {};

    constructor(source, state) {
        super(state);

        this.stateObject = state;
        this.nextLogMessageIndex = 0;
        this.handledLogMessagesIndices = new Set();
        // Stateful components we use to interpret Source packets
        this.state = {
            // ── Written once ───────────────────────────────────────────
            playerIndex: null,
            playerUsername: null,
            playerUserStates: null,
            nameMap: null,          // colourIndex -> name
            nameMapInverse: null,   // name -> colourIndex
            colourMap: null,

            // ── Updated incrementally ──────────────────────────────────
            currentTurnPlayerColor: null,
            turnState: null,
            actionState: null,
            trade: new Trade(),
            // Set of trade IDs we already suggested finalization for
            finalisedTrades: new Set(),
        };

        this.source = source;
        this.source.onTrigger("playerUsername", packet => {
            console.assert(packet.type == "playerUsername");
            this.observePlayerUsername(packet.data);
            return true;
        });
        this.source.onTrigger("playerUserStates", packet => {
            console.assert(packet.type === "playerUserStates")
            this.observePlayerUserStates(packet.data)
            return false;
        });
        this.source.onTrigger("gameLogState", packet => {
            console.assert(packet.type === "gameLogState")
            this.observeLogMessage(packet.data);
            return false;
        });
        this.source.onTrigger("gameChatState", packet => {
            console.assert(packet.type === "gameChatState");
            this.observeChatMessage(packet.data);
            return false;
        });
        this.source.onTrigger("gameState", packet => {
            console.assert(packet.type === "gameState");
            this.observeGameState(packet.data);
        });
        // this.source.onTrigger(null, data => {
        //     console.log("ColonistObserver: Source trigger for:", JSON.stringify(data));
        //     debugger;
        //     return false;
        // });
    }

    #isNewLogMessage(index) {
        if (index < this.nextLogMessageIndex) {
            return false;
        }
        this.nextLogMessageIndex = index + 1;
        return true;
    }

    // ╭───────────────────────────────────────────────────────╮
    // │ Dispatch source packet types                          │
    // ╰───────────────────────────────────────────────────────╯

    // These functions generate observation from source packets. Or delegate to
    // functions that do. They are based on the different 'packet.type'
    // ColonistSource emits.

    observePlayerUsername(sourceData) {
        console.assert(!this.state.playerUsername);
        this.state.playerUsername = sourceData;
    }

    observePlayerUserStates(sourceData) {
        console.assert(!this.state.playerUserStates);
        if (this.state.playerUserStates) {
            // console.debug(sourceData, this.state);
            // console.warn("ColonistObserver: Skipping duplicate playerUserStates");
            return;
        }
        this.state.playerUserStates = sourceData.playerUserStates;
        this.state.nameMap = {};
        for (const p of this.state.playerUserStates) {
            this.state.nameMap[p.selectedColor] = p.username;
        }
        this.state.nameMapInverse = invertObject(
            this.state.nameMap,
            x => Number.parseInt(x),
        );
        this.state.playerIndex = this.state.nameMapInverse[
            this.state.playerUsername
        ];
        this.state.colourMap = {};
        for (const p of this.state.playerUserStates) {
            this.state.colourMap[p.username]
                = ColonistObserver.getColour(p.selectedColor);
        }

        let allNames = sourceData.playOrder.map(i => this.state.nameMap[i]);
        rotateToLastPosition(allNames, this.state.playerUsername);

        this.start({
            us: {
                name: this.state.playerUsername,
                index: this.state.playerIndex,
            },
            players: allNames,
            colours: this.state.colourMap,
        });
    }

    observeLogMessage({ index, type, payload }) {
        index = Number.parseInt(index); // Is a string in source
        const isNew = this.#isNewLogMessage(index);
        // HACK: The Source obtains both "set state" and "state update" Data
        //       frames (See doc/colonist/message_format.md). We hope they are
        //       in the right order and simply reject any duplicates.
        if (!isNew) {
            // console.debug(this.handledLogMessagesIndices);
            // console.warn("ColonistObserver: Skipping index", index, type, payload);
            if (!this.handledLogMessagesIndices.has(index)) {
                console.warn("Out of order log messages (?)");
                // debugger;
            }
            return;
        }
        this.handledLogMessagesIndices.add(index);
        ColonistObserver.sourceObserver[type].call(this, payload);
    }

    observeChatMessage({ index, type, payload }) {
        // TODO: Verify function
        index = Number.parseInt(index);
        index; // Ignore
        ColonistObserver.sourceObserver[type].call(this, payload);
    }

    observeGameState({ type, isUpdate, payload }) {
        ColonistObserver.sourceObserver[type].call(this, payload, isUpdate);
    }

}

// ╭───────────────────────────────────────────────────────────╮
// │ Observe log message packets                               │
// ╰───────────────────────────────────────────────────────────╯
// These are specialized to the packet types our specific Source can produce.
// Each translates the contents of the Source packet into observation using the
// Observer interface function.
//
// Mostly they simply map indices to their corresponding string values.

ColonistObserver.sourceObserver.roll = function (packetData) {
    const name = this.state.nameMap[packetData.player.index];
    this.roll({
        player: { name: name },
        number: packetData.number,
    });
}

ColonistObserver.sourceObserver.got = function (packetData) {
    const name = this.state.nameMap[packetData.player];
    const res = packetData.cards.map(card => ColonistObserver.cardMap[card]);
    this.got({
        player: { name: name },
        resources: res,
    });
}

ColonistObserver.sourceObserver.tradeBank = function (packetData) {
    const name = this.state.nameMap[packetData.player.index];
    const give = packetData.give.map(r => ColonistObserver.cardMap[r]);
    const take = packetData.take.map(r => ColonistObserver.cardMap[r]);
    this.trade({
        give: {
            from: { name: name },
            to: "bank",
            resources: give,
        },
        take: {
            from: "bank",
            to: { name: name },
            resources: take,
        },
    });
}

ColonistObserver.sourceObserver.yop = function (packetData) {
    const name = this.state.nameMap[packetData.player.index];
    const cards = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    this.yop({
        player: { name: name },
        resources: cards,
    });
}

ColonistObserver.sourceObserver.mono = function (packetData) {
    const name = this.state.nameMap[packetData.player.index];
    const res = packetData.cards.map(x => ColonistObserver.cardMap[x]);
    const resType = ColonistObserver.cardMap[packetData.card];
    this.mono({
        player: { name: name },
        resource: resType,
        resources: res,
    });
}

ColonistObserver.sourceObserver.tradeOffer = function (packetData) {
    const name = this.state.nameMap[packetData.player.index];
    const res = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    const trade = {
        give: {
            from: { name: name },
            resources: res,
        },
    };
    this.offer({
        offer: trade,
    });
}

ColonistObserver.sourceObserver.tradeCounter = function (packetData) {
    const name = this.state.nameMap[packetData.player.index];
    const res = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    const trade = {
        give: {
            from: { name: name },
            resources: res,
        },
        isCounter: true,
    };
    this.offer({
        offer: trade,
    });
}

ColonistObserver.sourceObserver.tradePlayer = function (packetData) {
    const name = this.state.nameMap[packetData.player.index];
    const res = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    const name2 = this.state.nameMap[packetData.target_player.index];
    const res2 = packetData.target_cards.map(r => ColonistObserver.cardMap[r]);
    const trade = {
        give: {
            from: { name: name },
            to: { name: name2 },
            resources: res,
        },
        take: {
            from: { name: name2 },
            to: { name: name },
            resources: res2,
        },
    };
    this.trade(trade);
}

ColonistObserver.sourceObserver.discard = function (packetData) {
    const name = this.state.nameMap[packetData.player.index];
    const resources = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    this.discard({
        player: { name: name },
        resources: resources,
    });
}

ColonistObserver.sourceObserver.buyDev = function (packetData) {
    const name = this.state.nameMap[packetData.player.index];
    this.buy({
        player: { name: name },
        object: "devcard",
    });
}

ColonistObserver.sourceObserver.buyBuilding = function (packetData) {
    const name = this.state.nameMap[packetData.player.index];
    const object = ColonistObserver.buildingMap[packetData.building.index];
    this.buy({
        player: { name: name },
        object: object,
    });
}

ColonistObserver.sourceObserver.stealRandom = function (packetData) {
    const thief = this.state.nameMap[packetData.player.index];
    const victim = this.state.nameMap[packetData.victim.index];
    console.assert(packetData.cards.length === 1 && packetData.cards[0] === 0,
        "Random steals should be unknown single cards");
    this.steal({
        thief: { name: thief },
        victim: { name: victim },
    });
}

ColonistObserver.sourceObserver.stealAgainstUs = function (packetData) {
    const thief = this.state.nameMap[packetData.player.index];
    const cards = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    console.assert(cards.length === 1, "Steal exactly one card");
    this.steal({
        thief: { name: thief },
        victim: { name: this.state.playerUsername },
        resource: cards[0],
    });
}

ColonistObserver.sourceObserver.stealAgainstThem = function (packetData) {
    const victim = this.state.nameMap[packetData.player.index];
    const cards = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    console.assert(cards.length === 1, "Steal exactly one card");
    this.steal({
        thief: { name: this.state.playerUsername },
        victim: { name: victim },
        resource: cards[0],
    });
}

// ╭───────────────────────────────────────────────────────────╮
// │ Observe gameState packets                                 │
// ╰───────────────────────────────────────────────────────────╯

ColonistObserver.sourceObserver.currentState = function (
    packetData,
    _isUpdate,
) {
    // Current state tells us when it is our turn. That is the moment when we
    // can create out own trades.
    const update = (k) => {
        // If the data is there we update
        if (packetData[k] !== undefined) {
            this.state[k] = packetData[k];
        }
    };
    update("currentTurnPlayerColor");
    update("turnState");
    update("actionState");
    const playerName = this.state.nameMap[this.state.currentTurnPlayerColor];
    if (playerName !== this.state.playerUsername) {
        // Legitimate in principle. We currently care only about our turns.
        return;
    }
    const turn = this.state.turnState;
    const action = this.state.actionState;
    // Currently we only care about one specific state+action combination. We
    // capture this as the 'phase' where "main" is the only meaningful value.
    const phase = (turn === "main" && action === "main") ? "main" : "";
    if (phase !== "main") {
        // Legitimate in principle. We currently only care about phase "main".
        return;
    }

    {
        // ad-hoc test: see if trade IDs are re-used
        if (this.didResetTest !== true) {
            this.didResetTest = true;
            this.state.trade.testNewTurn();
        }
    }

    this.turn({
        player: { name: playerName },
        phase: phase,
    });
}

ColonistObserver.sourceObserver.tradeState = function (packetData, isUpdate) {
    // 'tradeState' tells us about the active trades. We use this to know when
    // to send trade accept frames. Every first time a trade appears, generate
    // a 'collusionOffer' observation.
    if (packetData.activeOffers && packetData.activeOffers.Dy79) {
        debugger; // FIXME: Bug
    }
    let newTrades;
    if (isUpdate) {
        newTrades = this.state.trade.update(packetData);
    } else {
        newTrades = this.state.trade.reset(packetData);
    }
    console.debug(
        Object.keys(newTrades).length, "newTrades,",
        newTrades,
    );

    const rawCreatorName = trade => {
        return this.state.nameMap[trade.creator];
    };
    const creatorName = trade => {
        const playerIndex = this.state.trade.creatorOfTrade(trade);
        const ret = this.state.nameMap[playerIndex];
        if (ret == null) {
            debugger; // FIXME: Bug
        }
        return ret;
    };

    // ── Collusion acceptance (maybe finalize) ──────────────────
    const suggestFinalisation = ([id, trade], acceptingPlayer) => {
        const singletonKey = id + "_" + acceptingPlayer;
        if (this.state.finalisedTrades.has(singletonKey)) {
            console.debug(
                "Not finalising", singletonKey, "(finalised previously)",
            );
            return;
        }
        this.state.finalisedTrades.add(singletonKey);
        console.debug("Finalising observation for ", singletonKey);
        let tradeProperty = {
            give: {
                from: { name: this.state.playerUsername },
                to: { name: acceptingPlayer },
                resources: null,
            },
            take: {
                from: { name: acceptingPlayer },
                to: { name: this.state.playerUsername },
                resources: null,
            },
        };
        if (acceptingPlayer == null) {
            debugger; // FIXME: Bug
        }
        Trade.fillResourcesFromFrame(tradeProperty, trade);
        const acceptingPlayerIndex = this.state.nameMapInverse[acceptingPlayer];
        const offer = {
            player: { name: acceptingPlayer },
            trade: tradeProperty,
            accept: () => {
                const tradeResponseFinalize = {
                    action: 51,
                    payload: {
                        tradeId: id,
                        playerToExecuteTradeWith: acceptingPlayerIndex,
                    },
                    sequence: this.stateObject.resend.nextSequence(),
                };
                console.debug(
                    "<finalize trade>", trade,
                    "with", tradeResponseFinalize,
                );
                this.stateObject.resend.sendMessage(
                    tradeResponseFinalize,
                );
            },
        };
        this.collusionAcceptanceOffer(offer);
    }; // suggestFinalisation()
    const acceptedTrades = this.state.trade.getByResponse(1);
    Object.entries(acceptedTrades).forEach(([tradeId, trade]) => {
        console.debug(`Evaluating tradeId=${tradeId} finalisation`);
        if (creatorName(trade) !== this.state.playerUsername) {
            console.debug("Not finalising: Not our trade");
            return;
        }
        const acceptingPlayers = Object.entries(trade.playerResponses).filter(
            ([_playerIndex, response]) => response === 1,
        ).map(
            ([playerIndex, _response]) => playerIndex,
        ).map(
            playerIndex => this.state.nameMap[playerIndex],
        );
        for (const acceptingPlayer of acceptingPlayers) {
            suggestFinalisation([tradeId, trade], acceptingPlayer);
        }
    });

    // ── Observe their collusion offers (maybe accept trade) ────
    if (Object.keys(newTrades).length === 0) {
        console.debug("Nothin new to consider their collusion offers");
        return;
    }
    const offerCollusion = ([id, trade]) => {
        const theCreator = creatorName(trade);
        if (theCreator == null) {
            debugger; // FIXME: Bug
        }
        if (theCreator == null) {
            return; // Unknown creator
        }
        const theRawCreator = rawCreatorName(trade);
        const us = this.state.playerUsername;
        console.debug(theCreator, theRawCreator, us);
        if (us === theCreator && us === theRawCreator) {
            console.debug("Ignoring our existing collusion offer", id)
            return;
        }
        if (us !== theCreator && us === theRawCreator) {
            console.debug("Ignoring our counter trade for collusion offer", trade);
            return;
        }
        let tradeProperty = {
            give: {
                from: { name: creatorName(trade) },
                to: { name: this.state.playerUsername }, // Pretend it is for us
                resources: null,
            },
            take: {
                from: { name: this.state.playerUsername },
                to: { name: creatorName(trade) },
                resources: null,
            },
        };
        Trade.fillResourcesFromFrame(tradeProperty, trade);
        const offer = {
            player: { name: creatorName(trade) },
            trade: tradeProperty,
            accept: () => {
                const tradeResponseAccept = {
                    action: 50,
                    payload: {
                        id: id,
                        response: 0,
                    },
                    sequence: this.stateObject.resend.nextSequence(),
                };
                console.debug(
                    "<accept trade>", trade,
                    "with", tradeResponseAccept
                );
                this.stateObject.resend.sendMessage(
                    tradeResponseAccept,
                );
            },
        };
        console.debug(
            "Generating collusion offer observation for new trade",
            trade,
        );
        this.collusionOffer(offer);
    };
    Object.entries(newTrades).forEach(offerCollusion);
}

// ╭───────────────────────────────────────────────────────────╮
// │ Observe chat message packets                              │
// ╰───────────────────────────────────────────────────────────╯

ColonistObserver.sourceObserver.collude = function (packetData) {
    const player = this.state.nameMap[packetData.player];
    console.assert(this.state.playerUsername !== null);
    if (player !== this.state.playerUsername) {
        // Once our own messages can activate collusion
        console.debug("Only we may start a collusion");
        debugger; // TODO: verify this case once
        return;
    }
    const other = packetData.other;
    if (!Object.hasOwn(this.state.colourMap, other)) {
        // Source must not verify that the word is a player name, so do here
        console.debug("Cannot collude with non-player:", other);
        return;
    }
    this.collude({
        players: [player, other],
    });
};
