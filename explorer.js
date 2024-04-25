//============================================================
// CONFIG
//============================================================

"use strict";

const version_string="v2.0.0"; // TODO Query from browser

let stats = new Statistics({}, {});

console.log(stats);
console.log(Statistics);
console.log(stats.binomialDistribution);
console.log(stats.binomialDistribution(50, 1/6));

// Some are for colonist only. TODO Clean this up eventually.
const configDoAlert = true;
const configPrintWorlds = false;
const configLogWorldCount = false;
const configPrintRobs = false;
const configRunManyWorldsTest = false;  // Run test and quit. Not a full unit test.
const configFixedPlayerName = false;    // Set true to use configPlayerName
const configPlayerName = "John#1234";
const configPlotBubbles = true;
const configPlotRolls = true;
const configLogMessages = false;
const configRefreshRate = 10000;
const configOwnIcons = false;

// The text symbols are for outputting only ;)
const resourceIcons =
{
  "wood":"🪵",
  "brick": "🧱",
  "sheep": "🐑",
  "wheat": "🌾",
  "ore": "🪨",
  "unknown": "🂠",
};
const utf8Symbols =
{
    "2": "②",
    "3": "③",
    "4": "④",
    "5": "⑤",
    "6": "⑥",
    "7": "⑦",
    "8": "⑧",
    "9": "⑨",
    "10": "⑩",
    "11": "⑪",
    "12": "⑫",
    "settlement": "🛖",
    "city": "🏢",
    "road": "🛣", // Lane symbols: ⛙ ⛜
    "devcard": "🂠",
};

function resourcesAsUtf8(resources)
{
    let s = "";
    let notFirst = false;
    for (const entry of Object.entries(resources))
    {
        if (entry[1] === 0) continue;
        if (notFirst) s += " ";
        s += resourceIcons[entry[0]].repeat(entry[1]);
        notFirst = true;
    }
    // Keep extra front space
    return s;
}


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
    "| configPlotRolls:", configPlotRolls,
    "| configLogMessages:", configLogMessages,
    "| configLogWorldCount:", configLogWorldCount
);

let e = document.getElementById("header_navigation_store");
if (e !== null) e.textContent = "(CoCaCo " + version_string + ")";
e = document.querySelector(".betaTag")
if (e !== null) e.textContent = "CoCaCo " + version_string;

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

