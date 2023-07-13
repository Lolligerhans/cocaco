//============================================================
// CONFIG
//============================================================
const configDoAlert = true;
const configPrintWorlds = false;   // Activate console logging of MW state
const configRunManyWorldsTest = false;    // Run test and quit. Not a full unit test.
const configFixedPlayerName = false;    // Set true to use configPlayerName
const configPlayerName = "John#1234";
const configPlotBubbles = true;
const configLogMessages = false;
const configLogWorldCount = false;
const configRefreshRate = 10000;
const configOwnIcons = true;

//============================================================
// Hello
//============================================================

// TODO Use console.table
console.log("[INFO]",
    "| configDoAlert:", configDoAlert,
    "| configPrintWorlds:", configPrintWorlds,
    "| configRunManyWorldsTest:", configRunManyWorldsTest,
    "| configFixedPlayerName:", configFixedPlayerName,
    "| configPlayerName:", configPlayerName,
    "| configPlotBubbles:", configPlotBubbles,
    "| configLogMessages:", configLogMessages,
    "| configLogWorldCount:", configLogWorldCount
);

let e = document.getElementById("header_navigation_store");
if (e !== null) e.textContent = atob("VHJhY2tlciBXQUlU");

//============================================================
// Utils
//============================================================

// fac(20) < 2^64 < fac(21)
let facArray = [];
function fac(x)
{
    if (x < 2) return 1;
    if (facArray[x] > 0) return facArray[x];    // (undefined > 0) === false
    return facArray[x] = x * fac(x - 1);
}

function choose(n, k)
{
    return fac(n) / (fac(k) * fac(n-k));
}

//============================================================
// Logging helpers
//============================================================

function p(object)
{
    return JSON.stringify(object);
}

// Log objects
function log(...args)
{
    console.log(...args);
}

// Log stringified
function logs(...args)
{
    log(...args.map( x => JSON.stringify(x) ));
}

function log2(...args)
{
    log(...args);
    logs(...args);
}

let mainLoopInterval = 0;
let playerUsername;
let playerUsernameElement = null;

let logElement;
let initialPlacementMade = false;
//var initialPlacementDoneMessage = "Giving out starting resources";

let initialPlacementDoneSnippet = "rolled";
let placeInitialSettlementSnippet = "placed a"; // Normal building uses the word "built", not "placed"

// Parser snippets
let receivedInitialResourcesSnippet = "received starting resources";
const tradeOfferSnippet = " wants to give ";
const tradeOfferResSnippet = " for ";
const yearOfPlentySnippet = " took from bank ";
let receivedResourcesSnippet = " got ";
let builtSnippet = " built a ";
let boughtSnippet = " bought ";
let tradeBankGaveSnippet = "gave bank";
let tradeBankTookSnippet = "and took";
const monoStoleSnippet = " stole "; // Contained
const monoFromSnippet = "from"; // Not contained
let discardedSnippet = " discarded ";
const tradeSnippet = " traded  for  with ";
const tradeSplitSnippet = " for ";
const stealingSnippet = " stole  from ";
const winSnippet = "won the game";
const rolledSnippet = " rolled ";

let wood = "wood";
let ore = "ore";
let wheat = "wheat";
let brick = "brick";
let sheep = "sheep";
let resourceTypes = [wood, brick, sheep, wheat, ore];   // MW depends on this

// Players
let players = [];   // MW depends on this
let player_colors = {}; // player -> hex

const imageNameSnippets =
{
    wood: "card_lumber", brick: "card_brick", sheep: "card_wool",
    wheat: "card_grain", ore: "card_ore", "road": "road_red",
    "settlement": "settlement_red", "devcard": "card_devcardback",
    "city": "city_red"
};

const assets =
{
    wood: "assets/wood31.jpg",
    brick: "assets/brick24.jpg",
    sheep: "assets/sheep1.jpg",
    wheat: "assets/wheat2.jpg",
    ore: "assets/ore27.jpg",
    "road": "assets/street10.jpg",
    "settlement": "assets/settle7.jpg",
    "devcard": "assets/dev4.jpg",
    "city": "assets/city23.jpg"
};

const bubblePlotId = "explorer-plt";
const tableId = "explorer-tbl";

// Message offset
let MSG_OFFSET = -1;    // Reset to 0 when (re-)starting


//============================================================
// Helpers
//============================================================

function deepCopy(object)
{
    return JSON.parse(JSON.stringify(object));
}

function alertIf(message)
{
    if (configDoAlert)
    {
        alert(message);
    }
    else
    {
        log("[WARNING] Skipping alert(", message, ")");
    }
}

// Strings contained in the resource image file names. Used also in regex so
// keep simple.
let resourceCardNames =
{
    wood: "card_lumber",
    brick: "card_brick",
    sheep: "card_wool",
    wheat: "card_grain",
    ore: "card_ore"
};

// Returns resource type of any resource card found in the element. Use when
// there is only one resource card.
function findSingularResourceImageInElement(element)
{
    let images = collectionToArray(element.getElementsByTagName("img"));
    let resourceType;

    // Usually 1 image, but check all to be sure
    for (let img of images)
    {
        // Check which resource it is
        for (resourceType of resourceTypes)
        {
            if (img.src.includes(resourceCardNames[resourceType]))
            {
                log("Found singular resource type", resourceType);
                return resourceType;
            }
        }
    }

    // Indicate error
    log("[ERROR] Expected resource image in element");
    alertIf(4);
}

// Matches input string 'html' against assumed-unique strings identifying
// resource card images.
// Returns object {wood: 0, brick:1, …}
function findAllResourceCardsInHtml(html)
{
    // Match resourceCardNames against string content
    let foundAny = false;   // For sanity check
    let cards = {wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0};
    for (const [res, uniqueResString] of Object.entries(resourceCardNames))
    {
        // Count number of occurences of identifying strings like "card_brick"
        let resourceRegex = new RegExp(uniqueResString, "g");
        let count = (html.match(resourceRegex) || []).length;
        if (count !== 0)
        {
            foundAny = true;
        }
        cards[res] = count;
    }

    // Sanity check
    if (foundAny == false)
    {
        log("[ERROR] Expected some resource cards in html");
        alertIf(9);
    }

    return cards;
}

//============================================================
// ManyWorlds 0.0.1
//============================================================

// TODO Use typed array

// ManyWorlds terms
//  1) Slice: Range [0, 19] needed. 5 bit value. 1 bit overflow. 5 * 6 bit = 30
//     bit representation. Assume >= 4 byte integer. Represents inventory of
//     one player. If the 5 bit limit never checked. Inputs must be correct to
//     work. Sometimes also "world slice".
//  2) SingularSlice: Slice with just one resource used (for stealing).
//  3) World: Collection of slices. One slice for each player.
//  4) ManyWorls: Collection of worlds consistent with past observations.
//     Updated iteratively with every observation.
//  5) Example 'manyWorlds' object:
//      manyWorlds === Array [ […], […] ]
//      [0]: [ A: 64, B: 64, C: 1, … , chance: 0.33] // In world 0, player B has 0 wood, 1 brick
//      [1]: [ A: 64, B: 1, C: 64, … , chance: 0.67] // In world 1, player B has 1 wood, 0 brick
//
// ManyWorlds interface:
//  0) initWorlds(): Initialize tracking. Call once before doing anything else
//  1.1) transform: tweak existing worlds in known ways (e.g., trade, buy)
//  1.2) branch: Branch worlds from unknown events into multiple options
//  1.3) collapse: (Potentially) reduce possibilities by revealing information
//  2) worldGuessAndRange: Call mwUpdateStats() before reading it.
//                         Then contains the tracking result to display.
//
// Internally:
//  0) Helpers to mutate, generate, extract and test slices, etc.
//  1) Use integer indices to index players (TODO) and resourceTypes (done)
//  2)
//
// Recovery:
//  1) Limited in card count, especially when monos are involved
//  2) Ignores knowledge of about what resources unknown cards are known NOT to
//     be (from a monopoly).

// TODO Prefix all manyworlds stuff with "mw"

const manyWorldsBits = 6;   // Reserve 6 bits per resource type
const wood1  = 0x1 << (6 * 0);  // Wood-singular slice basis (== 1 wood)
const brick1 = 0x1 << (6 * 1);
const sheep1 = 0x1 << (6 * 2);
const wheat1 = 0x1 << (6 * 3);
const ore1   = 0x1 << (6 * 4);
const unknown1 = 0x1 << (6 * 5); // Assumes 64bit int
// Overflow indicator bits for wood-ore. Not: unknown (!)
const loverflow1 = 0x20820820; // == 0b 00100000 10000010 00001000 00100000
const worldResourceIndexTable = {"wood":0, "brick":1, "sheep":2, "wheat":3, "ore":4, "unknown":5};
// We reserve 9+1 bits for unknown resources (to allow higher values), rest has
// 5+1 bit. resourceBase[6] is for shifting unknown resources
const resourceBase = [wood1, brick1, sheep1, wheat1, ore1, unknown1, unknown1 * 512];
const mwOverflowTable = [wood1 * 32, brick1 * 32, sheep1 * 32, wheat1 * 32, ore1 * 32, unknown1 * 512];
const woodMask  = 0x1F << (6 * 0);  // Wood-singular slice mask (1 bits in all wood spots)
const brickMask = 0x1F << (6 * 1);  // Small-enough bit ops here!
const sheepMask = 0x1F << (6 * 2);
const wheatMask = 0x1F << (6 * 3);
const oreMask   = 0x1F << (6 * 4);
const unknownMask = 0x1FF * 2**(6 * 5); // 9 bit value, 1 bit overflow
const resourceMask = {0:woodMask, 1:brickMask, 2:sheepMask, 3:wheatMask, 4:oreMask, 5:unknownMask};
// TODO make wrapper that returns a copy
const emptyResourcesByName = {wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0};
const emptyResourcesByNameWithU = {wood:0, brick:0, sheep:0, wheat:0, ore:0, "unknown":0};

