// Colonist.io main module

"use strict";

class Colonist {

    static colorMap = {
        1: "red",
        2: "green",
        3: "orange",
        4: "blue",
    }

    static deleteSomeElements() {
        const ids = ["remove_ad_in_game_left", "remove_ad_in_game_right",
            "in_game_ab_right", "in_game_ab_left"];
        for (const id of ids) {
            let e = document.getElementById(id);
            if (e) {
                e.remove();
            }
        }
    }

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
            console.warn("Did not find game chat");
        }
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

        Colonist.deleteSomeElements();
        this.logger = new MessageLog(this.chatElement);
        this.logger.enabled = cocaco_config.log.main;

        return true;
    }

    findName() {
        if (!cocaco_config.replay) {
            this.playerUsernameElement = document.getElementById(
                "header_profile_username");
            this.playerUsername = deepCopy(this.playerUsernameElement.textContent);
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

    registerReceiveReparsers() {
        Reparse.register(
            "receive",
            "Colonist match countries",
            Reparse.applyDoers.byKind({ type: [4] }),
            Reparse.entryPoints.playerUserStates,
            check_country_code,
            groups => {
                let any = false;
                for (let group of groups) {
                    this.logger.log(this.chatElement, `${group.code}: ${group.players}`)
                    any = true;
                }
                if (any === false) {
                    this.logger.log(this.chatElement, "No country matches");
                }
                return { isDone: true };
            },
        );

        // Dev spy helpers
        // TODO: Remove once Colonist ifxed it
        let playerUserStates = null;
        let getPlayerName = function (colourIndex) {
            if (playerUserStates === null) {
                console.error("getPlayerName called before setting playerUserStates");
                return "<unknown>"; // Only used for display so return something
            }
            // Two equal signs to compare with string type colourIndex
            const player = playerUserStates.find(
                x => x.selectedColor == colourIndex);
            console.assert(player !== undefined,
                `Player with colour index ${colourIndex} not found in playerUserStates`);
            return player.username;
        };

        Reparse.register(
            "receive",
            "Colonist set playerUserStates",
            Reparse.applyDoers.byKind({ type: [4], id: "130" }),
            Reparse.entryPoints.playerUserStates,
            state => state,
            state => {
                playerUserStates = state;
                console.info("playerUserStates:", playerUserStates);
                return { isDone: false };
            }
        );

        Reparse.register(
            "receive",
            "Colonist dev spy",
            Reparse.applyDoers.byKind({ type: [4, 91], id: "130" }),
            Reparse.entryPoints.developmentCardsState,
            check_development_cards,
            cards => {
                if (Object.hasOwn(cards, "bank")) {
                    const names = cards.bank.map(card => enumNames.devcards[card]);
                    const icons = names.map(name => utf8Symbols[name]);
                    const show = `Bank: ${icons.join("")}`;
                    // console.debug(show);
                    this.logger.log(this.chatElement, show);
                }
                for (let [index, player_cards] of Object.entries(cards.players)) {
                    const names = player_cards.map(card => enumNames.devcards[card]);
                    const icons = names.map(name => utf8Symbols[name]);
                    const playerName = getPlayerName(index);
                    const show = `${playerName}: ${icons.join("")}`;
                    // console.debug(show);
                    this.logger.log(this.chatElement, show);
                }
                return { isDone: false };
            }
        );

        return true;
    }

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
                return { isDone: false };
            },
        );

        Reparse.register(
            "send",
            "Test getting chat actions",
            Reparse.applySend.byType({ v0: 3, v1: 1, action: 0, }),
            Reparse.entryPointsSend.payload,
            x => x,
            str => {
                console.debug("🗨️", str);
                return { isDone: false };
            },
        );

        return true;
    }

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

        // Tests
        this.serverId = null;

        return true;
    }

    setupState() {
        this.state = new State(this.logElement, this.resender);
        this.source = new ColonistSource();
        this.observer = new ColonistObserver(this.source, this.state);

        // HACK: Supply playerUsername manually
        this.source.setPlayerUsername(this.playerUsername);

        return true;
    }

    start() {
        let tasks = [
            { name: "Reset", funct: () => this.reset() },
            { name: "Parse Home DOM", funct: () => this.findName() },
            { name: "Parse Game DOM", funct: () => this.findElements() },
            { name: "Resender setup", funct: () => this.startResender() },
            { name: "Receive reparsers", funct: () => this.registerReceiveReparsers() },
            { name: "Send reparsers", funct: () => this.registerSendReparsers() },
            { name: "State setup", funct: () => this.setupState() },
            { name: "Clear log", funct: () => this.clearLog() },
            { name: "WebSocket ready", funct: () => this.webSocketReady() },
        ];
        executeWithRetries(tasks);
    }

    startResender() {
        // NOTE: Important to create the resender first
        this.resender = new Resend();
        // TODO: This block is for testing only
        {
            if (cocaco_config.replay === false) {
                // May not have a log element in replay mode
                const runTest = () => {
                    console.debug("main.js: Starting test");
                    console.assert(this.serverId !== null);
                    this.resender.test(this.serverId);
                };

                this.logElement.addEventListener("click", runTest, false);
                console.log("☺ Test ready");
            } else if (cocaco_config.test === true) {
                console.warn("Cannot run test during replay (no click element");
            }

            Reparse.register(
                "receive",
                "Colonist-TestSetServerId",
                Reparse.applyDoers.byKind({ type: [1], id: ["130"] }),
                Reparse.entryPoints.serverId,
                serverId => serverId,
                (serverId, frame) => {
                    this.serverId = serverId;
                    console.debug("☺ Set serverId:", serverId, frame);
                    this.logger.log(null, "serverId=" + serverId);
                    return { isDone: true };
                },
            );
        }
        return true;
    }

    webSocketReady() {
        socketsReady = true;
        setTimeout(handle);
        if (cocaco_config.replay) {
            this.replay = new Replay().start();
        }
        return true;
    }

}
