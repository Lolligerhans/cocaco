"use strict";

if (typeof cocaco_config === "undefined") {
    var cocaco_config;
}

cocaco_config = {

    // ── Features ───────────────────────────────────────────────
    autocollude: false,
    pipeline: "Colony", // "Colonist", "Colony"
    // Print even more stuff in the rolls plot
    extraRollProbabilities: false,
    // Delay for updates in "Colony" pipeline
    timeout: 1000,
    // Write in/out to files
    dump: { receive: false, send: false },
    // Enable the log element toggle
    enableToggle: true,
    // Ad-hoc tsest
    test: false,
    tradeTest: false,
    resendTest: false,

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
    // Logger of individual modules
    log: {
        collude: true,
        colony: false,
        main: true,
    },

    // ── Debug ──────────────────────────────────────────────────
    abort: false,
    echo: false,
    mute: false,
    // Replay predefined set of frames
    replay: false,
    // Milliseconds between replayed frames
    replayInterval: 50,
    logObservations: true,
    logReceive: true,
    logSend: true,
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

console.table(cocaco_config);
