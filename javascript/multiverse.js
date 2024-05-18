"use strict";

// TODO Store world chance outside of world. Makes iterating better
// TODO Collapse based on monopolied number of cards for recovery mode

// Shared basics
class Multiverse
{
    constructor()
    {
        this.resources = ["wood", "brick", "sheep", "wheat", "ore", "cloth", "coin", "paper", "unknown"];
        this.resourceIndices = Object.fromEntries(this.resources.map((value, index) => [value, index]));

        this.zeroResources = new Array(this.resources.length).fill(0);
        this.zeroResourcesByName = this.asNames(this.zeroResources);
        this.costs =
        {
            road:       new Array(this.resources.length).fill(0).fill(-1, 0, 2),
            settlement: new Array(this.resources.length).fill(0).fill(-1, 0, 4),
            devcard:    new Array(this.resources.length).fill(0).fill(-1, 2, 5),
            city:       new Array(this.resources.length).fill(0),
            ship:       new Array(this.resources.length).fill(0),
        };
        this.costs.city[this.getResourceIndex("wheat")] = -2;
        this.costs.city[this.getResourceIndex("ore")] = -3;
        this.costs.ship[this.getResourceIndex("wood")] = -1;
        this.costs.ship[this.getResourceIndex("sheep")] = -1;

        // Helpers
        this.worlds = [];   // worlds === [world, world, ...] one world for ever possible state
                            // world === [slice, slice, ...] one slice for each player
                            // slice === [woodCount, brickCount, ..., unknownCount]
                            // Indices are given by 'resourceIndices' and 'playerIndices'
        this.players = []; // ["John", "Bob", ...]
        this.playerIndices = {}; // {"John": 0, "Bob": 1, ...}

        // Output objects
        // range has 4 numbers: [ smallest_nonzero_index,
        //                        max_count, index_of_max_count,
        //                        largest_nonzero_index ].  // TODO This is wrong by now
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
        this.worldGuessAndRange = {};
        this.mwDistribution = {};
        this.mwBuildsProb = {};
        this.mwSteals = {};
        this.mwTotals = {};
    }
};

//==============================================================================
// Helpers
//==============================================================================

Multiverse.prototype.worldCount = function()
{
    return this.worlds.length;
}

Multiverse.prototype.getResourceIndex = function(resourceName)
{
    return this.resourceIndices[resourceName];
}

Multiverse.prototype.getResourceName = function(resourceIndex)
{
    return this.resources[resourceIndex];
}

Multiverse.prototype.getPlayerIndex = function(playerName)
{
    return this.playerIndices[playerName];
}

Multiverse.prototype.getPlayerName = function(playerIndex)
{
    return this.players[playerIndex];
}

// Compute world resource totals as names
Multiverse.prototype.generateFullNamesFromWorld = function(world)
{
    let sum = [...this.zeroResources];
    sum = Object.entries(world).reduce
    (
        (sum, [playerIdx, slice]) => playerIdx === "chance" ? sum : this.sliceAdd(sum, slice),
        sum
    );
    return this.asNames(sum);
}

//==============================================================================
// Slice helpers
//==============================================================================

// Convert resources by names to slice, allowing unspecified resources
// By name = { "wood": 3, "brick": 2, ... }
// As slice = [3, 2, 0, 0, ...]
Multiverse.prototype.asSlice = function(resourcesByName)
{
    let result = [...this.zeroResources];
    for (let [name, count] of Object.entries(resourcesByName))
        result[this.getResourceIndex(name)] = count;
    return result;
}

Multiverse.prototype.asNames = function(resourcesAsSlice)
{
    let result = {};
    for (let i = 0; i < resourcesAsSlice.length; ++i)
        result[this.getResourceName(i)] = resourcesAsSlice[i];
    return result;
}

