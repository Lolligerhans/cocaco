// FIXME
//  • Edge case card combinations
//  • Unrealized development cards may be confused with regular action
//      ◦ Building a knight regularly after using only 1 upgrade from an
//        engineer (reset engineer when road is built)
//      ◦ Deserter + building later
//      ◦ smith and upgrading later
//      ◦ 0-card monopoly (?)
//      ◦ road builder before beiung able to build
//      ◦ ...
//      ◦ diplomat?
//  • (I think medicine and crane are safe)

"use strict";

class Colony
{
    static refreshRate = 3000;

    //=====================================================================
    // Static
    //=====================================================================

    // Returns resource type of any resource card found in the element. Use when
    // there is only one resource card.
    static findSingularResourceImageInElement(element)
    {
        const res = Colony.extractResourcesFromElement(element);
        const keys = Object.keys(res);
        console.assert(keys.length === 1);
        if (keys.length !== 1)
        {
            console.error("Expected 1 resource card in element", element);
            debugger;
        }
        return keys[0];
    }

    // Uses query selector and .src to determine resource cards specified in
    // 'imageNameSnippets'. Reurns resources by name.
    // @param  element: Log message element as processed by main loop parsers
    // @return  Resources by name: { wood:1, coin:3, unknown:2 }
    static extractResourcesFromElement(element)
    {
        const images = element.querySelectorAll("img");
        let resources = {}; // By name
        images.forEach(img =>
        {
            for (const [alt, name] of Object.entries(Colony.imageAltMap))
            {
                if (alt !== img.alt)
                    continue;
                // Treat undefined as 0
                resources[name] = (resources[name] || 0) + 1;
                break;
            }
        });
        return resources;
    }

    // TODO Replace string-based with normal version when possible
    // Matches input string 'html' against assumed-unique strings identifying
    // resource card images.
    // ❗ Does NOT find "unknown" cards.
    // Returns object {wood: 0, brick:1, …}
    static findAllResourceCardsInHtml(html)
    {
        // Match 'resourceSnippets' against string content
        let foundAny = false;   // For sanity check
        let cards = {wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0, cloth: 0, coin: 0, paper: 0};
        for (const [res, uniqueResString] of Object.entries(Colony.resourceSnippets))
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

        // Never return unknown cards, even if present
        cards["unknown"] = 0;

        return cards;
    }

    // Sum values of child elements that are dice images
    static extractDiceSumOfChildren(element)
    {
        let images = collectionToArray(element.getElementsByTagName("img"));
        let diceTest = new RegExp("^dice_[red_]*\\d");
        let total = images.reduce((sum, img) =>
        {
            // Alt text is "dice_6" when rolling a 6.
            // Only images present are the dice images.
            let altText = img.getAttribute("alt");
            if (!altText) alertIf("No alt text in dice image");
            if (!diceTest.test(altText)) return sum;   // Skip if not a dice image
            let diceNum = Number(altText.slice(-1));
            return sum + diceNum;
        } , 0);
        return total;
    }

    static deleteDiscordSigns()
    {
        const ids = [ "remove_ad_in_game_left", "remove_ad_in_game_right",
            "in_game_ab_right", "in_game_ab_left" ];
        for (const id of ids)
        {
            let element = document.getElementById(id);
            if (element) element.remove();
        }
        console.log("Removed elements");
    }

    //=====================================================================
    // Constants
    //=====================================================================

    static snippets =
    {
        initialPlacementDoneSnippet: "rolled",
        receivedInitialResourcesSnippet: "received starting resources",  // Used to determine which resources each player should get in the initial phase
        gold: {present: "from gold tile", absent: "selecting resource from gold tile"},
        sufficientInitialPhaseMessageSnippet: "received starting resources", // Sufficient (not necessary) to identify messages from the initial phase
        placeInitialSettlementSnippet: "placed a", // Necessary (not sufficient) for detecting initial placement. Used to determine players
        tradeOfferSnippet: " wants to give ",
        tradeOfferResSnippet: " for ",
        tradeOfferCounterSnippet: " proposed counter offer to ",
        yearOfPlentySnippet: " took from bank ",
        receivedResourcesSnippet: " got ",
        builtSnippet: " built a ",
        boughtSnippet: " bought ",
        tradeBankGaveSnippet: "gave bank",
        tradeBankTookSnippet: "and took",
        mono: {present: " stole ", absent: "from"},
        discardedSnippet: " discarded ",
        trade: {detect: " traded for with ", split: " for "},
        steal: {you: ["You ", " from you"], detect: " stole from "},
        winSnippet: "won the game",
        rolledSnippet: " rolled ",

        // New
        movedRobber: " moved Robber ",
        movedShip: " moved ",
        placeShipRoad: {text: " placed a ", alt: ["ship", "road"]},
        placeKnight: {text: " placed a ", alt: "Knight"},
        activateKnight: " activated knight ",
        upgradeKnight: {text: " upgraded ", alt: "Knight"},
        aqueduct: "selected from Aqueduct",
        upgradeCity: " upgraded to level ",
        progressCard: {text: " used ", alts:
            [
                // These must match the strings in the 'parseProgressCard' function
                "Commodity Monopoly",
                "Crane",
                "Deserter",
                "Engineer",
                "Master Merchant",
                "Medicine",
                "Resource Monopoly",
                "Road Building",
                "card road building", // Base game only
                "Smith",
                "Spy",
                "Wedding",
            ]},
        commodityMonopoly: " stole ",
        resourceMonopoly: " stole ",
        commercialHarbor: {text: "a resource in exchange for a commodity", split: "gave "}, // Split contains space on one side
        commercialHarborOur: "You gave",
        specialBuildPhase: "Special Build Phase",
        diplomatReposition: "is repositioning their road",
    }

    static upgradeMap =
    {
        ["science square"]: "paper",
        ["trade square"]: "cloth",
        ["politics square"]: "coin",
    }

    static imageAltMap =
    {
        // alt: (our) name
        "lumber": "wood",
        "brick": "brick",
        "wool": "sheep",
        "grain": "wheat",
        "ore": "ore",
        "cloth": "cloth",
        "coin": "coin",
        "paper": "paper",
        "card": "unknown",
    };

    static imageNameSnippets =
    {
        wood: "card_lumber", brick: "card_brick", sheep: "card_wool",
        wheat: "card_grain", ore: "card_ore",
        cloth: "card_cloth", coin: "card_coin", paper: "card_paper",
        unknown: "card_rescardback",
        road: "road_red",
        settlement: "settlement_red",
        devcard: "card_devcardback",
        city: "city_red",
        ship: "ship_red_north_west",
    };

    static resourceSnippets =
    ( ({wood, brick, sheep, wheat, ore, cloth, coin, paper}) =>
      ({wood, brick, sheep, wheat, ore, cloth, coin, paper})
    ) (Colony.imageNameSnippets);

