"use strict";

// CollusionPlanner is the top level module implementing resource balancing
// between colluding players.
//
// Collusion planner implements some aspects, but mostly it wraps the set of
// classes implementing independent aspects.

// ── Interface ──────────────────────────────────────────────
//  - The colluding parties are provided by name
//  - Relevant updates are provided to CollusionPlanner by the user
//      - updateGotResources: A player got resources for rolling
//      - updateTradeResources: Two players traded resources
//      - updateTurn: Our turn ends
//  - At the appropriate time, the user obtains collusion suggestions with
//      - evalueAcccept: Decide on finalising our collusion offers which they
//                       accepted.
//      - evalueOffer: Decide on accepting their collusion offers
//      - evalueTurn: Generate our new collusion offers
//  - While stopped, these operations always return false or empty arrays [].
//
// Note: Collusion is the same as trading. In the context of automated trading
// we call it collusion to reduce ambiguity. Offering, accepting and finalising
// collusions refer to the respective actions on trades.

// ── Intended use ───────────────────────────────────────────
// The state observes opportunities to create trades, accept trades or finalise
// trades. The CollusionPlanner is then used to react according to its internal
// collusion state. All suggestions should be followed. Otherwise having the
// CollusionPlanner would be meaningless.
// The user handles generation of outgoing frames for the suggested trades.
// The user should organise its operation of CollusionPlanner. For example to
// make sure not to generate trades multiple times. While that is possible, the
// user will want to avoid sending trade offers multiple times.

// ── Dependencies ───────────────────────────────────────────
//  - 'Collusion' for generating collusion templates
//  - Basic operations
//      - 'Observer' property converter
//      - 'Resources'
//  - CollusionPlanner
//  - CollusionTracker
//  - EmbargoTracker

// ── Implementation ─────────────────────────────────────────
//  - The card counting is done by the instantiated 'Collude' class
//  - CollusionPlanner
//      - implements start/stop/dormant
//      - Filter for relevant trades
//      - adjusts templates based on context (suggest/offer/accept)

/**
 * Provides resources balancing between colluding players
 */
class CollusionPlanner {

    /**
     * Computes collusion templates.
     * @type {Collude}
     */
    #collude = null;

    /**
     * @type {CollusionTracker}
     */
    #collusionTracker;

    /**
     * @type {ConsoleLog}
     */
    #consoleLogger = new ConsoleLog("CollusionPlanner", "🪠");

    #embargoTracker = new EmbargoTracker();

    /**
     * The object corresponding to the user
     * @type {Player}
     */
    #us;

    /**
     * @type {MessageLog}
     */
    #logger;

