"use strict";

// Class representing any set of resource counts with whole nummbers (including
// negative). Watch out, many operations are in-place.

// There is currently the competing Observer property 'resources'. Long term we
// should probably replace that format with this 'Resoruces' class.

// Currently 'Resources' class has its own array of resource names. Long term it
// should either adopt a global one or become the global one.

class Resources {

    abs() {
        mapObject(this, Math.abs);
    }

    add(resources) {
        this.merge(resources, (a, b) => a + b);
    }

    constructor(other = null) {
        // @param other: Resources object (or as-names object)
        other ??= Resources.emptyResources;
        Resources.resourceNames.forEach(
            k => this[k] = (other[k] ?? 0)
        );
    }

    countHamming() {
        // @return Number of nonzero resource types
        const ret = Object.values(this).reduce(
            (acc, x) => acc + (x !== 0),
            0,
        );
        return ret;
    }

    countNegative() {
        const ret = Object.values(this).reduce(
            (acc, x) => acc + (x < 0),
            0,
        );
        return ret;
    }

    countPositive() {
        const ret = Object.values(this).reduce(
            (acc, x) => acc + (x > 0),
            0,
        );
        return ret;
    }

    divide(divisor) {
        mapObject(this, x => Math.trunc(x / divisor));
    }

    double() {
        mapObject(this, x => x * 2);
    }

    // Do not modify. Use 'new Resources()' instead.
    static emptyResources = {}; // Filled after class definition.

    equals(otherResources) {
        // Compare to another 'Resources' object.
        // @param otherResources: Resources object to compare to. Can be also be
        //                        other objects with the same keys-value pairs.
        // @return true or false
        const ret = Resources.resourceNames.every(res =>
            this[res] === otherResources[res]
        );
        return ret;
    }

    filter(predicate) {
        // Mutate resetting values that do not match to 0
        mapObject(this, v => predicate(v) ? v : 0);
    }

    static fromList(nameList) {
        // Factory to convert from Observer property 'resources'.
        // @param nameList: Array of resource names ["wood", ... , "unknown"]
        let ret = new Resources();
        nameList.forEach(r => ++ret[r]);
        return ret;
    }

    static fromObserverTrade(trade) {
        // Construct 'Resources' object from Observer propert 'trade'. The
        // result is equivalent to the difference offer - demand.
        // @param trade: Observer property 'trade'.
        let offer = Resources.fromList(trade.give.resources);
        const demand = Resources.fromList(trade.take.resources);
        offer.subtract(demand);
        return offer;
    }

    halve() {
        mapObject(this, x => Math.trunc(x / 2));
    }

    hasSpecial() {
        // Test whether the resource object has some of the special "unknown"
        // resources.
        // @return true or false
        const ret = this.unknown !== 0;
        return ret;
    }

    max() {
        // Find largest value and the associated key.
        // @return Array [maxKey, maxValue].
        let max = Object.entries(this).reduce(
            (current, [k, v]) => v > current[1] ? [k, v] : current,
            [null, Number.NEGATIVE_INFINITY],
        );
        return max;
    }

    min() {
        // Find smallest value and the associated key.
        // @return Array [minKey, minValue].
        let min = Object.entries(this).reduce(
            (current, [k, v]) => v < current[1] ? [k, v] : current,
            [null, Number.POSITIVE_INFINITY],
        );
        return min;
    }

    merge(resources, operator) {
        Resources.resourceNames.forEach(r => {
            this[r] = operator(this[r] ?? 0, resources[r] ?? 0);
        });
    }

    static names() {
        return deepCopy(Resources.resourceNames);
    }

    static resourceNames = [
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

    subtract(other) {
        this.merge(other, (a, b) => a - b);
    }

    sum() {
        let sum = Object.values(this).reduce((acc, x) => acc + x, 0);
        // Resources.resourceNames.forEach(r => sum += this[r]);
        return sum;
    }

    sumNegative() {
        let sum = Object.values(this).reduce(
            (acc, x) => acc + Math.min(0, x),
            0,
        );
        return sum;
    }

    sumPositive() {
        let sum = Object.values(this).reduce(
            (acc, x) => acc + Math.max(0, x),
            0,
        );
        return sum;
    }

    toList() {
        // Convert to array of names. Example: ["wood", "wood", brick"]. Must
        // not have negative amounts.
        // @return New array containing the resources as list.
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

    toSymbols() {
        // Construct string of symbols. Example: "🪵 🧱🧱".
        const ret = resourcesAsUtf8(this);
        return ret;
    }

};

// Initialize
Resources.resourceNames.forEach(r => Resources.emptyResources[r] = 0);
