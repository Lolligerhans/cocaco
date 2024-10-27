// Observer for WebSocket Source reproducing DOM log message parsing.

"use strict";

/**
 * Data class to store data needed by 'ColonistObserver' when handling later
 * source packets.
 */
class Storage {
    // ── Written once ───────────────────────────────────────────
    /**
     * Immutable set of players, initialized when generating the "start"
     * observation.
     * @type {Players}
     */
    players = null;

    /**
     * @type {Player}
     */
    us = null;

    playerUserStates = null;

    // ── Updated incrementally ──────────────────────────────────
    currentTurnPlayerColor = null; // TODO: Use player from .players instead
    turnState = null;;
    actionState = null;
    trade = new Trade();
    finalisedTrades = new Set();
}

/**
 * Observer for the Colonist pipeline (see: doc/pipelines.md)
 */
class ColonistObserver extends Observer {

    /**
     * Stateful components we use to interpret Source packets
     * @type {Storage}
     */
    newStorage = new Storage();

    // TODO: The Source should do this!
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

    static cardsToResources(cards) {
        const nameList = cards.map(r => ColonistObserver.cardMap[r]);
        const resources = Resources.fromList(nameList);
        return resources;
    }

    /**
     * Convert resources to the Colonist frame format: A list of indices
     * according to the cardMap.
     * @param {Resources} resources
     * @return {Number[]} Resources in frame format
     */
    static resourcesToCards(resources) {
        const nameList = resources.toList();
        const ret = nameList.map(name => ColonistObserver.cardMapInverse[name]);
        return ret;
    }

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

    /**
     * Fill 'resources' parts of the Observer 'trade' property by converting
     * values from 'frameTrade'.
     * @param trade Observer trade property 'trade', where all traders are
     *              already present. The 'resources' are added by this function.
     * @param frameTrade Trade in frame format. Currently same as Source format.
     *                   See: doc/colonist/message_format.md#activeOffers.
     */
    static fillResourcesFromFrame(trade, frameTrade) {
        const offer = ColonistObserver.cardsToResources(frameTrade.offeredResources);
        const demand = ColonistObserver.cardsToResources(frameTrade.wantedResources);
        trade.give.resources = offer;
        trade.take.resources = demand;
    }

    // Handler for each kind of source packet
    static sourceObserver = {};

    constructor(source, state) {
        super(state);

        // State object taking in our observations
        this.state = state;
        this.nextLogMessageIndex = 0;
        this.handledLogMessagesIndices = new Set();
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
        this.newStorage.playerUsername = sourceData;
    }