    static colonistAssets =
    {
        wood:       `<img src="dist/images/${Colony.imageNameSnippets["wood"]}.svg" class="explorer-tbl-resource-icon"/>`,
        brick:      `<img src="dist/images/${Colony.imageNameSnippets["brick"]}.svg" class="explorer-tbl-resource-icon"/>`,
        sheep:      `<img src="dist/images/${Colony.imageNameSnippets["sheep"]}.svg" class="explorer-tbl-resource-icon"/>`,
        wheat:      `<img src="dist/images/${Colony.imageNameSnippets["wheat"]}.svg" class="explorer-tbl-resource-icon"/>`,
        ore:        `<img src="dist/images/${Colony.imageNameSnippets["ore"]}.svg" class="explorer-tbl-resource-icon"/>`,
        cloth:      `<img src="dist/images/${Colony.imageNameSnippets["cloth"]}.svg" class="explorer-tbl-resource-icon"/>`,
        coin:       `<img src="dist/images/${Colony.imageNameSnippets["coin"]}.svg" class="explorer-tbl-resource-icon"/>`,
        paper:      `<img src="dist/images/${Colony.imageNameSnippets["paper"]}.svg" class="explorer-tbl-resource-icon"/>`,
        unknown:    `<img src="dist/images/${Colony.imageNameSnippets["unknown"]}.svg" class="explorer-tbl-resource-icon"/>`,
        road:       `<img src="dist/images/${Colony.imageNameSnippets["road"]}.svg" class="explorer-tbl-resource-icon"/>`,
        settlement: `<img src="dist/images/${Colony.imageNameSnippets["settlement"]}.svg" class="explorer-tbl-resource-icon"/>`,
        devcard:    `<img src="dist/images/${Colony.imageNameSnippets["devcard"]}.svg" class="explorer-tbl-resource-icon"/>`,
        city:       `<img src="dist/images/${Colony.imageNameSnippets["city"]}.svg" class="explorer-tbl-resource-icon"/>`,
        ship:       `<img src="dist/images/${Colony.imageNameSnippets["ship"]}.svg" class="explorer-tbl-resource-icon"/>`,
    };

    static emptyTurnState =
    {
        // Many "stole" messages look the same but have different semantics.
        // 'nextSteal' describes the steal event that has to happen next. Every
        // parser checking for the "stole" message has to verify that it is it's
        // turn.
        //
        // One of: "resourceMonopoly", "commodityMonopoly", "spy",
        // "masterMerchant", "wedding", "robber"
        //
        //      ❕ We do not distinguish robber from knight/bishop, because
        //      these steals look the same and have the same semantics. Also
        //      knight/bishop generate a robber message as well. We handle these
        //      by simpl setting 'nextSteal' to 'robber' for knight/bishop.
        //      Since knight and bishop produce "moved Robber" messages, we do
        //      not implement them explicitly.
        //
        // Versions that always resolve in a (fixed count of) corresponding
        // "stole" messages (safe in any case):
        //   • resource monopoly
        //   • commodity moopoly
        // Versions that have 0 or 1 "stole" messages can reset the 'nextSteal'
        // indicator (but may be overwritten by others):
        //   • spyx
        //   • master merchant
        // Versions with varying amount of "stole" messages (always rely on
        // other types overwriting the 'nextSteal' indicator):
        //   • robber (7, knight, bishop)
        //   • wedding
        nextSteal: null,

        // The remaining state is simpler, it is set on progress card and reset
        // at the start of each turn.
        crane: false,       // Next city improvement costs 1 resource less
        deserter: false,    // Next knight is free, then reset this flag
        diplomatReposition: false, // Next road is free
        engineer: false,    // Build city wall for free
        medicine: false,    // Next city costs 1 wheat 2 ore
        roadBuilding: 0,    // Next N road/ship is built with "place" and free
        smith: 0,           // Can upgrade this many knight for free
    }

    constructor()
    {
        // Main loop with index matching 'activeIndex' is allowed to run.
        // Increment to stop. Start new main loop to continue. 'lastStarted' is
        // set to 'activeIndex' at invocation of main loop (to deduce if a main
        // loop is currently still active).
        this.activeIndex = 0;
        this.lastStarted = 0;

        this.reset();

        // Bind things so addEventListener can identify them
        this.boundMainLoopToggle = this.mainLoopToggle.bind(this);
        this.boundRecoverCards = this.recoverCards.bind(this);
        this.boundRecoverNames = this.recoverNames.bind(this);

        // C&K has stateful messages. We add flags and reset after each roll
        this.turnState = Colony.emptyTurnState;

        // The parser 'parseInitialGotMessage()' is not included in this list. We
        // call use it once at the start, not regularly. The parseTurnName() parse
        // is also not included. Used for recovery.
        //
        // Structural convention:
        //  1) Match message type
        //  2) Read message elements (log result)
        //  3) Compute elements into slices
        //  4) Update 'multiverse'
        //  5) Update 'turnState'
        //  6) Return true if message type matched. Else return false.
        this.ALL_PARSERS =
        [
            this.parseAlways.bind(this),
            this.parseGotMessage.bind(this),
            this.parseGoldTile.bind(this),
            this.parseTradeOffer.bind(this),
            this.parseTradeOfferCounter.bind(this),
            this.parseRolls.bind(this),

            this.stealUnknown.bind(this),
            this.stealKnown.bind(this),
            this.parseTradeBankMessage.bind(this),
            this.parseTradeMessage.bind(this),
            this.parseDiscardedMessage.bind(this),
            this.parseBuiltMessage.bind(this),
            this.parseBoughtMessage.bind(this), // Dev cards
            this.parseMonopoly.bind(this), // Regular monopoly only
            this.parseYearOfPlenty.bind(this),

            this.parseWin.bind(this),

            // -----------
            // C&K
            // -----------
            // TODO Decide on parse order

            this.parseMoveRobber.bind(this),
            this.parseMoveShip.bind(this),
            // Ships always have "place", roads only from road building
            this.parsePlaceShipRoad.bind(this),
            this.parsePlaceKnight.bind(this),
            this.parseActivateKnight.bind(this),
            this.parseUpgradeKnight.bind(this),
            this.parseAqueduct.bind(this),
            this.parseUpgradeCity.bind(this),
            // For all (relevant) progress activation messages
            this.parseProgressCard.bind(this),
            this.parseResourceMonopoly.bind(this),
            this.parseCommodityMonopoly.bind(this),
            this.parseCommercialHarbor.bind(this),
            this.parseCommercialHarborOurs.bind(this),
            this.parseSpecialBuildPhase.bind(this),
            this.parseDiplomatReposition.bind(this),
        ];

    } // ctor

} // class Colony

//=====================================================================
// Messages
//=====================================================================

Colony.prototype.getAllMessages = function()
{
    if (!this.logElement)
    {
        alertIf(41);
        throw Error("Log element hasn't been found yet.");
    }
    return collectionToArray(this.logElement.children);
}

Colony.prototype.getNewMessages = function(asIndex = false)
{
    const index = this.MSG_OFFSET;
    const allMessages = this.getAllMessages();
    this.MSG_OFFSET = allMessages.length;
    if (asIndex === false)
        return allMessages.slice(index);
    else if(asIndex === true)
        return [allMessages, index];
    else
        console.assert(false, "unreachable");
}

// ❗ Has the sideeffect of updating a checkpoint message number (separate
// from MSG_INDEX).
// TODO This is essentially the same as MSG_INDEX, but for the rendering.
//      Consolidate the similarities.
Colony.prototype.isNewMessage = function(msgNumber)
{
    if (msgNumber > this.messageNumberDone)
    {
        this.messageNumberDone = msgNumber;
        return true;
    }
    return false;
}

//==============================================================================
// Program flow
//==============================================================================

