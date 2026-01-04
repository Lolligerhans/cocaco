"use strict";

/**
 * Simple counting structure for tracking events
 */
class Track {

    extra = {more: [], less: [], moreStrict: [], lessStrict: []};

    /**
     * Scalar data traces over rolls
     * @property {Number[]} single Maximum rarity after each roll
     * @property {Number[]} adjusted Maximum rarity after each roll, adjusted
     * @property {Number[]} number Number belonging to the maximum rarity
     */
    maxRarity = {single: [], adjusted: [], number: []};

    /**
     * Maps how often a thief has stolen from a victim as robs[thief][victim].
     * @type {{[thief: string]: {[victim: string]: number}}}
     */
    robs = {};

    /**
     * Like robsTaken
     */
    robsLost = {};

    /**
     * Amount of cards stolen from each player
     * @type {{[player: string]: number}}
     */
    robsSeven = {};

    /**
     * Amount of cards stolen by each player
     * @type {{[player: string]: number}}
     */
    robsTaken = {};

    /**
     * Number of resources stolen in total, by any player
     * @type {Number}
     */
    robsTotal = -100;

    /**
     * List of eye-sums (2-12) in order of occurrence
     * @type {Number[]}
     */
    rolls = [];

    /**
     * Store histogram of all rolled numbers
     * - 'rollsHistogram[0]' is the roll total.
     * - 'rollsHistogram[1]' is the max of any roll (use when encoding with
     *   colour)
     * - 'rollsHistogram[2-12]' is the count of rolling as many eyes
     * @type {Number[]}
     */
    rollsHistogram = [];

    /**
     * KL-Divergence between the rolled and expected distributions. Scalar data
     * traces over rolls.
     * @type {{forward: Number[], backward: Number[]}}
     */
    rollsKLD = {forward: [], backward: []};

    /**
     * The rarity values for each of the 11 numbers (2 - 12), after every roll.
     * @type {{single: Number[][11], adjusted: Number[][11]}}
     * 11-D data traces over rolls.
     */
    rollsRarity = {single: [], adjusted: []};

    /**
     * Copy of the first K values of 'rolls'. Tracks how much was processed w/
     * the same interface as using 'rolls' after every new entry.
     * This is used to lazy-calculate the values for the rolls plot, which we
     * often do not need at all.
     * @type {Number[]}
     */
    rollsProcessed = [];

    /**
     * Adjustment function we use to gauge how rare events should be. Does not
     * properly account for selection bias but is better than nothing.
     * @param {Number} p Probability of some event.
     * @return {Number} Probability of at least 1 event in 11 independent
     *                  Bernoulli trials.
     */
    static probAdjust = (p) => {
        const distrib = stats.binomialDistribution(11, p);
        const sum = distrib.reduce((acc, val) => acc + val) - distrib[0];
        return Math.min(Math.max(sum, 0), 1);
    };

    constructor() {
        // Empty
    }

    init(playerNames) {
        this.initRolls();
        this.initRobs(playerNames);
    }

    /**
     * Updates the die roll data. Does not treat 7s differently and does not
     * update the rob counters on 7s.
     * @param {Number} number The rolled number
     */
    addRoll(number) {
        console.assert(2 <= number && number <= 12);
        this.rolls.push(number);
        // Update rest with updateRollsData()
    }

    /**
     * Print internal state relating to robs to console when the 'printRobs'
     * config is 'true'.
     */
    printRobs() {
        if (cocaco_config.printRobs !== true)
            return;
        log("robs:", this.robs);
        log("robsTaken:", this.robsTaken);
        log("robsLost:", this.robsLost);
        log("robsTotal:", this.robsTotal);
        log("robsSeven:", this.robsSeven);
    }

    /**
     * Updates the structures needed only for rolls plot. Having this allows not
     * doing these computations unless the rolls plot is active.
     * Implemented by replaying the 'rolls' array values into 'rollsProcessed'
     * and then pretending rollsProcessed is the live array.
     * This makes the main loop and render timers more representative when the
     * rolls plot is not used.
     * Updates:
     *  - rollsProcessed
     *  - rollsHistogram
     *  - rollsKLD
     *  - maxRarity
     *  - rollsRarity
     *  - extra
     */
    updateRollsData() {
        // Replay unprocessed rolls
        const newRolls = this.rolls.slice(this.rollsProcessed.length);
        for (let nextRoll of newRolls) {
            this.rollsProcessed.push(nextRoll);
            this.rollsHistogram[nextRoll] += 1;
            this.rollsHistogram[0] += 1;
            this.rollsHistogram[1] =
                Math.max(this.rollsHistogram[1], this.rollsHistogram[nextRoll]);
            this.updateKL();
            this.updateRarity();
        };
    }

    /**
     * Increment the rob counters. Does not change roll counters.
     * @param {string} thief Name of the thief
     * @param {string} victim Name of the victim
     * @param {Number} [count=1] Number of robs
     */
    addRob(thief, victim, count = 1) {
        console.assert(typeof (count) === "number",
                       "addRob: count must be a number");
        this.robs[thief][victim] += count;
        this.robsTaken[thief] += count;
        this.robsLost[victim] += count;
        this.robsTotal += count;
        this.printRobs();
    }

    /**
     * Increment seven counter. Does not affect robs. Call addRob() separately.
     * @param {string} player Name of the player who rolled the 7.
     */
    addSeven(player) {
        if (this.robsSeven[player] === undefined) {
            // FIXME make error once working
            console.warn(
                `addSeven: ${player} not in ${Object.keys(this.robsSeven)}`);
            return;
        }
        this.robsSeven[player] += 1;
    }

