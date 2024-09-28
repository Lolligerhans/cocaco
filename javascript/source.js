// Observer for Colonist
//
// Uses reparser.js to make observations.
// Used by Colony to trigger activations.

// TODO: In version two, pass the message subobjects unchanged, only replacing
//       indices and enums with words.

"use strict";

// Implemented by registering reparsers for the structures produced by Colonist.
// Then activating triggers as necessary.
// The goal is to at least match the DOM parser in functionality.
class Source extends Trigger {
    // NOTE: Registers reparsers. Call disable() when done.
    constructor() {
        super();
        // Prevent all future triggers by unregistering reparsers.
        this.done = false;
        // Register the predefined list of reparsers
        let registerReparser = registrar => {
            console.debug("Source: registering trigger reparser");
            registrar.call(this);
        };
        Source.triggerList.forEach(registerReparser);
        console.debug("Source: constructed");
    }

    // Currently Colony re-initializes often. We need this so we do not
    // duplicate overwritten sources and trigger multiple times accidentally.
    disable() {
        console.log("Source: disabling");
        this.done = true;
    }

    // Use this as callback to enable this.disable()
    observeAndTrigger(triggerName, observations) {
        if (this.done === true) {
            console.debug("Source done: disabling this trigger:", triggerName, observations);
            return true; // Done
        }
        // console.debug("Source: Activating trigger:", triggerName, observations);
        console.assert(Array.isArray(observations),
            "To pass a single observation use [obs]");
        observations.forEach(obs => this.activateTrigger(triggerName, obs));
        return false; // Not done
    }
};

// NOTE: Define functions outside of class to help out universal-ctags

// ╭───────────────────────────────────────────────────────────╮
// │ Static                                                    │
// ╰───────────────────────────────────────────────────────────╯

// Construct trigger object from a gameLogState sub-object. Return trigger
// object for roll-type (10), null else.
function interpret_rolls_text(text_obj) {
    // console.debug("Source: interpret_rolls_text:", text_obj);
    if (text_obj.text.type !== 10) {
        // console.debug("Source: text object not a roll", text_obj);
        return null;
    }
    let ret = {};
    ret.source_index = text_obj.from;
    ret.dice = [text_obj.text.firstDice, text_obj.text.secondDice];
    // console.debug("Source: interpreted roll:", ret);
    return ret;
}

function interpret_got_text(text_obj) {
    if (text_obj.text.type !== 47) {
        return null;
    }
    const ret = {
        source_index: text_obj.from,
        target_idnex: 0,
        cards_indices_target: text_obj.text.cardsToBroadcast,
    };
    return ret;
}

function interpret_trade_bank_text(text_obj) {
    if (text_obj.text.type !== 116) {
        return null;
    }
    const ret = {
        source_index: text_obj.from,
        target_index: 0,
        source_card_indices: text_obj.text.givenCardEnums,
        target_card_indices: text_obj.text.receivedCardEnums,
    };
    return ret;
}

function interpret_yop_text(text_obj) {
    if (text_obj.text.type !== 21) {
        return null;
    }
    const ret = {
        source_index: text_obj.from,
        target_index: 0,
        card_indices_target: text_obj.text.cardEnums,
    };
    return ret;
}

function interpret_mono_text(text_obj) {
    if (text_obj.text.type !== 86) {
        return null;
    }
    const ret = {
        source_index: text_obj.from,
        card_count: text_obj.text.amountStolen,
        card_index: text_obj.text.cardEnum,
    };
    return ret;
}

function interpret_trade_offer(text_obj) {
    if (text_obj.text.type !== 118) {
        return null;
    }
    const res = {
        source_index: text_obj.from,
        card_indices: text_obj.text.offeredCardEnums,
        card_indices_target: text_obj.text.wantedCardEnums,
    };
    return res;
}

function interpret_trade_counter(text_obj) {
    if (text_obj.text.type !== 117) {
        return null;
    }
    const res = {
        source_index: text_obj.from,
        card_incices: text_obj.text.offeredCardEnums,
        card_indices_target: text_obj.text.wantedCardEnums,
    };
    return res;
}

function interpret_trade_player(text_obj) {
    if (text_obj.text.type !== 115) {
        return null;
    }
    const res = {
        source_index: text_obj.from,
        target_idnex: text_obj.text.acceptingPlayerColor,
        card_indices: text_obj.text.givenCardEnums,
        card_indices_target: text_obj.text.receivedCardEnums,
    };
    return res;
}

function interpret_discard(text_obj) {
    if (text_obj.text.type !== 55) {
        return null;
    }
    if (text_obj.text.areResourceCards !== true) {
        return null;
    }
    const res = {
        source_index: text_obj.from,
        target_index: 0,
        card_indices: text_obj.text.cardEnums,
    };
    return res;
}

function interpret_buy_dev(text_obj) {
    if (text_obj.text.type !== 1) {
        return null;
    }
    const res = {
        source_index: text_obj.from,
        target_index: 0,
        card_indices: [3, 4, 5],
    };
    return res;
}

