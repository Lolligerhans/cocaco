"use strict";

// Generic Catan state updated by Observers

class State extends Trigger {
    collude = null;
    static implementor = {};

    static costs = {
        "city": ["wheat", "wheat", "ore", "ore", "ore"],
        "devcard": ["sheep", "wheat", "ore"],
        "road": ["wood", "brick"],
        "settlement": ["wood", "brick", "sheep", "wheat"],
    };
    static resourceListToNames(nameList) {
        // TODO: Replace with Resources.fromList
        let result = {};
        for (const name of nameList) {
            result[name] = (result[name] ?? 0) + 1;
        }
        return result;
    };

    constructor(toggleElement, resend) {
        super();

        // Components
        this.multiverse = new Multiverse();
        this.track = new Track();
        this.render = null; // Must wait for colours
        this.resend = resend;

        // Collusion testing
        // TODO: This is too much for the state module. This should all go intu
        //       the collusion module!
        //       Maybe even put the timing into the observer module?
        this.us = null;
        // this.playerNames = null;
        this.expectedSequence = null;
        this.collusionDelay = new Delay(
            () => {
                // Make sure we do not update when leaving the valid state
                // during the collusion delay.
                this.updateCollusion(
                    () => {
                        const sequenceNow = this.resend.nextSequence();
                        const isStillValid = sequenceNow === this.expectedSequence;
                        console.debug("valid():",
                            isStillValid, this.expectedSequence,
                            sequenceNow,
                        );
                        return isStillValid;
                    }
                );
            },
            {
                delayTime: 1000,
                delayInitially: true,
                refresh: true,
            }
        );
        // Names to request from collusion module
        this.colludingPair = null;
        this.ourTurn = false; // Set dependign on "actilbleActions" or some such

        this.onTrigger("observation",
            observation => this.#observe(observation));
        // this.onTrigger(null, data => {
        //     console.debug("State: incoming trigger for:", data);
        // })

        this.renderTimeout = -1; // Set when on cooldown. Reset  to -1 after.
        this.needsUpdate = false; // Set when updating during cooldown

        // Bind "click" callback to make them compare equal
        this.boundToggle = State.prototype.toggle.bind(this, null);
        const doListenToggle = toggleElement != null && cocaco_config.enableToggle;
        if (doListenToggle) {
            this.toggleElement = toggleElement;
            this.toggleElement.addEventListener("click",
                this.boundToggle, false);
        }
        console.assert(cocaco_config.replay === true || toggleElement != null,
            "Toggle element required in regular mode");

        // Debug
        this.allObservations = [];
    }

    #observe(observation) {
        if (cocaco_config.logObservations) {
            this.allObservations.push(observation);
            console.debug("👀", this.allObservations.length,
                observation.type, observation,
                // "all:", this.allObservations,
            );
            // this.multiverse.printWorlds(true);
        }
        State.implementor[observation.type].call(this, observation.payload);

        this.#update();

        return false;
    }

    // Schedule update. Update at most once per second. Update immediately if
    // possible.
    #update() {
        console.assert(this.render !== null,
            "Must generate start observation first");

        // On cooldown?
        if (this.renderTimeout !== -1) {
            this.needsUpdate = true;
            return;
        }

        this.needsUpdate = false;
        this.render.render();

        // Start cooldown
        this.renderTimeout = setTimeout(
            () => {
                this.renderTimeout = -1; // Takes precendence over 'needsUpdate'
                this.render.render(() => this.needsUpdate);
            },
            cocaco_config.timeout,
        );
    }
};

// ╭───────────────────────────────────────────────────────────╮
// │ Observation implementors                                  │
// ╰───────────────────────────────────────────────────────────╯

State.implementor.buy = function ({ player, object, cost }) {
    const name = player.name;
    const resourceList = cost ?? State.costs[object];
    const asNames = State.resourceListToNames(resourceList);
    const slice = Multiverse.asSlice(asNames);
    this.multiverse.mwTransformSpawn(
        name,
        Multiverse.sliceNegate(slice),
    );
}

State.implementor.collude = function ({ players }) {
    console.debug("New Collusion:", p(players));
    this.colludingPair = players;
    this.collude = new Collude(players.map(p => p.name));
}

