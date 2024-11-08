"use strict";

// Dependencies:
//  - TradeSet
//  - Player
//  - ConsoleLog

/**
 * Helper used by CollusionPlanner.
 *
 * When colluding, we want to stop suggesting trades ("going dormant") after the
 * user makes the first manual trade. CollusionTracker implements this
 * behaviour.
 *
 * Maintains a set of suggested trades (TradeSet). Once trade is finalised that
 * is not in the set, that must be the first user generated trade. If
 * a suggested trade is executed, we remove the trade from the set.
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

    /**
     * Set of previously suggested (but not executed) trades.
     * @type {TradeSet}
     */
    #tradeTracker = new TradeSet();

    /**
     * The us player used to filter for our trades only
     * @type {Player}
     */
    #us;

    /**
     * @param {Player} us The us player whos collusion suggestions are tracked
     */
    constructor(us) {
        this.#us = us;
        this.#logger.log("Tracking suggestions for", this.#us.name);
    }

    /**
     * Set dormant flag manually. We can use this when we trade with
     * a not-colluding player.
     */
    goDormant() {
        if (!this.#isDormant) {
            this.#logger.log("Going dormant manually");
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
     * Simple helper
     * @param {Trade} trade Test if this is a trade by us
     * @return {boolean}
     */
    #isTradeByUs(trade) {
        const ret = trade.giver.equals(this.#us);
        return ret;
    }

    /**
     * Update for a new suggestion.
     * Call this function on every trade suggested by the CollusionPlanner. The
     * suggestions are stored in a set to notice when a trade had not been
     * previously suggested.
     * @param {Trade} trade The trade suggested by the CollusionPlanner
     */
    updateSuggestion(trade) {
        if (!this.#isTradeByUs(trade)) {
            // Only interested in suggestions by us
            console.assert(false, "currently not expected behaviour");
            return;
        }
        this.#tradeTracker.addTrade(trade);
    }

    /**
     * Update for a new collusion-related trade.
     * If the trade is not by us this function does nothing. If the trade is by
     * us:
     *  - remove the stored suggestion matching this trade
     *  - if there is no stored suggestion, enter the dormant state (= set
     *    a flag for the rest of the turn)
     * @param {Trade} trade
     * A collusion-related trade that was executed in game. Collusion-related
     * trades are trades where both participants are part of the collusion
     * group. The CollusionTracker does not verify the collusion group.
     *
     * TODO: This is currently no longer used, but we may want to use the
     *       associated code later, to deduplicate collusion offers. So keep it
     *       here for now.
     */
    updateTrade(trade) {
        if (!this.#isTradeByUs(trade)) {
            // We are only interested in our trades
            return;
        }
        const wasSuggested = this.#tradeTracker.removeTrade(trade);
        if (wasSuggested) {
            return;
        }
        if (!this.#isDormant) {
            this.#logger.log("Going dormant because", trade.toString());
        }
        this.#isDormant = true;
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
            this.#tradeTracker.clearTrades();
            if (this.#isDormant) {
                this.#logger.log("No longer dormant");
            }
            this.#isDormant = false;
        }

        return this.isDormant();
    }

}