// Replacement for setInterval, but time interval starts after completion of the
// 'repeat' function (not independently in time). To continue program flow,
// a callback 'then' is supplied that is invoked once, after 'repeat' returns
// true for the first time (indicating that the task is done). Unlike
// setInterval, there is no wait time at the start.
//
// We use this to do wait for tasks that require that the user updates the
// document in some way.
//
// Example waiting for 5 dashes each time:
//
//                   ✖       ✖                 ✖        ✔
//   ------|<========>-----<=>-----<===========>-----<==>|<===>
//
//         ↑          |---|   |---|             |---|     ↑
//      first         wait    wait              wait     then
//
function setDoInterval(repeat, time, then = null)
{
    if ( repeat() )
    {
        console.debug("◦ ending setDoInterval of", repeat.name);
        // Quit if successfull
        if (then !== null)
            then(); // We could consider passing the final, truthy output of
                    // repeat() as argument to then().
        return;
    }
    //console.debug("⏱ waiting before continuing setDoInterval of", repeat.name);
    setTimeout
    (
        setDoInterval, time, // func, timer
        repeat, time, then // args
    );
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
//var initialPlacementDoneMessage = "Giving out starting resources";


// Parser snippets that identify specific messages. The snippet itself might not
// be unique, some parsers do additional testing.
// TODO: Use an array like snippets["tradeOffer"], maybe sufficientSnippets/necessarySnippets
const initialPlacementDoneSnippet = "rolled";
const receivedInitialResourcesSnippet = "received starting resources";  // Used to determine which resources each player should get in the initial phase
const sufficientInitialPhaseMessageSnippet = "received starting resources"; // Sufficient (not necessary) to identify messages from the initial phase
const placeInitialSettlementSnippet = "placed a"; // Necessary (not sufficient) for detecting initial placement. Used to determine players
const tradeOfferSnippet = " wants to give ";
const tradeOfferResSnippet = " for ";
const tradeOfferCounterSnippet = " proposed counter offer to ";
const yearOfPlentySnippet = " took from bank ";
const receivedResourcesSnippet = " got ";
const builtSnippet = " built a ";
const boughtSnippet = " bought ";
const tradeBankGaveSnippet = "gave bank";
const tradeBankTookSnippet = "and took";
const monoStoleSnippet = " stole "; // Contained
const monoFromSnippet = "from"; // Not contained
const discardedSnippet = " discarded ";
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

// So we have assets when the others break or whatever
const alternativeAssets =
{
    // More at 408f1c219dc04fb8746541fed624e6d4026aaaac
    wood:       `<img src="${browser.runtime.getURL("assets/wood31.jpg")}" class="explorer-tbl-resource-icon"/>`,
    brick:      `<img src="${browser.runtime.getURL("assets/brick24.jpg")}" class="explorer-tbl-resource-icon"/>`,
    sheep:      `<img src="${browser.runtime.getURL("assets/sheep1.jpg")}" class="explorer-tbl-resource-icon"/>`,
    wheat:      `<img src="${browser.runtime.getURL("assets/wheat2.jpg")}" class="explorer-tbl-resource-icon"/>`,
    ore:        `<img src="${browser.runtime.getURL("assets/ore27.jpg")}" class="explorer-tbl-resource-icon"/>`,
    road:       `<img src="${browser.runtime.getURL("assets/street10.jpg")}" class="explorer-tbl-resource-icon"/>`,
    settlement: `<img src="${browser.runtime.getURL("assets/settle7.jpg")}" class="explorer-tbl-resource-icon"/>`,
    devcard:    `<img src="${browser.runtime.getURL("assets/dev4.jpg")}" class="explorer-tbl-resource-icon"/>`,
    city:       `<img src="${browser.runtime.getURL("assets/city23.jpg")}" class="explorer-tbl-resource-icon"/>`
};

const colonistAssets =
{
    wood:       `<img src="dist/images/${imageNameSnippets["wood"]}.svg" class="explorer-tbl-resource-icon"/>`,
    brick:      `<img src="dist/images/${imageNameSnippets["brick"]}.svg" class="explorer-tbl-resource-icon"/>`,
    sheep:      `<img src="dist/images/${imageNameSnippets["sheep"]}.svg" class="explorer-tbl-resource-icon"/>`,
    wheat:      `<img src="dist/images/${imageNameSnippets["wheat"]}.svg" class="explorer-tbl-resource-icon"/>`,
    ore:        `<img src="dist/images/${imageNameSnippets["ore"]}.svg" class="explorer-tbl-resource-icon"/>`,
    road:       `<img src="dist/images/${imageNameSnippets["road"]}.svg" class="explorer-tbl-resource-icon"/>`,
    settlement: `<img src="dist/images/${imageNameSnippets["settlement"]}.svg" class="explorer-tbl-resource-icon"/>`,
    devcard:    `<img src="dist/images/${imageNameSnippets["devcard"]}.svg" class="explorer-tbl-resource-icon"/>`,
    city:       `<img src="dist/images/${imageNameSnippets["city"]}.svg" class="explorer-tbl-resource-icon"/>`
};

let MSG_OFFSET = 0; // At one main loop step, parse messages with index >= MSG_OFFSET
// Prevents activity toggle because tracker is in irregular state.
//  - set to 'true' when starting player recovery
//  - reset to 'false' when main loop is started.
let startupFlag = true;


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
        console.error("Skipping alert(", message, ")");
    }
    console.trace();
}

// Strings contained in the resource image file names. Used also in regex so
// keep simple. Used to detect resource icons in log messages.
const resourceCardNames =
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
        for (const resourceType of resourceTypes)
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

    // Sanity check: Expect a card unless placeholder is found
    if (foundAny == false)
    {
        // "." might be a RegEx meta character but does not matter
        let placeholderRegex = new RegExp("card_rescardback.svg");
        const count = (html.match(placeholderRegex) || []).length;
        if (count == 0)
        {
            log("[ERROR] Expected some resource cards in html");
            alertIf(9);
        }
    }

    cards["unknown"] = 0;

    return cards;
}

