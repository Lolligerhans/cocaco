"use strict";

// Collude provides (collusion) templates. A template is the remaining, total
// liability of two colluding players towards each other.

// ── Interface ──────────────────────────────────────────────
//  - Colluding groups are fixed on construction
//  - All balances are zero-initialized
//  - Basic interactions:
//      - On obtained resources, call updateGotResources()
//      - On trades, call updateTradeResources()
//      - To obtain a template, call getCollusionTemplate()
//      - Use the "adjust" functions to cut down the template for specific use
//        cases.
//          - To make sure the giver and receiver have enough resources:
//              - adjustForGiver()
//              - adjustForTaker()
//          - To make sure the give-take combination is allowed as a trade:
//              - adjustForTradeValidity()

// ── Intended use ───────────────────────────────────────────
// This class is used in 3 scenarios. The mark (*) indicates steps implemented
// outside of this class.
//  1. Generation of new collusion offers:
//      - Generate template
//      - Adjust template for our available resources
//      - Adjust template for their available resources
//      - Adjust template for trade validity
//      - (*) Make trade offer
//  2. Verification/detection of others' collusion offers:
//      - Generate template
//      - Adjust template for our available resources
//      - (*) Trade offer matches template?
//      - (*) Accept offer
//  3. Finalisation of our own collusion offers once accepted:
//      - Generate template
//      - (*) Trade offer matches template?
//      - (*) Finalise trade
// Numbers 2 and 3 are different because of the additional assumptions we can
// safely make in 3.

// ── Dependencies ───────────────────────────────────────────
//  - 'Resources' to represent collections of resources
//  - Expects to be updated on game events:
//      - When a colluding player individually gains resources. These are the
//        gains which are meant to be distributed by colluding. The user can
//        choose what constitutes obtaining resources.
//      - When colluding players trade resources. These are the events that are
//        meant to resolve the collusion. The user may choose to exclude trades
//        made not as the result of colluding (by hiding them from this class).

// ── Implementation ─────────────────────────────────────────
//  - Construct 1 group of N colluding players
//  - Use Player.name to identify players
//  - We keep track of resource balances separately:
//      - For the group total B
//      - For each player individually: B_i
//  - Balances are increased when obtaining resources. The group balance is
//    upgraded in unison.
//  - Trades within the group are applied to the balances of each trader. The
//    group balance remains unaffected.
//  - Templates are generated between pairs of two players P_0, P_1
//      - Every player has a delta D_i := B_i - B/N
//      - The collusion template from P_0 to P_1 is the element-wise combination
//
//                           ⎧  max{D_0, -D_1}, iff D_0 < 0 and 0 < D_1
//          T(P_0, P_1)  :=  ⎨  min{D_0, -D_1}, iff D_0 > 0 and 0 > D_1
//                           ⎩  0             , else
//
//      - That is, the collusion template is directional, conservative and
//        greedy. It represents the resources P_0 should trade to P_1, with
//        negative entries where P_0 should obtain resources from P_1.

/**
 * Tracks the resources owed to each other between a group of colluding players.
 */
class Collude {

    /**
     * Sum of resources earned by the colluding group
     * @type {Resources}
     */
    #groupTotal = {};

    /**
     * Sum of resources earned by each individual member of the group. Uses
     * Player::index as keys.
     * @type {Object.<number,Resources>}
     */
    #balances = {};

    /**
     * This array is used to provide the 'Player' objects to the
     * CollusionPlanner. We do not actually use it for anything specific;
     * 'Collude' bases its data on the 'index' properties of the players.
     * @type {Player[]}
     *
     * We do not use the 'Players' class specifically because we want to
     * identify some subset of all players, not all availables players.
     */
    #players = null;

    /**
     * @type {MessageLog}
     */
    static #logger = new ConsoleLog("Collude", "🤝");

    /**
     * Maximum amount of resources templates should have for each player.
     *
     * Small numbers (especially 1) may prevent balancing asymmetric amounts of
     * owed resources between players.
     * @type {Number}
     */
    static #maxPerPlayer = cocaco_config.collude.maxOfferPerSide; // const

