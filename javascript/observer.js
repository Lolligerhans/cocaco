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
 * @property {string} type One of the documented observation types
 * @property {Payload} payload
 * A payload depending on the type of observation.
 *
 * @typedef { BuyPayload | CollusionStartPayload | CollusionStopPayload
 *            | CollusionAcceptancePayload | CollusionOfferPayload
 *            | DiscardPayload | GotPayload | MonoPayload | OfferPayload
 *            | RollPayload | StartPayload | StealPayload | TradePayload
 *            | TurnPayload | YopPayload } Payload
 */

/**
 * Observer base class. Specifies the possible observation types and provides
 * functions to emit them.
 */
class Observer extends Trigger {

    /**
     * @typedef {"road" | "settlement" | "city" | "devcard"} Buyable
     * An object players can buy in the game
     * @typedef {"main" | ""} Phase
     * A phase within the game.
     *  - main indicates the moment of action for collusion
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
    // │ Available observations                                │
    // ╰───────────────────────────────────────────────────────╯

    // The interface defines observation functions for game events. Ideally
    // these map to Source packets in a simple manner. Otherwise the Observer
    // must implement the logic to obtain the appropriate inputs.

    /**
     * A player buys/builds something
     * @typedef {Object} BuyPayload
     * @property {Player} player The player buying/building something
     * @property {Buyable} object The object being bought/built
     *
     * @param {BuyPayload} param0
     */
    buy({ player, object }) {
        let observation = {
            type: "buy",
            payload: {
                player: player,
                object: object,
            },
        };
        this.#observe(observation);
    }

    /**
     * The user starts a new collusion group
     * @typedef {Object} CollusionStartPayload
     * @property {Player} player
     * The player starting a collusion. Should always be us.
     * @property {Player[]} players
     * List of colluding players, including 'player'.
     *
     * @param {CollusionStartPayload} param0
     */
    collusionStart({ player, players }) {
        let observation = {
            type: "collusionStart",
            payload: {
                player: player,
                players: Observer.property.players(players),
            },
        };
        this.#observe(observation);
    }

    /**
     * The user stops colluding.
     * @typedef {Object} CollusionStopPayload
     * @property {Player} player
     * Player stopping colluding. Should always be us.
     *
     * @param {CollusionStopPayload} param0
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
     * Another player accepted our collusion offer. A collusion offer is
     * just a trade offer that we intend to evaluate with the CollusionPlanner.
     *
     * (!) The observation for tracking purposes is emitted separately.
     *
     * When multiple players accept, multiple observation are emitted.
     *
     * @typedef {Object} CollusionAcceptancePayload
     * @property {Player} player
     * Player who accepted the collusion trade offer
     * @property {Trade} trade The accepted trade
     * @property {function([Boolean])} accept
     * Function which, if called with 'true', finalises the collusion trade. If
     * 'false' is passed as argument, the acceptance is rejected. (Currently not
     * implemented!)
     *
     * @param {CollusionAcceptancePayload} param0
     */
    collusionAcceptance({ player, trade, accept }) {
        console.assert(typeof accept === "function");
        let observation = {
            type: "collusionAcceptance",
            payload: {
                player: player,
                trade: trade,
                accept: accept,
            },
        };
        this.#observe(observation);
    };

    /**
     * Another player created a collusion offer to be evaluated by the
     * CollusionPlanner.
     *
     * (!) The observation for tracking purposes is emitted separately.
     *
     * @typedef {Object} CollusionOfferPayload
     * @property {Player} player The player who created the trade offer
     * @property {Trade} trade
     * @property {function([Boolean])} accept
     * Function sending acceptance of the offer if called with 'true' as
     * argument. If called with 'false', sends a rejection.
     *
     * @param {CollusionOfferPayload} payload
     */
    collusionOffer(payload) {
        let observation = {
            type: "collusionOffer",
            payload: payload,
        };
        this.#observe(observation);
    }

    /**
     * A player discards resources due to a rolled 7. The observation for
     * rolling a 7 is emitted separately.
     * @typedef {Object} DiscardPayload
     * @property {Player} player Player discarding cards
     * @property {Resources} resources Discarded resources
     * @property {Number} [limit=7]
     * The discard limit implied by the discard action. Currently only the
     * default is used.
     *
     * @param {DiscardPayload} param0
     */
    discard({ player, resources, limit = 7 }) {
        console.assert(resources instanceof Resources);
        let observation = {
            type: "discard",
            payload: {
                player: player,
                resources: resources,
                limit: limit,
            },
        };
        this.#observe(observation);
    }