// Sum values of child elements that are dice images
function extractDiceSumOfChildren(element)
{
    let images = collectionToArray(element.getElementsByTagName("img"));
    let diceTest = new RegExp("dice_\\d");
    let total = images.reduce((sum, img) =>   // TODO Probably better as a for loop
    {
        // Alt text is "dice_6" when rolling a 6.
        // Only images present are the dice images.
        let altText = img.getAttribute("alt");
        if (!altText) alertIf("No alt text in dice image");
        if (!diceTest.test(altText)) return sum;   // Skip if not a dice image
        let diceNum = Number(altText.slice(-1));
        // Debugging only
//        log(" Found dice:", diceNum);
        return sum + diceNum;
    } , 0);
    return total;
}

const predicates =
{
    "<":
    {
        "f": (x) => { return (y) => y < x; },
        "name": (x) => `< ${x}`,
    },
    ">":
    {
        "f": (x) => { return (y) => y > x; },
        "name": (x) => `> ${x}`,
    },
    "!":
    {
        "f": (x) => { return (y) => y != x; },
        "name": (x) => `!= ${x}`,
    }
}


//============================================================
// Cards and robs tracking
//============================================================

// Recovers MW state from unknown cards. Player array is used and assumed
// correct.
// TODO If mainLoop is not active before, it makes no sense to reset anything.
//      For now we just disallow this case because I can't think of a use case.
function mwManualRecoverCards()
{
    // TODO Rename to make clear it is not part of mw
    // FIXME This need adjustment to only work on the MW things
    // TODO We want to suppress during startup but manual player recovery
    //      leaves in startup mode. We want startup mode there to prevent
    //      manual parser update.
    //      Maybe do a FSM since it is getting complex
    //    if (startupFlag === true)
    //    {
    //        log("[NOTE] mwManualRecoverCards() suppressed: startupFlag === true");
    //        return;
    //    }
    log("[NOTE] Starting manual card recovery");
    const activeBefore = stopMainLoop();
    // Confirm AFTER stopping main loop so that card counts can be timed
    if (!confirm(`Reset cards (${activeBefore ? "active" : "inactive"})?`))
    {
        log("[NOTE] Aborting manual card recovery");
        if (activeBefore)
            restartMainLoop();
        return;
    }
    // Set MSG_OFFSET to end just before the numbe rquerying starts. This way,
    // the game can continue while the user enters the number from that moment
    // in time (e.g., during other moves).
    MSG_OFFSET = getAllMessages().length;
    let counts = {};
    for (const player of players)
    {
        const count = prompt(`${player} number of cards:`, 0);
        counts[player] = count;
    }
    trackerObject.mwCardRecovery(counts);

    renderObject.render();
    restartMainLoop();
}

// Waits 1 round to collect all player names. Use mwManualRecoverCards() to
// set unknown card counts, entering manyWorlds recovery mode.
function mwManualFullRecovery()
{
    // TODO rename this function to make clear it is not part of many worlds implementattion
    // FIXME This funciton needs to onloy operate on the MW things, like card recovery
    if (startupFlag === true)
    {
        log("[NOTE] mwManualFullRecovery() suppressed: startupFlag === true");
        return;
    }
    log("[NOTE] Starting manual name recovery");
    const playerCount = Number(prompt("Player count (0 to abort):", 0));
    if (playerCount < 1 || 4 < playerCount)
    {
        log("[NOTE] Aborting manual name recovery");
        return;
    }

    stopMainLoop();
    startupFlag = true;
    renderObject.unrender();
    // We use callback to emulate while(!ready){ foo(); sleep(5s); }
    recoverUsers(playerCount, () => {
    let noResources = {};
    for (const name of players) noResources[name] = {};
    trackerObject.initWorlds(noResources);
    trackerCollection.init(players); // Init as well in case the users array changed
    renderObject.render();   // Allow user to start manual card recovery
    // Let user trigger card recovery like this when ready:
    //  mwManualRecoverCards(); // Starts main loop again
    });

    // End of action triggered by recovery click
}


let trackerObject = new ManyWorlds();
let renderObject = null;
let trackerCollection = new Track();

//============================================================
// Rendering
//============================================================

