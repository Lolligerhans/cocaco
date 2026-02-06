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

    static imageNameAdditions = {
        wood: "cf22f8083cf89c2a29e7",
        brick: "5950ea07a7ea01bc54a5",
        sheep: "17a6dea8d559949f0ccc",
        wheat: "09c9d82146a64bce69b5",
        ore: "117f64dab28e1c987958",
    };

    /**
     * Remove some HTMLElements on a best effort basis. Its ok if this fails.
     */
    static deleteSomeElements() {
        const ids = [
            "remove_ad_in_game_left",
            "remove_ad_in_game_right",
            // It used to by misspelled, can remove later
            "in_game_ab_right",
            "in_game_ab_left",
            // Is no longer misspelled
            "in_game_ad_right",
            "in_game_ad_left",
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
        this.logger.log(this.loggingElement, `🥥 Cocaco ${version_string}`);
        this.logger.log(this.loggingElement, `🥥 Hello ${this.playerUsername}`);

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
        // When replaying we start without waiting for the game (or game UI)
        if (cocaco_config.replay) {
            console.info("Colonist: Replaying!");
            this.logger = new MessageLog();
            this.logger.enabled = cocaco_config.log.main;
            return true;
        }

        const uiGame = document.getElementById("ui-game");
        if (!uiGame) {
            console.log("Waiting for game");
            return false;
        }

        {
            const responsiveContainer =
                uiGame.querySelector("[class*='responsiveContainer']");
            console.assert(responsiveContainer,
                           "Game log container is always expexted");
            this.loggingElement = uiGame.querySelector(".cocaco-log") ??
                                  responsiveContainer.insertBefore(
                                      document.createElement("div"),
                                      responsiveContainer.firstChild);
            this.loggingElement.className = "cocaco cocaco-log";
            console.assert(this.loggingElement,
                           "Logging element generation should always succeed");
        }

        {
            if (Colonist.enlarger) {
                this.loggingElement.removeEventListener(
                    "click", Colonist.enlarger, false);
                Colonist.enlarger = null;
            }
            if (cocaco_config.largeLog) {
                Colonist.enlarger = enlarge.bind(null, this.loggingElement);
                this.loggingElement.addEventListener("click", Colonist.enlarger,
                                                     false);
            }
        }

        {
            this.logger = new MessageLog(this.loggingElement);
            this.logger.enabled = cocaco_config.log.main;
        }

        Colonist.deleteSomeElements();

        return true;
    }

    /**
     * Waits for the username element to appear, setting 'playerUsername'.
     */
    findName() {
        if (!cocaco_config.replay) {
            this.playerUsername = parse_username(document);
            console.assert(this.playerUsername != null,
                           "Could not find username yet");
        }
        if (cocaco_config.fixedPlayerName === true) {
            this.playerUsername = cocaco_config.playerName;
        }
        if (this.playerUsername == null || this.playerUsername === "") {
            return false;
        }

        console.debug("🥥 You are:", this.playerUsername);
        show_version(this.playerUsername);

        return true;
    }

    /**
     * Registers the set of reparsers this class wants to utilize. Any game
     * relevant stuff should be done in the regular pipeline stages. I.e., in
     * 'ColonistSource'.
     * Here we add:
     *  - Country matcher
     */
    registerReceiveReparsers() {
        Reparse.register(
            "receive",
            "Colonist match countries",
            Reparse.applyDoers.byKind({id: "130", type: [4]}),
            Reparse.entryPoints.playerUserStates,
            check_all_country_codes,
            groups => {
                let any = false;
                for (let group of groups) {
                    this.logger.log(this.loggingElement,
                                    `${group.code}: ${group.players}`);
                    any = true;
                }
                if (any === false) {
                    this.logger.log(this.loggingElement, "No country matches");
                }
                return {isDone: true};
            },
        );

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
        this.playerUsername = null;
        this.loggingElement = null;
        this.logger = null;

        // Data pipeline
        this.observer = null;
        this.source = null;
        this.state = null;
        this.resender = null;

        // Debugging/Testing
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
        this.state =
            new State(this.observer, this.resender, this.loggingElement);

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

                this.loggingElement.addEventListener("click", runTest, false);
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