    /**
     * For spectator mode, we allow 'us === null'. This may be unsuitable for
     * setting up the internals; 'start()' must never be called in this case.
     *
     * This implicitly ends up with NOPs because 'isStart()' will remain false.
     * The logic is simpler than checking everywhere in state.js.
     * @param {Player|null} us The object corresponding to the user, or 'null'.
     * @param {HTMLElement} outputElement Dom element to log into
     */
    constructor(us, outputElement) {
        this.#us = us;
        this.#collusionTracker = new CollusionTracker();
        this.#logger = new MessageLog(outputElement);
        this.#consoleLogger.log("Created for",
                                (us ?? {name: "<Spectating>"}.name));
    }

    /**
     * Evaluate whether an offered trade conforms to current collusion
     * obligations.
     * Always returns false when:
     *  - stopped
     *  - dormant
     *  - trade is by us
     *  - not all players are in the collusion group
     * The State is meant to present all trade offers, and react when true is
     * returned.
     * @param {Trade} trade
     * @return {boolean} true if we should accept, else false.
     */
    evaluateAccept(trade) {
        if (this.#isStoppedOrDormant()) {
            return false;
        }
        console.assert(trade.giver !== null);
        console.assert(trade.taker !== null);
        if (!this.#us.equals(trade.giver)) {
            this.#consoleLogger.log("Do not accept (not our offer)");
            return false;
        }
        if (this.#embargoTracker.isEmbargoed(trade.giver, trade.taker)) {
            // This probably cannot happen since one can not accept trades
            // during an embargo. We leave this here anyway, to be less
            // confusing. Any maybe catch some unexpected acceptances sneakign
            // through.
            this.#consoleLogger.log(
                `Do not accept (${trade.taker.name} embargoed)`);
            return false;
        }
        let newTemplate =
            this.#collude.getCollusionTemplate(trade.giver, trade.taker);
        if (newTemplate === null) {
            this.#consoleLogger.log("Do not accept (not colluder)");
            return false;
        }
        // Assume trade offers from others are always valid for giver and taker,
        // no need to adjustFor{TradeValidity,Giver,Taker}
        const matchesTemplate = this.tradeMatchesTemplate(newTemplate, trade);
        return matchesTemplate;
    }

    /**
     * Evaluate whether an existing trade should be accepted as collusion
     * @param {Trade}
     * @param guessAndRange Multiverse guess and range object
     * @return {boolean} true if we should accept, else false
     */
    evaluateOffer(trade, guessAndRange) {
        if (this.#isStoppedOrDormant()) {
            return false;
        }
        console.assert(trade.giver !== null);
        console.assert(trade.taker !== null);
        console.assert(!trade.giver.equals(this.#us));
        if (this.#embargoTracker.isEmbargoed(trade.giver, trade.taker)) {
            this.#consoleLogger.log(
                `Reject offer (${trade.giver.name} embargoed)`);
            return false;
        }
        // this.#consoleLogger.log("Evaluating", trade.give.from.name, "offer");
        let newTemplate =
            this.#collude.getCollusionTemplate(trade.giver, trade.taker);
        if (newTemplate === null) {
            this.#consoleLogger.log("Reject offer (not colluder)");
            return false;
        }
        // Assume existing trades are valid for giver
        Collude.adjustForTaker(newTemplate, trade.taker, guessAndRange);
        const matchesTemplate = this.tradeMatchesTemplate(newTemplate, trade);
        return matchesTemplate;
    }

    /**
     * Generate the trades we should make
     * @param guessAndRange Multiverse guess and range object
     * @return {Trade[]}
     */
    evaluateTurn(guessAndRange) {
        if (this.#isStoppedOrDormant()) {
            return [];
        }
        let trades = [];
        for (const player of this.#collude.players()) {
            if (player.equals(this.#us)) {
                continue;
            }
            if (this.#embargoTracker.isEmbargoed(this.#us, player)) {
                this.#consoleLogger.log(
                    `Skip generation (${player.name} embargoed)`);
                continue;
            }
            trades.push(this.#generateOurTrade(player, guessAndRange));
        }
        trades = trades.filter(trade => trade !== null);

        // We generate trades that any player can accept. So output each trade
        // only once.
        let set = new TradeResourcesSet();
        const hasUniqueResourceMovement = (trade) => {
            const keep = set.addTrade(trade);
            return keep;
        };
        trades = trades.filter(hasUniqueResourceMovement);

        if (trades.length === 0) {
            this.#consoleLogger.log("No collusion trades available");
        }
        return trades;
    }

    /**
     * Generate the trade we should offer to another player. This function does
     * not make any addition checks on whether we should suggest the trade
     * (dormant, active, embargoes, ...).
     * @param {Player} otherPlayer Other player to generate trades for
     * @param guessAndRange Multiverse guess and range object
     * @return {Trade|null} Suggested trade or 'null' to not suggest any trade
     */
    #generateOurTrade(otherPlayer, guessAndRange) {
        console.assert(!otherPlayer.equals(this.#us));
        let template =
            this.#collude.getCollusionTemplate(this.#us, otherPlayer);
        console.assert(template !== null, "If not colluding do not call this");
        const originalTemplate = new Resources(template);
        Collude.adjustForGiver(template, this.#us, guessAndRange);
        Collude.adjustForTaker(template, otherPlayer, guessAndRange);
        const isValid = Collude.adjustForTradeValidity(template);
        if (!isValid) {
            return null;
        }
        const trade = new Trade({
            giver: this.#us,
            taker: otherPlayer,
            resources: template,
        });
        this.#consoleLogger.log("Suggest",
                                trade.toString(originalTemplate, true))
        return trade;
    }

    /**
     * Test whether there is an active embargo preventing a given trade.
     * @param {Trade} trade
     * @return {boolean}
     */
    isEmbargoedTrade(trade) {
        return this.#embargoTracker.isEmbargoed(trade.giver, trade.taker);
    }

    /**
     * @return {boolean}
     */
    isStarted() {
        return !this.isStopped();
    }

    /**
     * Check if there is no active collusion. To whether to generate suggestions
     * on request, use isStoppedOrWaiting().
     * @return {boolean}
     */
    isStopped() {
        return this.#collude === null;
    }

    /**
     * Used to determine when the CollusionPlanner should veto generation of
     * trades/acceptances/finalisations towards the outside.
     * @return {boolean}
     */
    #isStoppedOrDormant() {
        return this.isStopped() || this.#collusionTracker.isDormant();
    }

    /**
     * Begin colluding as the provided group.
     * @param {Player[]} players
     * Collusion participants. Must include 'this.#us'.
     */
    start(players) {
        // Resets all state and start colluding.
        console.assert(players.length >= 2);
        console.assert(players.some(p => p.equals(this.#us)));
        const hint = `(chat "${cocaco_config.collude.phrases.stop}" to stop)`;
        this.#logger.log(
            // Joining with ", " results in the same format that we currently
            // use as trigger to activate collusion. Makes it easy to copy and
            // paste if needed.
            null, `Colluding: ${players.map(p => p.name).join(", ")} ${hint}`);
        if (this.#collude !== null) {
            this.#consoleLogger.log("Overwriting existing collusion group",
                                    p(this.#collude.playerNames()));
        }
        this.#collude = new Collude(players);
    }

    /**
     * Clear collusion state and stop colluding
     */
    stop() {
        if (this.isStopped())
            return;
        this.#logger.log(null, "Stop colluding");
        this.#consoleLogger.log("Stopping.", p(this.#collude.playerNames()));
        this.#collude = null;
    }

    /**
     * A trade matches the template if all transferred resources are in the
     * template range. The template range consists of any number between
     * 0 and the number present in the template for the same resource.
     *
     * We use the pending collusion deficit as template to incoming trade
     * offers. If the offer matches, the trade is accepted as colluding.
     *
     * Defined as member function to have access to this.#consoleLogger.
     *
     * @param {Resources} template Trade template. No special resources allowed.
     * @param {Trade} trade
     * @return {boolean}
     */
    tradeMatchesTemplate(template, trade) {
        const tradeResources = new Resources(trade.resources);
        console.assert(tradeResources.hasSpecial() === false);
        const intervalContainsValue =
            (interval, x) => { return interval[0] <= x && x <= interval[1]; };
        let templateCopy = new Resources(template);
        templateCopy.merge(tradeResources, (templateValue, tradeValue) => {
            const intervalEnds = [0, templateValue];
            const lo = Math.min(...intervalEnds);
            const hi = Math.max(...intervalEnds);
            const conformsToTemplate =
                intervalContainsValue([lo, hi], tradeValue);
            return conformsToTemplate ? 0 : 1;
        });
        const allConformToTemplate = templateCopy.countHamming() === 0;
        this.#consoleLogger.log(trade.toString(template, allConformToTemplate));
        return allConformToTemplate;
    }

    /**
     * Call this function when embargoes are updated. Collusion planner will not
     * suggest trade or accept actions towards embargoed or embargoing players.
     * @param {[Player,Player][]} embargoes
     */
    updateEmbargoes(embargoes) {
        this.#embargoTracker.setActiveEmbargoes(embargoes);
    }

    /**
     * Call when any player got resources.
     * Delegates to Collude.updateGotResources.
     */
    updateGotResources(...args) {
        if (this.isStopped()) {
            return;
        }
        this.#collude.updateGotResources(...args);
    }

    /**
     * Call when a trade is observed.
     * Delegates to Collude.updateTradeResources and update #collusionTracker.
     * @param {Trade} trade
     */
    updateTradeResources(trade) {
        // Here we do not use isStoppedOrDormant() because we need to update
        // this.#collude.
        if (this.isStopped()) {
            return;
        }

        if (trade.taker === "bank") {
            // Do not immediately trade away resources the player just traded
            // for with the bank.
            if (trade.giver.equals(this.#us)) {
                this.#collusionTracker.goDormant();
            }
            // Do not update #collude from bank trades
            return;
        }

        this.#consoleLogger.log(trade.toString());
        const goDormantIfNotMatchingTemplate = (trade) => {
            let template =
                this.#collude.getCollusionTemplate(trade.giver, trade.taker);
            console.assert(template !== null, "Sanity check");
            if (!this.tradeMatchesTemplate(template, trade)) {
                this.#collusionTracker.goDormant();
            }
        };
        const isFromUs = trade.giver.equals(this.#us);
        const playersAreColluding =
            this.#collude.hasColluders(trade.giver, trade.taker);
        // Go dormant when observing our trades that are not collusion abiding
        if (isFromUs && !playersAreColluding) {
            this.#collusionTracker.goDormant();
        } else if (isFromUs && playersAreColluding) {
            goDormantIfNotMatchingTemplate(trade);
        }
        // Update #collude last so we can use it for template generation above
        this.#collude.updateTradeResources(trade);
    }

    /**
     * Call on turn observations.
     * @param {Player} player
     * The player who's turn it is. Used to detect when a player's turn ends.
     */
    updateTurn(player) {
        // Do not check for isStopped() here. The #collusionTracker module
        // should leave the dormant state independent of the #collude module.
        // The only consequence is that we may remain dormant when stopping and
        // starting collusion in the same turn. But since collusion starts with
        // zero balances, this has little consequences. Even if we started with
        // nonzero balance, we would only have to wait a single turn to sync.
        this.#collusionTracker.updateTurn(player);
    }

    /**
     * Check if the taker has sufficient resources for the trade
     * @param {Trade} trade
     * @param {*} guessAndRange Multiverse guess and range object
     * @return {boolean}
     */
    static takerHasEnough(trade, guessAndRange) {
        const original = new Resources(trade.resources);
        let adjusted = new Resources(original);
        Collude.adjustForTaker(adjusted, trade.taker, guessAndRange);
        const takerHasEnough = original.equals(adjusted);
        return takerHasEnough;
    }
}