function activeToggle()
{
    if (startupFlag === true)
    {
        log("[NOTE] activeToggle() suppressed: startupFlag === true");
        return;
    }
    if (isActiveMainLoop())
    {
        log("[NOTE] Now turned off");
        const stoppedMainLoop = stopMainLoop();
        if (stopMainLoop === false)
        {
            alertIf(48);
        }
        else
        {
            renderObject.unrender();
        }
    }
    else
    {
        log("[NOTE] Now turned on");
        restartMainLoop();
    }
}

function deleteDiscordSigns()
{
//    let allPageImages = document.getElementsByTagName('img');
//    for(let i = 0; i < allPageImages.length; i++)
//    {
//        if (allPageImages[i].src.includes("discord"))
//        {
//            allPageImages[i].remove();
//        }
//    }
    const ids = [ "remove_ad_in_game_left", "remove_ad_in_game_right",
                       "in_game_ab_right", "in_game_ab_left" ];
    for (const id of ids)
    {
        let element = document.getElementById(id);
        if (element) element.remove();
    }
    log("Removed elements");
}

// Has the sideeffect of updating a checkpoint message number
let messageNumberDone = -1;
function isNewMessage(msgNumber)
{
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
            if (text.includes(sufficientInitialPhaseMessageSnippet))
            {
                lastPlacementMessage = Math.max(lastPlacementMessage, i);
            }
        }
    );
    log("Found last placement message at index", lastPlacementMessage);
    return lastPlacementMessage + 1;
}

//============================================================

function verifyPlayers(players_array, p1 = null, p2 = null)
{
    if (p1 === null && p2 === null)
    {
        console.error("Must specify at least one player");
        alertIf(5);
        return false;
    }
    for (const p of [p1, p2])
    {
        if (p === null) continue;
        if (!players_array.includes(p))
        {
            console.error(`Unknown player: ${p}, valid players: ${players_array}`);
            debugger;
            alertIf(5);
        }
    }
    return true;
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
    if (!verifyPlayers(players, player)) return true;

    const initialResourceTypes = findAllResourceCardsInHtml(pElement.innerHTML);
    const asSlice = generateWorldSlice(initialResourceTypes);
    logs("[INFO] First settlement resources:", player, "<-", initialResourceTypes);
    if (asSlice === 0) { console.warn("[WARNING] Empty starting resources"); }
    trackerObject.mwTransformSpawn(player, asSlice);
}

function parseTradeOffer(element)
{
    const txt = element.textContent;
    if (!txt.includes(tradeOfferSnippet)) return true;
    const player = txt.substring(0, txt.indexOf(" "));
    if (!verifyPlayers(players, player)) return true; // Sanity check

    const offerHtml = element.innerHTML.split(tradeOfferResSnippet)[0];
    const offer = findAllResourceCardsInHtml(offerHtml);
    const asSlice = generateWorldSlice(offer);
    logs("[INFO] Trade offer:", player, "->", offer);
    trackerObject.mwCollapseMin(player, asSlice);
    trackerObject.printWorlds();

    return false;
}

function parseTradeOfferCounter(element)
{
  // "John1 proposed counter offer to John2 [wood][brick] for [sheep]"
  const txt = element.textContent;
  if (!txt.includes(tradeOfferCounterSnippet)) return true;

  const player = txt.substring(0, txt.indexOf(" "));
  if (!verifyPlayers(players, player)) return true;

  const offerHtml = element.innerHTML.split(tradeOfferResSnippet)[0];
  const offer = findAllResourceCardsInHtml(offerHtml);
  const asSlice = generateWorldSlice(offer);
  logs("[INFO] Trade counter offer:", player, "->", offer);
  trackerObject.mwCollapseMin(player, asSlice);
  trackerObject.printWorlds();

  return false;
}

