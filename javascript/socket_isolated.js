"use strict";

/**
 * The original WebSocket object from MAIN
 * @type {WebSocket}
 */
let WebSocket_MAIN = null;

/**
 * Function to be called from MAIN to pass the WebSocket to the content scripts
 * @param {WebSocket} object
 */
function setWebSocket_MAIN(object) {
    console.assert(WebSocket_MAIN === null,
                   "WebSocket_MAIN should start uninitialized");
    console.assert(object != null, "WebSocket_MAIN should be initialized here");
    WebSocket_MAIN = object;
    console.log("🛜 WebSocket_MAIN set");
}

exportFunction(setWebSocket_MAIN, window, {defineAs: "setWebSocket_MAIN"});
