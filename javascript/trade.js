"use strict";

// Dependencies:
//  - Resources

/**
 * Catan trade object
 * @property {Player} giver
 * @property {Player | "bank"} taker
 * @property {Resources} resources
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
     * @type {Player | "bank"}
     */
    taker;

    /**
     * @param {Player} giver
     * @param {Resources} resources
     * @param {Player} taker
     */
    constructor({giver = null, resources = null, taker = null} = {}) {
        console.assert(giver && resources);
        console.assert(resources.hasPositiveAndNegative());
        this.giver = giver;
        this.resources = resources;
        this.taker = taker;
    }

    /**
     * Compare the resources between two trades
     * @param {Trade} other Another Trade instance to compare to
     * @return {boolean}
     * true if the resources of both trades are equal, else false.
     */
    equalResources(other) {
        console.assert(this.resources && other.resources);
        return this.resources.equals(other.resources);
    }

    /**
     * Compare two fully specified trades for equality
     * @param {Trade} other Another Trade instance to compare to
     * @return {boolean} true if the trades are equal, else false
     */
    equals(other) {
        // Currently we can only handle fully specified trades
        console.assert(this.giver && this.taker && this.resources);
        console.assert(other.giver && other.taker && other.resources);
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
     * Generate human readable string representing the trade
     * @param {Resources} [template] When provided, format with template
     * @param {boolean} [matches]
     * When provided, indicate the trade to match / not match the template
     * @return {string}
     */
    toString(template = null, matches = null) {
        let templateAppend = "";
        if (template !== null) {
            switch (matches) {
                case true: matches = "✅"; break;
                case false: matches = "🚫"; break;
                default: matches = "❓"; break;
            }
            templateAppend = ` ${matches} ${template.toSymbols(true)}`;
        }
        const ret = this.giver.name + " " + this.resources.toSymbols() +
                    templateAppend + " " + this.taker.name;
        return ret;
    }
}
