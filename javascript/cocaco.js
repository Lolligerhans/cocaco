"use strict";

// Extension entry point. Dispatches into host specific main.

const theBrowser = typeof chrome !== "undefined" ? chrome : browser;
const version_string = theBrowser.runtime.getManifest().version;

let stats = new Statistics({}, {});

const backgroundIcon = document.createElement("img");
backgroundIcon.src = theBrowser.runtime.getURL("assets/coconut_512.png");
backgroundIcon.id = "background-icon";
setTimeout(() => {
    let e = document.body;
    if (e)
        document.body.prepend(backgroundIcon);
}, 5000);

/**
 * Overwrite-else-create HTML element as visual confirmation. Does not do
 * anything functional. May fail silently.
 * @param {String} username Username to show within the info element
 */
function show_version(username = "(Unknown)") {
    const className = "cocaco-version";
    let e = document.querySelector('.web-header-login-button');
    if (e === null)
        return;
    let versionElement =
        document.querySelector(`.${className}`) ??
        e.parentElement.appendChild(document.createElement('div'));
    versionElement.className = className;
    versionElement.textContent = `Cocaco ${version_string} 🥥 ${username}`;
}

show_version();

const alternativeAssets = {
    // Missing assets for non-base game modes.
    // Alternatives at 408f1c219dc04fb8746541fed624e6d4026aaaac
    // clang-format off
    wood: `<img alt="wood" src="${theBrowser.runtime.getURL("assets/wood31.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    brick: `<img alt="brick" src="${theBrowser.runtime.getURL("assets/brick24.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    sheep: `<img alt="sheep" src="${theBrowser.runtime.getURL("assets/sheep1.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    wheat: `<img alt="wheat" src="${theBrowser.runtime.getURL("assets/wheat2.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    ore: `<img alt="ore" src="${theBrowser.runtime.getURL("assets/ore27.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    cloth: `<img alt="cloth" src="${theBrowser.runtime.getURL("assets/coconut_32.png")}" class="cocaco-tbl-resource-icon"/>`,
    coin: `<img alt="coin" src="${theBrowser.runtime.getURL("assets/coconut_32.png")}" class="cocaco-tbl-resource-icon"/>`,
    paper: `<img alt="paper" src="${theBrowser.runtime.getURL("assets/coconut_32.png")}" class="cocaco-tbl-resource-icon"/>`,
    unknown: `<img alt="unknown" src="${theBrowser.runtime.getURL("assets/coconut_32.png")}" class="cocaco-tbl-resource-icon"/>`,
    ship: `<img alt="ship" src="${theBrowser.runtime.getURL("assets/coconut_32.png")}" class="cocaco-tbl-resource-icon"/>`,
    road: `<img alt="road" src="${theBrowser.runtime.getURL("assets/street10.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    settlement: `<img alt="settlement" src="${theBrowser.runtime.getURL("assets/settle7.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    devcard: `<img alt="devcard" src="${theBrowser.runtime.getURL("assets/dev4.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    city: `<img alt="city" src="${theBrowser.runtime.getURL("assets/city23.jpg")}" class="cocaco-tbl-resource-icon"/>`
    // clang-format on
};

/**
 * Interpolate red-yellow-green
 * @param {Number} zeroToOne A number from 0 to 1
 * @return {string} Colour string "rgb(...)"
 */
function colourInterpolate(zeroToOne) {
    console.assert(
        // Warn about invalid inputs even though we correct them. We do not mean
        // to input invalid numbers.
        0 <= zeroToOne && zeroToOne <= 1,
        `Interpolation factor should be between 0 and 1, is ${zeroToOne}`);
    // Clamp to hedge against inaccurate floats
    zeroToOne = clampProbability(zeroToOne);
    if (zeroToOne < 0.5) {
        const green = Math.trunc(255 * (zeroToOne * 2));
        return `rgb(255, ${green}, 0)`;
    } else {
        // Use #80ff00 as most-green value. On the yes-no spectrum this colour
        // already looks like a "yes". The remaining range to #00ff00 only looks
        // like different alternatives that could all mean "yes".
        const red = Math.trunc(255 - 128 * (zeroToOne * 2 - 1));
        return `rgb(${red}, 255, 0)`;
    }
}