// Only normal resources
const mwUnitsSlice = wood1 + brick1 + sheep1 + wheat1 + ore1;
const mwRoadSlice = wood1 + brick1;
const mwSettlementSlice = wood1 + brick1 + sheep1 + wheat1;
const mwDevcardSlice = sheep1 + wheat1 + ore1;
const mwCitySlice = 2 * wheat1 + 3 * ore1;
const mwBuilds = {"road": mwRoadSlice, "settlement": mwSettlementSlice,
                  "devcard": mwDevcardSlice, "city": mwCitySlice};

// The global tracking structure
let manyWorlds = [];

//------------------------------------------------------------
// ManyWorlds helpers
//------------------------------------------------------------

function worldResourceIndex(resourceName)
{
    return worldResourceIndexTable[resourceName];
}

function worldPlayerIndex(playerName)
{
    // TODO I would guess that using integer indices for worlds would be
    // faster. Some places use the name directly so you would need to find all
    // places where a world is indexed without calling this function first.
    //
    // Eventually make this return 0 for player 0, 1 for player 1, ...
    return playerName;
}

function clearResourceFromSlice()
{
}

function sliceHasNegative(slice)
{
    //      low bits overflow            unknown card overflow
    return ((slice & loverflow1) || (slice / resourceBase[6] < 0))
        ? true : false;
}

function generateSingularSlice(oneResourceIndex, count = 1)
{
    return count * resourceBase[oneResourceIndex];
}

// Get resource count in non-negative (!) slice
function getResourceCountOfSlice(slice, resIdx)
{
    return Math.trunc( (slice % resourceBase[resIdx + 1])    // mask up
                        / resourceBase[resIdx]);                // shift

    // Bitops version
//    return (slice & resourceMask[resIdx])
//        >> (resIdx * manyWorldsBits);
}

// TODO remove: not used and broken bitops
function getSingularSlice(slice, resIdx)
{
    return getResourceCountOfSlice(slice, resIdx) * resourceBase[resIdx];
    // Bitops version
//    return worldSlice & resourceMask[resIdx];
}

function getResourceSumOfSlice(slice)
{
    // TODO do we get problems if we only mask once at end?
    return getResourceCountOfSlice(slice, 0)
         + getResourceCountOfSlice(slice, 1)
         + getResourceCountOfSlice(slice, 2)
         + getResourceCountOfSlice(slice, 3)
         + getResourceCountOfSlice(slice, 4)
         + getResourceCountOfSlice(slice, 5);

    // Bitops version:
//    return ((slice >> (manyWorldsBits * 0)) & resourceMask[0]) // wood
//         + ((slice >> (manyWorldsBits * 1)) & resourceMask[0])
//         + ((slice >> (manyWorldsBits * 2)) & resourceMask[0])
//         + ((slice >> (manyWorldsBits * 3)) & resourceMask[0])
//         + ((slice >> (manyWorldsBits * 4)) & resourceMask[0]) // ore
//         + ( (slice           >> (manyWorldsBits * 5) )
//           & (resourceMask[5] >> (manyWorldsBits * 5) ));        // Unknown
}

// (!) Limits amount of unknown cards used per resource
// TODO This is why recovery will could fail if a world with more unknown cards
//      appears. Move to more bits, then swap 12 -> 19.
//
// Fixes slice using unknown cards. If succeeds, result is free negative
// values. If impossible, result has a negative value.
//
// Algorith to avoid intermediate zeros (we can only test for any-0):
//  1) Start with U many unknown cards.
//  2) Spawn 12 extra cards to every normal resource. Any 0 left =>
//     unrecoverable. No change to unknown cards!
//  3) From all normal resources with N cards, transfer min(12, N) cards to
//     unknown cards. This gives back the ghost cards if possible.
//  4) Despawn 5 * 19 unknown cards. If negative => unrecoverable. Unknon cards
//     left:
//
//      U + (60 - replaced) - 60 === U - replaced
//
// Restrict to 12 cards to prevent normal resource overflow (19 + 12 == 31).
function mwFixOrNegative(slice)
{
    // Special case: No fix needed
    if (!sliceHasNegative(slice)) return slice;

    // General case: fix by distributiong unknown cards
    let res = slice + 12 * mwUnitsSlice;                              // 2
    for (let i = 0; i < 5; ++i) // TODO make resources iterable w/ and w/o unknown
//    for (const [resName, i] of Object.entries(worldResourceIndexTable)) // 3
    {
        const tradeSlice = unknown1 - generateSingularSlice(i);
        res += Math.min(12, getResourceCountOfSlice(res, i)) * tradeSlice;
    }
    res -= generateSingularSlice(5) * (5 * 12);                         // 4
    return res; // Has negative if more unknown cards would be needede
}

// Takes [wood:0,brick:1,...] and outputs the corresponding slice
function generateFullSliceFromNames(resourcesByName)
{
    let slice = 0;
    for (res of resourceTypes)
    {
        slice += generateSingularSlice(
            worldResourceIndex(res),    // index 0 for wood, 1 for brick, ...
            resourcesByName[res]);      // count, as given my argument
    }
    return slice;
}

// Probably only want to use this for reading from outside
function generateFullNamesFromSlice(slice)
{
    let res = deepCopy(emptyResourcesByName);
    for (const r of resourceTypes)
    {
        res[r] = getResourceCountOfSlice(slice, worldResourceIndex(r));
    }
    res["unknown"] = getResourceCountOfSlice(slice, 5);
    return res;
}

function generateFullNamesFromWorld(world)
{
    let sum = 0;
    for (const player of Object.keys(world))
//    for (let i = 0; i < players.length; ++i)
    {
        // TODO Treat chance separate to players, outside of the world object
        if (player === "chance") continue;
        sum += world[player];
    }
    return generateFullNamesFromSlice(sum);
}

// res = {ore: "1", wheat: "2", ...}
function generateWorldSlice(res)
{
    let slice = 0;
    for (const [r, count] of Object.entries(res))
    {
        slice += generateSingularSlice(worldResourceIndex(r), count);
    }
//    log2("Generated world slice from resources:", res, "|", slice);
    return slice;
}

function worldHasNegativeSlice(world)
{
    for (const player of players)
    {
        if (sliceHasNegative(world[player]))
            return true;
    }
    return false;
}

// Return [matched_slice, addedResources]
// TODO Used anywhere? No. Remove. Probably buggy, too
function mwGenerateMatchingSlice(slice, minimum)
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

// Return manyworlds data in human readable notation instead of slices. Use
// this when you want to export the MW state.
function mwHumanReadableWorld()
{
    let mwClone = deepCopy(manyWorlds);

    for (let i = 0; i < manyWorlds.length; ++i)
    {
        for (player of players)
        {
            mwClone[i][player] = generateFullNamesFromSlice(
                manyWorlds[i][player]);
        }
    }
    return mwClone;
}

function mwHumanReadableToMwFormat(humanReadableMw, playerNames = players)
{
    let constructedMw = [];

    for(let i = 0; i < humanReadableMw.length; ++i)
    {
        constructedMw[i] = {};
        for (player of playerNames)
        {
//            debugger;
            constructedMw[i][player] = generateFullSliceFromNames(
                humanReadableMw[i][player]);
        }
        constructedMw[i]["chance"] = humanReadableMw[i]["chance"];
    }

    return constructedMw;
}

function printWorlds()
{
    if (configPrintWorlds === false)
        return;

    log2("[NOTE] ManyWorlds:", manyWorlds);
    for (let i = 0; i < manyWorlds.length; ++i)
    {
        log("\t----- p =", manyWorlds[i]["chance"], "-----");
        for (pl of players)
        {
            log(`\t\t[${i}][${pl}] =`, generateFullNamesFromSlice(manyWorlds[i][pl]));
        }
    }
}

// Fixes world using unknown cards (returning true) or returns false. Use to
// filter worlds in recovery. When false is returned, the world is unchanged.
function mwFixOrFalse(world, playerIdx)
{
    // Skip fix attemt if no special case (likely)
    const s = world[playerIdx];
    if (getResourceCountOfSlice(s, 5) === 0)
        return !sliceHasNegative(s);

    const fixAttempt = mwFixOrNegative(s);
    if (sliceHasNegative(fixAttempt))
    {
        // Fix failed
        return false;
    }
    else
    {
        // Fix succeeded
        const usedUnknown = getResourceCountOfSlice(world[playerIdx], 5);   // TODO replace raw number with table lookup (?)
        logs(`[NOTE] Using ${usedUnknown} unknown cards to fix world for player ${playerIdx}`);
        world[playerIdx] = fixAttempt;
        return true;
    }
}

//------------------------------------------------------------
// ManyWorlds interface
//------------------------------------------------------------

// Starts recovery mode.
// Input: counts === { "alice": 5, ... } the total number of (unknown) cards
function mwCardRecovery(counts)
{
    let world = {};
    for (const player of players)
    {
        world[worldPlayerIndex(player)] = generateSingularSlice(5, counts[player]);
    }
    world["chance"] = 1;
    manyWorlds = [world];

    logs("[NOTE] Starting MW recovery mode:", manyWorlds);
    printWorlds();
}

