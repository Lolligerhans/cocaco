"use strict";

// Collude provides (collusion) templates. A template is the remaining, total
// liability of two colluding players towards each other.

// ── Interface ──────────────────────────────────────────────
//  - Colluding groups are fixed on construction
//  - All balances are zero-initialized
//  - Basic interactions:
//      - On obtained resources, call updateGotResources()
//      - On trades, call updateTradeResources()
//      - To obtain a tempalte, call getCollusionTemplate()
//      - Use the adjustors to cut down the template for specific use cases
//          - To make sure the giver and receiver have enough resources
//              - adjustForGiver()
//              - adjustForTaker()
//          - To make sure the give-take combination is allowed as a trade
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
//      - (*) Finalize trade
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

class Collude {

    #groupTotal = {};
    #balances = {};
    static #logger = new MessageLog(null);
    static #maxPerPlayer = 5; // const

    constructor(players) {
        // @param players: Array of strings representing player names, or other
        //                 identifier.
        this.#groupTotal = new Resources();
        players.forEach(p => this.#balances[p] = new Resources());
        console.assert(this.#playerCount() === players.length); // No duplicates

        Collude.#logger.log(
            null,
            `Colluding group: ${this.players()}`,
        );
        this.print();
    }

    #delta(player) {
        let delta = new Resources(this.#balances[player]);
        let target = this.#target();
        delta.subtract(target);
        return delta;
    }

    static formatDelta(delta = null) {
        // @param delta: 'Resources' object representing a player delta
        // @return A human readable string representing the delta
        if (delta === null) {
            return "[ <delta> ]";
        }
        return `[ ${delta.toSymbols()} ]`;
    }

    static formatTemplate(template = null) {
        // @param template: Trade template as 'Resources' object
        // @return A human readable string representing the template
        if (template === null) {
            return "{ <template> }";
        }
        return `{ ${template.toSymbols()} }`;
    }

    getCollusionTemplate(playerFrom, playerTo) {
        // Construct the collusion template between the given players.
        // @param playerFrom: String identifying the player, as passed to the
        //                    constructor.
        // @param playerTo: String identifying the player, as passed to the
        //                  constructor.
        // @return Collusion template from playerFrom to playerTo as 'Resources'
        //         object, if both players are colluding. 'null' if the players
        //         are not both colluding.
        if (!this.#hasColluders(playerFrom, playerTo)) {
            console.debug(
                playerFrom,
                Collude.formatTemplate(),
                playerTo,
            );
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
        console.debug(
            playerFrom,
            Collude.formatTemplate(template),
            playerTo,
        );
        return template;
    }

    #hasColluders(...names) {
        const ret = names.every(name => Object.hasOwn(this.#balances, name));
        return ret;
    }

    #playerCount() {
        return this.players().length;
    }

    players() {
        // @return Array of names of the colluding players
        return Object.keys(this.#balances);
    }

    print(playerName = null) {
        // Print collusion state of one or all players.
        // @param playerName: String identifying the player to be printed the
        //                    delta of. If 'null', print for all players
        if (playerName !== null) {
            console.assert(Object.hasOwn(this.#balances, playerName));
            console.debug(
                `𝚫 ${playerName} =`,
                `${Collude.formatDelta(this.#delta(playerName))}`,
            );
        }
        else {
            console.debug(`𝚺 =`, p(this.#groupTotal));
            this.players().forEach(p => this.print(p));
        }
    }

    static #reducePositive(template) {
        let sumPositive = template.sumPositive();
        for (; sumPositive > Collude.#maxPerPlayer; --sumPositive) {
            const [maxKey, _] = template.max();
            --template[maxKey];
        }
    }

    static #reduceNegative(template) {
        let sumNegative = template.sumNegative();
        for (; sumNegative < -Collude.#maxPerPlayer; ++sumNegative) {
            const [minKey, _] = template.min();
            ++template[minKey];
        }
    }

    #target() {
        let target = new Resources(this.#groupTotal);
        target.divide(this.#playerCount());
        return target;
    }

    updateGotResources(player, resources) {
        // Updates the collusion state after a participant has obtained new
        // resources in a way that should be distributed amongst the group.
        // @param player: String identifying the player, as passed to the
        //                constructor on construction.
        // @param resources: 'Resources' object containing the obtained
        //                   resources.
        if (!this.#hasColluders(player)) {
            return;
        }
        console.assert(resources.countNegative() === 0);
        this.#groupTotal.add(resources);
        this.#balances[player].add(resources);
        console.debug("⨁", player, resources.toSymbols());
        this.print(player);
    }

    updateTradeResources(playerFrom, playerTo, resources) {
        // Updates the state after a trade within the colluding group. The
        // passed trades count towards lowering or increasing the collusion
        // balance of the involved players, but not the total group balance.
        // @param playerFrom: String identifying the player giving positive
        //                    entries of resources, receiving the negative.
        // @param playerTo: String identifying the player receiving positive
        //                  entries of resources, giving the negative.
        // @param resources: 'Resources' object containing the traded resources.
        if (!this.#hasColluders(playerFrom, playerTo)) {
            return;
        }
        console.assert(resources.countPositive() > 0);
        console.assert(resources.countNegative() > 0);
        this.#balances[playerFrom].subtract(resources);
        this.#balances[playerTo].add(resources);
        console.debug(
            "Collude updateTradeResources():",
            playerFrom, resources.toSymbols(), playerTo,
        );
        this.print(playerFrom);
        this.print(playerTo);
    }

    static adjustForGiver(template, playerFrom, guessAndRange) {
        // Ensures that the giving player has enough resources to fulfil the
        // template. Else reduces the template to reflect the largest amount of
        // resources the giving player is certain to afford.
        // @param template: the template to be modified
        // @param player: The player name (to index into guessAndRange)
        // @param guessAndRange: The guess and range object from Multiverse
        // @return Does not return anything. The template is modified in-place.
        let minFrom = new Resources();
        mapObject(minFrom, (_v, k) => guessAndRange[playerFrom][k][0]);
        const atMostGive = (x, m) => Math.min(x, m);
        // The negative entries are not changed because the minimum available
        // resources are 0 or more.
        template.merge(minFrom, atMostGive);
    }

    static adjustForTaker(template, playerTo, guessAndRange) {
        // Ensure that the taking player has enough resources to fulfil the
        // template. Else reduces the template to reflect the largest amount of
        // resources the taking player is certain to afford.
        // @param template: the template to be modified
        // @param player: The player name (to index into guessAndRange)
        // @param guessAndRange: The guess and range object from Multiverse
        // @return Does not return anything. The template is modified in-place.
        let minTo = new Resources();
        mapObject(minTo, (_v, k) => guessAndRange[playerTo][k][0]);
        const atMostTake = (x, m) => Math.max(x, -m);
        template.merge(minTo, atMostTake);
    }

    static adjustForTradeValidity(template) {
        // Ensures that:
        //  - The template contains resources in both directions, i.e., both
        //    positive and negative values.
        //  - At most 5 resources are traded in each direction. The host may
        //    reject the trade otherwise.
        // May modify the template to fulfil the resource maximum.
        // Hints:
        //  - This function should be used after accounting for the players'
        //    available resources.
        //  - This function should not be used in the verification of trade
        //    offers. Use the unadjusted template to validate trades.
        // @param template: Collusion template as 'Resources' object. To be
        //                  edited in-place.
        // @return 'true' if the modified template is valid. 'false' the
        //         template is invalid.
        // TODO: Move this function to where the accounting for available
        //       resources happens.
        const positiveCount = template.countPositive();
        const negativeCount = template.countNegative();
        if (positiveCount === 0 || negativeCount === 0) {
            Collude.#logger.log(
                null,
                `✖ ${template.toSymbols()}`,
            );
            return false;
        }
        Collude.#reducePositive(template);
        Collude.#reduceNegative(template);
        Collude.#logger.log(
            null,
            `✔ ${template.toSymbols()}`,
        );
        return true;
    }

}