    /**
     * Compare to another Track object. Slow.
     *
     * Used for testing, when comparing two data pipelines, to make sure that
     * both pipelines generate the same tracked events.
     * @param {Track} other
     */
    equals(other) {
        // Ignore some derived variables, assuming that the internal
        // computations produce the same results each time.
        let equal = true;
        equal = equal && badEquals(this.rolls, other.rolls);
        equal = equal && badEquals(this.robs, other.robs);
        equal = equal && badEquals(this.robsTotal, other.robsTotal);
        equal = equal && badEquals(this.robsLost, other.robsLost);
        equal = equal && badEquals(this.robsTaken, other.robsTaken);
        equal = equal && badEquals(this.robsSeven, other.robsSeven);
        return equal;
    }
}

// ╭───────────────────────────────────────────────────────────────────────────╮
// │ Private                                                                   │
// ╰───────────────────────────────────────────────────────────────────────────╯

Track.prototype.initRobs = function(playerNames) {
    this.robs = {};
    this.robsTaken = {};
    this.robsLost = {};
    this.robsTotal = 0;
    this.robsSeven = {};
    for (const player of playerNames) {
        this.robs[player] = {};
        for (const p of playerNames) {
            this.robs[player][p] = 0;
        }
        this.robsTaken[player] = 0;
        this.robsLost[player] = 0;
        this.robsSeven[player] = 0;
    }
    this.printRobs();
};

// Init the rolls member
Track.prototype.initRolls = function() {
    this.rolls = [];
    this.rollsHistogram = new Array(12 + 1).fill(0);
    this.rollsKLD = {forward: [], backward: []};
};

/**
 * Generate the KL values corresponding to the newest roll
 */
Track.prototype.updateKL = function() {
    const n = this.rollsProcessed.length;
    console.assert(n >= 1);
    const rolls = this.rollsHistogram.slice(2, 13).map(x => x / n);
    this.rollsKLD.forward[n - 1] = klDivergence(trueProbability, rolls);
    this.rollsKLD.backward[n - 1] = klDivergence(rolls, trueProbability);
};

/**
 * Generate the rarity values for the newest roll
 */
Track.prototype.updateRarity = function updateRolls() {
    console.assert(this.rollsProcessed.length >= 1);

    // Precompute distribution helpers
    const N = this.rollsProcessed.length;
    const index = N - 1; // Index to update in data traces
    let dist = [];       // Cache binomial(N,p) for each number
    for (let i = 2; i <= 12; ++i) {
        dist[i - 2] = stats.binomialDistribution(N, trueProbability[i - 2]);
    }
    const clampProb = p => Math.min(Math.max(p, 0), 1);
    let lessMoreDist = []; // <=, >=
    const precomputeMoreOrLess = (number) => {
        if (number <= 1 || 13 <= number)
            alertIf("need number from 2 to 12 for dist");
        // (!) Start loop at i=1 and inline i=0
        let lessOrEqualAcc = dist[number - 2][0];
        let moreOrEqualAcc = 1;
        lessMoreDist[number - 2] = [];
        lessMoreDist[number - 2][0] =
            [clampProb(lessOrEqualAcc), clampProb(moreOrEqualAcc)];
        for (let i = 1; i <= N; ++i) {
            lessOrEqualAcc += dist[number - 2][i];
            moreOrEqualAcc -= dist[number - 2][i - 1];
            lessMoreDist[number - 2][i] =
                [clampProb(lessOrEqualAcc), clampProb(moreOrEqualAcc)];
        }
    };
    // TODO: symmetric: copy 2-6 to 12-8
    for (let number = 2; number <= 12; ++number)
        precomputeMoreOrLess(number);
    let prob = (x, number) => {
        if (number <= 1 || 13 <= number)
            alertIf("need number from 2 to 12 for dist");
        // Generate total probability mass with density <= p(x), x \in [0,N].
        let sum = 0;
        const pr = dist[number - 2][x];
        // Add small epsilon for stability
        for (const d of dist[number - 2]) {
            if (d <= pr + 0.00000001)
                sum += d;
        }
        sum = Math.min(Math.max(sum, 0), 1);
        return sum;
    };

    // maxRarity
    this.maxRarity.single[index] = Infinity; // Any probability compares <=
    this.maxRarity.adjusted[index] = 0;
    this.maxRarity.number[index] = 0;
    let computeRarity = (v, i, _arr) => {
        const p = prob(v, i + 2);
        if (p <= this.maxRarity.single[index]) {
            this.maxRarity.single[index] = p;
            this.maxRarity.adjusted[index] = Track.probAdjust(p);
            this.maxRarity.number[index] = i + 2;
        }
        return p;
    };

    // rollsRarity
    this.rollsRarity.single[index] =
        this.rollsHistogram.slice(2).map(computeRarity);
    this.rollsRarity.adjusted[index] =
        this.rollsRarity.single[index].map(Track.probAdjust);

    // extra
    const lessMoreChance =
        this.rollsHistogram.slice(2).map((v, i) => lessMoreDist[i][v]);
    this.extra.less[index] = lessMoreChance.map(x => x[0]);
    this.extra.more[index] = lessMoreChance.map(x => x[1]);
    this.extra.lessStrict[index] = this.extra.less[index].map(
        (p, i) => p - dist[i][this.rollsHistogram[i + 2]]);
    this.extra.moreStrict[index] = this.extra.more[index].map(
        (p, i) => p - dist[i][this.rollsHistogram[i + 2]]);
};
