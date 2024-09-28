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
function resourcesAsUtf8(resources)
{
    let s = "";
    for (const entry of Object.entries(resources))
    {
        if (entry[1] === 0) continue;
        s += resourceIcons[entry[0]].repeat(Math.abs(entry[1]));
        s += " ";
    }
    return s.trim();
}

const alternativeAssets =
{
    // More at 408f1c219dc04fb8746541fed624e6d4026aaaac
    wood:       `<img src="${theBrowser.runtime.getURL("assets/wood31.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    brick:      `<img src="${theBrowser.runtime.getURL("assets/brick24.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    sheep:      `<img src="${theBrowser.runtime.getURL("assets/sheep1.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    wheat:      `<img src="${theBrowser.runtime.getURL("assets/wheat2.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    ore:        `<img src="${theBrowser.runtime.getURL("assets/ore27.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    road:       `<img src="${theBrowser.runtime.getURL("assets/street10.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    settlement: `<img src="${theBrowser.runtime.getURL("assets/settle7.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    devcard:    `<img src="${theBrowser.runtime.getURL("assets/dev4.jpg")}" class="cocaco-tbl-resource-icon"/>`,
    city:       `<img src="${theBrowser.runtime.getURL("assets/city23.jpg")}" class="cocaco-tbl-resource-icon"/>`
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
    console.log("🧭 ( ✔️  ) executeWithRetries completed");
}

function removeEntry(arr, index){
    arr[index] = arr[arr.length - 1];
    arr.pop();
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

// For debugging
function p(object)
{
    return JSON.stringify(object);
}
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
    if (config.doDebug)
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
    if (config.runManyWorldsTest === true)
    {
        allTests();
        return
    }

    if (window.location.hostname === "colonist.io")
    {
        if (config.pipeline === "Colonist") {
            console.log("🥥 Running Colonist on colonist.io");

            let colonist = new Colonist();
            colonist.start();
        } else {
            console.assert(config.pipeline === "Colony",
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
        console.assert(false, "unreachable");
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
        payload: handledCount
    });
    ackTime = now + 120 * 1000;
}

let doDump = config.dump;
function handleMessage(message) {
    Reparse.applyAll(message);
    if (!doDump) {
        return;
    }
    try {
        portToBackground.postMessage({ type: "dump", payload: message });
        acknowledge();
    } catch (e) {
        console.error("Dump failed:", e);
        console.warn("Dump off");
        doDump = false;
    }
}

// Some reparsers use Colony properties which are not ready at startup (the
// content-script may not even loaded yet). Effectively we cache the first
// messages until the first message after setting messageStash=true. It may take
// until the first user action to trigger replaying the cache.
let messageStash = { messages: [], ready: false };
function receive(message) {
    messageStash.messages.push(message);
    if (!messageStash.ready) {
        return;
    }
    messageStash.messages.forEach(message => {
        try {
            handleMessage(message)
        } catch (e) {
            console.error("Error parsing message:", message, e);
        }
    });
    messageStash.messages.length = 0;
}

exportFunction(receive, window, { defineAs: "receive" });

main();
