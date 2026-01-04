"use strict";

/**
 * Originally Slices were meant to be a more efficient data structure, but
 * currently they are pretty pointless.
 * Presumably we could use ArrayBuffer to do something efficient?
 * @typedef {Number[]} Slice Array containing a number for every resource type
 */

/**
 * Worlds are objects with a 'chance' property, and a Slice for each player
 * index.
 * Use _0 in the JSDoc because 0 confuses the computer.
 * @typedef {Object} World
 * @property {Number} chance
 * @property {Slice} _0
 * @property {Slice} _1
 * @property {Slice} _2
 * @property {Slice} _3
 */

/**
 * Bayesian resource tracker.
 *
 * The data is structured as an array of Worlds, each representing a possible
 * state (for all players).
 *
 * Operations have three basic types:
 *  - Transform: Modify Worlds. For example, when getting resources from the
 *               bank every possible World adds the same amount of resources.
 *  - Collapse: Filter Worlds by some criterion. For example, when offering
 *              cards delete worlds where the player does not have the offered
 *              cards.
 *  - Branch: Create new Worlds. For example, when robbing a card every world
 *            spawns new Worlds for every possible rob, replacing itself.
 * Only branching operations require us to remove the duplicates that may occur
 * when different worlds branch into identical World.
 *
 * Resource stats are obtained by aggregating across all Worlds.
 */
class Multiverse {

    // Output objects
    // range has 4 numbers: [ smallest_nonzero_index,
    //                        max_count, index_of_max_count,
    //                        largest_nonzero_index ].
    //  0) smallest_nonzero_index: minimal amount of available cards
    //  1) fraction: fraction of worlds having the most common (guessed) card count
    //  2) index_of_max_count: is the guess for the resource count, and the most
    //     common count across all worlds
    //  3) largest_nonzero_index: maximal amount of available cards
    // Use max_count to derive the fraction of worlds exhibiting this amount
    // (measure of variability).
    //
    //               range for wood        range for brick
    //                v~~~~~~~~~~~v        v~~v
    //   { "A": {wood:{1, 18, 2, 3}, brick:{  }, ...},
    //     "B": {wood:{...        }, brick:{  }, ...},
    //     ...                                          }
    guessAndRange = {};
    marginalDistribution = {};
    affordProbability = {};
    stealProbability = {};
    totalResourceCounts = {}; // Card sum per resource

    /**
     * worlds === [world, world, ...] one world for ever possible
     * world === [slice, slice, ...] one slice for each player
     * slice === [woodCount, brickCount, ..., unknownCount]
     * Indices are given by 'resourceIndices' and 'playerIndices'
     * @type {World[]}
     */
    #worlds = [];

    /**
     * Mapping from player names to indices
     * @type {Object.<string,Number>}
     */
    #playerIndices; // {"John": 0, "Bob": 1, ...}

    /**
     * List of player names in index order
     * @type {string[]}
     */
    #playerNames; // ["John", "Bob", ...]

    // /**
    //  * Passed from outside and only read
    //  * @type {Players}
    //  */
    // #players;

    /**
     * Branch according to commercial harbor rules:
     *  - player gives a non-commodity.
     *  - other gives a commodity
     * Treated as uniform random even though chosen by players in reality.
     * @param {string} playerName
     * @param {string} otherName
     */
    branchHarbor(playerName, otherName) {
        const commodityIndices = ["cloth", "coin", "paper", "unknown"].map(
            r => Multiverse.getResourceIndex(r));
        const regularResIndices = [
            "wood",
            "brick",
            "sheep",
            "wheat",
            "ore",
            "unknown",
        ].map(r => Multiverse.getResourceIndex(r));

        // - Since the steals are guaranteed to be different resources, we need
        //   not collapse on availability beforehand.
        // - Including "unknown" in both directions is not accurate. Since it is
        //   not random anyway, and "unknown" cards are only a fallback
        //   mechanism, it is fine.
        this.branchSteal(otherName, playerName, true, commodityIndices);
        this.branchSteal(playerName, otherName, true, regularResIndices);

        this.#removeDuplicateWorlds();
    }

