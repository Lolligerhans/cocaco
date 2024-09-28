// Colonist.io data pipeline

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
        this.logger.logChat(`🥥 Cocaco ${version_string}`);
        this.logger.logChat(`🥥 Hello ${this.playerUsername}`);

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
            if (config.largeLog) {
                Colony.enlarger = enlarge.bind(null, this.logElement);
                this.chatElement.addEventListener("click", Colony.enlarger, false);
            }
        }

        Colonist.deleteSomeElements();
        this.logElement.addEventListener("click", this.boundToggleTable, false);
        this.logger = new MessageLog(this.chatElement);

        // TODO: Do we still want to do colouring?

        // // Reset background after extension restart. Has no effect the first time.
        // for (e of this.logElement.children)
        //     e.style.background = "";

        return true;
    }

    findName() {
        this.playerUsernameElement = document.getElementById("header_profile_username");
        console.assert(this.playerUsernameElement !== null,
            "playerUsernameElement should always be present");
        this.playerUsername = deepCopy(this.playerUsernameElement.textContent);
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

    registerReparsers() {

        new Reparse(
            "Colonist match countries",
            Reparse.applyDoers.byKind({ type: [4] }),
            Reparse.entryPoints.playerUserStates,
            check_country_code,
            groups => {
                let any = false;
                for (let group of groups) {
                    this.logger.logChat(`${group.code}: ${group.players}`)
                    any = true;
                }
                if (any === false) {
                    this.logger.logChat("No country matches");
                }
                return true;
            },
        ).register();

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
        new Reparse(
            "Colonist set playerUserStates",
            Reparse.applyDoers.byKind({ type: [4], id: "130" }),
            Reparse.entryPoints.playerUserStates,
            state => state,
            state => {
                playerUserStates = state;
                console.info("playerUserStates:", playerUserStates);
                return false;
            }
        ).register();
        new Reparse(
            "Colonist dev spy",
            Reparse.applyDoers.byKind({ type: [4, 91], id: "130" }),
            Reparse.entryPoints.developmentCardsState,
            check_development_cards,
            cards => {
                if (Object.hasOwn(cards, "bank")) {
                    const names = cards.bank.map(card => enumNames.devcards[card]);
                    const icons = names.map(name => utf8Symbols[name]);
                    const show = `Bank: ${icons.join("")}`;
                    console.debug(show);
                    this.logger.logChat(show);
                }
                for (let [index, player_cards] of Object.entries(cards.players)) {
                    const names = player_cards.map(card => enumNames.devcards[card]);
                    const icons = names.map(name => utf8Symbols[name]);
                    const playerName = getPlayerName(index);
                    const show = `${playerName}: ${icons.join("")}`;
                    console.debug(show);
                    this.logger.logChat(show);
                }
                return false;
            }
        ).register();

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

        return true;
    }

    setupState() {
        this.state = new State(this.logElement);
        this.source = new ColonistSource();
        this.observer = new ColonistObserver(this.source, this.state);
        // HACK: Suppy playerUsername manually

        this.source.setPlayerUsername(this.playerUsername);

        return true;
    }

    start() {
        let tasks = [
            { name: "Reset", funct: () => this.reset() },
            { name: "Parse Home DOM", funct: () => this.findName() },
            { name: "Parse Game DOM", funct: () => this.findElements() },
            { name: "Misc reparsers", funct: () => this.registerReparsers() },
            { name: "State setup", funct: () => this.setupState() },
            { name: "Clear log", funct: () => this.clearLog() },
            { name: "WebSocket ready", funct: () => this.webSocketReady() },
        ];
        executeWithRetries(tasks);
    }

    webSocketReady() {
        messageStash.ready = true;
        return true;
    }

}
