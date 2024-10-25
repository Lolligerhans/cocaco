// Extension entry point.
//
// - Config
// - Globals
// - Helpers
//
// Dispatches into host specific main.

"use strict";

const theBrowser = typeof chrome !== "undefined" ? chrome : browser;
const version_string = theBrowser.runtime.getManifest().version;

let stats = new Statistics({}, {});

const bgIcon = document.createElement("img");
bgIcon.src = theBrowser.runtime.getURL("assets/coconut_512.png");
bgIcon.id = "background-icon";
setInterval(() => {
    let e = document.body;
    if (e)
        document.body.prepend(bgIcon);
}, 3000);


let e = document.getElementById("header_navigation_store");
if (e !== null)
    e.textContent = "(🥥 Cocaco " + version_string + ")";
e = document.querySelector(".betaTag")
if (e !== null)
    e.textContent = "🥥 Cocaco " + version_string;

// The text symbols are for outputting only ;)
// TODO Not sure if we have to keep resources separately. Check if we can merge
//      with resourcesAsUtf8 below.
const resourceIcons =
{
    wood: "🪵",
    brick: "🧱",
    sheep: "🐑",
    wheat: "🌾",
    ore: "🪨",
    cloth: "🧶",
    coin: "🪙",
    paper: "📜",
    unknown: "🂠",
};
// TODO rename to "utf"
const utf8Symbols =
{
    "2": "②",
    "3": "③",
    "4": "④",
    "5": "⑤",
    "6": "⑥",
    "7": "⑦",
    "8": "⑧",
    "9": "⑨",
    "10": "⑩",
    "11": "⑪",
    "12": "⑫",
    "settlement": "🛖",
    "city": "🏢",
    "road": "🛣", // Lane symbols: ⛙ ⛜
    "devcard": "🃏",
    "ship": "⛵",
    progress: "🃟",
    cityWall: "⛩️",
    discard: "🗑",
    trade: "↔️",
    build: "👷",
    buy: "🛒",
    activate: "🔘",
    free: "🆓",
    bank: "🏦",
    monopoly: "📈",
    discount: "％",
    diplomat: "🤝",
    known: "👀",
    steal: "🥷",
    merchant: "™️",
    wedding: "💒",
    spy: "🕵",
    robber: "🥖", // French club
    pirate: "☠️",
    roadBuilder: "🚧",
    deserter: "🏜",
    knight: "♞",
    smith: "🔥",
    upgrade: "🆙",
    aqueduct: "💧",
    crane: "🏗",
    harbor: "⚓",
    move: "🧳",
    win: "🎉",
    vp: "⭐",
    yop: "🎁",
};

// @param resources: { wood: 3, wheat: 2, ... }
function resourcesAsUtf8(resources) {
    let s = "";
    for (const entry of Object.entries(resources)) {
        if (entry[1] === 0) {
            continue;
        }
        const icons = resourceIcons[entry[0]].repeat(Math.abs(entry[1]));
        if (entry[1] < 0) {
            s += "(" + icons + ")";
        } else {
            s += icons;
        }
        s += " ";
    }
    return s.trim();
}

const alternativeAssets = {
    // Missing assets for non-base game modes.
    // Alternatives at 408f1c219dc04fb8746541fed624e6d4026aaaac
    wood:       `<img alt="wood" src="${theBrowser.runtime.getURL("assets/wood31.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    brick:      `<img alt="brick" src="${theBrowser.runtime.getURL("assets/brick24.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    sheep:      `<img alt="sheep" src="${theBrowser.runtime.getURL("assets/sheep1.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    wheat:      `<img alt="wheat" src="${theBrowser.runtime.getURL("assets/wheat2.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    ore:        `<img alt="ore" src="${theBrowser.runtime.getURL("assets/ore27.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    cloth:      `<img alt="cloth" src="${theBrowser.runtime.getURL("assets/coconut_32.png")}" class="cocaco-tbl-resource-icon"/>`,
    coin:       `<img alt="coin" src="${theBrowser.runtime.getURL("assets/coconut_32.png")}" class="cocaco-tbl-resource-icon"/>`,
    paper:      `<img alt="paper" src="${theBrowser.runtime.getURL("assets/coconut_32.png")}" class="cocaco-tbl-resource-icon"/>`,
    unknown:    `<img alt="unknown" src="${theBrowser.runtime.getURL("assets/coconut_32.png")}" class="cocaco-tbl-resource-icon"/>`,
    ship:       `<img alt="ship" src="${theBrowser.runtime.getURL("assets/coconut_32.png")}" class="cocaco-tbl-resource-icon"/>`,
    road:       `<img alt="road" src="${theBrowser.runtime.getURL("assets/street10.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    settlement: `<img alt="settlement" src="${theBrowser.runtime.getURL("assets/settle7.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    devcard:    `<img alt="devcard" src="${theBrowser.runtime.getURL("assets/dev4.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    city:       `<img alt="city" src="${theBrowser.runtime.getURL("assets/city23.jpg")}" class="cocaco-tbl-resource-icon"/>`
};

