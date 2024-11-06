// Common interface used by Observers

// Observer is an abstract base class. Observers should derive from 'Observer'
// and call the standard observation methods. Derived Observers should not
// activate the "observation" trigger directly.
//
// Using the interface defined here ensures that Observer implementations
// generate only the common set of observations that the State understands.

"use strict";

/**
 * @typedef {Object} Observation
 * @property {string} Observation.type One of the documented observation types
 * @property {Object} Observation.payload A payload depending on the type of
 *                                        observation.
 */

/**
 * Observer base class. Specifies the possible observation types and provides
 * functions to emit them.
 */
class Observer extends Trigger {

    /**
     * @typedef {"road" | "settlement" | "city" | "devcard"} Buyable
     * An object players can buy in the game
     * @typedef {"main" | ""} Phase A phase within the game
     */

    /**
     * @type {Buyable[]} List of available buyables
     */
    static buyables = ["road", "settlement", "city", "devcard"];
    static property = {};
    static phases = ["main", ""];

    /**
     * The trigger name activated on observations
     * @type {String}
     */
    static #triggerName = "observation";

    /**
     * @type {ConsoleLog}
     */
    #logger = new ConsoleLog("Observer", "👀");

    constructor() {
        super();
    }

    /**
     * Only the standard observations should invoke this
     * @param {Observation} observation
     */
    #observe(observation) {
        this.#logger.log(observation.type, observation);
        super.activateTrigger(Observer.#triggerName, observation);
    };

    // ╭───────────────────────────────────────────────────────╮
    // │ Standard observations                                 │
    // ╰───────────────────────────────────────────────────────╯

    // The interface defines observation functions for game events. Ideally
    // these map to Source packets in a simple manner. Otherwise the Observer
    // must implement the logic to obtain the appropriate inputs.

    /**
     * @param {Object} param0
     * @param {Player} param0.player The player buying something
     * @param {Buyable} param0.object The object bought
     */
    buy({ player, object }) {
        let observation = {
            type: "buy",
            payload: {
                player: Observer.property.player(player),
                object: Observer.property.buyable(object),
            },
        };
        this.#observe(observation);
    }

    /**
     * @param {Object} param0
     * @param {Player} param0.player The player starting a collusion. Should
     *                               currently always be us.
     * @param {Player[]} param0.players List of colluding players, including
     *                                  'player'.
     */
    collusionStart({ player, players }) {
        let observation = {
            type: "collusionStart",
            payload: {
                player: Observer.property.player(player),
                players: Observer.property.players(players),
            },
        };
        this.#observe(observation);
    }

    /**
     * @param {Object} param0
     * @param {Player} param0.player
     * Player stopping colluding. Currently that should always be us, but we
     * could react to other players exiting the collusion group.
     */
    collusionStop({ player }) {
        let observation = {
            type: "collusionStop",
            payload: {
                player: player,
            },
        };
        this.#observe(observation);
    }

    /**
     * Another player has accepted our collusion offer. A collusion offer is
     * just a trade offer that we intend to evaluate with the CollusinoPlanner.
     * @param {Object} param0
     * @param {Player} param0.player
     * Player who accepted the collusion trade offer
     * @param {Trade} param0.trade
     * @param {function([Boolean])} param0.accept
     * Function which, if called with 'true', finalises the collusion trade. If
     * 'false' is passed as argument, the acceptance is rejected. (Currently not
     * implemented!)
     */
    collusionAcceptance({ player, trade, accept }) {
        console.assert(typeof accept === "function");
        let observation = {
            type: "collusionAcceptance",
            payload: {
                player: Observer.property.player(player),
                trade: trade,
                accept: accept,
            },
        };
        this.#observe(observation);
    };

    /**
     * @param {Object} param0
     * @param {Player} param0.player The player who created the trade offer
     * @param {Trade} param0.trade
     * @param {function([Boolean])} param0.accept
     * Function sending acceptance of the offer if called with 'true' as
     * argument. If called with 'false', sends a rejection.
     */
    collusionOffer({ player, trade, accept }) {
        console.assert(typeof accept === "function");
        let observation = {
            type: "collusionOffer",
            payload: {
                player: Observer.property.player(player),
                trade: trade,
                accept: accept,
            },
        };
        this.#observe(observation);
    }

    /**
     * @param {Object} param0
     * @param {Player} param0.player Player discarding cards
     * @param {Resources} param0.resources Discarded resources
     * @param {Number} [param0.limit=7]
     * The discard limit implied by the discard action. Currently only the
     * default is used.
     */
    discard({ player, resources, limit = 7 }) {
        console.assert(resources instanceof Resources);
        let observation = {
            type: "discard",
            payload: {
                player: Observer.property.player(player),
                resources: resources,
                limit: limit,
            },
        };
        this.#observe(observation);
    }

    /**
     * A player got resources by an unspecified mechanism
     * @param {Object} param0
     * @param {Player} param0.player Player who got resources
     * @param {Resources} param0.resources Obtained resources
     */
    got({ player, resources }) {
        console.assert(resources instanceof Resources);
        let observation = {
            type: "got",
            payload: {
                player: Observer.property.player(player),
                resources: resources,
            },
        };
        this.#observe(observation);
    }

