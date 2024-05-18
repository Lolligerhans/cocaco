// The user should only call ctor, render() and unrender()
class Render
{
    constructor
    (
        // ManyWorlds object using names consistent with 'colours'
        ManyWorldsObject,
        TrackObject,
        // Array in the correct order
        playerNames,
        // Colours must be consistent to ManyWorldsObject
        colour_map,
        // Usually just bind the local state to appropriate callback closures
        updateCallback,
        //haltCallback, // At log element currently
        //continueCallback, // At log element currently
        resetCallback, // Currently does nothing
        recoverCardsCallback, // Goes in the card total cells
        recoverNamesCallback, // Goes in the corner cell
        iconAssets // {"road": '<img src=...>', ...}
    )
    {
        this.ids =
        {
            resourceTable: "explorer-tbl",
            bubblePlot: "explorer-plt",
            rollsPlot: "explorer-plt-rolls",
            robTable: "explorer-rob-tbl"
        };
        this.playerNames = playerNames;
        this.colour_map = colour_map;
        this.manyWorlds = ManyWorldsObject;
        this.track = TrackObject;
        this.iconElements = iconAssets;
        this.context =
        {
            // I think the interfering main calls should only run after any
            // running main call has finished in the JS anti-concurrency model
            updateCallback: updateCallback,
            // TODO: Previously didnt exist. The new moduling thing means we can
            // more easily reset the tracker state completely. This would help
            // a lot for debugging because we can replay the same log messages
            // without setting up a separate msg replayer.
            resetCallback: resetCallback,
            // Previously was 'mwManualRecoverCards' bound to the MW object
            recoverCardsCallback: recoverCardsCallback,
            // Previously was 'mwManualFullRecovery' bound to the MW object
            recoverNamesCallback: recoverNamesCallback
        };
    }

    unrender()
    {
        try
        {
            let t = document.getElementById(this.ids.resourceTable); if (t) { t.remove(); }
            let p = document.getElementById(this.ids.bubblePlot);    if (p) { p.remove(); }
            let d = document.getElementById(this.ids.rollsPlot);     if (d) { d.remove(); }
            let r = document.getElementById(this.ids.robTable);      if (r) { r.remove(); }
        }
        catch(e)
        {
            // We don't really care if this fails at the moment, but it might help
            // identify bugs.
            console.warn("[WARNING] Exception in unrender():", e);
            alertIf(46);
        }
    }