State.implementor.collusionOffer = function ({ player, trade, accept }) {
    this.multiverse.mwUpdateStats();
    const guessAndRange = this.multiverse.worldGuessAndRange;
    if (this.collude === null) {
        console.debug("Ignoring collusion offer: No collusion yet");
        return;
    }
    if (trade.give.from === null || trade.give.to === null) {
        debugger; // FIXME: Bug
    }
    if (trade.give.from.name === this.us.name) {
        console.debug("Ignoring collusion offer: From ourselves");
        return;
    }
    let newTemplate = this.collude.getCollusionTemplate(
        trade.give.from.name,
        trade.give.to.name,
    );
    if (newTemplate === null) {
        console.debug(
            "Ignoring collusion offer: No template means not a colluding team",
        );
        return;
    }
    Collude.adjustForTaker(newTemplate, trade.give.to.name, guessAndRange);
    const newMatch = Trade.tradeMatchesTemplate(newTemplate, trade);
    if (!newMatch) {
        console.debug(
            "No match for collusion offer (wont accept):",
            Trade.tradeCombined(trade).toSymbols(),
            "trade ⚡ template", newTemplate.toSymbols(),
        );
        return;
    }
    accept();
}

State.implementor.collusionAcceptanceOffer = function ({ trade, accept }) {
    // TODO: The collusion implementations should go into a collusion
    //       organizer module.
    if (this.collude === null) {
        return;
    }
    if (trade.give.from.name !== this.us.name) {
        console.debug("Ignoring acceptance: Not our trade");
        return false;
    }
    console.assert(this.colludingPair !== 0,
        // TODO: Keep this assert?
        "Observer should only produces these observation after collusion started"
    );
    if (this.collude === null) {
        console.debug("Ignoring acceptance: No collusion yet");
        console.assert(false, "unreachable");
        return false;
    }
    let newTemplate = this.collude.getCollusionTemplate(
        trade.give.from.name,
        trade.give.to.name,
    );
    if (newTemplate === null) {
        debugger; // TEST: Does it work?
        console.debug("Ignoring offer: No template means not a colluding team");
        return;
    }
    const newMatches = Trade.tradeMatchesTemplate(newTemplate, trade);
    if (!newMatches) {
        console.debug(
            "No match (wont finalize):",
            Trade.tradeCombined(trade).toSymbols(),
            "trade ⚡ template", newTemplate.toSymbols(),
        );
        return;
    }
    accept();
}

State.implementor.discard = function ({ player, resources }) {
    const name = player.name;
    const asNames = State.resourceListToNames(resources);
    const slice = Multiverse.asSlice(asNames);
    const sliceTotal = Multiverse.sliceTotal(slice);
    this.multiverse.mwCollapseTotal(name, n => n >> 1 === sliceTotal);
    this.multiverse.mwTransformSpawn(
        name,
        Multiverse.sliceNegate(slice),
    )
}

State.implementor.got = function ({ player, resources }) {
    const name = player.name;
    const asNames = State.resourceListToNames(resources);
    const slice = Multiverse.asSlice(asNames);
    this.multiverse.mwTransformSpawn(
        name,
        slice,
    );

    if (this.collude !== null) {
        this.collude.updateGotResources(
            name,
            Resources.fromList(resources),
        );
    }
}

State.implementor.mono = function ({ player, resource, resources }) {
    const thief = player.name;
    const stolenResource = resource;
    this.multiverse.transformMonopoly(
        thief,
        Multiverse.getResourceIndex(stolenResource),
    );
    resources; // Ignore
    // TODO: Use 'resources' to learn number of stolen cards
    // TODO: Use socket source to get count per player
}