    /**
     * Branch for unknown resource transfer between two players. Known "steals"
     * should be treated as one-sided trade.
     * @param {string} victimName
     * @param {string} thiefName
     * @param {Boolean} deterministic
     * Set to 'true' if steal is not uniform random. This will suppress the
     * Bayesian update (replacing with uniform one).
     * @param {Number[]} [availableIndices]
     * Specify which resources are available for stealing. Use nullish if all
     * resources are available. This option is meant for the "commercial harbor"
     * progress card.
     */
    branchSteal(victimName, thiefName, deterministic, availableIndices = null) {
        if (availableIndices === null) {
            availableIndices = Object.values(Multiverse.resourceIndices);
        } else {
            //debugger; // verify index restriction
            // Not technically required but intended use
            console.assert(deterministic === true);
        }
        let newWorlds = [];
        const victim = this.#getPlayerIndex(victimName);
        const thief = this.#getPlayerIndex(thiefName);
        for (const world of this.#worlds) {
            const totalRes =
                Multiverse.sliceTotalIndices(world[victim], availableIndices);
            if (totalRes === 0)
                continue; // Impossible to steal => world dies
            for (const r of availableIndices) {
                if (world[victim][r] === 0)
                    continue; // No resource of this type

                // Keep original intact for next resource
                let w = deepCopy(world);
                w[victim][r] -= 1;
                w[thief][r] += 1;
                const thisRes = world[victim][r];
                if (deterministic === true) // Exception to the rule
                    w["chance"] = world["chance"];
                else // Usual case
                    // Unnormalised "Bayes" update
                    w["chance"] = world["chance"] * thisRes / totalRes;
                // Sanity check
                if (totalRes < thisRes) {
                    alertIf(27);
                    debugger;
                }
                newWorlds.push(w);
            }
        }
        this.#worlds = newWorlds;

        // Stealing has uncertainty. Hence we create new worlds. Check duplicates.
        this.#removeDuplicateWorlds();
    }

