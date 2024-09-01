// Simple counting structure 'Track'.
// For tracking trivial events.

"use strict";

class Track {
    static probAdjust = (p) => {
        const distrib = stats.binomialDistribution(11, p);
        const sum = distrib.reduce((acc, val) => acc + val) - distrib[0];
        return Math.min(Math.max(sum, 0), 1);
    };

    constructor() {
        // List of eye-sums (2-12) in order of occurence
        this.rolls = [];
        // 'rollsHistogram[0]' is the roll total.
        // 'rollsHistogram[1]' is the max of any roll (use when encoding with colour)
        // 'rollsHistogram[2-12]' is the count of rolling so many eyes
        this.rollsHistogram = [];
        // Scalar data traces over rolls
        this.rollsKLD = { forward: [], backward: [], };
        // 10-D data traces over rolls
        this.rollsRarity = { single: [], adjusted: [] };
        // Scalar data traces over rolls
        this.maxRarity = { single: [], adjusted: [], number: [] };
        // 10-D data traces over rolls
        this.extra = {
            more: [],
            less: [],
            moreStrict: [],
            lessStrict: [],
        };

        this.robs = {};          // robs = { "player1": {"player2":1, "player2":0, ... }, "player2" : {}, ... }
        this.robsTaken = {};     // robsTaken = {"player1":4, "player2":0, ...}
        this.robsLost = {};      // Like robsTaken
        this.robsTotal = -100;   // Scalar
        this.robsSeven = {};     // Like robsTaken
    }

    init(playerNames) {
        this.initRolls();
        this.initRobs(playerNames);
    }

    // Updates the die roll data. Does NOT treat 7s specially.
    addRoll(number) {
        if (number < 2 || 12 < number) // Sanity check
        {
            alertIf("addRoll(): invalid number " + number);
            return;
        }

        // Save raw rolls
        this.rolls.push(number);

        // Histogram version
        this.rollsHistogram[number] += 1;
        this.rollsHistogram[0] += 1;
        this.rollsHistogram[1] = Math.max(this.rollsHistogram[1], this.rollsHistogram[number]);

        this.updateKL();
        this.updateRarity();

        // console.debug("extras: ", this.extra);
    }

    // TODO Should this function really be? And be here?
    fillRollPlot(element) {
        plotRollsAsHistogram(this, element.id);
    }

    printRobs() {
        if (config.printRobs !== true)
            return;
        log("robs:", this.robs);
        log("robsTaken:", this.robsTaken);
        log("robsLost:", this.robsLost);
        log("robsTotal:", this.robsTotal);
        log("robsSeven:", this.robsSeven);
    }

    // The just the robbing action. No matter if from 7 or knight
    addRob(thief, victim, count = 1) {
        console.assert(typeof (count) === "number", "addRob: count must be a number");
        this.robs[thief][victim] += count;
        this.robsTaken[thief] += count;
        this.robsLost[victim] += count;
        this.robsTotal += count;
        this.printRobs();
    }

    // Adjust seven counter. Does not affect robs. Call addRob() separately.
    addSeven(player) {
        if (this.robsSeven[player] === undefined) {
            // FIXME make error once working
            console.warn(`addSeven: ${player} not in ${Object.keys(this.robsSeven)}`);
            return;
        }
        this.robsSeven[player] += 1;
    }
}

// ╭───────────────────────────────────────────────────────────────────────────╮
// │ Private                                                                   │
// ╰───────────────────────────────────────────────────────────────────────────╯

// Init the robbing members
Track.prototype.initRobs = function (playerNames) {
    console.assert(playerNames.length >= 2, "initRobs expects at least 2 players");
    this.robs = {};
    this.robsTaken = {};
    this.robsLost = {};
    this.robsTotal = 0;
    this.robsSeven = {};
    for (const player of playerNames) {
        this.robs[player] = {};
        for (const p of playerNames) { this.robs[player][p] = 0; }
        this.robsTaken[player] = 0;
        this.robsLost[player] = 0;
        this.robsSeven[player] = 0;
    }
    this.printRobs();
}

// Init the rolls member
Track.prototype.initRolls = function () {
    this.rolls = [];
    this.rollsHistogram = new Array(12 + 1).fill(0);
    this.rollsKLD = { forward: [], backward: [], };
}

// Write the KL values corresponding to the newest roll
Track.prototype.updateKL = function () {
    const n = this.rolls.length;
    console.assert(n >= 1);
    const rolls = this.rollsHistogram.slice(2, 13)
        .map(x => x / n);
    this.rollsKLD.forward[n - 1] = klDivergence(trueProbability, rolls);
    this.rollsKLD.backward[n - 1] = klDivergence(rolls, trueProbability);
}

// Generate the rarity values for the newest roll
Track.prototype.updateRarity = function updateRolls() {
    console.assert(this.rolls.length >= 1);

    // Precompute distribution helpers
    const N = this.rolls.length;
    const index = N - 1; // Index to update in data traces
    let dist = []; // Cache binomial(N,p) for each number
    for (let i = 2; i <= 12; ++i) {
        dist[i - 2] = stats.binomialDistribution(N, trueProbability[i - 2]);
    }
    const clampProb = p => Math.min(Math.max(p, 0), 1);
    let lessMoreDist = [];  // <=, >=
    const precomputeMoreOrLess = (number) => {
        if (number <= 1 || 13 <= number) alertIf("need number from 2 to 12 for dist");
        // (!) Start loop at i=1 and inline i=0
        let lessOrEqualAcc = dist[number - 2][0];
        let moreOrEqualAcc = 1;
        lessMoreDist[number - 2] = [];
        lessMoreDist[number - 2][0] = [clampProb(lessOrEqualAcc), clampProb(moreOrEqualAcc)];
        for (let i = 1; i <= N; ++i) {
            lessOrEqualAcc += dist[number - 2][i];
            moreOrEqualAcc -= dist[number - 2][i - 1];
            lessMoreDist[number - 2][i] = [clampProb(lessOrEqualAcc), clampProb(moreOrEqualAcc)];
        }
    };
    // TODO: symmetric: copy 2-6 to 12-8
    for (let number = 2; number <= 12; ++number)
        precomputeMoreOrLess(number);
    let prob = (x, number) => {
        if (number <= 1 || 13 <= number) alertIf("need number from 2 to 12 for dist");
        // Generate total probability mass with density <= p(x). x \in [0,N].
        let sum = 0;
        const pr = dist[number - 2][x];
        // Add small epsilon for stability
        for (const d of dist[number - 2]) { if (d <= pr + 0.00000001) sum += d; }
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
    this.rollsRarity.single[index] = this.rollsHistogram.slice(2).map(computeRarity);
    this.rollsRarity.adjusted[index] = this.rollsRarity.single[index].map(Track.probAdjust);

    // extra
    const lessMoreChance = this.rollsHistogram.slice(2).map( (v,i) => lessMoreDist[i][v] );
    this.extra.less[index] = lessMoreChance.map( x => x[0] );
    this.extra.more[index] = lessMoreChance.map( x => x[1] );
    this.extra.lessStrict[index] = this.extra.less[index].map( (p,i) => p - dist[i][this.rollsHistogram[i+2]] );
    this.extra.moreStrict[index] = this.extra.more[index].map( (p,i) => p - dist[i][this.rollsHistogram[i+2]] );
}

// vim: shiftwidth=4:softtabstop=4:expandtab
