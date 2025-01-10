"use strict";

// Dependency free helpers

/**
 * Convert to JSON. For debugging.
 */
function p(object) {
    return JSON.stringify(object);
}

/**
 * Swap keys with their values in an object. The caller must ensure that values
 * are of appropriate types. Number values become string keys.
 * @param {*} Object
 * A JS Object. Values must be {string|Number}, else the object cannot be
 * inverted.
 * @param {function(string):*} transform
 * Function to transform the resulting value. For example, to convert to
 * a number (which the then-key could not be as key).
 * @return {Object} New object with swapped key and values
 */
function invertObject(object, transform = x => x) {
    let res = Object.fromEntries(
        Object.entries(object).map(([k, v]) => [v, transform(k)]));
    return res;
}

/**
 * Distinguish between arrays and objects. 'typeof' would return "object" for
 * both.
 * @param {Array | Object} variable
 * @return {Number}
 * Different values for when 'variable' is of type Array or Object
 */
function _combinedType(variable) {
    return (typeof variable === "object") + (Array.isArray(variable));
}

/**
 * Construct new Object by recursively merging 'update' into
 * 'object'. Conflicts are resolved by preferring the 'update' object.
 * @param {*} object
 * @param {*} update
 * @return {Object} New object representing 'object' updated by 'update'
 */
function combineObject(object, update) {
    const unmergable = typeof update !== "object" || update == null ||
                       object == null ||
                       _combinedType(object) !== _combinedType(update);
    if (unmergable) {
        return structuredClone(update);
    }
    const cloneObject = structuredClone(object);
    const cloneUpdate = structuredClone(update);
    updateObjectNoClone(cloneObject, cloneUpdate);
    console.assert(!Object.values(cloneObject).includes(undefined));
    return cloneObject;
}

/**
 * Filter the values of an object similar to 'Array.filter()'. Modifies the
 * object in-place (unlike 'Array.filter()'). Uses 'delete' to remove properties
 * not passing the predicate.
 * @param {*} object Object to modify
 * @param {function(*):boolean} predicate
 * Unary predicate for the values of the object
 * @return {void}
 */
function filterObject(object, predicate) {
    for (const key of Object.keys(object)) {
        if (!predicate(object[key])) {
            delete object[key];
        }
    }
}

/**
 * Transforms values of an Object element-wise. Assigns the resulting values to
 * the values of 'object'. Probably slow.
 * @param {*} object
 * @param {function(*):*} func
 * Function accepting the values of 'object' as arguments
 * @return {*} The modified object.
 */
function mapObject(object, func) {
    Object.entries(object).forEach(([k, v]) => { object[k] = func(v, k); });
    return object;
}

/**
 * Pick random element from an array.
 * @param {*[]} arr Array of length >= 1
 * @return {*} Element from arr chosen uniformly at random
 */
function pickUniform(arr) {
    console.assert(arr.length >= 1);
    const index = Math.floor(Math.random() * arr.length);
    return arr[index];
}

/**
 * Create a string of UTF-8 symbols.
 * Format:
 *  - Symbols of the same kind are repeated without spaces
 *  - Spaces separate distinct symbols
 *  - Negative amounts are wrapped in parentheses
 * Example:
 *      🪵🪵🪵 🧱 (🐑) 🌾🌾
 * @param {Object|Resources} resources Example: { wood: 3, wheat: 2, ... }
 * @returns {string} String representation of the resources using UTF-8 symbols
 */
function resourcesAsUtf8(resources) {
    let s = "";
    for (const entry of Object.entries(resources)) {
        if (entry[1] === 0) {
            continue;
        }
        const icons = utf8Symbols[entry[0]].repeat(Math.abs(entry[1]));
        if (entry[1] < 0) {
            s += "(" + icons + ")";
        } else {
            s += icons;
        }
        s += " ";
    }
    return s.trim();
}

/**
 * Remove an element from an array. Changes the order of elements.
 * @param {*[]} array Any JS array
 * @param {Number} index Index of the element to be removed
 */
function removeElementUnordered(array, index) {
    array[index] = array[array.length - 1];
    array.pop();
}

/**
 * Updates object in-place by recursively merging 'update' into it. Conflicts
 * are resolved by preferring the 'update' object. Used to implement
 * 'combineObject()'.
 * @param {*} object
 * @param {*} update
 */
function updateObjectNoClone(object, update) {
    Object.keys(update).forEach(key => {
        const unmergable =
            typeof update[key] !== "object" || update[key] == null ||
            object[key] == null ||
            _combinedType(object[key]) !== _combinedType(update[key]);
        if (unmergable) {
            // console.debug("Resetting", key);
            object[key] = update[key];
        } else {
            // console.debug("Merging", key);
            updateObjectNoClone(object[key], update[key]);
        }
    });
}

/**
 * Map of UTF-8 symbols representing various things
 * Keys are names, values are a string containing the symbol
 * @type {Object.<string, string>}
 */
const utf8Symbols = {
    wood: "🪵",
    brick: "🧱",
    sheep: "🐑",
    wheat: "🌾",
    ore: "🪨",
    cloth: "🧶",
    coin: "🪙",
    paper: "📜",
    unknown: "🂠",
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
    activate: "🔘",
    aqueduct: "💧",
    bank: "🏦",
    build: "👷",
    buy: "🛒",
    city: "🏢",
    cityWall: "⛩️",
    crane: "🏗",
    deserter: "🏜",
    devcard: "🃏",
    diplomat: "🤝",
    discard: "🗑",
    discount: "％",
    free: "🆓",
    harbor: "⚓",
    knight: "♞",
    known: "👀",
    merchant: "™️",
    monopoly: "📈",
    move: "🧳",
    pirate: "☠️",
    progress: "🃟",
    road: "🛣", // Lane symbols: ⛙ ⛜
    roadBuilder: "🚧",
    robber: "🥖", // French club
    settlement: "🛖",
    ship: "⛵",
    smith: "🔥",
    spy: "🕵",
    steal: "🥷",
    trade: "↔️",
    upgrade: "🆙",
    vp: "⭐",
    wedding: "💒",
    win: "🎉",
    yop: "🎁",
};
