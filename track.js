// track.js: Small tracking structures. The main tracking is manyworlds.js

"use strict";

class Track
{
    constructor()
    {
        // Save count of rolling the number N at 'rolls[N]', N \in [2,12].
        // 'rolls[0]' is the roll total.
        // 'rolls[1]' is the max of any roll (use when encoding with colour)
        this.rolls = [];
        this.rollsHistogram = [];

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

    // TODO Can we init in ctor?
    initRolls()
    {
        this.rolls = []; // Raw numbers in order
        this.rollsHistogram = new Array(12 + 1).fill(0);  // Histogram (1-based)
    }

    addRoll(number)
    {
        if (number < 2 || 12 < number)
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

        // Debugging
    //    log(rolls, rollsHistogram);
    }

    // TODO Should this function really be? And be here?
    fillRollPlot(element)
    {
        plotRollsAsHistogram(this, element.id);
    }

    printRobs()
    {
        if (configPrintRobs !== true) return;
        log("robs:", robs);
        log("robsTaken:", robsTaken);
        log("robsLost:", robsLost);
        log("robsTotal:", robsTotal);
        log("robsSeven:", robsSeven);
    }

    initRobs(playerNames = players)
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

    // The just the robbing action. No matter if from 7 or knight
    addRob(thief, victim)
    {
        this.robs[thief][victim] += 1;
        this.robsTaken[thief] += 1;
        this.robsLost[victim] += 1;
        this.robsTotal += 1;
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

// vim: shiftwidth=4:softtabstop=4:expandtab
