"use strict";

/**
 * Stores active embargoes and answers queries about the embargo state between
 * two players.
 */
class EmbargoTracker {

    /**
     * Array of all active embargoes
     * @type {[Player,Player][]}
     */
    #embargoes = [];

    /**
     * @type {ConsoleLog}
     */
    #logger = new ConsoleLog("EmbargoTracker", "🚳");

    constructor() {
        // Empty
    }

    /**
     * Test whether one of the embargoes matches the given players (in any
     * order).
     * @return {boolean}
     */
    isEmbargoed(playerA, playerB) {
        // Do linear search over active embargoes
        const isTheSame = ([a, b]) => {
            return playerA.equals(a) && playerB.equals(b) ||
                playerA.equals(b) && playerB.equals(a);
        };
        const ret = this.#embargoes.some(isTheSame);
        return ret;
    }

    /**
     * From a list of embargoes, log each one that is not currently present in
     * this.#embargoes.
     * @param {[Player,Player][]} logEmbargoes List of embargoes
     * @param {string} text Text to show with each printed embargo
     */
    #logDeviatingEmbargoes(logEmbargoes, text) {
        for (const [p1, p2] of logEmbargoes) {
            if (!this.isEmbargoed(p1, p2)) {
                this.#logger.log(text, p1.name, p2.name);
            }
        }
    };

    /**
     * Reset all embargoes at once. Incremental changes are not possible.
     * @param {[Player,Player][]} embargoes
     */
    setActiveEmbargoes(embargoes) {
        this.#logDeviatingEmbargoes(embargoes, "Add embargo:");
        const oldEmbargoes = this.#embargoes;
        this.#embargoes = embargoes;
        this.#logDeviatingEmbargoes(oldEmbargoes, "Remove embargo:");
    }

}
