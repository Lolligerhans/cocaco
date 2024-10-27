"use strict";

// CollusionPlanner provides resources balancing between colluding players.

// ── Interface ──────────────────────────────────────────────
//  - The colluding parties are provided by name
//  - Relevant updates are provided to CollusionPlanner by the user
//      - updateGotResources: A player got resources for rolling
//      - updateTradeResources: Two players traded resources
//  - At the appropriate time, the user obtains collusion suggestions with
//      - evalueAcccept: Generate our new collusion offers
//      - evalueOffer: Decide on accepting their collusion offers
//      - evalueTurn: Decide on finalising our collusion offers which they
//                    accepted.
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

// ── Implementation ─────────────────────────────────────────
//  - The main algorithmic lifting is done by the instantiated 'Collude' class
//  - CollusionPlanner
//      - Implements start + stop
//      - Sanity checks names and other parameters
//      - Invokes the required 'Collude' and template operations based on the
//        context.
//      - Constructs the 'trade' objects in Observer property format.

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
     * The object corresponding to the user
     * @type {Player}
     */
    #us;

    /**
     * @type {MessageLog}
     */
    #logger;

    /**
     * @param {Player} us The object corresponding to the user
     * @param {HTMLElement} outputElement Dom element to log into
     */
    constructor(us, outputElement) {
        this.#us = us;
        this.#logger = new MessageLog(outputElement);
        console.debug("CollusionPlanner: Created for", us.name);
    }

    /**
     * @param trade Trade as observer property 'trade'
     * @return {boolean} true if we should accept, else false
     */
    evaluateAccept(trade) {
        if (!this.isStarted()) {
            return false;
        }
        console.assert(trade.give.from !== null);
        console.assert(trade.give.to !== null);
        if (!this.#us.equals(trade.give.from)) {
            console.debug("CollusionPlanner: Accept ignored (not our offer)");
            return false;
        }
        console.debug(
            "CollusionPlanner: Evaluating",
            trade.give.to.name, "acceptance",
        );
        let newTemplate = this.#collude.getCollusionTemplate(
            trade.give.from,
            trade.give.to.name,
        );
        if (newTemplate === null) {
            console.debug("CollusionPlanner: Accept ignored (not colluder)");
            return false;
        }
        // Assume existing trades are valid for giver and taker
        const matchesTemplate = Trade.tradeMatchesTemplate(newTemplate, trade);
        console.debug(
            "CollusionPlanner: Should",
            matchesTemplate ? "finalize" : "reject", "acceptance"
        );
        return matchesTemplate;
    }

    /**
     * @param trade Trade as observer property 'trade'
     * @param guessAndRange Multiverse guess and range object
     * @return {boolean} true if we should accept, else false
     */
    evaluateOffer(trade, guessAndRange) {
        if (!this.isStarted()) {
            return false;
        }
        console.assert(trade.give.from !== null);
        console.assert(trade.give.to !== null);
        if (!trade.give.from.equals(this.#us)) {
            console.debug("CollusionPlanner: Offer ignored (ours)");
            return false;
        }
        console.debug(
            "CollusionPlanner: Evaluating",
            trade.give.from.name, "offer",
        );
        let newTemplate = this.#collude.getCollusionTemplate(
            trade.give.from,
            trade.give.to,
        );
        if (newTemplate === null) {
            console.debug("CollusionPlanner: Offer ignored (not colluder)");
            return false;
        }
        // Assume existing trades are valid for giver
        Collude.adjustForTaker(newTemplate, trade.give.to, guessAndRange);
        const matchesTemplate = Trade.tradeMatchesTemplate(newTemplate, trade);
        console.debug(
            "CollusionPlanner: Should",
            matchesTemplate ? "accepted" : "rejected", "offer",
        );
        return matchesTemplate;
    }

    /**
     * Generate the trades we should make
     * @param guessAndRange Multiverse guess and range object
     * @return {[*]} Array of Objserver properties 'trades'
     */
    evaluateTurn(guessAndRange) {
        if (!this.isStarted()) {
            return [];
        }
        let trades = [];
        for (const player of this.#collude.players()) {
            if (player.equals(this.#us.name)) {
                continue;
            }
            trades.push(this.#generateOurTrade(player, guessAndRange));
        }
        return trades.filter(trade => trade !== null);
    }

    /**
     * Generate the trade we should offer to another player
     * @param {Player} otherPlayer Other player to generate trades for
     * @param guessAndRange Multiverse guess and range object
     * @return {*|null} Suggested trade as Observer property 'trade', or 'null'
     *                  if not suggesting a trade.
     */
    #generateOurTrade(otherPlayer, guessAndRange) {
        // console.debug("CollusionPlanner: Generating for", otherPlayer.name);
        let template = this.#collude.getCollusionTemplate(
            this.#us, otherPlayer,
        );
        console.assert(template !== null, "If not colluding do not call this");
        Collude.adjustForGiver(template, this.#us, guessAndRange);
        Collude.adjustForTaker(template, otherPlayer, guessAndRange);
        const isValid = Collude.adjustForTradeValidity(template);
        if (!isValid) {
            // console.debug("CollusionPlanner: No offer (no valid trade)");
            return null;
        }
        const give = new Resources(template);
        const take = new Resources(template);
        give.filter(x => x > 0);
        take.filter(x => x < 0);
        take.abs();
        const trade = Observer.property.trade({
            give: Observer.property.transfer({
                from: this.#us,
                to: otherPlayer,
                resources: give,
            }),
            take: Observer.property.transfer({
                from: otherPlayer,
                to: this.#us,
                resources: take,
            }),
        });
        console.debug("CollusionPlanner: Valid offer for", otherPlayer.name);
        return trade;
    }

    isStarted() {
        return this.#collude !== null;
    }

    /**
     * Begin colluding as the provided group.
     * @param {Player[]} players Collusion participants. Must include the 'us'
     *                           player used during construction.
     */
    start(players) {
        // Resets all state and start colluding.
        console.assert(players.length >= 2);
        console.assert(players.some(p => p.equals(this.#us)));
        console.debug("CollusionPlanner: Starting new group", p(players));
        this.#logger.log(null, `Colluding: ${players.map(p => p.name)}`);
        if (this.#collude !== null) {
            console.debug(
                "CollusionPlanner: Overwriting existing collusion group",
                p(this.#collude.playerNames()),
            );
        }
        this.#collude = new Collude(players);
    }

    /**
     * Clear collusion state and stop colluding
     */
    stop() {
        this.#logger.log(null, "Stop colluding")
        console.debug(
            "CollusionPlanner: Stopping.",
            p(this.#collude.playerNames()),
        );
        this.#collude = null;
    }

    /**
     * Delegates to Collude.updateGotResources
     */
    updateGotResources(...args) {
        if (this.#collude !== null) {
            console.debug("CollusionPlanner: Got resources", args[1].toSymbols());
            this.#collude.updateGotResources(...args);
        }
    }

    /**
     * Delegates to Collude.updateTradeResources
     */
    updateTradeResources(...args) {
        if (this.#collude !== null) {
            console.debug("CollusionPlanner: Trade resources", args[2].toSymbols());
            this.#collude.updateTradeResources(...args);
        }
    }

    /**
     * Check if the taker has sufficient resources for the trade
     * @param trade Trade as Observer property 'trade'. Will not be modified.
     * @param {*} guessAndRange Multiverse guess and range object
     * @return {boolean}
     */
    static takerHasEnough(trade, guessAndRange) {
        const original = Resources.fromObserverTrade(trade);
        let adjusted = new Resources(original);
        Collude.adjustForTaker(adjusted, trade.give.to, guessAndRange);
        const takerHasEnough = original.equals(adjusted);
        return takerHasEnough;
    }

}
