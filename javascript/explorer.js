// Extension entry point.
//
// - Configj
// - Globals
// - Helpers
//
// Dispatches into Colony/Oneore.

"use strict";

const theBrowser = typeof chrome !== "undefined" ? chrome : browser;
const version_string = theBrowser.runtime.getManifest().version;

let stats = new Statistics({}, {});

const config = {
    // Features
    extraRollProbabilities: false,
    // Style
    ownIcons: false,
    // Verbose
    logMessages: false,
    logWorldCount: false,
    useTimer: false,
    printRobs: false,
    // Very verbose
    debugMessages: false,
    printWorlds: false,
    // Debug
    largeLog: false,
    doDebug: false,
    runManyWorldsTest: false,  // Run test and quit. Not a full unit test.
    fixedPlayerName: false,    // Set true to use config.playerName
    playerName: "John#1234",
};
console.table(config);

const bgIcon = document.createElement("img");
bgIcon.src = theBrowser.runtime.getURL("assets/coconut_512.png");
bgIcon.id = "background-icon";
document.body.prepend(bgIcon);

let e = document.getElementById("header_navigation_store");
if (e !== null)
    e.textContent = "(🥥 " + version_string + ")";
e = document.querySelector(".betaTag")
if (e !== null)
    e.textContent = "CoCaCo " + version_string;

// The text symbols are for outputting only ;)
// TODO Not sure if we have to keep resources separately. Check if we can merge
//      with resourcesAsUtf8 below.
const resourceIcons =
{
    wood:"🪵",
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
};

// @param resources: ...
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
    wood:       `<img src="${theBrowser.runtime.getURL("assets/wood31.jpg")}" class="explorer-tbl-resource-icon"/>`,
    brick:      `<img src="${theBrowser.runtime.getURL("assets/brick24.jpg")}" class="explorer-tbl-resource-icon"/>`,
    sheep:      `<img src="${theBrowser.runtime.getURL("assets/sheep1.jpg")}" class="explorer-tbl-resource-icon"/>`,
    wheat:      `<img src="${theBrowser.runtime.getURL("assets/wheat2.jpg")}" class="explorer-tbl-resource-icon"/>`,
    ore:        `<img src="${theBrowser.runtime.getURL("assets/ore27.jpg")}" class="explorer-tbl-resource-icon"/>`,
    road:       `<img src="${theBrowser.runtime.getURL("assets/street10.jpg")}" class="explorer-tbl-resource-icon"/>`,
    settlement: `<img src="${theBrowser.runtime.getURL("assets/settle7.jpg")}" class="explorer-tbl-resource-icon"/>`,
    devcard:    `<img src="${theBrowser.runtime.getURL("assets/dev4.jpg")}" class="explorer-tbl-resource-icon"/>`,
    city:       `<img src="${theBrowser.runtime.getURL("assets/city23.jpg")}" class="explorer-tbl-resource-icon"/>`
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

const wood = "wood";
const ore = "ore";
const wheat = "wheat";
const brick = "brick";
const sheep = "sheep";
const resourceTypes = [wood, brick, sheep, wheat, ore];

function rotateToLastPosition(array, value)
{
    const pos = array.indexOf(value);
    console.assert(pos >= 0, "Expected error when spectating");
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
        console.log("🥥 Running on colonist.io");
        let colony = new Colony();
        colony.restartTracker();
    }
    else if (window.location.hostname === "twosheep.io")
    {
        console.log("🥥 Running on twosheep.io");
        console.assert(window.location.hostname === "twosheep.io");
        twosheep.restartTracker();
    }
    else
    {
        console.assert(false, "unreachable");
    }
}

main();

// vim: shiftwidth=4:softtabstop=4:expandtab
