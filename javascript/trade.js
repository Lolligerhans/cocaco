"use strict";

// Dependencies:
//  - Resources

/**
 * Catan trade object
 */
class Trade {

    /**
     * Giving player. Positive entries of #resources are given by this player,
     * negative entries are taken.
     * @type {Player}
     */
    giver;

    /**
     * @type {Resources}
     */
    resources;

    /**
     * Taking player. Positive entries of #resources are taken by this player,
     * negative entries are given.
     * @type {Player}
     */
    taker;

    /**
     * @param {Player} giver
     * @param {Resources} resources
     * @param {Player} taker
     */
    constructor({ giver = null, resources = null, taker = null } = {}) {
        console.assert(giver && resources && taker);
        console.assert(resources.hasPositiveAndNegative());
        this.giver = giver;
        this.resources = resources;
        this.taker = taker;
    }

    /**
     * @param {Trade} other Another Trade instance to compare to
     * @return {boolean} true if the trades are equal, else false
     */
    equals(other) {
        if (!(other instanceof Trade)) {
            return false;
        }
        if (!this.giver.equals(other.giver)) {
            return false;
        }
        if (!this.taker.equals(other.taker)) {
            return false;
        }
        if (!this.resources.equals(other.resources)) {
            return false;
        }
        return true;
    }

    /**
     * Factory to construct new Trade object from Observer property 'trade'.
     * Once we phased out the observer property we can remove this function.
     * @param {*} trade Trade in Observer property 'trade' format
     * @return {Trade}
     * Newly constructed trade object. The new trade object re-uses the
     * references present in the observer property.
     */
    static fromObserverProperty(tradeProperty) {
        console.assert(
            tradeProperty.take.from.equals(tradeProperty.give.to),
            "sanity check",
        );
        console.assert(
            tradeProperty.take.to.equals(tradeProperty.give.from),
            "sanity check",
        );
        let resources = Resources.fromObserverTrade(tradeProperty);
        const ret = new Trade({
            giver: tradeProperty.give.from,
            taker: tradeProperty.give.to,
            resources: resources,
        });
        return ret;
    }

    /**
     * Generate human readable string representing the trade
     * @return {string}
     */
    toString() {
        const ret = this.giver.name + " " +
            this.resources.toSymbols() + " " +
            this.taker.name;
        return ret;
    }

}
