"use strict";

/**
 * Version 3 code for Colonist
 */
class Colony {

    static refreshRate = 3000;
    static green = "PaleGreen";
    static yellow = "LightGoldenRodYellow";
    static red = "LightCoral";

    //==========================================================
    // Static
    //==========================================================

    /**
     * Returns the one resource type of any resource image found in the element.
     * Use when there is only one resource card.
     * @param {HTMLElement} element
     * @return {string}
     */
    static findSingularResourceImageInElement(element) {
        const res = Colony.extractResourcesFromElement(element);
        const keys = Object.keys(res);
        console.assert(keys.length === 1);
        if (keys.length !== 1) {
            console.error("Expected 1 resource card in element", element);
            alertIf(
                "Expected at least 1 resource card in element (unreachable)");
        }
        return keys[0];
    }

    /**
     * Returns the set of resource images contained in an HTML element
     * @param {HTMLElement} element
     * Log message element
     * @return Resources by name: { wood:1, coin:3, unknown:2 }
     */
    static extractResourcesFromElement(element) {
        const images = element.querySelectorAll("img");
        let resources = {}; // By name
        images.forEach(img => {
            for (const [alt, name] of Object.entries(Colony.imageAltMap)) {
                if (alt !== img.alt)
                    continue;
                resources[name] = (resources[name] || 0) + 1;
                break;
            }
        });
        return resources;
    }

    /**
     * Matches input string 'html' against assumed-unique strings identifying
     * resource card images. Does not find "unknown" cards.
     *
     * Matches HTML string to find resources names.
     * @param {HTMLElement} html
     * @return {Object} Resources by name
     *
     * TODO Replace string-based with normal version when possible
     */
    static findAllResourceCardsInHtml(html) {
        // Match 'resourceSnippets' against string content
        let foundAny = false; // For sanity check
        let cards = {
            wood: 0,
            brick: 0,
            sheep: 0,
            wheat: 0,
            ore: 0,
            cloth: 0,
            coin: 0,
            paper: 0
        };
        for (const [res, uniqueResString] of Object.entries(
                 Colony.resourceSnippets)) {
            // Count number of occurrences of identifying strings like "card_brick"
            let resourceRegex = new RegExp(uniqueResString, "g");
            let count = (html.match(resourceRegex) || []).length;
            if (count !== 0) {
                foundAny = true;
            }
            cards[res] = count;
        }

        // Never return unknown cards, even if present
        cards["unknown"] = 0;

        return cards;
    }

    /**
     * For message elements corresponding to a roll, extract the dice sum
     * @param {HTMLElement} element
     * @return {number} Sum of both dice
     */
    static extractDiceSumOfChildren(element) {
        let images = collectionToArray(element.getElementsByTagName("img"));
        let diceTest = new RegExp("^dice_[red_]*\\d");
        let total = images.reduce((sum, img) => {
            // Alt text is "dice_6" when rolling a 6.
            // Only images present are the dice images.
            let altText = img.getAttribute("alt");
            if (!altText)
                alertIf("No alt text in dice image");
            if (!diceTest.test(altText))
                return sum; // Skip if not a dice image
            let diceNum = Number(altText.slice(-1));
            return sum + diceNum;
        }, 0);
        return total;
    }

    static deleteSomeElements() {
        const ids = [
            "remove_ad_in_game_left", "remove_ad_in_game_right",
            "in_game_ab_right", "in_game_ab_left"
        ];
        for (const id of ids) {
            let element = document.getElementById(id);
            if (element)
                element.remove();
        }
    }

    //==========================================================
    // Constants
    //==========================================================

    /**
     * String constants used to determine log message types
     */
    static snippets = {
        initialPlacement: {split: " placed a "},
        // Used to determine which resources each player should get in the initial phase
        receivedInitialResourcesSnippet: "received starting resources",
        gold: {
            present: "from gold tile",
            absent: "selecting resource from gold tile"
        },
        // Sufficient (not necessary) to identify messages from the initial phase
        sufficientInitialPhaseMessageSnippet: "received starting resources",
        // Necessary (not sufficient) for detecting initial placement. Used to determine players
        placeInitialSettlementSnippet: "placed a",
        tradeOfferSnippet: " wants to give ",
        tradeOfferResSnippet: " for ",
        tradeOfferCounterSnippet: " proposed counter offer to ",
        yearOfPlentySnippet: " took from bank ",
        gotResource: {
            present: " got ",
            absent: " gave and got from ",
            transform: x => x.replace(/\s+/g, ' '),
        },
        builtSnippet: " built a ",
        boughtSnippet: " bought ",
        tradeBankGaveSnippet: "gave bank",
        tradeBankTookSnippet: "and took",
        mono: {present: " stole ", absent: "from"},
        discardedSnippet: " discarded ",
        trade: {
            detect: " gave and got from ",
            split: " and got ",
            transform: x => x.replace(/\s+/g, ' ').trim()
        },
        steal: {known: ["You stole", " from you"], detect: " stole from "},
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
        progressCard: {
            text: " used ",
            alts:
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
                ]
        },
        commodityMonopoly: " stole ",
        resourceMonopoly: " stole ",
        commercialHarbor: {
            text: "a resource in exchange for a commodity",
            // Only ending with space
            split: "gave ",
        },
        commercialHarborOur: "You gave",
        specialBuildPhase: "Special Build Phase",
        diplomatReposition: "is repositioning their road",
    };

    static upgradeMap = {
        ["science square"]: "paper",
        ["trade square"]: "cloth",
        ["politics square"]: "coin",
    };

    static imageAltMap = {
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

    static imageNameSnippets = {
        wood: "card_lumber",
        brick: "card_brick",
        sheep: "card_wool",
        wheat: "card_grain",
        ore: "card_ore",
        cloth: "card_cloth",
        coin: "card_coin",
        paper: "card_paper",
        unknown: "card_rescardback",
        road: "road_red",
        settlement: "settlement_red",
        devcard: "card_devcardback",
        city: "city_red",
        ship: "ship_red_north_west",
    };

    /**
     * Cut only the resources out of imageNameSnippets
     */
    static resourceSnippets =
        (({wood, brick, sheep, wheat, ore, cloth, coin, paper}) =>
             ({wood, brick, sheep, wheat, ore, cloth, coin, paper}))(
            Colony.imageNameSnippets);

    static colonistAssets = {
        // clang-format off
        wood: `<img src="dist/images/${Colony.imageNameSnippets["wood"]}.svg" class="cocaco-tbl-resource-icon"/>`,
        brick: `<img src="dist/images/${Colony.imageNameSnippets["brick"]}.svg" class="cocaco-tbl-resource-icon"/>`,
        sheep: `<img src="dist/images/${Colony.imageNameSnippets["sheep"]}.svg" class="cocaco-tbl-resource-icon"/>`,
        wheat: `<img src="dist/images/${Colony.imageNameSnippets["wheat"]}.svg" class="cocaco-tbl-resource-icon"/>`,
        ore: `<img src="dist/images/${Colony.imageNameSnippets["ore"]}.svg" class="cocaco-tbl-resource-icon"/>`,
        cloth: `<img src="dist/images/${Colony.imageNameSnippets["cloth"]}.svg" class="cocaco-tbl-resource-icon"/>`,
        coin: `<img src="dist/images/${Colony.imageNameSnippets["coin"]}.svg" class="cocaco-tbl-resource-icon"/>`,
        paper: `<img src="dist/images/${Colony.imageNameSnippets["paper"]}.svg" class="cocaco-tbl-resource-icon"/>`,
        unknown: `<img src="dist/images/${Colony.imageNameSnippets["unknown"]}.svg" class="cocaco-tbl-resource-icon"/>`,
        road: `<img src="dist/images/${Colony.imageNameSnippets["road"]}.svg" class="cocaco-tbl-resource-icon"/>`,
        settlement: `<img src="dist/images/${Colony.imageNameSnippets["settlement"]}.svg" class="cocaco-tbl-resource-icon"/>`,
        devcard: `<img src="dist/images/${Colony.imageNameSnippets["devcard"]}.svg" class="cocaco-tbl-resource-icon"/>`,
        city: `<img src="dist/images/${Colony.imageNameSnippets["city"]}.svg" class="cocaco-tbl-resource-icon"/>`,
        ship: `<img src="dist/images/${Colony.imageNameSnippets["ship"]}.svg" class="cocaco-tbl-resource-icon"/>`,
        // clang-format on
    };

    /**
     * Stateful components for C&K. The logic is not very sound.
     */
    static emptyTurnState = {
        /**
         * Some "stole" messages look the same but have different semantics.
         * 'nextSteal' describes the steal event that has to happen next. Every
         * parser checking for the "stole" message has to verify that it is it's
         * turn.
         *
         * One of: "resourceMonopoly", "commodityMonopoly", "spy",
         * "masterMerchant", "wedding", "robber"
         *
         * We do not distinguish robber from knight/bishop, because these steals
         * look the same and have the same semantics. Also knight/bishop
         * generate a robber message as well. We handle these by simply setting
         * 'nextSteal' to 'robber' for knight/bishop. Since knight and bishop
         * produce "moved Robber" messages, we do not implement them explicitly.
         *
         * Versions that always resolve in a (fixed count of) corresponding
         * "stole" messages (safe in any case):
         *   • resource monopoly
         *   • commodity monopoly
         * Versions that have 0 or 1 "stole" messages can reset the 'nextSteal'
         * indicator (but may be overwritten by others):
         *   • spy
         *   • master merchant
         * Versions with varying amount of "stole" messages (always rely on
         * other types overwriting the 'nextSteal' indicator):
         *   • robber (7, knight, bishop)
         *   • wedding
         * @type { "resourceMonopoly" | "commodityMonopoly" | "spy" | "masterMerchant" | "wedding" | "robber" }
         */
        nextSteal: null,

        // The remaining state is simpler, it is set on progress card and reset
        // at the start of each turn.

        /**
         * Next city improvement costs 1 resource less
         * @type {boolean}
         */
        crane: false,

        /**
         * Next knight is free, then reset this flag
         * @type {boolean}
         */
        deserter: false,

        /**
         * Next road is free
         * @type {boolean}
         */
        diplomatReposition: false,

        /**
         * Build city wall for free
         * @type {boolean}
         */
        engineer: false,

        /**
         * Next city costs 1 wheat 2 ore
         * @type {boolean}
         */
        medicine: false,

        /**
         * Next N road/ship is built with "place" and free
         * @type {Number}
         */
        roadBuilding: 0,

        /**
         * Can upgrade this many knight for free
         * @type {Number}
         */
        smith: 0,

    }

    constructor() {
        // Main loop with index matching 'activeIndex' is allowed to run.
        // Increment to stop. Start new main loop to continue. 'lastStarted' is
        // set to 'activeIndex' at invocation of main loop (to deduce if a main
        // loop is currently still active).
        this.activeIndex = 0;
        this.lastStarted = 0;

        this.reset();

        // Bind things so addEventListener can identify them
        this.boundMainLoopToggle = Colony.prototype.mainLoopToggle.bind(this);
        this.boundRecoverCards = Colony.prototype.recoverCards.bind(this);
        this.boundRecoverNames = Colony.prototype.recoverNames.bind(this);
        this.boundToggleTable = Colony.prototype.toggleTable.bind(this, null);

        // C&K has stateful messages. We add flags and reset after each roll
        this.turnState = Colony.emptyTurnState;
    } // ctor

} // class Colony

