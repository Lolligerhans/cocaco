"use strict";

// Class 'State' implements the response to opbservations of the host.

class State extends Trigger {

    // Other Modules
    collusionPlanner = null;
    #updateDelay = new Delay(
        () => this.#update(),
        {
            delayTime: cocaco_config.timeout,
            delayInitially: false,
            refresh: false,
        },
    );
    multiverse = new Multiverse();
    render = null; // Must wait for colours
    renderCards = null;
    resend = null;
    track = new Track();

    outputElement = null; // Used for logging

    // State
    us = null;

    // Debug
    #allObservations = [];

    // Each observation has its own implementor
    static implementor = {};

    // TODO Always set costs in the observer?
    static costs = {
        "city": Resources.fromList(["wheat", "wheat", "ore", "ore", "ore"]),
        "devcard": Resources.fromList(["sheep", "wheat", "ore"]),
        "road": Resources.fromList(["wood", "brick"]),
        "settlement": Resources.fromList(["wood", "brick", "sheep", "wheat"]),
    };

    constructor(toggleElement, resend, outputElement) {
        super();
        this.outputElement = outputElement;
        this.resend = resend;

        this.onTrigger("observation",
            observation => this.#observe(observation));

        // Bind "click" callback to make them compare equal
        this.boundToggle = State.prototype.toggle.bind(this, null);
        const doListenToggle = toggleElement != null && cocaco_config.enableToggle;
        if (doListenToggle) {
            this.toggleElement = toggleElement;
            this.toggleElement.addEventListener("click",
                this.boundToggle, false);
        }
        console.assert(cocaco_config.replay === true || toggleElement != null,
            "Toggle element expected (unless in replay mode)");
    }

    #observe(observation) {
        if (cocaco_config.logObservations) {
            this.#allObservations.push(observation);
            console.debug("👀", this.#allObservations.length,
                observation.type, observation,
                // "all:", this.allObservations,
            );
            this.multiverse.printWorlds();
        }
        State.implementor[observation.type].call(this, observation.payload);
        this.#updateRequest();
        return false;
    }

    sendTradeHelper = function (trade) {
        console.assert(trade.give.from.name === this.us.name);
        const offerList = ColonistObserver.resourcesToCards(trade.give.resources);
        const demandList = ColonistObserver.resourcesToCards(trade.take.resources);
        const message = {
            action: 49,
            payload: {
                creator: this.us.index,
                isBankTrade: false,
                counterOfferInResponseToTradeId: null,
                offeredResources: offerList,
                wantedResources: demandList,
            },
            sequence: -1, // Auto selected
        };
        console.debug(
            "State: Sending collusion offer for",
            trade.give.to.name,
            p(message),
        );
        this.resend.sendMessage(message);
    }

    #update() {
        // Refreshes the UI. Use with delay because the plots are costly.
        console.assert(
            this.render !== null,
            "Must generate start observation first",
        );
        // We could think about setting a flag whenever something actually
        // changes. For now we trigger on every observation, which is often
        // unnecessary.
        this.render.render();
    }

    #updateRequest() {
        this.#updateDelay.request();
    }

};

// ╭───────────────────────────────────────────────────────────╮
// │ Observation implementors                                  │
// ╰───────────────────────────────────────────────────────────╯

State.implementor.buy = function ({ player, object, cost }) {
    const name = player.name;
    const resources = cost ?? State.costs[object];
    const slice = Multiverse.asSlice(resources);
    this.multiverse.mwTransformSpawn(
        name,
        Multiverse.sliceNegate(slice),
    );
}

State.implementor.collusionStart = function ({ player, players }) {
    console.debug("New Collusion:", p(players));
    const colludingPlayersNames = [player, ...players];
    this.collusionPlanner.start(colludingPlayersNames);
}

State.implementor.collusionStop = function ({ player }) {
    console.assert(player.equals(this.us), "Cannot stop collusion of others");
    this.collusionPlanner.stop();
}

State.implementor.collusionOffer = function ({ player, trade, accept }) {
    player; // Unused
    if (!this.collusionPlanner.isStarted()) {
        return;
    }
    this.multiverse.mwUpdateStats();
    const guessAndRange = this.multiverse.worldGuessAndRange;
    const plannerResult = this.collusionPlanner.evaluateOffer(
        trade, guessAndRange,
    );
    if (plannerResult === true) {
        accept();
    } else {
        // Do not interfere with auto-decline
        if (CollusionPlanner.takerHasEnough(trade, guessAndRange)) {
            console.debug("State: Rejecting offer (can afford)");
            accept(false);
        } else {
            console.debug("State: Ignoring offer (can not afford)");
        }
    }
}

State.implementor.collusionAcceptance = function ({ trade, accept }) {
    if (!this.collusionPlanner.isStarted()) {
        return;
    }
    const plannerResult = this.collusionPlanner.evaluateAccept(trade);
    if (plannerResult === true) {
        if (this.noMoreAcceptThisTurn === true) {
            // This value is reset in the 'turn()' implementor. This ensures
            // that we accept trades one by one. Accepting all at once is
            // not intended (the host server ignores the rest). The remainign
            // trades are re-opened after the trade is completed, because we
            // re-enter the "main" phase.
            console.debug("State: ❌ Skipping this acceptance!");
            return;
        }
        accept();
        this.noMoreAcceptThisTurn = true;
    } else {
        // If we manke sure to reject only once and only if all other players
        // already answered we could run
        //      accept(false);
        // here. But currently we do not check this.
    }
}