Colony.prototype.restartTracker = function(tasks =
[
    { "funct": this.reset.bind(this),                             "ok": false },
    { "funct": this.findPlayerName.bind(this),                    "ok": false },
    { "funct": this.findLog.bind(this),                 "ok": false },
    { "funct": this.waitForInitialPlacement.bind(this),           "ok": false },
    { "funct": this.recoverUsers.bind(this),                      "ok": false },
    { "funct": this.initializeTracker.bind(this),                 "ok": false },
    { "funct": () => { this.MSG_OFFSET = 0; return true; },       "ok": false },
    { "funct": this.comeMrTallyManTallinitialResource.bind(this), "ok": false },
    { "funct": this.restartMainLoop.bind(this),                   "ok": false },
])
{
    for (let i = 0; i < tasks.length; ++i)
    {
        if (tasks[i].ok)
            continue;
        console.info(`🧭 ( ${i} ) restartTracker:`, tasks[i].funct.name);
        // Assume we will succeed and remember for when we come back
        tasks[i].ok = true;
        // Use 'restartTracker' function as then parameter to setDoInterval().
        // Once then() is executed, we know to skip this index and continue with
        // the next one.
        setDoInterval(tasks[i].funct, Colony.refreshRate, this.restartTracker.bind(this, tasks));
        // Return, but we imagine that the program flow continues with the
        // setDoInterval().
        return; // Continue in new setInterval
    }
    console.info("🧭 ( ✔️  ) restartTracker' dispatcher completed");
}

    // Like ctor, but keeps 'activeIndex' and 'lastStarted' intact so we dont
    // orphan the 'mainLoop' 'setDoInterval'.
Colony.prototype.reset = function()
{
    this.logElement = null;
    this.playerUsernameElement = null;

    this.playerUsername; // "John"
    this.players = []; // ["John", "Jane", ...]
    this.playerColours = {}; // {"John": "blue", "Jane": "rgb(...)", ...}

    this.multiverse = null; // new Multiverse();
    this.renderObject = null; // new Render();
    this.trackerCollection = null; // new Track();

    this.MSG_OFFSET = 0;
    this.messageNumberDone = -1;
    this.startupFlag = true;

    return true;
}

Colony.prototype.findPlayerName = function()
{
    console.log("[NOTE] searching profile name");
    this.playerUsernameElement = document.getElementById("header_profile_username");
    console.assert(this.playerUsernameElement !== null, "should always be present, during and outside of games");
    this.playerUsername = deepCopy(this.playerUsernameElement.textContent);
    console.log("[NOTE] Found profile:", `"${this.playerUsername}"`);

    let e = document.getElementById("header_navigation_store");
    if (e !== null) e.textContent = "CoCaCo " + version_string;

    return true;
}