Multiverse.prototype.sliceHasNegative = function(slice)
{
    { // TODO unreachable. Remove this test eventuall
        if (!slice)
        {
            console.error("unreachable");
            debugger;
        }
        if (slice === undefined)
        {
            console.error("unreachable");
            debugger;
        }
    }
    return slice.some(x => x < 0);
}

Multiverse.prototype.sliceTotal = function(slice)
{
    return slice.reduce((a, b) => a + b, 0);
}

// Like sliceTotal but consider only resources at specific indices
Multiverse.prototype.sliceTotalIndices = function(slice, indices)
{
    let total = 0;
    for (const index of indices)
        total += slice[index];
    return total;
}

Multiverse.prototype.sliceNegate = function(slice)
{
    return slice.map(x => -x);
}

Multiverse.prototype.sliceAdd = function(s1, s2)
{
    let result = s1.map((x, i) => x + s2[i]);
    return result;
}

Multiverse.prototype.sliceEquals = function(s1, s2)
{
    return s1.every((x, i) => x === s2[i]);
}

Multiverse.prototype.sliceSubtract = function(s1, s2)
{
    let result = s1.map((x, i) => x - s2[i]);
    return result;
}

// Use "unknown" resource to ensure non-negativity.
// @return Fixed slice if possible, else null
Multiverse.prototype.sliceUseUnknowns = function(slice)
{
    let result = [...slice];
    for (let i = 0; i < result.length - 1; ++i) // Stop before "unknown" (last resource)
    {
        if (result[i] < 0)
        {
            result[result.length - 1] += result[i];
            result[i] -= result[i];
        }
    }
    if (result[result.length - 1] < 0)
        return null; // Not enough unknown cards
    return result;
}

//==============================================================================
// Member functions
//==============================================================================

Multiverse.prototype.printWorlds = function()
{
    if (configPrintWorlds === false)
        return;
    if (this.worlds.length > 1000)
    {
        console.log("🌎 > 1000 worlds (suppressing print)");
        return;
    }
    log2("🌎 Multiverse:", this.worlds);
    if (this.worlds.length === 0)
        console.log("🌎 No worlds left!");
    for (let i = 0; i < this.worlds.length; ++i)
    {
        log(`\t----- 🌌 ${i}/${this.worlds.length}: ${this.worlds[i]["chance"]} -----`);
        for (const pl of this.players)
        {
            const pIndx = this.getPlayerIndex(pl);
            log(`\t\t[${i}][${pl}] =`, this.asNames(this.worlds[i][pIndx]));
        }
    }
}

// Starts recovery mode
// Input: counts === { "alice": 5, ... } the total number of (unknown) cards
Multiverse.prototype.mwCardRecovery = function(counts)
{
    let world = {};
    for(const [player, count] of Object.entries(counts))
    {
        const playerIdx = this.getPlayerIndex(player);
        world[playerIdx] = [...this.zeroResources];
        world[playerIdx][this.getResourceIndex("unknown")] = count;
    }
    world["chance"] = 1;
    this.worlds = [world];
    console.debug("🌎 Converting multiverse into recovery mode");
    //console.debug(this.worlds);
    this.printWorlds();
}

// Requires existing users array. Some stats objects are pre-filled with the
// names and they keep them always.
// @param startingResources: { "alice": {"wood": 5, ...}, ... }
Multiverse.prototype.initWorlds = function(startingResources)
{
    // Init only once
    if (this.worlds.length !== 0)
    {
        console.warn("Initializing multiverse over non-empty worlds array!");
    }

    // FIXME Replace player with playerNames
    this.players = deepCopy(Object.keys(startingResources));
    this.playerNames = this.players;
    this.playerIndices = Object.fromEntries(Object.entries(this.players).map(a => a.reverse()))

    let world = {};
    for (const [name, resources] of Object.entries(startingResources))
    {
        world[this.getPlayerIndex(name)] = this.asSlice(resources);
    }
    world["chance"] = 1;
    this.worlds = [world];

    // Init output object
    this.worldGuessAndRange = {};
    for (const playerName of this.players)
    {
        this.worldGuessAndRange[playerName] = {};
    }
    //logs("[NOTE] Initialized resource tracking", (startingResources === null ?
    //     "from no cards" : "from starting cards"));
    this.printWorlds();
}