function interpret_buy_building(text_obj) {
    if (text_obj.text.type !== 5) {
        return null;
    }
    const costs = {
        0: [1, 2, 3, 4],
        2: [1, 2],
        3: [4, 4, 5, 5, 5]
    };
    const res = {
        source_index: text_obj.from,
        target_index: 0,
        card_indices: costs[text_obj.text.pieceEnum],
    };
    return res;
}

function interpret_steal_random(text_obj) {
    if (text_obj.text.type !== 16) {
        return null;
    }
    const res = {
        source_index: text_obj.text.playerColorThief,
        target_index: text_obj.text.playerColorVictim,
        card_count: 1,
    };
    return res;
}

function interpret_steal_known_by_us(text_obj) {
    if (text_obj.text.type !== 14) {
        return null;
    }
    // assert text_obj.specificRecipiants.contains(our_index)
    const res = {
        source_index: text_obj.from,
        target_index: text_obj.text.playerColor,
        card_indices_target: text_obj.text.cardEnums,
    };
    return res;
}

// Function interpret_steal_known_against_us
function interpret_steal_known_against_us(text_obj) {
    if (text_obj.text.type !== 15) {
        return null;
    }
    // assert text_obj.specificRecipiants.contains(our_index)
    const res = {
        // Index of us must be known frmo other sources
        source_index: text_obj.from,
        card_indices_target: text_obj.text.cardEnums,
    };
    return res;
}

// ╭───────────────────────────────────────────────────────────╮
// │ Private                                                   │
// ╰───────────────────────────────────────────────────────────╯

Source.prototype.diceRolls = function () {
    new Reparse(
        "Source-Got-Cards",
        Reparse.applyDoers.byKind({ id: "130", type: [4, 91] }),
        Reparse.entryPoints.gameLogState,
        gameLogState => {
            let res = [];
            // console.debug("Source: found log texts:", Object.keys(gameLogState));
            for (let [_index, obj] of Object.entries(gameLogState)) {
                // console.debug("Observing game log element", index, obj);
                let observation = interpret_rolls_text(obj);
                if (!observation)
                    continue; // Not a roll message
                // console.debug("Observation made:", observation);
                res.push(observation);
            }
            // console.debug("Total observations:", res.length);
            return res;
        },
        // This defines the trigger name
        obs => this.observeAndTrigger("roll", obs)
    ).register();
};

Source.prototype.gotCards = function () {
    new Reparse(
        "Source-Dice-Rolls",
        Reparse.applyDoers.isStateOrDiff(),
        Reparse.entryPoints.gameLogState,
        gameLogState => {
            let res = [];
            // console.debug("Source: found log texts:", Object.keys(gameLogState));
            for (let [_index, obj] of Object.entries(gameLogState)) {
                // console.debug("Observing game log element", index, obj);
                let observation = interpret_got_text(obj);
                if (!observation)
                    continue; // Not a roll message
                // console.debug("Observation made:", observation);
                res.push(observation);
            }
            // console.debug("Total observations:", res.length);
            return res;
        },
        // This defines the trigger name
        obs => this.observeAndTrigger("transfer", obs)
    ).register();
}

Source.prototype.tradeBank = function () {
    new Reparse(
        "Source-Trade-Bank",
        Reparse.applyDoers.isStateOrDiff(),
        Reparse.entryPoints.gameLogState,
        gameLogState => {
            let res = [];
            for (let [_idnex, obj] of Object.entries(gameLogState)) {
                let observation = interpret_trade_bank_text(obj);
                if (!observation)
                    continue;
                res.push(observation);
            }
            return res;
        },
        obs => this.observeAndTrigger("transfer", obs)
    ).register();
}

Source.prototype.yop = function () {
    new Reparse(
        "Source-YOP",
        Reparse.applyDoers.isStateOrDiff(),
        Reparse.entryPoints.gameLogState,
        gameLogState => {
            let res = [];
            for (let [_index, obj] of Object.entries(gameLogState)) {
                let observation = interpret_yop_text(obj);
                if (!observation)
                    continue;
                res.push(observation);
            }
            return res;
        },
        obs => this.observeAndTrigger("transfer", obs)
    ).register();
}

Source.prototype.monoText = function () {
    new Reparse(
        "Source-Mono-Text",
        Reparse.applyDoers.isStateOrDiff(),
        Reparse.entryPoints.gameLogState,
        gameLogState => {
            let res = [];
            for (let [_index, obj] of Object.entries(gameLogState)) {
                let observation = interpret_mono_text(obj);
                if (!observation)
                    continue;
                res.push(observation);
            }
            return res;
        },
        obs => this.observeAndTrigger("mono", obs)
    ).register();
}

Source.prototype.tradeOffer = function () {
    new Reparse(
        "Source-TradeOffer",
        Reparse.applyDoers.isStateOrDiff(),
        Reparse.entryPoints.gameLogState,
        gameLogState => {
            let res = [];
            for (let [_index, obj] of Object.entries(gameLogState)) {
                let observation = interpret_trade_offer(obj);
                if (!observation)
                    continue;
                res.push(observation);
            }
            return res;
        },
        obs => this.observeAndTrigger("trade_offer", obs)
    ).register();
}