// Interpolate red-green over yellow
// @param {number} zeroToOne: within [0, 1]
function colourInterpolate(zeroToOne)
{
    const r = Math.ceil(255 * Math.cos(Math.PI * zeroToOne / 2));
    const g = Math.ceil(255 * Math.sin(Math.PI * zeroToOne / 2));
    return `rgb(${(255+r)/2}, ${(255+g)/2}, 128)`;
}

// fac(20) < 2^64 < fac(21)
let facArray = [];
function fac(x)
{
    if (x < 2) return 1;
    if (facArray[x] > 0) return facArray[x];    // (undefined > 0) === false
    return facArray[x] = x * fac(x - 1);
}

function choose(n, k)
{
    return fac(n) / (fac(k) * fac(n-k));
}

function klDivergence(p, q)
// Compute KL-Divergence between expected and actual rolls
{
  const kl = p
    .map((x, i) => x === 0 ? 0 : (x * Math.log(x / q[i])))
    .reduce((a, b) => a + b, 0);
  return kl;
}

// Probability to roll each number. Starting with nubmer 2 at index 0.
const trueProbability = [1,2,3,4,5,6,5,4,3,2,1].map(x => x / 36);

// Replacement for setInterval, but time interval starts after completion of the
// 'repeat' function (not independently in time). To continue program flow,
// a callback 'then' is supplied that is invoked once, after 'repeat' returns
// true for the first time (indicating that the task is done). Unlike
// setInterval, there is no wait time at the start.
//
// We use this to do wait for tasks that require that the user updates the
// document in some way.
//
// Example waiting for 5 dashes each time:
//
//                   ✖       ✖                 ✖        ✔
//   ------|<========>-----<=>-----<===========>-----<==>|<===>
//
//         ↑          |---|   |---|             |---|     ↑
//      first         wait    wait              wait     then
//
const isDone = { yes: true, no: false };
function setDoInterval(repeat, time, then = null)
{
    if ( repeat() )
    {
        //console.debug("◦ ending setDoInterval of", repeat.name);
        // Quit if successfull
        if (then !== null)
            then(); // We could consider passing the final, truthy output of
                    // repeat() as argument to then().
        return;
    }
    //console.debug("⏱ waiting before continuing setDoInterval of", repeat.name);
    setTimeout
    (
        setDoInterval, time, // func, timer
        repeat, time, then // args
    );
}

// Runs each job in order. Each job is repeated after an interval until
// returning true. Uses setDoInterval to run jobs immediately one after anohter.
// tasks = [ <...jobs> ]
// job = { funct: function, done: false, name: "My Name"}
// Properties "done" and "name" are optional.
// PERF: Iterates n^2 for n jobs
function executeWithRetries(tasks, retryTime = 3000)
{
    for (let i = 0; i < tasks.length; ++i)
    {
        let task = tasks[i];
        if (!Object.hasOwn(task, "done")) {
            task.done = false;
        }
        if (task.done) {
            continue;
        }
        console.log(
            `🧭 ( ${i} ) executeWithRetries:`,
            task.name ?? task.funct.name
        );
        // Assume we will succeed and remember for when we come back
        task.done = true;
        setDoInterval(
            task.funct,
            retryTime,
            // Recurse
            executeWithRetries.bind(null, tasks),
        );
        // The program flow continues in the setDoInterval()
        return;
    }
    console.log("🧭 ( ✅ ) executeWithRetries completed");
}

