"use strict";

class Colony
{

    //=====================================================================
    // Static
    //=====================================================================

    // Returns resource type of any resource card found in the element. Use when
    // there is only one resource card.
    static findSingularResourceImageInElement(element)
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

        log("[ERROR] Expected resource image in element");
        alertIf(4);
    }

    // Matches input string 'html' against assumed-unique strings identifying
    // resource card images.
    // Returns object {wood: 0, brick:1, …}
    static findAllResourceCardsInHtml(html)
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
    static extractDiceSumOfChildren(element)
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

    static deleteDiscordSigns()
    {
        const ids = [ "remove_ad_in_game_left", "remove_ad_in_game_right",
            "in_game_ab_right", "in_game_ab_left" ];
        for (const id of ids)
        {
            let element = document.getElementById(id);
            if (element) element.remove();
        }
        log("Removed elements");
    }

    /**
     * Find where the first non-initial message is.
     *
     * Iterate all messages, keeping track of last placement message. Return
     * 1 + index of last such message.
     */
    static computeInitialPhaseOffset(messages)
    {
        let lastPlacementMessage = 0;
        messages.forEach
        (
            (msg, i) =>
            {
                let text = msg.textContent;
                if (text.includes(Colony.snippets.sufficientInitialPhaseMessageSnippet))
                {
                    lastPlacementMessage = Math.max(lastPlacementMessage, i);
                }
            }
        );
        log("Found last placement message at index", lastPlacementMessage);
        return lastPlacementMessage + 1;
    }

    //=====================================================================
    // Constants
    //=====================================================================

    static refreshRate = 3000;
    static snippets =
    {
        initialPlacementDoneSnippet: "rolled",
        receivedInitialResourcesSnippet: "received starting resources",  // Used to determine which resources each player should get in the initial phase
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
        monoStoleSnippet: " stole ", // Contained
        monoFromSnippet: "from", // Not contained
        discardedSnippet: " discarded ",
        trade: {detect: " traded for with ", split: " for "},
        steal: {you: ["You ", " from you"], detect: " stole from "},
        winSnippet: "won the game",
        rolledSnippet: " rolled ",
    }

    static imageNameSnippets =
    {
        wood: "card_lumber", brick: "card_brick", sheep: "card_wool",
        wheat: "card_grain", ore: "card_ore", "road": "road_red",
        "settlement": "settlement_red", "devcard": "card_devcardback",
        "city": "city_red"
    };

    static colonistAssets =
    {
        wood:       `<img src="dist/images/${Colony.imageNameSnippets["wood"]}.svg" class="explorer-tbl-resource-icon"/>`,
        brick:      `<img src="dist/images/${Colony.imageNameSnippets["brick"]}.svg" class="explorer-tbl-resource-icon"/>`,
        sheep:      `<img src="dist/images/${Colony.imageNameSnippets["sheep"]}.svg" class="explorer-tbl-resource-icon"/>`,
        wheat:      `<img src="dist/images/${Colony.imageNameSnippets["wheat"]}.svg" class="explorer-tbl-resource-icon"/>`,
        ore:        `<img src="dist/images/${Colony.imageNameSnippets["ore"]}.svg" class="explorer-tbl-resource-icon"/>`,
        road:       `<img src="dist/images/${Colony.imageNameSnippets["road"]}.svg" class="explorer-tbl-resource-icon"/>`,
        settlement: `<img src="dist/images/${Colony.imageNameSnippets["settlement"]}.svg" class="explorer-tbl-resource-icon"/>`,
        devcard:    `<img src="dist/images/${Colony.imageNameSnippets["devcard"]}.svg" class="explorer-tbl-resource-icon"/>`,
        city:       `<img src="dist/images/${Colony.imageNameSnippets["city"]}.svg" class="explorer-tbl-resource-icon"/>`
    };

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

        // The parser 'parseInitialGotMessage()' is not included in this list. We
        // call use it once at the start, not regularly. The parseTurnName() parse
        // is also not included. Used for recovery.
        // TODO Use \<parseTurnName\> during regular startup?
        this.ALL_PARSERS = // TODO can we make it static?
        [
            this.parseGotMessage.bind(this),
            this.parseTradeOffer.bind(this),
            this.parseTradeOfferCounter.bind(this),
            this.parseRolls.bind(this),

            this.stealUnknown.bind(this),
            this.stealKnown.bind(this),
            this.parseTradeBankMessage.bind(this),
            this.parseTradeMessage.bind(this),
            this.parseDiscardedMessage.bind(this),
            this.parseBuiltMessage.bind(this),
            this.parseBoughtMessage.bind(this),
            this.parseMonopoly.bind(this),
            this.parseYearOfPlenty.bind(this),

            this.parseWin.bind(this),
        ];

    }

    //=====================================================================
    // Messages
    //=====================================================================

    getAllMessages()
    {
        if (!this.logElement)
        {
            alertIf(41);
            throw Error("Log element hasn't been found yet.");
        }
        return collectionToArray(this.logElement.children);
    }

    getNewMessages()
    {
        const allMessages = this.getAllMessages();
        const newMessages = allMessages.slice(this.MSG_OFFSET);
        this.MSG_OFFSET = allMessages.length;
        return newMessages;
    }

    // Has the sideeffect of updating a checkpoint message number
    // TODO This is essentially the same as MSG_INDEX, but for the rendering. Consolidate the similarities.
    isNewMessage(msgNumber)
    {
        if (msgNumber > this.messageNumberDone)
        {
            this.messageNumberDone = msgNumber;
            return true;
        }
        return false;
    }

    //=====================================================================
    // Program flow
    //=====================================================================

    restartTracker(tasks =
    [
        { "funct": this.reset.bind(this),                             "ok": false },
        { "funct": this.findPlayerName.bind(this),                    "ok": false },
        { "funct": this.findTranscription.bind(this),                 "ok": false },
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
    reset()
    {
        this.logElement = null;
        this.playerUsernameElement = null;

        this.playerUsername; // "John"
        this.players = []; // ["John", "Jane", ...]
        this.player_colors = {}; // {"John": "blue", "Jane": "rgb(...)", ...}

        this.trackerObject = null; // new ManyWorlds();
        this.renderObject = null; // new Render();
        this.trackerCollection = null; // new Track();

        this.MSG_OFFSET = 0;
        this.messageNumberDone = -1;
        this.startupFlag = true;

        return true;
    }

    findPlayerName()
    {
        log("[NOTE] searching profile name");
        this.playerUsernameElement = document.getElementById("header_profile_username");
        console.assert(this.playerUsernameElement !== null, "should always be present, during and outside of games");
        this.playerUsername = deepCopy(this.playerUsernameElement.textContent);
        console.log("[NOTE] Found profile:", `"${this.playerUsername}"`);

        let e = document.getElementById("header_navigation_store");
        if (e !== null) e.textContent = "CoCaCo " + version_string;

        return true;
    }

    /**
     * Find the transcription.
     */
    findTranscription()
    {
        log("[NOTE] Waiting to start");
        this.logElement = document.getElementById("game-log-text");
        if (!this.logElement)
            return false;
        log("Found game-log-text element");
        Colony.deleteDiscordSigns(); // TODO remove to later point in case they are not loaded yet
        this.logElement.addEventListener("click", this.boundMainLoopToggle, false);
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
    waitForInitialPlacement()
    {
        const dummyPlayers = ["Awaiting", "First", "Roll", "..."];
        const dummyColours = {"Awaiting":"black", "First":"red", "Roll":"gold", "...":"white"};
        this.trackerObject = new ManyWorlds();
        this.trackerObject.initWorlds({"Awaiting":{}, "First":{}, "Roll":{}, "...":{}});
        this.trackerCollection = new Track();
        this.trackerCollection.init(dummyPlayers);
        this.renderObject = new Render
        (
            this.trackerObject, this.trackerCollection, dummyPlayers, dummyColours,
            null,
            null,
            null,
            null,
            configOwnIcons ? alternativeAssets : Colony.colonistAssets
        );
        this.renderObject.render();
        return true;
    }

    // Get new messages until 'playerCount' many player names were found. If
    // 'playerCount' is null, continue until the first roll instead. Must stop main
    // loop before running this so they dont interfere. Advances this.MSG_OFFSET as
    // usual.
    // At start of the game, set 'palyerCount' to null so the number is deduced.
    // When recovering from breaking log, or spectating, set 'playerCount' so the
    // function continues while parsing rolls.
    // TODO Better just split into recoverUsersUntilRoll() and recover_N_Users?
    recoverUsers(playerCount = null)
    {
        // NOTE If we make sure not to read initial placement messages, we can set
        //      MSG_OFFEST to 0, too. Those can appear out-of-player-order, and we
        //      imply the order from messages.
        //this.MSG_OFFSET = 0;

        let foundRoll = false;
        const done = () =>
        {
            return foundRoll ||
                playerCount !== null && playerCount - this.players.length === 0;
        };
        console.assert(!done()); // Dont come back when done

        log("[NOTE] Detecting player names...");
        const newMsg = this.getNewMessages();
        for (const msg of newMsg)
        {
            if (msg.textContent.includes(Colony.snippets.rolledSnippet))
            {
                foundRoll = true;
                break;
            }

            const [name, colour] = this.parseTurnName(msg);
            if (name === null)
                continue;
            if (!this.players.includes(name))
            {
                this.players.push(name);
                this.player_colors[name] = colour;
                log("Recoverd player", name, "with colour", colour);
                if (done())
                    break;
            }
        }
        if (done())
        {
            // Ensure our name is last in the array
            // Changing username during game would break this
            // TODO make standalone or static by passing names and a selected last name
            this.reorderPlayerNames();
            return true;
        }

        return false;
    }

    // Initializes the member objects once the required inputs are ready:
    // name + colour data must be handed to the member objects for construction.
    initializeTracker()
    {
        let noResources = {};
        for (const name of this.players)
            noResources[name] = {}; // Could be {"wood": 5, ...}

        this.trackerObejct = new ManyWorlds();
        this.trackerObject.initWorlds(noResources);
        this.trackerCollection = new Track;
        this.trackerCollection.init(this.players);

        // TODO Once we wanted to have persistent click bind (to UI or when not
        // removing the table, we need to create a permanent bind object to
        // prevent multi binds.

        this.renderObject = new Render
        (
            this.trackerObject, this.trackerCollection,
            this.players, this.player_colors,
            this.mainLoop.bind(this, () => true),
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
    comeMrTallyManTallinitialResource(after)
    {
        let foundRoll = false;
        let done = false;
        log("Polling for initial placement");
        const newMessages = this.getNewMessages();
        for (const msg of newMessages)
        {
            if (msg.textContent.includes(Colony.snippets.rolledSnippet))
            {
                foundRoll = true;
                break;
            }
            this.parseInitialGotMessage(msg); // Finds resources and adds them
        };
        if (!foundRoll)
            return false;


        //this.trackerObject.printWorlds();
        // TODO If we have a getNextMessage() function we would not need to reset afterwards because we can check one by one.
        const correctedOffset = Colony.computeInitialPhaseOffset(this.getAllMessages());
        this.MSG_OFFSET = correctedOffset;
        log("Correcting this.MSG_OFFSET to 28 ===", correctedOffset); // Should be 28
        return true;
    }

    /**
     * Parses the latest messages and re-renders the table.
     */
    // @param {function} continueIf - A function that returns true if the main
    // loop should proceed.
    mainLoop(continueIf = () => true)
    {
        if (!continueIf())
            return true; // Return true to signal completion to setDoInterval

        console.assert(this.startupFlag === false);

        const newMessages = this.getNewMessages();
        newMessages.forEach((msg, idx) =>
        {
            if (configLogMessages === true)
                console.log("[NOTE] Msg", this.MSG_OFFSET + idx, "|", msg.textContent);
            this.ALL_PARSERS.every(parser => { return !parser(msg); });
            if (configLogWorldCount === true)
                console.log("[NOTE] MW count:", this.trackerObject.manyWorlds.length);
        });

        // Abort if card tracking is broken
        if (this.trackerObject.manyWorlds.length === 0)
        {
            console.error("[ERROR] No world left");
            alertIf("Tracker OFF: Inconsistency (no world left). Try recovery mode.");
            this.stopMainLoop();
            return true; // Return true to signal completion
        }

        this.renderObject.render(() => this.isNewMessage(this.MSG_OFFSET));
    }

    // Recovers MW state from unknown cards. Player array is used and assumed
    // correct.
    recoverCards()
    {
        log("[NOTE] Starting manual card recovery");
        const activeBefore = this.isActiveMainLoop();
        this.stopMainLoop();
        // Confirm AFTER stopping main loop so that card counts can be timed
        if (!confirm(`Reset cards (${activeBefore ? "active" : "inactive"})?`))
        {
            log("[NOTE] Aborting manual card recovery");
            if (activeBefore)
                this.restartMainLoop();
            return;
        }
        // Set this.MSG_OFFSET to end just before the numbe rquerying starts. This way,
        // the game can continue while the user enters the number from that moment
        // in time (e.g., during other moves).
        this.MSG_OFFSET = this.getAllMessages().length;
        let counts = {};
        for (const player of this.players)
        {
            const count = prompt(`${player} number of cards:`, 0);
            counts[player] = count;
        }
        this.trackerObject.mwCardRecovery(counts);

        this.renderObject.render();
        this.restartMainLoop();
    }

    // Waits 1 round to collect all player names. Use recoverCards() to
    // set unknown card counts, entering manyWorlds recovery mode.
    recoverNames()
    {
        if (this.startupFlag === true)
        {
            log("[NOTE] recoverNames() suppressed: this.startupFlag === true");
            return;
        }
        log("[NOTE] Starting manual name recovery");
        const playerCount = Number(prompt("Player count (0 to abort):", 0));
        if (playerCount < 1 || 4 < playerCount)
        {
            log("[NOTE] Aborting manual name recovery");
            return;
        }

        this.stopMainLoop();
        this.renderObject.unrender();

        this.restartTracker(
        [
            { "funct": this.reset.bind(this), "ok": false },
            { "funct": this.findPlayerName.bind(this), "ok": false },
            { "funct": this.findTranscription.bind(this), "ok": false },
            { "funct": this.waitForInitialPlacement.bind(this), "ok": false },
            { "funct": this.recoverUsers.bind(this, playerCount), "ok": false },
            { "funct": this.initializeTracker.bind(this), "ok": false },
            { "funct": () => { this.renderObject.render(); return true; }, "ok": false },
        ]);
    }

    //=====================================================================
    // Main loop
    //=====================================================================

    isActiveMainLoop()
    {
        return this.lastStarted === this.activeIndex;
    }

    // Returns true if existing main loop interval was cleared, otherwise false
    stopMainLoop()
    {
        log("stopMainLoop()");
        this.activeIndex += 1;
    }

    restartMainLoop()
    {
        this.stopMainLoop(); // Sanitize
        log("restartMainLoop()");
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

    mainLoopToggle()
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
    parseInitialGotMessage(element)
    {
        const textContent = element.textContent;
        if (!textContent.includes(Colony.snippets.receivedInitialResourcesSnippet))
        {
            return false;
        }
        const player = textContent.replace(Colony.snippets.receivedInitialResourcesSnippet, "").split(" ")[0];
        if (!verifyPlayers(this.players, player)) return false;

        const initialResourceTypes = Colony.findAllResourceCardsInHtml(element.innerHTML);
        const asSlice = mw.generateWorldSlice(initialResourceTypes);
        logs("[INFO] First settlement resources:", player, "<-", initialResourceTypes);
        if (asSlice === 0) { console.warn("[WARNING] Empty starting resources"); }
        this.trackerObject.mwTransformSpawn(player, asSlice);

        return true;
    }

    parseTradeOffer(element)
    {
        const txt = element.textContent;
        if (!txt.includes(Colony.snippets.tradeOfferSnippet)) return false;
        const player = txt.substring(0, txt.indexOf(" "));
        if (!verifyPlayers(this.players, player)) return false; // Sanity check

        const offerHtml = element.innerHTML.split(Colony.snippets.tradeOfferResSnippet)[0];
        const offer = Colony.findAllResourceCardsInHtml(offerHtml);
        const asSlice = mw.generateWorldSlice(offer);
        logs("[INFO] Trade offer:", player, "->", offer);
        this.trackerObject.mwCollapseMin(player, asSlice);
        this.trackerObject.printWorlds();

        return true;
    }

    parseTradeOfferCounter(element)
    {
        // "John1 proposed counter offer to John2 [wood][brick] for [sheep]"
        const txt = element.textContent;
        if (!txt.includes(Colony.snippets.tradeOfferCounterSnippet)) return false;

        const player = txt.substring(0, txt.indexOf(" "));
        if (!verifyPlayers(this.players, player)) return false;

        const offerHtml = element.innerHTML.split(Colony.snippets.tradeOfferResSnippet)[0];
        const offer = Colony.findAllResourceCardsInHtml(offerHtml);
        const asSlice = mw.generateWorldSlice(offer);
        logs("[INFO] Trade counter offer:", player, "->", offer);
        this.trackerObject.mwCollapseMin(player, asSlice);
        this.trackerObject.printWorlds();

        return true;
    }

    parseYearOfPlenty(element)
    {
        let textContent = element.textContent;
        if (!textContent.includes(Colony.snippets.yearOfPlentySnippet)) return false;

        // Determine player
        let beneficiary = textContent.substring(0, textContent.indexOf(Colony.snippets.yearOfPlentySnippet));
        if (!verifyPlayers(this.players, beneficiary)) return false; // Sanity check

        // ManyWorlds version
        let obtainedResources = Colony.findAllResourceCardsInHtml(element.innerHTML);
        logs("[INFO] Year of Plenty:", beneficiary, "<-", obtainedResources);
        const asSlice = mw.generateWorldSlice(obtainedResources);
        this.trackerObject.mwTransformSpawn(beneficiary, asSlice);
        this.trackerObject.printWorlds();

        return true;
    }

    /**
     * Process a "got resource" message: [user icon] [user] got: ...[resource images]
     */
    parseGotMessage(element)
    {
        let textContent = element.textContent;
        if (textContent.includes(Colony.snippets.receivedResourcesSnippet))
        {
            const player = textContent.substring(0, textContent.indexOf(Colony.snippets.receivedResourcesSnippet));
            if (!verifyPlayers(this.players, player)) return false; // Sanity check

            // ManyWorlds version
            let obtainedResources = Colony.findAllResourceCardsInHtml(element.innerHTML);
            let asSlice = mw.generateWorldSlice(obtainedResources);
            logs("[INFO] Got resources:", player, "<-", obtainedResources);
            this.trackerObject.mwTransformSpawn(player, asSlice);
            this.trackerObject.printWorlds();

            return true;
        }

        return false;
    }

    /**
     * Process a "built" message: [user icon] [user] built a [building/road]
     */
    parseBuiltMessage(element)
    {
        let textContent = element.textContent;
        if (!textContent.includes(Colony.snippets.builtSnippet)) return false;
        let images = collectionToArray(element.getElementsByTagName('img'));
        let player = textContent.split(" ")[0];
        if (!verifyPlayers(this.players, player)) return false; // Sanity check
        let buildResources = deepCopy(mw.emptyResourcesByNameWithU);
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
        }
        if (!building)
        {
            console.error("[ERROR] Build message without building");
            alertIf(31);
        }

        // ManyWorlds version
        let asSlice = mw.generateWorldSlice(buildResources);
        logs("[INFO] Built:", player, buildResources);
        this.trackerObject.mwTransformSpawn(player, asSlice);
        this.trackerObject.printWorlds();

        return true;
    }

    parseRolls(element)
    {
        const textContent = element.textContent;
        if (!textContent.includes(Colony.snippets.rolledSnippet)) return false;
        const player = textContent.split(" ")[0];
        if (!verifyPlayers(this.players, player)) return false; // Sanity check

        const diceSum = Colony.extractDiceSumOfChildren(element);
        log("[INFO] Player", player, "rolled a", diceSum);

        this.trackerCollection.addRoll(diceSum);
        if (diceSum === 7)
            // TODO If the player does not steal from their robber this number
            // is misleading. We could track if a rob comes from a 7 or a robber
            // by checking which happened the message before.
            this.trackerCollection.addSeven(player);   // Affects seven counter but not rob stats

        return true;
    }

    /**
     * For dev cards. parseDevCard
     */
    parseBoughtMessage(element)
    {
        let textContent = element.textContent;
        if (!textContent.includes(Colony.snippets.boughtSnippet)) return false;
        let images = collectionToArray(element.getElementsByTagName('img'));
        let player = textContent.split(" ")[0];
        if (!verifyPlayers(this.players, player)) return false; // Sanity check

        // ManyWorlds version
        // TODO use structure cost array from mw
        let devCardResources = deepCopy(mw.emptyResourcesByNameWithU);
        devCardResources[sheep] = -1;
        devCardResources[wheat] = -1;
        devCardResources[ore  ] = -1;
        const devCardSlice = mw.generateWorldSlice(devCardResources);
        logs("[INFO] Baught dev card:", player, "->", devCardResources);
        this.trackerObject.mwTransformSpawn(player, devCardSlice);
        this.trackerObject.printWorlds();

        return true;
    }

    /**
     * Process a trade with the bank message: [user icon] [user] gave bank: ...[resources] and took ...[resources]
     */
    parseTradeBankMessage(element)
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
            log("[ERROR] Expected 2 substrings after split in dev card parser");
            alertIf(27);
            return;
        }
        const giveResources = Colony.findAllResourceCardsInHtml(gaveAndTook[0]);
        const takeResources = Colony.findAllResourceCardsInHtml(gaveAndTook[1]);
        const giveSlice     = mw.generateWorldSlice(giveResources);
        const takeSlice     = mw.generateWorldSlice(takeResources);
        logs("[INFO] Traded with bank:", player, giveResources, "->", takeResources);
        this.trackerObject.mwTransformSpawn(player, takeSlice - giveSlice);
        this.trackerObject.printWorlds();

        return true;
    }

    // Parse monopoly steals
    //
    // Example: John#1234 stole 2: <img...>
    //
    // Monopoly lines contain "stole" but do NOT contain a "from:" since they steal
    // from everyone.
    // Note: I dont know what happens with a 0-cards mono.
    parseMonopoly(element)
    {
        // Identify if a monopoly message is found
        let textContent = element.textContent;
        if ( !textContent.includes(Colony.snippets.monoStoleSnippet)
            || textContent.includes(Colony.snippets.monoFromSnippet ))
        {
            return false;
        }

        // Identify thief
        const thief = textContent.substring(0, textContent.indexOf(" "));
        if (!verifyPlayers(this.players, thief)) return false; // Sanity check

        // ManyWorlds version
        const stolenResource = Colony.findSingularResourceImageInElement(element);
        logs("[INFO] Monopoly:", thief, "<-", stolenResource);
        this.trackerObject.transformMonopoly(thief, mw.worldResourceIndex(stolenResource));
        this.trackerObject.printWorlds();

        return true;
    }

    /**
     * When the user has to discard cards because of a robber.
     */
    parseDiscardedMessage(element)
    {
        let textContent = element.textContent;
        if (!textContent.includes(Colony.snippets.discardedSnippet)) {
            return false;
        }
        const player = textContent.substring(0, textContent.indexOf(Colony.snippets.discardedSnippet));
        if (!verifyPlayers(this.players, player)) return false; // Sanity check

        // ManyWorlds version
        const discarded = Colony.findAllResourceCardsInHtml(element.innerHTML);
        const discardedCardsAsSlie = mw.generateWorldSlice(discarded);
        const discardCount = mw.getResourceSumOfSlice(discardedCardsAsSlie);
        logs("[INFO] Discarded:", player, "->", discarded);
        // Total can be unknown to MW after monopoly
        this.trackerObject.mwCollapseTotal(player, (x) => x >> 1 === discardCount);
        this.trackerObject.mwTransformSpawn(player, -discardedCardsAsSlie);
        this.trackerObject.printWorlds();

        return true;
    }

    // .outerHTML: <div><img><span><span>TradingPlayer<> traded <img> <img>  for <img>  with <span>OtherPlayer<><><>
    // .textContent: "TradingPlayer traded    for   with OtherPlayer"
    // Has whitespace between cards.
    parseTradeMessage(element)
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
        const offer = Colony.findAllResourceCardsInHtml(split[0]);
        const demand = Colony.findAllResourceCardsInHtml(split[1]);
        console.debug("[INFO] Trade:", offer, tradingPlayer, "--> | <--", otherPlayer, demand);

        this.trackerObject.transformTradeByName(tradingPlayer, otherPlayer, offer, demand);
        this.trackerObject.printWorlds();

        return true;
    }

    // <div><img><span><span>Stealer</span> stole <img>  from you</span></div>
    // "You stole   from VictimPlayer"
    stealKnown(element)
    {
        const textContent = element.textContent.replace(/\s+/g, " ");
        const containsYou =  textContent.includes(Colony.snippets.steal.you[0])
                           || textContent.includes(Colony.snippets.steal.you[1]);
        const containsStealSnippet = textContent.includes(Colony.snippets.steal.detect);
        if (!containsYou || !containsStealSnippet) return false;

        const involvedPlayers = textContent
            .replace(Colony.snippets.steal.detect, " ") // After this only the names are left
            .split(" ");
        // Replace [Yy]ou with our name
        if      (involvedPlayers[0] === "You" || involvedPlayers[0] === "you")
        {        involvedPlayers[0] = this.playerUsername; }
        else if (involvedPlayers[1] === "You" || involvedPlayers[1] === "you")
        {        involvedPlayers[1] = this.playerUsername; }
        else
        {
            console.error("Expected \"[Yy]ou\" for", this.playerUsername, "in known steal");
            alertIf(33);
            return;
        }

        const stealingPlayer = involvedPlayers[0];
        const targetPlayer = involvedPlayers[1];
        if (!verifyPlayers(this.players, stealingPlayer, targetPlayer)) return false; // Sanity check
        const stolenResourceType = Colony.findSingularResourceImageInElement(element);
        const stolenResourceIndex = mw.worldResourceIndex(stolenResourceType);

        // Robs update
        logs("[INFO] Steal:", targetPlayer, "->", stealingPlayer, "(", stolenResourceType, ")");
        this.trackerCollection.addRob(stealingPlayer, targetPlayer);

        // ManyWorlds update
        this.trackerObject.collapseAsRandom(targetPlayer, stolenResourceIndex);
        this.trackerObject.transformExchange
        (
            targetPlayer, stealingPlayer, // source, target
            mw.generateSingularSlice(stolenResourceIndex)
        );
        this.trackerObject.printWorlds(); // TODO maybe print in the parser loop

        return true;
    }

    // <div><img><span><span>StealingPlayer</span> stole <img>  from <span>VictimPlayer</span></span></div>
    // "StealingPlayer stole   from VictimPlayer"
    stealUnknown(element)
    {
        const textContent = element.textContent.replace(/\s+/g, " ");
        const containsYou =  textContent.includes(Colony.snippets.steal.you[0])
                          || textContent.includes(Colony.snippets.steal.you[1]);
        const containsStealSnippet = textContent.includes(Colony.snippets.steal.detect);
        if (containsYou || !containsStealSnippet) return false;

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
        logs("[INFO] Steal:", targetPlayer, "->", stealingPlayer);

        this.trackerCollection.addRob(stealingPlayer, targetPlayer);

        this.trackerObject.branchSteal(targetPlayer, stealingPlayer);
        this.trackerObject.printWorlds();

        return true;
    }

    parseWin(element)
    {
        // TODO This includes player names (!). Use longer snippet.
        if (!element.textContent.includes(Colony.snippets.winSnippet))
            return false;
        this.stopMainLoop();
        log("[INFO] End of Game");
        return true;
    }

    // (!) Returns name of the player who's turn it is (not true/false like the
    // other parsers). Returns null if no player found. This is useful to keep the
    // order of occurence constant.
    parseTurnName(element)
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
    reorderPlayerNames()
    {
        // Determine our own name
        if (configFixedPlayerName || !this.playerUsername)
        {
            if (!configFixedPlayerName)
            {
                console.warning("Username not found. Using fixed name.");
            }
            this.playerUsername = configPlayerName;
        }

        // Rotate 'this.players' so that we are in 4th position
        const ourPosition = this.players.indexOf(this.playerUsername);
        const rotation = this.players.length - ourPosition - 1;
        if (ourPosition < 0)
        {
            console.error("Username not part of this.players");
            alertIf(32);
            return;
        }
        const unrotatedCopy = deepCopy(this.players);
        for (let i = 0; i < this.players.length; ++i)
        {
            this.players[(i + rotation) % this.players.length] = unrotatedCopy[i];
        }
        for (const p of this.players)
        {
            log("[NOTE] Found player:", p);
        }
        log("[NOTE] You are:", this.playerUsername);
    }

} // class Colony

// vim: shiftwidth=4:softtabstop=4:expandtab
