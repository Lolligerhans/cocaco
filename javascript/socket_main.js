"use strict";

// For logging
if (typeof cocaco_MAIN === "undefined") {
    var cocaco = {receivedCount: 0, sendCount: 0};
}

cocaco.receivedCount = 0;
cocaco.sendCount = 0;

function reportReceive(event) {
    if (typeof event.data == "string") {
        // console.debug("--- (Ignored message) ---");
        return;
    }
    if (typeof receive_MAIN === "undefined") {
        console.warn("Not defined: receive_MAIN");
        console.info("Load Cocaco first. Then start a new tab.");
        return;
    }
    let returnedFrame;
    try {
        returnedFrame = receive_MAIN(event.data);
    } catch (e) {
        // Only give warning because content script might not be loaded yet. If
        // serious we will know.
        console.warn("Switch to content-script failed:", e);
    }
    if (returnedFrame === null) {
        // console.debug(
        //     "socket_main.js: reportReceive():", cocaco.receivedCount++,
        //     "delete:", message,
        // );
        event.stopImmediatePropagation();
        event.preventDefault();
    } else if (typeof returnedFrame === "undefined") {
        // Nothing
    } else {
        // console.debug("socket_main.js: reportReceive: Replacing frame with:",
        //     returnedFrame
        // );
        event.data = returnedFrame;
    }
}

function reportSend(data_raw, reparse, ...rest) {
    console.assert(rest.length === 0);
    let returnedFrame;
    try {
        returnedFrame = send_MAIN(data_raw, reparse);
    } catch (e) {
        console.warn("Switch to content-script failed:", e);
    }
    return returnedFrame;
}

if (typeof cocaco_MAIN === "undefined") {
    let WebSocket_real = window.WebSocket;
    let WebSocket_decorated = function() {
        let webSocket = new WebSocket_real(...arguments);
        webSocket.addEventListener("message", reportReceive);
        let send_real = webSocket.send;
        webSocket.send =
            (data, reparse = {native: true, doReparse: true}, ...rest) => {
                console.assert(rest.length === 0);
                const frame = reportSend(data, reparse);
                // When returning
                //  - undefined:       Regular behaviour
                //  - null:            Delete frame
                //  - frame (assumed): Replace frame
                let res;
                if (frame === null) {
                    // console.debug("socket_main.js: send(): Deleting frame");
                    res = undefined;
                } else if (typeof frame === "undefined") {
                    res = send_real.call(webSocket, data);
                } else {
                    // console.debug("socket_main.js: send(): Replacing frame");
                    // console.debug("frame:", frame, "data:", data);
                    res = send_real.call(webSocket, frame);
                }
                return res;
            };
        console.log("🛜 WebSocket decorated");
        setWebSocket_MAIN(webSocket);
        return webSocket;
    };
    window.WebSocket = WebSocket_decorated;

    var cocaco_MAIN = true;
}