let facTorialArray = [];

function factorial(x) {
    // We just hope that we do not overflow
    if (x < 2)
        return 1;
    if (facTorialArray[x] > 0)
        return facTorialArray[x]; // (undefined > 0) === false
    return facTorialArray[x] = x * factorial(x - 1);
}

/**
 * Compute n-choose-k
 * @param {Number} n
 * @param {Number} k
 */
function choose(n, k) {
    return factorial(n) / (factorial(k) * factorial(n - k));
}

/**
 * For computing KL-Divergence between expected and actual rolls
 * @param {number[]} p
 * Categorical distribution represented by array of probabilities
 * @param {number[]} q
 * Categorical distribution represented by array of probabilities
 */
function klDivergence(p, q) {
    const kl = p.map((x, i) => x === 0 ? 0 : (x * Math.log(x / q[i])))
                   .reduce((a, b) => a + b, 0);
    return kl;
}

/**
 * Probability to roll each number. Starting with number 2 at index 0.
 * @type {number[]}
 */
const trueProbability = [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1].map(x => x / 36);

/**
 * Replacement for setInterval, but the time interval starts after completion of
 * the 'repeat' function (not independently in time). To continue program flow,
 * a callback 'then' is invoked once, after 'repeat' returns true for the first
 * time (indicating that the task is done). Unlike setInterval, there is no wait
 * time at the start.
 *
 * We can use this to wait for tasks that require the website to update before
 * being able to complete.
 *
 * Example waiting for 5 dashes each time:
 *
 *                   ✖       ✖                 ✖        ✔
 *   ------|<========>-----<=>-----<===========>-----<==>|<===>
 *
 *         ↑          |---|   |---|             |---|     ↑
 *      first         wait    wait              wait     then
 *
 * @param {function():bool} repeat
 * Function to call repeatedly, until it returns true
 * @param {Number} time Timeout duration in milliseconds
 * @param {function():void} then
 * Function to be called to continue after 'repeat' completes by returning true
 */
function setDoInterval(repeat, time, then = null) {
    if (repeat()) {
        //console.debug("◦ ending setDoInterval of", repeat.name);
        // Quit if successful
        if (then !== null) {
            // We could consider passing the final, truthy output of
            // repeat() as argument to then().
            then();
        }
        return;
    }
    //console.debug("⏱ waiting before continuing setDoInterval of", repeat.name);
    setTimeout(
        setDoInterval, time, // Callback, time
        repeat, time, then   // Arguments to be used for callback
    );
}

/**
 * @typedef {Object} Task
 * @property {function():boolean} funct Function to be run for the task
 * @property {string} [name] Name of the task
 * @property {boolean} [done] Flag indicating completion of the task
 */

/**
 * Runs each job in order. Each job is repeated after an interval until
 * returning true. Uses setDoInterval to run jobs immediately one after another.
 *
 * This function is used to define the high level program flow for some
 * pipelines.
 *
 * PERF: Iterates n^2 for n jobs
 *
 * @param {Task[]} tasks Task to be completed in order
 * @param {number} [retryTime=3000] Time between retries in milliseconds
 */
function executeWithRetries(tasks, retryTime = 3000) {
    for (let i = 0; i < tasks.length; ++i) {
        let task = tasks[i];
        if (!Object.hasOwn(task, "done")) {
            task.done = false;
        }
        if (task.done) {
            continue;
        }
        console.log(`🧭 ( ${i} ) executeWithRetries:`,
                    task.name ?? task.funct.name);
        // Assume we will succeed and remember for when we come back
        task.done = true;
        setDoInterval(task.funct, retryTime,
                      // Recurse
                      executeWithRetries.bind(null, tasks));
        // The program flow continues in the setDoInterval()
        return;
    }
    console.log("🧭 ( ✅ ) executeWithRetries completed");
}