//==============================================================
// Messages
//==============================================================

/**
 * @return {HTMLElement[]} All message log elements
 */
Colony.prototype.getAllMessages = function () {
    if (!this.logElement) {
        alertIf(41);
        throw Error("Log element hasn't been found yet.");
    }
    return collectionToArray(this.logElement.children);
}

/**
 * When asIndex is true, return all messages and the current index.
 * @param {boolean} asIndex Set to true. Remove code that does not.
 * @return {[HTMLElement[], Number]}
 */
Colony.prototype.getNewMessages = function (asIndex = false) {
    const index = this.MSG_OFFSET;
    const allMessages = this.getAllMessages();
    this.MSG_OFFSET = allMessages.length;
    if (asIndex === false)
        return allMessages.slice(index);
    else if (asIndex === true)
        return [allMessages, index];
    else
        console.assert(false, "unreachable");
}

/**
 * @param {Number} msgNumber
 * @return {boolean}
 */
Colony.prototype.isNewMessage = function (msgNumber) {
    // ❗ Has the side-effect of updating a checkpoint message number (separate
    // from MSG_INDEX).
    // TODO This is essentially the same as MSG_INDEX, but for the rendering.
    //      Consolidate the similarities.
    if (msgNumber > this.messageNumberDone) {
        this.messageNumberDone = msgNumber;
        return true;
    }
    return false;
}

/**
 * Parameters idx and allMessages are there if parsers want them. But we
 * basically do not use them currently.
 *
 * The parsers should be a subset of 'Colony.allParsers'.
 *
 * @param {HTMLElement} msg
 * @param {Number} idx Index of the message
 * @param {HTMLElement[]} allMessages
 * @param {function(HTMLElement,Number,HTMLElement[]):boolean[]} [parsers]
 * Functions taking a message (and potentially its index and the allMessages
 * array). Returning true if the message was processed, else false.
 * @return {boolean}
 * true if one of the applied parsers returned true, else false
 */
Colony.prototype.applyParsers = function (
    msg, idx, allMessages,
    parsers = Colony.allParsers
) {
    const unidentified = parsers.every(parser => {
        return !parser.call(this, msg, idx, allMessages);
    });
    return unidentified;
}

//==============================================================
// Program flow
//==============================================================

/**
 * Start the Colony program flow.
 * @param tasks The default list of tasks starts the Colony pipeline for
 *              a regular start.
 */