// Specializes mwWeightGuessPredicate() for the exact count case.
// ❕ This specialization may branch in recovery mode by using unknown cards to
// reach the exact count when possible.
Multiverse.prototype.mwWeightGuessExact = function(playerName, resourceIndex, count)
{
    const resourceName = resourceTypes[resourceIndex];
    const icon = resourceIcons[resourceName];
    console.log(`❕❔ ${playerName}[${icon}] === ${count}`);
    const playerIdx = this.getPlayerIndex(playerName);
    const factor = 100; // Arbitrary large value

    let didBranch = false;
    let newWorlds = []; // Avoid appending to 'worlds' while iterating
    const unknownIndex = this.getResourceIndex("unknown");
    this.worlds.forEach(world =>
    {
        const availableCount = world[playerIdx][resourceIndex];
        const debt = count - availableCount;
        const unknownCount = world[playerIdx][unknownIndex];
        // Boost matching worlds
        if (debt === 0)
        {
            world["chance"] *= factor;
        }

        // Branch possible recoveries explicitly
        else if (0 < debt && debt <= unknownCount)
        {
            let w = deepCopy(world);
            w[playerIdx][resourceIndex] += debt;
            w[playerIdx][unknownIndex] -= debt;
            w["chance"] *= factor;
            newWorlds.push(w);
            didBranch = true;
        }
    });

    // When recovery branching generates new worlds, check for duplicates
    if (didBranch)
    {
        this.worlds = this.worlds.concat(newWorlds); // is there an in place version of this?
        this.removeDuplicateWorlds();
    }

    // TODO (?) This was here before but I don't think it is needed
    // Since we adjust chances in a one-sided way we need to make them sum to 1
    // this.normalizeManyWorlds();
}

// Transform worlds by significantly increasing the 'chance' of worlds where
// a single resource count fulfils a unary predicate.
// The effect is cosmetic only in the sense that the 'chance' is only used for
// display purposes. It does not strictly rule out worlds. If the guess is
// identified as impossible, changes revert automatically (up to numerics).
// Does not meddle with unknown cards because it is unclear how to do so in the
// general case.
Multiverse.prototype.mwWeightGuessPredicate = function(playerName, resourceIndex, predicate, name = "predicate")
{
    const resourceName = this.getResourceName(resourceIndex);
    const icon = resourceIcons[resourceName];
    console.log(`❕❔ ${playerName}[${icon}] ${name}`);
    const playerIdx = this.getPlayerIndex(playerName);
    const factor = 100; // Arbitrary large value

    this.worlds.forEach(world =>
    {
        const availableCount = world[playerIdx][resourceIndex];
        if (predicate(availableCount))
        {
            // Regular effect: reduce chance of mismatching world, so the max
            // likelihood displayed will match the guess.
            world["chance"] *= factor;
        }
    });
}


// Boost worlds where the player 'playerName' can not spawn the resources given
// in 'resourceSlice'. Only amounts < 0 have an effect.
// @param resourceSlice  Typically one of the 'mwBuilds' slices, containing
//                       negative numbers for restricted resources!
// Recovery mode: Apply bonus if amount of unknown cards is too small. No
// changes if sufficient unknown cards.
Multiverse.prototype.mwWeightGuessNotavailable = function(playerName, resourceSlice)
{
    console.log(`❕❔ ${playerName} 🚫`, this.asNames(resourceSlice));
    const playerIdx = this.getPlayerIndex(playerName);
    const factor = 100; // Arbitrary large value
    let didBranch = false;
    this.worlds.forEach(world =>
    {
        let adjustedSlice = this.sliceAdd(world[playerIdx], resourceSlice);
        const slice = this.sliceUseUnknowns(adjustedSlice);
        if (slice === null)
            world["chance"] *= factor;
    });
}

