"use strict";

// Shared basics
class MW
{
    constructor()
    {
        this.wood1  = 0x1 << (6 * 0);
        this.brick1 = 0x1 << (6 * 1);
        this.sheep1 = 0x1 << (6 * 2);
        this.wheat1 = 0x1 << (6 * 3);
        this.ore1   = 0x1 << (6 * 4);
        this.unknown1 = 0x1 << (6 * 5);
        // ❕Overflow indicator bits for wood, ..., ore. Not for: unknown
        this.loverflow1 = 0x20820820; // == 0b 00100000 10000010 00001000 00100000
        this.indices = {"wood":0, "brick":1, "sheep":2, "wheat":3, "ore":4, "unknown":5};
        // We reserve 9+1 bits for unknown resources (to allow higher values),
        // rest has 5+1 bit. resourceBase[6] is for shifting unknown resources
        // = 12) bit for unknown. That should remove all
        // TODO I think good would be to have 7+1 for each, reaching 48 of 52 bit in total.
        this.resourceBase = [this.wood1, this.brick1, this.sheep1, this.wheat1, this.ore1, this.unknown1, this.unknown1 * 512];
        this.woodMask  = 0x1F << (6 * 0);  // Wood-singular slice mask (1 bits in all wood spots)
        this.brickMask = 0x1F << (6 * 1);  // Small-enough bit ops here!
        this.sheepMask = 0x1F << (6 * 2);
        this.wheatMask = 0x1F << (6 * 3);
        this.oreMask   = 0x1F << (6 * 4);
        this.unknownMask = 0x1FF * 2**(6 * 5); // 9 bit value, 1 bit overflow
        this.resourceMask = {0:this.woodMask, 1:this.brickMask, 2:this.sheepMask, 3:this.wheatMask, 4:this.oreMask, 5:this.unknownMask};
        // TODO make wrapper that returns a copy
        this.emptyResourcesByName = {wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0};
        this.emptyResourcesByNameWithU = {wood:0, brick:0, sheep:0, wheat:0, ore:0, "unknown":0};
        // Maximum obtainable numbers, NOT maximum representable
        this.maxResourcesByNameWithU = {wood:19, brick:19, sheep:19, wheat:19, ore:19, "unknown":95};

        // Only normal resources
        this.mwUnitsSlice = this.wood1 + this.brick1 + this.sheep1 + this.wheat1 + this.ore1;
        this.mwRoadSlice = this.wood1 + this.brick1;
        this.mwSettlementSlice = this.wood1 + this.brick1 + this.sheep1 + this.wheat1;
        this.mwDevcardSlice = this.sheep1 + this.wheat1 + this.ore1;
        this.mwCitySlice = 2 * this.wheat1 + 3 * this.ore1;
        this.mwBuilds = {"road": this.mwRoadSlice, "settlement": this.mwSettlementSlice,
                          "devcard": this.mwDevcardSlice, "city": this.mwCitySlice};
    }

    worldResourceIndex(resourceName)
    {
        return this.indices[resourceName];
    }

    worldPlayerIndex(playerName)
    {
        // TODO I would guess that using integer indices for worlds would be
        // faster. Some places use the name directly so you would need to find all
        // places where a world is indexed without calling this function first.
        //
        // Eventually make this return 0 for player 0, 1 for player 1, ...
        return playerName;
    }

    sliceHasNegative(slice)
    {
        //      low bits overflow            unknown card overflow
        return ((slice & this.loverflow1) || (slice / this.resourceBase[6] < 0))
            ? true : false;
    }

    generateSingularSlice(oneResourceIndex, count = 1)
    {
        return count * this.resourceBase[oneResourceIndex];
    }

    // For non-negative slices
    getResourceCountOfSlice(slice, resIdx)
    {
        return Math.trunc( (slice % this.resourceBase[resIdx + 1])    // mask up
                         / this.resourceBase[resIdx]);                // shift
    }

    getSingularSlice(slice, resIdx)
    {
        return mw.getResourceCountOfSlice(slice, resIdx) * resourceBase[resIdx];
    }

    getResourceSumOfSlice(slice)
    {
        // TODO do we get problems if we unroll and only mask once at end?
        return mw.getResourceCountOfSlice(slice, 0)
             + mw.getResourceCountOfSlice(slice, 1)
             + mw.getResourceCountOfSlice(slice, 2)
             + mw.getResourceCountOfSlice(slice, 3)
             + mw.getResourceCountOfSlice(slice, 4)
             + mw.getResourceCountOfSlice(slice, 5);
    }

    // (!) Limits amount of unknown cards used per resource
    // TODO This is why recovery will could fail if a world with more unknown cards
    //      appears. Move to more bits, then swap 12 -> 19.
    //
    // Fixes slice using unknown cards. If succeeds, result is free negative
    // values. If impossible, result has a negative value.
    //
    // Algorithm to avoid intermediate zeros (we can only test for any-zero-values):
    //  1) Start with U many unknown cards.
    //  2) Spawn 12 extra cards to every normal resource. Any 0 left =>
    //     unrecoverable. No change to unknown cards!
    //  3) From all normal resources with N cards, transfer min(12, N) cards to
    //     unknown cards. This gives back the ghost cards if possible.
    //  4) Despawn 5 * 12 unknown cards. If negative => unrecoverable. Unknon cards
    //     left:
    //
    //      U + (60 - replaced) - 60 === U - replaced
    //
    // (!) Restrict to 12 cards to prevent normal resource overflow (19 + 12 == 31).
    // (!) If a player unbeknownst has more than 12 cards of a resource, the fix
    //     can fail identifying it. The easiest workaround for now is to how
    //     this is not the case, and re-enter recovery mode when something goes
    //     wrong.
    mwFixOrNegative(slice)
    {
        // Special case: No fix needed
        if (!mw.sliceHasNegative(slice)) return slice;

        // General case: fix by distributiong unknown cards
        let res = slice + 12 * mw.mwUnitsSlice;                              // 2
        for (let i = 0; i < 5; ++i) // TODO make resources iterable w/ and w/o unknown
    //    for (const [resName, i] of Object.entries(worldResourceIndexTable)) // 3
        {
            const tradeSlice = mw.unknown1 - mw.generateSingularSlice(i);
            res += Math.min(12, mw.getResourceCountOfSlice(res, i)) * tradeSlice;
        }
        res -= mw.generateSingularSlice(5) * (5 * 12);                         // 4
        return res; // Has negative if more unknown cards would be needede
    }

    // Takes [wood:0,brick:1,...] and outputs the corresponding slice
    generateFullSliceFromNames(resourcesByName)
    {
        // ❗For debugging because we recently mesed up here
        if (!resourcesByName.hasOwnProperty("unknown"))
        {
            console.error("resourcesByName does not have unknown");
            console.info("At this point, require it always better delete the other version");
            debugger;
        }

        let slice = 0;
        for (const res of [...resourceTypes, "unknown"])
        {
            slice += mw.generateSingularSlice(
                mw.worldResourceIndex(res),    // index 0 for wood, 1 for brick, ...
                resourcesByName[res]);      // count, as given my argument
        }
        return slice;
    }

    // Probably only want to use this for reading from outside
    generateFullNamesFromSlice(slice)
    {
        let res = deepCopy(mw.emptyResourcesByName);
        for (const r of resourceTypes)
        {
            res[r] = mw.getResourceCountOfSlice(slice, mw.worldResourceIndex(r));
        }
        res["unknown"] = mw.getResourceCountOfSlice(slice, 5);
        return res;
    }