    /**
     * Why: This function is used when revealing a single resource card from
     * a uniform random event (known steal). Knowing about the uniformity allows
     * a Bayesian update on the 'chance' of each world. Since players may reveal
     * resources in ways that are not uniform random, this does not generally
     * apply.
     *
     * When: After a known steal, first call this function to adjust the
     * 'chance' of each world, then transfer the stolen resource using
     * 'transformExchange()'.
     *
     * What: Pretend a single resource of player 'playerName' was selected
     * uniformly at random and the result was 'slice'. Adjust chances with
     * Bayesian update.
     *
     * How: First remove all inconsistent worlds. Then multiply unnormalised
     * Bayesian update to 'chance' of each world. The worlds are left unnormalised.
     *
     * @param {string} playerName Name of the player who's card was revealed.
     * @param {Number} resourceIndex Resource index of the revealed card.
     */
    transformRandomReveal(playerName, resourceIndex) {
        console.assert(resourceIndex !== Multiverse.getResourceIndex("unknown"),
                       "Bayes update is for known cards only");
        const playerIdx = this.#getPlayerIndex(playerName);
        this.#worlds = this.#worlds.filter(world => {
            return 0 !==
                   (world[playerIdx][resourceIndex] +
                    world[playerIdx][Multiverse.getResourceIndex("unknown")]);
        });

        this.#worlds = this.#worlds.map((world) => {
            const total = Multiverse.sliceTotal(world[playerIdx]);
            const specific =
                world[playerIdx][resourceIndex] +
                world[playerIdx][Multiverse.getResourceIndex("unknown")];
            const bayesianUpdate = specific / total;
            world["chance"] = world["chance"] * bayesianUpdate;
            return world;
        });
    }

    /**
     * @param {string} playerName
     * @param {Number} count True exact amount of cards 'playerName' is holding,
     *                       including unknown cards.
     */
    collapseExactTotal(playerName, count) {
        const playerIdx = this.#getPlayerIndex(playerName);
        this.#worlds = this.#worlds.filter(world => {
            return Multiverse.sliceTotal(world[playerIdx]) === count;
        });
    }

    /**
     * Compare the state of 'this' with the state of 'manyWorlds'. Fail loudly
     * when inconsistent. This is slow.
     * This is meant to check two different implementations against each other,
     * so we convert to a common format instead of relying on internals.
     * @param {Multiverse} manyWorlds
     * Another resource tracking object which also implements the
     * 'toHumanReadableObject()' function for conversion into the human readable
     * format.
     */
    compareToManyworlds(manyWorlds) {
        debugger;
        this.#normalizeChance();
        manyWorlds.#normalizeChance();
        const our = this.toHumanReadableObject();
        const their = manyWorlds.toHumanReadableObject();
        let matchingIndices = new Set();
        for (let i = 0; i < our.length; ++i) {
            // Slow!
            const foundAt = their.findIndex(w => worldCompare(w, our[i]));
            matchingIndices.add(i);
            if (foundAt === -1) {
                console.warn(`Inconsistency found`);
                return false;
            }
        }
        // Make sure each of our worlds matches a distinct world in theirs
        if (matchingIndices.size !== our.length) {
            console.warn(`Inconsistency found`);
            return false;
        }
        return true;
    }

    constructor() {
        // Nothing
    }

    get playerNames() {
        return this.#playerNames;
    }

    #getPlayerIndex(playerName) {
        return Number(this.#playerIndices[playerName]);
    }

    #getPlayerName(playerIndex) {
        return this.#playerNames[playerIndex];
    }

    /**
     * Reset the object. Requires existing users array; some stats objects are
     * pre-filled with the names and they keep them always.
     * @param {Object.<string,Object.<string,Number>>} startingResources
     * An object mapping player names to their starting resources. Example:
     *      { "Alice": { "wood": 5, ... }, ... }
     */
    initWorlds(startingResources) {
        if (this.#worlds.length !== 0) {
            console.warn("Overwriting worlds");
        }

        this.#playerNames = deepCopy(Object.keys(startingResources));
        this.#playerIndices = Object.fromEntries(
            Object.entries(this.#playerNames).map(a => a.reverse()));

        /**
         * @type {World}
         */
        let world = {};
        for (const [name, resources] of Object.entries(startingResources)) {
            world[this.#getPlayerIndex(name)] = Multiverse.asSlice(resources);
        }
        world["chance"] = 1;
        this.#worlds = [world];

        // Initialise output object
        this.guessAndRange = {};
        for (const playerName of this.#playerNames) {
            this.guessAndRange[playerName] = {};
        }
        //logs("[NOTE] Initialized resource tracking", (startingResources === null ?
        //     "from no cards" : "from starting cards"));
        this.printWorlds();
    }

    /**
     * Branches by moving, in all worlds, 0 to U from victims unknown cards to
     * the thief's slice as stolen resource type. Where U is the number of
     * unknown cards victim has. This is a helper to allow monopolies in
     * recovery mode.
     * - Currently ignores the implicit reduction of 'max' to stealing of
     *   regular resources. To fix this, the branching could to happen before,
     *   while the card count is still known.
     * @param {Number} victimIdx
     * @param {Number} thiefIdx
     * @param {Number} resourceIndex
     * @param {Number} max Per-opponent stealing limit (for C&K).
     */
    #branchRecoveryMonopoly(victimIdx, thiefIdx, resourceIndex, max = 19) {
        // For binomial chance
        const p = 1 / Multiverse.resources.length;

        const unknowIndex = Multiverse.getResourceIndex("unknown");
        let newWorlds = [];
        for (const world of this.#worlds) {
            const u = world[victimIdx][unknowIndex];
            for (let i = 0; i <= Math.min(u, max); ++i) {
                let w = deepCopy(world);
                w[victimIdx][unknowIndex] -= i;
                w[thiefIdx][resourceIndex] += i;
                // Binomial experiment: Assume unknown cards are either resource uniformly
                w["chance"] = world["chance"] * choose(u, i) * p ** i *
                              (1 - p) ** (u - i);
                newWorlds.push(w);
            }
        }
        const didBranch = this.#worlds.length !== newWorlds.length;
        this.#worlds = newWorlds;

        if (didBranch)
            this.#removeDuplicateWorlds();
    }

    /**
     * Starts "recovery mode" by resetting every player's cards to only unknown
     * resources. "Recovery mode" refers to a state in which a nonzero amount of
     * "unknown" cards is present across at least some worlds. This state is
     * only reached by entering it in this fashion, and is exited once all
     * "unknown" cards are resolved to actual resources.
     * @param {Object.<string,Number>} counts
     * Mapping player name -> card count for all players. Example:
     *      { "Alice": 5, ... }.
     */
    enterCardRecovery(counts) {
        let world = {};
        for (const [player, count] of Object.entries(counts)) {
            const playerIdx = this.#getPlayerIndex(player);
            world[playerIdx] = [...Multiverse.zeroResources];
            world[playerIdx][Multiverse.getResourceIndex("unknown")] = count;
        }
        world["chance"] = 1;
        this.#worlds = [world];
        console.debug("🌎 Converting multiverse into recovery mode");
        //console.debug(this.#worlds);
        this.printWorlds();
    }

    /**
     * Collapse worlds such that world <= slice element-wise.
     * Does not influence later discoveries of unknown cards, because it is
     * unclear how.
     * @param {string} playerName
     * @param {Slice} slice Set values to 19 to allow any number of cards. The
     *                      game has 19 total of each resource type. Set the
     *                      unknown count to 19 * 5 = 95 to allow any number.
     */
    collapseMax(playerName, slice) {
        console.assert(!Multiverse.sliceHasNegative(slice),
                       "Epecting non-negative slice in collapseMax");
        // Unclear how unknowns would resolve
        if (slice[Multiverse.getResourceIndex("unknown")] !== 0) {
            console.error(`Expecting no-unknown slice`);
            alertIf("Cannot collapse unknown cards");
            return;
        }
        const pIdx = this.#getPlayerIndex(playerName);
        this.#worlds = this.#worlds.filter(
            world => { return world[pIdx].every((n, r) => n <= slice[r]); });
        // Recovery mode: Ignored. Does not break, but does not help either. The
        // difficulty is that we have currently no way of reserving unknown
        // cards for some resources only.
    }

    /**
     * Collapse to worlds where player has (at least) the content of 'slice' of
     * each resource type. 'slice' must have only positive entries, only normal
     * resources.
     * @param {string} playerName
     * @param {Slice} slice
     */
    collapseMin(playerName, slice) {
        // Sanity check
        if (Multiverse.sliceHasNegative(slice)) {
            console.error(`Expecting non-negative slice in collapseMin`);
            alertIf(37);
            return;
        }
        console.assert(slice[Multiverse.getResourceIndex("unknown")] === 0,
                       "Argument 'slice' must not contain unknown cards");

        // Remove offending worlds
        this.transformSpawn(playerName, Multiverse.sliceNegate(slice));
        // Restore original resources
        this.transformSpawn(playerName, slice);
    }

    /**
     * Collapse by predicate on the slice sum of a single player
     * @param {string} playerName Name of the player
     * @param {(n: any) => boolean} [predicate=n => n >= 8] Unary predicate for
     *                                           the players resource counts.
     */
    collapseTotal(playerName, predicate = n => n >= 8) {
        const playerIdx = this.#getPlayerIndex(playerName);
        this.#worlds = this.#worlds.filter(world => {
            return predicate(Multiverse.sliceTotal(world[playerIdx]));
        });
    }

    /**
     * Generate array of resources the given player may have.
     * @param {string} playerName
     * @return {{chance: Number, resources: Resources}[]}
     */
    getPlayerResources(playerName) {
        const playerIdx = this.#getPlayerIndex(playerName);
        let playerSlices = this.#getPlayerSlices(playerIdx);
        // Return as Resources to keep implementation encapsulated
        const res = playerSlices.map(({chance, slice}) => {
            const inResourceForm = {
                chance: chance,
                resources: Multiverse.sliceToResources(slice),
            };
            return inResourceForm;
        });
        return res;
    }

    /**
     * Generate the different slices individual players may have. This differs
     * from simply cutting a slice from each world because different worlds may
     * contain the same slice for individual players.
     * @return {{chance: Number, slice: Slice}[]}
     */
    #getPlayerSlices(playerIndex) {
        let res = [];
        const addSlice = (slice, chance) => {
            let index =
                res.findIndex(x => Multiverse.sliceEquals(x.slice, slice));
            if (index === -1) {
                res.push({chance: chance, slice: slice});
            } else {
                res[index].chance += chance;
            }
        };
        this.#worlds.forEach(world =>
                                 addSlice(world[playerIndex], world.chance));
        const chanceSum = res.reduce((sum, x) => sum + x.chance, 0);
        const normalize = x => x.chance / chanceSum;
        res.forEach(normalize);
        return res;
    }

    /**
     * Return worlds in human readable notation instead of slices. For export,
     * print, etc.
     */
    toHumanReadableObject() {
        let readableClone = Array(this.#worlds.length);
        for (let i = 0; i < this.#worlds.length; ++i) {
            readableClone[i] = {};
            readableClone[i]["chance"] = this.#worlds[i]["chance"];
            for (let p = 0; p < this.#playerNames.length; ++p) {
                const name = this.#getPlayerName(p);
                readableClone[i][name] =
                    Multiverse.sliceToResources(this.#worlds[i][p]);
            }
        }
        return readableClone;
    }

    /**
     * If you do not have a slice, use 'transformTradeByName()' instead
     * @param {string} source Giving player (slice is subtracted)
     * @param {string} target taking player (slice is added)
     * @param {Slice} tradedSlice
     */
    transformExchange(source, target, tradedSlice) {
        const s = this.#getPlayerIndex(source);
        const t = this.#getPlayerIndex(target);
        this.#worlds = this.#worlds.map(world => {
            world[s] = Multiverse.sliceSubtract(world[s], tradedSlice);
            world[t] = Multiverse.sliceAdd(world[t], tradedSlice);
            world[s] = Multiverse.sliceUseUnknowns(world[s]);
            world[t] = Multiverse.sliceUseUnknowns(world[t]);
            return world;
        });
        this.#worlds = this.#worlds.filter(
            world => { return world[s] !== null && world[t] !== null; });
        this.#removeDuplicateWorlds(); // Worlds with unknown may become duplicates
    }

    /**
     * Apply slice to single player (with positives and/or negatives)
     * @param {Slice} resourceSlice
     */
    transformSpawn(playerName, resourceSlice) {
        const playerIdx = this.#getPlayerIndex(playerName);
        const subtractsSomething = Multiverse.sliceHasNegative(resourceSlice);
        this.#worlds = this.#worlds.map(world => {
            world[playerIdx] =
                Multiverse.sliceAdd(world[playerIdx], resourceSlice);
            if (subtractsSomething)
                // Replace impossible with null
                world[playerIdx] =
                    Multiverse.sliceUseUnknowns(world[playerIdx]);
            return world;
        });

        if (subtractsSomething) {
            this.#worlds =
                this.#worlds.filter(world => world[playerIdx] !== null);
            // Worlds with unknown may become duplicates
            this.#removeDuplicateWorlds();
        }
    }

    /**
     * Specializes weightGuessPredicate() for the exact count case. This
     * specialization may branch in recovery mode by using unknown cards to
     * reach the exact count when possible.
     * @param {string} playerName
     * @param {Number} resourceIndex Index of the guessed resource
     * @param {Number} count Guess for the exact count
     */
    weightGuessExact(playerName, resourceIndex, count) {
        const resourceName = Multiverse.resources[resourceIndex];
        const icon = utf8Symbols[resourceName];
        console.log(`❕❔ ${playerName}[${icon}] === ${count}`);
        const playerIdx = this.#getPlayerIndex(playerName);
        const factor = 100; // Arbitrary large value

        let didBranch = false;
        let newWorlds = []; // Avoid appending to 'worlds' while iterating
        const unknownIndex = Multiverse.getResourceIndex("unknown");
        this.#worlds.forEach(world => {
            const availableCount = world[playerIdx][resourceIndex];
            const debt = count - availableCount;
            const unknownCount = world[playerIdx][unknownIndex];
            // Boost matching worlds
            if (debt === 0) {
                world["chance"] *= factor;
            }

            // Branch possible recoveries explicitly
            else if (0 < debt && debt <= unknownCount) {
                let w = deepCopy(world);
                w[playerIdx][resourceIndex] += debt;
                w[playerIdx][unknownIndex] -= debt;
                w["chance"] *= factor;
                newWorlds.push(w);
                didBranch = true;
            }
        });

        // When recovery branching generates new worlds, check for duplicates
        if (didBranch) {
            // is there an in place version of this?
            this.#worlds = this.#worlds.concat(newWorlds);
            this.#removeDuplicateWorlds();
        }
    }

    /**
     * Boost worlds where the player 'playerName' can not spawn the resources
     * given in 'resourceSlice'. Only amounts < 0 have an effect.
     * In Recovery mode: Apply bonus if amount of unknown cards is too small. No
     * changes if sufficient unknown cards.
     * @param {string} playerName
     * @param {Slice} resourceSlice
     * One of the 'Multiverse.costs' slices. Or an equivalent Slice, containing negative
     * numbers for restricted resources.
     */
    weightGuessNotAvailable(playerName, resourceSlice) {
        console.log(`❕❔ ${playerName} 🚫`,
                    Multiverse.sliceToResources(resourceSlice).toSymbols());
        const playerIdx = this.#getPlayerIndex(playerName);
        const factor = 100; // Arbitrary large value
        this.#worlds.forEach(world => {
            let adjustedSlice =
                Multiverse.sliceAdd(world[playerIdx], resourceSlice);
            const slice = Multiverse.sliceUseUnknowns(adjustedSlice);
            if (slice === null)
                world["chance"] *= factor;
        });
    }

    /**
     * Transform worlds by significantly increasing the 'chance' of worlds where
     * a single resource count fulfils a unary predicate.
     * The effect is cosmetic only in the sense that the 'chance' is only used
     * for display purposes. It does not strictly rule out worlds. If the guess
     * is identified as impossible, changes revert automatically (up to
     * numerics). Does not meddle with unknown cards because it is unclear how
     * to do so in the general case.
     * @param {string} playerName
     * @param {Number} resourceIndex
     * @param {function(Number):Boolean} predicate
     * One of the predefined predicates, or any other predicate
     * @param {string} [name] Predicate name to be displayed in logging
     */
    weightGuessPredicate(playerName, resourceIndex, predicate,
                         name = "predicate") {
        const resourceName = Multiverse.getResourceName(resourceIndex);
        const icon = utf8Symbols[resourceName];
        console.log(`❕❔ ${playerName}[${icon}] ${name}`);
        const playerIdx = this.#getPlayerIndex(playerName);
        const factor = 100; // Arbitrary large value

        this.#worlds.forEach(world => {
            const availableCount = world[playerIdx][resourceIndex];
            if (predicate(availableCount)) {
                // Regular effect: reduce chance of mismatching world, so the max
                // likelihood displayed will match the guess.
                world["chance"] *= factor;
            }
        });
    }

    /**
     * Ensures that the world probabilities add to 1. Sum can decrease when
     * impossible worlds are filtered out. If the worlds array is read out raw
     * (e.g., from a log), the values might not be normalized. Usually, the call
     * to updateStats() triggers normalization for display.
     */
    #normalizeChance() {
        let sum = this.#worlds.reduce((sum, w) => sum + w["chance"], 0);
        this.#worlds.forEach(
            world => { world["chance"] = world["chance"] / sum; });
    }

    printWorlds(force = false) {
        if (force === false && cocaco_config.printWorlds === false)
            return;
        if (this.#worlds.length > 1000) {
            console.log("🌎 > 1000 worlds (suppressing print)");
            return;
        }
        console.log("🌎 Multiverse:", this.#worlds.length, this.#worlds);
        if (this.#worlds.length === 0)
            console.log("🌎 No worlds left!");
        for (let i = 0; i < this.#worlds.length; ++i) {
            console.debug(`\t----- 🌌 ${i}/${this.#worlds.length}: ${
                this.#worlds[i]["chance"]} -----`);
            for (const pl of this.#playerNames) {
                const pIndx = this.#getPlayerIndex(pl);
                let p = Multiverse.sliceToResources(this.#worlds[i][pIndx]);
                if (cocaco_config.shortWorlds)
                    p = p.toSymbols();
                console.debug(`\t\t[${i}][${pl}] =`, p);
            }
        }
    }

    /**
     * Called internally after branching operations
     */
    #removeDuplicateWorlds() {
        this.#worlds = this.#worlds.sort((w1, w2) => {
            // Arbitrary sort order
            for (let p = 0; p < this.#playerNames.length; ++p)
                for (let r = 0; r < Multiverse.resources.length; ++r)
                    if (w1[p][r] !== w2[p][r])
                        return w1[p][r] < w2[p][r] ? -1 : 1;
            return 0;
        });

        // Keep unique worlds
        this.#worlds = this.#worlds.filter((item, pos, others) => {
            if (pos === 0) {
                return true;
            }
            let other = others[pos - 1];
            for (let p = 0; p < this.#playerNames.length; ++p) {
                if (!Multiverse.sliceEquals(item[p], other[p]))
                    return true;
            }
            other["chance"] += item["chance"];
            return false;
        });
    }

    /**
     * Convert a slice to a Resources object
     * @param {Slice} resourcesAsSlice
     * @return {Resources} New object
     */
    static sliceToResources(resourcesAsSlice) {
        // Assume that the Multiverse resource names are  all valid for
        // 'Resources'.
        let result = new Resources();
        for (let i = 0; i < resourcesAsSlice.length; ++i)
            result[Multiverse.getResourceName(i)] = resourcesAsSlice[i];
        return result;
    }

    /**
     * Convert resources by names to slice, allowing unspecified resources
     * By name = { "wood": 3, "brick": 2, ... }
     * As slice = [3, 2, 0, 0, ...]
     * @param {Object.<string,Number>} resourcesByName
     * @return {Slice}
     */
    static asSlice(resourcesByName) {
        let result = [...Multiverse.zeroResources];
        for (let [name, count] of Object.entries(resourcesByName))
            result[Multiverse.getResourceIndex(name)] = count;
        return result;
    }

    /**
     * Compute world resource total, adding up resources for all players.
     * @param {World} world
     * @return {Resources} Sum of all slices in 'world'
     */
    static generateFullNamesFromWorld(world) {
        let sum = [...Multiverse.zeroResources];
        sum = Object.entries(world).reduce(
            (sum, [playerIdx, slice]) =>
                playerIdx === "chance" ? sum : Multiverse.sliceAdd(sum, slice),
            sum);
        return Multiverse.sliceToResources(sum);
    }

    static getResourceIndex(resourceName) {
        return Multiverse.resourceIndices[resourceName];
    }

    static getResourceName(resourceIndex) {
        return Multiverse.resources[resourceIndex];
    }

    static sliceAdd(s1, s2) {
        let result = s1.map((x, i) => x + s2[i]);
        return result;
    }

    /**
     * @return {boolean}
     */
    static sliceEquals(s1, s2) {
        return s1.every((x, i) => x === s2[i]);
    }

    static sliceHasNegative(slice) {
        {
            // TODO: Remove these checks eventually
            if (!slice) {
                console.error("unreachable");
                debugger;
            }
            if (slice === undefined) {
                console.error("unreachable");
                debugger;
            }
        }
        console.assert(slice);
        console.assert(slice != null);
        return slice.some(x => x < 0);
    }

    static sliceNegate(slice) {
        return slice.map(x => -x);
    }

    static sliceSubtract(s1, s2) {
        let result = s1.map((x, i) => x - s2[i]);
        return result;
    }

    static sliceTotal(slice) {
        return slice.reduce((a, b) => a + b, 0);
    }

    /**
     * Like sliceTotal but consider only resources at specific indices.
     * @param {Slice} slice
     * @param {number[]} indices Indices to consider for the sum.
     * @return {Number} Sum of values for the given indices.
     */
    static sliceTotalIndices(slice, indices) {
        let total = 0;
        for (const index of indices)
            total += slice[index];
        return total;
    }

    /**
     * Use "unknown" resource to ensure non-negativity.
     * @param {Slice} slice
     * @return {Slice|null} Fixed slice if possible, else null.
     */
    static sliceUseUnknowns(slice) {
        let result = [...slice];
        // Stop before "unknown" (last resource)
        for (let i = 0; i < result.length - 1; ++i) {
            if (result[i] < 0) {
                result[result.length - 1] += result[i];
                result[i] -= result[i];
            }
        }
        if (result[result.length - 1] < 0)
            return null; // Not enough unknown cards
        return result;
    }

    /**
     * Transform worlds by monopoly. In recovery mode, branches for all
     * possibilities.
     *
     * @param {string} thiefName
     * @param {Number} resourceIndex
     * @param {Number} max Per-opponent stealing limit (for C&K).
     * @param {Number} [count] Collapses to worlds where exactly 'count' many
     *                         resources are stolen.
     */
    transformMonopoly(thiefName, resourceIndex, max = 19, count = null) {
        const thiefIdx = this.#getPlayerIndex(thiefName);
        this.#worlds = this.#worlds.map(world => {
            // Total count may be difference in worlds because of recovery mode
            let totalStolen = 0;
            for (let p = 0; p < this.#playerNames.length; ++p) {
                if (p === thiefIdx)
                    continue;
                const stolen = Math.min(world[p][resourceIndex], max);
                totalStolen += stolen
                world[p][resourceIndex] -= stolen;
            }
            world[thiefIdx][resourceIndex] += totalStolen;

            if (count !== null)
                if (totalStolen !== count)
                    return null;
            return world;
        });
        this.#worlds = this.#worlds.filter(w => w !== null);

        this.#removeDuplicateWorlds();

        // Recovery mode branching
        for (const victimIdx of Object.values(this.#playerIndices)) {
            if (victimIdx === thiefIdx)
                continue;
            this.#branchRecoveryMonopoly(victimIdx, thiefIdx, resourceIndex,
                                         max);
        }
    }

    /**
     * Incorporate player trade. Since each resource type goes in only one
     * direction, we can not get additional information by doing them 1 by 1.
     *
     * @param {string} trader
     * @param {string} other
     * @param {Object.<string,Number>} offer
     * Example: offer = {wood:1, brick: 0, sheep: 2, ...}.
     * @param {Object.<string,Number>} demand Same format as offer.
     */
    transformTradeByName(trader, other, offer, demand) {
        // Generate slice in perspective trader -> other
        const slice = Multiverse.sliceSubtract(Multiverse.asSlice(offer),
                                               Multiverse.asSlice(demand));
        this.transformExchange(trader, other, slice);
    }

    /**
     * Generate stats object to be read from outside
     */
    updateStats() {
        this.#normalizeChance();

        // This function has 3 stages:
        //  1) Fill stats objects with 0s
        //  2) Iterate worlds to accumulate stats
        //  3) Update secondary objects derived from those stats

        console.assert(this.#worlds.length >= 1, `Expected at least 1 world`);
        console.assert(this.#playerNames.length >= 1,
                       `Expected at least 1 player`);
        console.assert(
            // 1 Player + chance ➜ 2 entries
            Object.keys(this.#worlds[0]).length >= 2,
            `Expected at least 2 world entries`);
        for (const player of this.#playerNames) {
            // As a slight abuse of 'Resources' we storage float values in it
            this.stealProbability[player] =
                new Resources(Multiverse.zeroResourcesByName);
            this.affordProbability[player] = deepCopy(Multiverse.costs);
            Object.keys(this.affordProbability[player])
                .forEach(k => this.affordProbability[player][k] = 0);
            this.marginalDistribution[player] = {};
            this.marginalDistribution[player]
                .cardSum = {}; // {[N]: chance_of_N, ...
            for (const res of Multiverse.resources) {
                // At most 19 cards because there are only 19 cards per resource
                //  Accumulated chance of player having exactly 4 of this resource
                //                                       ~~~v~~~
                this.marginalDistribution[player][res] = [
                    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                ];
                // FIXME This allow up to 19 resources, but we might want to allow more for "unknown"
                //  ➜ an alternative would be to save indices explicitly:
                //      ❌ [0, 0, 0, 0.1, 0.4, 0.3, 0.2]
                //      ✅ {3:0.1, 4:0.4, 5:0.3, 6:0.2} // Pairs [N, chance_of_N]
            }
        }

        // Count across all worlds
        this.#worlds.forEach(w => {
            for (const player of this.#playerNames) {
                const playerIdx = this.#getPlayerIndex(player);
                const totalPlayerRes = Multiverse.sliceTotal(w[playerIdx]);
                this.marginalDistribution[player].cardSum[totalPlayerRes] =
                    (this.marginalDistribution[player]
                         .cardSum[totalPlayerRes] ||
                     0) +
                    w["chance"];
                for (const res of Multiverse.resources) {
                    const resIndx = Multiverse.getResourceIndex(res);
                    // For distribution
                    const countInWorld = w[playerIdx][resIndx];
                    // FIXME IF distr[][][] does not exist yet, this does not set it
                    //       it it was set explicitly in that case we would
                    //       automatically allow more than 19 resources. This is
                    //       probably better than fixing size to 19 a priori
                    this.marginalDistribution[player][res][countInWorld] +=
                        w["chance"];
                    // For steals
                    if (countInWorld > 0)
                        this.stealProbability[player][res] +=
                            (countInWorld / totalPlayerRes) * w["chance"];
                }
                // For builds
                for (const [name, cost] of Object.entries(Multiverse.costs)) {
                    // 'costs' contains negative values
                    const ifBought = Multiverse.sliceAdd(w[playerIdx], cost);
                    if (!Multiverse.sliceHasNegative(ifBought))
                        this.affordProbability[player][name] += w["chance"];
                }
            }
        });

        // Generate most "likely" suggestion
        for (const player of this.#playerNames) {
            for (const res of Multiverse.resources) {
                // Compute guess and range for this player-resource combo based on
                // the full statistics.
                // [ smallest_nonzero_index,
                //   max_chance, index_of_max_count
                //   largest_nonzero_index ]
                let range = [19, 0, 0, 0];
                // FIXME marginalDistribution goes until 19 only, but unknown cards might be more than 19
                range = this.marginalDistribution[player][res].reduce(
                    (r, val, idx) => {
                        // clang-format off
                        if (val != 0) r[0] = Math.min(r[0], idx);
                        if (val > r[1]) { r[1] = val; r[2] = idx; }
                        if (val != 0) r[3] = Math.max(r[3], idx);
                        // clang-format on
                        return r;
                    },
                    range);
                this.guessAndRange[player][res] = range;
            }

            // Do the same for cardSum. But better since we use a better format
            {
                let range = [1000, 0, 0, 0]; // Arbitrary large start maximum
                for (const [idx, val] of Object.entries(
                         this.marginalDistribution[player].cardSum)) {
                    if (val != 0) {
                        range[0] = Math.min(range[0], idx);
                    }
                    if (val > range[1]) {
                        range[1] = val;
                        range[2] = idx;
                    }
                    if (val != 0) {
                        range[3] = Math.max(range[3], idx);
                    }
                }
                this.guessAndRange[player].cardSum = range;
            }
        }
        // For total card stats (does not matter which world is used). It can
        // matter in recovery mode after a recovery monopoly branch. We are OK
        // with the error in recovery mode.
        this.totalResourceCounts =
            Multiverse.generateFullNamesFromWorld(this.#worlds[0]);
    }

    worldCount() {
        return this.#worlds.length;
    }
};