// Apply slice to single player (with positives and/or negatives)
Multiverse.prototype.mwTransformSpawn = function(playerName, resourceSlice)
{
    const playerIdx = this.getPlayerIndex(playerName);
    const subtractsSomething = this.sliceHasNegative(resourceSlice);
    this.worlds = this.worlds.map(world =>
    {
        world[playerIdx] = this.sliceAdd(world[playerIdx], resourceSlice);
        if (subtractsSomething)
            // Replace impossible with null
            world[playerIdx] = this.sliceUseUnknowns(world[playerIdx]);
        return world;
    });

    if (subtractsSomething)
    {
        this.worlds = this.worlds.filter(world => world[playerIdx] !== null);
        // Worlds with unknown may become duplicates
        this.removeDuplicateWorlds();
    }
}

// If you do not have a slice, use 'transformTradeByName()' instead
Multiverse.prototype.mwTransformExchange = function(source, target, tradedSlice)
{
    const s = this.getPlayerIndex(source);
    const t = this.getPlayerIndex(target);
    this.worlds = this.worlds.map(world =>
    {
        world[s] = this.sliceSubtract(world[s], tradedSlice);
        world[t] = this.sliceAdd(world[t], tradedSlice);
        world[s] = this.sliceUseUnknowns(world[s]);
        world[t] = this.sliceUseUnknowns(world[t]);
        return world;
    });
    this.worlds = this.worlds.filter( world =>
    {
        return world[s] !== null && world[t] !== null;
    });
    this.removeDuplicateWorlds(); // Worlds with unknown may become duplicates
}

// Incorporate player trade. Since each resource type goes in only one
// direction, we can not get additional information by doing them 1 by 1.
//
// Format: offer = {wood:1, brick: 0, sheep: 2, ...}. Same for demand.
// TODO: allow is unused now. was a sanity check
Multiverse.prototype.transformTradeByName = function(trader, other, offer, demand, allow=false)
{
    // Generate slice in perspective trader -> other
    const slice = this.sliceSubtract(this.asSlice(offer), this.asSlice(demand));
    this.mwTransformExchange(trader, other, slice);
}

// Branch for unknown resource transfer between two players.
// Note: For known "steals", treat as one-sided trade.
// @param deterministic  Set to 'true' if steal is not uniform random. This will
//                       suppress the bayesian update (replacing with uniform
//                       one).
// @param availableIndices  Specify which resources are available for stealing.
//                          Set to 'null' if all resources are available. This
//                          is meant for the "commercial harbor" progress card.
Multiverse.prototype.branchSteal = function(victimName, thiefName, deterministic, availableIndices = null)
{
    if (availableIndices === null)
    {
        availableIndices = Object.values(this.resourceIndices);
    }
    else
    {
        //debugger; // verify index restriction
        // Not technically required but intended use
        console.assert(deterministic === true);
    }
    let newWorlds = [];
    const victim = this.getPlayerIndex(victimName);
    const thief = this.getPlayerIndex(thiefName);
    for (const world of this.worlds)
    {
        const totalRes = this.sliceTotalIndices(world[victim], availableIndices);
        if (totalRes === 0)
            continue;// Impossible to steal => world dies
        for (const r of availableIndices)
        {
            if (world[victim][r] === 0)
                continue; // No resource of this type

            let w = deepCopy(world); // Keep original intact for next resource
            w[victim][r] -= 1;
            w[thief ][r] += 1;
            const thisRes = world[victim][r];
            if (deterministic === true) // Exception to the rule
                w["chance"] = world["chance"];
            else // Usual case
                w["chance"] = world["chance"] * thisRes / totalRes; // Unnormalized "bayes" update
            if (totalRes < thisRes) { alertIf(27); debugger; } // Sanity check
            newWorlds.push(w);
        }
    }
    this.worlds = newWorlds;

    // Stealing has uncertainty. Hence we create new worlds. Check duplicates.
    this.removeDuplicateWorlds();
}