    /**
     * @param {Object} param0
     * @param {Player} param0.player Player playing the monopoly
     * @param {string} param0.resource Name of the stolen resource
     * @param {Resources} param0.resources
     * Total amount of resources stolen using the monopoly
     */
    mono({ player, resource, resources }) {
        console.assert(resources instanceof Resources);
        let observation = {
            type: "mono",
            payload: {
                player: Observer.property.player(player),
                resource: Observer.property.resource(resource),
                resources: resources,
            },
        };
        this.#observe(observation);
    }

    /**
     * A trade offer or trade counter offer is made.
     * @param {Object} param0
     * @param {Trade} param0.offer
     * The role of giver and take is such that the giver's cards are revealed.
     * In a counter offer, the countering player is the giver.
     *
     * This is different from collusion related observations where it is always
     * the giver's turn.
     * @param {any[]} [param0.targets=[]] Currently unused
     * @param {boolean} [param0.isCounter=false] Currently unused
     */
    offer({ offer, targets = [], isCounter = false }) {
        console.assert(offer.giver !== null);
        // taker may be null for trade offers since there is no dedicated taker
        console.assert(offer.resources !== null);
        let observation = {
            type: "offer",
            payload: {
                offer: offer,
                targets: Observer.property.players(targets),
                isCounter: isCounter,
            },
        };
        this.#observe(observation);
    }

    /**
     * @param {Object} param0
     * @param {Player} param0.player Rolling player
     * @param {Number} param0.number Rolled number (2-12)
     */
    roll({ player, number }) {
        console.assert(2 <= number && number <= 12);
        let observation = {
            type: "roll",
            payload: {
                player: Observer.property.player(player),
                number: number,
            },
        };
        this.#observe(observation);
    }

    /**
     * Start a game between the provided players.
     * @param {Object} param0
     * @param {Player} param0.us
     * @param {Players} param0.players The 'Players' object to be used
     */
    start({ us, players }) {
        console.assert(players.size() === 4,
            "Can remove this check when more players are intended");
        console.assert(players.name(us.name) !== null,
            "We should participate in the game");
        console.assert(players instanceof Players);
        let observation = {
            type: "start",
            payload: {
                us: Observer.property.player(us),
                players: players,
            }
        };
        this.#observe(observation);
    }

    /**
     * One player steals resources from another player
     * @param {Object} param0
     * @param {Player} thief
     * @param {Player} victim
     * @param {string} [param0.resource=null]
     * Name of stolen resource. If 'null', the steal is interpreted as unknown.
     */
    steal({ thief = null, victim = null, resource = null }) {
        // Can leave out one of them, but not both.
        console.assert(thief || victim);
        let observation = {
            type: "steal",
            payload: {},
        };
        if (thief) {
            observation.payload.thief = Observer.property.player(thief);
        }
        if (victim) {
            observation.payload.victim = Observer.property.player(victim);
        }
        if (resource) {
            observation.payload.resource = Observer.property.resource(resource);
        }
        this.#observe(observation);
    }

    /**
     * @param {Trade} trade
     */
    trade(trade) {
        const observation = {
            type: "trade",
            payload: trade,
        };
        this.#observe(observation);
    }

    /**
     * Currently only emitter when it is our turn in the main phase
     * @param {Object} param0
     * @param {Player} param0.player Player who's turn it is
     * @param {Phase} param0.phase Phase of the game
     */
    turn({ player, phase }) {
        const observation = {
            type: "turn",
            payload: {
                player: Observer.property.player(player),
                phase: Observer.property.phase(phase),
            },
        };
        this.#observe(observation);
    }

    /**
     * @param {Object} param0
     * @param {Player} param0.player The player using the YOP
     * @param {Resources} param0.resources The chosen resources
     */
    yop({ player, resources }) {
        console.assert(resources instanceof Resources);
        console.assert(resources.sum() === 2);
        const observation = {
            type: "yop",
            payload: {
                player: Observer.property.player(player),
                resources: resources,
            },
        };
        this.#observe(observation);
    }

};

// ╭───────────────────────────────────────────────────────────╮
// │ Standard properties                                       │
// ╰───────────────────────────────────────────────────────────╯

// These builders make it convenient to construct valid standard properties.
// They are not meant to verify them thoroughly.

Observer.property.player = function (player) {
    console.assert(player instanceof Player);
    return player;
}

Observer.property.players = function (players) {
    console.assert(players.every(x => x instanceof Player));
    return players;
}

Observer.property.trader = function (arg) {
    if (arg === null) {
        return null;
    }
    if (typeof arg === "string") {
        console.assert(arg === "bank");
        return arg;
    }
    return Observer.property.player(arg);
}

Observer.property.resource = function (arg) {
    console.assert(Resources.names().includes(arg));
    return arg;
}

Observer.property.transfer = function ({
    from = null,
    to = null,
    resources = new Resources(),
}) {
    console.assert(resources instanceof Resources);
    const transfer = {
        from: Observer.property.trader(from),
        to: Observer.property.trader(to),
        resources: resources,
    }
    // Sanity check: transfer between different players (allow both null)
    console.assert(transfer.from !== transfer.to || transfer.from === null);
    return transfer;
}

Observer.property.trade = function ({ give = null, take = null }) {
    const trade = {
        give: Observer.property.transfer(give ?? {}),
        take: Observer.property.transfer(take ?? {}),
    };
    return trade;
}

Observer.property.buyable = function (arg) {
    console.assert(Observer.buyables.includes(arg));
    return arg;
}

Observer.property.phase = function (arg) {
    console.assert(Observer.phases.includes(arg));
    return arg;
}
