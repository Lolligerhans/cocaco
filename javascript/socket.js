"use strict";

let allMessages = [];

function reportEvent(event) {
    if (typeof event.data == "string") {
        if (config.logSocketIgnored) {
            console.debug("--- (Ignored message) ---");
        }
        return;
    }
    const message = msgpack.deserialize(event.data);
    if (config.logSocket) {
        allMessages.push({ message: message, dataLength: event.data.byteLength });
        let type = message.data.type ?? -1;
        console.debug(type, "(", event.data.byteLength, ")", message);
    }
    try {
        receive(message);
    } catch (e) {
        // Only give warning because content script might not be loaded yet. If
        // serious we will know.
        console.warn("Failed to recevie message", e);
    }
}

let WebSocket_real = window.WebSocket;
let WebSocket_decorated = function () {
    let webSocket = new WebSocket_real(...arguments);
    webSocket.addEventListener("message", reportEvent);
    console.log("🛜 WebSocket decorated");
    return webSocket;
}
window.WebSocket = WebSocket_decorated;
// TODO: Delete leftover object references