Colony.prototype.restartTracker = function Colony_prototype_restartTracker(tasks = [
    { "funct": Colony.prototype.reset.bind(this), "ok": false },
    { "funct": Colony.prototype.findPlayerName.bind(this), "ok": false },
    { "funct": Colony.prototype.findElements.bind(this), "ok": false },
    { "funct": Colony.prototype.registerReparsers.bind(this), "ok": false },
    { "funct": Colony.prototype.clearLog.bind(this), "ok": false },
    { "funct": Colony.prototype.renderDummy.bind(this), "ok": false },
    { "funct": Colony.prototype.recoverUsers.bind(this, null, 2), "ok": false },
    { "funct": Colony.prototype.initialiseTracker.bind(this), "ok": false },
    { "funct": () => { this.MSG_OFFSET = 0; return true; }, "ok": false },
    { "funct": Colony.prototype.comeMrTallyManTallinitialResource.bind(this), "ok": false },
    { "funct": Colony.prototype.restartMainLoop.bind(this), "ok": false },
]) {
    for (let i = 0; i < tasks.length; ++i) {
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

/**
 * Resets the object like constructing a new one, but keeps 'activeIndex' and
 * 'lastStarted' intact so we do not orphan the 'mainLoop' 'setDoInterval'.
 *
 * We do not clear the log effects. Use 'clearLog()' to do that.
 */
Colony.prototype.reset = function Colony_prototype_reset() {
    this.logElement = null;
    this.chatElement = null; // For logger
    this.playerUsernameElement = null;

    this.playerUsername; // "John"
    this.foundCount = {}; // For recoverUsers()
    this.players = []; // ["John", "Jane", ...]
    this.playerColours = {}; // {"John": "blue", "Jane": "rgb(...)", ...}

    this.multiverse = null; // new Multiverse();
    this.renderObject = null; // new Render();
    this.trackerCollection = null; // new Track();

    this.MSG_OFFSET = 0;
    this.messageNumberDone = -1;
    this.startupFlag = true;

    // We use the logger to multiplex logging for debugging
    this.logger = null;

    return true;
}

/**
 * Reads the player name from DOM
 */
Colony.prototype.findPlayerName = function Colony_prototype_findPlayerName() {
    this.playerUsernameElement = document.getElementById("header_profile_username");
    console.assert(
        this.playerUsernameElement !== null,
        "should always be present, during and outside of games"
    );
    this.playerUsername = deepCopy(this.playerUsernameElement.textContent);
    if (this.playerUsername === "") {
        return false;
    }

    console.debug("🥥 You are:", this.playerUsername);

    let e = document.getElementById("header_navigation_store");
    if (e !== null)
        e.textContent = "🥥 Cocaco " + version_string;

    return true;
}

/**
 * Waits for the log element. The existence of a log element indicates that
 * a game was started.
 */
Colony.prototype.findElements = function Colony_prototype_findElements() {
    console.assert(!this.logElement);
    console.assert(!this.chatElement);
    this.logElement = document.getElementById("game-log-text");
    if (!this.logElement)
        return false;
    this.chatElement = document.getElementById("game-chat-text");
    if (!this.chatElement)
        console.error("A chat element is obligatory when we show information there");
    if (this.chatElement) {
        if (Colony.enlarger) {
            this.chatElement.removeEventListener("click", Colony.enlarger, false);
            Colony.enlarger = null;
        }
        if (cocaco_config.largeLog) {
            Colony.enlarger = enlarge.bind(null, this.logElement);
            this.chatElement.addEventListener("click", Colony.enlarger, false);
        }
    }

    Colony.deleteSomeElements();
    // this.logElement.addEventListener("click", this.boundMainLoopToggle, false);
    this.logElement.addEventListener("click", this.boundToggleTable, false);
    this.logger = new MessageLog(this.chatElement);
    this.logger.enabled = cocaco_config.log.colony;

    // Reset background after extension restart. Has no effect the first time.
    for (e of this.logElement.children)
        e.style.background = "";

    return true;
}

/**
 * Register reparsers for some extra functionality. This is not crucial for the
 * working of this pipeline (unlike the version 4 "Colonist" pipeline).
 */
Colony.prototype.registerReparsers = function Colony_prototype_registerReparsers() {
    if (cocaco_config.parseTypes) {
        Reparse.register(
            "receive",
            "ColonyEchoType",
            Reparse.applyDoers.always,
            Reparse.entryPoints.data,
            check_type,
            t => {
                console.debug(`type=${t}`);
                return { isDone: false };
            },
        );
    }

    Reparse.register(
        "receive",
        "ColonyMatchCountries",
        Reparse.applyDoers.byKind({ id: "130", type: [4] }),
        Reparse.entryPoints.playerUserStates,
        check_all_country_codes,
        groups => {
            let any = false;
            for (let group of groups) {
                this.logger.logChat(`${group.code}: ${group.players}`)
                any = true;
            }
            if (any === false) {
                this.logger.logChat("No country matches");
            }
            return { isDone: true };
        },
    );

    socketsReady = true;

    return true;
}

/**
 * The logger has a clear() function that removes leftovers which may be present
 * from a previous execution. Calls it.
 */
Colony.prototype.clearLog = function Colony_prototype_clearLog() {
    console.assert(this.logger !== null);
    this.logger.clear();
    // HACK: Abusing "internal" logChat function. Originally this class was not
    //       meant to be used for regular text display, only for debugging.
    this.logger.logChat(`🥥 Cocaco ${version_string}`);
    this.logger.logChat(`🥥 Hello ${this.playerUsername}`);
    return true;
}

/**
 * Initialize tracker structures with dummy data and render them.
 *
 * This allows us to utilize the existing rendering code to display a message to
 * the user: We set player names to predetermined strings which are rendered
 * into the resource table.
 *
 * At the same time, it allows us to identify generic rendering problems earlier
 * by faithfully utilizing the rendering code.
 *
 * All components are later initialized for real in 'initialiseTracker()'.
 */
Colony.prototype.renderDummy = function Colony_prototype_renderDummy() {
    const dummyPlayers = ["Detecting", "Player", "Names"];
    const dummyColours = { "Detecting": "black", "Player": "red", "Names": "gold" };
    this.multiverse = new Multiverse();
    this.multiverse.initWorlds({ "Detecting": {}, "Player": {}, "Names": {} });
    this.trackerCollection = new Track();
    this.trackerCollection.init(dummyPlayers);
    const usedAssets = cocaco_config.ownIcons ?
        alternativeAssets : Colony.colonistAssets;
    switch (cocaco_config.render.type) {
        case "table":
            this.renderObject = new Render(
                this.multiverse, this.trackerCollection,
                dummyPlayers, dummyColours,
                null, null, null, // Callbacks
                usedAssets,
            );
        case "cards":
            this.renderObject = new RenderCards(
                this.multiverse,
                this.track,
                dummyPlayers,
                dummyColours,
            );
            break;
        default:
            console.assert(false, "Invalid render type configured");
    }
    this.renderObject.unrender(); // Removes DOM leftovers after restart
    // this.toggleTable(true); // Use hidden === true
    this.renderObject.render(); // Always trigger initial update/render
    return true;
}

/**
 * Get new messages until 'playerCount' many player names were found. If
 * 'playerCount' is null, continue until the first roll instead. Must stop main
 * loop before running this so they don't interfere. Advances this.MSG_OFFSET as
 * usual.
 *
 * To allow log message background colourisation, we exploit the very static
 * procedure during regular (non-recovery) startup: Each player produces five
 * messages in total: four build messages (settles + roads) and one initial got
 * message. We want to exit after the first round, so the got messages can be
 * colourised by comeMrTallyManTallinitialResource() afterwards.
 *
 * Runs 'initialiseTracker()' after every new player as a hack to 'update' the
 * resource table display. The tracking and rendering objects do not support
 * adding players post-hoc, so we replace them entirely. This is fine during
 * startup phase.
 *
 * At start of the game, set
 *  - playerCount to null so the number is deduced
 *  - maxRepetitions to 2 so the loop exits after the first round.
 * In recoverNames(), set 'playerCount' to a number so the loop continues during
 * regular gameplay, including repetitions and rolls.
 *
 * @param {Number} playerCount
 * If set, continue until 'playerCount' many player names were found. Else,
 * continue until the first roll.
 * @param {Number} maxRepetitions
 * If set, exit after finding a name more than 'maxRepetitions' times. Use only
 * with playerCount===null.
 */
Colony.prototype.recoverUsers = function Colony_prototype_recoverUsers(
    playerCount = null,
    maxRepetitions = null,
) {
    // NOTE If we make sure not to read initial placement messages, we can set
    //      MSG_OFFSET to 0, too. Those can appear out-of-player-order, and we
    //      imply the order from messages.
    //this.MSG_OFFSET = 0;

    // It is possible to use both, but currently not intended
    console.assert(maxRepetitions === null || playerCount === null);

    let foundRoll = false;
    let maxReached = false;
    const done = () => {
        if (playerCount === null)
            return foundRoll || maxReached === true;
        else
            return playerCount - this.players.length === 0;
    };
    console.assert(!done()); // Do not come back when done

    const newMsg = this.getNewMessages();
    for (const msg of newMsg) {
        if (msg.textContent.includes(Colony.snippets.rolledSnippet)) {
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
        if (!this.players.includes(name)) {
            this.players.push(name);
            this.playerColours[name] = colour;
            msg.style.background = this.playerColours[name];
            this.logger.log(
                msg, `🥥 Found player %c${name}%c with colour ${colour}`,
                this.cssColourPlayer(name), ""
            );
            this.initialiseTracker(false);
        }
        this.foundCount[name] = (this.foundCount[name] || 0) + 1;
        if (maxRepetitions !== null && this.foundCount[name] > maxRepetitions)
            maxReached = true;
        if (done())
            break;
    }

    if (!done())
        return false; // Signal "not done" to come back again
    this.reorderPlayerNames();
    return true;
}

/**
 * Initializes the member objects once the required inputs are ready:
 * name + colour data must be handed to the member objects for construction.
 * @param {boolean} doRecover
 * If true, provide doRecover functions to the new Render() object. If false,
 * uses 'null', preventing recovery.
 */
Colony.prototype.initialiseTracker = function Colony_prototype_initialiseTracker(doRecover = true) {
    let noResources = {};
    for (const name of this.players)
        noResources[name] = {}; // Could be noResources[name] = {"wood": 5, ...}

    this.multiverse = new Multiverse();
    this.multiverse.initWorlds(noResources);
    this.trackerCollection = new Track;
    this.trackerCollection.init(this.players);

    // TODO Once we wanted to have persistent click bind (to UI or when not
    // removing the table, we need to create a permanent bind object to
    // prevent multi binds.

    const recoverFunctions = doRecover
        ? [this.boundRecoverCards, this.boundRecoverNames]
        : [null, null];

    this.renderObject.unrender(); // Remove table to force redraw over update
    const usedAssets = cocaco_config.ownIcons ?
        alternativeAssets : Colony.colonistAssets;
    switch (cocaco_config.render.type) {
        case "table":
            this.renderObject = new Render (
                this.multiverse, this.trackerCollection,
                this.players, this.playerColours,
                null,
                ...recoverFunctions,
                usedAssets,
            );
        case "cards":
            this.renderObject = new RenderCards(
                this.multiverse,
                this.track,
                this.players,
                this.playerColours,
            );
            break;
        default:
            console.assert(false, "Invalid render type configured");
    }

    this.renderObject.render();
    return true;
}

/**
 * Parse all messages and distribute initial resources for each player.
 * Does not wait for new messages; all initial placement messages must be
 * present beforehand.
 */
Colony.prototype.comeMrTallyManTallinitialResource = function Colony_prototype_comeMrTallyManTallinitialResource() {
    let foundNewResources = false;
    let foundRoll = false;
    if (cocaco_config.useTimer) console.time("tallyLoop");
    let [allMessages, i] = this.getNewMessages(true);
    for (; i < allMessages.length; ++i) {
        const msg = allMessages[i];
        if (msg.textContent.includes(Colony.snippets.rolledSnippet)) {
            foundRoll = true;
            break;
        }
        const initialParsers =
            [
                Colony.prototype.parseInitialGotMessage,
                Colony.prototype.parseGotMessage,
                Colony.prototype.parseGoldTile,
            ];
        const found = !this.applyParsers(msg, i, allMessages, initialParsers);
        if (found) {
            foundNewResources = true;
            msg.style.background = Colony.green;
        }
    };
    if (cocaco_config.useTimer) console.timeEnd("tallyLoop");
    this.multiverse.printWorlds();

    if (cocaco_config.useTimer) console.time("render");
    this.renderObject.render(() => foundNewResources);
    if (cocaco_config.useTimer) console.timeEnd("render");

    if (!foundRoll) {
        return false;
    }

    this.MSG_OFFSET = i;
    // console.debug(`• Starting from message ${i}`); // 28 for normal base game
    return true;
}

/**
 * @param {function():boolean} continueIf
 * A function that returns true if the main loop should proceed. We use this to
 * stop the main loop by changing the activeIndex.
 */
Colony.prototype.mainLoop = function (continueIf = () => true) {
    if (!continueIf())
        return true; // Return true to signal completion to setDoInterval
    console.assert(this.startupFlag === false);
    if (cocaco_config.useTimer) console.time("mainLoop");

    const [allMessages, index] = this.getNewMessages(true);
    for (let idx = index; idx < allMessages.length; ++idx) {
        const msg = allMessages[idx];
        const unidentified = this.applyParsers(msg, idx, allMessages);
        msg.style.background = unidentified ? Colony.yellow : Colony.green;
        this.multiverse.printWorlds();
        if (cocaco_config.logWorldCount) console.log("🌎", this.multiverse.worlds.length);
        if (0 === this.multiverse.worldCount()) // Implies error
        {
            msg.style.background = Colony.red;
            console.error("No world left");
            alertIf("Tracker OFF: No world left. Try recovery mode.");
            this.stopMainLoop();
            return true; // Return true to signal completion
        }
    }
    if (cocaco_config.useTimer) console.timeEnd("mainLoop");

    if (cocaco_config.useTimer) console.time("render");
    this.renderObject.render(() => this.isNewMessage(this.MSG_OFFSET));
    if (cocaco_config.useTimer) console.timeEnd("render");
}

/**
 * Recovers Multiverse state from unknown cards. Player array is used and
 * assumed correct.
 */
Colony.prototype.recoverCards = function () {
    //console.debug("🩹 Considering card recovery");
    // Save index at moment of click
    const allMessages = this.getAllMessages();
    const momentIndex = allMessages.length;
    if (momentIndex >= 1) allMessages[momentIndex - 1].style.background = "Orange";

    const activeBefore = this.isActiveMainLoop();
    this.stopMainLoop();
    // Confirm AFTER stopping main loop so that card counts can be timed
    if (!confirm(`🩹 ${activeBefore ? "[active]" : "[inactive]"} Reset cards?  Last message: »${allMessages.at(momentIndex - 1).textContent}«`)) {
        console.debug("🩹 Declining card recovery");
        if (activeBefore) {
            console.info("🩹 Re-entering main loop without card recovery");
            this.restartMainLoop();
        }
        return;
    }
    console.info("🩹 Entering card recovery");

    this.MSG_OFFSET = momentIndex;
    let counts = {};
    for (const player of this.players) {
        const count = prompt(`🩹 ${player} number of cards:`, 0);
        counts[player] = Number(count);
    }
    this.multiverse.enterCardRecovery(counts);

    this.renderObject.render();
    this.restartMainLoop();
}

/**
 * Waits 1 round to collect all player names. Use recoverCards() to set unknown
 * card counts, entering manyWorlds recovery mode.
 */
Colony.prototype.recoverNames = function () {
    //console.debug("💉 Considering name recovery");
    if (this.startupFlag === true) {
        console.warn(`💉 Suppressed! startupFlag === true`);
        return;
    }
    const playerCount = Number(prompt("💉 New players count?", 0));
    if (playerCount < 1 || 8 < playerCount) {
        console.error("💉 Invalid player count:", playerCount, " Expected (1-8). Aborting name recovery.");
        return;
    }
    console.log(`💉 Entering name recovery for ${playerCount} players`);

    this.stopMainLoop();
    this.renderObject.unrender();

    this.restartTracker([
        // Like the default control flow, but do not clearLog (keep it).
        // And do not tallyInitialResources and do not restartMainLoop (leave
        // for manual activation).
        { "funct": this.reset.bind(this), "ok": false },
        { "funct": this.findPlayerName.bind(this), "ok": false },
        { "funct": this.findElements.bind(this), "ok": false },
        { "funct": this.renderDummy.bind(this), "ok": false },
        { "funct": this.recoverUsers.bind(this, playerCount), "ok": false },
        { "funct": this.initialiseTracker.bind(this), "ok": false },
        { "funct": () => { this.renderObject.render(); return true; }, "ok": false },
    ]);
}

//==============================================================
// Main loop
//==============================================================

Colony.prototype.isActiveMainLoop = function () {
    return this.lastStarted === this.activeIndex;
}

Colony.prototype.stopMainLoop = function () {
    console.info("🥥 Stopping main loop ", this.activeIndex);
    this.activeIndex += 1;

    if (cocaco_config.useTimer) console.timeEnd("mainLoop");
}

Colony.prototype.restartMainLoop = function Colony_prototype_restartMainLoop() {
    this.stopMainLoop(); // Sanitize
    console.log("🥥 (Re)starting main loop ", this.activeIndex);
    this.startupFlag = false;
    this.lastStarted = deepCopy(this.activeIndex);
    const currentIndex = deepCopy(this.activeIndex); // Passed to closure
    setDoInterval(
        this.mainLoop.bind(
            this,
            () => this.activeIndex === currentIndex // Continue condition
        ),
        Colony.refreshRate
    );

    return true;
}

/**
 * If a main loop is running, stops it. If no main loop is running, starts one.
 */
Colony.prototype.mainLoopToggle = function () {
    if (this.startupFlag === true) {
        console.warn(
            "this.mainLoopToggle() suppressed: this.startupFlag === true"
        );
        return;
    }
    if (this.isActiveMainLoop()) {
        this.stopMainLoop();
        this.renderObject.unrender();
    }
    else {
        this.restartMainLoop();
        this.renderObject.render(); // Render also if no new message found
    }
}

//==============================================================
// Misc (any but messages, program flow, main loop, parsers)
//==============================================================

/**
 * Assumes this.playerUsername has been set. Rotates that player to last
 * position.
 */
Colony.prototype.reorderPlayerNames = function () {
    // Determine our own name
    if (cocaco_config.fixedPlayerName || !this.playerUsername) {
        if (!cocaco_config.fixedPlayerName)
            console.warn("Username not found. Using fixed name.");
        this.playerUsername = cocaco_config.playerName;
    }

    this.players = rotateToLastPosition(this.players, this.playerUsername);
}

/**
 * @param {string} bgColour The colour to be used for styling
 * @return {string} The CSS we use to style player names in some log output
 */
Colony.prototype.cssColour = function (bgColour) {
    return `color: white; background: ${bgColour}; padding: 3px; border-radius: 5px; font-weight: bold;`;
}

/**
 * Uses 'this.playerColours' to determine how the given player name should be
 * styled.
 * @param {string} playerName The playerName which we want to style
 * @return {string} The CSS to be used for styling
 */
Colony.prototype.cssColourPlayer = function (playerName) {
    return this.cssColour(this.playerColours[playerName]);
}

/**
 * Calls the render toggle function to toggle thee resource table
 */
Colony.prototype.toggleTable = function (value = null) {
    if (this.renderObject) {
        this.renderObject.toggle("resourceTable", value);
    }
}

//==============================================================
// Parsers
//==============================================================

// Special parser: Using during initial phase, but not part of 'ALL_PARSERS'
Colony.prototype.parseInitialGotMessage = function (element) {
    const textContent = element.textContent;
    if (!textContent.includes(Colony.snippets.receivedInitialResourcesSnippet)) {
        return false;
    }
    const player = textContent.replace(Colony.snippets.receivedInitialResourcesSnippet, "").split(" ")[0];
    if (!verifyPlayers(this.players, player)) return false;

    const initialResources = Colony.extractResourcesFromElement(element);
    this.logger.log(element, `▶️ %c${player}%c ${resourcesAsUtf8(initialResources)}`, this.cssColourPlayer(player), "");
    //console.debug(`• Set initial resources for ${name} to`, resources);

    const slice = Multiverse.asSlice(initialResources);
    if (Multiverse.sliceTotal(slice) === 0) {
        console.warn("Empty starting resources");
    }
    this.multiverse.transformSpawn(player, Multiverse.asSlice(initialResources));

    return true;
}

Colony.prototype.parseTradeOffer = function (element) {
    const txt = element.textContent;
    if (!txt.includes(Colony.snippets.tradeOfferSnippet)) return false;
    const player = txt.substring(0, txt.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check

    // TODO Can we replace the html string parsing? Can we also do so for the
    //      trade offer counter parser?
    const offerHtml = element.innerHTML.split(Colony.snippets.tradeOfferResSnippet)[0];
    const offer = Colony.findAllResourceCardsInHtml(offerHtml);
    this.logger.log(element, `%c${player}%c ➡️ ${resourcesAsUtf8(offer)} ⇄️ <resources>`, this.cssColourPlayer(player), "");

    this.multiverse.collapseMin(player, Multiverse.asSlice(offer));

    return true;
}

Colony.prototype.parseTradeOfferCounter = function (element) {
    // "John1 proposed counter offer to John2 [wood][brick] for [sheep]"
    const txt = element.textContent;
    if (!txt.includes(Colony.snippets.tradeOfferCounterSnippet)) return false;

    const player = txt.substring(0, txt.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false;

    // TODO Can we use structural parsing over strings?
    const offerHtml = element.innerHTML.split(Colony.snippets.tradeOfferResSnippet)[0];
    const offer = Colony.findAllResourceCardsInHtml(offerHtml);
    this.logger.log(element, `⬅️ <resources> ⇄️ ${resourcesAsUtf8(offer)} %c${player}%c`, this.cssColourPlayer(player), "");
    this.multiverse.collapseMin(player, Multiverse.asSlice(offer));

    return true;
}

Colony.prototype.parseYearOfPlenty = function (element) {
    const textContent = element.textContent;
    if (!textContent.includes(Colony.snippets.yearOfPlentySnippet)) return false;

    const beneficiary = textContent.substring(0, textContent.indexOf(Colony.snippets.yearOfPlentySnippet));
    if (!verifyPlayers(this.players, beneficiary)) return false; // Sanity check
    const resources = Colony.extractResourcesFromElement(element);
    this.logger.log(element, `📯 %c${beneficiary}%c ← ${resourcesAsUtf8(resources)}`, this.cssColourPlayer(beneficiary), "");

    this.multiverse.transformSpawn(beneficiary, Multiverse.asSlice(resources));

    return true;
}

// Put the per-every-message things here. Always returns false with no-op
// (except logging).
Colony.prototype.parseAlways = function (element, idx) {
    if (!cocaco_config.logMessages) return false;
    console.info(`Message [${idx}] ${element.textContent} 🔍`, element);
    return false;
}

Colony.prototype.parseGotMessage = function (element) {
    const textContent = Colony.snippets.gotResource.transform(element.textContent);
    if (!textContent.includes(Colony.snippets.gotResource.present)) return false;
    if (textContent.includes(Colony.snippets.gotResource.absent)) return false;

    const player = textContent.substring(0, textContent.indexOf(Colony.snippets.gotResource.present));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    const resources = Colony.extractResourcesFromElement(element);
    this.logger.log(element, `%c${player}%c ← ${resourcesAsUtf8(resources)}`, this.cssColourPlayer(player), "");
    if ((resources.unknown || 0) !== 0) // Sanity check
    {
        console.error("Probably not the intended effect. If this happens we should zero unknown resources");
        alertIf("Implementation lacks handling this case");
    }

    this.multiverse.transformSpawn(player, Multiverse.asSlice(resources));

    return true;
}

// "John selected 🂠 🂠 🂠 from gold tile"
Colony.prototype.parseGoldTile = function (element) {
    if (!element.textContent.includes(Colony.snippets.gold.present))
        return false;
    if (element.textContent.includes(Colony.snippets.gold.absent))
        return false;

    const player = element.textContent.substring(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    const resources = Colony.extractResourcesFromElement(element);
    this.logger.log(element, `💰 %c${player}%c ← ${resourcesAsUtf8(resources)}`, this.cssColourPlayer(player), "");

    if ((resources.unknown || 0) !== 0) { // TODO
        console.error("Probably not the intended effect. If this happens we should zero unknown resources");
        alertIf("Implementation lacks handling this case");
    }

    this.multiverse.transformSpawn(player, Multiverse.asSlice(resources));

    return true;
}

Colony.prototype.parseBuiltMessage = function (element) {
    let textContent = element.textContent;
    if (!textContent.includes(Colony.snippets.builtSnippet)) return false;
    let images = collectionToArray(element.getElementsByTagName('img'));
    let player = textContent.split(" ")[0];
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    let buildResources = null;
    for (let img of images) {
        if (img.src.includes("road")) {
            buildResources = { wood: -1, brick: -1 };
            if (this.turnState.diplomatReposition === true) {
                this.turnState.diplomatReposition = false;
                this.logger.log(element, `🆓 ${player} ← ${utf8Symbols.road}`);
                buildResources = {};
                break;
            }
            break;
        }
        else if (img.src.includes("settlement")) {
            buildResources = { wood: -1, brick: -1, sheep: -1, wheat: -1 };
            break;
        }
        // Must be before city because "city" is a substring
        else if (img.src.includes("city_wall")) {
            buildResources = { brick: -2 };
            if (this.turnState.engineer === true) {
                this.turnState.engineer = false;
                this.logger.log(element, `${utf8Symbols.free} %c${player}%c ← ${utf8Symbols.cityWall}`, this.cssColourPlayer(player), "");
                buildResources = {};
            }
            else {
                this.logger.log(element, `${utf8Symbols.build} %c${player}%c ← ${utf8Symbols.cityWall}`, this.cssColourPlayer(player), "");
            }
            break;
        }
        else if (img.src.includes("city")) {
            buildResources = { wheat: -2, ore: -3 };
            if (this.turnState.medicine === true) {
                this.turnState.medicine = false;
                this.logger.log(element, `💊 ${player} ${utf8Symbols.discount} ${utf8Symbols.city}`);
                buildResources = { wheat: -1, ore: -2 };
            }
            break;
        }
        else if (img.src.includes("ship")) {
            console.assert(false, "unreachable");
            // TODO: If in seafarers ships are built we would need to add it here
            alertIf("Ships should be placed (I think)");
        }
    }
    if (buildResources === null) {
        console.error("Failed to detect building in found message");
        alertIf(31);
    }
    this.logger.log(element, `${utf8Symbols.build} %c${player}%c ➜ ${resourcesAsUtf8(buildResources)}`, this.cssColourPlayer(player), "");

    this.multiverse.transformSpawn(player, Multiverse.asSlice(buildResources));

    return true;
}

Colony.prototype.parseRolls = function parseRolls(element) {
    const textContent = element.textContent;
    if (!textContent.includes(Colony.snippets.rolledSnippet)) return false;

    const player = textContent.split(" ")[0];
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    const diceSum = Colony.extractDiceSumOfChildren(element);
    this.logger.log(element, `🎲 ${diceSum} %c${player}%c`, this.cssColourPlayer(player), "");

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

Colony.prototype.parseBoughtMessage = function (element) {
    const textContent = element.textContent;
    if (!textContent.includes(Colony.snippets.boughtSnippet)) return false;

    const player = textContent.split(" ")[0];
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    const resources = { sheep: -1, wheat: -1, ore: -1 };
    const asSlice = Multiverse.asSlice(resources);
    this.logger.log(element, `${utf8Symbols.buy} ${utf8Symbols.devcard} %c${player}%c → ${resourcesAsUtf8(resources)}`, this.cssColourPlayer(player), "");

    this.multiverse.transformSpawn(player, asSlice);

    return true;
}

Colony.prototype.parseTradeBankMessage = function (element) {
    let textContent = element.textContent;
    if (!textContent.includes(Colony.snippets.tradeBankGaveSnippet)) {
        return false;
    }
    let player = textContent.split(" ")[0];
    if (!verifyPlayers(this.players, player)) return false; // Sanity check

    const gaveAndTook = element.innerHTML.split(" and took ");
    if (gaveAndTook.length !== 2) {
        console.error("Expected 2 substrings after split in dev card parser");
        alertIf(27);
        return;
    }
    // TODO Can we use structural parsing over strings here?
    const giveResources = Colony.findAllResourceCardsInHtml(gaveAndTook[0]);
    const takeResources = Colony.findAllResourceCardsInHtml(gaveAndTook[1]);
    this.logger.log(element, `${utf8Symbols.bank} %c${player}%c ${resourcesAsUtf8(giveResources)} ↔ ${resourcesAsUtf8(takeResources)}`, this.cssColourPlayer(player), "");

    this.multiverse.transformSpawn(
        player,
        Multiverse.sliceSubtract(
            Multiverse.asSlice(takeResources),
            Multiverse.asSlice(giveResources)
        )
    );

    return true;
}

// Note: I dont know what happens with a 0-cards mono.
Colony.prototype.parseMonopoly = function (element) {
    const textContent = element.textContent;
    if (!textContent.includes(Colony.snippets.mono.present))
        return false;
    if (textContent.includes(Colony.snippets.mono.absent))
        return false;
    if (this.turnState.nextSteal === "commodityMonopoly") return false;
    if (this.turnState.nextSteal === "resourceMonopoly") return false;

    // This line should only be reached outside of C&K

    // TODO Detect count
    const thief = textContent.substring(0, textContent.indexOf(" "));
    if (!verifyPlayers(this.players, thief)) return false; // Sanity check
    const stolenResource = Colony.findSingularResourceImageInElement(element);
    this.logger.log(element, `${utf8Symbols.monopoly} (regular) %c${thief}%c ${utf8Symbols[stolenResource]}`, this.cssColourPlayer(thief), "");

    this.multiverse.transformMonopoly(
        thief,
        Multiverse.getResourceIndex(stolenResource)
    );

    // TODO What to do with turnstate here?

    return true;
}

// Discarding is always 50% (round down)
Colony.prototype.parseDiscardedMessage = function (element) {
    let textContent = element.textContent;
    if (!textContent.includes(Colony.snippets.discardedSnippet)) {
        return false;
    }
    const player = textContent.substring(0, textContent.indexOf(Colony.snippets.discardedSnippet));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    const discarded = Colony.extractResourcesFromElement(element);
    const slice = Multiverse.asSlice(discarded);
    const sliceTotal = Multiverse.sliceTotal(slice);
    this.logger.log(element, `${utf8Symbols.discard} %c${player}%c → ${resourcesAsUtf8(discarded)}`, this.cssColourPlayer(player), "");

    if ((discarded.unknown || 0) !== 0) {
        alertIf("We thought we do not need to account for unknowns but apparently we do");
        discarded.unknown = 0; // TODO needed?
    }

    if (sliceTotal === 0) {
        console.debug("◦ Discard slice empty: Assuming progress cards (skipping)");
        return true;
    }

    this.multiverse.collapseTotal(player, n => n >> 1 === sliceTotal);
    this.multiverse.transformSpawn(
        player,
        Multiverse.sliceNegate(Multiverse.asSlice(discarded))
    );

    return true;
}

// .outerHTML: <div><img><span><span>TradingPlayer<> traded <img> <img>  for <img>  with <span>OtherPlayer<><><>
// .textContent: "TradingPlayer traded    for   with OtherPlayer"
Colony.prototype.parseTradeMessage = function (element) {
    // Collapse whitespace into single space
    const textContent = Colony.snippets.trade.transform(element.textContent);
    if (!textContent.includes(Colony.snippets.trade.detect)) return false;

    const involvedPlayers = textContent.split(Colony.snippets.trade.detect);
    const tradingPlayer = involvedPlayers[0];
    const otherPlayer = involvedPlayers[1];
    if (!verifyPlayers(this.players, tradingPlayer, otherPlayer)) return false;

    const split = element.innerHTML.split(Colony.snippets.trade.split);
    if (split.length !== 2) {
        // Sanity check
        console.error("Expected 2 parts when parsing trading message");
        console.debug("Split:", split);
        console.debug("InnerHTML:", element.innerHTML);
        alertIf(7);
        return false;
    }
    // TODO Can we use structural parsing over strings?
    const offer = Colony.findAllResourceCardsInHtml(split[0]);
    const demand = Colony.findAllResourceCardsInHtml(split[1]);
    this.logger.log(element, `↔️ %c${tradingPlayer}%c ${resourcesAsUtf8(offer)} ⇄️ ${resourcesAsUtf8(demand)} %c${otherPlayer}%c`, this.cssColourPlayer(tradingPlayer), "", this.cssColourPlayer(otherPlayer), "");

    this.multiverse.transformTradeByName(tradingPlayer, otherPlayer, offer, demand);

    return true;
}

// <div><img><span><span>Stealer</span> stole <img>  from you</span></div>
// "You stole   from VictimPlayer"
Colony.prototype.stealKnown = function (element) {
    const textContent = element.textContent.replace(/\s+/g, " ");
    const containsSnippet = textContent.includes(Colony.snippets.steal.known[0])
        || textContent.includes(Colony.snippets.steal.known[1]);
    if (!containsSnippet) return false;

    if (this.turnState.nextSteal === "spy") {
        this.logger.log(element, `${utf8Symbols.spy}`);
        this.turnState.nextSteal = null;
        return true;
    }

    let involvedPlayers = textContent
        // After this only the names are left
        .replace(Colony.snippets.steal.detect, " ")
        .split(" ");
    involvedPlayers = involvedPlayers.map(x => x.replace(/^[Yy]ou$/, this.playerUsername));
    if (!involvedPlayers.includes(this.playerUsername)) {
        alertIf("Expected \"[Yy]ou\" for", this.playerUsername, "in known steal");
        return false;
    }

    // The " stole " message can mean many things. We use the turnState to
    // differentiate them.

    const stealingPlayer = involvedPlayers[0];
    const targetPlayer = involvedPlayers[1];
    if (!verifyPlayers(this.players, stealingPlayer, targetPlayer)) return false; // Sanity check

    if (this.turnState.nextSteal === "masterMerchant") {
        const merchantStolen = Colony.extractResourcesFromElement(element);
        const slice = Multiverse.asSlice(merchantStolen);
        const count = Multiverse.sliceTotal(slice);
        console.assert([1, 2].includes(count));
        console.assert(
            (merchantStolen["unknown"] || -1) !== 0,
            "Known steals have no unknown cards"
        );
        this.logger.log(element, `${utf8Symbols.merchant} %c${stealingPlayer}%c ← ${resourcesAsUtf8(merchantStolen)} %c${targetPlayer}%c`, this.cssColourPlayer(stealingPlayer), "", this.cssColourPlayer(targetPlayer), "");

        this.multiverse.transformExchange(targetPlayer, stealingPlayer, // source, target
            Multiverse.asSlice(merchantStolen));

        this.trackerCollection.addRob(stealingPlayer, targetPlayer, count);

        this.turnState.nextSteal = null;

        return true;
    }

    if (this.turnState.nextSteal === "wedding") {
        const weddingStolen = Colony.extractResourcesFromElement(element);
        const slice = Multiverse.asSlice(weddingStolen);
        const count = Multiverse.sliceTotal(slice);
        console.assert([1, 2].includes(count));
        console.assert(
            (weddingStolen["unknown"] || -1) !== 0,
            "Known steals have no unknown cards"
        );
        this.logger.log(element, `${utf8Symbols.wedding} %c${stealingPlayer}%c ← ${resourcesAsUtf8(weddingStolen)} %c${targetPlayer}%c`, this.cssColourPlayer(stealingPlayer), "", this.cssColourPlayer(targetPlayer), "");

        this.multiverse.transformExchange(targetPlayer, stealingPlayer, slice);

        this.trackerCollection.addRob(stealingPlayer, targetPlayer, count);

        // ❕ Leaving 'nextSteal' unchanged because wedding can cause
        // multiple steals. Has to be overwritten by other steal (or end of
        // turn).

        return true;
    }

    const stolenResourceType = Colony.findSingularResourceImageInElement(element);

    console.assert(
        this.turnState.nextSteal === "robber",
        "Should set next steal before entering here"
    );

    this.logger.log(element, `${utf8Symbols.steal} %c${stealingPlayer}%c ← ${utf8Symbols[stolenResourceType]} %c${targetPlayer}%c`, this.cssColourPlayer(stealingPlayer), "", this.cssColourPlayer(targetPlayer), "");

    this.trackerCollection.addRob(stealingPlayer, targetPlayer);

    this.multiverse.transformRandomReveal(targetPlayer,
        Multiverse.getResourceIndex(stolenResourceType));
    this.multiverse.transformExchange
        (
            targetPlayer, stealingPlayer, // source, target
            Multiverse.asSlice({ [stolenResourceType]: 1 })
        );

    return true;
} // stealKnown

// <div><img><span><span>StealingPlayer</span> stole <img>  from <span>VictimPlayer</span></span></div>
// "StealingPlayer stole   from VictimPlayer"
Colony.prototype.stealUnknown = function (element) {
    const textContent = element.textContent.replace(/\s+/g, " ");
    const isKnown = textContent.includes(Colony.snippets.steal.known[0])
        || textContent.includes(Colony.snippets.steal.known[1]);
    const containsStealSnippet = textContent.includes(Colony.snippets.steal.detect);
    if (isKnown || !containsStealSnippet) return false;

    if (this.turnState.nextSteal === "spy") {
        this.turnState.nextSteal = null;
        console.debug("◦ Ignoring steal from spy");
        return true;
    }

    const involvedPlayers = textContent
        .replace(Colony.snippets.steal.detect, " ") // After this only the names are left
        .split(" ");
    if (involvedPlayers[0] === "You"
        || involvedPlayers[0] === "you"
        || involvedPlayers[1] === "You"
        || involvedPlayers[1] === "you") {
        console.error("Did not expect \"[Yy]ou\" in unknown steal");
        alertIf(28);
        // Fallthrough in case an actual name is "[Yy]ou"
    }
    const stealingPlayer = involvedPlayers[0];
    const targetPlayer = involvedPlayers[1];
    if (!verifyPlayers(this.players, stealingPlayer, targetPlayer)) return false;

    if (this.turnState.nextSteal === "masterMerchant") {
        const merchantStolen = Colony.extractResourcesFromElement(element);
        const asSlice = Multiverse.asSlice(merchantStolen);
        const stolenCount = Multiverse.sliceTotal(asSlice);
        console.assert(
            merchantStolen["unknown"] === stolenCount,
            "Unknown merchant steals have only unknown cards"
        );
        this.logger.log(element, `${utf8Symbols.merchant} %c${stealingPlayer}%c ← ${resourcesAsUtf8(merchantStolen)} %c${targetPlayer}%c`, this.cssColourPlayer(stealingPlayer), "", this.cssColourPlayer(targetPlayer), "");

        // Steal less than 2 only if not enough available
        if (stolenCount < 2)
            this.multiverse.collapseTotal(targetPlayer, n => n < 2);
        for (let i = 0; i < stolenCount; i++)
            this.multiverse.branchSteal(targetPlayer, stealingPlayer, true);

        this.trackerCollection.addRob(stealingPlayer, targetPlayer, stolenCount);

        this.turnState.nextSteal = null;

        return true;
    }

    if (this.turnState.nextSteal === "wedding") {
        // TODO Can we extract resources once and use em in each case?
        const weddingStolen = Colony.extractResourcesFromElement(element);
        const asSlice = Multiverse.asSlice(weddingStolen);
        const stolenCount = Multiverse.sliceTotal(asSlice);
        console.assert(
            weddingStolen["unknown"] === stolenCount,
            "Unknown wedding steals have only unknown cards"
        );
        this.logger.log(element, `${utf8Symbols.wedding} %c${stealingPlayer}%c ← ${resourcesAsUtf8(weddingStolen)} %c${targetPlayer}%c`, this.cssColourPlayer(stealingPlayer), "", this.cssColourPlayer(targetPlayer), "");

        // Steal less than 2 only if not enough available
        if (stolenCount < 2)
            this.multiverse.collapseTotal(targetPlayer, n => n < 2);
        for (let i = 0; i < stolenCount; i++) {
            this.multiverse.branchSteal(targetPlayer, stealingPlayer, true);
            this.trackerCollection.addRob(stealingPlayer, targetPlayer);
        }

        // ❕ Leaving 'nextSteal' unchanged because wedding can cause
        // multiple steals. Has to be overwritten by other steal (or end of
        // turn).

        return true;
    }

    // Bishop, knight and 7 steals (i.e., robber steals):

    if (this.turnState.nextSteal !== "robber") {
        alertIf("Unexpected nextSteal (unreachable): " + this.turnState.nextSteal);
        return false;
    }

    this.logger.log(element, `${utf8Symbols.steal} %c${stealingPlayer}%c ← ${utf8Symbols.unknown} %c${targetPlayer}%c`, this.cssColourPlayer(stealingPlayer), "", this.cssColourPlayer(targetPlayer), "");


    this.trackerCollection.addRob(stealingPlayer, targetPlayer);

    this.multiverse.branchSteal(targetPlayer, stealingPlayer);

    return true;
} // stealUnknown

Colony.prototype.parseMoveRobber = function (element) {
    if (!element.textContent.includes(Colony.snippets.movedRobber))
        return false;

    this.logger.log(element, `${utf8Symbols.robber} ${utf8Symbols.move}`);

    this.turnState.nextSteal = "robber";

    return true;
}

Colony.prototype.parseMoveShip = function (element) {
    if (!element.textContent.includes(Colony.snippets.movedShip))
        return false;
    const type = element.querySelectorAll("img")[1].alt;
    if (type !== "pirate") return false;

    this.logger.log(element, `${utf8Symbols.pirate} ${utf8Symbols.move}`);

    this.turnState.nextSteal = "robber";

    return true;
}

Colony.prototype.parsePlaceShipRoad = function (element) {
    if (!element.textContent.includes(Colony.snippets.placeShipRoad.text))
        return false;
    const alt = element.querySelectorAll("img")[1].alt;
    if (!Colony.snippets.placeShipRoad.alt.includes(alt))
        return false;

    const player = element.textContent.substring(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    let costs = null;
    if (alt === "ship") {
        costs = { wood: -1, sheep: -1 };
    }
    else if (alt === "road") {
        costs = { wood: -1, brick: -1 };
    }
    console.assert(costs !== null, "Unexpected alt: " + alt);
    if (this.turnState.roadBuilding > 0) {
        this.logger.log(element, `${utf8Symbols.roadBuilder} %c${player}%c`, this.cssColourPlayer(player), "");
        costs = {};
        this.turnState.roadBuilding -= 1;
    }
    else {
        console.assert(alt === "ship", "Unreachable: Roads should be 'built', not placed, unless free");
        if (alt !== "ship")
            alertIf("Unexpected alt: " + alt);
    }
    const asSlice = Multiverse.asSlice(costs);
    this.logger.log(element, `${utf8Symbols.build} ${utf8Symbols[alt]} %c${player}%c → ${resourcesAsUtf8(costs)}`, this.cssColourPlayer(player), "");

    this.multiverse.transformSpawn(player, asSlice);

    return true;
}

Colony.prototype.parsePlaceKnight = function (element) {
    if (!element.textContent.includes(Colony.snippets.placeKnight.text))
        return false;
    if (element.children[1].children[1].alt !== Colony.snippets.placeKnight.alt)
        return false;

    const player = element.textContent.substring(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    const costSlice = this.turnState.deserter === true
        ? Multiverse.zeroResources
        : Multiverse.asSlice({ sheep: -1, ore: -1 });
    const resourceStr = Multiverse.sliceToResources(costSlice).toSymbols();
    if (this.turnState.deserter === true) {
        this.logger.log(element, `${utf8Symbols.free} ${utf8Symbols.knight} ( ${utf8Symbols.deserter} )`);
    }
    this.logger.log(
        element,
        `${utf8Symbols.build} ${utf8Symbols.knight} %c${player}%c → ${resourceStr}`,
        this.cssColourPlayer(player),
        ""
    );

    this.multiverse.transformSpawn(player, costSlice);

    this.turnState.deserter = false;

    return true;
}

Colony.prototype.parseActivateKnight = function (element) {
    if (!element.textContent.includes(Colony.snippets.activateKnight))
        return false;

    const player = element.textContent.substr(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    const cost = { wheat: -1 };
    this.logger.log(element, `${utf8Symbols.activate} ${utf8Symbols.knight} %c${player}%c ➜ ${resourcesAsUtf8(cost)}`, this.cssColourPlayer(player), "");

    this.multiverse.transformSpawn(
        player,
        Multiverse.asSlice(cost)
    );

    return true;
}

Colony.prototype.parseUpgradeKnight = function (element) {
    if (!element.textContent.includes(Colony.snippets.upgradeKnight.text))
        return false;
    if (element.children[1].children[1].alt !== Colony.snippets.upgradeKnight.alt)
        return false;

    const player = element.textContent.substr(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    let cost = { sheep: -1, ore: -1 };
    if (this.turnState.smith > 0) {
        this.logger.log(element, `${utf8Symbols.free} ( ${utf8Symbols.smith} ):`);
        cost = {};
        this.turnState.smith -= 1;
    }
    const asSlice = Multiverse.asSlice(cost);
    this.logger.log(element, `${utf8Symbols.upgrade} ${utf8Symbols.knight} %c${player}%c → ${resourcesAsUtf8(cost)}`, this.cssColourPlayer(player), "");

    this.multiverse.transformSpawn(player, asSlice);

    return true;
}

Colony.prototype.parseAqueduct = function (element) {
    if (!element.textContent.replace(/\s+/g, " ").includes(Colony.snippets.aqueduct))
        return false;

    const player = element.textContent.substr(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    const resources = Colony.extractResourcesFromElement(element);
    this.logger.log(element, `${utf8Symbols.aqueduct} %c${player}%c ← ${resourcesAsUtf8(resources)}`, this.cssColourPlayer(player), "");

    if ((resources.unknown || 0) !== 0) {
        alertIf("Aqueduct should never have unknown resources (unreachable)");
    }

    this.multiverse.transformSpawn(
        player,
        Multiverse.asSlice(resources)
    );

    return true;
}

Colony.prototype.parseUpgradeCity = function (element) {
    if (!element.textContent.replace(/\s+/g, " ").includes(Colony.snippets.upgradeCity))
        return false;

    const player = element.textContent.substr(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    const resourceType = Colony.upgradeMap[element.children[1].children[1].alt];
    const level = Number(element.textContent.slice(-1));
    console.assert(level > 0);
    let resources = { [resourceType]: -level };
    if (this.turnState.crane === true) {
        this.turnState.crane = false;
        resources[resourceType] += 1;
        this.logger.log(element, `${utf8Symbols.discount} ( ${utf8Symbols.crane} ):`);
    }
    const slice = Multiverse.asSlice(resources);
    this.logger.log(element, `${utf8Symbols.upgrade} ${utf8Symbols.city} %c${player}%c → ${resourcesAsUtf8(resources)}`, this.cssColourPlayer(player), "");

    this.multiverse.transformSpawn(player, slice);

    return true;
}

// Some progress cards are ignored. For these we return false. This would allow
// a separate parser to catch them.
Colony.prototype.parseProgressCard = function (element) {
    if (!element.textContent.replace(/\s+/g, " ").includes(Colony.snippets.progressCard.text))
        return false;
    const card = element.querySelectorAll("img")[1].alt;
    if (!Colony.snippets.progressCard.alts.includes(card))
        return false;
    const player = element.textContent.substring(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    this.logger.log(element, `${utf8Symbols.progress} %c${player}%c ${card}`, this.cssColourPlayer(player), "");
    switch (card) {
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
        case "Road Building": // Fall through
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

Colony.prototype.parseResourceMonopoly = function (element) {
    if (!element.textContent.includes(Colony.snippets.resourceMonopoly))
        return false;
    if (this.turnState.nextSteal !== "resourceMonopoly") // TODO can this be played before rolling?
        return false;

    const player = element.textContent.slice(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    const resourceName = Colony.findSingularResourceImageInElement(element);
    const countStr = element.textContent.trim().split(" ").at(-1);
    const count = Number(countStr);
    this.logger.log(element, `${utf8Symbols.monopoly} (resource) %c${player}%c ← ${count}∙${utf8Symbols[resourceName]}`, this.cssColourPlayer(player), "");

    this.multiverse.transformMonopoly(
        player,
        Multiverse.getResourceIndex(resourceName),
        2,      // Steal at most 2
        count   // Only consider situations stealing exactly 'count' resources
    );

    this.turnState.nextSteal = null;

    return true;
}

// TODO Merge with resource monopoly parser
Colony.prototype.parseCommodityMonopoly = function (element) {
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
    this.logger.log(element, `${utf8Symbols.monopoly} (commodity) %c${player}%c ← ${count}∙${utf8Symbols[type]}`, this.cssColourPlayer(player), "");

    // Steal at most 1
    this.multiverse.transformMonopoly(player, resIndex, 1, count);

    this.turnState.nextSteal = null;

    return true;
}

Colony.prototype.parseCommercialHarborTheirs = function (element) {
    if (!element.textContent.includes(Colony.snippets.commercialHarbor.text))
        return false;

    const both = element.textContent
        .replace(Colony.snippets.commercialHarbor.split, "")
        .split(" ");
    const player = both[0].replace(/[Yy]ou/, this.playerUsername);
    const other = both[1].replace(/[Yy]ou/, this.playerUsername);
    if (!verifyPlayers(this.players, player, other)) return false; // Sanity check
    console.assert(player !== this.playerUsername); // Separate parser
    this.logger.log(element, `${utf8Symbols.harbor} (them) %c${player}%c (res) ${utf8Symbols.unknown} ↔ ${utf8Symbols.unknown} (com) ${other}`, this.cssColourPlayer(player), "", this.cssColourPlayer(other), "");

    this.multiverse.branchHarbor(player, other);
}

Colony.prototype.parseCommercialHarborOurs = function (element) {
    if (!element.textContent.startsWith(Colony.snippets.commercialHarborOur))
        return false;

    const us = this.playerUsername;
    const otherPlayer = element.children[1].children[1].textContent;
    if (!verifyPlayers(this.players, us, otherPlayer)) return false; // Sanity check
    let gave = element.children[1].children[0]
    let took = element.children[1].children[2];
    gave = Colony.imageAltMap[gave.alt];
    took = Colony.imageAltMap[took.alt];
    this.logger.log(element, `${utf8Symbols.harbor} (them/our) %c${us}%c (r/c) ${utf8Symbols[gave]} ↔ ${utf8Symbols[took]} (com) ${otherPlayer}`, this.cssColourPlayer(us), "", this.cssColourPlayer(otherPlayer), "");

    this.multiverse.transformTradeByName(
        us,
        otherPlayer,
        { [gave]: 1 },
        { [took]: 1 }
    );

    return true;
}

Colony.prototype.parseSpecialBuildPhase = function (element) {
    if (!element.textContent.includes(Colony.snippets.specialBuildPhase))
        return false;

    console.log("◦ Special build phase");

    this.turnState = Colony.emptyTurnState;

    return true;
}

Colony.prototype.parseDiplomatReposition = function (element) {
    if (!element.textContent.includes(Colony.snippets.diplomatReposition))
        return false;

    const player = element.textContent.slice(0, element.textContent.indexOf(" "));
    if (!verifyPlayers(this.players, player)) return false; // Sanity check
    this.logger.log(element, `${utf8Symbols.diplomat} %c${player}%c ${utf8Symbols.move} ${utf8Symbols.road}`, this.cssColourPlayer(player), "");

    this.turnState.diplomatReposition = true;

    return true;
}

Colony.prototype.parseWin = function (element) {
    if (!element.textContent.includes(Colony.snippets.winSnippet))
        return false;

    this.logger.log(element, `${utf8Symbols.win}`);

    this.stopMainLoop();

    return true;
}

// Special parser: Using during initial phase, but not part of 'ALL_PARSERS'.
// @return Pair of [player, colour] or [null, null] if no player found.
Colony.prototype.parseTurnName = function (element) {
    // Include only snippets that identify current user by name
    const txt = element.textContent;
    if (txt.includes(Colony.snippets.yearOfPlentySnippet)
        || txt.includes(Colony.snippets.builtSnippet)
        || txt.includes(Colony.snippets.boughtSnippet)
        || txt.includes(Colony.snippets.rolledSnippet)
        || txt.includes(Colony.snippets.placeInitialSettlementSnippet)) {
        const actor = txt.split(Colony.snippets.initialPlacement.split)[0];
        const html = element.innerHTML;
        const colStr = "color:";
        const start = html.indexOf(colStr) + colStr.length;
        const stop = html.indexOf("\"", start + 1);
        const colour = html.substring(start, stop);
        return [actor, colour];
    }
    return [null, null];
}

/**
 * By convention:
 *      • At most 1 parser accepts any message
 *      • An accepting parser returns true
 *      • A rejecting parser returns false
 *      • A rejecting parser is a no-op (it may log things)
 * Typical parser structure:
 *      1) Verify message type (else return false)
 *      2) Determine semantic content
 *          • parse element
 *          • transform data formats
 *          • log
 *          • sanity checks
 *      3) Update Multiverse + Track objects
 *      4) Update 'turnState'
 *      5) Return true to indicate completion
 *
 * The parser 'parseInitialGotMessage()' is not included in allParsers because
 * it is only used separately during initial placement phase.
 */
Colony.allParsers = [
    // The order is so that more common events are matched earlier
    Colony.prototype.parseAlways, // Must come first

    // --------------------------------------
    // Basegame parsers
    // --------------------------------------
    Colony.prototype.parseGotMessage,
    Colony.prototype.parseGoldTile,
    Colony.prototype.parseTradeOffer,
    Colony.prototype.parseTradeOfferCounter,
    Colony.prototype.parseRolls,

    Colony.prototype.stealUnknown,
    Colony.prototype.stealKnown,
    Colony.prototype.parseTradeBankMessage,
    Colony.prototype.parseTradeMessage,
    Colony.prototype.parseDiscardedMessage,
    Colony.prototype.parseBuiltMessage,
    Colony.prototype.parseBoughtMessage,
    Colony.prototype.parseMonopoly, // Regular monopoly only
    Colony.prototype.parseYearOfPlenty,

    Colony.prototype.parseWin, // Stops main loop

    // --------------------------------------
    // Expansion parsers
    // --------------------------------------
    Colony.prototype.parseAqueduct,
    Colony.prototype.parseMoveRobber,
    Colony.prototype.parseProgressCard, // The activation only, not the effects
    Colony.prototype.parseActivateKnight,
    Colony.prototype.parsePlaceKnight,
    Colony.prototype.parseUpgradeKnight,
    Colony.prototype.parseUpgradeCity,
    Colony.prototype.parseDiplomatReposition,
    Colony.prototype.parseResourceMonopoly,
    Colony.prototype.parseCommodityMonopoly,
    Colony.prototype.parsePlaceShipRoad,
    Colony.prototype.parseCommercialHarborTheirs, // Without our involvement
    Colony.prototype.parseCommercialHarborOurs, // With our involvement
    Colony.prototype.parseSpecialBuildPhase,
    Colony.prototype.parseMoveShip,
];

// FIXME: Spectator does not see some messages anymore
//  - commercial harbour
//  - ?

// TODO: Some rare events in C&K are not accounted for. These must currently be
//       recovered from using card recovery.
//  • Edge case card combinations
//  • Unrealized development cards may be confused with regular action
//      ◦ Building a knight regularly after using only 1 upgrade from an
//        engineer (reset engineer when road is built)
//      ◦ Deserter + building later
//      ◦ smith and upgrading later
//      ◦ 0-card monopoly (?)
//      ◦ road builder before being able to build
//      ◦ ...
//      ◦ diplomat?
//  • (I think medicine and crane are safe)
