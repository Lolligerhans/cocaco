"use strict";

// Currently 'Resources' class has its own array of resource names. Long term it
// should either adopt a global one or become the global one.

/**
 * A collection of resources identified by their names and counts. Resources may
 * have negative counts. Operations on objects are often in-place, modify the
 * given object (rather than constructing a new object for the result).
 * @property {Number} wood
 * @property {Number} brick
 * @property {Number} sheep
 * @property {Number} wheat
 * @property {Number} ore
 * @property {Number} cloth
 * @property {Number} coin
 * @property {Number} paper
 */
class Resources {

    /**
     * All defined resource names. Use 'Resources.names()' to obtain.
     */
    static #resourceNames = [
        "wood",
        "brick",
        "sheep",
        "wheat",
        "ore",
        "cloth",
        "coin",
        "paper",
        "unknown",
    ];

    /**
     * Helper object to initialize an empty isntance. Use 'new Resources()'
     * instead. Global Object used to construct new empty 'Resources' instances.
     * @type {*}
     */
    static #emptyResources = Object.fromEntries(
        Resources.#resourceNames.map(resourceName => [resourceName, 0])
    );

    /**
     * Modify the object in-place, replacing each resource count with its
     * absolute value.
     */
    abs() {
        mapObject(this, Math.abs);
    }

    /**
     * Modify 'this' in-place, adding resources element-wise.
     * @param {Resources} resources
     */
    add(resources) {
        this.merge(resources, (a, b) => a + b);
    }

    /**
     * @param {Resources} other If provided, copy values from 'other'
     */
    constructor(other = null) {
        other ??= Resources.#emptyResources;
        Resources.#resourceNames.forEach(
            k => this[k] = (other[k] ?? 0)
        );
    }

    /**
     * Does not sum amounts of resources.
     * @return {Number} Count of resource types with nonzero value
     */
    countHamming() {
        const ret = Object.values(this).reduce(
            (acc, x) => acc + (x !== 0),
            0,
        );
        return ret;
    }

    /**
     * Does not sum amounts of resources.
     * @return {Number} Count of resource types with negative value
     */
    countNegative() {
        const ret = Object.values(this).reduce(
            (acc, x) => acc + (x < 0),
            0,
        );
        return ret;
    }

    /**
     * Does not sum amounts of resources.
     * @return {Number} Count resource types with positive value
     */
    countPositive() {
        const ret = Object.values(this).reduce(
            (acc, x) => acc + (x > 0),
            0,
        );
        return ret;
    }

    /**
     * Modifies the object in-place, dividing element-wise by 'divisor'.
     * @param {Resources} divisor
     */
    divide(divisor) {
        mapObject(this, x => Math.trunc(x / divisor));
    }

    /**
     * Modifies the object in-place, multiplying element-wise by 2.
     */
    double() {
        mapObject(this, x => x * 2);
    }

    /**
     * Compare to another 'Resources' object.
     * @param {Resources} otherResources
     * Resources object to compare to. Can also be other objects with the same
     * keys-value pairs.
     * @return {Boolean}
     */
    equals(otherResources) {
        const ret = Resources.#resourceNames.every(res =>
            this[res] === otherResources[res]
        );
        return ret;
    }

    /**
     * Modify in-place. Reset values to 0 if they do not match a unary
     * predicate.
     */
    filter(predicate) {
        mapObject(this, v => predicate(v) ? v : 0);
    }

    /**
     * Factory to convert from list of names. Allowed names are all of
     * 'Resources.#resourceNames'. Some contexts may disallow special resources;
     * check with 'hasSpecial()'.
     * @param {string[]} nameList Array of resource names
     * @return {Resources} New object initialized by nameList
     */
    static fromList(nameList) {
        let ret = new Resources();
        nameList.forEach(r => ++ret[r]);
        return ret;
    }

    /**
     * @param {Object.<string,Number>} resourcesAsNames
     * The strings defined in Resources.#resourceNames are interpreted as
     * resource counts. The properties may be null-ish. Examples:
     *      { "wood": 1, "brick": null }
     *      { }
     *      { "unknown": -1 }
     * @return {Resources} New Resources object
     */
    static fromNames(resourcesAsNames) {
        return new Resources(resourcesAsNames);
    }

    /**
     * Construct combined resource exchange from trade
     * @param trade Observer property 'trade'.
     * @return {Resources} Trade difference "offer - demand"
     */
    static fromObserverTrade(trade) {
        let result = new Resources(trade.give.resources);
        const demand = trade.take.resources;
        result.subtract(demand);
        return result;
    }

    /**
     * Modifies the object in-place, dividing element-wise by 2.
     */
    halve() {
        // Normal integer division; truncating towards 0
        mapObject(this, x => Math.trunc(x / 2));
    }

    /**
     * Test whether the resource object has both positive and negative
     * values.
     * @return {boolean}
     */
    hasPositiveAndNegative() {
        const ret = this.countPositive() >= 1 && this.countNegative() >= 1;
        return ret;
    }

    /**
     * Test whether the resource object has some of the special resources.
     * Currently only "unknown" is special, but we may add new special resources
     * in the future.
     * @return {Boolean}
     */
    hasSpecial() {
        const ret = this.unknown !== 0;
        return ret;
    }

    /**
     * Find largest value and the associated key.
     * @return {[Number, Number]} Array [maxKey, maxValue]
     */
    max() {
        let max = Object.entries(this).reduce(
            (current, [k, v]) => v > current[1] ? [k, v] : current,
            [null, Number.NEGATIVE_INFINITY],
        );
        return max;
    }

    /**
     * Find smallest value and the associated key.
     * @return {[Number, Number]} Array [minKey, minValue]
     */
    min() {
        let min = Object.entries(this).reduce(
            (current, [k, v]) => v < current[1] ? [k, v] : current,
            [null, Number.POSITIVE_INFINITY],
        );
        return min;
    }

    /**
     * Modify 'this' in-place by applying an element-wise operation with
     * a second Resources object.
     * @param {Resources} resources A resources object
     * @param {function(Number,Number):Number} operator
     * Binary operation operator(this.x, other.x) to generate the element-wise
     * combination with the 'other' resources.
     * @return {void}
     */
    merge(resources, operator) {
        Resources.#resourceNames.forEach(r => {
            this[r] = operator(this[r] ?? 0, resources[r] ?? 0);
        });
    }

    /**
     * Get all resource names
     * @return {string[]}
     */
    static names() {
        return deepCopy(Resources.#resourceNames);
    }

    /**
     * Modify object in-place by subtracting a second Resources object
     * element-wise.
     * @param {Resources} other
     */
    subtract(other) {
        this.merge(other, (a, b) => a - b);
    }

    /**
     * Total sum of resources of any kind represented. Including special
     * resources. Negative resources are subtracted.
     * @return {Number}
     */
    sum() {
        let sum = Object.values(this).reduce((acc, x) => acc + x, 0);
        // Resources.#resourceNames.forEach(r => sum += this[r]);
        return sum;
    }

    /**
     * Sum of all negative resource values
     * @return {Number}
     */
    sumNegative() {
        let sum = Object.values(this).reduce(
            (acc, x) => acc + Math.min(0, x),
            0,
        );
        return sum;
    }

    /**
     * Sum of all positive resource values
     * @return {Number}
     */
    sumPositive() {
        let sum = Object.values(this).reduce(
            (acc, x) => acc + Math.max(0, x),
            0,
        );
        return sum;
    }


    /**
     * Convert to array of names. Example: ["wood", "wood", brick"]. Must
     * not have negative amounts.
     * @return {string[]}
     */
    toList() {
        let list = new Array(this.sum()).fill(0);
        let i = 0;
        Object.entries(this).forEach(([k, v]) => {
            if (v < 0) {
                throw new Error("Cannot list negative amounts");
            }
            for (let j = 0; j < v; ++j) {
                list[i] = k;
                ++i;
            }
        });
        console.assert(i === list.length);
        return list;
    }

    /**
     * Convert to string of symbols. See 'resourcesAsUtf8()'.
     * @return {string} New string representing the resources
     */
    toSymbols() {
        const ret = resourcesAsUtf8(this);
        return ret;
    }

}
