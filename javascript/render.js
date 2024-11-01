"use strict";

/**
 * Renderer for number based resource disaplay.
 */
class Render {

    static #ids = {
        resourceTable: "cocaco-tbl",
        bubblePlot: "cocaco-plt",
        rollsPlot: "cocaco-plt-rolls",
        robTable: "cocaco-rob-tbl"
    };

    /**
     * @type {Object.<string,string>} Maps player names to their colours
     */
    #colour_map;

    /**
     * Set to 'true' to hide panels
     */
    #configHidden = {
        bubbles: true,
        rolls: true,
        robs: true,
        resourceTable: false,
    };
    #context; // Callback functions
    #iconElements;

    /**
     * @type {Multiverse}
     */
    #multiverse;

    /**
     * @type {Track}
     */
    #track;

    /**
     * When set to 'true', the next render() will redraw the elements. Else only
     * updates them.
     * @type {Boolean}
     */
    #mustRedraw = false;

    /**
     * @type {string[]} Player names
     */
    #playerNames;

    /**
     * @param {Multiverse} multiverse
     * @param {Track} track
     * @param {string[]} playerNames Names in desired order
     * @param {Object.<string,string>} colour_map
     * Object mapping player names to their colour
     */
    constructor(
        // ManyWorlds object using names consistent with 'colours'
        multiverse,
        track,
        // Array in the correct order
        playerNames,
        // Colours must be consistent to ManyWorldsObject
        colour_map,
        //haltCallback, // At log element currently
        //continueCallback, // At log element currently
        resetCallback, // Currently does nothing
        recoverCardsCallback, // Goes in the card total cells
        recoverNamesCallback, // Goes in the corner cell
        iconAssets // {"road": '<img src=...>', ...}
    ) {
        // Callbacks may be null
        console.assert(
            ![
                multiverse,
                track,
                playerNames,
                colour_map,
                iconAssets,
            ].includes(null),
        );
        this.#playerNames = playerNames;
        this.#colour_map = colour_map;
        this.#multiverse = multiverse;
        this.#track = track;
        this.#iconElements = iconAssets;
        this.#context = {
            resetCallback: resetCallback,
            recoverCardsCallback: recoverCardsCallback,
            recoverNamesCallback: recoverNamesCallback
        };

    }

    /**
     * @param value  If 'null', toggle. If 'true'/'false', set.
     */
    toggle(which, value = null) {
        if (typeof (which) === "number")
            which = Object.keys(this.#configHidden)[which];
        this.#configHidden[which] = value === null
            ? !this.#configHidden[which]
            : value;
        console.log(`🖥Toggle ${which} ➜ ${this.#configHidden[which] ? "hide" : "show"}`);
        this.#mustRedraw = true;
        this.render();
    }

    /**
     * Remove the render objects from DOM
     */
    unrender() {
        try {
            Object.values(Render.#ids).forEach(id => {
                const e = document.getElementById(id);
                if (e) e.remove();
            });
        }
        catch (e) {
            // We don't really care if this fails at the moment, but it might help
            // identify bugs.
            console.warn("Exception in unrender():", e);
            alertIf(46);
        }
    }

    /**
     * Update exisintg elements. Create elements if missing. If the element is
     * disabled by this.#configHidden, we do not touch, update or create it.
     */
    update() {
        //console.debug("🖥 Updating display...");

        // Display resource plot
        if (this.#configHidden.bubbles === false) {
            let plt = this.ensureResourcePlot();
            fillElementWithPlot(plt, this.#multiverse, this.#colour_map);
        }

        // Dispaly rolls histogram
        if (this.#configHidden.rolls === false) {
            let plt = this.ensureRollsPlot();
            this.#track.updateRollsData();
            plotRollsAsHistogram(this.#track, plt.id);
        }

        // Display table
        if (this.#configHidden.resourceTable === false) {
            let tbl = this.ensureResourceTable();
            this.fillResourceTable(tbl);
        }

        // Display rob table
        if (this.#configHidden.robs === false) {
            let tbl = this.ensureRobTable();
            this.fillRobTable(tbl);
        }

        //console.debug("🖥 Updated display");
    }

    /**
     * @param {() => boolean} [renderIf=() => true]
     * If renderIf returns false, render() does nothing
     */
    render(renderIf = () => true) {

        if (!renderIf()) {
            //console.debug("🖥 Skip display render");
            return;
        }

        // TODO: Return stats object instead of direct access
        this.#multiverse.updateStats();

        if (this.#mustRedraw === false) {
            //console.log("🖥 Delegating to update()");
            this.update();
            return;
        }
        this.#mustRedraw = false;

        //console.debug("🖥 Inserting display...");

        // Resource plot
        {
            let plt = this.ensureResourcePlot();
            setHidden(this.#configHidden.bubbles, plt);
        }

        // Rolls histogram
        {
            let plt = this.ensureRollsPlot();
            setHidden(this.#configHidden.rolls, plt);
        }

        // Resource table
        {
            let tbl = this.ensureResourceTable();
            setHidden(this.#configHidden.resourceTable, tbl);
        }

        // Rob table
        {
            let tbl = this.ensureRobTable();
            setHidden(this.#configHidden.robs, tbl);
        }

        this.update();
    }

    /**
     * Update an existing table with new data
     * @param {HTMLElement} robTable
     */
    fillRobTable(robTable) {

        // Player name and total steal count header cells
        // let header = robTable.tHead;
        // let headerRow = header.rows[0];
        // let playerHeaderCell = headerRow.cells[0];
        let i = this.#playerNames.length;

        // Rows for player i robbing player j. And one last cell for rob total
        let tblBody = robTable.tBodies[0];
        for (i = 0; i < this.#playerNames.length; i++) {
            const thief = this.#playerNames[i];
            let row = tblBody.rows[i];
            let playerRowCell = row.cells[0];
            playerRowCell.innerHTML = this.renderPlayerCellSteals(thief);
            for (let j = 0; j < this.#playerNames.length; ++j) {
                //if (j === i) continue;
                const victim = this.#playerNames[j];
                let robCount = this.#track.robs[thief][victim];
                if (robCount === undefined) { alertIf(43); robCount = 0; }
                const robAdvantage = robCount - this.#track.robs[victim][thief];
                const irrelevant = robCount === 0 && robAdvantage === 0;
                const robColour = robAdvantage > 0 ? "#00a000"
                    : robAdvantage < 0 ? "#a00000"
                        : "#000000";
                const style = `style="color:${robColour}"`;
                let cell = row.cells[j + 1];
                cell.innerHTML = irrelevant ? "" : `<span ${style}>${robCount}</span>`;
            }
            let j = this.#playerNames.length;
            let cell = row.cells[j + 1];
            let taken = this.#track.robsTaken[thief];
            if (taken === undefined) { alertIf(44); taken = 0; }
            const sevenStr = this.#track.robsSeven[thief] ? this.#track.robsSeven[thief].toString() : " ";
            const knightsCount = taken - this.#track.robsSeven[thief];
            const knightStr = knightsCount ? `+${knightsCount.toString()}` : "  ";
            cell.innerHTML = taken === 0 ? "" : `<span style="color:${this.#colour_map[thief]}">${sevenStr}${knightStr}</span>`;
        }

        // Final row for lost totals and steal totals
        i = this.#playerNames.length;
        let row = tblBody.rows[i];
        for (let j = 0; j < this.#playerNames.length; ++j) {
            const victim = this.#playerNames[j];
            let lostCount = this.#track.robsLost[victim];
            if (lostCount === undefined) { alertIf(45); lostCount = 0; }
            let cell = row.cells[j + 1];
            cell.innerHTML = lostCount === 0 ? "" : `<span style="color:${this.#colour_map[victim]}">${lostCount}</span>`;
        }
        let j = this.#playerNames.length;
        let cell = row.cells[j + 1];
        cell.innerHTML = this.#track.robsTotal === 0 ? "" : `${this.#track.robsTotal}`;
    }

    /**
     * Generate new resource table
     * @return {HTMLElement}
     */
    generateResourceTable() {
        let tbl = document.createElement("table");
        // tbl.setAttribute("cellspacing", 0); // ?
        // tbl.setAttribute("cellpadding", 0);

        //----------------------------------------------------------------------
        // Header row - one column per resource, plus player column
        //----------------------------------------------------------------------

        let header = tbl.createTHead();
        header.className = "cocaco-tbl-header";
        let headerRow = header.insertRow(0);
        let playerHeaderCell = headerRow.insertCell(0);
        playerHeaderCell.addEventListener("click", this.#context.recoverNamesCallback, false);
        playerHeaderCell.className = "cocaco-tbl-player-col-header";
        // const icon = document.createElement("img");
        // const text = document.createElement("div");
        // icon.src = `${theBrowser.runtime.getURL("assets/coconut_32.png")}`;
        // playerHeaderCell.appendChild(icon);
        // playerHeaderCell.appendChild(text);
        for (let i = 0; i < Multiverse.resources.length; i++) {
            let resourceHeaderCell = headerRow.insertCell(i + 1);
            resourceHeaderCell.addEventListener("click", this.#context.recoverCardsCallback, false);
            resourceHeaderCell.className = "cocaco-tbl-cell";
        }
        for (const [i, name] of Object.keys(Multiverse.costs).entries()) {
            let headerCell = headerRow.insertCell(i + 1 + Multiverse.resources.length);
            headerCell.className = "cocaco-tbl-cell";
            headerCell.innerHTML = this.#iconElements[name];

            // Abuse the building header cells to toggle subplots. We do not
            // particularly care how the mapping is.
            headerCell.addEventListener("click", () => this.toggle(i), false);
        }

        // TODO Make lambdas to data members?
        const measureTotalCountFunction = (playerName) => {
            // Show the most likely value as default
            const defa = this.#multiverse.guessAndRange[playerName].cardSum[2];
            const guessStr = prompt(`${playerName}'s true card count:`, defa.toString());
            const guessCount = parseInt(guessStr, 10)
            this.#multiverse.collapseExactTotal(playerName, guessCount);

            this.render();
        };

        const guessCardCountFunction = (playerName, resourceIndex, defaultCount) => {
            const resourceName = Multiverse.getResourceName(resourceIndex);
            const icon = utf8Symbols[resourceName];
            const guessStr = prompt(`How many ${icon} has ${playerName}?`, defaultCount.toString());

            // If guessStr starts with a digit, it has no operator
            const startsWithDigit = guessStr.match(/^\d+/);
            if (startsWithDigit) {
                const guessCount = parseInt(guessStr, 10);
                this.#multiverse.weightGuessExact(playerName, resourceIndex, guessCount);
            }
            else {
                const guessCount = parseInt(guessStr.slice(1), 10);
                const operator = guessStr[0];
                if (!Object.hasOwn(predicates, operator)) // Sanity check
                {
                    log("[ERROR] Unknown operator: ", operator);
                    alertIf(52);
                }
                this.#multiverse.weightGuessPredicate(
                    playerName, resourceIndex,
                    predicates[operator].f(guessCount), // Returns predicate lambda
                    predicates[operator].name(guessCount));
                log(`[NOTE] Generating guess for ${playerName}[${icon}] ${operator} ${guessCount}`);
            }

            this.render(); // Show consequences of guess immediately
        };
        const guessHasNoBuilding = (playerName, buildingName) => {
            this.#multiverse.weightGuessNotAvailable(playerName, Multiverse.costs[buildingName]);
            this.render();
        };

        //----------------------------------------------------------------------
        // One resource table row per player
        //----------------------------------------------------------------------

        let tblBody = tbl.createTBody();
        for (let i = 0; i < this.#playerNames.length; i++) {
            const player = this.#playerNames[i];
            let row = tblBody.insertRow(i);
            row.className = "cocaco-tbl-row";
            let playerRowCell = row.insertCell(0);
            playerRowCell.className = "cocaco-tbl-player-col-cell";   // Same as for rob table
            playerRowCell.addEventListener("click", measureTotalCountFunction.bind(null, player), false);
            // Resources
            for (let j = 0; j < Multiverse.resources.length; j++) {
                const res = Multiverse.getResourceName(j);
                let cell = row.insertCell(j + 1);
                cell.className = "cocaco-tbl-cell";   // Same as for rob table
                cell.addEventListener("click", guessCardCountFunction.bind(null, player, j, this.#multiverse.guessAndRange[player][res][2]), false);
            }
            // Buildings
            let j = Multiverse.resources.length + 1;
            let addBuildFunc = b => {
                let cell = row.insertCell(j);
                cell.addEventListener("click", guessHasNoBuilding.bind(null, player, b), false);
                cell.className = "cocaco-tbl-cell";
                ++j;
            };
            Object.keys(Multiverse.costs).forEach(addBuildFunc);
        }
        return tbl;
    }

    /**
     * Ensure existence of resoruce table element, creating if necessary
     * @return {HTMLElement}
     */
    ensureResourceTable() {
        let tbl = document.getElementById(Render.#ids.resourceTable);
        if (tbl === null) {
            tbl = this.generateResourceTable();
            tbl.id = Render.#ids.resourceTable;
            document.body.appendChild(tbl);
        }
        return tbl;
    }

    /**
     * Ensure existence of rolls plot element
     * @return {HTMLElement}
     */
    ensureRollsPlot() {
        let e = document.getElementById(Render.#ids.rollsPlot);
        if (e === null) {
            e = document.createElement("div");
            e.id = Render.#ids.rollsPlot;
            document.body.appendChild(e);
        }
        return e;
    }

    /**
     * Ensure existence of resoruce plot element
     * @return {HTMLElement}
     */
    ensureResourcePlot() {
        let e = document.getElementById(Render.#ids.bubblePlot);
        if (e === null) {
            e = document.createElement("div");
            e.id = Render.#ids.bubblePlot;
            //plt.class = "plot-window"; // ❔
            document.body.appendChild(e);
        }
        return e;
    }

    /**
     * Ensure existence of rob table element
     * @return {HTMLElement}
     */
    ensureRobTable() {
        let tbl = document.getElementById(Render.#ids.robTable);
        if (tbl === null) {
            tbl = this.generateRobTable();
            tbl.id = Render.#ids.robTable;
            document.body.appendChild(tbl);
        }
        return tbl;
    }

    /**
     * Update existing resoruce table element with new data
     * @param {HTMLElement} tbl
     */
    fillResourceTable(tbl) {
        // Header row - one column per resource, plus player column
        let header = tbl.tHead;
        let headerRow = header.rows[0];
        let playerHeaderCell = headerRow.cells[0];
        playerHeaderCell.textContent = `${this.#multiverse.worldCount()} 🌎`;
        for (let i = 0; i < Multiverse.resources.length; i++) { // TODO use spans to separate number from icon
            let resourceType = Multiverse.getResourceName(i);
            let resourceHeaderCell = headerRow.cells[i + 1];
            const total = this.#multiverse.totalResourceCounts[resourceType];
            const numberString = total > 0 ? `${total}` : "";
            resourceHeaderCell.innerHTML = numberString + this.#iconElements[resourceType];
        }

        // One resource table row per player
        let tblBody = tbl.tBodies[0];
        for (let i = 0; i < this.#playerNames.length; i++) {
            const player = this.#playerNames[i];
            let row = tblBody.rows[i];
            let playerRowCell = row.cells[0];
            playerRowCell.innerHTML = this.renderPlayerCell(player);
            for (let j = 0; j < Multiverse.resources.length; j++) {
                const res = Multiverse.getResourceName(j);
                let cell = row.cells[j + 1];
                const resCount = this.#multiverse.guessAndRange[player][res][2]; // Guess
                const fraction = this.#multiverse.guessAndRange[player][res][1]; // Fraction
                const percentString = fraction > 0.999 ? "" : ` <span class="table-percent table-number-chance">${Math.round(fraction * 100)}%</span>`;
                const stealChance = this.#multiverse.stealProbability[player][res];
                const shadowColour = colourInterpolate(stealChance);
                cell.innerHTML = this.#multiverse.guessAndRange[player][res][3] === 0
                    ? "" // Display nothing if guaranteed 0 amount available
                    : `<span class="table-number">${resCount}</span>${percentString}<br><span class="table-percent" style="font-weight:100;background:${shadowColour}">${Math.round(stealChance * 100)}%</span>`;
                // Alternatively, background whole cell
                //if (this.#manyWorlds.guessAndRange[player][res][3] !== 0)
                //    cell.style.background = shadowColour;
            }
            // Copy the cell-adding for resource
            let j = Multiverse.resources.length + 1;
            let addBuildFunc = b => {
                const chance = this.#multiverse.affordProbability[player][b];
                let cell = row.cells[j];
                cell.innerHTML = chance < 0.001 ? "" // Show nothing if very unlikely
                    : chance > 0.999 ? "<span class='table-number table-tick'>✔️ </span>"
                        : `<span class="table-number-chance">${Math.round(chance * 100)}%</span>`;
                if (0.001 < chance)
                    cell.style.background = colourInterpolate(chance);
                else
                    cell.style.background = "";
                ++j;
            };
            Object.keys(Multiverse.costs).forEach(addBuildFunc);
        }
    }

    /**
     * Generate new rob table element
     * @return {HTMLElement}
     */
    generateRobTable() {
        let robTable = document.createElement("table");

        // Player name and total steal count header cells
        let header = robTable.createTHead();
        header.className = "cocaco-tbl-header";
        let headerRow = header.insertRow(0);
        let playerHeaderCell = headerRow.insertCell(0);
        playerHeaderCell.className = "cocaco-tbl-player-col-header";
        let i = 0;
        for (i = 0; i < this.#playerNames.length; i++) {
            let playerHeaderCell = headerRow.insertCell(i + 1);
            playerHeaderCell.className = "cocaco-tbl-cell";
            playerHeaderCell.innerHTML = `<div class="cocaco-tbl-player-col-cell-color" style="background-color:${this.#colour_map[this.#playerNames[i]]}">  </div>`; // Spaces to show the background colour only
        }
        i = this.#playerNames.length;
        let totalHeaderCell = headerRow.insertCell(i + 1);
        totalHeaderCell.className = "cocaco-tbl-total-cell";

        // Rows for player i robbing player j. And one last cell for rob total
        let tblBody = robTable.createTBody();
        for (i = 0; i < this.#playerNames.length; i++) {
            let row = tblBody.insertRow(i);
            row.className = "cocaco-tbl-row";
            let playerRowCell = row.insertCell(0);
            playerRowCell.className = "cocaco-rob-tbl-player-col-cell";   // Same as for resource table
            for (let j = 0; j < this.#playerNames.length; ++j) {
                let cell = row.insertCell(j + 1);
                cell.className = "cocaco-tbl-cell";   // Same as for resource table
            }
            let j = this.#playerNames.length;
            let cell = row.insertCell(j + 1);
            // Originally we wanted class 'cocaco-tbl-total-cell' here but it looks terrible
            cell.className = "cocaco-tbl-cell";
        }

        // Final row for lost totals and steal totals
        i = this.#playerNames.length;
        let row = tblBody.insertRow(i);
        row.className = "cocaco-tbl-total-row";
        let totalRowCell = row.insertCell(0)
        totalRowCell.className = "cocaco-tbl-cell";
        for (let j = 0; j < this.#playerNames.length; ++j) {
            let cell = row.insertCell(j + 1);
            cell.className = "cocaco-tbl-cell";
        }
        let j = this.#playerNames.length;
        let cell = row.insertCell(j + 1);
        cell.className = "cocaco-tbl-total-cell";

        return robTable;
    }

    /**
     * Generate player name element. If applicable, appends card count
     * information.
     * @param {string} player Name of a player
     * @return {string} Span element for a stylised player name
     */
    renderPlayerCell(player, robsCount = false) {
        const gar = this.#multiverse.guessAndRange[player].cardSum;
        const definite = gar[0] === gar[3]; // min === max
        const value = gar[2]; // most likely
        const padding = value >= 10 ? "" : " ";
        const sumString = gar[3] === 0 ? "  " : `${padding}${value}`;
        const post = definite ? "" : ` (${Math.round(gar[1] * 100)}%) | ${gar[0]} - ${gar[3]}`;
        return `<span class="cocaco-tbl-player-name" style="color:${this.#colour_map[player]}">${sumString} ${player}</span><span class="cocaco-tbl-unknown-stats">${post}</span>`;
    }

    /**
     * Generate player name element. If applicable, appends rob information
     * @param {string} player Name of a player
     * @return {string} Span element for a stylised player name
     */
    renderPlayerCellSteals(player) {
        const diff = this.#track.robsTaken[player] - this.#track.robsLost[player];
        const diffStr = diff ? (diff < 0 ? "" : "+") + diff : "  ";
        //const justNumber = `${diffStr}`;
        //return `<span class="cocaco-tbl-player-col-cell-color" style="background-color:${this.#colour_map[player]}">${justNumber}</span>`;
        const fullText = ` ${diffStr}`;
        return `<span class="cocaco-tbl-player-name" style="color:${this.#colour_map[player]}">${player}${fullText}</span>`
            + `<span class="cocaco-tbl-player-col-cell-color" style="background-color:${this.#colour_map[player]}">  </span>`;
    }
}

// The hook for bubbles. I guess we can keep it here.
function fillElementWithPlot(element, trackerObject, colour_map) {
    plotResourcesAsBubbles(element.id, trackerObject, colour_map);
}