// Implements a "commercial harbor" exchange, i.e., playerName gives a regular
// resource of their choice in exchange for a commodity of otherNames's choice.
Multiverse.prototype.branchHarbor = function(playerName, otherName)
{
    const commodityIndices = ["cloth", "coin", "paper", "unknown"].map(r => this.getResourceIndex(r));
    const regularResIndices = ["wood", "brick", "sheep", "wheat", "ore", "unknown"].map(r => this.getResourceIndex(r));

    // Since the steals are guaranteed to be different resources, we need not
    // collapse on availability beforehand.
    this.branchSteal(otherName, playerName, true, commodityIndices); // Obtain commodity
    this.branchSteal(playerName, otherName, true, regularResIndices); // Give regular

    this.removeDuplicateWorlds();
}

// Branches by moving, in all worlds, 0 to U from victims unknown cards to the
// thief's slice as stolen resource type. Where U is the number of unknown cards
// victim has. This is a helper to allow monopolies in recovery mode.
// @param max  Per-opponent stealing limit (for C&K).
Multiverse.prototype.mwBranchRecoveryMonopoly = function(victimIdx, thiefIdx, resourceIndex, max=19)
{
    // For binomial chance
    const p = 1 / this.resources.length;

    const unknowIndex = this.getResourceIndex("unknown");
    let newWorlds = [];
    for (const world of this.worlds)
    {
        const totalRes = this.sliceTotal(world[victimIdx]);
        const u = world[victimIdx][unknowIndex];
        for (let i = 0; i <= Math.min(u, max); ++i)
        {
            let w = deepCopy(world);
            w[victimIdx][unknowIndex] -= i;
            w[thiefIdx][resourceIndex] += i;
            // Binomial experiment: Assume unknown cards are either resource uniformly
            w["chance"] = world["chance"] * choose(u, i) * p**i * (1-p)**(u-i);
            newWorlds.push(w);
        }
    }
    const didBranch = this.worlds.length !== newWorlds.length;
    this.worlds = newWorlds;

    if (didBranch)
        this.removeDuplicateWorlds();
}

// Transform worlds by monopoly (branches in recovery mode!)
// @param max  Per-opponent stealing limit (for C&K).
Multiverse.prototype.transformMonopoly = function(thiefName, resourceIndex, max=19)
{
    const thiefIdx = this.getPlayerIndex(thiefName);
    this.worlds = this.worlds.map(world =>
    {
        // Total count may be difference in worlds because of recovery mode
        let totalCount = 0;
        // For simplicity includes thief as well
        //console.log("Monopoly world:", world); // debugging
        for (let p = 0; p < this.players.length; ++p)
        {
            const stolen = Math.min(world[p][resourceIndex], max);
            totalCount += stolen
            //console.log("Monopoly slice:", world[p], stolen); // debugging
            world[p][resourceIndex] -= stolen; // ❗
        }
        world[thiefIdx][resourceIndex] += totalCount;

        return world;
    });

    this.removeDuplicateWorlds();

    // Recovery mode branching
    for (const victimIdx of Object.values(this.playerIndices))
    {
        if (victimIdx === thiefIdx) continue;
        this.mwBranchRecoveryMonopoly(victimIdx, thiefIdx, resourceIndex, max);
    }
}

// Collapse worlds such that world <= slice element-wise.
// Does not influence later distribution of unknown cards, because I don't
// see how so.
// @param slice. Set count to 19 to allow any nubmer of cards. The game has
//               19 total of each resource type.
//               Set the unknown count to 19 * 5 = 95 to allow any number.
Multiverse.prototype.mwCollapseMax = function(playerName, slice)
{
    console.assert(!this.sliceHasNegative(slice), "Epecting non-negative slice in mwCollapseMax");
    // Unclear how unknowns would resolve
    if (slice[this.getResourceIndex("unknown")] !== 0)
    {
        console.error(`{this.mwCollapseMax.name}: Expecting non-unknown slice in mwCollapseMax. Got ${slice}`);
        alertIf("Cannot collapse unknown cards");
        return;
    }
    const pIdx = this.getPlayerIndex(playerName);
    this.worlds = this.worlds.filter(world =>
    {
        return world[pIdx].every((n, r) => n <= slice[r]);
    });
    // Recovery mode: Ignored. Does not break, but does not help either. The
    // difficulty is that we have currently no way of reserving unknown
    // cards for some resources only.
}