    render(renderIf = () => true)
    {
        if (this.manyWorlds === null)
            console.error(`${this.name} this.manyWorlds is null`);
        if (this.colour_map === null)
            console.error(`${this.name} colour_map is null`);
        if (renderIf === null)
            console.error(`${this.name} renderIf is null`);

        if (!renderIf())
        {
            //console.debug("🖥 Skip display update");
            return;
        }
        //console.debug("🖥 Updaing display...");

        // TODO Draw only once then only change text content later

        // TODO generate and return stats object?
        this.manyWorlds.mwUpdateStats();     //TODO circumvents souldRenderTable()

        // Display
        let body = document.getElementsByTagName("body")[0];

        //----------------------------------------------------------------------
        // Display resource plot
        //----------------------------------------------------------------------

        if (configPlotBubbles === true)
        {
            let existingPlot = document.getElementById(this.ids.bubblePlot);
            try { if (existingPlot) { existingPlot.remove(); } }
            catch (e) { console.warn("had an issue deleting the bubble plot", e); }
            let plt = document.createElement("plot");
            plt.id = this.ids.bubblePlot;
            // FIXME I dont remember what this 'plot-window' is meant to do. The entire css syling is a mess anyway.
    //        plt.class = "plot-window";
            body.appendChild(plt);
            fillElementWithPlot(plt, this.manyWorlds, this.colour_map);
        }

        //----------------------------------------------------------------------
        // Dispaly rolls histogram
        //----------------------------------------------------------------------

        if (configPlotRolls === true)
        {
            let existingPlot = document.getElementById(this.ids.rollsPlot);
            try { if (existingPlot) { existingPlot.remove(); } }
            catch (e) { console.warn("had an issue deleting the rolls plot", e); }
            // TODO I think we should not give an ID here because we set it below (?)
            let plt = document.createElement("roll-plot");
            plt.id = this.ids.rollsPlot;
            body.appendChild(plt);
            this.track.fillRollPlot(plt);
        }

        //======================================================================
        // Display table
        //======================================================================

        let existingTbl = document.getElementById(this.ids.resourceTable);
        try { if (existingTbl) { existingTbl.remove(); } }
        catch (e) { console.warn("had an issue deleting the table", e); }
        let tbl = document.createElement("table");
        tbl.id = this.ids.resourceTable;

        tbl.setAttribute("cellspacing", 0);
        tbl.setAttribute("cellpadding", 0);

        //----------------------------------------------------------------------
        // Header row - one column per resource, plus player column
        //----------------------------------------------------------------------

        let header = tbl.createTHead();
        header.className = "explorer-tbl-header";
        let headerRow = header.insertRow(0);
        let playerHeaderCell = headerRow.insertCell(0);
        playerHeaderCell.addEventListener("click", this.context.recoverNamesCallback, false);
        playerHeaderCell.innerHTML = `${this.manyWorlds.worldCount()} 🌎`;
        playerHeaderCell.className = "explorer-tbl-player-col-header";
        for (let i = 0; i < this.manyWorlds.resources.length; i++)
        {
            let resourceType = this.manyWorlds.getResourceName(i);
            let resourceHeaderCell = headerRow.insertCell(i + 1);
            resourceHeaderCell.addEventListener("click", this.context.recoverCardsCallback, false);
            resourceHeaderCell.className = "explorer-tbl-cell";
            const total = this.manyWorlds.mwTotals[resourceType];
            const numberString = total > 0
                               ? `${total}`
                               : "";
            resourceHeaderCell.innerHTML = numberString + this.iconElements[resourceType];
        }
        for (const [i, name] of Object.keys(this.manyWorlds.costs).entries())
        {
            let headerCell = headerRow.insertCell(i + 1 + this.manyWorlds.resources.length);
            headerCell.className = "explorer-tbl-cell";
            headerCell.innerHTML = this.iconElements[name];
        }

        // TODO Is there performance problem defining lambdas each time?
        // FIXME Once the class thing is done this would appropriately be thrown
        // into the class as a member function
        const guessCardCountFunction = (playerName, resourceIndex, defaultCount) =>
        {
            const resourceName = this.manyWorlds.getResourceName(resourceIndex);
            const icon = resourceIcons[resourceName];
            const guessStr = prompt(`How many ${icon} has ${playerName}?`, defaultCount.toString());

            // If guessStr starts with a digit, it has no operator
            const startsWithDigit = guessStr.match(/^\d+/);
            if (startsWithDigit)
            {
                const guessCount = parseInt(guessStr, 10);
                this.manyWorlds.mwWeightGuessExact(playerName, resourceIndex, guessCount);
            }
            else
            {
                const guessCount = parseInt(guessStr.slice(1), 10);
                const operator = guessStr[0];
                if (!Object.hasOwn(predicates, operator)) // Sanity check
                {
                    log("[ERROR] Unknown operator: ", operator);
                    alertIf(52);
                }
                this.manyWorlds.mwWeightGuessPredicate(
                    playerName, resourceIndex,
                    predicates[operator].f(guessCount), // Returns predicate lambda
                    predicates[operator].name(guessCount));
                log(`[NOTE] Generating guess for ${playerName}[${icon}] ${operator} ${guessCount}`);
            }

            this.render(); // Show consequences of guess immediately
        };
        const guessHasNoBuilding = (playerName, buildingName) =>
        {
            this.manyWorlds.mwWeightGuessNotavailable(playerName, this.manyWorlds.costs[buildingName]);
            this.render();
        };

        //----------------------------------------------------------------------
        // One resource table row per player
        //----------------------------------------------------------------------

        let tblBody = tbl.createTBody();
        for (let i = 0; i < this.playerNames.length; i++) {
            const player = this.playerNames[i];
            let row = tblBody.insertRow(i);
            row.className = "explorer-tbl-row";
            let playerRowCell = row.insertCell(0);
            playerRowCell.className = "explorer-tbl-player-col-cell";   // Same as for rob table
            playerRowCell.innerHTML = this.renderPlayerCell(player);
            for (let j = 0; j < this.manyWorlds.resources.length; j++)
            {
                const res = this.manyWorlds.getResourceName(j);
                let cell = row.insertCell(j + 1);
                cell.className = "explorer-tbl-cell";   // Same as for rob table
                cell.addEventListener("click", guessCardCountFunction.bind(null, player, j, this.manyWorlds.worldGuessAndRange[player][res][2]), false);
                const resCount = this.manyWorlds.worldGuessAndRange[player][res][2]; // Guess
                const fraction = this.manyWorlds.worldGuessAndRange[player][res][1]; // Fraction
                const percentString = fraction > 0.999 ? "" : ` <span class="table-percent table-number-chance">${Math.round(fraction * 100)}%</span>`;
                const stealChance = this.manyWorlds.mwSteals[player][res];
                const shadowColour = colourInterpolate(stealChance);
                cell.innerHTML = this.manyWorlds.worldGuessAndRange[player][res][3] === 0
                               ? "" // Display nothing if guaranteed 0 amount available
                               : `<span class="table-number">${resCount}</span>${percentString}<br><span class="table-percent" style="font-weight:100;background:${shadowColour}">${Math.round(stealChance * 100)}%</span>`;
                // Alternatively, background whole cell
                //if (this.manyWorlds.worldGuessAndRange[player][res][3] !== 0)
                //    cell.style.background = shadowColour;
            }
            // Copy the cell-adding for resource
            let j = this.manyWorlds.resources.length + 1;
            let addBuildFunc = b =>
            {
                const chance = this.manyWorlds.mwBuildsProb[player][b];
                let cell = row.insertCell(j);
                cell.addEventListener("click", guessHasNoBuilding.bind(null, player, b), false);
                cell.className = "explorer-tbl-cell";
                cell.innerHTML = chance < 0.001 ? "" // Show nothing if very unlikely
                               : chance > 0.999 ? "<span class='table-number'>✔️ </span>"
                               : `<span class="table-number-chance">${Math.round(chance * 100)}%</span>`;
                if (0.001 < chance)
                    cell.style.background = colourInterpolate(chance);
                ++j;
            };
            Object.keys(this.manyWorlds.costs).forEach(addBuildFunc);
        }

        //----------------------------------------------------------------------
        // Display rob table
        //----------------------------------------------------------------------

        const robTable = this.generateRobTable();

        body.appendChild(tbl);
        body.appendChild(robTable);

        tbl.setAttribute("border", "2"); // (?)

        //console.debug("🖥 Updated display");
    }