    /**
     * The embargo state is reset. Embargoes stop collusion activity.
     * @typedef {Object} EmbargoPayload
     * @property {[Player,Player][]} embargoes
     * Array of embargo pairs. The players in each embargo pair may not trade
     * with each other.
     *
     * @param {EmbargoPayload} embargoPayload
     */
    embargo(embargoPayload) {
        let observation = {
            type: "embargo",
            payload: {
                embargoes: embargoPayload,
            }
        };
        this.#observe(observation);
    }

    /**
     * A player got resources from rolling
     *
     * @typedef {Object} GotPayload
     * @property {Player} player Player who got resources
     * @property {Resources} resources Obtained resources
     *
     * @param {GotPayload} param0
     */
    got({ player, resources }) {
        console.assert(resources instanceof Resources);
        let observation = {
            type: "got",
            payload: {
                player: player,
                resources: resources,
            },
        };
        this.#observe(observation);
    }

    /**
     * A player plays a monopoly.
     * @typedef {Object} MonoPayload
     * @property {Player} player Player playing the monopoly
     * @property {string} resource Name of the stolen resource
     * @property {Resources} resources
     * Sum of resources stolen using the monopoly
     *
     * @param {MonoPayload} param0
     */
    mono({ player, resource, resources }) {
        console.assert(resources instanceof Resources);
        let observation = {
            type: "mono",
            payload: {
                player: player,
                resource: Observer.property.resource(resource),
                resources: resources,
            },
        };
        this.#observe(observation);
    }

    /**
     * A trade offer or trade counter offer is made.
     *
     * This observation is for tracking only. Collusion-related observations are
     * emitted separately.
     * @typedef {Object} OfferPayload
     * @property {Trade} offer
     * The role of giver and take is such that the giver's cards are revealed:
     * In a counter offer, the countering player is the giver.
     * This is different from collusion-related observations where it is always
     * the giver's turn.
     * @property {any[]} [targets=[]] Currently unused
     * @property {boolean} [isCounter=false] Currently unused
     *
     * @param {OfferPayload} param0
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
     * A player rolls a number. Used for dice stats.
     * @typedef {Object} RollPayload
     * @property {Player} player Rolling player
     * @property {Number} number Rolled number (2-12)
     *
     * @param {RollPayload} param0
     */
    roll({ player, number }) {
        console.assert(2 <= number && number <= 12);
        let observation = {
            type: "roll",
            payload: {
                player: player,
                number: number,
            },
        };
        this.#observe(observation);
    }

    /**
     * Start a game between the provided players. Start with 0 resources for
     * each player.
     *
     * (!) Must be the first observation, emitted only once.
     *
     * @typedef {Object} StartPayload
     * @property {Player} us The player belonging to the user
     * @property {Players} players The 'Players' object to be used
     *
     * @param {StartPayload} param0
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
                us: us,
                players: players,
            }
        };
        this.#observe(observation);
    }

    /**
     * One player steals resources from another player. Used for cards tracking
     * and rob stats.
     *
     * @typedef {Object} StealPayload
     * @property {Player} thief
     * @property {Player} victim
     * @property {string} [resource=null]
     * Name of stolen resource. If 'null', the steal is interpreted as uniform
     * random.
     *
     * @param {StealPayload} param0
     */
    steal({ thief = null, victim = null, resource = null }) {
        // Can leave out one of them, but not both.
        console.assert(thief || victim);
        let observation = {
            type: "steal",
            payload: {},
        };
        if (thief) {
            observation.payload.thief = thief;
        }
        if (victim) {
            observation.payload.victim = victim;
        }
        if (resource) {
            observation.payload.resource = Observer.property.resource(resource);
        }
        this.#observe(observation);
    }

    /**
     * A resource trade between players or with the bank. Used for both resource
     * tracking and collusion updates.
     * @typedef {Object} TradePayload
     * @property {Trade} trade
     *
     * @param {TradePayload} param0
     */
    trade(trade) {
        const observation = {
            type: "trade",
            payload: trade,
        };
        this.#observe(observation);
    }

    /**
     * Emitted on a specific phase of a turn. Used to identify moments of action
     * for collusion, and to reset stateful components.
     * @typedef {Object} TurnPayload
     * @property {Player} player Player who's turn it is
     * @property {Phase} phase Phase of the game
     *
     * @param {TurnPayload} param0
     */
    turn({ player, phase }) {
        const observation = {
            type: "turn",
            payload: {
                player: player,
                phase: phase,
            },
        };
        this.#observe(observation);
    }

    /**
     * A player uses a YOP.
     * @typedef {Object} YopPayload
     * @property {Player} player The player using the YOP
     * @property {Resources} resources The chosen resources
     *
     * @param {YopPayload} param0
     */
    yop({ player, resources }) {
        console.assert(resources instanceof Resources);
        console.assert(resources.sum() === 2);
        const observation = {
            type: "yop",
            payload: {
                player: player,
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
    return arg;
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