/**
 * Compare two worlds in human readable format (used as shared format so we do
 * not rely on internals from either). For testing.
 * @param {Object} w1 World in a common human readable format.
 * @param {Object} w2 World in a common human readable format.
 * @return {Boolenan} true if worlds are the same, false otherwise
 */
function worldCompare(w1, w2) {
    //debugger;
    if (Object.keys(w1).length !== Object.keys(w2).length)
        return false;

    // We can be quite forgiving with the chance since typical errors would have
    // drastic effects. And we place no attention on numerical accuracy.
    const chanceDiff = w1["chance"] - w2["chance"];
    if (Math.abs(chanceDiff) > 0.05)
        return false;

    for (const p of Object.keys(w1)) {
        if (p == "chance")
            continue;
        if (sliceCompare(w1[p], w2[p]) === false)
            return false;
    }
    return true;
}

/**
 * Compares two slices in human readable format (used as shared format so we do
 * not rely on internals from either).
 * @param {Object} s1 Slice in human readable format
 * @param {Object} s2 Slice in human readable format
 * @return {Boolean} true if slices are the same, false otherwise
 */
function sliceCompare(s1, s2) {
    //debugger;
    if (Object.keys(s1).length !== Object.keys(s2).length)
        return false;
    for (const res of Object.keys(s1)) {
        if (s1[res] !== s2[res])
            return false;
    }
    return true;
}