    generateFullNamesFromWorld(world)
    {
        let sum = 0;
        for (const player of Object.keys(world))
    //    for (let i = 0; i < players.length; ++i)
        {
            // TODO Treat chance separate to players, outside of the world object
            if (player === "chance") continue;
            sum += world[player];
        }
        return mw.generateFullNamesFromSlice(sum);
    }

    // res = {ore: "1", wheat: "2", ...}
    // Can handle "unknown" and missing "unknown" cards
    generateWorldSlice(res)
    {
        let slice = 0;
        for (const [r, count] of Object.entries(res))
        {
            slice += mw.generateSingularSlice(mw.worldResourceIndex(r), count);
        }
    //    log2("Generated world slice from resources:", res, "|", slice);
        return slice;
    }

    // FIXME I think this is not used anywhere (?) should it be?
    worldHasNegativeSlice(playerNames, world)
    {
        for (const player of playerNames)
        {
            if (mw.sliceHasNegative(world[player]))
                return true;
        }
        return false;
    }

    // Return [matched_slice, addedResources]
    // TODO Used anywhere? No. Remove. Probably buggy, too
    mwGenerateMatchingSlice(slice, minimum)
    {
        let ret = 0;
        // Iterate mwResourceIndices
        for (let i = 0; i < 5; ++i)
    //    for (const [res, i] of Object.entries(worldResourceIndexTable))
    //    for (const i of worldResourceIndexTable)
        {
            // Use slices (not counts!)
            // TODO use count and remove getSlice helper
            const has = getSingularSlice(slice, i);
            const needs = getSingularSlice(minimum, i);
            ret += Math.min(has, needs);
        }
        return [ret, ret - slice];
    }

    mwHumanReadableToMwFormat(humanReadableMw, players = this.playerNames)
    {
        let constructedMw = [];
        for(let i = 0; i < humanReadableMw.length; ++i)
        {
            constructedMw[i] = {};
            for (const player of players)
            {
    //            debugger;
                constructedMw[i][player] = mw.generateFullSliceFromNames(
                    humanReadableMw[i][player]);
            }
            constructedMw[i]["chance"] = humanReadableMw[i]["chance"];
        }
        return constructedMw;
    }

    // Fixes world using unknown cards (returning true) or returns false. Use to
    // filter worlds in recovery. When false is returned, the world is unchanged.
    mwFixOrFalse(world, playerIdx)
    {
        // Skip fix attemt if no special case (likely)
        const s = world[playerIdx];
        if (mw.getResourceCountOfSlice(s, 5) === 0)
            return !mw.sliceHasNegative(s);
        const fixAttempt = mwFixOrNegative(s);
        if (mw.sliceHasNegative(fixAttempt))
        {
            // Fix failed
            return false;
        }
        else
        {
            // Fix succeeded
            const usedUnknown = mw.getResourceCountOfSlice(world[playerIdx], 5);   // TODO replace raw number with table lookup (?)
            logs(`[NOTE] Using ${usedUnknown} unknown cards to fix world for player ${playerIdx}`);
            world[playerIdx] = fixAttempt;
            return true;
        }
    }

    // Fixes world using unknown cards. Fix here means to ensure non-negative
    // values.
    // Returns [fixSucceeded, slice]. If the first element is true, then the
    // second element is the fixed slice. Else no guarantees.
    mwFixOrFalseSlice(slice)
    {
        // Skip fix attempt if not in recovery mode (i.e., no unknown cards)
        if (mw.getResourceCountOfSlice(slice, 5) === 0) // likely
            return [!mw.sliceHasNegative(slice), slice];
        const fixAttempt = mwFixOrNegative(slice);
        if (mw.sliceHasNegative(fixAttempt))
            return [false, null]; // Fix failed
        else
            return [true, fixAttempt]; // Fix succeeded
    }


}

const mw = new MW();

class ManyWorlds
{
    constructor()
    {
        // Tracked worlds
        this.manyWorlds = [];
        this.playerNames = [];

        // Manually updated objects returned by getters:

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

        // TODO These are useless helpers that recover the new interface that
        // 'Render' expects for the new tracker.
        {
            // Eventually, rename mwBuilds to 'costs' instead.
            this.costs = mw.mwBuilds
            // TODO rename
            this.resources = [...resourceTypes, "unknown"];
        }
    }

    worldCount()
    {
        return this.manyWorlds.length;
    }

    printWorlds()
    {
        if (configPrintWorlds === false)
            return;
        log2("🌎 ManyWorlds:", this.manyWorlds);
        if (this.manyWorlds.length === 0)
            console.log("🌎 No worlds left!");
        for (let i = 0; i < this.manyWorlds.length; ++i)
        {
            log(`\t----- ${i}/${this.manyWorlds.length}: ${this.manyWorlds[i]["chance"]} -----`);
            for (const pl of this.playerNames)
            {
                log(`\t\t[${i}][${pl}] =`, mw.generateFullNamesFromSlice(this.manyWorlds[i][pl]));
            }
        }
    }

    // Starts recovery mode
    // Input: counts === { "alice": 5, ... } the total number of (unknown) cards
    mwCardRecovery(counts)
    {
        let world = {};
        for(const [player, count] of Object.entries(counts))
        {
            world[mw.worldPlayerIndex(player)] = mw.generateSingularSlice(5, counts[player]);
        }
        world["chance"] = 1;
        this.manyWorlds = [world];
        console.debug("🌎 Starting MW recovery mode");
        //console.debug(this.manyWorlds);
        this.printWorlds();
    }

    // Requires existing users array. Some stats objects are pre-filled with the
    // names and they keep them always.
    // @param startingResources: { "alice": {"wood": 5, ...}, ... }, can handle
    //                           U as well as noU.
    initWorlds(startingResources)
    {
        // Init only once
        if (this.manyWorlds.length !== 0)
        {
            console.warn("Initializing manyWorlds over non-empty manyWorlds array!");
        }

        this.playerNames = deepCopy(Object.keys(startingResources));

        // TODO make worlds a arrays (is that faster in JS? lol)
        let world = {};
        for (const [name, resources] of Object.entries(startingResources))
        {
            // Generate world slice for player p
            world[mw.worldPlayerIndex(name)] = mw.generateWorldSlice(resources);
        }
        world["chance"] = 1;    // TODO This assumes no player is named "chance"
        this.manyWorlds = [world];

        // Init output object
        this.worldGuessAndRange = {};
        for (const name of Object.keys(startingResources))
        {
            this.worldGuessAndRange[name] = {};
        }
        //logs("[NOTE] Initialized resource tracking", (startingResources === null ?
        //     "from no cards" : "from starting cards"));
        this.printWorlds();
    }

