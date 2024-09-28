// Observer for WebSocket Source reproducing DOM log message parsing.

"use strict";

class ColonistObserver extends Observer {

    static cardMap = {
        0: "unknown",
        1: "wood",
        2: "brick",
        3: "sheep",
        4: "wheat",
        5: "ore",
    };

    static buildingMap = {
        0: "road",
        2: "settlement",
        3: "city",
    };

    static colourMap = {
        1: "#e27174",
        2: "#223697",
        3: "#E09742",
        4: "#62b95d",
        5: "#3e3e3e",
    };

    static getColour(colourIndex) {
        if (Object.hasOwn(ColonistObserver.colourMap, colourIndex)) {
            return ColonistObserver.colourMap[colourIndex];
        } else {
            console.warn("ColonistObserver: Unknown colour index", colourIndex);
            return "black";
        }
    }

    // Handler for each source packet
    static sourceObserver = {};

    constructor(source, state) {
        super(state);


        this.nextLogMessageIndex = 0;
        this.handledLogMessagesIndices = new Set();
        // Stateful components we use to interpret Source packets
        this.state = {
            playerUsername: null,
            playerUserStates: null,
            nameMap: null,
            colourMap: null,
        };

        this.source = source;
        this.source.onTrigger("playerUsername", packet => {
            console.assert(packet.type == "playerUsername");
            this.observePlayerUsername(packet.data);
        });
        this.source.onTrigger("playerUserStates", packet => {
            console.assert(packet.type === "playerUserStates")
            this.observePlayerUserStates(packet.data)
            return false;
        });
        this.source.onTrigger("gameLogState", packet => {
            console.assert(packet.type === "gameLogState")
            this.observeLogMessage(packet.data)
            return false;
        });
        // this.source.onTrigger(null, data => {
        //     console.log("ColonistObserver: Source trigger for:", JSON.stringify(data));
        //     debugger;
        //     return false;
        // });
    }

    #isNewLogMessage(index) {
        if (index < this.nextLogMessageIndex) {
            return false;
        }
        this.nextLogMessageIndex = index + 1;
        return true;
    }

    // ╭───────────────────────────────────────────────────────╮
    // │ Dispatch source packet types                          │
    // ╰───────────────────────────────────────────────────────╯

    // These functions generate observation from source packets. Or delegate to
    // functions that do. They are based on the different 'packet.type'
    // ColonistSource emits.

    observePlayerUsername(sourceData) {
        console.assert(!this.state.playerUsername);
        this.state.playerUsername = sourceData;
    }

    observePlayerUserStates(sourceData) {
        console.assert(!this.state.playerUserStates);
        if (this.state.playerUserStates) {
            // console.debug(sourceData, this.state);
            // console.warn("ColonistObserver: Skipping duplicate playerUserStates");
            return;
        }
        this.state.playerUserStates = sourceData.playerUserStates;
        this.state.nameMap = {};
        for (const p of this.state.playerUserStates) {
            this.state.nameMap[p.selectedColor] = p.username;
        }
        this.state.colourMap = {};
        for (const p of this.state.playerUserStates) {
            this.state.colourMap[p.username]
                = ColonistObserver.getColour(p.selectedColor);
        }

        let allNames = sourceData.playOrder.map(i => this.state.nameMap[i]);
        rotateToLastPosition(allNames, this.state.playerUsername);

        this.start({ players: allNames, colours: this.state.colourMap });
    }

    observeLogMessage({ index, type, payload }) {
        index = Number.parseInt(index); // Is a string in source
        const isNew = this.#isNewLogMessage(index);
        // HACK: The Source obtains both "set state" and "state update" Data
        //       frames (See doc/colonist/message_format.md). We hope they are
        //       in the right order and simply reject any duplicates.
        if (!isNew) {
            // console.debug(this.handledLogMessagesIndices);
            // console.warn("ColonistObserver: Skipping index", index, type, payload);
            if (!this.handledLogMessagesIndices.has(index)) {
                console.warn("Out of order log messages (?)");
                // debugger;
            }
            return;
        }
        this.handledLogMessagesIndices.add(index);
        ColonistObserver.sourceObserver[type].call(this, payload);
    }
}

// ╭───────────────────────────────────────────────────────────╮
// │ Observe log message packets                               │
// ╰───────────────────────────────────────────────────────────╯

// These are specialized to the packet types our specific Source can produce.
// Each translates the contents of the Source packet into observation using the
// Observer interface functino.
//
// Mostly they simply map indices to their correspongign string values.