function parseYearOfPlenty(element)
{
    let textContent = element.textContent;
    if (!textContent.includes(yearOfPlentySnippet)) return true;

    // Determine player
    let beneficiary = textContent.substring(0, textContent.indexOf(yearOfPlentySnippet));
    if (!verifyPlayers(players, beneficiary)) return true; // Sanity check

    // ManyWorlds version
    let obtainedResources = findAllResourceCardsInHtml(element.innerHTML);
    logs("[INFO] Year of Plenty:", beneficiary, "<-", obtainedResources);
    const asSlice = mw.generateWorldSlice(obtainedResources);
    trackerObject.mwTransformSpawn(beneficiary, asSlice);
    trackerObject.printWorlds();

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
        if (!verifyPlayers(players, player)) return true; // Sanity check

        // ManyWorlds version
        let obtainedResources = findAllResourceCardsInHtml(pElement.innerHTML);
        let asSlice = mw.generateWorldSlice(obtainedResources);
        logs("[INFO] Got resources:", player, "<-", obtainedResources);
        trackerObject.mwTransformSpawn(player, asSlice);
        trackerObject.printWorlds();

        return false;
    }

    return true;
}

/**
 * Process a "built" message: [user icon] [user] built a [building/road]
 */
function parseBuiltMessage(pElement) {
    let textContent = pElement.textContent;
    if (!textContent.includes(builtSnippet)) return true;
    let images = collectionToArray(pElement.getElementsByTagName('img'));
    let player = textContent.split(" ")[0];
    if (!verifyPlayers(players, player)) return true; // Sanity check
    let buildResources = deepCopy(emptyResourcesByName);
    let building = false;
    // TODO use predefined resource cost slices
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
    let asSlice = mw.generateWorldSlice(buildResources);
    logs("[INFO] Built:", player, buildResources);
    trackerObject.mwTransformSpawn(player, asSlice);
    trackerObject.printWorlds();

    return false;
}

function parseRolls(element)
{
    const textContent = element.textContent;
    if (!textContent.includes(rolledSnippet)) return true;
    const player = textContent.split(" ")[0];
    if (!verifyPlayers(players, player)) return true; // Sanity check

    const diceSum = extractDiceSumOfChildren(element);
    log("[INFO] Player", player, "rolled a", diceSum);

    trackerCollection.addRoll(diceSum);
    if (diceSum === 7)
        // FIXME If the player does not steal from their robber this number is
        // misleading. We could track if a rob comes from a 7 or a robber by
        // storing which happened the message before.
        trackerCollection.addSeven(player);   // Affects seven counter but not rob stats

    return false;
}

/**
 * For dev cards. parseDevCard
 */