function removeEntry(arr, index){
    arr[index] = arr[arr.length - 1];
    arr.pop();
}

function clamp(x, minimum, maximum) {
    const ret = Math.min(Math.max(x, minimum), maximum);
    return ret;
}

function resize(element, w = 1000, h = 800)
{
    console.log("resizing", element, w, h);
    element.style.width = `${w}px`;
    element.style.height = `${h}px`;
}
const enlarge = (e) => resize(e);
const setHidden = (flag, ...rest) =>
{
    if (flag === true)
        hide(...rest);
    else
        unhide(...rest);
};
const hide = (...rest) => rest.forEach(e => {
    if (e) e.classList.add("hidden");
});
const unhide = (...rest) => rest.forEach(e => {
    if (e) e.classList.remove("hidden")
});

function log(...args)
{
    console.log(...args);
}
function logs(...args)
{
    log(...args.map( x => JSON.stringify(x) ));
}
function log2(...args)
{
    log(...args);
    logs(...args);
}

// HACK: NOt sure if this works but good enough to sanity check in testing
function badEquals(x, y) {
    if (!x || !y) {
        return x === y;
    }
    if (typeof x === "string") {
        return x === y;
    }
    if (typeof x === "number") {
        return x === y;
    }
    if (typeof x === "object") {
        const xKeys = Object.keys(x);
        if (xKeys.length !== Object.keys(y).length) {
            return false;
        }
        for (const k of xKeys) {
            if (!badEquals(x[k], y[k])) {
                return false;
            }
        }
        return true;
    }
    return JSON.stringify(x) === JSON.stringify(y);
}

function hasOneOf(obj, property, values) {
    if (!Object.hasOwn(obj, property)) {
        return false;
    }
    if (!Array.isArray(values)) {
        values = [values];
    }
    const search = obj[property];
    const ret = values.includes(search);
    return ret;
}

const wood = "wood";
const ore = "ore";
const wheat = "wheat";
const brick = "brick";
const sheep = "sheep";
const resourceTypes = [wood, brick, sheep, wheat, ore];

function rotateToLastPosition(array, value)
{
    const pos = array.indexOf(value);
    if (pos < 0) {
        // Expected when spectating
        console.warn("Could not rotate to last position:",
            value,
            "not found in",
            array
        );
        return array;
    }
    const rotation = array.length - pos - 1;
    const unrotatedCopy = deepCopy(array);
    for (let i = 0; i < array.length; ++i)
        array[(i + rotation) % array.length] = unrotatedCopy[i];
    return array;
}

function deepCopy(object)
{
    // TODO Is there a good canonical method? We use this in some inner loops.
    return JSON.parse(JSON.stringify(object));
}

function alertIf(message)
{
    console.error("alert(", message, ")");
    if (cocaco_config.doDebug)
    {
        alert(message);
        debugger;
    }
}


const predicates =
{
    "<":
    {
        "f": (x) => { return (y) => y < x; },
        "name": (x) => `< ${x}`,
    },
    ">":
    {
        "f": (x) => { return (y) => y > x; },
        "name": (x) => `> ${x}`,
    },
    "!":
    {
        "f": (x) => { return (y) => y != x; },
        "name": (x) => `!= ${x}`,
    }
}

function verifyPlayers(players_array, p1 = null, p2 = null)
{
    if (p1 === null && p2 === null)
    {
        console.error(`${verifyPlayers.name}: Must specify at least one player`);
        debugger;
        return false;
    }
    for (const p of [p1, p2])
    {
        if (p === null) continue;
        if (!players_array.includes(p))
        {
            console.error(`${verifyPlayers.name}: {Unknown player: ${p}, valid players: ${players_array}`);
            return false;
        }
    }
    return true;
}

function collectionToArray(collection) {
    // FIXME consider [...dings] or array.from
    return Array.prototype.slice.call(collection);
}