    // Specializes mwWeightGuessPredicate() for the exact count case.
    // ❕ This specialization may branch in recovery mode by using unknown cards to
    // reach the exact count when possible.
    mwWeightGuessExact(playerName, resourceIndex, count)
    {
        const resourceName = resourceTypes[resourceIndex];
        const icon = resourceIcons[resourceName];
        log(`[INFO] Guess (exact): ${playerName}[${icon}] = ${count}`);
        const playerIdx = mw.worldPlayerIndex(playerName);
        const factor = 100; // Arbitrary large value

        let didBranch = false;
        let newWorlds = []; // Avoid appending to 'manyWorlds' while iterating
        this.manyWorlds.forEach(world =>
        {
            const availableCount = mw.getResourceCountOfSlice(world[playerIdx], resourceIndex);
            const debt = count - availableCount;
            const unknownCount = mw.getResourceCountOfSlice(world[playerIdx], 5);
            // Boost matching worlds
            if (debt === 0)
            {
                world["chance"] *= factor;
            }

            // Branch possible recoveries explicitly
            else if (0 < debt && debt <= unknownCount)
            {
                let w = deepCopy(world);
                const adjustment = ( mw.generateSingularSlice(resourceIndex)
                                   - mw.generateSingularSlice(5) )
                                 * debt;
                w[playerIdx] = mw.mwFixOrNegative(w[playerIdx] + adjustment);
                if (!mw.sliceHasNegative(w[playerIdx]))
                {
                    w["chance"] *= factor;
                    newWorlds.push(w);
                    didBranch = true;
                }
                else
                {
                    console.error("Unreachable");
                    debugger;
                }
            }
        });

        // When recovery branching generates new worlds, check for duplicates
        if (didBranch)
        {
            this.manyWorlds = this.manyWorlds.concat(newWorlds); // is there an in place version of this?
            this.removeDuplicateWorlds();
        }

        // Since we adjust chances in a one-sided way we need to make them sum to 1
        this.normalizeManyWorlds();
    }

    // Transform worlds by significantly increasing the 'chance' of worlds where
    // a single resource count fulfils a unary predicate.
    // The effect is cosmetic only in the sense that the 'chance' is only used for
    // display purposes. It does not strictly rule out worlds. If the guess is
    // identified as impossible, changes revert automatically (up to numerics).
    // Does not meddle with unknown cards because it is unclear how to do so in the
    // general case.
    mwWeightGuessPredicate(playerName, resourceIndex, predicate, name = "predicate")
    {
        const resourceName = resourceTypes[resourceIndex];
        const icon = resourceIcons[resourceName];
        log(`[INFO] Guess: ${playerName}[${icon}] ${name}`);
        const playerIdx = mw.worldPlayerIndex(playerName);
        const factor = 100; // Arbitrary large value

        this.manyWorlds.forEach(world =>
        {
            const availableCount = mw.getResourceCountOfSlice(world[playerIdx], resourceIndex);
            if (predicate(availableCount))
            {
                // Regular effect: reduce chance of mismatching world, so the max
                // likelihood displayed will match the guess.
                world["chance"] *= factor;
            }
        });
    }


    // Boost worlds where the player 'playerName' does not have the resources given
    // in 'resourceSlice'.
    // • resourceSlice: Typically one of the 'mwBuilds' slices
    // Recovery mode: Apply bonus if amount of unknown cards is too small. No
    // changes if sufficient unknown cards.
    mwWeightGuessNotavailable(playerName, resourceSlice)
    {
        const playerIdx = mw.worldPlayerIndex(playerName);
        const factor = 100; // Arbitrary large value
        let didBranch = false;
        let newWorlds = [] // Avoid appending to 'manyWorlds' while iterating
        this.manyWorlds.forEach(world =>
        {
            const adjustedSlice = world[playerIdx] - resourceSlice;
            const [worked, slice] = mw.mwFixOrFalseSlice(adjustedSlice);
            if (!worked)
                world["chance"] *= factor;
        });
    }

    // Handle unilaterate resource changes like building, YOP, or city profits
    mwTransformSpawn(playerName, resourceSlice)
    {
        const playerIdx = mw.worldPlayerIndex(playerName);
        this.manyWorlds = this.manyWorlds.map(world =>
        {
            let tmp = world;    // I think no copy needed (?)
            tmp[playerIdx] += resourceSlice;
            return tmp;
        });

        // Only if we remove something can we end up negative
        if (mw.sliceHasNegative(resourceSlice))
        {
            // TODO Only if recover = on
            this.manyWorlds = this.manyWorlds.map(world =>
            {
                world[playerIdx] = mw.mwFixOrNegative(world[playerIdx]);
                return world;
            });
            this.manyWorlds = this.manyWorlds.filter(world =>
            {
                return !mw.sliceHasNegative(world[playerIdx]);
            });
        }
    }

    // If you do not have a slice, use 'transformTradeByName()' instead
    transformExchange(source, target, tradedSlice)
    {
        const s = mw.worldPlayerIndex(source);
        const t = mw.worldPlayerIndex(target);
        this.manyWorlds = this.manyWorlds.map(world =>
        {
            let tmp = deepCopy(world); // TODO Do we need to duplicate here?
            tmp[source] -= tradedSlice;
            tmp[target] += tradedSlice;
            return tmp;
        });
        this.manyWorlds = this.manyWorlds.map(world =>
        {
            let tmp = world;    // Copy needed (?)
            tmp[s] = mw.mwFixOrNegative(tmp[s]);
            tmp[t] = mw.mwFixOrNegative(tmp[t]);
            return tmp;
        });
        this.manyWorlds = this.manyWorlds.filter( world =>
        {
            // TODO Only if slice (or -slice) have negatives
            return !mw.sliceHasNegative(world[source])
                && !mw.sliceHasNegative(world[target]);
        });
    }

    // Incorporate player trade. Since each resource type goes in only one
    // direction, we can not get additional information by doing them 1 by 1.
    //
    // Format: offer = [wood:1, brick: 0, sheep: 2, ...]. Same for demand.
    transformTradeByName(trader, other, offer, demand, allow=false)
    {
        // Generate slice in perspective trader -> other
        let slice = mw.generateFullSliceFromNames(offer);
        slice    -= mw.generateFullSliceFromNames(demand);

        // Sanity check
        if (!allow)
        if (!mw.sliceHasNegative(slice) || !mw.sliceHasNegative(-slice))
        {
            console.error("Trades must be bidirectional");
            alertIf(23);
            debugger;
            return;
        }

        this.transformExchange(trader, other, slice);
    }

    // Branch for unknown resource transfer between two players.
    // Note: For known "steals", treat as one-sided trade.
    branchSteal(victim, thief)
    {
        let newWorlds = [];

        // For all existing worlds, create up to 5 new worlds, where each one of
        // the resources was stolen.
        for (const world of this.manyWorlds)
        {
            const totalRes = mw.getResourceSumOfSlice(world[victim]);
            if (totalRes === 0) continue;   // Impossible to steal => world dies
            for (let r = 0; r < resourceTypes.length; ++r)  // TODO How to iterate easier?
            {
                let w = deepCopy(world);
                const slice = mw.generateSingularSlice(r, 1);
                w[victim] -= slice;
                // Do not create negative-card worlds
                if (mw.sliceHasNegative(w[victim])) continue;
                w[thief] += slice;

                // Use slice in old (!) world to generate steal chance
                let thisRes = mw.getResourceCountOfSlice(world[victim], r);
                w["chance"] = world["chance"] * thisRes / totalRes;
                if (totalRes < thisRes) { alertIf(27); debugger; } // Sanity check
                newWorlds.push(w);
            }
            // TODO Only in recovery mode
            // TODO Iterate in loop above?
            const u = mw.getResourceCountOfSlice(world[victim], 5);
            if (u > 0) // Add steal of 'unknown' card (index 5)
            {
                let w = deepCopy(world);
                const slice = mw.generateSingularSlice(5);
                w[victim] -= slice;
                w[thief] += slice;
                w["chance"] = world["chance"] * u / totalRes;
                newWorlds.push(w);
            }
        }
        this.manyWorlds = newWorlds;

        // Stealing has uncertainty. Hence we create new worlds. Check duplicates.
        this.removeDuplicateWorlds();
    }

