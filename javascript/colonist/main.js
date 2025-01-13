"use strict";

// Colonist.io main module

/**
 * Class to orchestrate the "Colonist" pipeline by defining the order in which
 * to
 *  - read information from the DOM
 *  - find key HTMLElements
 *  - construct the required modules
 *  - start reading frames
 */
class Colonist {

    /**
     * Remove some HTMLElements on a best effort basis. Its ok if this fails.
     */
    static deleteSomeElements() {
        const ids = [
            "remove_ad_in_game_left", "remove_ad_in_game_right",
            "in_game_ab_right", "in_game_ab_left"
        ];
        for (const id of ids) {
            let e = document.getElementById(id);
            if (e) {
                e.remove();
            }
        }
    }

    /**
     * Calls logger.clear() and logs a hello message
     */
    clearLog() {
        console.assert(this.logger !== null);
        this.logger.clear();
        this.logger.log(this.chatElement, `🥥 Cocaco ${version_string}`);
        this.logger.log(this.chatElement, `🥥 Hello ${this.playerUsername}`);

        return true;
    }

    constructor() {
        this.reset();

        // TODO: Add recovery mode.

        // this.boundMainLoopToggle = Colonist.prototype.mainLoopToggle.bind(this);
        // this.boundRecoverCards = Colonist.prototype.recoverCards.bind(this);
        // this.boundRecoverNames = Colonist.prototype.recoverNames.bind(this);
    }

    /**
     * Find key HTMLElements. Progresses only when the elements are found.
     */
    findElements() {
        // When replaying we start without log element
        if (cocaco_config.replay) {
            console.info("Colonist: Replaying!");
            this.logger = new MessageLog();
            this.logger.enabled = cocaco_config.log.main;
            return true;
        }

        this.logElement = document.getElementById("game-log-text");
        if (!this.logElement) {
            return false;
        }
        this.chatElement = document.getElementById("game-chat-text");
        if (!this.chatElement) {
            // Log and chat element should appear at the same time
            console.warn("Did not find game chat despite game log present");
        }
        if (this.chatElement) {
            if (Colony.enlarger) {
                this.chatElement.removeEventListener("click", Colony.enlarger,
                                                     false);
                Colony.enlarger = null;
            }
            if (cocaco_config.largeLog) {
                Colony.enlarger = enlarge.bind(null, this.logElement);
                this.chatElement.addEventListener("click", Colony.enlarger,
                                                  false);
            }
        }

        Colonist.deleteSomeElements();
        this.logger = new MessageLog(this.chatElement);
        this.logger.enabled = cocaco_config.log.main;

        return true;
    }

    /**
     * Waits for the username element to appear, setting 'playerUsername'.
     */
    findName() {
        if (!cocaco_config.replay) {
            this.playerUsernameElement =
                document.getElementById("header_profile_username");
            this.playerUsername =
                deepCopy(this.playerUsernameElement.textContent);
            console.assert(this.playerUsernameElement !== null,
                           "playerUsernameElement should always be present");
        }
        if (cocaco_config.fixedPlayerName === true) {
            this.playerUsername = cocaco_config.playerName;
        }
        if (this.playerUsername === "") {
            return false;
        }

        console.debug("🥥 You are:", this.playerUsername);

        let e = document.getElementById("header_navigation_store");
        if (e !== null) {
            e.textContent = "🥥 Cocaco " + version_string;
        }

        return true;
    }

    /**
     * Registers the set of reparsers this class wants to utilize. Any game
     * relevant stuff should be done in the regular pipeline stages. I.e., in
     * 'ColonistSource'.
     * Here we add:
     *  - Country matcher
     *  - Dev spy (that is somehow still not fixed)
     */
    registerReceiveReparsers() {
        Reparse.register(
            "receive",
            "Colonist match countries",
            Reparse.applyDoers.byKind({type: [4]}),
            Reparse.entryPoints.playerUserStates,
            check_country_code,
            groups => {
                let any = false;
                for (let group of groups) {
                    this.logger.log(this.chatElement,
                                    `${group.code}: ${group.players}`);
                    any = true;
                }
                if (any === false) {
                    this.logger.log(this.chatElement, "No country matches");
                }
                return {isDone: true};
            },
        );

        // Dev spy helpers
        // TODO: Remove o̶n̶c̶e̶ ̶C̶o̶l̶o̶n̶i̶s̶t̶ ̶i̶f̶x̶e̶d̶ ̶i̶t̶ if Colonist fixes it
        let playerUserStates = null;
        let devSpyElements = {}; // Appended nodes to be replaced on updates
        let devSpyLogger = new ConsoleLog("DevSpy", "🕵");
        /**
         * Helper to update a dev spy element.
         * @param {string} who Identifier for the element to update. Typically
         *                     an index or name or "bank".
         * @param {*} devCards Dev cards held by player/bank identified by 'who'
         */
        const updateDevSpyElement = (who, devCards) => {
            const icons = devCards.map(
                card => utf8Symbols[Colony.enumNames.devcards[card]]);
            const messageForUser = `${who}: ${icons.join("")}`;
            devSpyLogger.log(messageForUser);
            let element = devSpyElements[who] ?? document.createElement("div");
            element.className = MessageLog.className;
            element.textContent = messageForUser;
            if (devCards.length === 0) {
                devSpyLogger.log("Empty:", who);
                element.remove();
            } else {
                devSpyElements[who] = this.chatElement.appendChild(element);
                element.scrollIntoView(false);
            }
        };

        /**
         * Helper mapping a colour index to the player's name
         * @param {Number} colourIndex
         * @return {string} Player name corresponding to the given colour
         */
        let getPlayerName = function(colourIndex) {
            if (playerUserStates === null) {
                console.error(
                    "getPlayerName called before setting playerUserStates");
                return "<unknown>"; // Only used for display so return something
            }
            // Two equal signs to compare with string type colourIndex
            const player =
                playerUserStates.find(x => x.selectedColor == colourIndex);
            console.assert(player !== undefined,
                           "colour index should be available");
            return player.username;
        };

        // Gets a copy of the playerUserStates used as lookup for the dev spy
        Reparse.register("receive", "Colonist set playerUserStates",
                         Reparse.applyDoers.byKind({type: [4], id: "130"}),
                         Reparse.entryPoints.playerUserStates, state => state,
                         state => {
                             playerUserStates = state;
                             // console.info("playerUserStates:", playerUserStates);
                             return {isDone: false};
                         });

        Reparse.register(
            "receive", "Colonist dev spy",
            Reparse.applyDoers.byKind({type: [4, 91], id: "130"}),
            Reparse.entryPoints.developmentCardsState,
            check_all_development_cards, cards => {
                if (Object.hasOwn(cards, "bank"))
                    updateDevSpyElement("Bank", cards.bank);
                for (let [index, devs] of Object.entries(cards.players))
                    updateDevSpyElement(getPlayerName(index), devs);
                return {isDone: false};
            });

        return true; // Register only once
    }