// Recovers MW state from unknown cards. Player array is used and assumed
// correct.
// TODO If mainLoop is not active before, it makes no sense to reset anything.
//      For now we just disallow this case because I can't think of a use case.
function mwManualRecoverCards()
{
    log("[NOTE] Starting manual card recovery");
    const activeBefore = stopMainLoop();
    // Confirm AFTER stopping main loop so that card counts can be timed
    if (!activeBefore || !confirm("Reset cards?"))
    {
        log(`[NOTE] Aborting manual card recovery (${activeBefore ? "unconfirmed" : "inactive"})`);
        if (activeBefore)
            restartMainLoop();
        return;
    }
    // Set MSG_OFFSET to end just before the numbe rquerying starts. This way,
    // the game can continue while the user enters the number from that moment
    // in time (e.g., during other moves).
    MSG_OFFSET = getAllMessages().length;
    let counts = {};
    for (player of players)
    {
        const count = prompt(`${player} number of cards:`, 0);
        counts[player] = count;
    }
    mwCardRecovery(counts);
    render(true);
    restartMainLoop();
}

// Waits 1 round to collect all player names, then needs card counts (?)
function mwManualFullRecovery()
{
    log("[NOTE] Starting manual name recovery");
    const playerCount = Number(prompt("Player count (0 to abort):", 0));
    if (playerCount === 0)
    {
        log("[NOTE] Aborting manual name recovery");
        return;
    }

    stopMainLoop();
    unrender();
    // We use callback to emulate while(!ready){ foo(); sleep(5s); }
    recoverUsers(playerCount, () => {
    initWorlds();
    render(true);
    // Let user trigger card recovery when ready.
//    mwManualRecoverCards(); // Starts main loop again
    });

    // End of action triggered by recovery click
}

// TODO This is currently not used anywhere. Use in future?
function mwManualRecoveryDispatcher(event)
{
    switch (e.button)
    {
        case 0: // left mouse button
            mwManualRecoverCards();
            break;
        case 2: // right mouse button
            mwManualFullRecovery();
            break;
        default:
            log("[NOTE] Event unrecognized");
    }
    event.preventDefault();
}

// Requires existing users array. Some stats objects are pre-filled with the
// names and they keep them always.
function initWorlds(startingResources = null)   // TODO add resources as argument, so we can finally remove the old resources array
{
    // Init only once
    if (manyWorlds.length !== 0)
    {
        console.warn("[WARNING] Initializing manyWorlds over non-empty manyWorlds array!");
        log("[NOTE] Treating current global 'resources' variable as-is. Fine if inside a test", p(startingResources));
    }

    // TODO make worlds arrays (is that faster in JS? lol)
    let world = {};
    for (const player of players)
    {
        // Generate world slice for player p
        world[worldPlayerIndex(player)] = startingResources !== null
                                        ? generateWorldSlice(startingResources[player])
                                        : 0; // TODO maybe provide a more generic option?
    }
    world["chance"] = 1;    // TODO This assumes no player is named "chance"
    manyWorlds = [world];

    // Init output object
    worldGuessAndRange =
    {
        [players[0]]: {},
        [players[1]]: {},
        [players[2]]: {},
        [players[3]]: {},   // Ok to stay undefined if there are less than 4 players (?)
    };
    logs("[NOTE] Initialized resource tracking", (startingResources === null ?
         "from no cards" : "from starting cards"));
    printWorlds();
}

// Handle unilaterate resource changes like building, YOP, or city profits
function mwTransformSpawn(playerName, resourceSlice)
{
    const playerIdx = worldPlayerIndex(playerName);
    manyWorlds = manyWorlds.map(world =>
    {
        let tmp = world;    // I think no copy needed (?)
        tmp[playerIdx] += resourceSlice;
        return tmp;
    });

    // Only if we remove something can we end up negative
    if (sliceHasNegative(resourceSlice))
    {
        // TODO Only if recover = on
        manyWorlds = manyWorlds.map(world =>
        {
            world[playerIdx] = mwFixOrNegative(world[playerIdx]);
            return world;
        });
        manyWorlds = manyWorlds.filter(world =>
        {
            return !sliceHasNegative(world[playerIdx]);
        });
    }
}

// If you do not have a slice, use 'transformTradeByName()' instead
function transformExchange(source, target, tradedSlice)
{
    const s = worldPlayerIndex(source);
    const t = worldPlayerIndex(target);
    manyWorlds = manyWorlds.map(world =>
    {
        let tmp = deepCopy(world); // TODO Do we need to duplicate here?
        tmp[source] -= tradedSlice;
        tmp[target] += tradedSlice;
        return tmp;
    });
    manyWorlds = manyWorlds.map(world =>
    {
        let tmp = world;    // Copy needed (?)
        tmp[s] = mwFixOrNegative(tmp[s]);
        tmp[t] = mwFixOrNegative(tmp[t]);
        return tmp;
    });
    manyWorlds = manyWorlds.filter( world =>
    {
        // TODO Only if slice (or -slice) have negatives
        return !sliceHasNegative(world[source])
            && !sliceHasNegative(world[target]);
    });
}

// Incorporate player trade. Since each resource type goes in only one
// direction, we can not get additional information by doing them 1 by 1.
//
// Format: offer = [wood:1, brick: 0, sheep: 2, ...]. Same for demand.
function transformTradeByName(trader, other, offer, demand)
{
    // Generate slice in perspective trader -> other
    let slice = generateFullSliceFromNames(offer);
    slice -= generateFullSliceFromNames(demand);

    // Sanity check
    if (!sliceHasNegative(slice) || !sliceHasNegative(-slice))
    {
        log("[ERROR] Trades must be bidirectional");
        alertIf(23);
        debugger;
        return;
    }

    transformExchange(trader, other, slice);
}

// Branch for unknown resource transfer between two players.
// Note: For known "steals", treat as one-sided trade.
function branchSteal(victim, thief)
{
    let newWorlds = [];

    // For all existing worlds, create up to 5 new worlds, where each one of
    // the resources was stolen.
    for (const world of manyWorlds)
    {
        const totalRes = getResourceSumOfSlice(world[victim]);
        if (totalRes === 0) continue;   // Impossible to steal => world dies
        for (let r = 0; r < resourceTypes.length; ++r)  // TODO How to iterate easier?
//        for (const [r, resName] of Object.keys(resourceTypes))
//        for (const r in resourceTypes)  // (!) Iterates indices. Depends on order.
        {
            let w = deepCopy(world);
            const slice = generateSingularSlice(r, 1);
            w[victim] -= slice;
            // Do not create negative-card worlds
            if (sliceHasNegative(w[victim])) continue;
            w[thief] += slice;

            // Use slice in old (!) world to generate steal chance
            let thisRes = getResourceCountOfSlice(world[victim], r);
            w["chance"] = world["chance"] * thisRes / totalRes;
            if (totalRes < thisRes) { alertIf(27); debugger; } // Sanity check
            newWorlds.push(w);
        }
        // TODO Only in recovery mode
        // TODO Iterate in loop above?
        const u = getResourceCountOfSlice(world[victim], 5);
        if (u > 0)
        {
            let w = deepCopy(world);
            const slice = generateSingularSlice(5);
            w[victim] -= slice;
            w[thief] += slice;
            w["chance"] = world["chance"] * u / totalRes;
            newWorlds.push(w);
        }
    }
    manyWorlds = newWorlds;

    // Stealing has uncertainty. Hence we create new worlds. Check duplicates.
    removeDuplicateWorlds();
}

