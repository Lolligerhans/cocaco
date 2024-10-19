"use strict";

let WebSocket_MAIN = null;
function setWebSocket_MAIN(object) {
    console.assert(
        WebSocket_MAIN === null,
        "Objects should start uninitialized",
    );
    console.assert(object != null);
    WebSocket_MAIN = object;
    console.log("🛜 WebSocket_MAIN imported");
}

exportFunction(setWebSocket_MAIN, window, { defineAs: "setWebSocket_MAIN" });