ColonistObserver.sourceObserver.roll = function (packetData) {
    const name = this.state.nameMap[packetData.player.index];
    this.roll({
        player: { name: name },
        number: packetData.number,
    });
}

ColonistObserver.sourceObserver.got = function (packetData) {
    const name = this.state.nameMap[packetData.player];
    const res = packetData.cards.map(card => ColonistObserver.cardMap[card]);
    this.got({
        player: { name: name },
        resources: res,
    });
}

ColonistObserver.sourceObserver.tradeBank = function (packetData) {
    const name = this.state.nameMap[packetData.player.index];
    const give = packetData.give.map(r => ColonistObserver.cardMap[r]);
    const take = packetData.take.map(r => ColonistObserver.cardMap[r]);
    this.trade({
        give: {
            from: { name: name },
            to: "bank",
            resources: give,
        },
        take: {
            from: "bank",
            to: { name: name },
            resources: take,
        },
    });
}

ColonistObserver.sourceObserver.yop = function (packetData) {
    const name = this.state.nameMap[packetData.player.index];
    const cards = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    this.got({
        player: { name: name },
        resources: cards,
    });
}

ColonistObserver.sourceObserver.mono = function (packetData) {
    const name = this.state.nameMap[packetData.player.index];
    const res = packetData.cards.map(x => ColonistObserver.cardMap[x]);
    const resType = ColonistObserver.cardMap[packetData.card];
    this.mono({
        player: { name: name },
        resource: resType,
        resources: res,
    });
}

ColonistObserver.sourceObserver.tradeOffer = function (packetData) {
    const name = this.state.nameMap[packetData.player.index];
    const res = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    const trade = {
        give: {
            from: { name: name },
            resources: res,
        },
    };
    this.offer({
        offer: trade,
    });
}

ColonistObserver.sourceObserver.tradeCounter = function (packetData) {
    const name = this.state.nameMap[packetData.player.index];
    const res = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    const trade = {
        give: {
            from: { name: name },
            resources: res,
        },
        isCounter: true,
    };
    this.offer({
        offer: trade,
    });
}

ColonistObserver.sourceObserver.tradePlayer = function (packetData) {
    const name = this.state.nameMap[packetData.player.index];
    const res = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    const name2 = this.state.nameMap[packetData.target_player.index];
    const res2 = packetData.target_cards.map(r => ColonistObserver.cardMap[r]);
    const trade = {
        give: {
            from: { name: name },
            to: { name: name2 },
            resources: res,
        },
        take: {
            from: { name: name2 },
            to: { name: name },
            resources: res2,
        },
    };
    this.trade(trade);
}

ColonistObserver.sourceObserver.discard = function (packetData) {
    const name = this.state.nameMap[packetData.player.index];
    const resources = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    this.discard({
        player: { name: name },
        resources: resources,
    });
}

ColonistObserver.sourceObserver.buyDev = function (packetData) {
    const name = this.state.nameMap[packetData.player.index];
    this.buy({
        player: { name: name },
        object: "devcard",
    });
}

ColonistObserver.sourceObserver.buyBuilding = function (packetData) {
    const name = this.state.nameMap[packetData.player.index];
    const object = ColonistObserver.buildingMap[packetData.building.index];
    this.buy({
        player: { name: name },
        object: object,
    });
}

ColonistObserver.sourceObserver.stealRandom = function (packetData) {
    const thief = this.state.nameMap[packetData.player.index];
    const victim = this.state.nameMap[packetData.victim.index];
    console.assert(packetData.cards.length === 1 && packetData.cards[0] === 0,
        "Random steals should be unknown single cards");
    this.steal({
        thief: { name: thief },
        victim: { name: victim },
    });
}

ColonistObserver.sourceObserver.stealAgainstUs = function (packetData) {
    const thief = this.state.nameMap[packetData.player.index];
    const cards = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    console.assert(cards.length === 1, "Steal exactly one card");
    this.steal({
        thief: { name: thief },
        victim: { name: this.state.playerUsername },
        resource: cards[0],
    });
}

ColonistObserver.sourceObserver.stealAgainstThem = function (packetData) {
    const victim = this.state.nameMap[packetData.player.index];
    const cards = packetData.cards.map(r => ColonistObserver.cardMap[r]);
    console.assert(cards.length === 1, "Steal exactly one card");
    this.steal({
        thief: { name: this.state.playerUsername },
        victim: { name: victim },
        resource: cards[0],
    });
}
