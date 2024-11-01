"use strict";

if (typeof cocaco_config === "undefined") {
    var cocaco_config;
}

/**
 * A global config. This object is defined first and only in this file, and not
 * written afterwards.
 */
cocaco_config = {

    // Ad-hoc tsest
    resendTestOnClick: false,

    // ── Features ───────────────────────────────────────────────
    // Balance resource income within a group of players by auto-trading.
    // - Challenge: Set autocollude=true in a game with bots, and no manual
    //              trading.
    collude: {
        /**
         * Start the game balancing with everyone. For bot games or private
         * games with installed extension.
         * @type {Boolean}
         */
        autocollude: false,

        /**
         * Trade at most this many resoruces per side. Makes the trades more bot
         * friendly.
         * @type {Number} 1, 2, ...
         */
        maxOfferPerSide: 1,

        /**
         * Chat triggers
         * @type {Object.<string,string>}
         */
        phrases: { start: "hi", stop: "gg" },
    },

    /**
     * @type { "Colonist" | "Colony" }
     */
    pipeline: "Colonist",

    render: {
        /**
         * Toggle between showing resources as table of number or cards
         * @type { "table" | "cards" }
         */
        type: "cards",
    },
    // Print even more stuff in the rolls plot
    extraRollProbabilities: false,
    // Delay for UI updates
    timeout: 1000,
    // Write in/out to files
    dump: { receive: false, send: false },
    // Enable the log element toggle
    enableToggle: true,

    // ── Style ──────────────────────────────────────────────────
    // Do not fetch Colonist assets. For replay/offline/testing.
    ownIcons: false,
    shortWorlds: true,

    // ── Verbose ────────────────────────────────────────────────
    // Enable logging to console
    logConsole: true,
    // Report world count to console
    logWorldCount: false,
    // Report timing ("Colony")
    useTimer: false,
    printRobs: false,
    // Periodically confirm sending sequence number
    printResendSequence: 1,

    // ── Very verbose ───────────────────────────────────────────
    // Enable logging to DOM elements
    logDom: true,
    // Print card tracking state to console
    printWorlds: false,
    /**
     * Logger of individual modules. 'ConsoleLog' ready this for default values.
     * @type {Object.<string,Boolean>}
     */
    log: {
        Collude: false,
        CollusionPlanner: false,
        ColonistTrade: false,
        frameInjection: false,
        Observer: false,
        RenderCards: true,
        Reparse: false,
        Resend: false,
        colony: false,
        main: true,
        trade: false,
        worlds: false,

        // Log unprocessed frames
        receive: false,
        send: false,
    },

    // ── Debug ──────────────────────────────────────────────────
    abort: false,
    echo: false,
    mute: false,
    // Replay predefined set of frames
    replay: false,
    // Milliseconds between replayed frames
    replayInterval: 50,
    largeLog: false,
    doDebug: false,
    runManyWorldsTest: false,
    fixedPlayerName: false,
    playerName: "John#1234",
    parseTypes: false,
    // compareWorlds: false,
};

if (cocaco_config.replay) {
    // Some settings are incompatible with the replay mode. Warn and overwrite.
    if (!(cocaco_config.replayInterval > 0)) {
        console.warn("config.js: Variable replayInterval adjusted for replay");
    }
    if (!(cocaco_config.dump.receive === false)) {
        console.warn("config.js: Variable dump adjusted for replay");
    }
    if (!(cocaco_config.dump.send === false)) {
        console.warn("config.js: Variable dump adjusted for replay");
    }
    if (!(cocaco_config.fixedPlayerName === true)) {
        console.warn("config.js: Variable fixedPlayerName adjusted for replay");
    }
    if (!(cocaco_config.playerName === "John#1234")) {
        console.warn("config.js: Variable playerName adjusted for replay");
    }
    if (!(cocaco_config.logDom === false)) {
        console.warn("config.js: Variable logDom adjusted for replay");
    }
    if (!(cocaco_config.ownIcons === true)) {
        console.warn("config.js: Variable ownIcons adjusted for replay");
    }
    cocaco_config.dump.receive = false;
    cocaco_config.dump.send = false;
    cocaco_config.fixedPlayerName = true;
    cocaco_config.playerName = "John#1234";
    cocaco_config.logDom = false;
    cocaco_config.ownIcons = true;
}

console.dir(cocaco_config);