// Branches by moving, in all worlds, 0 to U from victims unknown cards to the
// tolen resource. Where U is the number of unknown cards victim has.
function mwBranchRecoveryMonopoly(victimIdx, thiefIdx, resourceIndex)
{
    // Similar to branchSteal()

    let newWorlds = [];

    // For all existing worlds, create up to 5 new worlds, where each one of
    // the resources was stolen.
    for (const world of manyWorlds)
    {
        const totalRes = getResourceSumOfSlice(world[victimIdx]);
        const u = getResourceCountOfSlice(world[victimIdx], 5);

        const steal = generateSingularSlice(5);
        const take = generateSingularSlice(resourceIndex);
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
    manyWorlds = newWorlds;

    // Check duplicates after branching recovery monopoly
    removeDuplicateWorlds();
}

// Transform worlds by monopoly (branches in recovery)
function transformMonopoly(thiefName, resourceIndex)
{
    const thiefIdx = worldPlayerIndex(thiefName);
    // TODO Store world chance outside of world. Makes iterating better
    manyWorlds = manyWorlds.map( world =>
    {
        // Determine mono count
        let totalCount = 0;
        for (const player of players)   // Not for the "chance" entry
        {
            const n = getResourceCountOfSlice(world[player], resourceIndex);
            totalCount += n;
            world[player] -= generateSingularSlice(resourceIndex, n);
        }
//        log("total count in this world is:", totalCount,
//            "(should be same in all worlds: expenses are public)");

        // Give cards to thief
        world[thiefIdx] += generateSingularSlice(resourceIndex, totalCount);

        return world;
    });

    removeDuplicateWorlds();

    // TODO Collapse based on monopolied number of cards for recovery

    // Recovery mode branching
    for (victim of players)
    {
        const victimIdx = worldPlayerIndex(victim);
        if (victimIdx === thiefIdx) continue;
        mwBranchRecoveryMonopoly(victimIdx, thiefIdx, resourceIndex);
    }
}

// Measure sum of resources of a player (for monos)
function collapseSeven()
{
}

function collapseTotal(resourceIndex, count)
{
}

// Collapse to worlds where player has (at least) the content of 'slice' of
// each resource type. 'slice' must have only positive entries, only normal
// resources.
function mwCollapseMin(player, slice)
{
    // Sanity check
    if (sliceHasNegative(slice))
    {
        alertIf(37);
        console.error("[ERROR] mwCollapseMin mut take positive slices");
        return;
    }

    // Generate as-if stolen worlds (to filter)
    const pIdx = worldPlayerIndex(player);
    manyWorlds = manyWorlds.map(world =>
    {
        let tmp = world;
        tmp[pIdx] = mwFixOrNegative(tmp[pIdx] - slice);
        return tmp;
    });
    manyWorlds = manyWorlds.filter(world =>
    {
        // For recovery, also try if enough when including unknown cards
        return !sliceHasNegative(world[player]);
    });

    // Give back to obtain unalterd worlds that survive hypothetical steal
    mwTransformSpawn(player, slice);
}

// Discard if 8 or more cards
function mwCollapseMinTotal(player, count = 8)
{
    manyWorlds = manyWorlds.filter(world =>
    {
        // No recovery needed since card count is known in each world
        return getResourceSumOfSlice(world[player]) >= count;
    });
}

// Measure single resource of a player
/*
function collapseMin(player, resourceIndex, count = 1)
{
}
*/

// Measure single resource of a player
function collapseMax(player, resourceIndex, count = 0)
{
}

// Measure card-less players (when robber attempts fail)
function collapseEmpty(player)
{
}

// Measure single resource of a player
//
// (!) Not part of recovery mechanism! Because not used for games.
// TODO make it part of recovery mechanism or remove.
function collapseExact(player, resourceIndex, count)
{
    manyWorlds = manyWorlds.filter((world) =>
    {
        if (    getSingularSlice(world[player], resourceIndex)   // Actual count
            !== generateSingularSlice(resourceIndex, count))     // Expectation
        {
            return false;
        }
        return true;
    });
}

// Called internally after branching operations
function removeDuplicateWorlds()
{
    // Sort worlds, then remove idendical elements following each other
    manyWorlds = manyWorlds.sort((w1, w2) =>
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
        for (let p of players)
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
function normalizeManyWorlds()
{
    let sum = manyWorlds.reduce((sum, w) => sum + w["chance"], 0);
    manyWorlds.forEach(world =>
    {
        world["chance"] = world["chance"] / sum;
    });
}

//------------------------------------------------------------
// ManyWorlds getter
//------------------------------------------------------------

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

// The global analyis/stats object
// TODO collect in single object, then pass it to mwUpdateStats
let worldGuessAndRange = {};
let mwDistribution = {};
let mwBuildsProb = {};
let mwSteals = {};
let mwTotals = {};

// Generate
//  - Minimal resource distribution
//  - Maximal resource distribution
//  - Majority vote distribution
// At the moment has to be used with filled players and manyWorlds variables.
function mwUpdateStats()
{
    normalizeManyWorlds();

    // This function has 3 stages:
    //  1) Fill stats objects with 0s
    //  2) Iterate worlds to accumulate stats
    //  3) Update secondary objects derived from those stats

    for (player of players)
    {
        mwSteals[player] = deepCopy(emptyResourcesByNameWithU);
        mwBuildsProb[player] = deepCopy(mwBuilds);
        Object.keys(mwBuildsProb[player]).forEach(k => mwBuildsProb[player][k] = 0);
        mwDistribution[player] = {};
        for (res of [...resourceTypes, "unknown"])
        {
            // At most 19 cards because there are only 19 cards per resource
            //  Accumulated chance of player having exactly 4 of this resource
            //                                ~~~v~~~
            mwDistribution[player][res] = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
        }
    }

    // Count across all worlds
    // TODO Include unknown resources
    manyWorlds.forEach(w =>
    {
        for (player of players)
        {
            const totalPlayerRes = getResourceSumOfSlice(w[worldPlayerIndex(player)]);
            for (res of [...resourceTypes, "unknown"])
            {
                // For distribution
                const countInWorld = getResourceCountOfSlice(
                    w[worldPlayerIndex(player)],
                    worldResourceIndex(res));   // Helper uses indices
                mwDistribution[player][res][countInWorld] += w["chance"];
                // For steals
                if (countInWorld > 0)
                    mwSteals[player][res] += (countInWorld / totalPlayerRes) * w["chance"];
            }
            // For builds
            for (const [name, slice] of Object.entries(mwBuilds))
            {
                if (!sliceHasNegative(w[worldPlayerIndex(player)] - slice))
                    mwBuildsProb[player][name] += w["chance"];
            }
        }
    });

    // Generate most "likely" suggestion
    // TODO Possibly add different statistics: Mean, mode, other percentiles
    for (player of players)
    {
        for (res of [...resourceTypes, "unknown"])
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
            let maxIndex = mwDistribution[player][res].reduce((r, val, idx) =>
            {
                if (val != 0) r[0] = Math.min(r[0], idx);
                if (val > r[1]) { r[1] = val; r[2] = idx; }
                if (val != 0) r[3] = Math.max(r[3], idx);
                return r;
            }, range);
            worldGuessAndRange[player][res] = range;
        }
    }
    // For total card stats (doesnt matter which world is used)
    mwTotals = generateFullNamesFromWorld(manyWorlds[0]);
//    log2("Generated guess and range", worldGuessAndRange);
}

//------------------------------------------------------------
// ManyWorlds test
//------------------------------------------------------------

function worldTest()
{
    // Set dummy players array for tests
    players = ["A", "B", "C", "D"];

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
    initWorlds(resources);
    log("before any steal"); printWorlds();
    branchSteal("A", "C");
    log("after first steal"); printWorlds();
    branchSteal("C", "D");  // Measure first steal later on
    log("after second (measurement) steal"); printWorlds();
    branchSteal("B", "C");
    log("after third (confusion) steal"); printWorlds();
    collapseExact("D", worldResourceIndex(wood), 1);    // Measure first steal A -> C
    log("after exact measurement collapse (should leave only 1 option for A, 2 worlds total)"); printWorlds();

    let passedTest = true;
    if (manyWorlds.length !== 2)
    {
        passedTest = false;
        log("[ERROR] Failed ManyWorlds test1: world count failed");
        alertIf(20);
        debugger;
    }
    if (   manyWorlds[0]["A"] !== 64
        || manyWorlds[1]["A"] !== 64)
    {
        passedTest = false;
        log("[ERROR] Failed ManyWorlds test1: resources failed");
        alertIf(21);
        debugger;
    }
    mwUpdateStats();
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
        initWorlds(resources);
        log("before any steal"); printWorlds();
        branchSteal("A", "B");
        log("after first steal"); printWorlds();
        branchSteal("A", "B");
        log("after second steal (should have 2 worls left before unduplicating worlds)");
        printWorlds();
        removeDuplicateWorlds();
        log("After duplicate removal (should have only 1 world left"); printWorlds();
        logs("again as string:", manyWorlds);
        mwUpdateStats();

        if (manyWorlds.length !== 1)
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
    initWorlds(resources);
    log("before anything"); printWorlds();
    logs(manyWorlds);
    branchSteal("A", "B");
    log("after steal. should have 2 worlds now"); printWorlds();
    const offer  = {wood:"0", brick:"1", sheep:"0", wheat:"0", ore:"0"};
    const demand = {wood:"1", brick:"0", sheep:"0", wheat:"0", ore:"0"};
    transformTradeByName("B", "C", offer, demand);
    log("after first trade (should have 2 different worlds stile)"); printWorlds();
    transformTradeByName("B", "C", offer, demand);
    log("after second trade (should have collapsed to 1 world)"); printWorlds();
    logs("again as string:", manyWorlds);

    if (manyWorlds.length !== 1)
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
    initWorlds(resources);
    log("before anything"); printWorlds();
    logs(manyWorlds);
    branchSteal("A", "B");
    log("after steal. A and B add to a road. D has a wood."); printWorlds();
    logs(manyWorlds);
    transformMonopoly("C", worldResourceIndex(wood));
    log("after monopoly. either B or A have a brick, C has 2 wood."); printWorlds();
    logs(manyWorlds);
    mwUpdateStats();
    collapseExact("B", worldResourceIndex(brick), 0);
    log("After measuring B's brick, A has the brick, B nothing, C has 2 wood."); printWorlds();
    logs("again as string:", manyWorlds);
    mwUpdateStats();

    if (  manyWorlds.length  !== 1
       || manyWorlds[0]["C"] !== 2
       || manyWorlds[0]["B"] !== 0
       || manyWorlds[0]["A"] !== 64)
    {
        log("[ERROR] Failed ManyWorlds test4: monopoly");
        alertIf(25);
        debugger;
    }
    else
    {
        log("[NOTE] ManyWorlds test4 (monopoly) passed");
    }

    // Test 5: Guess and Range.
    //  1) Player A starts with 10 wood. 5 brick. 1 sheep.
    //  2) Player B steals 5 times from A.
    //  3) - Most likely, player B took wood. Verify the range and guess.
    //  4) Player B is measured to have exactly 1 wood.
    //  5) - Now most likely, B has stolen a lot of brick. Verify the range&guess.
    log("----------------------- MW TEST 5 -------------------------------");
    passedTest = true;
    resources = { "A": {wood:10,brick:5,sheep:1,wheat:0,ore:0},  // unknown
                  "B": {wood:0,brick:0,sheep:0,wheat:0,ore:0},  // Masking
                  "C": {wood:0,brick:0,sheep:0,wheat:0,ore:0},  // Dummy for trading
                  "D": {wood:0,brick:0,sheep:0,wheat:0,ore:0} };
    initWorlds(resources);
    log("before anything (5)"); printWorlds();
    logs(manyWorlds);
    for (i in [...Array(5).keys()])
    {
        branchSteal("A", "B");
    }
    log("after stealing 5 times. Most likely, B stole wood (some brick)"); printWorlds();
    mwUpdateStats();
    // Now we expect B not to have taken the 1 sheep in just 5 trades
    if (   worldGuessAndRange["B"]["sheep"][2] !== 0
        || worldGuessAndRange["B"]["sheep"][1] < 0.5) { passed = false; }
    log2(worldGuessAndRange);
    collapseExact("B", worldResourceIndex(wood), 1);
    log("After collapsing B's wood. implies 4 steals {brick,sheep}. world:", manyWorlds);
    printWorlds();
    mwUpdateStats();
    log2("guess&range:", worldGuessAndRange);
    // Now it is likely that B took the sheep
    if (   worldGuessAndRange["B"]["sheep"][2] !== 1
        || worldGuessAndRange["B"]["sheep"][1] < 0.5) { passed = false; }

    if (!passedTest)
    {
        log("[ERROR] Failed ManyWorlds test5: guess and range");
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
    initWorlds(resources);
    log("before anything (6)"); printWorlds();
    mwTransformSpawn("A", 65);
    log("after spawning A a road"); printWorlds();
    mwUpdateStats();
    branchSteal("A", "B");
    log("After stealing from A"); printWorlds();
    mwUpdateStats();
    mwTransformSpawn("A", -1);
    log("after un-spawning a wood from A. B has a brick left now."); printWorlds();
    mwUpdateStats();

    if (manyWorlds.length !== 1 || worldGuessAndRange["B"][brick][2] !== 1
                                || worldGuessAndRange["B"][brick][1] < 0.99)
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
    initWorlds(resources);
    log("before anything (7)"); printWorlds();
    const counts = {"A": 2, "B": 2, "C": 0, "D": 0};
    mwCardRecovery(counts);
    log("after entering recovery mode, 2*U each"); printWorlds();
    if (getResourceCountOfSlice(manyWorlds[0]["A"], 5) != 2) passed = false;
    const woodOffer = {wood: 1, brick: 0, sheep:0, wheat: 0, ore:0};
    const revealedSlice = generateFullSliceFromNames(woodOffer);
    mwCollapseMin("A", revealedSlice);
    log("After A reveales wood"); printWorlds();
    const brickDemand = {wood: 0, brick: 1, sheep:0, wheat: 0, ore:0};
    transformTradeByName("A", "B", woodOffer, brickDemand);
    log("after A trading wood to B for brick"); printWorlds();
    branchSteal("A", "B");
    log("After steal A -> B. 2 worlds left"); printWorlds();
    transformMonopoly("A", worldResourceIndex(wood));
    log("After A monos wood. 5 worlds"); printWorlds();
    if (manyWorlds.length !== 5) passed = false;
    mwCollapseMinTotal("B", 2);
    log("After B reveals count >= 2. 2 worlds left"); printWorlds();
    if (manyWorlds.length !== 2) passed = false;
    const sheepOffer = {wood: 0, brick: 0, sheep:1, wheat: 0, ore:0};
    mwCollapseMin("A", generateFullSliceFromNames(sheepOffer));
    log("After a offers sheep (unknown before). 1 world left with B=brick+U"); printWorlds();
    const wheatDemand = {wood: 0, brick: 0, sheep:0, wheat: 1, ore:0};
    transformTradeByName("A", "B", sheepOffer, wheatDemand);
    log("After last trade. Full recovery into all-known world, 1 version, no unknown"); printWorlds();
    if (manyWorlds.length !== 1) passed = false;
    mwUpdateStats();
    if (manyWorlds.length !== 1 || worldGuessAndRange["B"][brick][2] !== 1
                                || worldGuessAndRange["B"][brick][1] < 0.99)
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
    initWorlds(resources);
    log("Before anything"); printWorlds();
    debugger;
    transformMonopoly("B", 2);
    log("After B monos the sheep. World should not be corrupt."); printWorlds();
    mwUpdateStats();
    if (manyWorlds.length === 0) passed = false;
    else if (manyWorlds.length !== 4) passed = false;
    else if (getResourceCountOfSlice(manyWorlds[0]["A"],
             worldResourceIndex(wood)) !== 0) passed = false;
    else if (getResourceSumOfSlice(manyWorlds[0]["A"]) > 5) passed = false;
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

    debugger;
}

if (configRunManyWorldsTest === true)
{
    worldTest();
}

//============================================================

// First, delete the discord signs
function deleteDiscordSigns() {
    let allPageImages = document.getElementsByTagName('img');
    for(let i = 0; i < allPageImages.length; i++)
    {
        if (allPageImages[i].src.includes("discord"))
        {
            allPageImages[i].remove();
        }
    }
    ad_left = document.getElementById("in_game_ab_left");
    ad_right = document.getElementById("in_game_ab_right");
    if (ad_left) { ad_left.remove(); }
    if (ad_right) { ad_right.remove(); }
    log("Removed elements");
}

function getOwnStuffImage(whichSnippet)
{
    const path = assets[whichSnippet];
    if (!configOwnIcons || path === undefined)
    {
        return getStuffImage(whichSnippet);
    }
    const url = browser.runtime.getURL(path);
    // TODO Create new CSS class for our own assets
    const elem = `<img src="${url}" class="explorer-tbl-resource-icon" />`;
    return elem;
}

// <img src="/dist/images/settlement_blue.svg?v159" alt="settlement" class="lobby-chat-text-icon" width="20" height="20">
function getStuffImage(whichSnippet)
{
    const fullName = `<img src="dist/images/${imageNameSnippets[whichSnippet]}.svg" class="explorer-tbl-resource-icon" />`;
    return fullName;

    /* TODO Remove this old version
    switch (resourceType) {
        case wheat:
            img_name = "card_grain";
            break;
        case ore:
            img_name = "card_ore";
            break;
        case sheep:
            img_name = "card_wool";
            break;
        case brick:
            img_name = "card_brick";
            break;
        case wood:
            img_name = "card_lumber";
            break;
        case "road": im
    }
    if (!img_name.length) throw Error("Couldn't find resource image icon");
    // TODO Not use colonist resources when used outside of colonist?
    return `<img src="https://colonist.io/dist/images/${img_name}.svg" class="explorer-tbl-resource-icon" />`
    */
}

function renderPlayerCell(player) {
    const gar = worldGuessAndRange[player]["unknown"];
    const stealProb = Math.round(mwSteals[player]["unknown"] * 100);
    const unknownString = gar[3] === 0
                        ? ""
                        : ` + ${gar[2]} (${Math.round(gar[1] * 100)}%) | ${stealProb}%`;
    return `<div class="explorer-tbl-player-col-cell-color" style="background-color:${player_colors[player]}"></div>
        <span class="explorer-tbl-player-name" style="color:${player_colors[player]}">${player}</span>
        <span class="explorer-tbl-unknown-stats">${unknownString}</span>`;
}

let messageNumberDone = -1;
function isNewMessage(msgNumber) {
    if (msgNumber > messageNumberDone)
    {
        messageNumberDone = msgNumber;
        return true;
    }
    return false;
}

// Temporary helper
function exportCurrentMW()
{
    mwUpdateStats();
    console.log("mwHumanReadableWorld:");
    console.log(p(mwHumanReadableWorld()));
    console.log("worldGuessAndRange:");
    console.log(p(worldGuessAndRange));
    console.log("mwDistribution:");
    console.log(p(mwDistribution));
    log("[NOTE] Exportet current ManyWorlds state above");
}

function fillElementWithPlot(element)
{
    plotResourcesAsBubbles(element.id);
}

function unrender()
{
    try
    {
        let p = document.getElementById(bubblePlotId);
        if (p) { p.remove(); }
        let t = document.getElementById(tableId);
        if (t) { t.remove(); }
    }
    catch(e)
    {
        // We don't really care if this fails at the moment, but it might help
        // identify bugs.
        console.warn("[WARNING] Exc. in unrender():", e);
    }
}

/**
* Renders the table with the counts.
*/
// TODO take data to-be displayed as input?
function render(force = false)
{
    if (force === false && isNewMessage(MSG_OFFSET) === false)
    {
        log("Skip display update");
        return;
    }
    log("Updaing display...");

    // TODO Draw only once then only change text content later

    // TODO generate and return stats object?
    mwUpdateStats();     //TODO circumvents souldRenderTable()

    // Display
    let body = document.getElementsByTagName("body")[0];

    // Display plot
    if (configPlotBubbles === true)
    {
        let existingPlot = document.getElementById(bubblePlotId);
        try { if (existingPlot) { existingPlot.remove(); } }
        catch (e) { console.warn("had an issue deleting the plot", e); }
        let plt = document.createElement("plot");
        plt.id = bubblePlotId;
//        plt.class = "plot-window";
        body.appendChild(plt);
        fillElementWithPlot(plt);
    }

    // Display table
    let existingTbl = document.getElementById(tableId);
    try { if (existingTbl) { existingTbl.remove(); } }
    catch (e) { console.warn("had an issue deleting the table", e); }
    let tbl = document.createElement("table");
    tbl.id = tableId;

    tbl.setAttribute("cellspacing", 0);
    tbl.setAttribute("cellpadding", 0);

    // Header row - one column per resource, plus player column
    let header = tbl.createTHead();
    header.className = "explorer-tbl-header";
    let headerRow = header.insertRow(0);
    let playerHeaderCell = headerRow.insertCell(0);
    playerHeaderCell.innerHTML = "Guess (Pr)<br>Steal Pr";
    playerHeaderCell.className = "explorer-tbl-player-col-header";
    for (let i = 0; i < resourceTypes.length; i++) {
        let resourceType = resourceTypes[i];
        let resourceHeaderCell = headerRow.insertCell(i + 1);
        resourceHeaderCell.className = "explorer-tbl-cell";
        const total = mwTotals[resourceType];
        const numberString = total > 0
                           ? `${total}`
                           : "";
        resourceHeaderCell.innerHTML = numberString + getOwnStuffImage(resourceType);
        if (i === 0)
        {
            let e = document.getElementById("testwood");
            if (e)
                log("e.src:", e.src);
//            e.src = "chrome://ColonistCardCounter/wood1.jpg";
        }
    }
    let i = resourceTypes.length + 1;
    for (const [i, v] of Object.keys(mwBuilds).entries())
    {
        let headerCell = headerRow.insertCell(i + 1 + resourceTypes.length);
        headerCell.className = "explorer-tbl-cell";
        headerCell.innerHTML = getOwnStuffImage(v);
    }

//    playerHeaderCell.addEventListener("click", exportCurrentMW, false);
    playerHeaderCell.addEventListener("click", mwManualFullRecovery, false);

    // Create bubble plot data
    // TODO

    let tblBody = tbl.createTBody();
    tblBody.addEventListener("click", mwManualRecoverCards, false);
    // Row per player
    for (let i = 0; i < players.length; i++) {
        const player = players[i];
        let row = tblBody.insertRow(i);
        row.className = "explorer-tbl-row";
        let playerRowCell = row.insertCell(0);
        playerRowCell.className = "explorer-tbl-player-col-cell";
        playerRowCell.innerHTML = renderPlayerCell(player);
        for (let j = 0; j < resourceTypes.length; j++)
        {
            const res = resourceTypes[j];
            let cell = row.insertCell(j + 1);
            cell.className = "explorer-tbl-cell";
            let resourceType = resourceTypes[j];
            const resCount = worldGuessAndRange[player][res][2]; // Guess
            const fraction = worldGuessAndRange[player][res][1]; // Fraction
            const percentString = fraction > 0.999 ? "" : `<span style="font-weight:lighter">(${Math.round(fraction * 100)}%)</span>`;
            cell.innerHTML = worldGuessAndRange[player][res][3] === 0
                           ? "" // Display nothing if guaranteed 0 amount available
                           : `${resCount}${percentString}<br><span style="font-weight:lighter">${Math.round(mwSteals[player][res] * 100)}%</span>`;
        }
        // Copy the cell-adding for resource
        let j = resourceTypes.length + 1;
        let addBuildFunc = b =>
        {
            const chance = mwBuildsProb[player][b];
            let cell = row.insertCell(j);
            cell.className = "explorer-tbl-cell";
            cell.innerHTML = chance < 0.001
                           ? "" // Show nothing if very unlikely
                           : `<span style="font-weight:lighter">${Math.round(chance * 100)}%</span>`;
            ++j;
        };
        Object.keys(mwBuilds).forEach(addBuildFunc);
    }

    body.appendChild(tbl);

    tbl.setAttribute("border", "2"); // (?)

    log("Updated tracker display");
}

/**
 * Find where the first non-initial message is.
 *
 * Iterate all messages, keeping track of last placement message. Return
 * 1 + index of last such message.
 */
function computeInitialPhaseOffset(messages)
{
    let lastPlacementMessage = 0;
    messages.forEach
    (
        (msg, i) =>
        {
            let text = msg.textContent;
            if (text.includes(placeInitialSettlementSnippet))
            {
                lastPlacementMessage = Math.max(lastPlacementMessage, i);
            }
        }
    );
    log("Found last placement message at index", lastPlacementMessage);
    return lastPlacementMessage + 1;
}

/**
* Process initial resource message after placing first settlement.
*/
function parseInitialGotMessage(pElement)
{
    const textContent = pElement.textContent;
    if (!textContent.includes(receivedInitialResourcesSnippet))
    {
        return;
    }
    const player = textContent.replace(receivedInitialResourcesSnippet, "").split(" ")[0];
    if (!players.includes(player))
    {
        console.error("[ERROR] Failed to identify player for initial resources");
        alertIf(34);
        return;
    }

    // ManyWorlds version
    const initialResourceTypes = findAllResourceCardsInHtml(pElement.innerHTML);
    const asSlice = generateWorldSlice(initialResourceTypes);
    logs("[INFO] First settlement resources:", player, "<-", initialResourceTypes);
    if (asSlice === 0) { console.warn("[WARNING] Empty starting resources"); }
    mwTransformSpawn(player, asSlice);
}

function parseTradeOffer(element)
{
    const txt = element.textContent;
    if (!txt.includes(tradeOfferSnippet))
    {
        return true;
    }

    const player = txt.substring(0, txt.indexOf(" "));
    if (!players.includes(player))
    {
        log("[ERROR] Failed to identify trader. | Got:", player);
        alertIf(36);
        return;
    }

    const offerHtml = element.innerHTML.split(tradeOfferResSnippet)[0];
    const offer = findAllResourceCardsInHtml(offerHtml);
    const asSlice = generateWorldSlice(offer);
    logs("[INFO] Trade offer:", player, "->", offer);
    mwCollapseMin(player, asSlice);
    printWorlds();

    return false;
}

function parseYearOfPlenty(element)
{
    let textContent = element.textContent;
    if (!textContent.includes(yearOfPlentySnippet))
    {
        return true;
    }

    // Determine player
    let beneficiary = textContent.substring(0, textContent.indexOf(yearOfPlentySnippet));
    if (!players.includes(beneficiary))
    {
        log("[ERROR] Failed to identify YOP beneficiary.",
                    "| Got:", beneficiary, "| from textContent:", textContent);
        alertIf(11);
        return;
    }

    // ManyWorlds version
    let obtainedResources = findAllResourceCardsInHtml(element.innerHTML);
    logs("[INFO] Year of Plenty:", player, "<-", obtainedResources);
    const asSlice = generateWorldSlice(obtainedResources);
    mwTransformSpawn(beneficiary, asSlice);
    printWorlds();

    return false;
}

/**
* Process a "got resource" message: [user icon] [user] got: ...[resource images]
*/
function parseGotMessage(pElement) {
    let textContent = pElement.textContent;
    if (textContent.includes(receivedResourcesSnippet))
    {
        const player = textContent.substring(0, textContent.indexOf(receivedResourcesSnippet));
        if (!players.includes(player))
        {
            log("[ERROR] Failed to parse got-message player", player);
            alertIf(14);
            return;
        }

        // ManyWorlds version
        let obtainedResources = findAllResourceCardsInHtml(pElement.innerHTML);
        let asSlice = generateWorldSlice(obtainedResources);
        logs("[INFO] Got resources:", player, "<-", obtainedResources);
        mwTransformSpawn(player, asSlice);
        printWorlds();

        return false;
    }

    return true;
}

/**
 * Process a "built" message: [user icon] [user] built a [building/road]
 */
function parseBuiltMessage(pElement) {
    let textContent = pElement.textContent;
    if (!textContent.includes(builtSnippet)) {
        return true;
    }
    let images = collectionToArray(pElement.getElementsByTagName('img'));
    let player = textContent.split(" ")[0];
    if (!players.includes(player))
    {
        log("[ERROR] Failed to parse building player", player, resources);
        alertIf(15);
        return;
    }
    let buildResources = deepCopy(emptyResourcesByName);
    let building = false;
    for (let img of images)
    {
        if (img.src.includes("road")) {
            buildResources[wood] = -1;
            buildResources[brick] = -1;
            building = true;
            break;
        } else if (img.src.includes("settlement")) {
            buildResources[wood] = -1;
            buildResources[brick] = -1;
            buildResources[sheep] = -1;
            buildResources[wheat] = -1;
            building = true;
            break;
        } else if (img.src.includes("city")) {
            buildResources[wheat] = -2;
            buildResources[ore] = -3;
            building = true;
            break;
        }
//        else
//        {
//            continue;
//        }
    }
    if (!building)
    {
        console.error("[ERROR] Build message without building");
        alertIf(31);
    }

    // ManyWorlds version
    let asSlice = generateWorldSlice(buildResources);
    logs("[INFO] Built:", player, buildResources);
    mwTransformSpawn(player, asSlice);
    printWorlds();

    return false;
}

/**
 * For dev cards. parseDevCard
 */
function parseBoughtMessage(pElement) {
    let textContent = pElement.textContent;
    if (!textContent.includes(boughtSnippet)) {
        return true;
    }
    let images = collectionToArray(pElement.getElementsByTagName('img'));
    let player = textContent.split(" ")[0];
    if (!players.includes(player))
    {
        // TODO common identify-player subroutine
        console.error("[ERROR] Failed to parse player...", player, resources);
        return;
    }

    // ManyWorlds version
    let devCardResources = deepCopy(emptyResourcesByName);
    devCardResources[sheep] = -1;
    devCardResources[wheat] = -1;
    devCardResources[ore  ] = -1;
    const devCardSlice = generateWorldSlice(devCardResources);
    logs("[INFO] Baught dev card:", player, "->", devCardResources);
    mwTransformSpawn(player, devCardSlice);
    printWorlds();

    return false;
}

/**
 * Process a trade with the bank message: [user icon] [user] gave bank: ...[resources] and took ...[resources]
 */
function parseTradeBankMessage(pElement)
{
    let textContent = pElement.textContent;
    if (!textContent.includes(tradeBankGaveSnippet))
    {
        return true;
    }
    let player = textContent.split(" ")[0];
    if (!players.includes(player))
    {
        log("Failed to parse player...", player, resources);
        alertIf(34);
        return;
    }
    // We have to split on the text, which isn't wrapped in tags, so we parse innerHTML, which prints the HTML and the text.
    let innerHTML = pElement.innerHTML;
    let gavebank = innerHTML.slice(innerHTML.indexOf(tradeBankGaveSnippet), innerHTML.indexOf(tradeBankTookSnippet)).split("<img");
    let andtook = innerHTML.slice(innerHTML.indexOf(tradeBankTookSnippet)).split("<img");

    // ManyWorlds version
    // TODO Not sure if the string snippets should be global or local
    const gaveAndTook = pElement.innerHTML.split(" and took ");
    if (gaveAndTook.length !== 2)
    {
        log("[ERROR] Expected 2 substrings after split in dev card parser");
        alertIf(27);
        return;
    }
    const giveResources = findAllResourceCardsInHtml(gaveAndTook[0]);
    const takeResources = findAllResourceCardsInHtml(gaveAndTook[1]);
    const giveSlice     = generateWorldSlice(giveResources);
    const takeSlice     = generateWorldSlice(takeResources);
    logs("[INFO] Traded with bank:", player, giveResources, "->", takeResources);
    mwTransformSpawn(player, takeSlice - giveSlice);
    printWorlds();

    return false;
}

// Parse monopoly steals
//
// TODO: Use info to determine unknown resources.
//
// Example HTML content:
//  John#1234 stole 2: <img...>
//
// Monopoly lines contain "stole" but do NOT contain a "from:" since they steal
// from everyone.
// Note: I dont know what happens with a 0-cards mono.
function parseMonopoly(element)
{
    // Identify if a monopoly message is found
    let textContent = element.textContent;
    if ( !textContent.includes(monoStoleSnippet)
       || textContent.includes(monoFromSnippet ))
    {
        return true;
    }

    // Identify thief
    const thief = textContent.substring(0, textContent.indexOf(" "));

    // Sanity check
    if (!players.includes(player))
    {
        log("[ERROR] Failed to identify thief for monopoly.",
                    "| Got:", thief, "| from textContent:", textContent);
        alertIf(10);
        return;
    }

    // ManyWorlds version
    const stolenResource = findSingularResourceImageInElement(element);
    logs("[INFO] Monopoly:", thief, "<-", stolenResource);
    transformMonopoly(thief, worldResourceIndex(stolenResource));
    printWorlds();

    return false;
}

/**
 * When the user has to discard cards because of a robber.
 */
function parseDiscardedMessage(pElement) {
    let textContent = pElement.textContent;
    if (!textContent.includes(discardedSnippet)) {
        return true;
    }
    const player = textContent.substring(0, textContent.indexOf(discardedSnippet));
    if (!players.includes(player))
    {
        log("[ERROR] Failed to parse discarding player |", player, resources);
        alertIf(13);
        return;
    }

    // ManyWorlds version
    const discarded = findAllResourceCardsInHtml(pElement.innerHTML);
    const discardedCardsAsSlie = generateWorldSlice(discarded);
    logs("[INFO] Discarded:", player, "->", discarded);
    mwCollapseMinTotal(player); // Total can be unknown to MW after monopoly
    mwTransformSpawn(player, -discardedCardsAsSlie);
    printWorlds();

    return false;
}

/**
 * Parse trade messages.
 *
 * Example HTML content:
 *  Julius traded: <img...><img...> for: <img...> with: John#1234
 * Note: Contains 3 colons, resulting in 4 sections after split(":"). Middle
 *       two sections contain the resource imgages.
 */
function parseTradeMessage(element)
{
    // Identify trading messages
    let textContent = element.textContent;
    if (!textContent.includes(tradeSnippet))
    {
        return true;
    }

    // Determine trading players
    let involvedPlayers = textContent.split(tradeSnippet);
    let tradingPlayer = involvedPlayers[0];
    let otherPlayer = involvedPlayers[1];

    // Sanity check
    if (!players.includes(tradingPlayer) || !players.includes(otherPlayer))
    {
        log("[ERROR] Failed to parse trading players:",
                    tradingPlayer, otherPlayer, "| in the text content:",
                    textContent, "| given resource array:", resources);
        alertIf(7);
        return;
    }

    // Split HTML at colons to separate sending from receiving resources
    let split = element.innerHTML.split(tradeSplitSnippet);
    if (split.length !== 2) // Sanity check
    {
        log("[ERROR] Expected 4 parts when parsing trading message.",
                    "Got:", split);
        log(" [NOTE] InnerHTML:", element.innerHTML);
        alertIf(7);
        return;
    }
    let offer = findAllResourceCardsInHtml(split[0]);
    let demand = findAllResourceCardsInHtml(split[1]);

    // ManyWorlds version
    logs("[INFO] Trade:", offer, tradingPlayer,
        "--> | <--", otherPlayer, demand);
    transformTradeByName(tradingPlayer, otherPlayer, offer, demand);
    printWorlds();

    return false;
}

// Parse steal including "you" or "You"
//
// Example text content we want to parse:
//  You stole:  from: Isabel
//  Isabel stole:  from you
function parseStealIncludingYou(pElement)
{
    let textContent = pElement.textContent;

    // Detect desired message type
    // TODO Have a function matchPlayers(string) --> [involved, players]
    let containsYou = textContent.includes("You") || textContent.includes("you");
    let containsStealSnippet = textContent.includes(stealingSnippet);
    if (!containsYou || !containsStealSnippet)  // (!)
    {
        return true;
    }

    // Obtain player names
    let involvedPlayers = textContent
        .replace(/\:/g, "")   // One version has an extra colon // TODO Now obsolete
        .replace(stealingSnippet, " ") // After this only the names are left
        .split(" ");

    // Replace player name
    if      (involvedPlayers[0] === "You" || involvedPlayers[0] === "you")
    {        involvedPlayers[0] = playerUsername; }
    else if (involvedPlayers[1] === "You" || involvedPlayers[1] === "you")
    {        involvedPlayers[1] = playerUsername; }
    else
    {
        console.error("[ERROR] Expected", playerUsername, "in known steal");
        alertIf(33);
        return;
    }

    // Sanity check
    let stealingPlayer = involvedPlayers[0];
    let targetPlayer = involvedPlayers[1];
    log("Steal between", stealingPlayer, "and", targetPlayer);
    if (!players.includes(stealingPlayer) || !players.includes(targetPlayer))
    {
        log("[ERROR] Failed to steal. Invalid parse of player(s):",
                    stealingPlayer, "|", targetPlayer);
        alertIf(3);
        return;
    }

    let stolenResourceType = findSingularResourceImageInElement(pElement);

    // ManyWorlds version (treating it as a trade)
    logs("[INFO] Steal:", targetPlayer, "->", stealingPlayer, "(", stolenResourceType, ")");
    transformExchange(targetPlayer, stealingPlayer, // source, target
        generateSingularSlice(worldResourceIndex(stolenResourceType)));
    printWorlds();

    return false;
}

/**
 * Handles messages with steals that do not include the player.
 *
 * In this type of steal, the player names are given directly, but the resource
 * is unknown.
 */
function parseStealFromOtherPlayers(pElement)
{
    let textContent = pElement.textContent;

    // Detect desired message type
    let containsYou = textContent.includes("You") || textContent.includes("you");
    let containsStealSnippet = textContent.includes(stealingSnippet);
    if (containsYou || !containsStealSnippet)   // (!)
    {
        return true;
    }

    // Obtain player names
    let involvedPlayers = textContent
        .replace(/\:/g, "")   // One version has an extra colon
        .replace(stealingSnippet, " ") // After this only the names are left
        .split(" ");

    // Replace player name
    if (involvedPlayers[0] === "You" || involvedPlayers[0] === "you")
    {
        involvedPlayers[0] = playerUsername;
        alertIf(28); return; // Should never happen
    }
    if (involvedPlayers[1] === "You" || involvedPlayers[1] === "you")
    {
        involvedPlayers[1] = playerUsername;
        alertIf(29); return; // Should never happen
    }

    // Sanity check
    let stealingPlayer = involvedPlayers[0];
    let targetPlayer = involvedPlayers[1];
    if (!players.includes(stealingPlayer) || !players.includes(targetPlayer))
    {
        log("[ERROR] Failed to steal. Invalid parse of players:",
                    stealingPlayer, targetPlayer);
        alertIf(5);
        return;
    }

    // ManyWorlds version
    logs("[INFO] Steal:", targetPlayer, "->", stealingPlayer);
    branchSteal(targetPlayer, stealingPlayer);
    printWorlds();

    return false;
}

function parseWin(element)
{
    // TODO This includes player names (!). Use longer snippet.
    if (element.textContent.includes(winSnippet))
    {
        stopMainLoop();
        unrender();
        log("[INFO] End of Game");

        // TODO find a way to start again without immediately
        // re-discovering the gamelog-text element of the just-finished
        // game. startTracker() would do this.
//        startTracker();

        // By adding findTranscription() as callback, we wait for
        // player to be found (again), i.e., game to be left.
        const retryDelay = Number(prompt("Restart in minutes (0 to quit):",
                                         1));
        if (retryDelay > 0)
        {
            log("[NOTE] Restarting in", retryDelay, "seconds");
            setTimeout(startTracker, 60000 * retryDelay);
        }
        else
        {
            log("[NOTE] Not restarting");
        }
        return false;
    }
    return true;
}

// (!) Returns name of the player who's turn it is (not true/false like the
// other parsers). Returns null if no player found. This is useful to keep the
// order of occurence constant.
function parseTurnName(element)
{
    // Include only snippets that identify current user by name
    const txt = element.textContent;
    if (  txt.includes(tradeOfferSnippet)
       || txt.includes(yearOfPlentySnippet)
       || txt.includes(builtSnippet)
       || txt.includes(boughtSnippet)
       || txt.includes(rolledSnippet))
    {
        const actor = txt.substring(0, txt.indexOf(" "));
        const html = element.innerHTML;
        const colStr = "color:";
        const start = html.indexOf(colStr) + colStr.length;
        const stop = html.indexOf("\"", start + 1);
        const colour = html.substring(start, stop);
        return [actor, colour];
    }
    return [null, null];
}

// The parser, parseInitialGotMessage() is not included in this list. We call
// use it one at the start, not regularly. The parseTurnName() parse is also not
// included. Used for recovery. // TODO Use during regular startup?
let ALL_PARSERS = [
    parseGotMessage,
    parseTradeOffer,

    parseStealFromOtherPlayers, // TODO rename pair to stealKnwon vs. stealUnknown
    parseStealIncludingYou,
    parseTradeBankMessage,
    parseTradeMessage,
    parseDiscardedMessage,
    parseBuiltMessage,
    parseBoughtMessage,
    parseMonopoly,
    parseYearOfPlenty,

    parseWin,
];

function getNewMessages()
{
    const allMessages = getAllMessages();
    const newMessages = allMessages.slice(MSG_OFFSET);
    MSG_OFFSET = allMessages.length;
    return newMessages;
}

/**
 * Parses the latest messages and re-renders the table.
 */
function parseLatestMessages() {
    let newMessages = getNewMessages();

    newMessages.forEach((msg, idx) =>
    {
        if (configLogMessages === true)
            console.log("[NOTE] Msg", MSG_OFFSET + idx, "|", msg.textContent);
        ALL_PARSERS.every(parser =>
        {
            return parser(msg);
        });
        if (configLogWorldCount === true)
            console.log("[NOTE] MW count:", manyWorlds.length);
    });

    if (manyWorlds.length === 0)
    {
        console.error("[ERROR] No world left");
        alertIf("Tracker OFF: Inconsistency (no world left). Try recovery mode.");
        stopMainLoop();
        return;
    }

    render();
}

/**
* Log initial resource distributions.
*/
function comeMrTallyManTallinitialResource() {
    let allMessages = getAllMessages();

    initWorlds();   // Requires existing users
    allMessages.forEach(parseInitialGotMessage);
    printWorlds();

    let correctedOffset = computeInitialPhaseOffset(allMessages);
    log("Correcting MSG_OFFSET from", MSG_OFFSET, "to", correctedOffset);
    MSG_OFFSET = correctedOffset;

    render();
}

// Assumes playerUsername has been set. Rotates that player to last position.
function adjustPlayersByUsername()
{
    // Determine our own name
    if (configFixedPlayerName || !playerUsername)
    {
        if (!configFixedPlayerName)
        {
            log("[WARNING] Username not found. Using fixed name.");
        }
        playerUsername = configPlayerName;
    }

    // Rotate 'players' so that we are in 4th position
    const ourPosition = players.indexOf(playerUsername);
    const rotation = players.length - ourPosition - 1;
    if (ourPosition < 0)
    {
        console.error("[ERROR] Username not part of players");
        alertIf(32);
        debugger;
        return;
    }
    const unrotatedCopy = deepCopy(players);
    for (let i = 0; i < players.length; ++i)
    {
        players[(i + rotation) % players.length] = unrotatedCopy[i];
    }
    for (const p of players)
    {
        log("[NOTE] Found player:", p);
    }
    log("[NOTE] You are:", playerUsername);
}

// Do the job of recognizeUsers() but rewrite it so that it works mid game for
// recovery. Must stop main loop before running this so they dont interfere.
function recoverUsers(playerCount, then)    // TODO JS can not pause at all?!
{
    players = [];   // Start clean
    player_colors = {};
    // NOTE If we make sure not to read initial placement messages, we can set
    //      MSG_OFFEST to 0, too. Those can appear out-of-player-order, and we
    //      imply the order from messages.
    //MSG_OFFSET = 0;
    const left = () => playerCount - players.length;

    // We abuse intervals to construct while(!ready){ foo(); sleep(5s); }
    let recoverInterval = setInterval(() =>
    {
        if (left() === 0)   // Aka. Leaving while loop
        {
            clearInterval(recoverInterval);
            adjustPlayersByUsername(); // Assumes the username was not changed
            then(); // Continue after "while" loop
        }
        log(`[NOTE] Searchin for ${left()} player names`);
        const newMsg = getNewMessages();
        for (msg of newMsg)
        {
            const [name, colour] = parseTurnName(msg);
            if (name === null) continue;
            if (!players.includes(name))
            {
                players.push(name);
                player_colors[name] = colour;
                log("Recoverd player", name, "with colour", colour);
            }
        }
    }, 5000);   // Aka. sleep(5s)
}

/**
 * Once initial settlements are placed, determine the players.
 */
// TODO I think at this point recoverUsers is simpler. reokace with recoverUsers().
function recognizeUsers() {
    players = [];
    player_colors = {}; // Not technically necessary because used as map (dict)
    log("[NOTE] Cleared players. Recognizing...");
    let placementMessages = getAllMessages().filter(
        msg => msg.textContent.includes(placeInitialSettlementSnippet));
    for (let msg of placementMessages)
    {
        // Message starts with player name
        msg_text = msg.textContent;
        username = msg_text.replace(placeInitialSettlementSnippet, "").split(" ")[0];

        if (!players.includes(username))
        {
            players.push(username);

            // Check settle image for a colour
            let images = collectionToArray(msg.getElementsByTagName("img"));
            for (let image of images)
            {
                let str = image.src;
                // Settlement is placed first, so we assume we find it before
                // the road. Example HTML:
                //  <img src="/dist/images/road_blue.svg?v159" alt="road" class="lobby-chat-text-icon" width="20" height="20">
                let front = "settlement_";
                let back = ".svg"; // Images are .svg currently
                let colorName = str.substring(
                    str.indexOf(front) + front.length,  // ?? For some reason no +1 needed
                    str.indexOf(back)
                );
                // We assume that the colorName string is a valid colour word.
                // Would not work for fancy colours.
                player_colors[username] = colorName;
            }
        }
        else
        {
            // User was seen before (this is the initial road placement msg)
//            log("Skip re-recognizing existing user", username);
        }
    }
    adjustPlayersByUsername();
}

function findPlayerName(then = null)
{
    log("[NOTE] START searching profile name");
    let findPlayerInterval = setInterval(() =>
    {
        if (playerUsernameElement !== null)
        {
            clearInterval(findPlayerInterval);
            playerUsername = deepCopy(playerUsernameElement.textContent);
            console.log("[NOTE] Found profile:", `"${playerUsername}"`);

            let e = document.getElementById("header_navigation_store");
            if (e !== null) e.textContent = atob("VHJhY2tlciBPSw==");

            if (then !== null)
                then();
        }
        else
        {
            playerUsernameElement = document.getElementById("header_profile_username");
        }
    }, 2000);
}

function getAllMessages() {
    if (!logElement) {
        alertIf(41);
        throw Error("Log element hasn't been found yet.");
    }
    return collectionToArray(logElement.children);
}

function collectionToArray(collection) {
    return Array.prototype.slice.call(collection);
}

function isActiveMainLoop()
{
    return mainLoopInterval !== 0;
}

function stopMainLoop()
{
    clearInterval(mainLoopInterval);
    const ret = mainLoopInterval !== 0;
    mainLoopInterval = 0;
    return ret;
}

function restartMainLoop()
{
    stopMainLoop(); // Sanitize
    mainLoopInterval = setInterval(parseLatestMessages, configRefreshRate);
}

/**
* Wait for players to place initial settlements so we can determine who the players are.
*/
function waitForInitialPlacement() {
    // Dummy-init stuff to render table before init phase has concluded
    MSG_OFFSET = 0;
    players = ["Awaiting", "First", "Roll"];
    player_colors = {"Awaiting":"black", "First":"red", "Roll":"gold"};
    initWorlds();   // Dunny init requiring 'players' array
    render(true);   // Force render

    log("[NOTE] Waiting for first roll");
    // TODO reset initialPlacementMade before starting interval?
    let waitInterval = setInterval(() => {
        if (initialPlacementMade)
        {
            clearInterval(waitInterval);
            log("[NOTE] Start tracking");

            // Init
            recognizeUsers(); // TODO Consilidate with recoverUsers
            comeMrTallyManTallinitialResource();
            deleteDiscordSigns();
            render();

            restartMainLoop();
        }
        else
        {
            let messages = Array.prototype.slice.call(logElement.children).map(p => p.textContent);
            // Wait for a message with "roll"
            if (messages.some( m => m.includes(initialPlacementDoneSnippet)) )
            {
                initialPlacementMade = true;
//                log("Found initial placements done snippet");
            }
            else
            {
//                log("Initial placement done snippet not found");
            }
        }
    }, 10000);
}

/**
* Find the transcription.
*/
function findTranscription() {
    let findInterval = setInterval(() => {
        if (logElement) {
//            log("Found game-log-text element");
            clearInterval(findInterval);
            waitForInitialPlacement();  // Resets MSG_OFFSET to 0
        } else {
            if (playerUsernameElement === null)
            { log("[NOTE] You can configure a fixed profile name in explorer.js"); }
            else
            { log("[NOTE] Waiting to start"); }
            logElement = document.getElementById("game-log-text");
        }
    }, 10000);
}

function startTracker()
{
    findPlayerName(findTranscription);
}

// Global start of main()
startTracker();
