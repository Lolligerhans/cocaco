"use strict";

let config = {

    // Features
    pipeline: "Colonist", // "Colonist", "Colony"
    extraRollProbabilities: false,
    timeout: 1000,
    dump: false,

    // Style
    ownIcons: false,
    shortWorlds: true,

    // Verbose
    logMessages: false,
    logWorldCount: false,
    useTimer: false,
    printRobs: false,

    // Very verbose
    debugMessages: false,
    printWorlds: false,

    // Debug
    logSocket: false,
    logSocketIgnored: false,
    largeLog: false,
    doDebug: false,
    runManyWorldsTest: false,
    fixedPlayerName: false,
    playerName: "John#1234",
    parseTypes: false,
    // compareWorlds: false,
};

console.table(config);
