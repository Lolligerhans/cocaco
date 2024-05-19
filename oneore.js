// oneore.js
//
// Implement twosheep.io specific main loop:
//  - log messages
//  - players/colour
//  - icons
//
// In a website update breaks the tracker, it is likely that one or more of the
// hardcoded snippets or strings were changed.

"use strict";

// Abuse object as namespace
// TODO Would have been better as a class
let twosheep =
{

// ============================================================================
// Constants
// ============================================================================

refreshRate: 3000, // In milliseconds
snippets:
{
    // Detect resource icons in messages by these regex
    "icon_regex": { "wood": /wood_icon/g, "brick": /brick_icon/g, "sheep": /sheep_icon/g,
                    "wheat": /wheat_icon/g, "ore": /ore_icon/g, "unknown": /unknown_icon/g }

    // Detect message types by these textContent snippets
    , boughtDev: " bought a "
    , built: {detect: " built a ", roadBuilder: " played road builder"}
    , dice: RegExp("dice icon \\d")
    , discard: " discarded "
    , steal: {detect: " stole  from ", not: " played Monopoly on "}
    , monopoly: {detect: " played Monopoly on ", split: "•", splitSingle: " and stole "}
    , receivedResources: " received "
    , roll: " rolled "
    , trade: {detect: " traded to", not: " traded to the bank for", split: "logText playerName", end: "for"}
    , tradeBank: {detect: " traded to the bank for", split: "to the bank for"}
    , tradeOffer: {detect: " wants to give for", split: 'class="logText"'}
    , tradeOfferCounter: {detect: " wants to get", split: 'class="logText"'}
},

consoleCss: function(playerName)
{
    return `background: ${twosheep.player_colours[playerName]}; padding: 3px; border-radius: 5px; font-weight: bold;`;
},

// ============================================================================
// State
// ============================================================================

// A global names array. Mostly used to seed all other instances of names.
players: [], // ["john", "sarah"]
// The colour corresponding to a name. We extract it from the initial building
// log messages. We use it for seeding (to show UI in matching colours) and to
// identify coloured robot icons (via string comparison).
player_colours: null, // {"john": "rgb(255, 0, 0)", ...}
// Icons used for the resource table. For some we found simple image sources,
// for others we hook the present SVGs with <use> tags.
// When these are broken we have an alternative set of icons to drop in.
icons: null, // {"wood": '<img ...>', ..., "settlement": '<svg ...>', ...}
// The log element where messages appear. We wait for the log element to appear
// as a means of detecting the start of a game.
logElement: null,
// The index of the first not-yet-processed message in the getNewMessages()
// array. Set (and used) by getNewMessages().
MSG_OFFSET: null, // Index 0, 1, ... into logElement
// The highest already-processed message index, set by main loop. When the
// parser is ahead of the renderer, then the tables should be updated.
renderedOffset: -1,

// Only the main loop supplied with the matching index is allowed to continue.
// Increment each time the main loop is started.
activeIndex: 0,
// We track the max of any index used for loop from startMainLoop to determine
// if the main loop had be active upon stopping it. If the max index is large
// enough to continue (i.e., maxIndex > activeIndex, but it is never set to
// be greater, so this implies equality) then the there is still an active main
// loop.
// We need this to not activate the main loop when aborting card recovery while
// the main loop was inactive.
maxIndex: -1,

// Because card tracking is much more complex than roll and rob counting, we
// separate card tracking into manyworlds.js, providing the ManyWorlds class.
worlds: null, // ManyWorlds Object
multiverse: null, // Multiverse Object
// The tracker object collects all the simple tracker data, like roll counting.
tracker: null, // Track Object
// Because currently the render() function (that creates HTML elements in DOM)
// makes good access of the other stuff, we implement it as a class that is
// initialized with a flock of handles it will use to generate its output.
render: null, // Render Object

// ============================================================================
// Helper
// ============================================================================

// Does NOT chance MSG_OFFSET (unlike 'getNewMessages()')
getAllMessages: function()
{
    // Surely there is a way without a copy? Is this a copy?
    // TODO We dont want to have quadratic runtime in msg count over the whole
    //      game.
    return collectionToArray(twosheep.logElement.children);
},

getNewMessages: function(asIndex = false) // TODO consider iterating with getNextChild()
{
    const index = twosheep.MSG_OFFSET;
    const allMessages = twosheep.getAllMessages();
    twosheep.MSG_OFFSET = allMessages.length;
    if (asIndex === false)
        return allMessages.slice(index); // Shallow copy
    else if(asIndex === true)
        return [allMessages, index];
    else
        console.assert(false, "unreachable");
},

// Assume bot is the first svg in the element, and has a style.color given in
// 'colour_map_backward' (exact string match).
// @param colour_map_backward: {"red": "rgb(153, 37, 31)", ...} where 'red' here
//                             is the player name.
extractBotActorFromLogMessage: function(element, colour_map_backward)
{
    // Assume the bot is the first
    const robot = element.getElementsByTagName("svg")[0];
    const colour = robot.style.color;
    console.assert(Object.values(colour_map_backward).includes(colour), "Unexpected colour " + colour, " not in allowed colours", colour_map_backward);
    console.assert(robot.dataset.testid === "SmartToyIcon");

    const search = Object.entries(colour_map_backward).find
    (
        entry => entry[1] === colour
    );
    console.assert(search);
    return search[0];
},

// TODO Thins function currently uses "unknown" when finding a hidden resource
// type. That is a somewhat dangerous double meaning, confusing the recovery
// mode "unknown" resources. Better return hidden cards separately.
extractResourcesFromLogMessage: function(html)
{
    const res = {};
    for (const resName of [...resourceTypes, "unknown"] )
    {
        const match = html.match(twosheep.snippets.icon_regex[resName]);
        if (match === null) res[resName] = 0;
        else                res[resName] = match.length;
    }
    return res;
},

extractDiceSumFromLogMessage: function(element)
{
    const images = collectionToArray(element.getElementsByTagName("img"));
    const total = images.reduce((sum, img) =>
    {
        const altText = img.getAttribute("alt");
        if (!altText) alertIf("No alt text in dice image");
        if (!twosheep.snippets.dice.test(altText)) return sum;    // Skip if not a dice image
        const diceNum = Number(altText.slice(-1));
        return sum + diceNum;
    } , 0);
    return total;
},

// Identify buildings from their SVG tag <use>
// Example:
//  <use href="#road-def-yellow" style="transform: translate(-2px, 7px) scale(0.25) rotate(-45deg);"></use>
// @return "road", "settlement", "city", "ship" or null
extractOnlyBuildingFromLogMessage: function(element)
{
    const image = element.querySelector("use");
    const ref = image.getAttribute("href");
    if (ref === null)
        console.error("No href in image");
    if (ref.startsWith("#road-def-"))
        return "road";
    if (ref.startsWith("#settlement-def-"))
        return "settlement";
    if (ref.startsWith("#city-def-"))
        return "city";
    if (ref.startsWith("#ship-def-"))
        return "ship";
    return null;

},

findFirstRollIndex: function(messages)
{
    for (const [index, message] of messages.entries())
    {
        for (const img of message.querySelectorAll("img"))
        {
            if (img.alt.includes("dice"))
                return index;
        }
    }
    console.assert(false, "unreachable");
    return null;
},

generateEmptyResourceList: function(playerNameList)
{
    let res = {};
    for (const playerName of playerNameList)
        res[playerName] = deepCopy(mw.emptyResourcesByName);
    return res;
},

// ============================================================================
// Program flow
// ============================================================================

// We split the initial phase so that the normal game can run stateless without
// worrying about placing no-cost buildings at the start. Since the names are
// known before hand, we can change this later if we can deduce the no-cost
// placing of settlements at the start. If nothing else, this is always possible
// by the log message index. Would this break after a disconnect or reload (?).
//
// In principle, this function could run any kind of functions in order, but
// here we only needed it to chain the intervalled functions used during
// startup. This prevents the interval mess of old explorer, because this is the
// only function that sees intervals. The other functions only need to return
// appropriately (true to continue, false to stop).
restartTracker: function(done =
[
    // Note: The first run will have a true reset, including activeIndex and
    // maxIndex. These are excluded from 'resettate'.

    // Reset state
    { "funct": twosheep.resetState, "ok": false },
    // Make sure the game has started by finding the log element
    { "funct": twosheep.findLogElement, "ok": false },
    // Fade panel with names is available immediately in game
    { "funct": twosheep.findNames, "ok": false },
    // Read player colour from initial placement log messages
    { "funct": twosheep.findLogColours, "ok": false },
    // Find icons for display
    { "funct": twosheep.findIcons, "ok": false },
    // Initialize ManyWorld sructures
    { "funct": twosheep.initializeTracker, "ok": false },
    // Wait during initial placements to populate log element. This is helpful
    // for 'findInitialResources' and critical to not accidentally parse
    // a free-build-at-start message with the regular parser.
    { "funct": twosheep.waitForInitialPlacement, "ok": false },
    // Read initial resources from log messages (separate because no cost)
    { "funct": twosheep.findInitialResources, "ok": false },
    // Start the main loop with all states constructed and ready
    { "funct": twosheep.startMainLoop, "ok": false },
])
// TODO This is exactly thesame as in Colony class. Make this pattern its own thing and share
{
    // Iterate pairs with indices
    for (let i = 0; i < done.length; ++i)
    {
        if (done[i].ok)
            continue;
        console.info(`🧭 ( ${i} ) restartTracker:`, done[i].funct.name);
        // Assume we will succeed and remember for when we come back
        done[i].ok = true;
        // Use 'restartTracker' function as then parameter to setDoInterval().
        // Once then() is executed, we know to skip this index and continue with
        // the next one.
        setDoInterval(done[i].funct, twosheep.refreshRate, twosheep.restartTracker.bind(this, done));
        // Return, but we imagine that the program flow continues with the
        // setDoInterval().
        return; // Continue in new setInterval
    }
    console.info("🧭 ( ✔️  ) restartTracker' dispatcher completed");
},

// Reset observable state. For most things that is just to re-initialize all
// members. Keep the activeIndex because it may correspond to running intervals.
resetState: function()
{
    console.log("• Resetting twosheep state");
    // Deals with the active index to stop running main loops. If no main loop
    // is running that is also fine.
    twosheep.stopMainLoop();

    twosheep.logElement = null;
    twosheep.MSG_OFFSET = 0;
    twosheep.players = null;
    twosheep.player_colours = null;
    twosheep.icons = null;
    twosheep.worlds = null;
    twosheep.multiverse = null;
    twosheep.tracker = null;
    twosheep.render = null;
    twosheep.renderedOffset = -1;

    return true;
},

// Find game log from HTML document
findLogElement: function()
{
    console.assert(!twosheep.logElement);
    const fadePanels = document.getElementsByClassName("fadePanel");
    if (!fadePanels)
    {
        //console.debug("• No fadePanel found");
        return false;
    }
    twosheep.logElement = fadePanels[fadePanels.length - 1];
    if (!twosheep.logElement)
    {
        //console.debug("• No logElement found");
        return false;
    }
    console.log("• Found logElement");
    twosheep.logElement.addEventListener("click", twosheepToggle, false);

    // Bank should always be found, but continue anyway since
    // 'recoverCards'/'twosheepRecoverCards' is not reqired for normal function.
    const bankElement = document.getElementById("bank");
    console.assert(bankElement);
    if (bankElement)
        bankElement.addEventListener("click", twosheepRecoverCards, false);

    // (Same as above)
    const scoreElement = document.getElementById("score-panels");
    console.assert(scoreElement);
    if (scoreElement)
        scoreElement.addEventListener("click", twosheepRecoverNames, false);

    // TODO Do we want do bind twosheepRestart?


    return true;
},

// Read player names from HTML document
findNames: function()
{
    // Sanity check
    console.assert(twosheep.players === null || twosheep.players.length === null);
    twosheep.players = [];
    for (e of document.getElementsByClassName("scoreName"))
        twosheep.players.push(e.textContent);
    console.assert(twosheep.players.length > 0);
    console.log(`• Found ${twosheep.players.length} players: `, twosheep.players);
    return true;
},

// Stall (i.e., return false) until placement game phase is over.
// Useful because some steps require the initial messages to be present.
waitForInitialPlacement: function()
{
    twosheep.getNewMessages(); // Advances MSG_OFFSET
    // Technically 28 is the last placement. We wait 29 to include the first roll because we
    // reset to that index later.
    if (twosheep.MSG_OFFSET >= 29) // TODO is too large
    {
        twosheep.MSG_OFFSET = twosheep.findFirstRollIndex(twosheep.getAllMessages());
        console.log("◦ Completed initial placement");
        console.info("◦ MSG_OFFSET === (", twosheep.MSG_OFFSET, ")");
        return true;
    }
    return false;
},

// Used with 'setDoInverval' by startTracker.
// Reads log messages until all palyers in 'playerNames' are found by a <div>
// with attribute class=playerName.
// This works despite bot messages, because there are always non-bot messages
// (recieve resources).
// TODO could replace name finding as well?
findLogColours: function(playerNames = twosheep.players)
{
    // Verify that we avoid obsolete repeated calls
    console.assert(!twosheep.player_colours || Object.keys(twosheep.player_colours).length < playerNames.length);
    console.assert(twosheep.logElement !== null);

    if (!twosheep.player_colours)
        twosheep.player_colours = {};
    const isDone = () => Object.keys(twosheep.player_colours).length === playerNames.length;
    const addColour = (n, c) =>
    {
        console.assert(playerNames.includes(n));
        if (twosheep.player_colours[n])
        {
            console.assert(twosheep.player_colours[n] === c, "require consistent colours");
        }
        else
        {
            twosheep.player_colours[n] = c;
            console.log(`• Found player %c${n}%c with colour ${c}`, twosheep.consoleCss(n), "");
            if (isDone())
                return false; // Skip remaining obsolete messages
        }
        return true;
    };

    // TODO For name recovery, we would like to only check new messages, but
    //      then we do not have querySelectorAll(). Currently we repeat-search
    //      all messages every time to stay stateless when possible.
    // TODO I guess we could add a function parameter with a start index?
    //
    //const newMessages = twosheep.getNewMessages();
    //const list = newMessages.querySelectorAll('span.playerName.logText')
    const every =
    [...twosheep.logElement.querySelectorAll('span.playerName.logText')].every
    (
        e => addColour(e.textContent, e.style.color)
    );
    if (isDone())
        return true; // Signal "done" to 'setDoInterval'
    return false;    // Signal "not done" to be called again
},

// Find current resource icons for use in tables
findIcons: function()
{
    console.assert(twosheep.icons === null);
    // For settlement/city, take any colour svg we find. We would just pick red
    // but we can not guarantee that the red SVGs assets are actually present.
    // Find any SVG having <use> for a settlement and extract the colour name.
    // Assume a city of the same colour exists.
    // Later generate (replacing 'red'): '<svg height="20" width="20" overflow="visible"><use href="#settlement-def-red" style="transform: translate(13px, 13px) scale(0.07);"></use/></svg>',
    const anyBuilding = document.querySelector(`use[href*="#settlement-def-"]`);
    const anyColour = anyBuilding.getAttribute("href").split("-").at(-1);
    //console.debug("◦ Found settlement of arbitrary colour:", anyColour);
    twosheep.icons =
    {
        wood: `<img src="${document.querySelector(`img[src*="wood_icon"][src$=".svg"]`).src}" class="explorer-tbl-resource-icon"/>`,
        brick: `<img src="${document.querySelector(`img[src*="brick_icon"][src$=".svg"]`).src}" class="explorer-tbl-resource-icon"/>`,
        sheep: `<img src="${document.querySelector(`img[src*="sheep_icon"][src$=".svg"]`).src}" class="explorer-tbl-resource-icon"/>`,
        wheat: `<img src="${document.querySelector(`img[src*="wheat_icon"][src$=".svg"]`).src}" class="explorer-tbl-resource-icon"/>`,
        ore: `<img src="${document.querySelector(`img[src*="ore_icon"][src$=".svg"]`).src}" class="explorer-tbl-resource-icon"/>`,
        // "devcards_icon" not "devcard_icon"
        devcard: `<img src="${document.querySelector(`img[src*="devcards_icon"][src$=".svg"]`).src}" class="explorer-tbl-resource-icon"/>`,
        road: `<img src="${document.querySelector(`img[src*="road_icon"][src$=".svg"]`).src}" class="explorer-tbl-resource-icon"/>`,
        // In the log element: <svg height="20" width="20" overflow="visible"><use href="#settlement-def-red" style="transform: translate(13px, 11px) scale(0.06);"></use></svg>
        settlement: `<svg height="20" width="20" overflow="visible"><use href="#settlement-def-${anyColour}" style="transform: translate(13px, 13px) scale(0.07);"></use></svg>`,
        city: `<svg height="20" width="20" overflow="visible"><use href="#city-def-${anyColour}" style="transform: translate(6px, 13px) scale(0.08);"></use></svg>`,
        ship: `<svg height="20" width="20" overflow="visible"><use href="#ship-def-${anyColour}" style="transform: translate(8px, 13px) scale(0.07);"></use></svg>`,
    };
    //console.debug("◦ Found icons:", twosheep.icons);
    // We schedule this late so that the icons are present already. No need to
    // verify and repeat. Maybe add later as sanity check.
    return true;
},

// Initialize some of the internal tracking structures. Especially the
// ManyWorlds and Render objects that cannot be initialized immediately at
// startup.
initializeTracker: function()
{
    console.log("◦ Initializing tracking");
    const noResources = twosheep.generateEmptyResourceList(twosheep.players);

    twosheep.worlds = new ManyWorlds();
    twosheep.worlds.initWorlds(noResources);
    twosheep.multiverse = new Multiverse();
    twosheep.multiverse.initWorlds(noResources);
    twosheep.tracker = new Track();
    twosheep.tracker.init(twosheep.players);
    twosheep.render = new Render
    (
        twosheep.multiverse,
        twosheep.tracker,
        twosheep.players,
        twosheep.player_colours,
        twosheep.restartTracker.bind(twosheep), // Currently ignored by Render
        null, // Card and name recovery
        null, // …are in findLogElement.
        //twosheep.recoverCards.bind(twosheep),
        //twosheep.recoverNames.bind(twosheep),
        // Allowing our own icons as fallback
        configOwnIcons ? alternativeAssets : twosheep.icons
    );
    twosheep.render.unrender(); // Remove table to force redraw over update

    // TODO Once internalized
    //twosheep.robsObject = twosheep.initRobs();
    //twosheep.rollsObject = twosheep.initRolls();

    twosheep.render.render(); // Render first time even if no new messages
    return true;
},

// Read initial resources from log element. This means the parsers don't have to
// consider the special build phase at the start. Assumes initial phase messages
// are fully present.
findInitialResources: function()
{
    //console.debug("◦ Setting initial resources");
    console.assert(twosheep.MSG_OFFSET >= 29); // Sanity check: waited for initial placements
    const allMessages = twosheep.getAllMessages();
    console.assert(allMessages.length > 26);
    for (let i = 0; i < twosheep.MSG_OFFSET; ++i)
    {
        const msg = allMessages[i];
        console.assert(!msg.textContent.includes(twosheep.snippets.roll)); // MSG_OFFSET should be set to the first roll
        if (!msg.textContent.endsWith(twosheep.snippets.receivedResources))
            continue; // Skip other messages
        const nameElement = msg.children[0].children[0];
        const name = nameElement.textContent;
        const resources = twosheep.extractResourcesFromLogMessage(msg.innerHTML);
        console.assert(name !== null);
        twosheep.worlds.mwTransformSpawn(name, mw.generateFullSliceFromNames(resources));
        console.log(`▶️ %c${name}%c ${resourcesAsUtf8(resources)}`, twosheep.consoleCss(name), "");
        //console.debug(`• Set initial resources for ${name} to`, resources);
        twosheep.multiverse.mwTransformSpawn(name, Multiverse.asSlice(resources));
    }

    //console.debug("◦ Initial resources set");
    return true;
},

// ============================================================================
// Main loop
// ============================================================================

// Signal running main loop to stop. Main loop must check this each interval.
stopMainLoop: function()
{
    //console.debug(`◦ entering twosheep.stopMainLoop()`);
    // Dont show big stop message if no active loop
    if (twosheep.isActiveMainLoop())
        console.info("🧭", `Stopping main loop ${twosheep.activeIndex}`);
    else
        console.debug("🧭 No active main loop to stop");
    twosheep.activeIndex += 1; // Tells old loop to stop
    // This timer end can produce a warning since 'stopMainLoop' is often
    // obsolete when called. It does no harm.
    if (configUseTimer) console.timeEnd("mainLoop");
},

// Start new main loop interval. It is given a closure with the current
// activeIndex. Once the global activeIndex is incremented, the main loop must
// stop (by returning true to the setDoInterval).
startMainLoop: function()
{
    twosheep.stopMainLoop(); // Includes increment to fresh activeIndex
    console.info("🧭", `Starting main loop ${twosheep.activeIndex}`);
    const currentIndex = twosheep.activeIndex;
    // Signal to 'twosheep' object that a main loop is active as long as active
    // index is at most currentIndex.
    if (currentIndex > twosheep.maxIndex)
        twosheep.maxIndex = currentIndex;
    // Use our own setInterval version as main loop
    setDoInterval
    (
        // Closure using the 'currentIndex' above
        twosheep.mainLoop.bind(this, // namespace object twosheep
            () => twosheep.activeIndex === currentIndex // continue condition
        ),
        twosheep.refreshRate
    );

    // Signal completion to the dispatcher 'restartTracker' so invoked only once.
    // Fine to ignore the return value.
    return true;
},

isActiveMainLoop: function()
{
    return twosheep.maxIndex >= twosheep.activeIndex;
},

// Helper mainly to be addEventListener'd to some button. We don't name it
// toggle main loop because unlike the main loop functions, this also unrenders
// when turning off.
toggleTracker: function()
{
    //console.debug("◦ Entering twosheep.toggleTracker()");
    if (twosheep.isActiveMainLoop())
    {
        twosheep.stopMainLoop();
        twosheep.render.unrender();
    }
    else
    {
        twosheep.startMainLoop();
        // Main loop may or may not render on first pass
        twosheep.render.render();
    }
},

// This is the core loop, supplied to a setDoInterval to run repeatedly.
// Returns false to be run again later.
// @param continueIf: a function that returns true if the loop should continue.
//                    Should be set to compare 'twosheep.activeIndex' to a fixed
//                    value.
// This function can be used to update once by calling it normally (rather than
// in a setDoInterval), passing
//      () => true
// as argument, telling it to always execute, even if no new messages appeared.
mainLoop: function(continueIf)
{
    if (continueIf() === false)
    {
        console.info("🧭", `Leaving main loop. Current index: ${twosheep.activeIndex}`);
        return true; // Signal completion to not run again
    }
    else
    {
        console.info("🧭", `Running main loop. Current index: ${twosheep.activeIndex}`);
    }
    if (configUseTimer) console.time("mainLoop");

    // Use array + index to allow build parser to find a road builder dev card
    // player earlier. Generally parsers should only use the current message.
    const [allMessages, startIndex] = twosheep.getNewMessages(true);
    //console.debug(`◦ Found ${allMessages.length - startIndex} new messages`);
    for (let i = startIndex; i < allMessages.length; ++i)
    {
        // Test for falseness so that first parsing success stops the loop
        twosheep.parsers.ordered.every((p) =>
        {
            //console.debug(`◦ Trying parser ${p} on message ${i}: »${allMessages[i].textContent}«`);
            const failed = twosheep.parsers[p](allMessages[i], i, allMessages) === false;
            if (!failed)
            {
                //console.debug(`◦ ${p} succeeded on message ${i}`);
                twosheep.multiverse.printWorlds();
            }
            return failed;
        });

        if (twosheep.multiverse.worlds.length == 0)
        {
            console.error("No worlds left after parsing. Stopping..");
            twosheep.stopMainLoop();
            alert("No worlds left after parsing. Stopping.");
            // Signal completion to not be called again (although it should abort
            // next iteration otherwise).
            debugger;
            return true;
        }
    };
    if (configUseTimer) console.timeEnd("mainLoop");

    console.log(`🌎 ${twosheep.multiverse.worlds.length}`);

    if (configUseTimer) console.time("render");
    twosheep.render.render(() => twosheep.MSG_OFFSET > twosheep.renderedOffset);
    if (configUseTimer) console.timeEnd("render");
    twosheep.renderedOffset = twosheep.MSG_OFFSET;


    // Run indefinitely since there is no win message to be parsed
    return false; // Signal not completed to run again
},

// TODO Do we want to somehow disallow this call during initial phase?
recoverCards: function()
{
    //console.debug("🩹 Considering card recovery");
    const offsetAtStartTime = twosheep.getAllMessages().length;
    const wasRunning = twosheep.isActiveMainLoop();
    console.assert(twosheep.maxIndex <= twosheep.activeIndex, "is starts out equal and active index increases only");
    twosheep.stopMainLoop();
    // Confirm AFTER stopping main loop so that card counts can be timed
    if (!confirm(`🩹 Reset cards?`))
    {
        console.debug("🩹 Declining card recovery");
        if (wasRunning)
        {
            console.info("🩹 Re-entering main loop without card recovery");
            twosheep.startMainLoop();
        }
        return;
    }
    console.info("🩹 Entering card recovery");

    // Reset MSG_OFFSET to end just before the number querying starts. This way,
    // the game can continue while the user enters the number from that moment
    // in time (e.g., during other moves).

    // Reset msg index to what the user saw on board when clicking recover
    twosheep.MSG_OFFSET = offsetAtStartTime;
    let counts = {};
    for (const player of twosheep.players)
    {
        const count = prompt(`${player} number of cards:`, 0);
        counts[player] = count;
    }
    twosheep.worlds.mwCardRecovery(counts);
    twosheep.multiverse.mwCardRecovery(counts);

    // The MW state changes despite no message sent, so force update display
    // into recovery mode.
    twosheep.render.render();
    twosheep.renderedOffset = twosheep.MSG_OFFSET;
    twosheep.startMainLoop();
},

// Like the normal start, 'recoverNames' resets most state (such as colours,
// names, resources). But 'recoverNames' does not make an attempt do distribute
// initial resources or start the main loop immediately. Instead, since the
// total card counts are unknown, the main loop must be started afterwards via
// 'recoverCards'.
// The log does not continue indefinitely. Name recovery can also be used when
// starting the tracker late.
// The downside compared to recoverCards is that the card recovery is delayed by
// the necessity of finding colours again meaning the recovery starts later.
//
// Technically, I would be possible to record the message index at moment of
// invocation, ask for resource counts and automatically recovering cards with
// that from the original MSG_INDEX. Maybe do so in the future.
recoverNames: function()
{
    //console.debug("💉 Considering name recovery");
    const wasRunning = twosheep.isActiveMainLoop();
    console.assert(twosheep.maxIndex <= twosheep.activeIndex, "impossible");
    twosheep.stopMainLoop();

    const playerCount = Number(prompt("💉 Reset to how many players?", 0));
    if (playerCount === 0)
    {
        //console.debug("💉 Declining name recovery");
        if (wasRunning)
        {
            twosheep.startMainLoop();
        }
        return;
    }
    if (playerCount < 1 || 4 < playerCount)
    {
        console.error(`Cannot recover ${playerCount} players`);
        return;
    }
    console.log(`💉 Entering name recovery for ${playerCount} players`);

    twosheep.render.unrender();
    // We point out the difference to the default 'restartTracker' in comments
    twosheep.restartTracker
    ([
        { "funct": twosheep.resetState, "ok": false },
        { "funct": twosheep.findLogElement, "ok": false },
        { "funct": twosheep.findNames, "ok": false },
        { "funct": twosheep.findLogColours, "ok": false },
        { "funct": twosheep.findIcons, "ok": false },
        // Not: waitForInitialPlacement
        { "funct": twosheep.initializeTracker, "ok": false },
        // Not: 'findInitialResources'
        // Not: 'startMainLoop'
        // Additional render. If only to render the card recovery button.
        { "funct": () => { twosheep.render.render.bind(twosheep.render); // FIXME I think this should be run immediately (?)
                           console.info(`💉 Recovered players: ${twosheep.players}`);
                           //console.debug("💉 Waiting for card recovery");
                           return true;
                         }, "ok": false },
    ]);
},

// ============================================================================
// Parser
// ============================================================================

// Parsers return true when message was found. Else false.
// They also start the tracking side effects.
// They are meant to function independent from each other:
//  - exactly 1 parser returns true per message
//  - noop when returning false
// The idea is to run parsers until the first returns true, then stop.
//
// Importantly, some parsers must be equipped to deal with different versions,
// depending on whther the player timed out (replacing the textContent name with
// a robot icon).
parsers:
{
    always: function(msg, idx)
    {
        if (!configLogMessages) return false;
        console.info(`👁 Message ${idx} | »${msg.textContent}«`);
        //console.debug(`🔍 Message ${idx} object:`, msg);
        return false;
    },

    fallback: function(msg, idx)
    {
        //console.debug(`❌ Unidentified: Message ${idx} »${msg.textContent}«`);
        return false;
    },

    // Example text content:
    //  - " rolled "
    //  - " blue rolled "
    roll: function(element)
    {
        const textContent = element.textContent;
        if (!textContent.includes(twosheep.snippets.roll)) return false;

        // The rolling player is currently ignored anyway
        let player = textContent.split(" ")[0];
        if (!player)
        {
            player = twosheep.extractBotActorFromLogMessage(element, twosheep.player_colours);
            //console.debug(`🤖 %c${player}%c (the bot rolls)`, twosheep.consoleCss(player), '');
            //console.debug(`◦ The bot rolls for ${player}`);
        }
        if (!verifyPlayers(twosheep.players, player))
        {
            // For testing, enter extractBotActorFromLogMessage again
            debugger;
            const test = twosheep.extractBotActorFromLogMessage(element, twosheep.player_colours);
            return true; // Sanity check
        }

        const diceSum = twosheep.extractDiceSumFromLogMessage(element);
        // Someone left all his pets in the edit.
        // https://stackoverflow.com/posts/46377929/revisions
        // The bird lives here now.
        // Use utf8 symbol for dice
        //console.debug(`🎲 %c${player} ${diceSum}`, `🐦;background: ${twosheep.player_colours[player]}; padding: 3px; border-radius: 5px; font-weight: bold;`);
        //console.debug("• Player", player, "rolled", diceSum);

        twosheep.tracker.addRoll(diceSum);
        if (diceSum === 7)
        {
            // TODO If the player does not steal from their robber this number
            // is misleading. We could track if a rob comes from a 7 or a robber
            // by checking which happened the message(s) before.
            twosheep.tracker.addSeven(player); // Affects seven counter but not rob stats
        }

        return true;
    },

    tradeOffer: function(element)
    {
        const txt = element.textContent;
        if (!txt.includes(twosheep.snippets.tradeOffer.detect)) return false;
        const player = txt.substring(0, txt.indexOf(" "));
        if (!verifyPlayers(twosheep.players, player)) return false; // Sanity check

        const split = element.innerHTML.split(twosheep.snippets.tradeOffer.split);
        console.assert(split.length == 3);
        const offer  = twosheep.extractResourcesFromLogMessage(split[1]);
        const demand = twosheep.extractResourcesFromLogMessage(split[2]);
        console.log(`%c${player}%c ➡️ ${resourcesAsUtf8(offer)} ⇄️ ${resourcesAsUtf8(demand)}`, twosheep.consoleCss(player), "");

        const offerSlice = mw.generateWorldSlice(offer);
        twosheep.worlds.mwCollapseMin(player, offerSlice);
        twosheep.multiverse.mwCollapseMin(player, Multiverse.asSlice(offer));

        return true;
    },

    tradeOfferCounter: function(element)
    {
        const txt = element.textContent;
        if (!txt.includes(twosheep.snippets.tradeOfferCounter.detect)) return false;
        const player = txt.substring(0, txt.indexOf(" "));
        if (!verifyPlayers(twosheep.players, player)) return false;

        const split = element.innerHTML.split(twosheep.snippets.tradeOfferCounter.split);
        console.assert(split.length == 3);
        const offer  = twosheep.extractResourcesFromLogMessage(split[2]);
        const demand = twosheep.extractResourcesFromLogMessage(split[1]);
        console.log(`${resourcesAsUtf8(demand)} ⇄️ ${resourcesAsUtf8(offer)} ⬅️ %c${player}%c`, twosheep.consoleCss(player), "");
        //console.debug("• Trade counter:", player, "<-", demand, "->", offer);
        const asSlice = mw.generateWorldSlice(offer);

        twosheep.worlds.mwCollapseMin(player, asSlice);
        twosheep.multiverse.mwCollapseMin(player, Multiverse.asSlice(offer));

        return true;
    },

    // Example: »black received «
    receive: function(element)
    {
        const textContent = element.textContent;
        if (!textContent.includes(twosheep.snippets.receivedResources)) return false;
        const player = textContent.substring(0, textContent.indexOf(twosheep.snippets.receivedResources));
        if (!verifyPlayers(twosheep.players, player)) return false; // Sanity check

        const obtainedResources = twosheep.extractResourcesFromLogMessage(element.innerHTML);
        let asSlice = mw.generateWorldSlice(obtainedResources);
        console.log(`%c${player}%c ← ${resourcesAsUtf8(obtainedResources)}`, twosheep.consoleCss(player), "");
        console.log("Got resources:", player, "<-", obtainedResources);

        twosheep.worlds.mwTransformSpawn(player, asSlice);
        twosheep.multiverse.mwTransformSpawn(player, Multiverse.asSlice(obtainedResources));
        twosheep.multiverse.printWorlds();

        return true;
    },

    // Example: »yellow built a «
    build: function(element, index, array)
    {
        let textContent = element.textContent;
        if (!textContent.includes(twosheep.snippets.built.detect)) return false;
        let player = textContent.split(twosheep.snippets.built.detect)[0];
        if (!player)
        {
            player = twosheep.extractBotActorFromLogMessage(element, twosheep.player_colours);
            //console.debug(`🤖 %c${player}%c (bot built the following)`, twosheep.consoleCss(player), "");
        }
        if (!verifyPlayers(twosheep.players, player)) return false; // Sanity check
        const building = twosheep.extractOnlyBuildingFromLogMessage(element);
        if (building === null)
        {
            console.error("Could not extract building from build message");
            debugger;
            return false;
        }
        if (building === "ship") debugger; // test ship building
        console.assert(["road", "settlement", "city", "ship"].includes(building));
        // Special case: Road builder dev card has same message as buying roads,
        // but is preceded by a road builder notification message.
        if (["road", "ship"].includes(building))
        {
            // Because of the ends turn message, a road builder message 1 or
            // 2 behind is safe to attribute to this road.
            // Else, the road builder could have been from the previous player,
            // who biult only 1 road (could not place more).
            if (  array[index - 1].textContent.includes(twosheep.snippets.built.roadBuilder)
               || array[index - 2].textContent.includes(twosheep.snippets.built.roadBuilder))
            {
                console.log(`🚧 🚧 ${player} (road builder)`);
                return true;
            }
        }
        const buildResources = mw.generateFullNamesFromSlice(mw.mwBuilds[building]);
        console.log(`${utf8Symbols[building]} %c${player}%c → ${resourcesAsUtf8(buildResources)}`, twosheep.consoleCss(player), "");
        //logs("[INFO] Built:", player, buildResources);

        const asSlice = -mw.mwBuilds[building];
        twosheep.worlds.mwTransformSpawn(player, asSlice);
        twosheep.multiverse.mwTransformSpawn(player, Multiverse.costs[building]);
        twosheep.multiverse.printWorlds();

        return true;
    },

    // Example:
    //  - »yellow bought a «
    //  - »yellow bought a 🂠«
    buyDev: function(element)
    {
        const textContent = element.textContent;
        if (!textContent.includes(twosheep.snippets.boughtDev)) return false;
        const player = textContent.split(" ")[0];
        if (!verifyPlayers(twosheep.players, player)) return false; // Sanity check

        const devCardResources = mw.generateFullNamesFromSlice(mw.mwBuilds.devcard);
        console.log(`🂠 %c${player}%c → ${resourcesAsUtf8(devCardResources)}`, twosheep.consoleCss(player), "");
        //logs("[INFO] Baught dev card:", player, "->", devCardResources);

        const asSlice = -mw.mwBuilds.devcard;
        twosheep.worlds.mwTransformSpawn(player, asSlice);
        twosheep.multiverse.mwTransformSpawn(player, Multiverse.costs.devcard);
        twosheep.multiverse.printWorlds();

        return true;
    },

    tradeBank: function(element)
    {
        let textContent = element.textContent;
        if (!textContent.includes(twosheep.snippets.tradeBank.detect)) return false;
        let player = textContent.split(twosheep.snippets.tradeBank.detect)[0];
        if (!verifyPlayers(twosheep.players, player)) return false; // Sanity check

        const innerHTML = element.innerHTML.split(twosheep.snippets.tradeBank.split);
        console.assert(innerHTML.length === 2);
        const gave = twosheep.extractResourcesFromLogMessage(innerHTML[0]);
        const took = twosheep.extractResourcesFromLogMessage(innerHTML[1]);
        const giveSlice = mw.generateWorldSlice(gave);
        const takeSlice = mw.generateWorldSlice(took);
        console.log(`🏦 %c${player}%c ${resourcesAsUtf8(gave)} ↔ ${resourcesAsUtf8(took)}`, twosheep.consoleCss(player), "");
        console.info("• Bank trade:", player, gave, "->", took);

        twosheep.worlds.mwTransformSpawn(player, takeSlice - giveSlice);
        twosheep.multiverse.mwTransformSpawn(player,
            Multiverse.sliceSubtract(
                Multiverse.asSlice(took),
                Multiverse.asSlice(gave)));
        twosheep.multiverse.printWorlds();

        return true;
    },

    // Example (resources are listed as images in-between, including exact counts):
    //  1) »red played Monopoly on  and stole  from black«
    //  2) »red played Monopoly on  and stole 5 resources:•  from orange•  from white«
    //  3) »blue played Monopoly on  and stole 11 resources:•  from pink•  from teal•  from white«
    monopoly: function(element)
    {
        const textContent = element.textContent;
        if (!textContent.includes(twosheep.snippets.monopoly.detect)) return false;

        // Remove print eventually
        console.info("Exporting worlds in times of monopoly:");
        const w = twosheep.multiverse.mwHumanReadableWorld();
        console.info(w);

        const thief = textContent.substring(0, textContent.indexOf(" "));
        if (!verifyPlayers(twosheep.players, thief)) return false; // Sanity check

        const htmlSplit = element.innerHTML.split(twosheep.snippets.monopoly.split);
        const textSplit = textContent.split(twosheep.snippets.monopoly.split);
        console.assert(htmlSplit.length >= 1);

        // Implement each kind of monopoly message separately (by victim count).
        // In each case, construct an object for every victim:
        //  { victim: "red", resources: {"wood": 1, ..., "ore": 0} }
        let trades = [];
        if (htmlSplit.length === 1)
        {
            // Mono single victim: Must still exclude resource type icon
            const victim = textContent.substring(textContent.lastIndexOf(" ") + 1);
            const resources = twosheep.extractResourcesFromLogMessage(
                element.innerHTML.split(twosheep.snippets.monopoly.splitSingle)[1]
            );
            trades.push({ "victim": victim, "resources": resources });
        }
        else if(htmlSplit.length === 4 || htmlSplit.length === 3)
        {
            // Mono multiple victims: The original split already splits the
            // resource type identifier icon.
            console.assert(htmlSplit.length === 4 || htmlSplit.length === 3);
            console.assert(textSplit.length === 4 || textSplit.length === 3);
            console.assert(htmlSplit.length === textSplit.length);
            for (let i = 1; i < htmlSplit.length; ++i)
            {
                const victim = textSplit[i].substring(textSplit[i].lastIndexOf(" ") + 1);
                const resources = twosheep.extractResourcesFromLogMessage(htmlSplit[i]);
                trades.push({ victim: victim, resources: resources });
            }
        }
        else
        {
            console.assert(false, "unreachable");
        }
        console.assert(trades.length >= 1);

        let stolenResource = "none";
        for (let j = 0; j < resourceTypes.length; ++j)
        {
            if (trades[0].resources[resourceTypes[j]] > 0)
            {
                stolenResource = resourceTypes[j];
                break;
            }
        }
        console.assert(stolenResource !== "none");
        const stolenResourceIndex = mw.worldResourceIndex(stolenResource);
        console.assert(0 <= stolenResourceIndex && stolenResourceIndex <= 4);
        console.log(`📈 %c${thief}%c ${resourceIcons[stolenResource]}`, twosheep.consoleCss(thief), "");
        for (const trade of trades)
        {
            console.log(`📉 %c${trade.victim}%c ${resourcesAsUtf8(trade.resources)}`, twosheep.consoleCss(trade.victim), "");
            //console.debug("◦", trade.resources, `from ${trade.victim}`);
        }

        // If only the monopoly resource type is known transformMonopoly() is
        // used. Twosheep lists exact counts, so implement as trade, followed by
        // collapsing to 0 of the resource type left.
        //twosheep.multiverse.transformMonopoly(thief, worldResourceIndex(stolenResource));

        // Since twosheep tells the resources in detail, trade them over
        // individually, then collapse to 0 left over.
        let collapseResources = deepCopy(mw.maxResourcesByNameWithU);
        collapseResources[stolenResource] = 0;
        const collapseSlice = mw.generateWorldSlice(collapseResources);
        console.assert(!mw.sliceHasNegative(collapseSlice));
        // FIXME
        //  Currently WE HAVE TO have the unknown resource in the dummyDemand,
        //  because the transformtradebyname function iterates unknown resources
        //  as well. This is maximally dangerous and unstable since we never
        //  know if we need it or not. Recentl I added it carelessly, but either
        //  have it always or never.
        //
        //  Start be removing (or at least renaming) the emtpy resources
        //  constants without "unknown".
        const dummyDemand = deepCopy(mw.emptyResourcesByNameWithU);
        for (const trade of trades)
        {
            twosheep.worlds.transformTradeByName
            (
                trade.victim,
                thief,
                trade.resources,
                dummyDemand,
                true // skip nonzero check (for dummyDemand)
            );
            twosheep.worlds.mwCollapseMax(trade.victim, collapseSlice);
            twosheep.multiverse.transformTradeByName
            (
                trade.victim,
                thief,
                trade.resources,
                dummyDemand, // Using MW resource here but are by name
                true
            )
            twosheep.multiverse.mwCollapseMax(trade.victim, Multiverse.asSlice(collapseResources));
        }

        return true;
    },

    // Assume max of 7
    discard: function(element)
    {
        let textContent = element.textContent;
        if (!textContent.includes(twosheep.snippets.discard)) return false;
        let player = textContent.split(twosheep.snippets.discard)[0];

        // The bot icon seems to appear only in some cases (?)
        if (!player)
        {
            player = twosheep.extractBotActorFromLogMessage(element, twosheep.player_colours);
            console.log(`🤖 %c${player}%c (the bot discards)`, twosheep.consoleCss(player), "");
            //console.debug(`◦ The bot discards for ${player}`);
        }

        if (!verifyPlayers(twosheep.players, player)) return false; // Sanity check

        const discarded = twosheep.extractResourcesFromLogMessage(element.innerHTML);
        const discardedCardsAsSlie = mw.generateWorldSlice(discarded);
        console.log(`🗑 %c${player}%c → ${resourcesAsUtf8(discarded)}`, twosheep.consoleCss(player), "");
        //logs("[INFO] Discarded:", player, "->", discarded);

        twosheep.worlds.mwCollapseMinTotal(player); // Total can be unknown to MW after monopoly
        twosheep.worlds.mwTransformSpawn(player, -discardedCardsAsSlie);
        twosheep.multiverse.mwCollapseTotal(player, n => n >= 8);
        twosheep.multiverse.mwTransformSpawn(player,
            Multiverse.sliceNegate(
                Multiverse.asSlice(discarded)));

        return true;
    },

    // Example:
    //  »green traded topinkfor«
    //  »green traded 🐑toᵖⁱⁿᵏfor🌾«
    trade: function(element)
    {
        // FIXME implement
        // Identify trading messages
        let textContent = element.textContent;
        if (!textContent.includes(twosheep.snippets.trade.detect)
           ||textContent.includes(twosheep.snippets.trade.not))
        {
            return false;
        }
        const end = twosheep.snippets.trade.end;
        console.assert(textContent.endsWith(end));

        const playersElems = element.querySelectorAll(".playerName")
        console.assert(playersElems.length === 2);
        const tradingPlayer = playersElems[0].textContent;
        const otherPlayer = playersElems[1].textContent;
        if (!verifyPlayers(twosheep.players, tradingPlayer, otherPlayer)) return false;

        // Search before this for offer, after this for demand
        const split = element.innerHTML.split(twosheep.snippets.trade.split);
        console.assert(split.length === 3);
        const offer = twosheep.extractResourcesFromLogMessage(split[1]);
        const demand = twosheep.extractResourcesFromLogMessage(split[2]);
        console.log(`%c${tradingPlayer}%c ${resourcesAsUtf8(offer)} ↔️ ${resourcesAsUtf8(demand)} %c${otherPlayer}%c`, twosheep.consoleCss(tradingPlayer), "", twosheep.consoleCss(otherPlayer), "");
        //logs("[INFO] Trade:", offer, tradingPlayer, "--> | <--", otherPlayer, demand);

        twosheep.worlds.transformTradeByName(tradingPlayer, otherPlayer, offer, demand);
        twosheep.multiverse.transformTradeByName(tradingPlayer, otherPlayer, offer, demand);
        twosheep.multiverse.printWorlds();

        return true;
    },

    steal: function(element)
    {
        let textContent = element.textContent;

        // Detect desired message type
        const containsStealSnippet = textContent.includes(twosheep.snippets.steal.detect);
        if (!containsStealSnippet) return false;
        const containsStealNot = textContent.includes(twosheep.snippets.steal.not);
        if (containsStealNot) return false;

        // Obtain player names
        let [stealingPlayer, targetPlayer] = textContent.split(twosheep.snippets.steal.detect);
        if (!stealingPlayer)
        {
            stealingPlayer = twosheep.extractBotActorFromLogMessage
            (
                element,
                twosheep.player_colours
            );
            console.log(`🤖 %c${stealingPlayer}%c (the bot steals)`, twosheep.consoleCss(stealingPlayer), "");
            //console.debug(`◦ The bot steals for ${stealingPlayer}`);
        }
        //console.debug(`◦ Player ${stealingPlayer} steals from ${targetPlayer}`);
        console.assert(stealingPlayer && targetPlayer);
        if (!verifyPlayers(twosheep.players, stealingPlayer, targetPlayer))
            return false;

        // Distinguish known from unknown
        const resources = twosheep.extractResourcesFromLogMessage(element.innerHTML);
        const stolenResourceType = Object.entries(resources).reduce(
            (res, [key, value]) => value !== 0 ? key : res, null);
        const asSlice = mw.generateFullSliceFromNames(resources);
        console.assert(mw.getResourceSumOfSlice(asSlice) === 1);

        twosheep.tracker.addRob(stealingPlayer, targetPlayer);
        if (resources.unknown === 1)
        {
            console.log(`🥷 %c${stealingPlayer}%c ← 🂠 %c${targetPlayer}%c`, twosheep.consoleCss(stealingPlayer), "", twosheep.consoleCss(targetPlayer), "");
            console.info("• Steal (unknown):", targetPlayer, "->", stealingPlayer);
            twosheep.worlds.branchSteal(targetPlayer, stealingPlayer);
            twosheep.multiverse.branchSteal(targetPlayer, stealingPlayer);
            twosheep.multiverse.printWorlds();
        }
        else
        {
            const stolenResourceIndex = mw.worldResourceIndex(stolenResourceType);
            console.log(`🥷 %c${stealingPlayer}%c ← ${resourcesAsUtf8(resources)} %c${targetPlayer}%c`, twosheep.consoleCss(stealingPlayer), "", twosheep.consoleCss(targetPlayer), "");
            console.info("• Steal (known):", targetPlayer, "->", stealingPlayer, "(", resources, ")");
            twosheep.worlds.collapseAsRandom(targetPlayer, stolenResourceIndex);
            twosheep.worlds.transformExchange(targetPlayer, stealingPlayer, asSlice);
            twosheep.multiverse.collapseAsRandom(targetPlayer,
                Multiverse.getResourceIndex(stolenResourceType));
            twosheep.multiverse.mwTransformExchange(targetPlayer, stealingPlayer,
                Multiverse.asSlice(resources));
        }

        return true;
    },

    // Order in which parser are to be tried (and enabling 'for of')
    ordered:
    [
        // Try likely matches earlier, by gut feeling
        "always",

        "receive", // + yop implicitly
        "roll",
        "build", // + road builder as special case
        "steal", // + knight robs implicitly (does not track knight playing)
        "tradeOffer",
        "trade",
        "tradeOfferCounter",
        "tradeBank",
        "buyDev",
        "discard",
        "monopoly",

        "fallback",
    ]
} // parsers

}; // "namespace" twosheep

// We define bindings to the 'addEventListener' targets because that prevents
// them from being added twice.

// Hide/Show display elements (also stops
const twosheepToggle = twosheep.toggleTracker.bind(twosheep);
// Re-assign card counts
const twosheepRecoverCards = twosheep.recoverCards.bind(twosheep);
// Re-detect players, then wait for recoverCards
const twosheepRecoverNames = twosheep.recoverNames.bind(twosheep);
// Full reset (same as startup)
const twosheepRestart = twosheep.restartTracker.bind(twosheep);

// vim: shiftwidth=4:softtabstop=4:expandtab
