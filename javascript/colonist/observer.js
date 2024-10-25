// Observer for WebSocket Source reproducing DOM log message parsing.

"use strict";

class ColonistObserver extends Observer {

    // TODO The Source should do this!
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

        // State object taking in our observations
        this.state = state;
        this.nextLogMessageIndex = 0;
        this.handledLogMessagesIndices = new Set();
        // Stateful components we use to interpret Source packets
        this.storage = {
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
        console.assert(!this.storage.playerUsername);
        this.storage.playerUsername = sourceData;
    }

    observePlayerUserStates(sourceData) {
        console.assert(!this.storage.playerUserStates);
        if (this.storage.playerUserStates) {
            // console.debug(sourceData, this.storage);
            // console.warn("ColonistObserver: Skipping duplicate playerUserStates");
            return;
        }
        this.storage.playerUserStates = sourceData.playerUserStates;
        this.storage.nameMap = {};
        for (const p of this.storage.playerUserStates) {
            this.storage.nameMap[p.selectedColor] = p.username;
        }
        this.storage.nameMapInverse = invertObject(
            this.storage.nameMap,
            x => Number.parseInt(x),
        );
        this.storage.playerIndex = this.storage.nameMapInverse[
            this.storage.playerUsername
        ];
        this.storage.colourMap = {};
        for (const p of this.storage.playerUserStates) {
            this.storage.colourMap[p.username]
                = ColonistObserver.getColour(p.selectedColor);
        }

        let allNames = sourceData.playOrder.map(i => this.storage.nameMap[i]);
        rotateToLastPosition(allNames, this.storage.playerUsername);

        this.start({
            us: {
                name: this.storage.playerUsername,
                index: this.storage.playerIndex,
            },
            players: allNames,
            colours: this.storage.colourMap,
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

ColonistObserver.sourceObserver.buyBuilding = function (packetData) {
    const name = this.storage.nameMap[packetData.player.index];
    const object = ColonistObserver.buildingMap[packetData.building.index];
    this.buy({
        player: { name: name },
        object: object,
    });
}


ColonistObserver.sourceObserver.buyDev = function (packetData) {
    const name = this.storage.nameMap[packetData.player.index];
    this.buy({
        player: { name: name },
        object: "devcard",
    });
}


ColonistObserver.sourceObserver.discard = function (packetData) {
    const name = this.storage.nameMap[packetData.player.index];
    const resources = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    this.discard({
        player: { name: name },
        resources: resources,
    });
}


ColonistObserver.sourceObserver.got = function (packetData) {
    const name = this.storage.nameMap[packetData.player];
    const res = packetData.cards.map(card => ColonistObserver.cardMap[card]);
    this.got({
        player: { name: name },
        resources: res,
    });
}


ColonistObserver.sourceObserver.mono = function (packetData) {
    const name = this.storage.nameMap[packetData.player.index];
    const res = packetData.cards.map(x => ColonistObserver.cardMap[x]);
    const resType = ColonistObserver.cardMap[packetData.card];
    this.mono({
        player: { name: name },
        resource: resType,
        resources: res,
    });
}


ColonistObserver.sourceObserver.roll = function (packetData) {
    const name = this.storage.nameMap[packetData.player.index];
    this.roll({
        player: { name: name },
        number: packetData.number,
    });
}


ColonistObserver.sourceObserver.stealAgainstThem = function (packetData) {
    const victim = this.storage.nameMap[packetData.player.index];
    const cards = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    console.assert(cards.length === 1, "Steal exactly one card");
    this.steal({
        thief: { name: this.storage.playerUsername },
        victim: { name: victim },
        resource: cards[0],
    });
}

ColonistObserver.sourceObserver.stealAgainstUs = function (packetData) {
    const thief = this.storage.nameMap[packetData.player.index];
    const cards = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    console.assert(cards.length === 1, "Steal exactly one card");
    this.steal({
        thief: { name: thief },
        victim: { name: this.storage.playerUsername },
        resource: cards[0],
    });
}


ColonistObserver.sourceObserver.stealRandom = function (packetData) {
    const thief = this.storage.nameMap[packetData.player.index];
    const victim = this.storage.nameMap[packetData.victim.index];
    console.assert(packetData.cards.length === 1 && packetData.cards[0] === 0,
        "Random steals should be unknown single cards");
    this.steal({
        thief: { name: thief },
        victim: { name: victim },
    });
}


ColonistObserver.sourceObserver.tradeBank = function (packetData) {
    const name = this.storage.nameMap[packetData.player.index];
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


ColonistObserver.sourceObserver.tradeCounter = function (packetData) {
    const name = this.storage.nameMap[packetData.player.index];
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


ColonistObserver.sourceObserver.tradeOffer = function (packetData) {
    const name = this.storage.nameMap[packetData.player.index];
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


ColonistObserver.sourceObserver.tradePlayer = function (packetData) {
    const name = this.storage.nameMap[packetData.player.index];
    const res = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    const name2 = this.storage.nameMap[packetData.target_player.index];
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


ColonistObserver.sourceObserver.yop = function (packetData) {
    const name = this.storage.nameMap[packetData.player.index];
    const cards = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    this.yop({
        player: { name: name },
        resources: cards,
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
            this.storage[k] = packetData[k];
        }
    };
    update("currentTurnPlayerColor");
    update("turnState");
    update("actionState");
    const playerName = this.storage.nameMap[this.storage.currentTurnPlayerColor];
    if (playerName !== this.storage.playerUsername) {
        // Legitimate in principle. We currently care only about our turns.
        return;
    }
    const turn = this.storage.turnState;
    const action = this.storage.actionState;
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
            this.storage.trade.testNewTurn();
        }
    }

    this.turn({
        player: { name: playerName },
        phase: phase,
    });
}

ColonistObserver.sourceObserver.tradeState = function (packetData, isUpdate) {
    // 'tradeState' tells us about the active offers. We use this to know when
    // to send offer accept and finalise frames. Every first time a trade
    // appears, generate a 'collusionOffer' observation. When we find accepted
    // trades by other players,

    // if (packetData.activeOffers && packetData.activeOffers.Dy79) {
    //     debugger; // FIXME: Bug
    // }
    let newTrades;
    if (isUpdate) {
        newTrades = this.storage.trade.update(packetData);
    } else {
        newTrades = this.storage.trade.reset(packetData);
    }
    console.debug(
        Object.keys(newTrades).length, "newTrades,",
        newTrades,
    );

    // rawCreatorNmae() returns what is present in the packetData. creatorName()
    // returns the player in who's POV the trade is (the player who's turn it
    // is). They differ in counter-trades.
    const rawCreatorName = trade => {
        return this.storage.nameMap[trade.creator];
    };
    const creatorName = trade => {
        // TODO: Alternatively, deduce from that player not having a response
        //       entry.
        const playerIndex = this.storage.trade.creatorOfTrade(trade);
        const ret = this.storage.nameMap[playerIndex];
        return ret;
    };

    // ── Collusion acceptance (maybe finalize) ──────────────────
    const suggestFinalisation = ([id, trade], acceptingPlayer) => {
        const singletonKey = id + "_" + acceptingPlayer;
        if (this.storage.finalisedTrades.has(singletonKey)) {
            console.debug(
                "Not finalising", singletonKey, "(finalised previously)",
            );
            return;
        }
        this.storage.finalisedTrades.add(singletonKey);
        console.debug("Finalising observation for ", singletonKey);
        let tradeProperty = {
            give: {
                from: { name: this.storage.playerUsername },
                to: { name: acceptingPlayer },
                resources: null,
            },
            take: {
                from: { name: acceptingPlayer },
                to: { name: this.storage.playerUsername },
                resources: null,
            },
        };
        if (acceptingPlayer == null) {
            debugger; // FIXME: Bug
        }
        Trade.fillResourcesFromFrame(tradeProperty, trade);
        const acceptingPlayerIndex = this.storage.nameMapInverse[acceptingPlayer];
        const offer = {
            player: { name: acceptingPlayer },
            trade: tradeProperty,
            accept: (doAccept = true) => {
                let tradeResponseFinalise;
                if (doAccept === true) {
                    tradeResponseFinalise = {
                        action: doAccept ? 51 : 55,
                        payload: {
                            tradeId: id,
                            playerToExecuteTradeWith: acceptingPlayerIndex,
                        },
                        sequence: -1, // Auto selected
                    }
                } else {
                    tradeResponseFinalise = {
                        action: 50,
                        payload: {
                            id: id,
                            response: 1,
                        },
                        sequence: -1, // Auto selected
                    }
                };
                console.debug(
                    "<finalize trade>", doAccept, trade,
                    "with", acceptingPlayer,
                );
                this.state.resend.sendMessage(
                    tradeResponseFinalise,
                );
            },
        };
        this.collusionAcceptance(offer);
    }; // suggestFinalisation()
    const acceptedTrades = this.storage.trade.getByResponse(1);
    Object.entries(acceptedTrades).forEach(([tradeId, trade]) => {
        console.debug(`Evaluating tradeId=${tradeId} finalisation`);
        if (creatorName(trade) !== this.storage.playerUsername) {
            console.debug("Not finalising: Not our trade");
            return;
        }
        const acceptingPlayers = Object.entries(trade.playerResponses).filter(
            ([_playerIndex, response]) => response === 1,
        ).map(
            ([playerIndex, _response]) => playerIndex,
        ).map(
            playerIndex => this.storage.nameMap[playerIndex],
        );
        for (const acceptingPlayer of acceptingPlayers) {
            suggestFinalisation([tradeId, trade], acceptingPlayer);
        }
    });

    // ── Observe their collusion offers (maybe accept trade) ────
    const offerCollusion = ([id, trade]) => {
        let tradeProperty = {
            give: {
                from: { name: creatorName(trade) },
                to: { name: this.storage.playerUsername }, // Pretend it is for us
                resources: null,
            },
            take: {
                from: { name: this.storage.playerUsername },
                to: { name: creatorName(trade) },
                resources: null,
            },
        };
        Trade.fillResourcesFromFrame(tradeProperty, trade);
        const offer = {
            player: { name: creatorName(trade) },
            trade: tradeProperty,
            accept: (doAccept = true) => {
                const tradeResponseAccept = {
                    action: 50,
                    payload: {
                        id: id,
                        response: doAccept ? 0 : 1,
                    },
                    sequence: -1, // Auto selected
                };
                console.debug(
                    "<accept trade>", trade,
                    "with", tradeResponseAccept
                );
                this.state.resend.sendMessage(
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
    let foundNewOffer = false;
    Object.entries(newTrades).forEach(([id, trade]) => {
        const tradeCreator = creatorName(trade);
        if (tradeCreator == null) {
            // This can happen when we start in the middle of a game and the
            // Trade module did not record a name. Should work in the subsequent
            // turn.
            console.warn("Unknown trade creator");
            console.info("Normal when starting in the middle of a game");
            return;
        }
        const rawTradeCreator = rawCreatorName(trade);
        const us = this.storage.playerUsername;
        console.debug(tradeCreator, rawTradeCreator, us);
        if (us === tradeCreator && us === rawTradeCreator) {
            console.debug("Ignoring our existing collusion offer", id)
            return;
        }
        if (us !== tradeCreator && us === rawTradeCreator) {
            console.debug("Ignoring our counter trade for collusion offer", trade);
            return;
        }
        foundNewOffer = true;
        offerCollusion([id, trade]);
    });
    if (!foundNewOffer) {
        console.debug("Nothin new to consider their collusion offers");
    }
}

// ╭───────────────────────────────────────────────────────────╮
// │ Observe chat message packets                              │
// ╰───────────────────────────────────────────────────────────╯

ColonistObserver.sourceObserver.collusionStart = function (packetData) {
    const player = this.storage.nameMap[packetData.player];
    console.assert(this.storage.playerUsername !== null);
    if (player !== this.storage.playerUsername) {
        // Once our own messages can activate collusion
        console.debug("Only we may start a collusion");
        debugger; // TEST: verify this case once
        return;
    }
    const others = packetData.others;
    const hasNonPlayerName = others.some(
        name => !Object.hasOwn(this.storage.nameMapInverse, name,)
    );
    if (hasNonPlayerName) {
        console.warn("Cannot collude with non-player(s) in", p(others));
        return;
    }
    if (others.length === 0) {
        console.warn("Missing collusion group");
        return;
    }
    console.debug("ColonistObserver: Start colluding with", others);
    this.collusionStart({
        player: { name: player },
        players: others,
    });
};

ColonistObserver.sourceObserver.collusionStop = function (packetData) {
    const player = this.storage.nameMap[packetData.player];
    console.assert(player === this.storage.playerUsername);
    this.collusionStop({
        player: { name: player },
    })
}
