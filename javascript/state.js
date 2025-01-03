"use strict";


/**
 * Class 'State' implements the response to observations
 */
class State extends Trigger {

    /**
     * @type {CollusionPlanner}
     */
    collusionPlanner = null;

    /**
     * @type {Connect}
     */
    #connect = new Connect();

    /**
     * Delay object. The delay decouples the incoming observations from UI
     * updates. Require minimum delay between UI updates to reduce performance
     * impact (especially from plots).
     * @type {Delay}
     */
    #updateDelay = new Delay(
        () => this.#update(),
        {
            delayTime: cocaco_config.timeout,
            delayInitially: false,
            refresh: false,
        },
    );

    /**
     * @type {Multiverse}
     */
    multiverse = new Multiverse();

    /**
     * @type {Render|RenderCards}
     */
    render = null; // Must wait for colours

    /**
     * @type {Resend}
     */
    resend = null;

    /**
     * @type {Track}
     */
    track = new Track();

    /**
     * Used for DOM logging
     * @type {HTMLElement}
     */
    outputElement = null;

    /**
     * @type {Player}
     */
    us = null;

    /**
     * Delegate each observation types to a dedicated handler. The code dealing
     * with observation type "<observation>" can be found in
     * implementor.<observation>.
     */
    static implementor = {};

    /**
     * Resource costs associated with buyables
     */
    static costs = {
        city: Resources.fromList(["wheat", "wheat", "ore", "ore", "ore"]),
        devcard: Resources.fromList(["sheep", "wheat", "ore"]),
        road: Resources.fromList(["wood", "brick"]),
        settlement: Resources.fromList(["wood", "brick", "sheep", "wheat"]),
    };

    /**
     * @param {Observer} observer
     * The pipeline observer, deriving from 'Observer'.
     * @param {Resend} resend
     */
    constructor(observer, resend, outputElement) {
        super();
        this.outputElement = outputElement;
        this.resend = resend;

        observer.onTrigger("observation",
            observation => this.#observe(observation));

        // Use page action for enable/disable
        this.#connect.onTrigger("page_action", payload => {
            console.assert(payload === "onClicked");
            this.toggle("global");
        });
    }

    /**
     * Handler accepting observations from the outside
     * @param {*} observation
     * An observation as described by the documentation, generated by base class
     * 'Observer'.
     */
    #observe(observation) {
        State.implementor[observation.type].call(this, observation.payload);
        if (cocaco_config.log.worlds) {
            this.multiverse.printWorlds();
        }
        this.#updateRequest();
        return false; // Signal "not done" to the 'Trigger' module
    }

    /**
     * Sends a rade offer based on the given trade, using our Resend instance
     * @param {Trade} trade
     */
    sendTradeHelper(trade) {
        console.assert(trade.giver.equals(this.us));
        const offer = new Resources(trade.resources).filter(x => x > 0);
        const demand = new Resources(trade.resources).filter(x => x < 0).abs();
        const offerList = ColonistObserver.resourcesToCards(offer);
        const demandList = ColonistObserver.resourcesToCards(demand);
        const message = {
            action: 49,
            payload: {
                // The taker is ignored, targets all other players
                creator: this.us.id,
                isBankTrade: false,
                counterOfferInResponseToTradeId: null,
                offeredResources: offerList,
                wantedResources: demandList,
            },
            sequence: -1, // Auto selected
        };
        // console.debug("Sending trade message:", trade.toString(), p(message));
        this.resend.sendMessage(message);
    }

    /**
     * Refreshes the UI. Only use with delay to reduce performance impact from
     * plots.
     */
    #update() {
        console.assert(
            this.render !== null,
            "Must generate start observation first",
        );
        // We could think about setting a flag whenever something actually
        // changes. For now we trigger on every observation, which is often
        // unnecessary.
        this.render.render();
    }

    /**
     * Schedule an update with the #updateDelay.
     */
    #updateRequest() {
        this.#updateDelay.request();
    }

};

// ╭───────────────────────────────────────────────────────────╮
// │ Observation implementors                                  │
// ╰───────────────────────────────────────────────────────────╯

