"use strict";

/**
 * Unique string identifying a trade
 * @typedef {string} TradeId
 */

/**
 * Keep track of the Colonist trade state by updating a tradeState object on new
 * frames. The trade state is mostly about trade offers. When a "trade" is
 * mentioned in this class, that refers to the description of offered trades as
 * represented in the Data frames.
 */
class ColonistTrade {
    /**
     * An object mirroring the tradeState constructed by the host
     * (doc/colonist/message_format.md).
     */
    #tradeState = {};

    /**
     * Store the creators (as colour enum) for each trade to later look them up
     * @type {Object.<TradeId, Number>}
     */
    #creators = {};

    /**
     * Trade IDs by the last update. These trades are assumed to potentially be
     * open for response. This way we do not respond more than once to each
     * trade.
     */
    #newTrades = new Set();

    /**
     * All trade IDs we have seen so far
     */
    #oldTrades = new Set();

    /**
     * @type {ConsoleLog}
     */
    #logger = new ConsoleLog("ColonistTrade", "💬");

    // Test if trade IDs repeat. If this doesnt fire once we test a game or two
    // remove it.
    testRepetition = new Set();

    // Used to filter 'tradeState' Source packets to keep only new, "active"
    // trades. This prevents responding to every Source packet containing
    // a 'tradeState', even if we responded earlier.

    /**
     * Remove entries with value 'null' from 'this.trades'. Trades will get that
     * value when they are no longer available. We stop tracking at that point,
     * except in '#oldTrades'.
     */
    #cleanup() {
        const filterTrades = trades => {
            const closedTrades = Object.keys(trades).filter(
                key => trades[key] == null,
            );
            closedTrades.forEach(key => delete trades[key]);
        };
        filterTrades(this.#tradeState.activeOffers ?? {});
        filterTrades(this.#tradeState.closedOffers ?? {});
    }

    /**
     * @return {Number} Number of entries in active offers
     */
    countActiveTrades() {
        let ret = Object.keys(this.#tradeState.activeOffers ?? {}).length;
        return ret;
    }

    /**
     * @return {Number} Number of entries in closed offers
     */
    countClosedTrades() {
        let ret = Object.keys(this.#tradeState.closedOffers ?? {}).length;
        return ret;
    }

    /**
     * @return {Number} Number of entries in the old trades set
     */
    countOldTrades() {
        let ret = this.#oldTrades.size;
        return ret;
    }

    constructor() {
        // Empty
    }

    /**
     * Get the true creator (giver) of the trade. The giver is different from
     * 'trade.creator' when the trade is a counter offer.
     * @param {Object} trade Trade in the frame format
     * @return {Number}
     */
    creatorOfTrade(trade) {
        const ret = this.creatorOfTradeId(trade.id);
        return ret;
    }

    /**
     * Get the true creator (giver) of the trade. The giver is different from
     * 'trade.creator' when the trade is a counter offer.
     * @param {TradeId} id
     * @return {Number}
     */
    creatorOfTradeId(id) {
        const ret = this.#creators[id];
        // If we join after some trades already existed, we may not know the
        // original creator, returning nullish.
        if (ret == null) {
            ColonistTrade.#printWarn("noCreatorLookup", id);
        }
        return ret;
    }

    /**
     * Generate the actual creator value we will use for this trade. This value
     * is different from 'trade.creator' when the trade is a counter offer. Our
     * actual creator reflects the player doing the "giving" in the trade (the
     * value trade.creator reflects the player who opened the trade in game,
     * i.e., the countering player in the case of counter offers).
     * @param {Objecte} trade Trade as represented in frames
     * @return {Number} Colour enum used to identify players in frames
     */
    #extractCreator(trade) {
        let ret = trade.creator;
        if (trade.counterOfferInResponseToTradeId != null) {
            ret = this.creatorOfTradeId(trade.counterOfferInResponseToTradeId);
        }
        if (ret == null) { ColonistTrade.#printWarn("noCreator"); }
        return ret;
    }

    /**
     * Return all trades currently active and responded to by any player with
     * the given response.
     * @param {number} [response=1] Response to filer by
     * @return {Object<string,*>} Mapping trade ID to trade
     */
    getByResponse(response = 1) {
        let ret = {};
        Object.entries(this.#tradeState.activeOffers).forEach(([id, trade]) => {
            if (Object.values(trade.playerResponses).includes(response)) {
                ret[id] = structuredClone(trade);
            }
        });
        return ret;
    }

    /**
     * Get trades added by the last call to 'update()'
     * @return {Object<string,Object>} @see TradeId -> trade
     */
    #getNewTrades() {
        let ret = {};
        this.#newTrades.forEach(key => {
            console.assert(
                Object.hasOwn(this.#tradeState.activeOffers, key),
                "Expecting to find trade in the tradeState",
            );
            ret[key] = this.#tradeState.activeOffers[key];
        });

        const verifyTrade = trade => {
            if (trade == null) {
                ColonistTrade.#printWarn("unknown", trade, this);
            }
            return trade != null;
        };
        filterObject(ret, verifyTrade);
        return ret;
    }