function clamp(x, minimum, maximum) {
    const ret = Math.min(Math.max(x, minimum), maximum);
    return ret;
}

/**
 * Clamp x into the range allowed for probabilities.
 * @param {Number} x
 * @return {Number} Input clamped into inclusive interval [0,1]
 */
function clampProbability(x) {
    // TODO: Use this to replace the duplicate clampProb
    return clamp(x, 0, 1);
}

function resize(element, w = 1000, h = 800) {
    console.log("resizing", element, w, h);
    element.style.width = `${w}px`;
    element.style.height = `${h}px`;
}

const enlarge = (e) => resize(e);
const setHidden = (flag, ...rest) => {
    if (flag === true)
        hide(...rest);
    else
        unhide(...rest);
};
const hide = (...rest) => rest.forEach(e => {
    if (e)
        e.classList.add("cocaco-hidden");
});
const unhide = (...rest) => rest.forEach(e => {
    if (e)
        e.classList.remove("cocaco-hidden")
});

function log(...args) {
    console.log(...args);
}

function logs(...args) {
    log(...args.map(x => JSON.stringify(x)));
}

function log2(...args) {
    log(...args);
    logs(...args);
}

// HACK: Not sure if this works but good enough to sanity check in testing
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

/**
 * Test if obj.property is (one of) the provided value(s). The values in
 * question are compared by 'Array.includes()'.
 * @param {Object} obj
 * @param {string} property Name of the property to check
 * @param {* | *[]} values
 * If not an Array, an array with only one element is constructed from 'value'
 */
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

// TODO: Do we still use these anywhere?
const wood = "wood";
const ore = "ore";
const wheat = "wheat";
const brick = "brick";
const sheep = "sheep";
const resourceTypes = [wood, brick, sheep, wheat, ore];

/**
 * Rotates 'array' in-place such that the first value equal to 'value' is in
 * last position.
 * @param {*[]} array The array to rotate
 * @param {*} value Value to rotate to last position
 */
function rotateToLastPosition(array, value) {
    const pos = array.indexOf(value);
    if (pos < 0) {
        // Expected when spectating
        console.warn("Could not rotate to last position:", value,
                     "not found in", array);
        return array;
    }
    const rotation = array.length - pos - 1;
    const unrotatedCopy = deepCopy(array);
    for (let i = 0; i < array.length; ++i)
        array[(i + rotation) % array.length] = unrotatedCopy[i];
    return array;
}

/**
 * Naive deep copy by JSON serialize-deserialise.
 *
 * TODO: Check if our use case is better served with structuredClone.
 */
function deepCopy(object) {
    return JSON.parse(JSON.stringify(object));
}

/**
 * Helper function to fail loudly
 */
function alertIf(message) {
    console.error("alert(", message, ")");
    if (cocaco_config.doDebug) {
        alert(message);
        debugger;
    }
}

/**
 * Predefined predicates to be used for resource-guessing
 */
const predicates = {
    "<": {
        "f": (x) => { return (y) => y < x; },
        "name": (x) => `< ${x}`,
    },
    ">": {
        "f": (x) => { return (y) => y > x; },
        "name": (x) => `> ${x}`,
    },
    ">=": {
        "f": (x) => { return (y) => y >= x; },
        "name": (x) => `>= ${x}`,
    },
    "<=": {
        "f": (x) => { return (y) => y <= x; },
        "name": (x) => `<= ${x}`,
    },
    "!": {
        "f": (x) => { return (y) => y != x; },
        "name": (x) => `!= ${x}`,
    },
};

/**
 * Helper. This does not really live happily here. Probably should move.
 */