State.implementor.buy = function ({ player, object }) {
    const name = player.name;
    const resources = State.costs[object];
    const slice = Multiverse.asSlice(resources);
    this.multiverse.transformSpawn(
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
    console.assert(player.equals(trade.giver));
    if (!this.collusionPlanner.isStarted()) {
        return;
    }
    this.multiverse.updateStats();
    const guessAndRange = this.multiverse.guessAndRange;
    const plannerResult = this.collusionPlanner.evaluateOffer(
        trade, guessAndRange,
    );
    if (plannerResult === true) {
        accept();
    } else {
        // Do not interfere with the host auto-decline that happens when we
        //  - cannot afford the trade
        //  - have an embargo
        const haveEnough = CollusionPlanner.takerHasEnough(trade, guessAndRange);
        const weWantToDecline =
            haveEnough || cocaco_config.collude.declineImpossible;
        const isEmbargoed = this.collusionPlanner.isEmbargoedTrade(trade);
        if (weWantToDecline && !isEmbargoed) {
            // console.debug("State: Rejecting offer");
            accept(false);
        }
    }
}

State.implementor.collusionAcceptance = function ({ player, trade, accept }) {
    player; // Unused
    if (!this.collusionPlanner.isStarted()) {
        return;
    }
    const plannerResult = this.collusionPlanner.evaluateAccept(trade);
    if (plannerResult === true) {
        if (this.noMoreFinaliseThisTurn === true) {
            // This value is reset in the 'turn()' implementor. This ensures
            // that we finalise trades one by one. Accepting all at once is not
            // intended (the host server ignores the rest). The remainign trades
            // are re-opened after the trade is completed, because we re-enter
            // the "main" phase.
            // console.debug("State: ❌ Skipping this acceptance!");
            return;
        }
        accept();
        this.noMoreFinaliseThisTurn = true;
    } else {
        // If we made sure to reject only once and only after all opponents
        // answered, we could run
        //      accept(false);
        // here. But currently we do not check this.
        //
        // Because we want to allow manual trading, we also do not want to
        // auto-reject.

        // It may be possible to react only to counter offers, but we do not
        // consider this at the moment.
    }
}

State.implementor.discard = function ({ player, resources }) {
    const name = player.name;
    const slice = Multiverse.asSlice(resources);
    const sliceTotal = Multiverse.sliceTotal(slice);
    this.multiverse.collapseTotal(name, n => n >> 1 === sliceTotal);
    this.multiverse.transformSpawn(
        name,
        Multiverse.sliceNegate(slice),
    );
}

State.implementor.embargo = function ({ embargoes }) {
    this.collusionPlanner.updateEmbargoes(embargoes);
}

State.implementor.got = function ({ player, resources }) {
    const name = player.name;
    const slice = Multiverse.asSlice(resources);
    this.multiverse.transformSpawn(
        name,
        slice,
    );

    this.collusionPlanner.updateGotResources(player, resources);
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
    let offeredResources = new Resources(offer.resources).positive();
    // Offers may include unknown cards as request-for-counter. We are only
    // interested in the regular resource cards.
    offeredResources.clearSpecial();
    const slice = Multiverse.asSlice(offeredResources);
    this.multiverse.collapseMin(offer.giver.name, slice);
    targets; // Ignore
    isCounter; // Ignore
}

State.implementor.roll = function ({ player, number }) {
    this.track.addRoll(number);
    if (number === 7) {
        this.track.addSeven(player.name);
    }
}

/**
 * @param {{us:Player,players:Players}} players
 */
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
    this.multiverse.transformRandomReveal(
        victim.name,
        Multiverse.getResourceIndex(resource),
    );
    this.multiverse.transformExchange(
        victim.name,
        thief.name,
        Multiverse.asSlice({ [resource]: 1 }),
    );
}

/**
 * @param {Trade} trade
 */
State.implementor.trade = function (trade) {
    const traderName = trade.giver.name;
    let [give, take] = trade.resources.splitBySign();
    const giveSlice = Multiverse.asSlice(give);
    const takeSlice = Multiverse.asSlice(take);

    this.collusionPlanner.updateTradeResources(trade);

    // ── Trade with the bank ────────────────────────────────
    if (trade.taker === "bank") {
        this.multiverse.transformSpawn(
            traderName,
            Multiverse.sliceSubtract(takeSlice, giveSlice),
        );
        return;
    }

    // ── Trade between players ──────────────────────────────
    const otherName = trade.taker.name;
    this.multiverse.transformTradeByName(
        traderName,
        otherName,
        give,
        take,
    );
}

State.implementor.turn = function ({ player, phase }) {
    console.assert(phase === "main");
    this.noMoreFinaliseThisTurn = false;
    if (!this.collusionPlanner.isStarted()) {
        // No need to update stats
        return;
    }
    this.collusionPlanner.updateTurn(player);

    if (!player.equals(this.us)) {
        return;
    }

    this.multiverse.updateStats();
    const guessAndRange = this.multiverse.guessAndRange;
    let trades = this.collusionPlanner.evaluateTurn(guessAndRange);
    trades.forEach(trade => {
        this.sendTradeHelper(trade);
    });
}

State.implementor.yop = function ({ player, resources }) {
    const name = player.name;
    const slice = Multiverse.asSlice(resources);
    this.multiverse.transformSpawn(
        name,
        slice,
    );
}

// ╭───────────────────────────────────────────────────────────╮
// │                                                           │
// ╰───────────────────────────────────────────────────────────╯

/**
 * Toggle or set panels for 'this.render'. If the render Object exists, passes
 * the arguments to its toggle function.
 * Wraps 'this.render.toggle()'. NOP when render is not (yet) defined.
 * @param {string} [which] Panel to toggle. If not given, toggle all panels.
 * @param {boolean} [value] Value to set to. If not given, toggle values.
 */
State.prototype.toggle = function (which = null, value = null) {
    if (this.render === null) {
        console.warn("Nothing to toggle");
        return;
    }
    this.render.toggle(which, value);
}