    generateRobTable()
    {
        let existingTbl = document.getElementById(this.ids.robTable);
        try { if (existingTbl) { existingTbl.remove(); } }
        catch (e) { console.warn("had an issue deleting the rob table", e); }
        let robTable = document.createElement("table");
        robTable.id = this.ids.robTable;

        // TODO effect?
        robTable.setAttribute("cellspacing", 0);
        robTable.setAttribute("cellpadding", 0);

        // Player name and total steal count header cells
        let header = robTable.createTHead();
        header.className = "explorer-tbl-header";
        let headerRow = header.insertRow(0);
        let playerHeaderCell = headerRow.insertCell(0);
        playerHeaderCell.className = "explorer-tbl-player-col-header";
        //playerHeaderCell.innerHTML = "Criminals";
        let i = 0;
        for (i = 0; i < this.playerNames.length; i++)
        {
            let playerHeaderCell = headerRow.insertCell(i + 1);
            playerHeaderCell.className = "explorer-tbl-cell";
            playerHeaderCell.innerHTML = `<div class="explorer-tbl-player-col-cell-color" style="background-color:${this.colour_map[this.playerNames[i]]}">  </div>`; // Spaces to show the background colour only
        }
        i = this.playerNames.length;
        let totalHeaderCell = headerRow.insertCell(i + 1);
        totalHeaderCell.className = "explorer-tbl-total-cell";
        totalHeaderCell.innerHTML = `<div class="explorer-tbl-player-name">🗡</div>`; // Using shield emoji

        // Rows for player i robbing player j. And one last cell for rob total
        let tblBody = robTable.createTBody();
        for (i = 0; i < this.playerNames.length; i++)
        {
            const thief = this.playerNames[i];
            let row = tblBody.insertRow(i);
            row.className = "explorer-tbl-row";
            let playerRowCell = row.insertCell(0);
            playerRowCell.className = "explorer-rob-tbl-player-col-cell";   // Same as for resource table
            playerRowCell.innerHTML = this.renderPlayerCell(thief, true); // true -> add rob counts
            for (let j = 0; j < this.playerNames.length; ++j)
            {
    //            if (j === i) continue;
                const victim = this.playerNames[j];
                let robCount = this.track.robs[thief][victim];
                if (robCount === undefined) { alertIf(43); robCount = 0; }
                const robAdvantage = robCount - this.track.robs[victim][thief];
                const irrelevant = robCount === 0 && robAdvantage === 0;
                const robColour = robAdvantage > 0 ? "#00a000"
                                : robAdvantage < 0 ? "#a00000"
                                :                    "#000000";
                const style = `style="color:${robColour}"`;
                let cell = row.insertCell(j + 1);
                cell.className = "explorer-tbl-cell";   // Same as for resource table
                cell.innerHTML = irrelevant ? "" : `<span ${style}>${robCount}</span>`;
            }
            let j = this.playerNames.length;
            let cell = row.insertCell(j + 1);
            let taken = this.track.robsTaken[thief];
            if (taken === undefined) { alertIf(44); taken = 0; }
            const sevenStr = this.track.robsSeven[thief] ? this.track.robsSeven[thief].toString() : " ";
            const knightsCount = taken - this.track.robsSeven[thief];
            const knightStr = knightsCount ? `+${knightsCount.toString()}` : "  ";
            // Originally we wanted class 'explorer-tbl-total-cell' here but it looks terrible
            cell.className = "explorer-tbl-cell";
            cell.innerHTML = taken === 0 ? "" : `<span style="color:${this.colour_map[thief]}">${sevenStr}${knightStr}</span>`;
        }

        // Final row for lost totals and steal totals
        i = this.playerNames.length;
        let row = tblBody.insertRow(i);
        row.className="explorer-tbl-total-row";
        let totalRowCell = row.insertCell(0)
        totalRowCell.className = "explorer-tbl-cell";
        totalRowCell.innerHTML = "🛡";
        for (let j = 0; j < this.playerNames.length; ++j)
        {
            const victim = this.playerNames[j];
            let lostCount = this.track.robsLost[victim];
            if (lostCount === undefined) { alertIf(45); lostCount = 0; }
            let cell = row.insertCell(j + 1);
            cell.className = "explorer-tbl-cell";
            cell.innerHTML = lostCount === 0 ? "" : `<span style="color:${this.colour_map[victim]}">${lostCount}</span>`;
        }
        let j = this.playerNames.length;
        let cell = row.insertCell(j + 1);
        cell.className = "explorer-tbl-total-cell";
        cell.innerHTML = this.track.robsTotal === 0 ? "" : `${this.track.robsTotal}`;

        robTable.addEventListener("click", this.context.updateCallback, false);
        return robTable;
    }

