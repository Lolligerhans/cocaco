"use strict";

// Dependencies:
//  - Trade
//  - Resources

/**
 * Implements a set of Trade objects (similar to a JS Set).
 *
 * The CollusionTracker uses this to test whether any given trade was previously
 * suggested as collusion.
 *
 * Maintains an array of registered trades. Once trade is finalised that is not
 * registered, that must be the first user generated trade:
 *  - register all collusion suggestions (deduplicating)
 *  - deregister finalised trades
 *  - if a finalised trade is not registered as collusion suggestion, then it
 *    must be user generated
 */
class TradeSet {

    /**
     * Collusion offers that were registered and not yet deregistered.
     * @type {Trade[]}
     */
    #trades = [];

    /**
     * Register a trade. If the trade is already registered, nothing happens
     * @param {Trade} trade
     * @return {boolean}
     * true if the trade was newly registered, false if the trade already existed
     */
    addTrade(trade) {
        if (this.#hasTrade(trade)) {
            return false;
        }
        this.#trades.push(trade);
        return true;
    }

    /**
     * Resets to an empty state with no registered trades
     */
    clearTrades() {
        this.#trades.length = 0;
    }

    constructor() {
        // Empty
    }

    /**
     * Return index of first matching trade, or -1 if no matching trade
     * @param {Trade} trade
     * @return {Number}
     * Index of first matching trade, or -1 if no matching trade
     */
    #findTrade(trade) {
        const matches = t => t.equals(trade);
        const matchingIndex = this.#trades.findIndex(matches);
        return matchingIndex;
    }

    /**
     * Test whether a given trade is currently registered
     * @param {Trade} trade
     * @return {boolean}
     */
    #hasTrade(trade) {
        const matchingIndex = this.#findTrade(trade);
        return matchingIndex !== -1;
    }

    /**
     * Deregister a trade. If the trade is not registered, nothing happens.
     * @param {Trade} trade
     * @return {boolean}
     * true if the trade was deregistered, false if the trade was not registered
     * (nothing happened).
     */
    removeTrade(trade) {
        const matchingIndex = this.#findTrade(trade);
        if (matchingIndex === -1) {
            return false;
        }
        removeElementUnordered(this.#trades, matchingIndex);
        return true;
    }
}

/**
 * Implements a set of Trade objects (similar to a JS Set), but only identified
 * by their resources. The traders are ignored.
 *
 * The CollusionTracker uses this to test whether any given trade was previously
 * generated as suggestion (for another taker).
 */
class TradeResourcesSet {

    /**
     * Collusion offers that were registered and not yet deregistered.
     * @type {Trade[]}
     */
    #trades = [];

    /**
     * Register a trade. If the trade is already registered, nothing happens
     * @param {Trade} trade
     * @return {boolean}
     * true if the trade was newly registered, false if the trade already existed
     */
    addTrade(trade) {
        if (this.#hasTrade(trade)) {
            return false;
        }
        this.#trades.push(trade);
        return true;
    }

    /**
     * Resets to an empty state with no registered trades
     */
    clearTrades() {
        this.#trades.length = 0;
    }

    constructor() {
        // Empty
    }

    /**
     * Return index of first trade with matching resources, or -1 if no trade
     * with resources.
     * @param {Trade} trade
     * @return {Number}
     * Index of first matching trade, or -1 if no matching trade
     */
    #findTrade(trade) {
        const matches = t => t.equalResources(trade);
        const matchingIndex = this.#trades.findIndex(matches);
        return matchingIndex;
    }

    /**
     * Test whether a trade with these resources is currently registered
     * @param {Trade} trade
     * @return {boolean}
     */
    #hasTrade(trade) {
        const matchingIndex = this.#findTrade(trade);
        return matchingIndex !== -1;
    }

    /**
     * Deregister a trade. If the trade is not registered, nothing happens.
     * @param {Trade} trade
     * @return {boolean}
     * true if the trade was deregistered, false if the trade was not registered
     * (nothing happened).
     */
    removeTrade(trade) {
        const matchingIndex = this.#findTrade(trade);
        if (matchingIndex === -1) {
            return false;
        }
        removeElementUnordered(this.#trades, matchingIndex);
        return true;
    }
}