    observePlayerUserStates(sourceData) {
        console.assert(!this.storage.playerUserStates);
        console.assert(!this.newStorage.playerUserStates);

        this.newStorage.playerUserStates = sourceData.playerUserStates;
        const allPlayers = this.newStorage.playerUserStates.map(
            p => new Player({
                colour: ColonistObserver.getColour(p.selectedColor),
                id: p.selectedColor,
                index: null,
                name: p.username,
            })
        );
        this.newStorage.players = new Players(
            this.newStorage.playerUsername, // Use our name as last entry
            ...allPlayers,
        );
        this.newStorage.us = this.newStorage.players.name(
            this.newStorage.playerUsername,
        );

        this.start({
            us: this.newStorage.us,
            players: this.newStorage.players,
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
    const player = this.newStorage.players.id(packetData.player.index);
    const object = ColonistObserver.buildingMap[packetData.building.index];
    this.buy({
        player: player,
        object: object,
    });
}

ColonistObserver.sourceObserver.buyDev = function (packetData) {
    const player = this.newStorage.players.id(packetData.player.index);
    this.buy({
        player: player,
        object: "devcard",
    });
}

ColonistObserver.sourceObserver.discard = function (packetData) {
    const player = this.newStorage.players.id(packetData.player.index);
    const resources = ColonistObserver.cardsToResources(packetData.cards);
    this.discard({
        player: player,
        resources: resources,
    });
}

ColonistObserver.sourceObserver.got = function (packetData) {
    const player = this.newStorage.players.id(packetData.player);
    const resources = ColonistObserver.cardsToResources(packetData.cards);
    this.got({
        player: player,
        resources: resources,
    });
}

ColonistObserver.sourceObserver.mono = function (packetData) {
    const player = this.newStorage.players.id(packetData.player.index);
    const resType = ColonistObserver.cardMap[packetData.card];
    const resources = ColonistObserver.cardsToResources(packetData.cards);
    this.mono({
        player: player,
        resource: resType,
        resources: resources,
    });
}

ColonistObserver.sourceObserver.roll = function (packetData) {
    const player = this.newStorage.players.id(packetData.player.index);
    this.roll({
        player: player,
        number: packetData.number,
    });
}

ColonistObserver.sourceObserver.stealAgainstThem = function (packetData) {
    const victim = this.newStorage.players.id(packetData.player.index);
    const cards = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    console.assert(cards.length === 1, "Steal exactly one card");
    this.steal({
        thief: this.newStorage.us,
        victim: victim,
        resource: cards[0],
    });
}

ColonistObserver.sourceObserver.stealAgainstUs = function (packetData) {
    const thief = this.newStorage.players.id(packetData.player.index);
    const cards = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    console.assert(cards.length === 1, "Steal exactly one card");
    this.steal({
        thief: thief,
        victim: this.newStorage.us,
        resource: cards[0],
    });
}

ColonistObserver.sourceObserver.stealRandom = function (packetData) {
    const thief = this.newStorage.players.id(packetData.playerId);
    const victim = this.newStorage.players.id(packetData.victimId);
    console.assert(packetData.cards.length === 1 && packetData.cards[0] === 0,
        "Random steals should be unknown single cards");
    this.steal({
        thief: thief,
        victim: victim,
    });
}

ColonistObserver.sourceObserver.tradeBank = function (packetData) {
    const player = this.newStorage.players.id(packetData.player.index);
    const give = ColonistObserver.cardsToResources(packetData.give);
    const take = ColonistObserver.cardsToResources(packetData.take);
    this.trade({
        give: {
            from: player,
            to: "bank",
            resources: give,
        },
        take: {
            from: "bank",
            to: player,
            resources: take,
        },
    });
}

ColonistObserver.sourceObserver.tradeCounter = function (packetData) {
    const player = this.newStorage.players.id(packetData.player.index);
    const resources = ColonistObserver.cardsToResources(packetData.cards);
    const trade = {
        give: {
            from: player,
            resources: resources,
        },
        isCounter: true,
    };
    this.offer({
        offer: trade,
    });
}

ColonistObserver.sourceObserver.tradeOffer = function (packetData) {
    const player = this.newStorage.players.id(packetData.player.index);
    const resources = ColonistObserver.cardsToResources(packetData.cards);
    const trade = {
        give: {
            from: player,
            resources: resources,
        },
    };
    this.offer({
        offer: trade,
    });
}

ColonistObserver.sourceObserver.tradePlayer = function (packetData) {
    const resourcesFrom = ColonistObserver.cardsToResources(packetData.cards);
    const resourcesTo = ColonistObserver.cardsToResources(packetData.target_cards);
    const playerFrom = this.newStorage.players.id(packetData.player.index);
    const playerTo = this.newStorage.players.id(packetData.target_player.index);
    const trade = {
        give: {
            from: playerFrom,
            to: playerTo,
            resources: resourcesFrom,
        },
        take: {
            from: playerTo, // Swapped
            to: playerFrom, // Swapped
            resources: resourcesTo,
        },
    };
    this.trade(trade);
}

ColonistObserver.sourceObserver.yop = function (packetData) {
    const player = this.newStorage.players.id(packetData.player.index);
    const resources = ColonistObserver.cardsToResources(packetData.cards);
    this.yop({
        player: player,
        resources: resources,
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
            this.newStorage[k] = packetData[k];
        }
    };
    update("currentTurnPlayerColor");
    update("turnState");
    update("actionState");
    const playerWhosTurnItIs = this.newStorage.players.id(
        this.newStorage.currentTurnPlayerColor,
    );
    if (!this.newStorage.us.equals(playerWhosTurnItIs)) {
        // Legitimate in principle. We currently care only about our turns.
        return;
    }
    const turn = this.newStorage.turnState;
    const action = this.newStorage.actionState;
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
        player: playerWhosTurnItIs,
        phase: phase,
    });
}

ColonistObserver.sourceObserver.tradeState = function (packetData, isUpdate) {
    // 'tradeState' tells us about the active offers. We use this to know when
    // to send offer accept and finalise frames. Every first time a trade
    // appears, generate a 'collusionOffer' observation. When we find accepted
    // trades by other players,

    let newTrades;
    if (isUpdate) {
        newTrades = this.newStorage.trade.update(packetData);
    } else {
        newTrades = this.newStorage.trade.reset(packetData);
    }
    console.debug(
        Object.keys(newTrades).length, "newTrades,",
        newTrades,
    );

    /**
     * @return {Player} The player who is given as "creator" in the trade soruce
     *                  packet.
     */
    const rawCreatorName = trade => {
        return this.newStorage.players.id(trade.creator);
    };
    /**
     * Lookup the creator of a trade using the 'Trade' storage object. This does
     * some logic to ensure that we are not tricked when counter-trade-offers
     * have the counter-ing player as "creator" (which we do not mean). May fail
     * when we missed the frames containing the creator ID of the
     * responded-to-trade because we joined too later or started the extension
     * too late.
     * @param trade Trade in Source packet format.
     * @return {Player|null} The player from who's POV the trade is and who's
     *                       turn it is. Null if deduction failed.
     */
    const creatorPlayer = trade => {
        // TODO: Alternatively, deduce from that player not having a response
        //       entry. Or from turnState.
        const playerId = this.newStorage.trade.creatorOfTrade(trade);
        if (playerId == null) {
            return null;
        }
        const ret = this.newStorage.players.id(playerId);
        return ret;
    };

    // ── Collusion acceptance (maybe finalize) ──────────────────
    /**
     * Ensures that the observation is emitted for this trade-player pair. Does
     * nothing if the trade-player pairs was suggested before. The trade IDs are
     * assumed to be unique to each trade.
     * @param  tradeId The trade ID of 'trade'. Usually would be also given by
     *                 'trade.id'.
     * @param trade Trade in the source trade format.
     * @param {Player} acceptingPlayer The player that accepted the trade offer.
     *                                 Not verified any further.
     */
    const suggestFinalisation = ([tradeId, trade], acceptingPlayer) => {
        console.assert(acceptingPlayer != null);
        // Notify aobut finalisation opportunity at most once. The Source
        // packages can contain trades over and over.
        const singletonKey = tradeId + "_" + acceptingPlayer.name;
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
                from: this.newStorage.us,
                to: acceptingPlayer,
                resources: null,
            },
            take: {
                from: acceptingPlayer,
                to: this.newStorage.us,
                resources: null,
            },
        };
        ColonistObserver.fillResourcesFromFrame(tradeProperty, trade);
        const offer = {
            player: acceptingPlayer,
            trade: tradeProperty,
            accept: (doAccept = true) => {
                let tradeResponseFinalise;
                if (doAccept === true) {
                    tradeResponseFinalise = {
                        action: doAccept ? 51 : 55,
                        payload: {
                            tradeId: tradeId,
                            playerToExecuteTradeWith: acceptingPlayer.id,
                        },
                        sequence: -1, // Auto selected
                    }
                } else {
                    tradeResponseFinalise = {
                        action: 50,
                        payload: {
                            id: tradeId,
                            response: 1,
                        },
                        sequence: -1, // Auto selected
                    }
                };
                console.debug(
                    "<finalize trade>", doAccept, trade,
                    "with", acceptingPlayer.name,
                );
                this.state.resend.sendMessage(
                    tradeResponseFinalise,
                );
            },
        };
        this.collusionAcceptance(offer);
    }; // suggestFinalisation()
    const acceptedTrades = this.newStorage.trade.getByResponse(1);
    Object.entries(acceptedTrades).forEach(([tradeId, trade]) => {
        console.debug(`Evaluating tradeId=${tradeId} finalisation`);
        if (!creatorPlayer(trade).equals(this.newStorage.us)) {
            console.debug("Not finalising: Not our trade");
            return;
        }
        const acceptingPlayers = Object.entries(trade.playerResponses).filter(
            ([_playerId, response]) => response === 1,
        ).map(
            ([playerId, _response]) => playerId,
        ).map(
            playerId => this.newStorage.players.id(playerId)
        );
        for (const acceptingPlayer of acceptingPlayers) {
            suggestFinalisation([tradeId, trade], acceptingPlayer);
        }
    });

    // ── Observe their collusion offers (maybe accept trade) ────
    /**
     * Emit collusion offer observation for the given trade. No further checks.
     * @param id Trade if of 'trade'.
     * @param trade Trade to present in the observation, in Source format
     * @return {void}
     */
    const offerCollusion = ([id, trade]) => {
        const tradeCreator = creatorPlayer(trade);
        let tradeProperty = {
            give: {
                from: tradeCreator,
                to: this.newStorage.us, // Pretend it is for us
                resources: null,
            },
            take: {
                from: this.newStorage.us,
                to: tradeCreator,
                resources: null,
            },
        };
        ColonistObserver.fillResourcesFromFrame(tradeProperty, trade);
        const offer = {
            player: tradeCreator,
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
        const tradeCreator = creatorPlayer(trade);
        if (tradeCreator == null) {
            // This can happen when we start in the middle of a game and the
            // Trade module did not record a name. In this case we silently omit
            // the observation. Everything should work in the subsequent turn.
            console.warn("Unknown trade creator");
            console.info("Normal when starting in the middle of a game");
            return;
        }
        const rawTradeCreator = rawCreatorName(trade);
        const tradeIsOurRegularOffer =
            this.newStorage.us.equals(tradeCreator, rawTradeCreator,);
        if (tradeIsOurRegularOffer) {
            console.debug(
                "Ignoring our offer for collusionOffer observations",
                id,
            )
            return;
        }
        const tradeIsOurCounterOffer =
            this.newStorage.us.equals(rawTradeCreator) &&
            !this.newStorage.us.equals(tradeCreator);
        if (tradeIsOurCounterOffer) {
            console.debug(
                "Ignoring our counter for collusionOffer observations",
                trade,
            );
            return;
        }
        foundNewOffer = true;
        offerCollusion([id, trade]);
    });
    if (!foundNewOffer) {
        console.debug("Nothin new to consider for collusionOffer observations");
    }
}

// ╭───────────────────────────────────────────────────────────╮
// │ Observe chat message packets                              │
// ╰───────────────────────────────────────────────────────────╯

ColonistObserver.sourceObserver.collusionStart = function (packetData) {
    const player = this.newStorage.players.id(packetData.player);
    console.assert(this.newStorage.us !== null);
    if (!player.equals(this.newStorage.us)) {
        // Once our own messages can activate collusion
        console.debug("Only we may start a collusion");
        debugger; // TEST: verify this case once
        return;
    }
    if (packetData.others.length === 0) {
        console.warn("Missing collusion group");
        return;
    }
    const others = packetData.others.map(o => this.newStorage.players.name(o));
    const hasNonPlayerName = others.includes(null);
    if (hasNonPlayerName) {
        console.warn("Cannot collude with non-player(s) in", p(others));
        return;
    }
    console.debug("ColonistObserver: Start colluding with", others);
    this.collusionStart({
        player: player,
        players: others,
    });
};

ColonistObserver.sourceObserver.collusionStop = function (packetData) {
    const player = this.newStorage.players.name(packetData.player);
    console.assert(!player.equals(this.newStorage.us));
    this.collusionStop({
        player: player,
    });
}