    // Branches by moving, in all worlds, 0 to U from victims unknown cards to the
    // tolen resource. Where U is the number of unknown cards victim has.
    // This is a helper to allow monopolies in recovery mode.
    mwBranchRecoveryMonopoly(victimIdx, thiefIdx, resourceIndex)
    {
        // Similar to branchSteal()

        let newWorlds = [];

        // For all existing worlds, create up to 5 new worlds, where each one of
        // the resources was stolen.
        for (const world of this.manyWorlds)
        {
            const totalRes = mw.getResourceSumOfSlice(world[victimIdx]);
            const u = mw.getResourceCountOfSlice(world[victimIdx], 5);

            const steal = mw.generateSingularSlice(5);
            const take = mw.generateSingularSlice(resourceIndex);
            for (let i = 0; i <= u; ++i)
            {
                let w = deepCopy(world);
                w[victimIdx] -= steal * i;
                w[thiefIdx] += take * i;
                // Binomial experiment
                w["chance"] = world["chance"] * choose(u, i) * 0.2**i * 0.8**(u-i);
                newWorlds.push(w);
            }
        }
        this.manyWorlds = newWorlds;

        // Check duplicates after branching recovery monopoly
        this.removeDuplicateWorlds();
    }

    // Transform worlds by monopoly (branches in recovery mode!)
    transformMonopoly(thiefName, resourceIndex)
    {
        const thiefIdx = mw.worldPlayerIndex(thiefName);
        // TODO Store world chance outside of world. Makes iterating better
        this.manyWorlds = this.manyWorlds.map( world =>
        {
            // Determine mono count
            let totalCount = 0;
            for (const player of this.playerNames)   // Not for the "chance" entry
            {
                const n = mw.getResourceCountOfSlice(world[player], resourceIndex);
                totalCount += n;
                world[player] -= mw.generateSingularSlice(resourceIndex, n);
            }
    //        log("total count in this world is:", totalCount,
    //            "(should be same in all worlds: expenses are public)");

            // Give cards to thief
            world[thiefIdx] += mw.generateSingularSlice(resourceIndex, totalCount);

            return world;
        });

        this.removeDuplicateWorlds();

        // TODO Collapse based on monopolied number of cards for recovery

        // Recovery mode branching
        for (const victim of this.playerNames)
        {
            const victimIdx = mw.worldPlayerIndex(victim);
            if (victimIdx === thiefIdx) continue;
            this.mwBranchRecoveryMonopoly(victimIdx, thiefIdx, resourceIndex);
        }
    }

    // Collapse worlds such that world <= slice element-wise.
    // Does not influence later distribution of unknown cards, because I don't
    // see how so.
    // @param slice. Set count to 19 to allow any nubmer of cards. The game has
    //               19 total of each resource type.
    //               Set the unknown count to 19 * 5 = 95 to allow any number.
    mwCollapseMax(player, slice)
    {
        console.assert(!mw.sliceHasNegative(slice), "Epecting non-negative slice in mwCollapseMax");
        const pIdx = mw.worldPlayerIndex(player);
        // Subtract testSlice-world. If the result has negatives, then the world
        // has too many, and is excluded.
        this.manyWorlds = this.manyWorlds.filter(world =>
        {
            const test = slice - world[pIdx];
            return !mw.sliceHasNegative(test);
        });
        // Recovery mode: Ignored. Does not break, but does not help either. The
        // difficulty is that we have currently no way of reserving unknown
        // cards for some resources only.
    }

    // Collapse to worlds where player has (at least) the content of 'slice' of
    // each resource type. 'slice' must have only positive entries, only normal
    // resources.
    mwCollapseMin(player, slice)
    {
        // Sanity check
        if (mw.sliceHasNegative(slice))
        {
            alertIf(37);
            console.error("[ERROR] mwCollapseMin mut take positive slices");
            return;
        }

        // Generate as-if stolen worlds (to filter)
        const pIdx = mw.worldPlayerIndex(player);
        this.manyWorlds = this.manyWorlds.map(world =>
        {
            let tmp = world;
            tmp[pIdx] = mw.mwFixOrNegative(tmp[pIdx] - slice);
            return tmp;
        });
        this.manyWorlds = this.manyWorlds.filter(world =>
        {
            // For recovery, also try if enough when including unknown cards
            return !mw.sliceHasNegative(world[player]);
        });

        // Give back to obtain unalterd worlds that survive hypothetical steal
        this.mwTransformSpawn(player, slice);
    }

    // Discard if 8 or more cards
    mwCollapseMinTotal(player, count = 8)
    {
        this.manyWorlds = this.manyWorlds.filter(world =>
        {
            // No recovery needed since card count is known in each world
            return mw.getResourceSumOfSlice(world[player]) >= count;
        });
    }

    // Measure single resource of a player
    //
    // (!) Not part of recovery mechanism! Because not used for games.
    // TODO make it part of recovery mechanism or remove.
    // FIXME DO we need to deal with recovery here?
    collapseExact(player, resourceIndex, count)
    {
        this.manyWorlds = this.manyWorlds.filter((world) =>
        {
            if (    mw.getSingularSlice(world[player], resourceIndex)   // Actual count
                !== mw.generateSingularSlice(resourceIndex, count))     // Expectation
            {
                return false;
            }
            return true;
        });
    }

    // Why: This function is used when revealing a single resource card from
    // a uniform random event (known steal). Knwoing about the uniformness
    // allows a bayesian update on the 'chance' of each world. Since player may
    // reveal resources in ways that are no uniform random, this does not
    // generally apply.
    //
    // When: After a known stela, first call this function to adjust the
    // 'chance' of each world, then transfer the stolen resource using
    // 'transformExchance()'.
    //
    // What: Pretend a single resource of player 'playerName' was selected
    // uniformly at random and the result was 'slice'. Adjust chances with
    // bayesian update.
    //
    // How: First remove all inconsistent worlds. Then multiply unnormalized
    // bayesian update to 'chance' of each world. The worlds are left
    // unnormalized.
    //
    // TODO: Add test for this function.
    collapseAsRandom(playerName, resourceIndex)
    {
        const slice = mw.generateSingularSlice(resourceIndex);
        this.mwCollapseMin(playerName, slice);

        //console.debug("Before collapse:", this.mwHumanReadableWorld());
        const playerIdx = mw.worldPlayerIndex(playerName);
        this.manyWorlds = this.manyWorlds.map((world) =>
        {
            const totalResourceCount = mw.getResourceSumOfSlice(world[playerIdx]);
            const specificCount = mw.getResourceCountOfSlice(world[playerIdx], resourceIndex);
            // No need to normalize updates because all worlds get updated
            const bayesianUpdate = specificCount / totalResourceCount;
            world["chance"] = world["chance"] * bayesianUpdate;
            return world;
        });
        //console.debug("After collapse:", this.mwHumanReadableWorld());
    }

    // Called internally after branching operations
    removeDuplicateWorlds()
    {
        this.manyWorlds = this.manyWorlds.sort((w1, w2) =>
        {
            // TODO This loop works? Replace with for of Object.keys()
            for (let p in w1)
            {
                if (w1[p] !== w2[p]) return w1[p] < w2[p] ? -1 : 1;
            }
            return 0;
        }).filter((item, pos, others) =>
        {
            // Keep unique worlds
            if (pos === 0) { return true; }
            let other = others[pos-1];
            for (let p of this.playerNames)
            {
                if (item[p] !== other[p])    // Compare full slices in one go
                    return true;
            }
            other["chance"] += item["chance"]; // TODO I hope this is legitimate
            return false;
        });
    }

