// Observer for WebSocket Source reproducing DOM log message parsing.

"use strict";

/**
 * Data class to store stateful components needed by 'ColonistObserver' when
 * handling later source packets.
 */
class ColonistObserverStorage {
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

    playerUserStates = null; // I believe this stores the frame object

    // ── Updated incrementally ──────────────────────────────────

    currentTurnPlayerColor = null; // TODO: Use player from .players instead
    turnState = null;
    actionState = null;

    /**
     * @type {ColonistTrade}
     */
    trade = new ColonistTrade();
    finalisedTrades = new Set();
}

/**
 * Observer for the Colonist pipeline (see: doc/pipelines.md)
 */
class ColonistObserver extends Observer {

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

    static cardMapInverse =
        invertObject(ColonistObserver.cardMap, i => Number.parseInt(i));

    /**
     * Convert frame resources lists to Resources object
     * @param {Number[]} cards Array of Colonist card enum values
     * @return {Resources} New Object representing the same resources
     */
    static cardsToResources(cards) {
        console.assert(cards != null);
        const nameList = cards.map(r => ColonistObserver.cardMap[r]);
        const resources = Resources.fromList(nameList);
        return resources;
    }

    /**
     * Same as cardsToResources but subtract the second list
     * @param {Number[]} [addCards] Array of Colonist card enum values
     * @param {Number[]} [subtractCards] Array of Colonist card enum values
     * @return {Resources}
     * New Object representing the difference between the two
     */
    static cardsDiffToResources(addCards, subtractCards) {
        const addList = addCards.map(r => ColonistObserver.cardMap[r]);
        const subtractList =
            subtractCards.map(r => ColonistObserver.cardMap[r]);
        const resources = Resources.fromList(addList, subtractList);
        return resources;
    }

    /**
     * Convert resources to the Colonist frame format: An array of indices
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
     * Generate a resource object summarizing the resources moved by a frame
     * trade.
     * @param {*} frameTrade Trade in frame format (doc/colonist/message_format.md)
     * @return {Resources}
     * Resources corresponding to the difference offer - demand.
     */
    static getResourcesFromFrameTrade(frameTrade) {
        let offer =
            ColonistObserver.cardsToResources(frameTrade.offeredResources);
        const demand =
            ColonistObserver.cardsToResources(frameTrade.wantedResources);
        offer.subtract(demand);
        return offer;
    }

    /**
     * Handler for each kind of source packet
     * @type {Object.<string,function(*):void>}
     */
    static sourceObserver = {};

    /**
     * Set of all the indices of log messages that have been handled before.
     * Used to verify the order in which log messages arrive.
     * @type {Set.<Number>}
     */
    #handledLogMessagesIndices = new Set();

    /**
     * @type {Number}
     */
    #nextLogMessageIndex = 0;

    /**
     * @type {Resend}
     */
    resend;

    /**
     * @type {ColonistSource}
     */
    source;

    /**
     * @type {ColonistObserverStorage}
     */
    storage = new ColonistObserverStorage();