// Collapse to worlds where player has (at least) the content of 'slice' of
// each resource type. 'slice' must have only positive entries, only normal
// resources.
Multiverse.prototype.mwCollapseMin = function(playerName, slice)
{
    // Sanity check
    if (this.sliceHasNegative(slice))
    {
        console.error(`{this.mwCollapseMin.name}: Expecting non-negative slice in mwCollapseMin. Got ${slice}`);
        alertIf(37);
        return;
    }
    console.assert(slice[this.getResourceIndex("unknown")] === 0, "Argument 'slice' must not contain unknown cards");

    // debugging
    console.log(`Collapsing player ${playerName} to with at least this slice: ${slice}`);

    // Remove offending worlds
    this.mwTransformSpawn(playerName, this.sliceNegate(slice));
    // Restore original resources
    this.mwTransformSpawn(playerName, slice);
}

// Discard if 8 or more cards
Multiverse.prototype.mwCollapseMinTotal = function(playerName, count = 8)
{
    const playerIdx = this.getPlayerIndex(playerName);
    this.worlds = this.worlds.filter(world =>
    {
        return this.sliceTotal(world[playerIdx]) >= count;
    });
}

// Measure single resource of a player
//
// (!) Not part of recovery mechanism! Because not used for games.
// TODO make it part of recovery mechanism or remove.
// FIXME Do we need to deal with recovery here?
Multiverse.prototype.collapseExact = function(player, resourceIndex, count)
{
    console.error("Not implemented");
    debugger;
}

// Why: This function is used when revealing a single resource card from
// a uniform random event (known steal). Knwoing about the uniformness allows
// a bayesian update on the 'chance' of each world. Since players may reveal
// resources in ways that are not uniform random, this does not generally apply.
//
// When: After a known stela, first call this function to adjust the 'chance' of
// each world, then transfer the stolen resource using 'mwTransformExchance()'.
//
// What: Pretend a single resource of player 'playerName' was selected uniformly
// at random and the result was 'slice'. Adjust chances with bayesian update.
//
// How: First remove all inconsistent worlds. Then multiply unnormalized
// bayesian update to 'chance' of each world. The worlds are left unnormalized.
//
// TODO: Add test for this function.
// TODO: Rename to transformAsRandom (?)
Multiverse.prototype.collapseAsRandom = function(playerName, resourceIndex)
{
    console.assert(resourceIndex !== this.getResourceIndex("unknown"), "Bayes update is for known cards only");
    const playerIdx = this.getPlayerIndex(playerName);
    this.worlds = this.worlds.filter(world =>
    {
        return world[playerIdx][resourceIndex] !== 0;
    });

    this.worlds = this.worlds.map((world) =>
    {
        const total = this.sliceTotal(world[playerIdx]);
        const specific = world[playerIdx][resourceIndex];
        const bayesianUpdate = specific / total;
        world["chance"] = world["chance"] * bayesianUpdate;
        return world;
    });
}

// Called internally after branching operations
Multiverse.prototype.removeDuplicateWorlds = function()
{
    this.worlds = this.worlds.sort((w1, w2) =>
    {
        // Arbitrary sort order
        for (let p = 0; p < this.players.length; ++p)
        for (let r = 0; r < this.resources.length; ++r)
            if (w1[p][r] !== w2[p][r])
                return w1[p][r] < w2[p][r] ? -1 : 1;
        return 0;
    });

    // Keep unique worlds
    this.worlds = this.worlds.filter((item, pos, others) =>
    {
        if (pos === 0) { return true; }
        let other = others[pos-1];
        for (let p = 0; p < this.players.length; ++p)
        {
            if (!this.sliceEquals(item[p], other[p]))
                return true;
        }
        other["chance"] += item["chance"]; // TODO I hope this is legitimate
        return false;
    });
}