function parseBoughtMessage(pElement) {
    let textContent = pElement.textContent;
    if (!textContent.includes(boughtSnippet)) return true;
    let images = collectionToArray(pElement.getElementsByTagName('img'));
    let player = textContent.split(" ")[0];
    if (!verifyPlayers(players, player)) return true; // Sanity check

    // ManyWorlds version
    // FIXME use structure cost array from mw
    let devCardResources = deepCopy(emptyResourcesByName);
    devCardResources[sheep] = -1;
    devCardResources[wheat] = -1;
    devCardResources[ore  ] = -1;
    const devCardSlice = mw.generateWorldSlice(devCardResources);
    logs("[INFO] Baught dev card:", player, "->", devCardResources);
    trackerObject.mwTransformSpawn(player, devCardSlice);
    trackerObject.printWorlds();

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
    if (!verifyPlayers(players, player)) return true; // Sanity check
    // We have to split on the text, which isn't wrapped in tags, so we parse innerHTML, which prints the HTML and the text.
    // FIXME Abandoned (?)
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
    const giveSlice     = mw.generateWorldSlice(giveResources);
    const takeSlice     = mw.generateWorldSlice(takeResources);
    logs("[INFO] Traded with bank:", player, giveResources, "->", takeResources);
    trackerObject.mwTransformSpawn(player, takeSlice - giveSlice);
    trackerObject.printWorlds();

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
    if (!verifyPlayers(players, thief)) return true; // Sanity check

    // ManyWorlds version
    const stolenResource = findSingularResourceImageInElement(element);
    logs("[INFO] Monopoly:", thief, "<-", stolenResource);
    trackerObject.transformMonopoly(thief, worldResourceIndex(stolenResource));
    trackerObject.printWorlds();

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
    if (!verifyPlayers(players, player)) return true; // Sanity check

    // ManyWorlds version
    const discarded = findAllResourceCardsInHtml(pElement.innerHTML);
    const discardedCardsAsSlie = mw.generateWorldSlice(discarded);
    logs("[INFO] Discarded:", player, "->", discarded);
    trackerObject.mwCollapseMinTotal(player); // Total can be unknown to MW after monopoly
    trackerObject.mwTransformSpawn(player, -discardedCardsAsSlie);
    trackerObject.printWorlds();

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
    if (!textContent.includes(tradeSnippet)) return true;

    // Determine trading players
    let involvedPlayers = textContent.split(tradeSnippet);
    let tradingPlayer = involvedPlayers[0];
    let otherPlayer = involvedPlayers[1].trim(); // Remove trailing space

    // Sanity check
    if (!verifyPlayers(players, tradingPlayer, otherPlayer)) return true;

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
    trackerObject.transformTradeByName(tradingPlayer, otherPlayer, offer, demand);
    trackerObject.printWorlds();

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
    let containsYou = textContent.indexOf("You ") === 0 || textContent.includes("from you");
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
        console.error("[ERROR] Expected \"[Yy]ou\" for", playerUsername, "in known steal");
        alertIf(33);
        return;
    }

    let stealingPlayer = involvedPlayers[0];
    let targetPlayer = involvedPlayers[1];
    if (!verifyPlayers(players, stealingPlayer, targetPlayer)) return true; // Sanity check
    let stolenResourceType = findSingularResourceImageInElement(pElement);

    // Robs update
    logs("[INFO] Steal:", targetPlayer, "->", stealingPlayer, "(", stolenResourceType, ")");
    trackerCollection.addRob(stealingPlayer, targetPlayer);

    // ManyWorlds update (treating it as a trade)
    trackerObject.transformExchange(targetPlayer, stealingPlayer, // source, target
        mw.generateSingularSlice(worldResourceIndex(stolenResourceType)));
    trackerObject.printWorlds(); // TODO maybe print in the parser loop

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
    let containsYou = textContent.indexOf("You ") === 0 || textContent.includes("from you");
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
    if (!verifyPlayers(players, stealingPlayer, targetPlayer)) return true;

    // Robs update
    logs("[INFO] Steal:", targetPlayer, "->", stealingPlayer);
    trackerCollection.addRob(stealingPlayer, targetPlayer);

    // ManyWorlds update
    trackerObject.branchSteal(targetPlayer, stealingPlayer);
    trackerObject.printWorlds();

    return false;
}