State.implementor.offer = function ({ offer, targets, isCounter }) {
    const name = offer.give.from.name;
    const asNames = State.resourceListToNames(offer.give.resources);
    if (asNames.unknown != null && asNames.unknwon !== 0) {
        asNames.unknown = 0;
    }
    const slice = Multiverse.asSlice(asNames);
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

State.implementor.start = function ({ us, players, colours }) {
    let startResources = {};
    let startEmpty = player => startResources[player.name] = {};
    players.forEach(startEmpty);
    this.multiverse.initWorlds(
        startResources
    );
    const playerNames = players.map(p => p.name);
    // this.playerNames = playerNames;
    this.track.init(playerNames);

    console.assert(!this.render,
        "Do not produce Render corpses by activating this multiple times");
    if (!this.render) {
        this.render = new Render(
            this.multiverse,
            this.track,
            playerNames,
            colours,
            null, // reset callback
            // TODO: Recovery mode
            null, null, // Recovery callback
            cocaco_config.ownIcons ? alternativeAssets : Colony.colonistAssets,
        );
        this.render.render();
    }

    this.us = us;
    if (cocaco_config.autocollude === true) {
        this.collude = new Collude(playerNames);
    }
}

State.implementor.steal = function ({ thief, victim, resource }) {
    this.track.addRob(thief.name, victim.name);

    // Unknown steal
    if (!resource) {
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
        Multiverse.asSlice({ [resource]: 1 })
    )
}

State.implementor.trade = function ({ give, take }) {
    console.assert(give && give.from, "Inputs must be valid");
    console.assert((give.from === take.to) || give.from.name === take.to.name);
    console.assert((give.from === take.to) || take.from.name === give.to.name);

    const traderName = give.from.name;
    const giveNames = State.resourceListToNames(give.resources);
    const takeNames = State.resourceListToNames(take.resources);
    const giveSlice = Multiverse.asSlice(giveNames);
    const takeSlice = Multiverse.asSlice(takeNames);

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
        giveNames,
        takeNames,
    );

    if (this.collude !== null) {
        let asResources = Resources.fromList(give.resources);
        asResources.subtract(Resources.fromList(take.resources));
        this.collude.updateTradeResources(
            traderName,
            otherName,
            asResources,
        );
    }
}

State.implementor.turn = function ({ player, phase }) {
    console.assert(phase === "main");
    console.assert(player.name === this.us.name);

    if (this.collude === null) {
        console.debug("Not colluding - nothing to do");
        return;
    }

    this.collude.print();
    console.debug("Requesting collusionDelay");
    this.expectedSequence = this.resend.nextSequence();
    // this.collusionDelay.request();
    this.updateCollusion();
}

State.implementor.yop = function ({player, resources}) {
    const name = player.name;
    const asNames = State.resourceListToNames(resources);
    const slice = Multiverse.asSlice(asNames);
    this.multiverse.mwTransformSpawn(
        name,
        slice,
    );
}

// ╭───────────────────────────────────────────────────────────╮
// │                                                           │
// ╰───────────────────────────────────────────────────────────╯

// TODO: Make this a method of the collusion object
State.prototype.updateCollusion = function (valid = () => true) {
    if (!valid()) {
        // Because we delay the offer, it may no longer be our turn.
        console.debug("Suppressing outdated collusion update");
        return;
    }
    console.assert(this.collude !== null, "collude should be initialized");
    console.debug("Time to make our turn!");
    this.multiverse.mwUpdateStats();
    const guessAndRange = this.multiverse.worldGuessAndRange;
    const toList = res => res.map(
        r => ColonistObserver.cardMapInverse[r],
    );

    const makeOfferTo = other => {
        const newTemplate = this.collude.getCollusionTemplate(
            this.us.name,
            other,
        );
        Collude.adjustForGiver(newTemplate, this.us.name, guessAndRange);
        Collude.adjustForTaker(newTemplate, other, guessAndRange);
        const isValid = Collude.adjustForTradeValidity(newTemplate);
        if (!isValid) {
            console.debug("No collusion offer to", other);
            return;
        }
        const give = new Resources(newTemplate);
        const take = new Resources(newTemplate);
        give.filter(x => x > 0);
        take.filter(x => x < 0);
        take.abs();
        const giveList = give.toList();
        const takeList = take.toList();
        const trade = Observer.property.trade({
            give: Observer.property.transfer({
                from: this.us,
                to: { name: other },
                resources: giveList,
            }),
            take: Observer.property.transfer({
                from: { name: other },
                to: this.us,
                resources: takeList,
            }),
        });
        const str = Trade.tradeCombined(trade).toSymbols();
        console.debug("Collusion offer to", other);
        const offerList = toList(trade.give.resources);
        const demandList = toList(trade.take.resources);
        const message = {
            action: 49,
            payload: {
                creator: this.us.index,
                isBankTrade: false,
                counterOfferInResponseToTradeId: null,
                offeredResources: offerList,
                wantedResources: demandList,
            },
            sequence: this.resend.nextSequence(),
        };
        console.debug("Sending collusion offer message for", other, p(message));
        this.resend.sendMessage(message);
    };
    this.collude.players().forEach(player => {
        // TODO: Should we rather offer only one player and wait until next
        //       round for the other?
        if (player !== this.us.name) {
            makeOfferTo(player);
        }
    });
}

State.prototype.toggle = function (value = null) {
    if (this.render === null) {
        console.warn("Nothing to toggle");
        return;
    }
    this.render.toggle("resourceTable", value);
}
