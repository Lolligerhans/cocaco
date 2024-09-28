"use strict";

// Generic Catan state updated by Observers

class State extends Trigger {
    static implementor = {};

    static costs = {
        "city": ["wheat", "wheat", "ore", "ore", "ore"],
        "devcard": ["sheep", "wheat", "ore"],
        "road": ["wood", "brick"],
        "settlement": ["wood", "brick", "sheep", "wheat"],
    };
    static resourceListToNames(nameList) {
        let result = {};
        for (const name of nameList) {
            result[name] = (result[name] ?? 0) + 1;
        }
        return result;
    };

    constructor(toggleElement) {
        super();

        this.multiverse = new Multiverse();
        this.track = new Track();
        this.render = null; // Must wait for colours
        this.onTrigger("observation",
            observation => this.#observe(observation));
        // this.onTrigger(null, data => {
        //     console.debug("State: incoming trigger for:", data);
        // })

        this.renderTimeout = -1; // Set when on cooldown. Reset  to -1 after.
        this.needsUpdate = false; // Set when updating during cooldown

        // Bind "click" callback to make them compare equal
        this.boundToggle = State.prototype.toggle.bind(this, null);
        this.toggleElement = toggleElement;
        this.toggleElement.addEventListener("click",
            this.boundToggle, false);
    }

    #observe(observation) {
        // console.debug("State observing:", observation.type, observation);
        State.implementor[observation.type].call(this, observation.payload);

        // console.debug("State Multiverse:", this.multiverse);
        // this.multiverse.printWorlds(true);
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
            config.timeout,
        );
    }
};

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

}

State.implementor.mono = function ({ player, resource, resources }) {
    const thief = player.name;
    const stolenResource = resource;
    this.multiverse.transformMonopoly(
        thief,
        Multiverse.getResourceIndex(stolenResource),
    );
    // TODO: Use 'resources' to learn number of stolen cards
    resources; // Ignore
}

State.implementor.offer = function ({ offer, targets, isCounter }) {
    const name = offer.give.from.name;
    const asNames = State.resourceListToNames(offer.give.resources);
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

State.implementor.start = function ({ players, colours }) {
    let startResources = {};
    let startEmpty = player => startResources[player.name] = {};
    players.forEach(startEmpty);
    this.multiverse.initWorlds(
        startResources
    );
    const playerNames = players.map(p => p.name);
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
            Colony.colonistAssets,
        );
        this.render.render();
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

    // Trade with the bank
    if (give.to === "bank") {
        this.multiverse.mwTransformSpawn(
            traderName,
            Multiverse.sliceSubtract(takeSlice, giveSlice),
        );
        return;
    }

    // Trade between players
    const otherName = give.to.name;
    this.multiverse.transformTradeByName(
        traderName,
        otherName,
        giveNames,
        takeNames,
    );
}

State.prototype.toggle = function (value = null) {
    if (this.render === null) {
        console.warn("Nothing to toggle");
        return;
    }
    this.render.toggle("resourceTable", value);
}