Source.prototype.tradeOfferCounter = function () {
    new Reparse(
        "Source-TradeOfferCounter",
        Reparse.applyDoers.isStateOrDiff(),
        Reparse.entryPoints.gameLogState,
        gameLogState => {
            let res = [];
            for (let [_index, obj] of Object.entries(gameLogState)) {
                let observation = interpret_trade_counter(obj);
                if (!observation)
                    continue;
                res.push(observation);
            }
            return res;
        },
        obs => this.observeAndTrigger("trade_counter", obs)
    ).register();
}

Source.prototype.tradePlayer = function () {
    new Reparse(
        "Source-TradePlayer",
        Reparse.applyDoers.isStateOrDiff(),
        Reparse.entryPoints.gameLogState,
        gameLogState => {
            let res = [];
            for (let [_index, obj] of Object.entries(gameLogState)) {
                let observation = interpret_trade_player(obj);
                if (!observation)
                    continue;
                res.push(observation);
            }
            return res;
        },
        obs => this.observeAndTrigger("transfer", obs)
    ).register();
}

Source.prototype.discard = function () {
    new Reparse(
        "Source-Discard",
        Reparse.applyDoers.isStateOrDiff(),
        Reparse.entryPoints.gameLogState,
        gameLogState => {
            let res = [];
            for (let [_index, obj] of Object.entries(gameLogState)) {
                let observation = interpret_discard(obj);
                if (!observation)
                    continue;
                res.push(observation);
            }
            return res;
        },
        obs => this.observeAndTrigger("transfer", obs)
    ).register();
}

Source.prototype.buyDev = function () {
    new Reparse(
        "Source-BuyDev",
        Reparse.applyDoers.isStateOrDiff(),
        Reparse.entryPoints.gameLogState,
        gameLogState => {
            let res = [];
            for (let [_index, obj] of Object.entries(gameLogState)) {
                let observation = interpret_buy_dev(obj);
                if (!observation)
                    continue;
                res.push(observation);
            }
            return res;
        },
        obs => this.observeAndTrigger("transfer", obs)
    ).register();
}

Source.prototype.buyBuilding = function () {
    new Reparse(
        "Source-BuyBuilding",
        Reparse.applyDoers.isStateOrDiff(),
        Reparse.entryPoints.gameLogState,
        gameLogState => {
            let res = [];
            for (let [_index, obj] of Object.entries(gameLogState)) {
                let observation = interpret_buy_building(obj);
                if (!observation)
                    continue;
                res.push(observation);
            }
            return res;
        },
        obs => this.observeAndTrigger("transfer", obs)
    ).register();
}

Source.prototype.stealRandom = function () {
    new Reparse(
        "Source-StealRandom",
        Reparse.applyDoers.isStateOrDiff(),
        Reparse.entryPoints.gameLogState,
        gameLogState => {
            let res = [];
            for (let [_index, obj] of Object.entries(gameLogState)) {
                let observation = interpret_steal_random(obj);
                if (!observation)
                    continue;
                res.push(observation);
            }
            return res;
        },
        obs => this.observeAndTrigger("steal_random", obs)
    ).register();
}

Source.prototype.stealKnownByUs = function () {
    new Reparse(
        "Source-StealKnownByUs",
        Reparse.applyDoers.isStateOrDiff(),
        Reparse.entryPoints.gameLogState,
        gameLogState => {
            let res = [];
            for (let [_index, obj] of Object.entries(gameLogState)) {
                let observation = interpret_steal_known_by_us(obj);
                if (!observation)
                    continue;
                res.push(observation);
            }
            return res;
        },
        obs => this.observeAndTrigger("transfer", obs)
    ).register();
}

Source.prototype.stealKnownAgainstUs = function () {
    new Reparse(
        "Source-StealKnownAgainstUs",
        Reparse.applyDoers.isStateOrDiff(),
        Reparse.entryPoints.gameLogState,
        gameLogState => {
            let res = [];
            for (let [_index, obj] of Object.entries(gameLogState)) {
                let observation = interpret_steal_known_against_us(obj);
                if (!observation)
                    continue;
                res.push(observation);
            }
            return res;
        },
        obs => this.observeAndTrigger("transfer", obs)
    ).register();
}

// ╭───────────────────────────────────────────────────────────╮
// │ Public                                                    │
// ╰───────────────────────────────────────────────────────────╯

// TODO: belongs to static but needs the prototype defined
Source.triggerList = [
    Source.prototype.diceRolls,
    Source.prototype.gotCards,
    Source.prototype.tradeBank,
    Source.prototype.yop,
    // Text log element says kind and amount. Data contains card counts for each
    // player (as regular card transfer messages).
    Source.prototype.monoText,
    Source.prototype.tradeOffer,
    Source.prototype.tradeOfferCounter,
    Source.prototype.tradePlayer,
    Source.prototype.discard,
    Source.prototype.buyDev,
    Source.prototype.buyBuilding,
    Source.prototype.stealRandom,
    Source.prototype.stealKnownByUs,
    Source.prototype.stealKnownAgainstUs,
];