// Ensures that the world probabilities add to 1. Sum can decrese when
// impossible worlds are filterd out. If the worlds array is read out raw
// (e.g., from a log), the values might not be normalized. Usually, the call to
// mwUpdateStats() triggers normalization for display.
Multiverse.prototype.normalizeManyWorlds = function()
{
    let sum = this.worlds.reduce((sum, w) => sum + w["chance"], 0);
    this.worlds.forEach(world =>
    {
        world["chance"] = world["chance"] / sum;
    });
}

//------------------------------------------------------------
// Multiverse output access
//------------------------------------------------------------

// Generate
//  - Minimal resource distribution
//  - Maximal resource distribution
//  - Majority vote distribution
Multiverse.prototype.mwUpdateStats = function()
{
    this.normalizeManyWorlds();

    // This function has 3 stages:
    //  1) Fill stats objects with 0s
    //  2) Iterate worlds to accumulate stats
    //  3) Update secondary objects derived from those stats

    console.assert(this.worlds.length >= 1, `${this.mwUpdateStats.name}: Expected at least 1 world, got ${this.worlds.length}`);
    console.assert(this.players.length >= 1, `${this.mwUpdateStats.name}: Expected at least 1 player, got ${this.players.length}`);
    // 1 Player + chance ➜ 2 entries
    console.assert(Object.keys(this.worlds[0]).length >= 2, `${this.mwUpdateStats.name}: Expected at least 2 world entries, got ${Object.keys(this.worlds[0]).length}`);
    for (const player of this.players)
    {
        this.mwSteals[player] = deepCopy(this.zeroResourcesByName);
        this.mwBuildsProb[player] = deepCopy(this.costs);
        Object.keys(this.mwBuildsProb[player]).forEach(k => this.mwBuildsProb[player][k] = 0);
        this.mwDistribution[player] = {};
        for (const res of this.resources)
        {
            // At most 19 cards because there are only 19 cards per resource
            //  Accumulated chance of player having exactly 4 of this resource
            //                                       ~~~v~~~
            this.mwDistribution[player][res] = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
            // FIXME This allow up to 19 resources, but we might want to allow more for "unknown"
            //  ➜ an alternative would be to save indices explicitly:
            //      ❌ [0,0,0,1,4,2,1]
            //      ✅ {3:1, 4:4, 5:5, 1:0}
        }
    }

    // Count across all worlds
    this.worlds.forEach(w =>
    {
        for (const player of this.players)
        {
            const playerIdx = this.getPlayerIndex(player);
            const totalPlayerRes = this.sliceTotal(w[playerIdx]);
            for (const res of this.resources)
            {
                const resIndx = this.getResourceIndex(res);
                // For distribution
                const countInWorld = w[playerIdx][resIndx];
                // FIXME IF distr[][][] does not exist yet, this does not set it
                //       it it was set explicitly in that case we would
                //       automatically allow more than 19 resources. This is
                //       probably better than fixing size to 19 a priori
                this.mwDistribution[player][res][countInWorld] += w["chance"];
                // For steals
                if (countInWorld > 0)
                    this.mwSteals[player][res] += (countInWorld / totalPlayerRes) * w["chance"];
            }
            // For builds
            for (const [name, cost] of Object.entries(this.costs))
            {
                // 'costs' contains negative values
                const ifBought = this.sliceAdd(w[playerIdx], cost);
                if (!this.sliceHasNegative(ifBought))
                    this.mwBuildsProb[player][name] += w["chance"];
            }
        }
    });

    // Generate most "likely" suggestion
    // TODO Possibly add different statistics: Mean, mode, other percentiles
    for (const player of this.players)
    {
        for (const res of this.resources)
        {
            if (res === "unknown")
            {
//                debugger;
            }
            // Compute guess and range for this player-resource combo based on
            // the full statistics.
            let range = [19, 0, 0, 0]; // [ smallest_nonzero_index,
                                       //   max_chance, index_of_max_count
                                       //   largest_nonzero_index ]
            // FIXME mwDistribution goes until 19 only, but unknown cards might be more than 19
            let maxIndex = this.mwDistribution[player][res].reduce((r, val, idx) =>
            {
                if (val != 0) r[0] = Math.min(r[0], idx);
                if (val > r[1]) { r[1] = val; r[2] = idx; }
                if (val != 0) r[3] = Math.max(r[3], idx);
                return r;
            }, range);
            this.worldGuessAndRange[player][res] = range;
        }
    }
    // For total card stats (doesnt matter which world is used)
    // FIXME: It can matter in recovery mode
    this.mwTotals = this.generateFullNamesFromWorld(this.worlds[0]);
}