function verifyPlayers(players_array, p1 = null, p2 = null) {
    if (p1 === null && p2 === null) {
        console.error(
            `${verifyPlayers.name}: Must specify at least one player`);
        debugger;
        return false;
    }
    for (const p of [p1, p2]) {
        if (p === null)
            continue;
        if (!players_array.includes(p)) {
            console.error(`${verifyPlayers.name}: {Unknown player: ${
                p}, valid players: ${players_array}`);
            return false;
        }
    }
    return true;
}

/**
 * Used to convert the message log message from HTML collection to array. Not
 * sure how inefficient this procedure really is.
 */
function collectionToArray(collection) {
    // FIXME consider [...dings] or array.from
    return Array.prototype.slice.call(collection);
}

function allTests() {
    // This test was never good but I think by now it is broken, too.
    console.warn("skipping old test");
    //worldTest();
    //console.info("● [🌎] ManyWorlds old test done (starts debugger when failing)");
    let tmp = new ManyWorlds();
    tmp.worldTest();
    console.info(
        "● [🌎] ManyWorlds new test over (starts debugger when failing)");

    //console.info("● [🌎] Both tests done. Exiting.");
    return
}

/**
 * Dispatch to the appropriate pipeline entry point depending on configuration
 * and host website.
 */
function main() {
    if (cocaco_config.runManyWorldsTest === true) {
        allTests();
        return
    }

    if (cocaco_config.replay) {
        console.log("🥥 Running replay");
        new Colonist().start();
        return;
    }

    if (window.location.hostname === "colonist.io") {
        console.assert(cocaco_config.pipeline === "Colonist",
                       "Deprecated other pipeline");
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
    } else if (window.location.hostname === "twosheep.io") {
        // Twosheep broke long ago and we never bothered to bring it back. Could
        // be resurrected relatively easily.
        console.log("🥥 Running twosheep on twosheep.io");
        console.assert(window.location.hostname === "twosheep.io");
        twosheep.restartTracker();
    } else {
        console.assert(false, "Should only run on a Catan website");
    }
}

// ╭───────────────────────────────────────────────────────────────────────────╮
// │ Message passing                                                           │
// ╰───────────────────────────────────────────────────────────────────────────╯

// TODO: Allow re-trying to connect later on, by putting this stuff in a class

let handledCount = 0;
let ackTime = Date.now();

let portToBackground = theBrowser.runtime.connect({name: "dump-port"});
// console.debug("cocaco.js: Connected:", portToBackground);
portToBackground.onDisconnect.addListener(() => {
    console.log("cocaco.js: Disconnected from background script");
    // console.error("Port closed. Game still running?");
});
portToBackground.onMessage.addListener((message) => {
    console.assert(message.type, "Sanity check");
    console.assert(message.type === "ack",
                   "Only ack messages should go this direction");
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
    if (doDump[event.direction])
        try {
            portToBackground.postMessage({type: "dump", payload: event.frame});
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
        // console.log("cocaco.js: dispatch(): Skip reparsing opaque event");
        return undefined;
    }
    try {
        let ret = Reparse.applyAll(event.direction, event.frame, event.reparse);
        return ret;
    } catch (e) {
        // This is generally not meant to fire. Reparse has its own level of
        // try-catch that disables throwing reparsers.
        console.error("Error reparsing", event.direction, "frame:", event.frame,
                      e);
    }
}

/**
 * Flag indicating that whatever pipeline has to be set up is ready. Incoming
 * frames are buffered until this flag is set.
 * NOTE: This can have consequences to modules assuming that frames are always
 *       processed near-immediately (as all our modules do). Currently that is
 *       unproblematic because none of our modules try to react to anything at
 *       the start of the game.
 *
 * @type {boolean}
 */
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
    while (!incoming.isEmpty()) {
        const event = incoming.take();
        if (!incoming.isEmpty()) {
            console.warn("Unable to react to incoming frames");
            // TODO: Should ret be overwritten? What is ret used for!? This code is
            //       messed up.
        }
        ret = dispatch(event);
    }
    incoming.leave();
    return ret;
}

let injectionLogger = new ConsoleLog("frameInjection", "🪡");