function allTests()
{
    console.warn("skipping old test");
    //worldTest();
    //console.info("● [🌎] ManyWorlds old test done (starts debugger when failing)");
    let tmp = new ManyWorlds();
    tmp.worldTest();
    console.info("● [🌎] ManyWorlds new test over (starts debugger when failing)");

    //console.info("● [🌎] Both tests done. Exiting.");
    return
}

function main()
{
    if (cocaco_config.runManyWorldsTest === true)
    {
        allTests();
        return
    }

    if (cocaco_config.replay)
    {
        console.log("🥥 Running replay");
        new Colonist().start();
        return;
    }

    if (window.location.hostname === "colonist.io")
    {
        if (cocaco_config.pipeline === "Colonist") {
            console.log("🥥 Running Colonist on colonist.io");

            let colonist = new Colonist();
            colonist.start();
        } else {
            console.assert(cocaco_config.pipeline === "Colony",
                "Only valid pipelines")
            console.log("🥥 Running Colony on colonist.io");
            let colony = new Colony();
            colony.restartTracker();
        }
    }
    else if (window.location.hostname === "twosheep.io")
    {
        console.log("🥥 Running twosheep on twosheep.io");
        console.assert(window.location.hostname === "twosheep.io");
        twosheep.restartTracker();
    }
    else
    {
        console.assert(false, "Should only run on a Catan website");
    }
}

// ╭───────────────────────────────────────────────────────────────────────────╮
// │ Message passing                                                           │
// ╰───────────────────────────────────────────────────────────────────────────╯

// TODO: Allow re-trying to connect later on, by putting this stuff in a class

let handledCount = 0;
let ackTime = Date.now();

let portToBackground = theBrowser.runtime.connect( { name: "dump-port" });
// console.debug("cocaco.js: Connected:", portToBackground);
portToBackground.onDisconnect.addListener(() => {
    console.log("cocaco.js: Disconnected from background script");
    // console.error("Port closed. Game still running?");
});
portToBackground.onMessage.addListener((message) => {
    console.assert(message.type, "Sanity check");
    console.assert(message.type === "ack", "Only ack messages should go this direction");
    console.debug(`Background: Ack ${message.payload} / ${handledCount}`);
    if (Math.abs(handledCount - message.payload) > 100) // Arbitrary value
        cosole.warn("cocaco.js: Background out of sync");
});
console.log("🛜 cocaco.js: Prepared background port")

function acknowledge() {
    // Send ack message every now and then for debugging
    // console.debug("cocaco.js acknowledge(): ", handledCount, ackTime);
    ++handledCount;
    const now = Date.now();
    if (now < ackTime)
        return;
    portToBackground.postMessage({
        type: "ack",
        payload: handledCount,
    });
    ackTime = now + 120 * 1000;
}

let doDump = cocaco_config.dump;
function dumpEvent(event) {
    if (doDump[event.direction]) try {
        portToBackground.postMessage({ type: "dump", payload: event.frame });
        acknowledge();
    } catch (e) {
        console.error("Dump", event.direction, "failed:", e);
        console.warn("Dump", event.direction, "off");
        doDump[event.direction] = false;
    }
}

function dispatch(event) {
    dumpEvent(event);
    if (event.reparse.doReparse === false) {
        console.log("cocaco.js: dispatch(): Skip reparsing opaque event");
        return undefined;
    }
    try {
        let ret = Reparse.applyAll(
            event.direction,
            event.frame,
            event.reparse,
        );
        return ret;
    } catch (e) {
        console.error("Error reparsing", event.direction, "frame:", event.frame, e);
    }
}

let socketsReady = false;
let incoming = new FrameQueue();
let outgoing = new FrameQueue(); // Reactions of the extension

function handle(event = null) {
    // Allow calling explicitly in main, without event, to get starting
    if (event !== null) {
        incoming.add(event);
    }
    if (socketsReady === false) {
        // HACK: This way we can not react to the events before being ready.
        // TODO: Add an index to every event. Save the return value for each
        //       index. Query the reparser return from MAIN.
        return undefined;
    }

    // When a received frame event occurs while an outgoing event is stalled
    // (e.g. by the debugger).
    if (incoming.isOccupied()) {
        return;
    }

    incoming.occupy();
    let ret;
    while(!incoming.isEmpty()) {
        const event = incoming.take();
        ret = dispatch(event);
    }
    incoming.leave();
    return ret;
}