// Return manyworlds data in human readable notation instead of slices. Use
// this when you want to export the MW state.
Multiverse.prototype.mwHumanReadableWorld = function()
{
    let mwClone = Array(this.worlds.length);
    for (let i = 0; i < this.worlds.length; ++i)
    {
        mwClone[i] = {};
        mwClone[i]["chance"] = this.worlds[i]["chance"];
        for (let p = 0; p < this.players.length; ++p)
        {
            const name = this.getPlayerName(p);
            mwClone[i][name] = this.asNames(this.worlds[i][p]);
        }
    }
    return mwClone;
}

// Compare the state of 'this' with the state of 'manyWorlds'. Fail loudly when
// inconsistent.
// This is slow.
Multiverse.prototype.compareToManyworlds = function(manyWorlds)
{
    this.normalizeManyWorlds();
    manyWorlds.normalizeManyWorlds();
    const our = this.mwHumanReadableWorld();
    const their = manyWorlds.mwHumanReadableWorld();
    let matchingIndices = new Set();
    for (let i = 0; i < our.length; ++i)
    {
        // Slow
        const foundAt = their.findIndex(w => worldCompare(w, our[i]));
        matchingIndices.add(i);
        if (foundAt === -1)
        {
            console.warn(`${this.compareToManyworlds.name}: Inconsistency found`);
            debugger;
            return false;
        }
    }
    // Make sure each of our worlds matches a distinct world in theirs
    if (matchingIndices.size !== our.length)
    {
        console.warn(`${this.compareToManyworlds.name}: Inconsistency found`);
        debugger;
        return false;
    }
    return true;
}

// Compare two worlds in human readable format (used as shared format so we do
// not rely on internals from either).
// @return true if worlds are the same, false otherwise
function worldCompare(w1, w2)
{
    //debugger;
    if (Object.keys(w1).length !== Object.keys(w2).length)
        return false;

    // We can be quite forgiving with the chance since typical errors would have
    // drastic effects. And we place no attention on numerical accuracy.
    const chanceDiff = w1["chance"] - w2["chance"];
    if (Math.abs(chanceDiff) > 0.05)
        return false;

    for (const p of Object.keys(w1))
    {
        if (p == "chance")
            continue;
        if (sliceCompare(w1[p], w2[p]) === false)
            return false;
    }
    return true;
}

// Compares two slices in human readable format (used as shared format so we do
// not rely on internals from either).
// @return true if slices are the same, false otherwise
function sliceCompare(s1, s2)
{
    //debugger;
    if (Object.keys(s1).length !== Object.keys(s2).length)
        return false;
    for (const res of Object.keys(s1))
    {
        if (s1[res] !== s2[res])
            return false;
    }
    return true;
}

// vim: shiftwidth=4:softtabstop=4:expandtab