    /**
     * Replace current trade state
     * @param {Object} tradeState 'tradeState' object as given in Source packets
     * @return {Object<string,Object>}
     * Object of newly active offers as represented in source packets, see
     * '#getNewTrades()'.
     *
     */
    reset(tradeState) {
        this.#newTrades.clear();
        Object.keys(tradeState.activeOffers).forEach(
            key => this.#newTrades.add(key)
        );
        this.#tradeState = structuredClone(tradeState);
        this.#cleanup();
        return this.#getNewTrades();
    }

    static tradesHaveSameParticipants(trade1, trade2) {
        // Compute whether two trades have the same participants, in any order.
        // Assumes both trades have two distinct players each. And assumes that,
        // within a trade, transfers have the same traders. Assumes none of the
        // traders is the "bank".
        // @param trade1: Trade as observer property 'trade'
        // @param trade2: Trade in Source packet format
        // @return true or false
        debugger; // TEST: Does it work?
        const firstFound = trade1.give.from.name == trade2.give.from.name ||
            trade1.give.from.name == trade2.give.to.name;
        const secondFound = trade1.give.to.name == trade2.give.from.name ||
            trade1.take.to.name == trade2.give.to.name;
        return firstFound && secondFound;
    }

    static tradeHasTheseTraders(trade, t1, t2) {
        // @param trade: Observer property 'trade'
        // @param t1: Observer property 'trader'
        // @param t2: Observer property 'trader'
        // @return 'true' if trade is a trade between t1 and t2, else 'false'
        const hasFirst =
            t1.name === trade.give.from.name ||
            t1.name === trade.give.to.name;
        const hasSecond =
            t2.name === trade.give.from.name ||
            t2.name === trade.give.to.name;
        const res = hasFirst && hasSecond;
        if (!res) {
            debugger; // TEST: Does it work?
        }
        return hasFirst && hasSecond;
    }

    /**
     * Collect console warnings here to keep the remaining code shorter
     */
    static #printWarn(reason, ...args) {
        // Helper to collect lengthy prints statements
        switch (reason) {
            case "noCreator":
                debugger;
                console.warn("Trade without creator");
                console.info(
                    "This may happend when starting in the middle of a game",
                );
                break;
            case "noCreatorLookup":
                console.warn(
                    `Creator of trade ${args} not found.`,
                    "This may happen whenstarting the extension too late",
                );
                console.info(
                    "This may happend when starting in the middle of a game",
                );
                break;
            case "nullTrade":
                console.warn("Unexpected null trade");
                console.info(
                    "This may happend when starting in the middle of a game",
                );
                break;
            case "reusedTradeId":
                console.error(
                    "A trade ID from an earlier round was re-used:",
                    ...args,
                );
                break;
            case "testGeneration":
                console.error("Inconsistent creator", ...args);
                break;
            case "unknown":
                console.warn("Trade unknown", ...args);
                console.info(
                    "This may happen when starting in the middle of a game",
                );
                break;
            default:
                console.assert(false, "No known warning reason:", reason);
        }
    }

    // For testing. Remove later.
    testNewTurn() {
        // Call this at the start of each turn
        this.testRepetition.clear();
    }

    /**
     * Update the tradeState object from the given update object
     * @param {Object} tradeState
     * Update object for a 'tradeState' object as present in frames.
     * @return {Object<string,Object>}
     * Object of newly active offers as represented in source packets, see
     * '#getNewTrades()'.
     */
    update(tradeState) {
        this.#newTrades.clear();
        Object.entries(tradeState.activeOffers ?? {}).forEach(
            ([tradeId, trade]) => this.#updateTrade(tradeId, trade)
        );
        this.#tradeState = combineObject(this.#tradeState, tradeState);
        this.#cleanup();
        const newTrades = this.#getNewTrades();

        if (Object.values(newTrades).includes(undefined)) {
            // Bug when a trade is 'undefiend'?
            debugger; // FIXME: Bug?
        }

        this.#logger.log(
            `Trade: new=${Object.keys(newTrades).length},`,
            `active=${this.countActiveTrades()},`,
            `closed=${this.countClosedTrades()},`,
            `old=${this.countOldTrades()}`,
        );
        return newTrades;
    }

    /**
     * Update internal state for a new trade
     * @param {TradeId} tradeId
     * @param {*} trade Trade object in frame format
     */
    #updateTrade(tradeId, trade) {
        if (this.#oldTrades.has(tradeId)) {
            if (!this.testRepetition.has(tradeId)) {
                // We think trade IDs are unique, but this will fire if that
                // turns to be incorrect.
                ColonistTrade.#printWarn("reusedTradeId", tradeId, this);
            }
            return;
        }
        this.#oldTrades.add(tradeId);
        this.testRepetition.add(tradeId);
        this.#newTrades.add(tradeId);
        if (trade === null) {
            ColonistTrade.#printWarn("nullTrade");
            return;
        }
        let actualCreator = this.#extractCreator(trade);
        this.#creators[tradeId] = actualCreator;
    }

}