/**
 * Inject, in this event cycle, the frames that have been collection in the
 * outgoing queue.
 *
 * Typically we want to do this only in the next event cycle. Use 'post_MAIN()'
 * to do that.
 */
function post_handle() {
    if (outgoing.isOccupied()) {
        // The occupying (recurring) invocation will take care of the rest
        injectionLogger.log("Already handling");
        return;
    }
    outgoing.occupy();
    while (!outgoing.isEmpty()) {
        const event = outgoing.take();
        injectionLogger.log("Inject", event);
        switch (event.direction) {
            case "receive": console.assert(false, "Not implemented"); break;
            case "send":
                event.reparseOptions.adjustSequence(event.frame);
                const encodedFrame = cocaco_encode_send(event.frame);
                if (cocaco_config.replay === true) {
                    console.warn("Dropping outgoing frame during replay");
                    break;
                }
                WebSocket_MAIN.wrappedJSObject.send(
                    cloneInto(encodedFrame, window), event.reparseOptions);
                break;
            default: console.assert(false, "Invalid direction"); break;
        }
    }
    injectionLogger.log("No more outgoing events");
    outgoing.leave();
}

/**
 * Schedule handling of the outgoing events in the next event cycle. It should
 * be called whenever new events are added to the outgoing queue (multiple calls
 * do not accumulate). Together with the outgoing frame queue, this ensures that
 * injected frames are kept out of the current event loop. Calling
 * WebSocket.send() in a nested call would trip up sequence counting between us
 * and the host.
 *
 */
function post_MAIN() {
    setTimeout(post_handle, 0);
}

// Append-only stash for logging
let receivedMessages = [];
let sentMessages = [];

function receive_MAIN(
    encodedFrame,
    reparse = {
        doReparse: true,
        native: true
    },
) {
    let ret;
    try {
        const frame = cocaco_decode_receive(new Uint8Array(encodedFrame));
        if (cocaco_config.log.receive) {
            receivedMessages.push(
                {frame: frame, dataLength: encodedFrame.byteLength});
            let type = frame.data.type ?? -1;
            console.debug("🛜 📥", receivedMessages.length, "|", type, "(",
                          encodedFrame.byteLength, ")", frame);
            if (receivedMessages.length % 10 === 0) {
                console.debug("(receivedMessages):", receivedMessages);
            }
        }
        ret = handle({direction: "receive", frame: frame, reparse: reparse});
    } catch (e) {
        console.error("receive_MAIN(): Failed with error:", e);
    }
    return cloneInto(ret, window);
}

function send_MAIN(encodedFrame, reparse) {
    let ret;
    try {
        const frame = cocaco_decode_send(new Uint8Array(encodedFrame));
        if (cocaco_config.log.send) {
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
                action =
                    "action=" +
                    (ColonistSource.actionMap[frame.message.action] ?? "?");
            }
            let visibility = "";
            if (reparse.native === false) {
                visibility = reparse.doReparse ? "🔔" : "🔕";
            }
            console.debug("🛜 📤", sentMessages.length, `${visibility} |`,
                          sequence, action, "|", frame.v0, frame.v1,
                          `(${encodedFrame.byteLength}B)`, frame.message, frame,
                          encodedFrame);
            // console.debug("raw:", JSON.stringify(frame));
            if (sentMessages.length % 10 === 0) {
                console.debug("(all sentMessages):", sentMessages);
            }
        }
        ret = handle({direction: "send", frame: frame, reparse: reparse});
    } catch (e) {
        console.error("send_MAIN(): Failed with error:", e);
    }
    return cloneInto(ret, window);
}

exportFunction(post_MAIN, window, {defineAs: "post_MAIN"});
exportFunction(receive_MAIN, window, {defineAs: "receive_MAIN"});
exportFunction(send_MAIN, window, {defineAs: "send_MAIN"});

// ╭───────────────────────────────────────────────────────────╮
// │ Start                                                     │
// ╰───────────────────────────────────────────────────────────╯

main();