Multiverse.resources = [
    "wood", "brick", "sheep", "wheat", "ore", "cloth", "coin", "paper",
    "unknown"
];
Multiverse.resourceIndices = Object.fromEntries(
    Multiverse.resources.map((value, index) => [value, index]));
Multiverse.zeroResources = new Array(Multiverse.resources.length).fill(0);
Multiverse.zeroResourcesByName =
    Multiverse.sliceToResources(Multiverse.zeroResources);
/**
 * @type {Slice[]} Slices that can be used for 'weightGuessNotAvailable()'
 */
Multiverse.costs = {
    road: new Array(Multiverse.resources.length).fill(0).fill(-1, 0, 2),
    settlement: new Array(Multiverse.resources.length).fill(0).fill(-1, 0, 4),
    devcard: new Array(Multiverse.resources.length).fill(0).fill(-1, 2, 5),
    city: new Array(Multiverse.resources.length).fill(0),
    ship: new Array(Multiverse.resources.length).fill(0),
};
Multiverse.costs["city"][Multiverse.getResourceIndex("wheat")] = -2;
Multiverse.costs["city"][Multiverse.getResourceIndex("ore")] = -3;
Multiverse.costs["ship"][Multiverse.getResourceIndex("wood")] = -1;
Multiverse.costs["ship"][Multiverse.getResourceIndex("sheep")] = -1;