function parseWin(element)
{
    // TODO This includes player names (!). Use longer snippet.
    if (element.textContent.includes(winSnippet))
    {
        stopMainLoop();
        log("[INFO] End of Game");
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
    if (  txt.includes(yearOfPlentySnippet)
       || txt.includes(builtSnippet)
       || txt.includes(boughtSnippet)
       || txt.includes(rolledSnippet)
       || txt.includes(placeInitialSettlementSnippet) )
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
    parseTradeOfferCounter,
    parseRolls,

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
function parseLatestMessages()
{
    if (startupFlag === true)
    {
        alertIf(49);
        return;
    }
    let newMessages = getNewMessages();

    newMessages.forEach((msg, idx) =>
    {
        if (configLogMessages === true)
            console.log("[NOTE] Msg", MSG_OFFSET + idx, "|", msg.textContent);
        ALL_PARSERS.every(parser => { return parser(msg); });
        if (configLogWorldCount === true)
            console.log("[NOTE] MW count:", trackerObject.manyWorlds.length);
    });

    // Skip rest if a parseWin stopped the mainLoopInterval parsed
    if (!isActiveMainLoop())
        return;

    // Abort if card tracking is broken
    if (trackerObject.manyWorlds.length === 0)
    {
        console.error("[ERROR] No world left");
        alertIf("Tracker OFF: Inconsistency (no world left). Try recovery mode.");
        stopMainLoop();
        return;
    }

    // TODO Not sure what happens ifmsg offset changes in the meantime. can it
    //      even?
    renderObject.render(() => isNewMessage(MSG_OFFSET));
}

/**
 * Parse all messages and distribute initial resources for each player.
 * Does not wait for new messages; all initial placement messages must be
 * present beforehand.
 */
function comeMrTallyManTallinitialResource(after)
{
    let done = false;
    const poll = (andThen) =>
    {
        log("Polling for initial placement");
        const newMessages = getNewMessages();
        for (const msg of newMessages)
        {
            if (msg.textContent.includes(rolledSnippet))
            {
                done = true;
                break; // Skip remaining messages in case game is longer.
            }
            parseInitialGotMessage(msg); // Finds resources and adds them
        };
        if (!done)
            setTimeout(poll, configRefreshRate, andThen);
        else
            andThen();
    };
    poll(() =>
    {
    printWorlds();
    const correctedOffset = computeInitialPhaseOffset(getAllMessages());
    MSG_OFFSET = correctedOffset;
    log("Correcting MSG_OFFSET to 28 ===", correctedOffset); // Should be 28
    after();
    });
}

// Assumes playerUsername has been set. Rotates that player to last position.
function adjustPlayersByUsername()
{
    // Determine our own name
    if (configFixedPlayerName || !playerUsername)
    {
        if (!configFixedPlayerName)
        {
            console.warning("Username not found. Using fixed name.");
        }
        playerUsername = configPlayerName;
    }

    // Rotate 'players' so that we are in 4th position
    const ourPosition = players.indexOf(playerUsername);
    const rotation = players.length - ourPosition - 1;
    if (ourPosition < 0)
    {
        console.error("Username not part of players");
        alertIf(32);
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

// Get new messages until 'playerCount' many player names were found. If
// 'playerCount' is null, continue until the first roll instead. Must stop main
// loop before running this so they dont interfere. Advances MSG_OFFSET as
// usual.
// At start of the game, set 'palyerCount' to null so the number is deduced.
// When recovering from breaking log, or spectating, set 'playerCount' so the
// function continues while parsing rolls.
function recoverUsers(playerCount, then)    // TODO JS can not pause at all?!
{
    players = [];   // Start clean
    player_colors = {};
    // NOTE If we make sure not to read initial placement messages, we can set
    //      MSG_OFFEST to 0, too. Those can appear out-of-player-order, and we
    //      imply the order from messages.
    //MSG_OFFSET = 0;
    let foundRoll = false;
    const foundAll = () =>
    {
        if (playerCount != null)
            return playerCount - players.length === 0;
        else
            return foundRoll;
    }

    // We abuse intervals to construct while(!ready){ foo(); sleep(10s); }
    let recoverInterval = setInterval(() =>
    {
        if (foundAll())   // Aka. Leaving while loop
        {
            clearInterval(recoverInterval);
            adjustPlayersByUsername(); // Assumes the username was not changed
            then(); // Continue after "while" loop
        }
        else
        {
            log("[NOTE] Detecting player names...");
            const newMsg = getNewMessages();
            for (const msg of newMsg)
            {
                if (msg.textContent.includes(rolledSnippet))
                {
                    foundRoll = true;
                    break;
                }
                const [name, colour] = parseTurnName(msg);
                if (name === null)
                    continue;
                if (!players.includes(name))
                {
                    players.push(name);
                    player_colors[name] = colour;
                    log("Recoverd player", name, "with colour", colour);
                }
            }
        }
    }, configRefreshRate);   // Aka. sleep(10s)
}

function findPlayerName(then = null)
{
    log("[NOTE] searching profile name");
    let findPlayerInterval = setInterval(() =>
    {
        if (playerUsernameElement !== null)
        {
            clearInterval(findPlayerInterval);
            playerUsername = deepCopy(playerUsernameElement.textContent);
            console.log("[NOTE] Found profile:", `"${playerUsername}"`);

            let e = document.getElementById("header_navigation_store");
            if (e !== null) e.textContent = "CoCaCo " + version_string;

            if (then !== null)
                then();
        }
        else
        {
            playerUsernameElement = document.getElementById("header_profile_username");
            if (playerUsernameElement === null)
                console.error("Player username not found");
        }
    }, 1000);
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

// Returns true if existing main loop interval was cleared, otherwise false
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
    startupFlag = false;
    // Bring table up to date and force-render immediately so we dont need to
    // wait the first mainLoopInterval time before seeing it. Special case when
    // the extra parseLatestMessages() parsed a win and clears stops the main
    // loop. Detect by setting mainLoopInterval to a dummy value. Before it is
    // actually started.
    //
    // This does NOT protect against caling restartMainLoop() to restart the
    // main loop AFTER parsing the win previously (the main loop will idle).
    mainLoopInterval = -1;
    parseLatestMessages();
    renderObject.render();
    if (mainLoopInterval === 0)
        return; // Win was parsed, resetting the mainLoopInterval.
    mainLoopInterval = setInterval(parseLatestMessages, configRefreshRate);
}

/**
 * Wait for players to place initial settlements so we can determine who the
 * players are. Give them their respective starting resources.
 *
 * This part is implemented separately from normal tracking because the
 * resource tracker must know all players from the start. After the initial
 * starting phase, the tracker is initialized with all players, and their
 * resources are added normally.
 *
 * The main loop is then started with MSG_OFFSET pointing to the first
 * non-initial placement message.
 */
function waitForInitialPlacement()
{
    // Dummy-init stuff to render table before init phase has concluded
    players = ["Awaiting", "First", "Roll", "..."];
    player_colors = {"Awaiting":"black", "First":"red", "Roll":"gold", "...":"white"};
    // Dunny inits using the fake players and colors
    trackerObject.initWorlds({"Awaiting":{}, "First":{}, "Roll":{}, "...":{}});   // Dummy init requiring 'players' array
    trackerCollection.init(players); // Dummy init
    renderObject = new Render
    (
        trackerObject, trackerCollection, players, player_colors,
        parseLatestMessages,
        null,
        mwManualRecoverCards,
        mwManualFullRecovery,
        configOwnIcons ? alternativeAssets : colonistAssets
    );
    renderObject.render();

    MSG_OFFSET = 0;
    recoverUsers(null, // Parse names until a roll occurs
    () =>
    { // After-function because intervals return immediately

    let noResources = {};
    for (const name of players) noResources[name] = {};
    trackerObject.initWorlds(noResources);   // Real init. Requires existing users array.
    trackerCollection.init(players); // Real init
    renderObject = new Render(
        trackerObject, trackerCollection, players, player_colors,
        parseLatestMessages,
        null,
        mwManualRecoverCards,
        mwManualFullRecovery,
        configOwnIcons ? alternativeAssets : colonistAssets
    );

    // TODO DO not advance msg offset within
    // comeMrTallyManTallinitialResource, do manually here instead
    MSG_OFFSET = 0;
    comeMrTallyManTallinitialResource(() => // Sets MSG_OFFSET for main loop
    {
    renderObject.render();
    restartMainLoop();
    });
    });
}

/**
 * Find the transcription.
 */
function findTranscription()
{
    let findInterval = setInterval(() =>
    {
        if (logElement)
        {
//            log("Found game-log-text element");
            clearInterval(findInterval);
            deleteDiscordSigns();
            logElement.addEventListener("click", activeToggle, false);
            waitForInitialPlacement();  // Resets MSG_OFFSET to 0
        }
        else
        {
            if (playerUsernameElement === null)
            { log("[NOTE] You can configure a fixed profile name in explorer.js"); }
            else
            { log("[NOTE] Waiting to start"); }
            logElement = document.getElementById("game-log-text");
        }
    }, configRefreshRate);
}

function startTracker()
{
    findPlayerName(findTranscription);
}

function allTests()
{
    console.warn("skipping old test");
    //worldTest();
    //console.info("● [🌎] ManyWorlds old test done (starts debugger when failing)");
    let tmp = new ManyWorlds();
    tmp.worldTest();
    console.info("● [🌎] ManyWorlds new test over (starts debugger when failing)");

    //console.info("● [🌎] Both tests done. Exiting.");
    return
}

function main()
{
    if (configRunManyWorldsTest === true)
    {
        allTests();
        return
    }

    if (window.location.hostname === "colonist.io")
    {
        console.log("[NOTE] Running on colonist.io");
        startTracker();
    }
    else if (window.location.hostname === "twosheep.io")
    {
        console.log("🧭 Running on twosheep.io");
        console.assert(window.location.hostname === "twosheep.io");
        twosheep.restartTracker();
    }
    else
    {
        console.assert(false, "unreachable");
    }
}

main();

// vim: shiftwidth=4:softtabstop=4:expandtab