function post_handle() {
    if (outgoing.isOccupied()) {
        // The occupying (recursing) invocation will take care of the rest
        console.debug("cocaco.js: post_handle(): Backing out - already handling");
        return;
    }
    outgoing.occupy();
    while (!outgoing.isEmpty()) {
        const event = outgoing.take();
        console.debug("[!] Outgoing event injection:", event);
        switch (event.direction) {
            case "receive":
                console.assert(false, "Not implemented");
                break;
            case "send":
                event.reparseOptions.adjustSequence(event.frame);
                const encodedFrame = cocaco_encode_send(event.frame);
                if (cocaco_config.replay === true) {
                    console.warn("Dropping outgoing frame during replay");
                    break;
                }
                WebSocket_MAIN.wrappedJSObject.send(
                    cloneInto(encodedFrame, window),
                    event.reparseOptions,
                );
                break;
            default:
                console.assert(false, "Invalid direction");
                break;
        }
        console.debug("[!] Outgoing event done:", event);
    }
    outgoing.leave();
}

function post_MAIN() {
    // Queue handling of the outgoing events in the next event cycle. It should
    // be called whenever new events are added to the outgoing queue. Together
    // with the outgoing frame queue, this ensures that inected frames are kept
    // out of the current event loop. Calling WebSocket.send() in a nested call
    // would trip up the host.
    setTimeout(post_handle, 0);
}

// Append-only stash for logging
let receivedMessages = [];
let sentMessages = [];

function receive_MAIN(
    encodedFrame,
    reparse = { doReparse: true, native: true },
) {
    let ret;
    try {
        const frame = cocaco_decode_receive(new Uint8Array(encodedFrame));
        if (cocaco_config.logReceive) {
            receivedMessages.push({ frame: frame, dataLength: encodedFrame.byteLength });
            let type = frame.data.type ?? -1;
            console.debug("🛜 📥", receivedMessages.length, "|",
                type, "(", encodedFrame.byteLength, ")", frame);
            if (receivedMessages.length % 10 === 0) {
                console.debug("(receivedMessages):", receivedMessages);
            }
        }
        ret = handle(
            { direction: "receive", frame: frame, reparse: reparse },
        );
    } catch (e) {
        console.error("receive_MAIN(): Failed with error:", e);
    }
    return cloneInto(ret, window);
}

function send_MAIN(encodedFrame, reparse) {
    let ret;
    try {
        const frame = cocaco_decode_send(new Uint8Array(encodedFrame));
        if (cocaco_config.logSend) {
            sentMessages.push({
                encoded: encodedFrame,
                frame: frame,
                length: encodedFrame.byteLength,
            });
            let sequence = "seq=🗙";
            if (frame.message && frame.message.sequence) {
                sequence = `seq=${frame.message.sequence}`;
            }
            let action = "action=🗙";
            if (frame.message && frame.message.action) {
                action = "action=" +
                    (ColonistSource.actionMap[frame.message.action] ?? "?");
            }
            let visibility = "";
            if (reparse.native === false) {
                visibility = reparse.doReparse ? "🔔" : "🔕";
            }
            console.debug(
                "🛜 📤", sentMessages.length, `${visibility} |`,
                sequence, action, "|",
                frame.v0, frame.v1, `(${encodedFrame.byteLength}B)`,
                frame.message, frame, encodedFrame,
            );
            // console.debug("raw:", JSON.stringify(frame));
            if (sentMessages.length % 10 === 0) {
                console.debug("(all sentMessages):", sentMessages);
            }
        }
        ret = handle(
            { direction: "send", frame: frame, reparse: reparse },
        );
    } catch (e) {
        console.error("send_MAIN(): Failed with error:", e);
    }
    return cloneInto(ret, window);
}

exportFunction(post_MAIN, window, { defineAs: "post_MAIN" });
exportFunction(receive_MAIN, window, { defineAs: "receive_MAIN" });
exportFunction(send_MAIN, window, { defineAs: "send_MAIN" });

main();