    /**
     * Register some sent-message reparsers. This is currently for testing only.
     */
    registerSendReparsers() {

        Reparse.register(
            "send",
            "Colonist-ChatMessageFinder",
            () => true,
            x => x,
            x => x,
            x => {
                console.assert(x.message != null);
                if (x.message && x.message.action && x.message.action === 0) {
                    console.debug("❗ Chat message found");
                }
                return {isDone: false};
            },
        );

        Reparse.register(
            "send",
            "Test getting chat actions",
            Reparse.applySend.byType({v0: 3, v1: 1, action: 0}),
            Reparse.entryPointsSend.payload,
            x => x,
            str => {
                console.debug("🗨️", str);
                return {isDone: false};
            },
        );

        return true;
    }

    /**
     * Reset instance to pristine state. Note that the modules can still exist,
     * may still continue running and do not clean, for example, the UI.
     * This function is currently only used on construction; in the future it
     * may be used for hard reset.
     *
     * Initializes all members to their default 'null'.
     */
    reset() {
        // Host
        this.chatElement = null;
        this.logElement = null;
        this.playerUsernameElement = null;
        this.playerUsername = null;
        this.logger = null;

        // Data pipeline
        this.observer = null;
        this.source = null;
        this.state = null;
        this.resender = null;

        // Debugging
        this.replay = null;

        return true;
    }

    /**
     * Construct the pipeline modules. After this funciton, the pipeline is
     * essentially ready to receive data.
     */
    setupState() {
        this.source = new ColonistSource();
        this.observer = new ColonistObserver(this.source, this.resender);
        this.state = new State(this.observer, this.resender, this.chatElement);

        // HACK: Supply playerUsername manually instead of reparsing
        this.source.setPlayerUsername(this.playerUsername);

        return true;
    }

    /**
     * Determines the program flow for Colonist by calling member functions in
     * the appropriate order.
     *
     * The user of this class only has to call 'start()'.
     */
    start() {
        // Execute these tasks in order. Repeat each task until returning true.
        let tasks = [
            {name: "Reset", funct: () => this.reset()},
            {name: "Parse Home DOM", funct: () => this.findName()},
            {name: "Parse Game DOM", funct: () => this.findElements()},
            {name: "Resender setup", funct: () => this.startResender()},
            {
                name: "Receive reparsers",
                funct: () => this.registerReceiveReparsers()
            },
            {name: "Send reparsers", funct: () => this.registerSendReparsers()},
            {name: "State setup", funct: () => this.setupState()},
            {name: "Clear log", funct: () => this.clearLog()},
            {name: "WebSocket ready", funct: () => this.webSocketReady()},
        ];
        executeWithRetries(tasks);
    }

    /**
     * Construct the Resend object used within the pipeline
     *
     * The restrictions of the Resend class require that do this relatively
     * early, before any other reparsers are registered (explicitly or
     * implicitly by other modules).
     */
    startResender() {
        this.resender = new Resend();

        {
            // TEST: This block is for testing only
            if (cocaco_config.replay === false) {
                // May not have a log element in replay mode
                const runTest = () => { this.resender.test(); };

                this.logElement.addEventListener("click", runTest, false);
            } else if (cocaco_config.resendTestOnClick === true) {
                console.warn("Cannot run test during replay (no click element");
            }
        }

        return true;
    }

    /**
     * Active the web socket input. We start the extension with input disabled
     * to give us time to enter a gmae and set up the data pipeline. The
     * incoming frames are buffered until we set the ready flag.
     */
    webSocketReady() {
        socketsReady = true;
        setTimeout(handle);
        if (cocaco_config.replay) {
            this.replay = new Replay().start();
        }
        return true;
    }
}
