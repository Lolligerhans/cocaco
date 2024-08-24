// Simple counting structure 'Track'.
// For tracking trivial events.

"use strict";

class Track
{
    constructor()
    {
        this.rolls = [];
        // 'rollsHistogram[0]' is the roll total.
        // 'rollsHistogram[1]' is the max of any roll (use when encoding with colour)
        // 'rollsHistogram[2-12]' is the count of rolling so many eyes
        this.rollsHistogram = [];
        this.rollsKLD = { forward: [], backward: [], };

        this.robs = {};          // robs = { "player1": {"player2":1, "player2":0, ... }, "player2" : {}, ... }
        this.robsTaken = {};     // robsTaken = {"player1":4, "player2":0, ...}
        this.robsLost = {};      // Like robsTaken
        this.robsTotal = -100;   // Scalar
        this.robsSeven = {};     // Like robsTaken
    }

    init(playerNames)
    {
        this.initRolls();
        this.initRobs(playerNames);
    }

    addRoll(number)
    {
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

        // Debugging
    //    log(rolls, rollsHistogram, rollsKLD);
    }

    // TODO Should this function really be? And be here?
    fillRollPlot(element)
    {
        plotRollsAsHistogram(this, element.id);
    }

    printRobs()
    {
        if (config.printRobs !== true)
            return;
        log("robs:", this.robs);
        log("robsTaken:", this.robsTaken);
        log("robsLost:", this.robsLost);
        log("robsTotal:", this.robsTotal);
        log("robsSeven:", this.robsSeven);
    }

    // The just the robbing action. No matter if from 7 or knight
    addRob(thief, victim, count = 1)
    {
        console.assert(typeof(count) === "number", "addRob: count must be a number");
        this.robs[thief][victim] += count;
        this.robsTaken[thief] += count;
        this.robsLost[victim] += count;
        this.robsTotal += count;
        this.printRobs();
    }

    // Adjust seven counter. Does not affect robs. Call addRob() separately.
    addSeven(player)
    {
        if (this.robsSeven[player] === undefined)
        {
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

Track.prototype.initRolls = function()
// Init the rolls members
{
    this.rolls = [];
    this.rollsHistogram = new Array(12 + 1).fill(0);
    this.rollsKLD = { forward: [], backward: [], };
}

Track.prototype.initRobs = function(playerNames)
// Init the robbing members
{
    console.assert(playerNames.length >= 2, "initRobs expects at least 2 players");
    this.robs = {};
    this.robsTaken = {};
    this.robsLost = {};
    this.robsTotal = 0;
    this.robsSeven = {};
    for (const player of playerNames)
    {
        this.robs[player] = {};
        for (const p of playerNames) { this.robs[player][p] = 0; }
        this.robsTaken[player] = 0;
        this.robsLost[player] = 0;
        this.robsSeven[player] = 0;
    }
    this.printRobs();
}

Track.prototype.updateKL = function()
// Write the KL values corresponding to the newest roll
{
    const n = this.rolls.length;
    console.assert(n >= 1);
    const rolls = this.rollsHistogram.slice(2, 13)
                                     .map  (x => x / n);
    this.rollsKLD.forward [n - 1] = klDivergence(trueProbability, rolls);
    this.rollsKLD.backward[n - 1] = klDivergence(rolls, trueProbability);
}

// vim: shiftwidth=4:softtabstop=4:expandtab