    // Ensures that the world probabilities add to 1. Sum can decrese when
    // impossible worlds are filterd out. If the manyWorlds array is read out raw
    // (e.g., from a log), the values might not be normalized. Usually, the call to
    // mwUpdateStats() triggers normalization for display.
    normalizeManyWorlds() // TODO prefix with 'mw'?
    {
        let sum = this.manyWorlds.reduce((sum, w) => sum + w["chance"], 0);
        this.manyWorlds.forEach(world =>
        {
            world["chance"] = world["chance"] / sum;
        });
    }

    //------------------------------------------------------------
    // ManyWorlds getter
    //------------------------------------------------------------

    // Generate
    //  - Minimal resource distribution
    //  - Maximal resource distribution
    //  - Majority vote distribution
    // At the moment has to be used with filled players and manyWorlds variables.
    mwUpdateStats()
    {
        this.normalizeManyWorlds();

        // This function has 3 stages:
        //  1) Fill stats objects with 0s
        //  2) Iterate worlds to accumulate stats
        //  3) Update secondary objects derived from those stats

        console.assert(this.manyWorlds.length >= 1);

        // Set assert to > 0 when allowing non-4-player games eventually
        // expect 4 players + chance entry
        console.assert(Object.keys(this.manyWorlds[0]).length == 5);
        console.assert(this.playerNames.length == 4);
        if (Object.keys(this.manyWorlds[0]).length !== 5)
        {
            console.error("Not 4-player game");
            console.trace(this.manyWorlds[0]);
        }
        for (const player of this.playerNames)
        {
            this.mwSteals[player] = deepCopy(mw.emptyResourcesByNameWithU);
            this.mwBuildsProb[player] = deepCopy(mw.mwBuilds);
            Object.keys(this.mwBuildsProb[player]).forEach(k => this.mwBuildsProb[player][k] = 0);
            this.mwDistribution[player] = {};
            for (const res of [...resourceTypes, "unknown"])
            {
                // At most 19 cards because there are only 19 cards per resource
                //  Accumulated chance of player having exactly 4 of this resource
                //                                ~~~v~~~
                this.mwDistribution[player][res] = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
            }
        }

        // Count across all worlds
        // TODO Include unknown resources
        this.manyWorlds.forEach(w =>
        {
            for (const player of this.playerNames)
            {
                const totalPlayerRes = mw.getResourceSumOfSlice(w[mw.worldPlayerIndex(player)]);
                for (const res of [...resourceTypes, "unknown"])
                {
                    // For distribution
                    const countInWorld = mw.getResourceCountOfSlice(
                        w[mw.worldPlayerIndex(player)],
                        mw.worldResourceIndex(res));   // Helper uses indices
                    this.mwDistribution[player][res][countInWorld] += w["chance"];
                    // For steals
                    if (countInWorld > 0)
                        this.mwSteals[player][res] += (countInWorld / totalPlayerRes) * w["chance"];
                }
                // For builds
                for (const [name, slice] of Object.entries(mw.mwBuilds))
                {
                    if (!mw.sliceHasNegative(w[mw.worldPlayerIndex(player)] - slice))
                        this.mwBuildsProb[player][name] += w["chance"];
                }
            }
        });

        // Generate most "likely" suggestion
        // TODO Possibly add different statistics: Mean, mode, other percentiles
        for (const player of this.playerNames)
        {
            for (const res of [...resourceTypes, "unknown"])
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
        this.mwTotals = mw.generateFullNamesFromWorld(this.manyWorlds[0]);
    //    log2("Generated guess and range", this.worldGuessAndRange);
    }

    //------------------------------------------------------------
    // ManyWorlds test
    //------------------------------------------------------------

    worldTest()
    {
        // Set dummy players array for tests
        const players = ["A", "B", "C", "D"];

        // Test 1: Correlation
        //  1) Both A and B have a rod and get stolen from once by C
        //  2) i.e., C stole 2 unknown road materials
        //  3) D steals the resource C initially took from A (by stealing inbetween
        //     C's steals)
        //  4) Revealing D's card reveals A's card: the two cards match to form A's
        //     starting road
        // If correlation was missing, revealing D's card would not
        // collapse the hand of A: If we ignore order of stealing, any card
        // D revelas could have been obtained from the alternative source B.
        log("----------------- MW Test 1 --------------------");
        let resources = { "A": {wood:1,brick:1,sheep:0,wheat:0,ore:0}, // road
                          "B": {wood:1,brick:1,sheep:0,wheat:0,ore:0}, // road
                          "C": {wood:0,brick:0,sheep:0,wheat:0,ore:0}, // thief
                          "D": {wood:0,brick:0,sheep:0,wheat:0,ore:0}, }; // measurement
        this.initWorlds(resources);
        log("before any steal"); this.printWorlds();
        this.branchSteal("A", "C");
        log("after first steal"); this.printWorlds();
        this.branchSteal("C", "D");  // Measure first steal later on
        log("after second (measurement) steal"); this.printWorlds();
        this.branchSteal("B", "C");
        log("after third (confusion) steal"); this.printWorlds();
        this.collapseExact("D", mw.worldResourceIndex(wood), 1);    // Measure first steal A -> C
        log("after exact measurement collapse (should leave only 1 option for A, 2 worlds total)"); this.printWorlds();

        let passedTest = true;
        if (this.manyWorlds.length !== 2)
        {
            passedTest = false;
            log("[ERROR] Failed ManyWorlds test1: world count failed");
            alertIf(20);
            debugger;
        }
        if (   this.manyWorlds[0]["A"] !== 64
            || this.manyWorlds[1]["A"] !== 64)
        {
            passedTest = false;
            log("[ERROR] Failed ManyWorlds test1: resources failed");
            alertIf(21);
            debugger;
        }
        this.mwUpdateStats();
        if (passedTest === true)
        {
            log("[NOTE] ManyWorlds test1 passed");
        }

        // Test2: Duplicate removal.
        //  1) A has stuff.
        //  2) B steals everything.
        //  3) Only 1 world should be left, regardless of order.
        if (false)  // Obsolete now that branchSteal does this always
        {
            log("------------------------ MW test 2 -------------------------");
            resources = { "A": {wood:1,brick:1,sheep:0,wheat:0,ore:0},  // Stuff
                          "B": {wood:0,brick:0,sheep:0,wheat:0,ore:0},  // Empty
                          "C": {wood:0,brick:0,sheep:0,wheat:0,ore:0},
                          "D": {wood:0,brick:0,sheep:0,wheat:0,ore:0}, };
            this.initWorlds(resources);
            log("before any steal"); this.printWorlds();
            this.branchSteal("A", "B");
            log("after first steal"); this.printWorlds();
            this.branchSteal("A", "B");
            log("after second steal (should have 2 worls left before unduplicating worlds)");
            this.printWorlds();
            this.removeDuplicateWorlds();
            log("After duplicate removal (should have only 1 world left"); this.printWorlds();
            logs("again as string:", this.manyWorlds);
            this.mwUpdateStats();

            if (this.manyWorlds.length !== 1)
            {
                log("[ERROR] Failed ManyWorlds test2: duplicate removal failed");
                alertIf(22);
                debugger;
            }
            else
            {
                log("[NOTE] ManyWorlds test2 passed");
            }
        }

        // Test 3: Trading and monobranching
        //  1) Player A starts with a road. B with a brick only. C with a wood as
        //     dummy.
        //  2) Player B steals from A
        //  3) - We verify that there are 2 worlds
        //  4) B trades brick to C (wood as dummy
        //  5) - We verify that the same 2 worlds evolved to provide C with brick
        //  6) B trades another wood to C. This collapses to 1 world.
        log("--------------------- MW Test 3 ---------------------");
        resources = { "A": {wood:1,brick:1,sheep:0,wheat:0,ore:0},  // unknown
                      "B": {wood:0,brick:1,sheep:0,wheat:0,ore:0},  // Masking
                      "C": {wood:2,brick:0,sheep:0,wheat:0,ore:0},  // Dummy for trading
                      "D": {wood:0,brick:0,sheep:0,wheat:0,ore:0} };
        this.initWorlds(resources);
        log("before anything"); this.printWorlds();
        logs(this.manyWorlds);
        this.branchSteal("A", "B");
        log("after steal. should have 2 worlds now"); this.printWorlds();
        const offer  = {wood:0, brick:1, sheep:0, wheat:0, ore:0, "unknown": 0};
        const demand = {wood:1, brick:0, sheep:0, wheat:0, ore:0, "unknown": 0};
        this.transformTradeByName("B", "C", offer, demand);
        log("after first trade (should have 2 different worlds stile)"); this.printWorlds();
        this.transformTradeByName("B", "C", offer, demand);
        log("after second trade (should have collapsed to 1 world)"); this.printWorlds();
        logs("again as string:", this.manyWorlds);

        if (this.manyWorlds.length !== 1)
        {
            log("[ERROR] Failed ManyWorlds test3: trading and monobranching");
            alertIf(24);
            debugger;
            // TODO Could test resulting manyWorlds state completely, rather than
            //      just world count.
        }
        else
        {
            log("[NOTE] ManyWorlds test3 passed");
        }

        // Test 4: Monos
        //  1) Player A starts with a road.
        //  2) Player B steals from A.
        //  3) Player C monos all wood.
        //  4)  - Verify that all live states have wood at player C
        log("----------------------- MW TEST 4 -------------------------------");
        resources = { "A": {wood:1,brick:1,sheep:0,wheat:0,ore:0},  // unknown
                      "B": {wood:0,brick:0,sheep:0,wheat:0,ore:0},  // Masking
                      "C": {wood:0,brick:0,sheep:0,wheat:0,ore:0},  // Dummy for trading
                      "D": {wood:1,brick:0,sheep:0,wheat:0,ore:0} };
        this.initWorlds(resources);
        log("before anything"); this.printWorlds();
        logs(this.manyWorlds);
        this.branchSteal("A", "B");
        log("after steal. A and B add to a road. D has a wood."); this.printWorlds();
        logs(this.manyWorlds);
        this.transformMonopoly("C", mw.worldResourceIndex(wood));
        log("after monopoly. either B or A have a brick, C has 2 wood."); this.printWorlds();
        logs(this.manyWorlds);
        this.mwUpdateStats();
        this.collapseExact("B", mw.worldResourceIndex(brick), 0);
        log("After measuring B's brick, A has the brick, B nothing, C has 2 wood."); this.printWorlds();
        logs("again as string:", this.manyWorlds);
        this.mwUpdateStats();

        if (  this.manyWorlds.length  !== 1
           || this.manyWorlds[0]["C"] !== 2
           || this.manyWorlds[0]["B"] !== 0
           || this.manyWorlds[0]["A"] !== 64)
        {
            log("[ERROR] Failed ManyWorlds test4: monopoly");
            alertIf(25);
            debugger;
        }
        else
        {
            log("[NOTE] ManyWorlds test4 (monopoly) passed");
        }

        // Test 4.5: Pre-guess
        log("----------------------- MW TEST 4.5 -------------------------------");
        passedTest = true;
        resources = { "A": {wood:10,brick:2,sheep:1,wheat:0,ore:0},  // unknown
                      "B": {wood: 0,brick:0,sheep:0,wheat:0,ore:0},  // Masking
                      "C": {wood: 0,brick:0,sheep:0,wheat:0,ore:0},  // Dummy for trading
                      "D": {wood: 0,brick:0,sheep:0,wheat:0,ore:0} };
        this.initWorlds(resources);
        log("before anything (4.5)"); this.printWorlds();
        logs(this.manyWorlds);
        for (const i in [...Array(3).keys()])
        {
            this.branchSteal("A", "B");
            this.mwUpdateStats();
            console.warn("after steal", i);
            console.info("sheep chance:", this.worldGuessAndRange["B"]["sheep"][2], "(", this.worldGuessAndRange["B"]["sheep"][1], ")");
            this.printWorlds();
        }
        log("after stealing 3 times. Most likely, B stole wood (some brick)"); this.printWorlds();
        this.mwUpdateStats();
        // Now we expect B not to have taken the 1 sheep in just 5 trades
        if (   this.worldGuessAndRange["B"]["sheep"][2] !== 0
            || this.worldGuessAndRange["B"]["sheep"][1] < 0.5) { passedTest = false; }
        log2(this.worldGuessAndRange);
        this.collapseExact("B", mw.worldResourceIndex(wood), 1);
        log("After collapsing B's wood. implies 2 steals {brick,sheep}. world:", this.manyWorlds);
        this.printWorlds();
        this.mwUpdateStats();
        log2("guess&range:", this.worldGuessAndRange);
        // Now it is likely that B took the sheep
        if (   this.worldGuessAndRange["B"]["sheep"][2] !== 1
            || this.worldGuessAndRange["B"]["sheep"][1] < 0.50) { passedTest = false; }

        if (!passedTest)
        {
            log("[ERROR] Failed ManyWorlds test 4.5: guess and range");
            alertIf(26);
            debugger;
        }
        else
        {
            log("[NOTE] ManyWorlds test 4.5 (guess and range) passed");
        }

        // Test 5: Guess and Range. FIXME IS this test broken? how?
        //  1) Player A starts with 10 wood. 5 brick. 1 sheep.
        //  2) Player B steals 5 times from A.
        //  3) - Most likely, player B took wood. Verify the range and guess.
        //  4) Player B is measured to have exactly 1 wood.
        //  5) - Now most likely, B has stolen a lot of brick. Verify the range&guess.
        log("----------------------- MW TEST 5 -------------------------------");
        // TODO Test 5 seems to fail but I am not sure why. The sheep rate is
        // simulated to 66.3% (see scripts/check.py), but this test case is too
        // complicated to check by hand. The test needs to be easier.
        passedTest = true;
        resources = { "A": {wood:10,brick:5,sheep:1,wheat:0,ore:0},  // unknown
                      "B": {wood:0,brick:0,sheep:0,wheat:0,ore:0},  // Masking
                      "C": {wood:0,brick:0,sheep:0,wheat:0,ore:0},  // Dummy for trading
                      "D": {wood:0,brick:0,sheep:0,wheat:0,ore:0} };
        this.initWorlds(resources);
        log("before anything (5)"); this.printWorlds();
        logs(this.manyWorlds);
        for (const i in [...Array(5).keys()])
        {
            this.branchSteal("A", "B");
        }
        log("after stealing 5 times. Most likely, B stole wood (some brick)"); this.printWorlds();
        this.mwUpdateStats();
        // Now we expect B not to have taken the 1 sheep in just 5 trades
        if (   this.worldGuessAndRange["B"]["sheep"][2] !== 0
            || this.worldGuessAndRange["B"]["sheep"][1] < 0.5) { passedTest = false; }
        log2(this.worldGuessAndRange);
        this.collapseExact("B", mw.worldResourceIndex(wood), 1);
        log("After collapsing B's wood. implies 4 steals {brick,sheep}. world:", this.manyWorlds);
        this.printWorlds();
        this.mwUpdateStats();
        log2("guess&range:", this.worldGuessAndRange);
        // Now it is likely that B took the sheep (~66.3%)
        if (   this.worldGuessAndRange["B"]["sheep"][2] !== 1
            || this.worldGuessAndRange["B"]["sheep"][1] < 0.5) { passedTest = false; }

        if (!passedTest)
        {
            log("[ERROR] Failed ManyWorlds test 5: guess and range");
            alertIf(26);
            debugger;
        }
        else
        {
            log("[NOTE] ManyWorlds test5 (guess and range) passed");
        }

        // Test 6: mwTransformSpawn
        //  1) Start out empty.
        //  2) A spawns a set of road material.
        //  3) - Verify
        //  4) B steals 1 card from A
        //  5) A un-spawns 1 wood. B has brick left.
        //  6) - verify
        log("-------------------- MW TEST 6 ---------------------------------");
        passedTest = true;
        resources = { "A": {wood:0,brick:0,sheep:0,wheat:0,ore:0},  // unknown
                      "B": {wood:0,brick:0,sheep:0,wheat:0,ore:0},  // Masking
                      "C": {wood:0,brick:0,sheep:0,wheat:0,ore:0},  // Dummy for trading
                      "D": {wood:0,brick:0,sheep:0,wheat:0,ore:0} };
        this.initWorlds(resources);
        log("before anything (6)"); this.printWorlds();
        this.mwTransformSpawn("A", 65);
        log("after spawning A a road"); this.printWorlds();
        this.mwUpdateStats();
        this.branchSteal("A", "B");
        log("After stealing from A"); this.printWorlds();
        this.mwUpdateStats();
        this.mwTransformSpawn("A", -1);
        log("after un-spawning a wood from A. B has a brick left now."); this.printWorlds();
        this.mwUpdateStats();

        if (this.manyWorlds.length !== 1 || this.worldGuessAndRange["B"][brick][2] !== 1
                                    || this.worldGuessAndRange["B"][brick][1] < 0.99)
        {
            passedTest = false;
        }
        if (!passedTest)
        {
            log("[ERROR] Failed ManyWorlds test 6: spawn transformation");
            alertIf(30);
            debugger;
        }
        else
        {
            log("[NOTE] ManyWorlds test 6 (guess and range) passed");
        }

        // Test 7: mwTransformSpawn
        //  1) Start randomly.
        //  2) Enter recovery with A=2U, B=2U (sum = 4 cards)
        //  3) A offers 1 wood. => A has only 1 unknown card left.
        //  4) A trades 1 wood to B for 1 brick. => A + B have 1 unknown each.
        //  5) Steal A -> B. => 2 worlds (for B): {road + 1U, wood + 2U}
        //  6) A monos wood => 5 worlds (for B): {brick, brick+U, 0, U, 2U}
        //  4) B reveals minTotal, cards >= 2. => 2 worlds left
        //  5) A offers 1 sheep (new card) => only 1 world left where B has the other unknown + brick.
        //  6) A trades 1 sheep to B for 1 wheat => full recovery, 1 world.
        log("-------------------- MW TEST 7 (recovery) ---------------------------------");
        passedTest = true;
        resources = { "A": {wood:1,brick:0,sheep:0,wheat:0,ore:0},
                      "B": {wood:0,brick:1,sheep:0,wheat:0,ore:0},
                      "C": {wood:0,brick:0,sheep:1,wheat:0,ore:0},
                      "D": {wood:0,brick:0,sheep:0,wheat:1,ore:0} };
        this.initWorlds(resources);
        log("before anything (7)"); this.printWorlds();
        const counts = {"A": 2, "B": 2, "C": 0, "D": 0};
        this.mwCardRecovery(counts);
        log("after entering recovery mode, 2*U each"); this.printWorlds();
        if (mw.getResourceCountOfSlice(this.manyWorlds[0]["A"], 5) != 2) passedTest = false;
        const woodOffer = {wood: 1, brick: 0, sheep:0, wheat: 0, ore:0, "unknown": 0};
        const revealedSlice = mw.generateFullSliceFromNames(woodOffer);
        this.mwCollapseMin("A", revealedSlice);
        log("After A reveales wood"); this.printWorlds();
        const brickDemand = {wood: 0, brick: 1, sheep:0, wheat: 0, ore:0, "unknown": 0};
        this.transformTradeByName("A", "B", woodOffer, brickDemand);
        log("after A trading wood to B for brick"); this.printWorlds();
        this.branchSteal("A", "B");
        log("After steal A -> B. 2 worlds left"); this.printWorlds();
        this.transformMonopoly("A", mw.worldResourceIndex(wood));
        log("After A monos wood. 5 worlds"); this.printWorlds();
        if (this.manyWorlds.length !== 5) passedTest = false;
        this.mwCollapseMinTotal("B", 2);
        log("After B reveals total count >= 2. 2 worlds left"); this.printWorlds();
        if (this.manyWorlds.length !== 2) passedTest = false;
        const sheepOffer = {wood: 0, brick: 0, sheep:1, wheat: 0, ore:0, "unknown": 0};
        this.mwCollapseMin("A", mw.generateFullSliceFromNames(sheepOffer));
        log("After a offers sheep (unknown before). 1 world left with B=brick+U"); this.printWorlds();
        const wheatDemand = {wood: 0, brick: 0, sheep:0, wheat: 1, ore:0, "unknown": 0};
        this.transformTradeByName("A", "B", sheepOffer, wheatDemand);
        log("After last trade. Full recovery into all-known world, 1 version, no unknown"); this.printWorlds();
        if (this.manyWorlds.length !== 1) passedTest = false;
        this.mwUpdateStats();
        if (this.manyWorlds.length !== 1 || this.worldGuessAndRange["B"][brick][2] !== 1
                                         || this.worldGuessAndRange["B"][brick][1] < 0.99)
        {
            passedTest = false;
        }
        if (!passedTest)
        {
            log("[ERROR] Failed ManyWorlds test 7: spawn transformation");
            alertIf(38);
            debugger;
        }
        else
        {
            log("[NOTE] ManyWorlds test 7 (guess and range) passed");
        }

        // Test 8: Mono recover
        //  1) Start with the MW state that failed in testing.
        //  2) Monopoly the sheep
        //  3) World sho9uld not corrupt
        //  4) A trades 1 wood to B for 1 brick. => A + B have 1 unknown each.
        //  5) Steal A -> B. => 2 worlds (for B): {road + 1U, wood + 2U}
        //  6) A monos wood => 5 worlds (for B): {brick, brick+U, 0, U, 2U}
        //  4) B reveals minTotal, cards >= 2. => 2 worlds left
        //  5) A offers 1 sheep (new card) => only 1 world left where B has the other unknown + brick.
        //  6) A trades 1 sheep to B for 1 wheat => full recovery, 1 world.
        log("-------------------- MW TEST 8 (recovery monopoly) --------------------------");
        passedTest = true;
        resources = { "A": {wood:0,brick:0,sheep:4,wheat:0,ore:0,unknown:1},
                      "B": {wood:0,brick:0,sheep:1,wheat:0,ore:0,unknown:0},
                      "C": {wood:0,brick:0,sheep:1,wheat:0,ore:0,unknown:0},
                      "D": {wood:0,brick:4,sheep:0,wheat:1,ore:0,unknown:1} };
        this.initWorlds(resources);
        log("Before anything"); this.printWorlds();
        this.transformMonopoly("B", 2);
        log("After B monos the sheep. World should not be corrupt."); this.printWorlds();
        this.mwUpdateStats();
        if (this.manyWorlds.length === 0) passedTest = false;
        else if (this.manyWorlds.length !== 4) passedTest = false;
        else if (mw.getResourceCountOfSlice(this.manyWorlds[0]["A"],
                 mw.worldResourceIndex(wood)) !== 0) passedTest = false;
        else if (getResourceSumOfSlice(this.manyWorlds[0]["A"]) > 5) passedTest = false;
        if (!passedTest)
        {
            log("[ERROR] Failed ManyWorlds test 8: spawn transformation");
            alertIf(42);
            debugger;
        }
        else
        {
            log("[NOTE] ManyWorlds test 8 (recovery mono) passed");
        }

        // Test 9: Bayesian probability test
        //  1) Start 2 players with a road each
        //  2) Rob A → B
        //  3) A third player robs B → C
        //  4) A wood is revealed in the hand of C
        //  5) ➜  The first rob should more likely have been a wood now (bayesian).
        log("-------------------- MW TEST 9 (bayesian) --------------------------");
        passedTest = true;
        resources = { "A": {wood:1,brick:1,sheep:0,wheat:0,ore:0,unknown:0},
                      "B": {wood:1,brick:1,sheep:0,wheat:0,ore:0,unknown:0},
                      "C": {wood:0,brick:0,sheep:0,wheat:0,ore:0,unknown:0},
                      "D": {wood:0,brick:0,sheep:0,wheat:0,ore:0,unknown:0}, };
        this.initWorlds(resources);
        log("Before anything"); this.mwUpdateStats(); this.printWorlds();
        this.branchSteal("A", "B");
        log("After B robs A"); this.mwUpdateStats(); this.printWorlds();
        this.branchSteal("B", "C");
        log("After C robs B"); this.mwUpdateStats(); this.printWorlds();
        this.collapseExact("C", mw.worldResourceIndex(wood), 1);
        log("After wood revealed"); this.mwUpdateStats(); this.printWorlds();
        if (this.manyWorlds.length !== 2) passedTest = false;
        const isAbout = (x) => { return world => ((x-0.05) < world["chance"] && world["chance"] < (x+0.05)); };
        if (isAbout(0.5)(this.manyWorlds[0]) || isAbout(0.5)(this.manyWorlds[1])) passedTest = false;
        const anyOneThird = isAbout(0.33)(this.manyWorlds[0]) || isAbout(0.33)(this.manyWorlds[1]);
        if (!anyOneThird) passedTest = false;
        if (isAbout(0.66)(this.manyWorlds[0]))
        {
            // The likely thing is that since C got a wood, B should have gotten it
            // too (so A does not have it anymore).
            if (mw.getResourceCountOfSlice(this.manyWorlds[0]["A"],
                 mw.worldResourceIndex(wood)) !== 0) passedTest = false;
        }
        else // Make no assumption on ordering of the two worlds
        {
            if (mw.getResourceCountOfSlice(this.manyWorlds[0]["A"],
                 mw.worldResourceIndex(wood)) !== 1) passedTest = false;
        }
        if (!passedTest)
        {
            log("[ERROR] Failed ManyWorlds test 9: bayesian");
            alertIf(43);
            debugger;
        }
        else
        {
            log("[NOTE] ManyWorlds test 9 (bayesian) passed");
        }

        // Test 10: collapseMax test
        //  1) Start A with 0 wood, 3 brick
        //  2) Test max 4 brick, not effect.
        //  3) Test max 3 brick, not effect.
        //  4) Test max 2 brick, impossible;
        //  5) (re-init)
        //  6) Text max 1 wood, ok.
        //  7) Test max 0 wood, ok.
        log("-------------------- MW TEST 10 (collapseMax) --------------------------");
        passedTest = true;
        resources = { "A": {wood:0,brick:3,sheep:0,wheat:0,ore:0,unknown:0},
                      "B": {wood:0,brick:0,sheep:0,wheat:0,ore:0,unknown:0},
                      "C": {wood:0,brick:0,sheep:0,wheat:0,ore:0,unknown:0},
                      "D": {wood:0,brick:0,sheep:0,wheat:0,ore:0,unknown:0}, };

        debugger;

        this.initWorlds(resources);
        log("Before anything"); this.mwUpdateStats(); this.printWorlds();
        let maxSlice = mw.generateFullSliceFromNames(
            { "wood": 19, "brick": 4, "sheep": 19, "wheat": 19, "ore": 19, "unknown": 95 }
        );
        this.mwCollapseMax("A", maxSlice);
        log("After ensuring at most 4 brick (still the same)"); this.mwUpdateStats(); this.printWorlds();
        if (this.manyWorlds.length !== 1) passedTest = false;
        maxSlice = mw.generateFullSliceFromNames(
            { "wood": 19, "brick": 3, "sheep": 19, "wheat": 19, "ore": 19, "unknown": 95 }
        );
        this.mwCollapseMax("A", maxSlice);
        log("After ensuring at most 3 brick (still the same)"); this.mwUpdateStats(); this.printWorlds();
        if (this.manyWorlds.length !== 1) passedTest = false;
        maxSlice = mw.generateFullSliceFromNames(
            { "wood": 19, "brick": 2, "sheep": 19, "wheat": 19, "ore": 19, "unknown": 95 }
        );
        this.mwCollapseMax("A", maxSlice);
        log("After ensuring at most 2 brick (no worlds left)"); this.printWorlds();
        if (this.manyWorlds.length !== 0) passedTest = false;

        resources = { "A": {wood:1,brick:0,sheep:0,wheat:0,ore:0,unknown:0},
                      "B": {wood:0,brick:0,sheep:0,wheat:0,ore:0,unknown:0},
                      "C": {wood:0,brick:0,sheep:0,wheat:0,ore:0,unknown:0},
                      "D": {wood:0,brick:0,sheep:0,wheat:0,ore:0,unknown:0}, };
        this.initWorlds(resources);
        maxSlice = mw.generateFullSliceFromNames(
            { "wood": 19, "brick": 1, "sheep": 19, "wheat": 19, "ore": 19, "unknown": 95 }
        );
        this.mwCollapseMax("A", maxSlice);
        log("After ensuring at most 1 brick (still the same)"); this.mwUpdateStats(); this.printWorlds();
        if (this.manyWorlds.length !== 1) passedTest = false;
        maxSlice = mw.generateFullSliceFromNames(
            { "wood": 19, "brick": 0, "sheep": 19, "wheat": 19, "ore": 19, "unknown": 95 }
        );
        this.mwCollapseMax("A", maxSlice);
        log("After ensuring at most 0 brick (still the same)"); this.mwUpdateStats(); this.printWorlds();
        if (this.manyWorlds.length !== 1) passedTest = false;

        if (!passedTest)
        {
            log("[ERROR] Failed ManyWorlds test 10: collapseMax");
            alertIf(53);
            debugger;
        }
        else
        {
            log("[NOTE] ManyWorlds test 10: (collapseMax) passed");
        }
        debugger;
    }

    // Return manyworlds data in human readable notation instead of slices. Use
    // this when you want to export the MW state.
    mwHumanReadableWorld()
    {
        let mwClone = deepCopy(this.manyWorlds);
        for (let i = 0; i < this.manyWorlds.length; ++i)
        {
            for (const player of this.playerNames)
            {
                if (player === "chance") continue;
                mwClone[i][player] = mw.generateFullNamesFromSlice(
                    this.manyWorlds[i][player]);
            }
        }
        return mwClone;
    }

};

// vim: shiftwidth=4:softtabstop=4:expandtab
