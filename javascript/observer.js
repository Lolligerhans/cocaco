// Common interface used by Observers

// Observer is an abstract base class. Observers should derive from 'Observer'
// and call the standard observation methods. Derived Observers should not
// activate the "observation" trigger directly.
//
// Using the interface defined here ensures that Observer implementations
// generate only the common set of obsevations that the State understands.

"use strict";

class Observer extends Trigger {

    static buyables = ["road", "settlement", "city", "devcard"];
    static property = {};
    static phases = ["main", ""];

    // The State module/class set a callback to be notified on observations
    constructor(theState) {
        super();
        this.state = theState;
        const triggerName = "observation";
        this.onTrigger(
            triggerName,
            observation => theState.activateTrigger(triggerName, observation)
        );
    }

    // Only the standard observations should invoke this
    #observe(observation) {
        // console.debug("Observer: Making observation:", observation);
        this.activateTrigger("observation", observation);
    }

    // ╭───────────────────────────────────────────────────────╮
    // │ Standard observations                                 │
    // ╰───────────────────────────────────────────────────────╯

    // The interface defines observation functions for game events. Ideally these
    // map to Source packets in a traight forwards manner. Otherwise the Observer
    // must implement the logic to obtain the appropriate inputs.

    buy({ player, object, cost = null }) {
        let observation = {
            type: "buy",
            payload: {
                player: Observer.property.player(player),
                object: Observer.property.buyable(object),
            },
        };
        if (cost !== null) {
            console.assert(cast instanceof Resources)
            observation.payload.cost = cost;
        }
        this.#observe(observation);
    }

    collusionStart({ player, players }) {
        let observation = {
            type: "collusionStart",
            payload: {
                player: Observer.property.player(player),
                players: Observer.property.players(players),
            },
        };
        this.#observe(observation);
    }

    collusionStop({ player }) {
        let observation = {
            type: "collusionStop",
            payload: {
                player: player,
            },
        };
        this.#observe(observation);
    }

    collusionAcceptance({ player, trade, accept }) {
        console.assert(typeof accept === "function");
        let observation = {
            type: "collusionAcceptance",
            payload: {
                player: Observer.property.player(player),
                trade: Observer.property.trade(trade),
                accept: accept,
            },
        };
        this.#observe(observation);
    };

    collusionOffer({ player, trade, accept }) {
        console.assert(typeof accept === "function");
        let observation = {
            type: "collusionOffer",
            payload: {
                player: Observer.property.player(player),
                trade: Observer.property.trade(trade),
                accept: accept,
            },
        };
        this.#observe(observation);
    }

    discard({ player, resources, limit = 7 }) {
        console.assert(resources instanceof Resources);
        let observation = {
            type: "discard",
            payload: {
                player: Observer.property.player(player),
                resources: resources,
                limit: limit,
            },
        };
        this.#observe(observation);
    }

    got({ player, resources }) {
        console.assert(resources instanceof Resources);
        let observation = {
            type: "got",
            payload: {
                player: Observer.property.player(player),
                resources: resources,
            },
        };
        this.#observe(observation);
    }

    mono({ player, resource, resources }) {
        console.assert(resources instanceof Resources);
        let observation = {
            type: "mono",
            payload: {
                player: Observer.property.player(player),
                resource: Observer.property.resource(resource),
                resources: resources,
            },
        };
        this.#observe(observation);
    }

    offer({ offer, targets = [], isCounter = false }) {
        let observation = {
            type: "offer",
            payload: {
                offer: Observer.property.trade(offer),
                targets: Observer.property.players(targets),
                isCounter: isCounter,
            },
        };
        this.#observe(observation);
    }

    roll({ player, number }) {
        console.assert(2 <= number && number <= 12);
        let observation = {
            type: "roll",
            payload: {
                player: Observer.property.player(player),
                number: number,
            },
        };
        this.#observe(observation);
    }

    start({ us, players }) {
        console.assert(players.size() === 4,
            "Can remove this check when more players are intended");
        console.assert(players.name(us.name) !== null,
            "We should participate in the game");
        console.assert(players instanceof Players);
        let observation = {
            type: "start",
            payload: {
                us: Observer.property.player(us),
                players: players,
            }
        };
        this.#observe(observation);
    }

    steal({ thief = null, victim = null, resource = null }) {
        // Can leave out one of them, but not both.
        console.assert(thief || victim);
        let observation = {
            type: "steal",
            payload: {},
        };
        if (thief) {
            observation.payload.thief = Observer.property.player(thief);
        }
        if (victim) {
            observation.payload.victim = Observer.property.player(victim);
        }
        if (resource) {
            observation.payload.resource = Observer.property.resource(resource);
        }
        this.#observe(observation);
    }

    trade({ give, take }) {
        console.assert(give && take);
        const observation = {
            type: "trade",
            payload: {
                give: Observer.property.transfer(give),
                take: Observer.property.transfer(take),
            },
        };
        this.#observe(observation);
    }

    turn({ player, phase }) {
        const observation = {
            type: "turn",
            payload: {
                player: Observer.property.player(player),
                phase: Observer.property.phase(phase),
            },
        };
        this.#observe(observation);
    }

    yop({ player, resources }) {
        console.assert(resources instanceof Resources);
        const observation = {
            type: "yop",
            payload: {
                player: Observer.property.player(player),
                resources: resources,
            },
        };
        this.#observe(observation);
    }

};

// ╭───────────────────────────────────────────────────────────╮
// │ Standard properties                                       │
// ╰───────────────────────────────────────────────────────────╯

// NOTE: These builders make it convenient to construct valid standard
//       properties. They are not meant to verify them thoroughly.

Observer.property.player = function (player) {
    console.assert(player instanceof Player);
    return player;
}

Observer.property.players = function (players) {
    console.assert(players.every(x => x instanceof Player));
    return players;
}

Observer.property.trader = function (arg) {
    if (arg === null) {
        return null;
    }
    if (typeof arg === "string") {
        console.assert(arg === "bank");
        return arg;
    }
    return Observer.property.player(arg);
}

Observer.property.resource = function (arg) {
    console.assert(Resources.resourceNames.includes(arg));
    return arg;
}

Observer.property.transfer = function ({
    from = null,
    to = null,
    resources = new Resources(),
}) {
    console.assert(resources instanceof Resources);
    const transfer = {
        from: Observer.property.trader(from),
        to: Observer.property.trader(to),
        resources: resources,
    }
    // Sanity check: transfer between different players (wllow both null)
    console.assert(transfer.from !== transfer.to || transfer.from === null);
    return transfer;
}

Observer.property.trade = function ({ give = null, take = null }) {
    const trade = {
        give: Observer.property.transfer(give ?? {}),
        take: Observer.property.transfer(take ?? {}),
    };
    return trade;
}

Observer.property.buyable = function (arg) {
    console.assert(Observer.buyables.includes(arg));
    return arg;
}

Observer.property.phase = function (arg) {
    console.assert(Observer.phases.includes(arg));
    return arg;
}