State.implementor.discard = function ({ player, resources }) {
    const name = player.name;
    const slice = Multiverse.asSlice(resources);
    const sliceTotal = Multiverse.sliceTotal(slice);
    this.multiverse.mwCollapseTotal(name, n => n >> 1 === sliceTotal);
    this.multiverse.mwTransformSpawn(
        name,
        Multiverse.sliceNegate(slice),
    );
}

State.implementor.got = function ({ player, resources }) {
    const name = player.name;
    const slice = Multiverse.asSlice(resources);
    this.multiverse.mwTransformSpawn(
        name,
        slice,
    );

    this.collusionPlanner.updateGotResources(name, resources);
}

State.implementor.mono = function ({ player, resource, resources }) {
    // Later we could additionally:
    //  - use 'resources' to learn number of stolen cards
    //  - use non-log-message frames to get stolen count per player
    //  - use player-total counts to re-measure stolen count afterwards
    const thief = player.name;
    const stolenResource = resource;
    this.multiverse.transformMonopoly(
        thief,
        Multiverse.getResourceIndex(stolenResource),
    );
    resources; // Ignore
}

State.implementor.offer = function ({ offer, targets, isCounter }) {
    const name = offer.give.from.name;
    // Offers may include unknown cards as request-for-counter
    const resources = offer.give.resources;
    if (resources.unknown != null && resources.unknwon !== 0) {
        resources.unknown = 0;
    }
    const slice = Multiverse.asSlice(resources);
    this.multiverse.mwCollapseMin(
        name,
        slice,
    );
    targets; // Ignore
    isCounter; // Ignore
}

State.implementor.roll = function ({ player, number }) {
    this.track.addRoll(number);
    if (number === 7) {
        this.track.addSeven(player.name);
    }
}

State.implementor.start = function ({ us, players }) {
    let startResources = {};
    let startEmpty = playerName => startResources[playerName] = {};
    players.allNames().forEach(startEmpty);
    this.multiverse.initWorlds(
        startResources
    );
    const allPlayerNames = players.allNames();
    this.track.init(allPlayerNames);

    console.assert(
        !this.render,
        "Do not produce Render corpses by activating this multiple times",
    );
    const usedAssets = cocaco_config.ownIcons ?
        alternativeAssets : Colony.colonistAssets;
    const nameToColour = {};
    players.all().forEach(p => nameToColour[p.name] = p.colour);
    switch (cocaco_config.render.type) {
        case "table":
            this.render = new Render(
                this.multiverse,
                this.track,
                allPlayerNames,
                nameToColour,
                // Later we could use state updates to auto-fill card counts for
                // resource recovery.
                null, // reset callback
                null, null, // Recovery callback
                usedAssets,
            );
            break;
        case "cards":
            this.render = new RenderCards(
                this.multiverse,
                this.track,
                allPlayerNames,
                nameToColour,
            );
            break;
        default:
            console.assert(false, "Invalid render type configured");
    }
    this.render.render();

    this.us = us;
    this.collusionPlanner = new CollusionPlanner(us, this.outputElement);
    if (cocaco_config.collude.autocollude === true) {
        this.collusionPlanner.start(players.all());
    }
}

State.implementor.steal = function ({ thief, victim, resource }) {
    this.track.addRob(thief.name, victim.name);

    // Unknown steal
    if (resource == null) {
        this.multiverse.branchSteal(
            victim.name,
            thief.name,
        );
        return;
    }

    // Known steal
    this.multiverse.collapseAsRandom(
        victim.name,
        Multiverse.getResourceIndex(resource),
    );
    this.multiverse.mwTransformExchange(
        victim.name,
        thief.name,
        Multiverse.asSlice({ [resource]: 1 }),
    );
}

State.implementor.trade = function ({ give, take }) {
    console.assert(give && give.from, "Inputs must be valid");
    console.assert((give.from === take.to) || give.from.name === take.to.name);
    console.assert((give.from === take.to) || take.from.name === give.to.name);

    const traderName = give.from.name;
    const giveResources = give.resources;
    const takeResources = take.resources;
    const giveSlice = Multiverse.asSlice(giveResources);
    const takeSlice = Multiverse.asSlice(takeResources);

    // ── Trade with the bank ────────────────────────────────
    if (give.to === "bank") {
        this.multiverse.mwTransformSpawn(
            traderName,
            Multiverse.sliceSubtract(takeSlice, giveSlice),
        );
        return;
    }

    // ── Trade between players ──────────────────────────────
    const otherName = give.to.name;
    this.multiverse.transformTradeByName(
        traderName,
        otherName,
        giveResources,
        takeResources,
    );

    let combinedResources = new Resources(giveResources);
    combinedResources.subtract(takeResources);
    this.collusionPlanner.updateTradeResources(
        give.from,
        give.to,
        combinedResources,
    );
}

State.implementor.turn = function ({ player, phase }) {
    console.assert(phase === "main");
    console.assert(player.equals(this.us));
    this.noMoreAcceptThisTurn = false;
    if (!this.collusionPlanner.isStarted()) {
        return;
    }
    this.multiverse.mwUpdateStats();
    const guessAndRange = this.multiverse.worldGuessAndRange;
    let trades = this.collusionPlanner.evaluateTurn(guessAndRange);
    trades.forEach(trade => {
        this.sendTradeHelper(trade);
    });
}

State.implementor.yop = function ({ player, resources }) {
    const name = player.name;
    const slice = Multiverse.asSlice(resources);
    this.multiverse.mwTransformSpawn(
        name,
        slice,
    );
}

// ╭───────────────────────────────────────────────────────────╮
// │                                                           │
// ╰───────────────────────────────────────────────────────────╯

State.prototype.toggle = function (value = null) {
    if (this.render === null) {
        console.warn("Nothing to toggle");
        return;
    }
    this.render.toggle("resourceTable", value);
}
