"use strict";

// Dependencies:
//  - TradeSet
//  - Player
//  - ConsoleLog

/**
 * Helper used by CollusionPlanner.
 *
 * When colluding, we want to stop suggesting trades ("going dormant") after the
 * user makes the first manual trade. At the end of the turn we continue
 * normally. CollusionTracker implements this behaviour.
 *
 * Keeps a flag, resetting after each turn.
 */
class CollusionTracker {

    /**
     * Flag indicating to not suggest any actions until next turn. Allows the
     * user to trade undisturbed. Set when one of observed trades from us was
     * not previously suggested as collusion trade. Cleared at the start of
     * every turn (because simple, necessary only after our own turns).
     */
    #isDormant = false;

    /**
     * Player that was turn when updateTurn() was called the last time (or null)
     * at the start). Used to reset the dormant state when changing turn.
     * @type {Player|null}
     */
    #lastTurnPlayer = null;

    /**
     * @type {ConsoleLog}
     */
    #logger = new ConsoleLog("CollusionTracker", "🚪");

    constructor() {
        // Empty
    }

    /**
     * Set dormant flag. We can use this when we see a trade not abiding
     * the collusion template.
     */
    goDormant() {
        if (!this.#isDormant) {
            this.#logger.log("Going dormant");
        }
        this.#isDormant = true;
    }

    /**
     * Query whether collusion should be dormant at the moment.
     * @return {boolean}
     */
    isDormant() {
        return this.#isDormant;
    }

    /**
     * Call on a turn observation. When the player is different from the last
     * time, we leave the dormant state.
     * @param {Player} player The player who's turn it is
     * @return {boolean} The dormant state after the update
     */
    updateTurn(player) {
        // If the player who's turn it is changed, that means a new turn started
        const startOfTheTurn = this.#lastTurnPlayer === null ?
            true : !this.#lastTurnPlayer.equals(player);
        this.#lastTurnPlayer = player;

        if (startOfTheTurn) {
            if (this.#isDormant) {
                this.#logger.log("No longer dormant");
            }
            this.#isDormant = false;
        }

        return this.isDormant();
    }

}
