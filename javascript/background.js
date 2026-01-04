"use strict";

// HACK: Opens browser console
//alert("Open browser console");

// ╭───────────────────────────────────────────────────────────╮
// │ Page action                                               │
// ╰───────────────────────────────────────────────────────────╯

browser.tabs.onUpdated.addListener((tabId) => {
    // Always show page action
    browser.pageAction.show(tabId);
});

browser.pageAction.onClicked.addListener((tab, _onClickData) => {
    // Send to content script (received by 'Connect')
    browser.tabs.sendMessage(tab.id, {
        type: "page_action",
        payload: "onClicked",
    });
});

// ╭───────────────────────────────────────────────────────────────────────────╮
// │ Sending to dump program                                                   │
// ╰───────────────────────────────────────────────────────────────────────────╯

/**
 * We intend for only one native port. Supporting multiple may allow working
 * ports in concurrent tabs.
 * @type {Object[]} Map id -> native port
 */
let nativePorts = {};

function newNativePort(id) {
    let port = browser.runtime.connectNative("cocaco_dump");
    // Native endpoint selects a unique filename based in the id
    port.postMessage(id);
    port.onMessage.addListener(response => {
        console.assert(id.toString() === response.id,
                       "Native port should respond with its id");
        console.debug(`nativePorts[${response.id}]:`,
                      `Ack ${response.ack} / ${contentScriptAck[id]}`);
        const diff = Math.abs(contentScriptAck[id] - response.ack);
        if (diff > 100)
            console.warn(`background.js: nativePorts[${response.id}]`,
                         `out of sync with content-script ${id}`);
    });
    return port;
}

function getNativePort(id) {
    if (!Object.hasOwn(nativePorts, id)) {
        nativePorts[id] = newNativePort(id);
    }
    return nativePorts[id];
}

function dump_message(message, id) {
    // console.debug(`background.js: Dumping to nativePort[${id}]: `, message);
    getNativePort(id).postMessage(message);
}

// ╭───────────────────────────────────────────────────────────────────────────╮
// │ Receiving from content script                                             │
// ╰───────────────────────────────────────────────────────────────────────────╯

let contentScriptPorts = [];

/**
 * Maps IDs to nnumbr of received messages
 * @type {Object.<string, Number>}
 */
let contentScriptAck = {};

let portHandlers = {
    dump: (message, id) => {
        // console.debug(`background.js: portHandler \"dump\" passing for id=${id}`);
        dump_message(message, id);
        ++contentScriptAck[id];
    },
    ack: (_message, id, port) => {
        console.debug(
            `background.js: portHandler ack passing to content-script for id=${
                id}`);
        port.postMessage({
            type: "ack",
            payload: contentScriptAck[id],
        });
    }
};

function connected(port) {
    const number = contentScriptPorts.length;
    console.log(`🛜 🟢 Connecting content-script #${number} as ${
        port.sender.contextId} from tab ${port.sender.tab.id}`);
    contentScriptPorts.push(port);
    // Use contextId for identification
    contentScriptAck[port.sender.contextId] = 0;
    port.onMessage.addListener((message, sender) => {
        portHandlers[message.type](message.payload, sender.sender.contextId,
                                   port);
    });
    port.onDisconnect.addListener((port) => {
        const msg = `🛜 ${
            port.error ? "❌" : "🔴"} Disconnected content-script #${
            number} as ${port.sender.contextId} from tab ${port.sender.tab.id}`;
        (port.error ? console.error : console.log)(msg,
                                                   port.error ?? "(normally)");
    });
}

browser.runtime.onConnect.addListener(connected);
console.log("🛜 Waiting for content-script");