    // TODO This is really two function. Split em.
    renderPlayerCell(player, robsCount = false)
    {
        if (robsCount === false)
        {
            const gar = this.manyWorlds.worldGuessAndRange[player]["unknown"];
            const stealProb = Math.round(this.manyWorlds.mwSteals[player]["unknown"] * 100);
            const unknownString = gar[3] === 0
                                ? ""
                                : ` + ${gar[2]} (${Math.round(gar[1] * 100)}%) | ${stealProb}%`;
            return `<span class="explorer-tbl-player-name" style="color:${this.colour_map[player]}">${player}</span>`
                 + `<span class="explorer-tbl-unknown-stats">${unknownString}</span>`;
        }
        else
        {
            const diff = this.track.robsTaken[player] - this.track.robsLost[player];
            const diffStr = diff ? (diff < 0 ? "" : "+") + diff : "  ";
            //const justNumber = `${diffStr}`;
            //return `<span class="explorer-tbl-player-col-cell-color" style="background-color:${this.colour_map[player]}">${justNumber}</span>`;
            const fullText = ` ${diffStr}`;
            return `<span class="explorer-tbl-player-name" style="color:${this.colour_map[player]}">${player}${fullText}</span>`
                + `<span class="explorer-tbl-player-col-cell-color" style="background-color:${this.colour_map[player]}">  </span>`;
        }
    }

}

// The hook for bubbles. I guess we can keep it here.
function fillElementWithPlot(element, trackerObject, colour_map)
{
    plotResourcesAsBubbles(element.id, trackerObject, colour_map);
}


// vim: shiftwidth=4:softtabstop=4:expandtab
