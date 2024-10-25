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

class CollusionPlanner {

    #collude = null;
    #playerName;
    #logger;

    constructor(playerName, outputElement) {
        // @param playerName: Our name.
        this.#playerName = playerName;
        this.#logger = new MessageLog(outputElement);
        console.debug("CollusionPlanner: Created for", playerName);
    }

    evaluateAccept(trade) {
        // @param trade: Trade as observer property 'trade'
        // @return true if we should accept, else false
        if (!this.isStarted()) {
            return false;
        }
        console.assert(trade.give.from !== null);
        console.assert(trade.give.to !== null);
        if (trade.give.from.name !== this.#playerName) {
            console.debug("CollusionPlanner: Accept ignored (not our offer)");
            return false;
        }
        console.debug(
            "CollusionPlanner: Evaluating",
            trade.give.to.name, "acceptance",
        );
        let newTemplate = this.#collude.getCollusionTemplate(
            trade.give.from.name,
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

    evaluateOffer(trade, guessAndRange) {
        // @param trade: Trade as observer property 'trade'
        // @param guessAndRange: Multiverse guess and range object
        // @return true if we should accept, else false
        if (!this.isStarted()) {
            return false;
        }
        console.assert(trade.give.from !== null);
        console.assert(trade.give.to !== null);
        if (trade.give.from.name === this.#playerName) {
            console.debug("CollusionPlanner: Offer ignored (ours)");
            return false;
        }
        console.debug(
            "CollusionPlanner: Evaluating",
            trade.give.from.name, "offer",
        );
        let newTemplate = this.#collude.getCollusionTemplate(
            trade.give.from.name,
            trade.give.to.name,
        );
        if (newTemplate === null) {
            console.debug("CollusionPlanner: Offer ignored (not colluder)");
            return false;
        }
        // Assume existing trades are valid for giver
        Collude.adjustForTaker(newTemplate, trade.give.to.name, guessAndRange);
        const matchesTemplate = Trade.tradeMatchesTemplate(newTemplate, trade);
        console.debug(
            "CollusionPlanner: Should",
            matchesTemplate ? "accepted" : "rejected", "offer",
        );
        return matchesTemplate;
    }

    evaluateTurn(guessAndRange) {
        // Generate the trades we should make
        // @param Multiverse guessAndRange
        // @return Array of trades
        if (!this.isStarted()) {
            return [];
        }
        let trades = [];
        for (const name of this.#collude.players()) {
            if (name === this.#playerName) {
                continue;
            }
            trades.push(this.#generateOurTrade(name, guessAndRange));
        }
        return trades.filter(trade => trade !== null);
    }

    #generateOurTrade(otherName, guessAndRange) {
        // Generate the trade we should offer to another player
        // @param otherName: Name of player to generate trades for
        // @param guessAndRange: Multiverse guess and range object
        // @return Suggested trade as Observer property 'trade' or 'null'.
        // console.debug("CollusionPlanner: Generating for", otherName);
        let template = this.#collude.getCollusionTemplate(
            this.#playerName, otherName,
        );
        Collude.adjustForGiver(template, this.#playerName, guessAndRange);
        Collude.adjustForTaker(template, otherName, guessAndRange);
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
        const giveList = give.toList();
        const takeList = take.toList();
        const trade = Observer.property.trade({
            give: Observer.property.transfer({
                from: { name: this.#playerName },
                to: { name: otherName },
                resources: giveList,
            }),
            take: Observer.property.transfer({
                from: { name: otherName },
                to: { name: this.#playerName },
                resources: takeList,
            }),
        });
        console.debug("CollusionPlanner: Valid offer for", otherName);
        return trade;
    }

    isStarted() {
        return this.#collude !== null;
    }

    start(players) {
        // Resets all state and start colluding.
        console.assert(players.length >= 2);
        console.assert(players.includes(this.#playerName));
        console.debug("CollusionPlanner: Starting new group", p(players));
        this.#logger.log(null, `Colluding: ${players}`);
        if (this.#collude !== null) {
            console.debug(
                "CollusionPlanner: Overwriting existing collusion group",
                p(this.#collude.players()),
            );
        }
        this.#collude = new Collude(players);
    }

    stop() {
        // Resets all collusion state and stop colluding immediately.
        this.#logger.log(null, "Stop colluding")
        console.debug(
            "CollusionPlanner: Stopping.",
            p(this.#collude.players),
        );
        this.#collude = null;
    }

    updateGotResources(...args) {
        if (this.#collude !== null) {
            console.debug("CollusionPlanner: Got resources", args[1].toSymbols());
            this.#collude.updateGotResources(...args);
        }
    }

    updateTradeResources(...args) {
        if (this.#collude !== null) {
            console.debug("CollusionPlanner: Trade resources", args[2].toSymbols());
            this.#collude.updateTradeResources(...args);
        }
    }

    static takerHasEnough(trade, guessAndRange) {
        // Check if the taker has sufficient resources for the trade.
        // @param trade: Trade as Observer property 'trade'. Will not be
        //               modified.
        // @return true/false
        const original = Resources.fromObserverTrade(trade);
        let adjusted = new Resources(original);
        Collude.adjustForTaker(adjusted, trade.give.to.name, guessAndRange);
        const takerHasEnough = original.equals(adjusted);
        return takerHasEnough;
    }

}