    /**
     * @param {ColonistSource} source Source instance generating input
     * @param {Resend} resend Resend instance handling output
     */
    constructor(source, resend) {
        super();
        this.resend = resend;

        this.source = source;
        this.source.onTrigger("playerUsername", packet => {
            console.assert(packet.type == "playerUsername");
            this.observePlayerUsername(packet.data);
            return true;
        });
        this.source.onTrigger("playerUserStates", packet => {
            console.assert(packet.type === "playerUserStates");
            this.observePlayerUserStates(packet.data)
            return false;
        });
        this.source.onTrigger("gameLogState", packet => {
            console.assert(packet.type === "gameLogState");
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

    /**
     * @return {boolean}
     * true if index is larger than all previously seen indices, else false
     */
    #isNewLogMessage(index) {
        if (index < this.#nextLogMessageIndex) {
            return false;
        }
        this.#nextLogMessageIndex = index + 1;
        return true;
    }

    // ╭───────────────────────────────────────────────────────╮
    // │ Dispatch source packet types                          │
    // ╰───────────────────────────────────────────────────────╯

    // These functions generate observation from source packets. Or delegate to
    // functions that do. They are based on the different 'packet.type'
    // ColonistSource emits.

    /**
     * Handle a playerUsername Source packet
     * @param {*} sourceData The data property of a source packet
     */
    observePlayerUsername(sourceData) {
        console.assert(!this.storage.playerUsername);
        this.storage.playerUsername = sourceData;
    }

    /**
     * Handle a playerUserStates Source packet
     * @param {*} sourceData The data property of a source packet
     */
    observePlayerUserStates(sourceData) {
        console.assert(!this.storage.playerUserStates);

        this.storage.playerUserStates = sourceData.playerUserStates;
        const allPlayers = this.storage.playerUserStates.map(
            p => new Player({
                colour: ColonistObserver.getColour(p.selectedColor),
                id: p.selectedColor,
                index: null,
                name: p.username,
            }));
        this.storage.players = new Players(
            this.storage.playerUsername, // Use our name as last entry
            allPlayers, sourceData.playOrder);
        this.storage.us =
            this.storage.players.name(this.storage.playerUsername);

        this.start({
            us: this.storage.us,
            players: this.storage.players,
        });
    }

    /**
     * Handle a gameLogState Source packet
     * @param {Number} index Log message index
     * @param {string} type Log message type, as converted by ColonistSource
     * @param {*} payload Payload object constructed by ColonistSource
     */
    observeLogMessage({index, type, payload}) {
        index = Number.parseInt(index); // Is a string in source
        // HACK: The Source obtains both "set state" and "state update" Data
        //       frames (See doc/colonist/message_format.md). We hope they are
        //       in the right order and simply reject any duplicates.
        const isNew = this.#isNewLogMessage(index);
        if (!isNew) {
            if (!this.#handledLogMessagesIndices.has(index)) {
                console.error("Out of order log messages (?)");
            }
            return;
        }
        this.#handledLogMessagesIndices.add(index);
        ColonistObserver.sourceObserver[type].call(this, payload);
    }

    /**
     * Handle a gameChatState Source packet
     * @param {Number} index Chat message index
     * @param {string} type Log message type, as converted by ColonistSource
     * @param {*} payload Payload object constructed by ColonistSource
     */
    observeChatMessage({index, type, payload}) {
        index = Number.parseInt(index);
        index; // Ignore
        ColonistObserver.sourceObserver[type].call(this, payload);
    }

    /**
     * Handle a gameState Source packet
     * @param {string} type Log message type, as converted by ColonistSource
     * @param {boolean} isUpdate
     * Differentiates between state update and state reset packets.
     * @param {*} payload Payload object constructed by ColonistSource
     */
    observeGameState({type, isUpdate, payload}) {
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

ColonistObserver.sourceObserver.buyBuilding = function(packetData) {
    const player = this.storage.players.id(packetData.player.index);
    const object = ColonistObserver.buildingMap[packetData.building.index];
    this.buy({
        player: player,
        object: object,
    });
};

ColonistObserver.sourceObserver.buyDev = function(packetData) {
    const player = this.storage.players.id(packetData.player.index);
    this.buy({
        player: player,
        object: "devcard",
    });
};

ColonistObserver.sourceObserver.discard = function(packetData) {
    const player = this.storage.players.id(packetData.player.index);
    const resources = ColonistObserver.cardsToResources(packetData.cards);
    this.discard({
        player: player,
        resources: resources,
    });
};

ColonistObserver.sourceObserver.got = function(packetData) {
    const player = this.storage.players.id(packetData.player);
    const resources = ColonistObserver.cardsToResources(packetData.cards);
    this.got({
        player: player,
        resources: resources,
    });
};

ColonistObserver.sourceObserver.mono = function(packetData) {
    const player = this.storage.players.id(packetData.player.index);
    const resType = ColonistObserver.cardMap[packetData.card];
    const resources = ColonistObserver.cardsToResources(packetData.cards);
    this.mono({
        player: player,
        resource: resType,
        resources: resources,
    });
};

ColonistObserver.sourceObserver.roll = function(packetData) {
    const player = this.storage.players.id(packetData.player.index);
    this.roll({
        player: player,
        number: packetData.number,
    });
};

ColonistObserver.sourceObserver.stealAgainstThem = function(packetData) {
    const victim = this.storage.players.id(packetData.player.index);
    const cards = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    console.assert(cards.length === 1, "Steal exactly one card");
    this.steal({
        thief: this.storage.us,
        victim: victim,
        resource: cards[0],
    });
};

ColonistObserver.sourceObserver.stealAgainstUs = function(packetData) {
    const thief = this.storage.players.id(packetData.player.index);
    const cards = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    console.assert(cards.length === 1, "Steal exactly one card");
    this.steal({
        thief: thief,
        victim: this.storage.us,
        resource: cards[0],
    });
};

ColonistObserver.sourceObserver.stealRandom = function(packetData) {
    const thief = this.storage.players.id(packetData.playerId);
    const victim = this.storage.players.id(packetData.victimId);
    console.assert(packetData.cards.length === 1 && packetData.cards[0] === 0,
                   "Random steals should be unknown single cards");
    this.steal({
        thief: thief,
        victim: victim,
    });
};

ColonistObserver.sourceObserver.tradeBank = function(packetData) {
    const player = this.storage.players.id(packetData.player.index);
    let res =
        ColonistObserver.cardsDiffToResources(packetData.give, packetData.take);
    const trade = new Trade({
        giver: player,
        taker: "bank",
        resources: res,
    });
    this.trade(trade);
};

ColonistObserver.sourceObserver.tradeCounter = function(packetData) {
    const player = this.storage.players.id(packetData.player.index);
    const original = this.storage.players.id(packetData.originalPlayerId);
    const res = ColonistObserver.cardsDiffToResources(packetData.cards,
                                                      packetData.cards_wanted);
    const trade = new Trade({
        // ❗ In collusion counter offers the role of giver and taker is the
        // other way around.
        giver: player,
        taker: original,
        resources: res,
    });
    this.offer({
        offer: trade,
        isCounter: true,
    });
};

ColonistObserver.sourceObserver.tradeOffer = function(packetData) {
    const player = this.storage.players.id(packetData.player.index);
    const res = ColonistObserver.cardsDiffToResources(packetData.cards,
                                                      packetData.cardsWanted);
    const trade = new Trade({
        giver: player,
        taker: null,
        resources: res,
    });
    this.offer({
        offer: trade,
    });
};

ColonistObserver.sourceObserver.tradePlayer = function(packetData) {
    const playerFrom = this.storage.players.id(packetData.player.index);
    const playerTo = this.storage.players.id(packetData.target_player.index);
    const res = ColonistObserver.cardsDiffToResources(packetData.cards,
                                                      packetData.target_cards);
    const trade = new Trade({
        giver: playerFrom,
        taker: playerTo,
        resources: res,
    });
    this.trade(trade);
};

ColonistObserver.sourceObserver.yop = function(packetData) {
    const player = this.storage.players.id(packetData.player.index);
    const resources = ColonistObserver.cardsToResources(packetData.cards);
    this.yop({
        player: player,
        resources: resources,
    });
};

// ╭───────────────────────────────────────────────────────────╮
// │ Observe gameState packets                                 │
// ╰───────────────────────────────────────────────────────────╯

ColonistObserver.sourceObserver.currentState = function(packetData, _isUpdate) {
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
    const playerWhosTurnItIs =
        this.storage.players.id(this.storage.currentTurnPlayerColor);
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
        player: playerWhosTurnItIs,
        phase: phase,
    });
};

ColonistObserver.sourceObserver.tradeState = function(packetData, isUpdate) {
    // 'tradeState' tells us about the active offers. We use this to know when
    // to send offer accept and finalise frames. Every first time a trade
    // appears, generate a 'collusionOffer' observation. When we find accepted
    // trades by other players,

    let newTrades, activeEmbargoes;
    if (isUpdate) {
        [newTrades, activeEmbargoes] = this.storage.trade.update(packetData);
    } else {
        [newTrades, activeEmbargoes] = this.storage.trade.reset(packetData);
    }

    // ── Embargoes ──────────────────────────────────────────────
    if (activeEmbargoes !== null) {
        /**
         * @param {Id[]} playerIdArray
         */
        const mapEmbargoPair = playerIdArray =>
            playerIdArray.map(id => this.storage.players.id(id));
        this.embargo(activeEmbargoes.map(mapEmbargoPair));
    }

    // ── Determine trade creator in both meanings ───────────────
    /**
     * @return {Player} The player who is given as "creator" in the trade soruce
     *                  packet.
     */
    const rawCreator = trade => {
        console.assert(trade != null);
        return this.storage.players.id(trade.creator);
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
        const playerId = this.storage.trade.creatorOfTrade(trade);
        if (playerId == null) {
            return null;
        }
        const ret = this.storage.players.id(playerId);
        return ret;
    };
    /**
     * Generate the list of accepting players
     * @param {Object} trade Trade in source packet format
     * @return {[Player]} Array of players that accepted.
     */
    const acceptingPlayersOf = trade => {
        const acceptingPlayers =
            Object.entries(trade.playerResponses)
                .filter(([_playerId, response]) => response === 1)
                .map(([playerId, _response]) => playerId)
                .map(playerId => this.storage.players.id(playerId));
        return acceptingPlayers;
    };

    const acceptedTrades = this.storage.trade.getByResponse(1);

    // ── Trade agreement (for resource tracking) ────────────────
    // For now we accept generating this observation every time they appear in
    // the frame/source data, without deduplication. With any luck there may not
    // be any duplication anyway.
    // NOTE: If this leads to problems it may be needed to change the reparser
    //       order in 'ColonistSource' to read gameState before gameLogState.
    Object.entries(acceptedTrades).forEach(([tradeId, trade]) => {
        // console.debug(`Evaluating agreement: tradeId=${tradeId}`, trade);
        const tradeResources =
            ColonistObserver.getResourcesFromFrameTrade(trade);
        // Check for null or undefined. Assume that missing values have the same
        // semantics as explicit 'null'.
        if (trade.counterOfferInResponseToTradeId != null) {
            // Counter offers have resoures from the perspective of the
            // countering player. Which trade was countered does not matter
            // here.
            tradeResources.negate();
        }
        const givingPlayer =
            this.storage.players.id(this.storage.currentTurnPlayerColor);
        let acceptingPlayers = acceptingPlayersOf(trade);
        {
            // When the player who's turn it is edits someone else's trade, the
            // player who's turn it is does not appear in the list of accepting
            // players. That is however fine, because that will already by
            // inferred from the trade creation itself. We need not duplicate
            // the inference from the implicit agreement. We do that for the
            // other players (where rawCreator === acceptor) to keep the code
            // simpler, but it would not be necessary either.

            // acceptingPlayers.concat(rawCreator(trade));
        }
        for (const acceptingPlayer of acceptingPlayers) {
            let tradeObject = new Trade({
                giver: givingPlayer,
                taker: acceptingPlayer,
                resources: tradeResources,
            });
            console.assert(
                !acceptingPlayer.equals(givingPlayer),
                `rawCreator ${givingPlayer.id} is also accepting as ${
                    acceptingPlayer.id}`);
            console.assert(tradeObject.giver !== null);
            console.assert(tradeObject.taker !== null);
            // Calls Observer.prototype.agree()
            this.agree({trade: tradeObject, player: acceptingPlayer});
        }
    });

    // ── Collusion acceptance (maybe finalise) ──────────────────
    /**
     * Ensures that the observation is emitted for this trade-player pair. Does
     * nothing if the trade-player pairs was suggested before. The trade IDs are
     * assumed to be unique to each trade.
     * @param  tradeId The trade ID of 'trade'. Usually would be also given by
     *                 'trade.id'.
     * @param {*} trade Trade in the source trade format.
     * @param {Player} acceptingPlayer The player that accepted the trade offer.
     *                                 Not verified any further.
     */
    const offerAcceptance = ([tradeId, trade], acceptingPlayer) => {
        console.assert(acceptingPlayer != null);
        // Notify aobut finalisation opportunity at most once. The Source
        // packages can contain trades over and over.
        const uniqueId = tradeId + "_" + acceptingPlayer.name;
        if (this.storage.finalisedTrades.has(uniqueId)) {
            return;
        }
        this.storage.finalisedTrades.add(uniqueId);
        let tradeObject = new Trade({
            giver: this.storage.us,
            taker: acceptingPlayer,
            resources: ColonistObserver.getResourcesFromFrameTrade(trade),
        });
        const offer = {
            player: acceptingPlayer,
            trade: tradeObject,
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
                this.resend.sendMessage(tradeResponseFinalise);
            },
        };
        this.collusionAcceptance(offer);
    }; // suggestFinalisation()
    Object.entries(acceptedTrades).forEach(([tradeId, trade]) => {
        // console.debug(`Evaluating tradeId=${tradeId} finalisation`);
        const creator = creatorPlayer(trade);
        if (creator === null) {
            console.error("unreachable");
            return; // Error
        }
        if (!creator.equals(this.storage.us)) {
            // console.debug("Not finalising: Not our trade");
            return;
        }
        const acceptingPlayers = acceptingPlayersOf(trade);
        {
            // TODO: Delete this regression check
            const acceptingPlayersOld =
                Object.entries(trade.playerResponses)
                    .filter(([_playerId, response]) => response === 1)
                    .map(([playerId, _response]) => playerId)
                    .map(playerId => this.storage.players.id(playerId));
            console.assert(JSON.stringify(acceptingPlayers) ===
                               JSON.stringify(acceptingPlayersOld),
                           "Delete this check when it does not regress. Old:",
                           acceptingPlayersOld, "new:", acceptingPlayers);
        }
        for (const acceptingPlayer of acceptingPlayers) {
            offerAcceptance([tradeId, trade], acceptingPlayer);
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
        let tradeObject = new Trade({
            giver: tradeCreator,
            taker: this.storage.us,
            resources: ColonistObserver.getResourcesFromFrameTrade(trade),
        });
        const offer = {
            player: tradeCreator,
            trade: tradeObject,
            accept: (doAccept = true) => {
                const tradeResponseAccept = {
                    action: 50,
                    payload: {
                        id: id,
                        response: doAccept ? 0 : 1,
                    },
                    sequence: -1, // Auto selected
                };
                this.resend.sendMessage(tradeResponseAccept);
            },
        };
        this.collusionOffer(offer);
    };
    let foundNewOffer = false;
    Object.entries(newTrades).forEach(([id, trade]) => {
        const tradeCreator = creatorPlayer(trade);
        if (tradeCreator == null) {
            // This can happen when we start in the middle of a game and the
            // Trade module did not record a name. In this case we silently omit
            // the observation. Everything should work in the subsequent turn.
            console.warn("Unknown trade creator.",
                         "Normal when starting in the middle of a game.");
            return;
        }
        const rawTradeCreator = rawCreator(trade);
        const tradeIsOurRegularOffer =
            this.storage.us !== null &&
            this.storage.us.equals(tradeCreator, rawTradeCreator);
        if (tradeIsOurRegularOffer) {
            // console.debug(
            //     "Ignoring our offer for collusionOffer observations",
            //     id,
            // );
            return;
        }
        const tradeIsOurCounterOffer =
            this.storage.us !== null &&
            this.storage.us.equals(rawTradeCreator) &&
            !this.storage.us.equals(tradeCreator);
        if (tradeIsOurCounterOffer) {
            // console.debug(
            //     "Ignoring our counter for collusionOffer observations",
            //     trade,
            // );
            return;
        }
        foundNewOffer = true;
        offerCollusion([id, trade]);
    });
    if (!foundNewOffer) {
        // console.debug(
        //     "No new offers to consider for collusionOffer observations",
        // );
    }
};

// ╭───────────────────────────────────────────────────────────╮
// │ Observe chat message packets                              │
// ╰───────────────────────────────────────────────────────────╯

ColonistObserver.sourceObserver.collusionStart = function(packetData) {
    const player = this.storage.players.id(packetData.player);
    console.assert(this.storage.us !== null);
    if (!player.equals(this.storage.us)) {
        // Once our own messages can activate collusion
        console.debug("Only we may start a collusion");
        debugger; // TEST: verify this case once
        return;
    }
    if (packetData.others.length === 0) {
        console.warn("Missing collusion group");
        return;
    }
    const others = packetData.others.map(o => this.storage.players.name(o));
    const hasNonPlayerName = others.some(p => p == null);
    if (hasNonPlayerName) {
        console.warn("Cannot collude with non-player(s) in",
                     p(packetData.others));
        return;
    }
    {
        // We currently get the collusion players by their names as strings. We
        // cannot disambiguate players when multiple players share the same
        // name. In that case, deny collusion with a warning.
        const names = this.storage.players.allNames();
        if (new Set(names).size !== names.length) {
            console.error(
                "Trying to collude but some participants have identical names. Ignoring.");
            debugger; // Give us chance to confirm what went wrong
            return;
        }
    }
    {
        // To sanity check user input, make sure the passed names are all unique
        const names = [player.name, ...others.map(p => p.name)];
        if (new Set(names).size !== names.length) {
            console.error(
                "Trying to collude but the provided players have duplicate names. Ignoring.");
            debugger; // Give us chance to confirm what went wrong
            return;
        }
    }
    // console.log("ColonistObserver: Start colluding with", others);
    this.collusionStart({
        player: player,
        players: others,
    });
};

ColonistObserver.sourceObserver.collusionStop = function(packetData) {
    const player = this.storage.players.id(packetData.player);
    console.assert(player.equals(this.storage.us));
    this.collusionStop({
        player: player,
    });
};