Colony.prototype.findLog = function()
{
    console.log("[NOTE] Waiting to start");

    this.logElement = document.getElementById("game-log-text");
    if (!this.logElement)
        return false;
    console.log("Found game-log-text element");
    Colony.deleteDiscordSigns();
    this.logElement.addEventListener("click", this.boundMainLoopToggle, false);

    for (e of this.logElement.children)
        e.style.background = "";

    return true;
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
 * The main loop is then started with this.MSG_OFFSET pointing to the first
 * non-initial placement message.
 **/
Colony.prototype.waitForInitialPlacement = function()
{
    const dummyPlayers = ["Awaiting", "First", "Roll", "..."];
    const dummyColours = {"Awaiting":"black", "First":"red", "Roll":"gold", "...":"white"};
    this.multiverse = new Multiverse();
    this.multiverse.initWorlds({"Awaiting":{}, "First":{}, "Roll":{}, "...":{}});
    this.trackerCollection = new Track();
    this.trackerCollection.init(dummyPlayers);
    this.renderObject = new Render
    (
        this.multiverse, this.trackerCollection, dummyPlayers, dummyColours,
        null,
        null,
        null,
        configOwnIcons ? alternativeAssets : Colony.colonistAssets
    );
    this.renderObject.unrender(); // Remove leftovers during testing
    this.renderObject.render();
    return true;
}

// Get new messages until 'playerCount' many player names were found. If
// 'playerCount' is null, continue until the first roll instead. Must stop
// main loop before running this so they dont interfere. Advances
// this.MSG_OFFSET as usual.
// At start of the game, set 'palyerCount' to null so the number is deduced.
// When recovering from breaking log, or spectating, set 'playerCount' so
// the function continues while parsing rolls.
Colony.prototype.recoverUsers = function(playerCount = null)
{
    // NOTE If we make sure not to read initial placement messages, we can set
    //      MSG_OFFEST to 0, too. Those can appear out-of-player-order, and we
    //      imply the order from messages.
    //this.MSG_OFFSET = 0;

    let foundRoll = false;
    const done = () =>
    {
        if (playerCount === null)
            return foundRoll;
        else
            return playerCount - this.players.length === 0;
    };
    console.assert(!done()); // Dont come back when done

    console.log("[NOTE] Detecting player names...");
    const newMsg = this.getNewMessages();
    for (const msg of newMsg)
    {
        if (msg.textContent.includes(Colony.snippets.rolledSnippet))
        {
            foundRoll = true;
            // If this concludes the recovery we can skip the rest. If this
            // does not conclude (because 'playerCount' is not reached), we
            // continue so that we don't have to take the route around
            // 'setDoInterval' just to end up here again.
            if (done())
                break;
        }

        const [name, colour] = this.parseTurnName(msg);
        if (name === null)
            continue;
        if (!this.players.includes(name))
        {
            this.players.push(name);
            this.playerColours[name] = colour;
            console.log("Recoverd player", name, "with colour", colour);
            if (done())
                break;
        }
    }

    if (!done())
        return false; // Signal "not done" to come back again
    this.reorderPlayerNames();
    return true;
}

// Initializes the member objects once the required inputs are ready:
// name + colour data must be handed to the member objects for construction.
Colony.prototype.initializeTracker = function()
{
    let noResources = {};
    for (const name of this.players)
        noResources[name] = {}; // Could be {"wood": 5, ...}

    this.multiverse = new Multiverse();
    this.multiverse.initWorlds(noResources);
    this.trackerCollection = new Track;
    this.trackerCollection.init(this.players);

    // TODO Once we wanted to have persistent click bind (to UI or when not
    // removing the table, we need to create a permanent bind object to
    // prevent multi binds.

    this.renderObject.unrender(); // Remove table to force redraw over update
    this.renderObject = new Render
    (
        this.multiverse, this.trackerCollection,
        this.players, this.playerColours,
        null,
        this.boundRecoverCards,
        this.boundRecoverNames,
        configOwnIcons ? Colony.alternativeAssets : Colony.colonistAssets
    );

    this.renderObject.render();
    return true;
}

/**
 * Parse all messages and distribute initial resources for each player.
 * Does not wait for new messages; all initial placement messages must be
 * present beforehand.
 */
Colony.prototype.comeMrTallyManTallinitialResource = function(after)
{
    let foundRoll = false;
    console.log("Polling for initial placement");
    let [allMessages, i] = this.getNewMessages(true);
    for (; i < allMessages.length; ++i)
    {
        const msg = allMessages[i];
        if (msg.textContent.includes(Colony.snippets.rolledSnippet))
        {
            foundRoll = true;
            break;
        }
        this.parseInitialGotMessage(msg); // Finds resources and adds them
    };
    if (!foundRoll)
        return false;

    this.MSG_OFFSET = i;

    console.log("Correcting this.MSG_OFFSET to 28 ?==", i);
    console.assert(this.MSG_OFFSET === 28, "Expecting message offset for initial phase to be 28 for clean 4 player game");
    return true;
}

// @param {function} continueIf - A function that returns true if the main
// loop should proceed.
Colony.prototype.mainLoop = function(continueIf = () => true)
{
    if (!continueIf())
        return true; // Return true to signal completion to setDoInterval
    console.assert(this.startupFlag === false);
    if(configUseTimer) console.time("mainLoop");

    const [allMessages, index] = this.getNewMessages(true);
    for (let idx = index; idx < allMessages.length; ++idx)
    {
        const msg = allMessages[idx];
        const unidentified = this.ALL_PARSERS.every(parser =>
        {
            return !parser(msg, idx, allMessages);
        });

        msg.style.background = unidentified ? "LightGoldenRodYellow" : "PaleGreen";
        this.multiverse.printWorlds();
        if (configLogWorldCount === true) console.log("[NOTE] MW count:", this.multiverse.worlds.length);
        if (0 === this.multiverse.worldCount()) // Implies error
        {
            msg.style.background = "LightCoral";
            console.error("[ERROR] No world left");
            alertIf("Tracker OFF: No world left. Try recovery mode.");
            this.stopMainLoop();
            return true; // Return true to signal completion
        }
    }
    if (configUseTimer) console.timeEnd("mainLoop");

    if (configUseTimer) console.time("render");
    this.renderObject.render(() => this.isNewMessage(this.MSG_OFFSET));
    if (configUseTimer) console.timeEnd("render");
}

// Recovers MW state from unknown cards. Player array is used and assumed
// correct.
Colony.prototype.recoverCards = function()
{
    // Save index at moment of click
    const allMessages = this.getAllMessages();
    const momentIndex = allMessages.length;
    if (momentIndex >= 1) allMessages[momentIndex - 1].style.background = "Orange";

    console.log("[NOTE] Starting manual card recovery");
    const activeBefore = this.isActiveMainLoop();
    this.stopMainLoop();
    // Confirm AFTER stopping main loop so that card counts can be timed
    if (!confirm(`Reset cards after »${allMessages.at(momentIndex-1).textContent}« (${activeBefore ? "active" : "inactive"})?`))
    {
        console.log("[NOTE] Aborting manual card recovery");
        if (activeBefore)
            this.restartMainLoop();
        return;
    }

    this.MSG_OFFSET = momentIndex;
    let counts = {};
    for (const player of this.players)
    {
        const count = prompt(`${player} number of cards:`, 0);
        counts[player] = Number(count);
    }
    this.multiverse.mwCardRecovery(counts);

    this.renderObject.render();
    this.restartMainLoop();
}

// Waits 1 round to collect all player names. Use recoverCards() to
// set unknown card counts, entering manyWorlds recovery mode.
Colony.prototype.recoverNames = function()
{
    if (this.startupFlag === true)
    {
        console.warn(`${recoverNames.name}: Suppressed! startupFlag === true`);
        return;
    }
    console.log("[NOTE] Starting manual name recovery");
    const playerCount = Number(prompt("Player count (0 to abort):", 0));
    if (playerCount < 1 || 8 < playerCount)
    {
        console.error("Invalid player count:", playerCount, "(1-8). Aborting name recovery.");
        return;
    }

    this.stopMainLoop();
    this.renderObject.unrender();

    this.restartTracker(
    [
        { "funct": this.reset.bind(this), "ok": false },
        { "funct": this.findPlayerName.bind(this), "ok": false },
        { "funct": this.findLog.bind(this), "ok": false },
        { "funct": this.waitForInitialPlacement.bind(this), "ok": false },
        { "funct": this.recoverUsers.bind(this, playerCount), "ok": false },
        { "funct": this.initializeTracker.bind(this), "ok": false },
        { "funct": () => { this.renderObject.render(); return true; }, "ok": false },
    ]);
}

//=====================================================================
// Main loop
//=====================================================================

Colony.prototype.isActiveMainLoop = function()
{
    return this.lastStarted === this.activeIndex;
}

// Returns true if existing main loop interval was cleared, otherwise false
Colony.prototype.stopMainLoop = function()
{
    console.log("stopMainLoop()");
    this.activeIndex += 1;

    if (configUseTimer) console.timeEnd("mainLoop");
}

Colony.prototype.restartMainLoop = function()
{
    this.stopMainLoop(); // Sanitize
    console.log("restartMainLoop()");
    this.startupFlag = false;
    this.lastStarted = deepCopy(this.activeIndex);
    const currentIndex = deepCopy(this.activeIndex); // Passed to closure
    setDoInterval
    (
        this.mainLoop.bind
        (
            this,
            () => this.activeIndex === currentIndex // Continue condition
        ),
        Colony.refreshRate
    );

    return true;
}

Colony.prototype.mainLoopToggle = function()
{
    if (this.startupFlag === true)
    {
        console.warn("this.mainLoopToggle() suppressed: this.startupFlag === true");
        return;
    }
    if (this.isActiveMainLoop())
    {
        this.stopMainLoop();
        this.renderObject.unrender();
    }
    else
    {
        this.restartMainLoop();
        this.renderObject.render(); // Render also if no new message found
    }
}

//=====================================================================
// Parsers
//=====================================================================

/**
 * Process initial resource message after placing first settlement.
 */
Colony.prototype.parseInitialGotMessage = function(element)
{
    const textContent = element.textContent;
    if (!textContent.includes(Colony.snippets.receivedInitialResourcesSnippet))
    {
        return false;
    }
    const player = textContent.replace(Colony.snippets.receivedInitialResourcesSnippet, "").split(" ")[0];
    if (!verifyPlayers(this.players, player)) return false;

    const initialResources = Colony.extractResourcesFromElement(element);
    const asSlice = mw.generateWorldSlice(initialResources);
    console.log(`▶️ %c${player}%c ${resourcesAsUtf8(initialResources)}`, this.cssColour(player), "");
    //console.debug(`• Set initial resources for ${name} to`, resources);
    if (asSlice === 0) { console.warn("[WARNING] Empty starting resources"); }
    this.multiverse.mwTransformSpawn(player, Multiverse.asSlice(initialResources));

    return true;
}

Colony.prototype.parseTradeOffer = function(element)
{
    const txt = element.textContent;
    if (!txt.includes(Colony.snippets.tradeOfferSnippet)) return false;
    const player = txt.substring(0, txt.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check

    // TODO Can we replace the html string parsing? Can we also do so for the
    //      trade offer counter parser?
    const offerHtml = element.innerHTML.split(Colony.snippets.tradeOfferResSnippet)[0];
    const offer = Colony.findAllResourceCardsInHtml(offerHtml);
    const asSlice = mw.generateWorldSlice(offer);
    logs("[INFO] Trade offer:", player, "->", offer);
    this.multiverse.mwCollapseMin(player, Multiverse.asSlice(offer));

    return true;
}

Colony.prototype.parseTradeOfferCounter = function(element)
{
    // "John1 proposed counter offer to John2 [wood][brick] for [sheep]"
    const txt = element.textContent;
    if (!txt.includes(Colony.snippets.tradeOfferCounterSnippet)) return false;

    const player = txt.substring(0, txt.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false;

    // TODO Can we use structural parsing over strings?
    const offerHtml = element.innerHTML.split(Colony.snippets.tradeOfferResSnippet)[0];
    const offer = Colony.findAllResourceCardsInHtml(offerHtml);
    const asSlice = mw.generateWorldSlice(offer);
    logs("[INFO] Trade counter offer:", player, "->", offer);
    this.multiverse.mwCollapseMin(player, Multiverse.asSlice(offer));

    return true;
}

Colony.prototype.parseYearOfPlenty = function(element)
{
    const textContent = element.textContent;
    if (!textContent.includes(Colony.snippets.yearOfPlentySnippet)) return false;

    const beneficiary = textContent.substring(0, textContent.indexOf(Colony.snippets.yearOfPlentySnippet));
    if (!verifyPlayers(this.players, beneficiary)) return false; // Sanity check
    const resources = Colony.extractResourcesFromElement(element);
    logs("[INFO] Year of Plenty:", beneficiary, "<-", resources);

    this.multiverse.mwTransformSpawn(beneficiary, Multiverse.asSlice(resources));

    return true;
}

Colony.prototype.parseAlways = function(element, idx)
{
    if (!configLogMessages) return false;
    console.info(`👁 Message ${idx} | »${element.textContent}«`);
    //console.debug(`🔍 Message ${idx} object:`, msg);
    return false;
}

/**
 * Process a "got resource" message: [user icon] [user] got: ...[resource images]
 */
Colony.prototype.parseGotMessage = function(element)
{
    let textContent = element.textContent;
    if (textContent.includes(Colony.snippets.receivedResourcesSnippet))
    {
        const player = textContent.substring(0, textContent.indexOf(Colony.snippets.receivedResourcesSnippet));
        if (!verifyPlayers(this.players, player)) return false; // Sanity check
        const resources = Colony.extractResourcesFromElement(element);
        logs("[INFO] Got resources:", player, "<-", resources);

        if ((resources.unknown || 0) !== 0)
        { // TODO
            console.error("Probably not the intended effect. If this happens we should zero unknown resources");
            debugger;
        }

        this.multiverse.mwTransformSpawn(player, Multiverse.asSlice(resources));

        return true;
    }

    return false;
}

// "John selected 🂠 🂠 🂠 from gold tile"
Colony.prototype.parseGoldTile = function(element)
{
    if (!element.textContent.includes(Colony.snippets.gold.present))
        return false;
    if (element.textContent.includes(Colony.snippets.gold.absent))
        return false;

    const player = element.textContent.substring(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    const resources = Colony.extractResourcesFromElement(element);
    logs("[INFO] Selected gold tile:", player, "<-", resources);

    if ((resources.unknown || 0) !== 0)
    { // TODO
        console.error("Probably not the intended effect. If this happens we should zero unknown resources");
        debugger;
    }

    this.multiverse.mwTransformSpawn(player, Multiverse.asSlice(resources));

    return true;
}

/**
 * Process a "built" message: [user icon] [user] built a [building/road]
 */
Colony.prototype.parseBuiltMessage = function(element, index, array)
{
    let textContent = element.textContent;
    if (!textContent.includes(Colony.snippets.builtSnippet)) return false;
    let images = collectionToArray(element.getElementsByTagName('img'));
    let player = textContent.split(" ")[0];
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    let buildResources = null;
    for (let img of images)
    {
        if (img.src.includes("road"))
        {
            buildResources = {wood: -1, brick: -1};
            if (this.turnState.diplomatReposition === true)
            {
                this.turnState.diplomatReposition = false;
                console.log(`[INFO] (Diplomat: free road for ${player})`);
                buildResources = {};
                break;
            }
            break;
        }
        else if (img.src.includes("settlement"))
        {
            buildResources = {wood: -1, brick: -1, sheep: -1, wheat: -1};
            break;
        }
        // Must be before city because "city" is a substring
        else if (img.src.includes("city_wall"))
        {
            buildResources = {brick: -2};
            if (this.turnState.engineer === true)
            {
                this.turnState.engineer = false;
                console.log(`[INFO] Engineer for ${player}: Free city wall`);
                buildResources = {};
            }
            else
            {
                console.log("[INFO] No engineer for city wall", player);
            }
            break;
        }
        else if (img.src.includes("city"))
        {
            buildResources = {wheat: -2, ore: -3};
            if (this.turnState.medicine === true)
            {
                this.turnState.medicine = false;
                console.log(`[INFO] Medicine for ${player}: Cheaper city`);
                buildResources = {wheat: -1, ore: -2};
            }
            break;
        }
        else if (img.src.includes("ship"))
        {
            console.assert(false, "unreachable");
            debugger; // Make sure this does not trigger in seafarers mode
        }
    }
    if (buildResources === null)
    {
        console.error("[ERROR] Failed to detect building in found message");
        alertIf(31);
    }

    console.log("[INFO] Built:", player, JSON.stringify(buildResources));
    this.multiverse.mwTransformSpawn(player, Multiverse.asSlice(buildResources));

    return true;
}

Colony.prototype.parseRolls = function(element)
{
    const textContent = element.textContent;
    if (!textContent.includes(Colony.snippets.rolledSnippet)) return false;
    const player = textContent.split(" ")[0];
    if (!verifyPlayers(this.players, player)) return false; // Sanity check

    const diceSum = Colony.extractDiceSumOfChildren(element);
    console.log("[INFO] Player", player, "rolled a", diceSum);

    this.trackerCollection.addRoll(diceSum);
    if (diceSum === 7)
        // TODO If the player does not steal from their robber this number
        // is misleading. We could track if a rob comes from a 7 or a knight
        // by setting turnState earlier.
        this.trackerCollection.addSeven(player);   // Affects seven counter but not rob stats

    this.turnState = Colony.emptyTurnState;
    if (diceSum === 7)
        this.turnState.nextSteal = "robber";

    return true;
}

Colony.prototype.parseBoughtMessage = function(element)
{
    const textContent = element.textContent;
    if (!textContent.includes(Colony.snippets.boughtSnippet)) return false;

    const player = textContent.split(" ")[0];
    if (!verifyPlayers(this.players, player)) return false; // Sanity check

    const resources = {sheep: -1, wheat: -1, ore: -1};
    const asSlice = Multiverse.asSlice(resources);
    console.log("[INFO] Baught dev card:", player, "->", resources);
    this.multiverse.mwTransformSpawn(player, asSlice);

    return true;
}

/**
 * Process a trade with the bank message: [user icon] [user] gave bank: ...[resources] and took ...[resources]
 */
Colony.prototype.parseTradeBankMessage = function(element)
{
    let textContent = element.textContent;
    if (!textContent.includes(Colony.snippets.tradeBankGaveSnippet))
    {
        return false;
    }
    let player = textContent.split(" ")[0];
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    let innerHTML = element.innerHTML;
    let gavebank = innerHTML.slice(innerHTML.indexOf(Colony.snippets.tradeBankGaveSnippet), innerHTML.indexOf(Colony.snippets.tradeBankTookSnippet)).split("<img");
    let andtook = innerHTML.slice(innerHTML.indexOf(Colony.snippets.tradeBankTookSnippet)).split("<img");

    // ManyWorlds version
    const gaveAndTook = element.innerHTML.split(" and took ");
    if (gaveAndTook.length !== 2)
    {
        console.log("[ERROR] Expected 2 substrings after split in dev card parser");
        alertIf(27);
        return;
    }
    // TODO Can we use structural parsing over strings here?
    const giveResources = Colony.findAllResourceCardsInHtml(gaveAndTook[0]);
    const takeResources = Colony.findAllResourceCardsInHtml(gaveAndTook[1]);
    const giveSlice     = mw.generateWorldSlice(giveResources);
    const takeSlice     = mw.generateWorldSlice(takeResources);
    logs("[INFO] Traded with bank:", player, giveResources, "->", takeResources);

    this.multiverse.mwTransformSpawn(player, Multiverse.sliceSubtract( Multiverse.asSlice(takeResources)
                                                                     , Multiverse.asSlice(giveResources) ));

    return true;
}

// Note: I dont know what happens with a 0-cards mono.
Colony.prototype.parseMonopoly = function(element)
{
    const textContent = element.textContent;
    if (!textContent.includes(Colony.snippets.mono.present))
        return false;
    if(textContent.includes(Colony.snippets.mono.absent ))
        return false;
    if (this.turnState.nextSteal === "commodityMonopoly") return false;
    if (this.turnState.nextSteal === "resourceMonopoly") return false;

    // This line should only be reached outside of C&K

    const thief = textContent.substring(0, textContent.indexOf(" "));
    if (!verifyPlayers(this.players, thief)) return false; // Sanity check
    const stolenResource = Colony.findSingularResourceImageInElement(element);
    console.log("[INFO] Monopoly:", thief, "<-", stolenResource);

    this.multiverse.transformMonopoly(thief, Multiverse.getResourceIndex(stolenResource));

    // TODO What to do with turnstate here?

    return true;
}

/**
 * When the user has to discard cards because of a robber.
 */
Colony.prototype.parseDiscardedMessage = function(element)
{
    let textContent = element.textContent;
    if (!textContent.includes(Colony.snippets.discardedSnippet)) {
        return false;
    }
    const player = textContent.substring(0, textContent.indexOf(Colony.snippets.discardedSnippet));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    const discarded = Colony.extractResourcesFromElement(element);
    const slice = Multiverse.asSlice(discarded);
    const sliceTotal = Multiverse.sliceTotal(slice);
    logs("[INFO] Discarded:", player, "->", discarded);

    if ((discarded.unknown || 0) !== 0)
    {
        discarded.unknown = 0; // TODO needed?
        debugger;
    }

    if (sliceTotal === 0)
    {
        console.log("[INFO] Discard slice empty: Assuming progress cards (skipping)");
        return true;
    }

    this.multiverse.mwCollapseTotal(player, n => n >> 1 === sliceTotal);
    this.multiverse.mwTransformSpawn(player,
        Multiverse.sliceNegate(Multiverse.asSlice(discarded)));

    return true;
}

// .outerHTML: <div><img><span><span>TradingPlayer<> traded <img> <img>  for <img>  with <span>OtherPlayer<><><>
// .textContent: "TradingPlayer traded    for   with OtherPlayer"
// Has whitespace between cards.
Colony.prototype.parseTradeMessage = function(element)
{
    // Collapse whitespace into single space
    const textContent = element.textContent.replace(/\s+/g, ' ');
    if (!textContent.includes(Colony.snippets.trade.detect)) return false;

    const involvedPlayers = textContent.split(Colony.snippets.trade.detect);
    const tradingPlayer = involvedPlayers[0];
    const otherPlayer = involvedPlayers[1].trim(); // Remove trailing space
    if (!verifyPlayers(this.players, tradingPlayer, otherPlayer)) return false;

    const split = element.innerHTML.split(Colony.snippets.trade.split);
    if (split.length !== 2) // Sanity check
    {
        console.error("Expected 2 parts when parsing trading message");
        console.debug("Split:", split);
        console.debug("InnerHTML:", element.innerHTML);
        alertIf(7);
        return false;
    }
    // TODO Can we use structural parsing over strings?
    const offer = Colony.findAllResourceCardsInHtml(split[0]);
    const demand = Colony.findAllResourceCardsInHtml(split[1]);
    console.log("[INFO] Trade:", offer, tradingPlayer, "--> | <--", otherPlayer, demand);

    this.multiverse.transformTradeByName(tradingPlayer, otherPlayer, offer, demand);

    return true;
}

// <div><img><span><span>Stealer</span> stole <img>  from you</span></div>
// "You stole   from VictimPlayer"
Colony.prototype.stealKnown = function(element)
{
    const textContent = element.textContent.replace(/\s+/g, " ");
    const containsYou =  textContent.includes(Colony.snippets.steal.you[0])
                       || textContent.includes(Colony.snippets.steal.you[1]);
    const containsStealSnippet = textContent.includes(Colony.snippets.steal.detect);
    if (!containsYou || !containsStealSnippet) return false;

    if (this.turnState.nextSteal === "spy")
    {
        debugger; // Test if indeed a spy
        console.log("[INFO] Discarding stealing message as spy");
        this.turnState.nextSteal = null;
        return true;
    }

    let involvedPlayers = textContent
        .replace(Colony.snippets.steal.detect, " ") // After this only the names are left
        .split(" ");
    involvedPlayers = involvedPlayers.map(x => x.replace(/^[Yy]ou$/, this.playerUsername));
    if (!involvedPlayers.includes(this.playerUsername))
    {
        alertIf("Expected \"[Yy]ou\" for", this.playerUsername, "in known steal");
        return;
    }

    // The " stole " message can mean many things. We use the turnState to
    // differentiate them.

    const stealingPlayer = involvedPlayers[0];
    const targetPlayer = involvedPlayers[1];
    if (!verifyPlayers(this.players, stealingPlayer, targetPlayer)) return false; // Sanity check

    if (this.turnState.nextSteal === "masterMerchant")
    {
        const merchantStolen = Colony.extractResourcesFromElement(element);
        const slice = Multiverse.asSlice(merchantStolen);
        const count = Multiverse.sliceTotal(slice);
        console.assert([1,2].includes(count));
        console.assert((merchantStolen["unknown"] || -1) !== 0, "Known steals have no unknown cards");
        console.log("[INFO] Non-random known steal by master merchant: ", targetPlayer, "->", stealingPlayer, "(", merchantStolen, ")");

        this.multiverse.mwTransformExchange(targetPlayer, stealingPlayer, // source, target
            Multiverse.asSlice(merchantStolen));

        this.trackerCollection.addRob(stealingPlayer, targetPlayer, count);

        this.turnState.nextSteal = null;

        return true;
    }

    if (this.turnState.nextSteal === "wedding")
    {
        const weddingStolen = Colony.extractResourcesFromElement(element);
        const slice = Multiverse.asSlice(weddingStolen);
        const count = Multiverse.sliceTotal(slice);
        console.assert([1,2].includes(count));
        console.assert((weddingStolen["unknown"] || -1) !== 0, "Known steals have no unknown cards");
        console.log("[INFO] Non-random known steal by wedding: ", targetPlayer, "->", stealingPlayer, "(", weddingStolen, ")");

        this.multiverse.mwTransformExchange(targetPlayer, stealingPlayer, slice);

        this.trackerCollection.addRob(stealingPlayer, targetPlayer, count);

        // ❕ Leaving 'nextSteal' unchanged because wedding can cause
        // multiple steals. Has to be overwritten by other steal (or end of
        // turn).

        return true;
    }

    const stolenResourceType = Colony.findSingularResourceImageInElement(element);
    const stolenResourceIndex = Multiverse.getResourceIndex(stolenResourceType);

    console.assert(this.turnState.nextSteal === "robber", "Should set next steal before entering here");

    console.log("[INFO] Steal:", targetPlayer, "->", stealingPlayer, "(", stolenResourceType, ")");

    this.trackerCollection.addRob(stealingPlayer, targetPlayer);

    this.multiverse.collapseAsRandom(targetPlayer,
        Multiverse.getResourceIndex(stolenResourceType));
    this.multiverse.mwTransformExchange
    (
        targetPlayer, stealingPlayer, // source, target
        Multiverse.asSlice({ [stolenResourceType]: 1 })
    );

    return true;
}

// <div><img><span><span>StealingPlayer</span> stole <img>  from <span>VictimPlayer</span></span></div>
// "StealingPlayer stole   from VictimPlayer"
Colony.prototype.stealUnknown = function(element)
{
    const textContent = element.textContent.replace(/\s+/g, " ");
    const containsYou =  textContent.includes(Colony.snippets.steal.you[0])
                      || textContent.includes(Colony.snippets.steal.you[1]);
    const containsStealSnippet = textContent.includes(Colony.snippets.steal.detect);
    if (containsYou || !containsStealSnippet) return false;

    if (this.turnState.nextSteal === "spy")
    {
        this.turnState.nextSteal = null;
        console.log("[NOTE] Treating steal as spy");
        return true;
    }

    const involvedPlayers = textContent
        .replace(Colony.snippets.steal.detect, " ") // After this only the names are left
        .split(" ");
    if (  involvedPlayers[0] === "You"
       || involvedPlayers[0] === "you"
       || involvedPlayers[1] === "You"
       || involvedPlayers[1] === "you" )
    {
        console.error("Did not expect \"[Yy]ou\" in unknown steal");
        alertIf(28);
        // Fallthrough in case an actual name is "[Yy]ou"
    }
    const stealingPlayer = involvedPlayers[0];
    const targetPlayer = involvedPlayers[1];
    if (!verifyPlayers(this.players, stealingPlayer, targetPlayer)) return false;

    if (this.turnState.nextSteal === "masterMerchant")
    {
        const merchantStolen = Colony.extractResourcesFromElement(element);
        const asSlice = Multiverse.asSlice(merchantStolen);
        const stolenCount = Multiverse.sliceTotal(asSlice);
        console.assert(merchantStolen["unknown"] === stolenCount, "Unknown merchant steals have only unknown cards");
        console.log("[INFO] Non-random unknown steal by master merchant: ", targetPlayer, "->", stealingPlayer, "(", merchantStolen, ")");

        // Steal less than 2 only if not enough available
        if (stolenCount < 2)
            this.multiverse.mwCollapseTotal(targetPlayer, n => n < 2);
        for (let i = 0; i < stolenCount; i++)
            this.multiverse.branchSteal(targetPlayer, stealingPlayer, true);

        this.trackerCollection.addRob(stealingPlayer, targetPlayer, stolenCount);

        this.turnState.nextSteal = null;

        return true;
    }

    if (this.turnState.nextSteal === "wedding")
    {
        const weddingStolen = Colony.extractResourcesFromElement(element);
        const asSlice = Multiverse.asSlice(weddingStolen);
        const stolenCount = Multiverse.sliceTotal(asSlice);
        console.assert(weddingStolen["unknown"] === stolenCount, "Unknown wedding steals have only unknown cards");
        console.log("[INFO] Non-random unknown steal by wedding: ", targetPlayer, "->", stealingPlayer, "(", weddingStolen, ")");

        // Steal less than 2 only if not enough available
        if (stolenCount < 2)
            this.multiverse.mwCollapseTotal(targetPlayer, n => n < 2);
        for (let i = 0; i < stolenCount; i++)
        {
            this.multiverse.branchSteal(targetPlayer, stealingPlayer, true);
            this.trackerCollection.addRob(stealingPlayer, targetPlayer);
        }

        // ❕ Leaving 'nextSteal' unchanged because wedding can cause
        // multiple steals. Has to be overwritten by other steal (or end of
        // turn).

        return true;
    }

    if (this.turnState.nextSteal !== "robber")
    {
        alertIf("Unexpected nextSteal: " + this.turnState.nextSteal);
        debugger; // Unreachable
        return false;
    }

    console.log("[INFO] Steal:", targetPlayer, "->", stealingPlayer);

    // Bishop, knight and 7 steals use a common update:

    this.trackerCollection.addRob(stealingPlayer, targetPlayer);

    this.multiverse.branchSteal(targetPlayer, stealingPlayer);

    return true;
}

Colony.prototype.parseMoveRobber = function(element)
{
    if (!element.textContent.includes(Colony.snippets.movedRobber))
        return false;

    console.log("[NOTE] Moved robber");

    this.turnState.nextSteal = "robber";

    return true;
}

Colony.prototype.parseMoveShip = function(element)
{
    if (!element.textContent.includes(Colony.snippets.movedShip))
        return false;
    const type = element.querySelectorAll("img")[1].alt;
    if (type !== "pirate") return false;

    console.log("[NOTE] Moved pirate");

    this.turnState.nextSteal = "robber";

    return true;
}

Colony.prototype.parsePlaceShipRoad = function(element)
{
    if (!element.textContent.includes(Colony.snippets.placeShipRoad.text))
        return false;
    const alt = element.querySelectorAll("img")[1].alt;
    if (!Colony.snippets.placeShipRoad.alt.includes(alt))
        return false;

    const player = element.textContent.substring(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    let costs = null;
    if (alt === "ship")
    {
        costs = { wood: -1, sheep: -1 };
    }
    else if(alt === "road")
    {
        costs = { wood:  1, brick:  1 };
    }
    console.assert(costs !== null, "Unexpected alt: " + alt);
    if (this.turnState.roadBuilding > 0)
    {
        console.log("[INFO] Road builder: free", alt);
        costs = {};
        this.turnState.roadBuilding -= 1;
    }
    else
    {
        console.assert(alt === "ship", "Unreachable: Roads should be 'built', not placed, unless free");
        if (alt !== "ship")
            debugger;
    }
    const asSlice = Multiverse.asSlice(costs);
    console.log("[INFO] Place Ship:", player, "->", costs);

    this.multiverse.mwTransformSpawn(player, asSlice);

    return true;
}

Colony.prototype.parsePlaceKnight = function(element)
{
    if (!element.textContent.includes(Colony.snippets.placeKnight.text))
        return false;
    if (element.children[1].children[1].alt !== Colony.snippets.placeKnight.alt)
        return false;

    const player = element.textContent.substring(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    const costSlice = this.turnState.deserter === true
        ? Multiverse.zeroResources
        : Multiverse.asSlice({ sheep: -1, ore: -1 });
    if (this.turnState.deserter === true)
        console.log("[INFO] Deserter: ", player, "gets a free knight");
    console.log("[INFO] Place Knight:", player, "->", costSlice);

    this.multiverse.mwTransformSpawn(player, costSlice);

    this.turnState.deserter = false;

    return true;
}

Colony.prototype.parseActivateKnight = function(element)
{
    if (!element.textContent.includes(Colony.snippets.activateKnight))
        return false;

    const player = element.textContent.substr(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    const cost = { wheat: -1 };
    console.log(`[INFO] Activate Knight: ${player} ➜ ${JSON.stringify(cost)}`);

    this.multiverse.mwTransformSpawn
    (
        player,
        Multiverse.asSlice(cost)
    );

    return true;
}

Colony.prototype.parseUpgradeKnight = function(element)
{
    if (!element.textContent.includes(Colony.snippets.upgradeKnight.text))
        return false;
    if (element.children[1].children[1].alt !== Colony.snippets.upgradeKnight.alt)
        return false;

    const player = element.textContent.substr(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check

    let cost = { sheep: -1, ore: -1 };
    if (this.turnState.smith > 0)
    {
        console.log("[INFO] Smith: ", player, "gets a free knight upgrade");
        cost = {};
        this.turnState.smith -= 1;
    }
    console.log(`[INFO] Upgrade Knight: ${player} ➜ ${JSON.stringify(cost)}`);
    const asSlice = Multiverse.asSlice(cost);

    this.multiverse.mwTransformSpawn
    (
        player,
        asSlice
    );

    return true;
}

Colony.prototype.parseAqueduct = function(element)
{
    if (!element.textContent.replace(/\s+/g, " ").includes(Colony.snippets.aqueduct))
        return false;

    const player = element.textContent.substr(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    const resources = Colony.extractResourcesFromElement(element);
    console.log(`[INFO] Aqueduct: ${player} <- ${JSON.stringify(resources)}`);

    if ((resources.unknown || 0) !== 0)
    { // TODO
        console.error("Probably not the intended effect. (?) If this happens we should zero unknown resources");
        debugger;
    }

    this.multiverse.mwTransformSpawn
    (
        player,
        Multiverse.asSlice(resources)
    );

    return true;
}

Colony.prototype.parseUpgradeCity = function(element)
{
    if (!element.textContent.replace(/\s+/g, " ").includes(Colony.snippets.upgradeCity))
        return false;

    const player = element.textContent.substr(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    const resourceType = Colony.upgradeMap[element.children[1].children[1].alt];
    const level = Number(element.textContent.slice(-1));
    console.assert(level > 0);
    let resources = { [resourceType]: -level };
    if (this.turnState.crane === true)
    {
        resources[resourceType] += 1;
        console.log("[INFO] Crane: ", player, "gets a city upgrade cheaper by 1");
        this.turnState.crane = false;
    }
    const slice = Multiverse.asSlice(resources);
    console.log(`[INFO] Upgrade City: ${player} -> ${JSON.stringify(resources)} (${resourceType} ✕ ${level})`);

    this.multiverse.mwTransformSpawn(player, slice);

    return true;
}

Colony.prototype.parseProgressCard = function(element)
{
    if (!element.textContent.replace(/\s+/g, " ").includes(Colony.snippets.progressCard.text))
        return false;
    const card = element.querySelectorAll("img")[1].alt;
    if (!Colony.snippets.progressCard.alts.includes(card))
        return false;
    const player = element.textContent.substring(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    console.log(`[INFO] Progress Card: ${player} -> ${card}`);

    switch (card)
    {
        case "Commodity Monopoly":
            this.turnState.nextSteal = "commodityMonopoly";
            break;
        case "Crane":
            this.turnState.crane = true;
            break;
        case "Deserter":
            this.turnState.deserter = true;
            break;
        case "Engineer":
            this.turnState.engineer = true;
            break;
        case "Master Merchant":
            this.turnState.nextSteal = "masterMerchant";
            break;
        case "Medicine":
            this.turnState.medicine = true;
            break;
        case "Resource Monopoly":
            this.turnState.nextSteal = "resourceMonopoly";
            break;
        case "Road Building": // Fallthrough
        case "card road building":
            this.turnState.roadBuilding = 2;
            break;
        case "Smith":
            this.turnState.smith = 2;
            break;
        case "Spy":
            this.turnState.nextSteal = "spy";
            break;
        case "Wedding":
            this.turnState.nextSteal = "wedding";
            break;
        default:
            console.assert(false, `Progress card not implemented: ${card}`);
            alertIf("Catched progress card but did not implement it");
    }

    return true;
}

Colony.prototype.parseResourceMonopoly = function(element)
{
    if (!element.textContent.includes(Colony.snippets.resourceMonopoly))
        return false;
    if (this.turnState.nextSteal !== "resourceMonopoly") // TODO can this be played before rolling?
        return false;

    const player = element.textContent.slice(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    const resourceName = Colony.findSingularResourceImageInElement(element);
    const countStr = element.textContent.trim().split(" ").at(-1);
    const count = Number(countStr);
    console.log(`[INFO] Resource Monopoly: ${player} <- ${count} * ${resourceName}`);

    this.multiverse.transformMonopoly
    (
        player,
        Multiverse.getResourceIndex(resourceName),
        2,      // Steal at most 2
        count   // Only consider situations stealing exactly 'count' resources
    );

    this.turnState.nextSteal = null;

    return true;
}

// TODO Merge with resource monopoly parser
Colony.prototype.parseCommodityMonopoly = function(element)
{
    if (!element.textContent.includes(Colony.snippets.commodityMonopoly))
        return false;
    if (this.turnState.nextSteal !== "commodityMonopoly") // TODO can this be played before rolling?
        return false;

    const player = element.textContent.slice(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    const type = element.children[1].children[1].alt;
    const resIndex = Multiverse.getResourceIndex(type);
    const countStr = element.textContent.trim().split(" ").at(-1);
    const count = Number(countStr);
    console.log(`[INFO] Commodity Monopoly: ${player} <- ${type}`);

    // Steal at most 1
    this.multiverse.transformMonopoly(player, resIndex, 1, count);

    this.turnState.nextSteal = null;

    return true;
}

Colony.prototype.parseCommercialHarbor = function(element)
{
    if (!element.textContent.includes(Colony.snippets.commercialHarbor.text))
        return false;

    const both = element.textContent
        .replace(Colony.snippets.commercialHarbor.split, "")
        .split(" ");
    const player = both[0].replace(/[Yy]ou/, this.playerUsername);
    const other = both[1].replace(/[Yy]ou/, this.playerUsername);
    if (!verifyPlayers(this.players, player, other)) return false; // Sanity check
    console.log(`[INFO] Commercial Harbor (by them): ${player} (res) ↔ (com) ${other}`);

    this.multiverse.branchHarbor(player, other);
}

Colony.prototype.parseCommercialHarborOurs = function(element)
{
    if (!element.textContent.startsWith(Colony.snippets.commercialHarborOur))
        return false;

    debugger; // Test this parser

    // FIXME
    // Test if this works both when we initiate and not

    const us = this.playerUsername;
    const otherPlayer = element.children[1].children[1].textContent;
    if (!verifyPlayers(this.players, us, otherPlayer)) return false; // Sanity check
    console.log(`[INFO] Commercial Harbor (by us): ${us} (res) ↔ (com) ${otherPlayer}`);
    let gave = element.children[1].children[0]
    let took = element.children[1].children[2];
    gave = Colony.imageAltMap[gave.alt];
    took = Colony.imageAltMap[took.alt];

    this.multiverse.transformTradeByName(us, otherPlayer, {[gave]: 1}, {[took]: 1});

    return true;
}

Colony.prototype.parseSpecialBuildPhase = function(element)
{
    if (!element.textContent.includes(Colony.snippets.specialBuildPhase))
        return false;

    console.log("[NOTE] Start of special build phase");

    this.turnState = Colony.emptyTurnState;

    return true;
}

Colony.prototype.parseDiplomatReposition = function(element)
{
    if (!element.textContent.includes(Colony.snippets.diplomatReposition))
        return false;

    const player = element.textContent.slice(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    console.log(`[INFO] Diplomat: ${player} repositioning road`);

    this.turnState.diplomatReposition = true;

    return true;
}

Colony.prototype.parseWin = function(element)
{
    if (!element.textContent.includes(Colony.snippets.winSnippet))
        return false;

    console.log("[INFO] End of Game");
    this.stopMainLoop();

    return true;
}

// (!) Returns name of the player who's turn it is (not true/false like the
// other parsers). Returns null if no player found. This is useful to keep the
// order of occurence constant.
Colony.prototype.parseTurnName = function(element)
{
    // Include only snippets that identify current user by name
    const txt = element.textContent;
    if (  txt.includes(Colony.snippets.yearOfPlentySnippet)
        || txt.includes(Colony.snippets.builtSnippet)
        || txt.includes(Colony.snippets.boughtSnippet)
        || txt.includes(Colony.snippets.rolledSnippet)
        || txt.includes(Colony.snippets.placeInitialSettlementSnippet) )
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

//=====================================================================
// Helpers
//=====================================================================

// Assumes this.playerUsername has been set. Rotates that player to last position.
Colony.prototype.reorderPlayerNames = function()
{
    // Determine our own name
    if (configFixedPlayerName || !this.playerUsername)
    {
        if (!configFixedPlayerName)
            console.warn("Username not found. Using fixed name.");
        this.playerUsername = configPlayerName;
    }

    this.players = rotateToLastPosition(this.players, this.playerUsername);
    for (const [i, p] of Object.entries(this.players))
        console.log(`[NOTE] Player ${i}:`, p);
    console.log("[NOTE] You are:", this.playerUsername);
}

Colony.prototype.cssColour = function(playerName)
{
    return `background: ${this.playerColours[playerName]}; padding: 3px; border-radius: 5px; font-weight: bold;`;
}

// vim: shiftwidth=4:softtabstop=4:expandtab