    /**
     * @param {Player[]} players The group of colluding players. Should include
     *                           the player representing the user.
     */
    constructor(players) {
        this.#players = players;
        this.#groupTotal = new Resources();
        players.forEach(p => this.#balances[p.index] = new Resources());
        {
            // Sanity check: do not allow duplicates. Insertion into the object
            // deduplicates implicitly.
            console.assert(this.#playerCount() ===
                           Object.keys(this.#balances).length);
        }

        Collude.#logger.log("Colluding group:", this.playerNames());
        this.print();
    }

    /**
     * @param {Player} player
     * @return {Resources}
     */
    #delta(player) {
        let delta = new Resources(this.#balances[player.index]);
        let target = this.#target();
        delta.subtract(target);
        return delta;
    }

    /**
     * @param {Resources} delta
     * @return {string} A human readable string representing the delta
     */
    static formatDelta(delta = null) {
        if (delta === null) {
            return "[ <delta> ]";
        }
        return `[ ${delta.toSymbols()} ]`;
    }

    /**
     * @param {Resources} template
     * @return {string} A human readable string representing the template
     */
    static formatTemplate(template = null) {
        if (template === null) {
            return "{ <template> }";
        }
        return `{ ${template.toSymbols()} }`;
    }

    /**
     * Construct the collusion template between the given players.
     * @param {Player} playerFrom
     * @param {Player} playerTo
     * @return {Resources} Collusion template from playerFrom to playerTo, if
     *                     both players are colluding. Else 'null'.
     */
    getCollusionTemplate(playerFrom, playerTo) {
        if (!this.hasColluders(playerFrom, playerTo)) {
            Collude.#logger.log(playerFrom.name, Collude.formatTemplate(),
                                playerTo.name);
            return null;
        }
        let template = this.#delta(playerFrom);
        let deltaTo = this.#delta(playerTo);
        template.merge(deltaTo, (d0, d1) => {
            if (d0 < 0 && 0 < d1) {
                return Math.max(d0, -d1);
            }
            if (d0 > 0 && 0 > d1) {
                return Math.min(d0, -d1);
            }
            return 0;
        });
        Collude.#logger.log(template.toSymbols(true));
        return template;
    }

    /**
     * Test whether all given players are part of the collusion group
     * @param {...Player} players
     * @return {boolean}
     */
    hasColluders(...players) {
        const ret = this.#hasColludersByIndex(...players.map(p => p.index));
        return ret;
    }

    /**
     * @param {...Number} indices 1 or more player indices to test
     * @return {boolean} true if all indices belong to colluder(s), else false
     */
    #hasColludersByIndex(...indices) {
        const ret =
            indices.every(index => Object.hasOwn(this.#balances, index));
        return ret;
    }

    /**
     * @return {Number}
     */
    #playerCount() {
        console.assert(this.#players != null);
        return this.#players.length;
    }

    /**
     * @return {string[]} Names of the colluding players
     */
    playerNames() {
        return this.#players.map(p => p.name);
    }

    /**
     * @return {Player[]} The colluding players
     */
    players() {
        return this.#players;
    }

    /**
     * @param {Player} player
     */
    print(player = null) {
        if (player !== null) {
            console.assert(Object.hasOwn(this.#balances, player.index));
            Collude.#logger.log(`𝚫 ${player.name} =`,
                                `${Collude.formatDelta(this.#delta(player))}`);
        } else {
            Collude.#logger.log(`𝚺 =`, p(this.#groupTotal));
            this.players().forEach(p => this.print(p));
        }
    }

    static #reducePositive(template) {
        let sumPositive = template.sumPositive();
        for (; sumPositive > Collude.#maxPerPlayer; --sumPositive) {
            // We avoid sending the max trade. We could do so by
            // deterministically removing resources from the template.
            // Choosing deterministically has two drawbacks:
            //  - For unilateral collusion (with bots), collusion offers are
            //    biased towards trading certain resources over others
            //  - For bilateral collusion (with other cocaco players), there is
            //    still a bias when players owe different amounts of resources.
            // Picking randomly avoids these biases.
            const [maxKey, _] = pickUniform(template.maxAll());
            --template[maxKey];
        }
    }

    static #reduceNegative(template) {
        let sumNegative = template.sumNegative();
        for (; sumNegative < -Collude.#maxPerPlayer; ++sumNegative) {
            // See note in #reducePositive() for why we pick uniformly at random
            const [minKey, _] = pickUniform(template.minAll());
            ++template[minKey];
        }
    }

    /**
     * @return {Resources}
     * Target resource counts for all players. The target is the same for every
     * player.
     */
    #target() {
        let target = new Resources(this.#groupTotal);
        target.divide(this.#playerCount());
        return target;
    }

    /**
     * Updates the collusion state after a participant has obtained new
     * resources in a way that should be distributed amongst the group.
     * @param {Player} player The player getting resources
     * @param {Resources} resources The obtained resources
     */
    updateGotResources(player, resources) {
        if (!this.hasColluders(player)) {
            return;
        }
        console.assert(resources.countNegative() === 0);
        this.#groupTotal.add(resources);
        this.#balances[player.index].add(resources);
        Collude.#logger.log("⨁", player.name, resources.toSymbols());
        this.print(player);
    }

    /**
     * Updates the state after a trade within the colluding group. The passed
     * trades count towards lowering or increasing the collusion balance of the
     * involved players, but not the total group balance.
     * When some of the players are not part of the collusion group, the call is
     * ignroed.
     * @param {Trade} trade
     * @return {boolean}
     * true when balances were update. Else false (meaning at least one player
     * is not in the collusion group).
     */
    updateTradeResources(trade) {
        if (!this.hasColluders(trade.giver, trade.taker)) {
            return false;
        }
        this.#balances[trade.giver.index].subtract(trade.resources);
        this.#balances[trade.taker.index].add(trade.resources);
        Collude.#logger.log(trade.toString());
        this.print(trade.giver);
        this.print(trade.taker);
        return true;
    }

    /**
     * Ensures that the giving player has enough resources to fulfil the
     * template. Else reduces the template to reflect the largest amount of
     * resources the giving player is certain to afford.
     * @param {Resources} template The template to be modified
     * @param {Player} playerFrom The giving player
     * @param guessAndRange The guess and range object from Multiverse
     * @return {void} Does not return anything. The template is modified
     *                in-place.
     */
    static adjustForGiver(template, playerFrom, guessAndRange) {
        let minFrom = new Resources();
        mapObject(minFrom, (_v, k) => guessAndRange[playerFrom.index][k][0]);
        const atMostGive = (x, m) => Math.min(x, m);
        // The negative entries are not changed because the minimum available
        // resources are 0 or more.
        template.merge(minFrom, atMostGive);
    }

    /**
     * Ensure that the taking player has enough resources to fulfil the
     * template. Else reduces the template to reflect the largest amount of
     * resources the taking player is certain to afford.
     * @param {Resources} template The template to be modified
     * @param {Player} playerTo The taking player
     * @param guessAndRange The guess and range object from Multiverse
     * @return {void} Does not return anything. The template is modified
     *                in-place.
     */
    static adjustForTaker(template, playerTo, guessAndRange) {
        let minTo = new Resources();
        mapObject(minTo, (_v, k) => guessAndRange[playerTo.index][k][0]);
        const atMostTake = (x, m) => Math.max(x, -m);
        template.merge(minTo, atMostTake);
    }

    /**
     * Ensures that:
     *  - The template contains resources in both directions, i.e., both
     *    positive and negative values.
     *  - At most 5 resources are traded in each direction. The host may reject
     *    the trade otherwise.
     * May modify the template to fulfil the resource maximum.
     * Hints:
     *  - This function should be used after accounting for the players'
     *    available resources.
     *  - This function should not be used in the verification of trade offers.
     *    Use the unadjusted template to validate trades.
     * @param {Resources} template Collusion template. Modified in-place.
     * @return {boolean} true if the modified template is valid, false the
     *                   template is invalid.
     */
    static adjustForTradeValidity(template) {
        const positiveCount = template.countPositive();
        const negativeCount = template.countNegative();
        if (positiveCount === 0 || negativeCount === 0) {
            Collude.#logger.log(`✖ ${template.toSymbols()}`);
            return false;
        }
        Collude.#reducePositive(template);
        Collude.#reduceNegative(template);
        Collude.#logger.log(`✔ ${template.toSymbols()}`);
        return true;
    }
}
