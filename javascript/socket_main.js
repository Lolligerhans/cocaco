"use strict";

function reportReceive(event) {
    if (typeof event.data == "string") {
        // console.debug("--- (Ignored message) ---", event);
        return undefined;
    }
    if (typeof receive_MAIN === "undefined") {
        console.warn("Not defined: receive_MAIN");
        console.info("Load Cocaco first. Then start a new tab.");
        return undefined;
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
        event.stopImmediatePropagation();
        event.preventDefault();
    } else if (typeof returnedFrame === "undefined") {
        // Nothing
    } else {
        event.data = returnedFrame;
    }
}

function reportSend(data_raw, reparse, ...rest) {
    console.assert(
        rest.length === 0,
        "WebSocket.send() should regularly be called with a single argument");
    let returnedFrame;
    try {
        returnedFrame = send_MAIN(data_raw, reparse);
    } catch (e) {
        console.warn("Switch to content-script failed:", e);
    }
    return returnedFrame;
}

if (cocaco_mutex) {
    console.warn("🛜 Found cocaco. Not replacing socket.");
} else {
    var cocaco_mutex = true;
    let WebSocketProxy = new Proxy(window.WebSocket, {
        construct: function(target, args) {
            console.log("🛜 New Proxy WebSocket");
            let webSocket = new target(...args);
            webSocket.addEventListener("message", reportReceive);
            let sendProxy = new Proxy(webSocket.send, {
                apply: function(target, thisArg, args) {
                    console.assert(1 <= args.length && args.length <= 2);
                    let data = args[0];
                    let reparse = args[1] ?? {native: true, doReparse: true};
                    let frame = reportSend(data, reparse);

                    let res;
                    if (frame === null) {
                        res = undefined;
                    } else if (typeof frame === "undefined") {
                        res = target.apply(thisArg, [data]);
                    } else {
                        res = target.apply(thisArg, [frame]);
                    }
                    return res;
                }
            });
            webSocket.send = sendProxy;
            setWebSocket_MAIN(webSocket);

            return webSocket;
        }
    });
    window.WebSocket = WebSocketProxy;
}
