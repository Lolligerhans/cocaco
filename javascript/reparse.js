"use strict";

class Reparse {

    // Common 'doesApply' functions
    static applyDoers = {
        always: () => (_message => true),
        // @param idOrType {type: [1,2,3], id: ["4","4","5"]}
        // @return closure returning true if message matches at least one of
        //         both kinds.type and kinds.id (if they are present)
        byKind: (kinds) => (message) => {
            // debugger; // Works not?
            // console.debug("Does this apply? should=", type, " ❓ is=", message.data.type);
            console.assert(message.id && message.data.type, "Can this ever not be the case?");
            let ok = true
            if (Object.hasOwn(kinds, "id")) {
                if (typeof kinds.id === "number") kinds.id = [kinds.id];
                ok = ok && kinds.id.includes(message.id);
            }
            if (Object.hasOwn(kinds, "type")) {
                if (typeof kinds.type === "number") kinds.type = [kinds.type];
                ok = ok && kinds.type.includes(message.data.type);
            }
            return ok;
        },
        isState: () => Reparse.applyDoers.byKind({ id: "130", type: [4] }),
        isStateOrDiff: () => Reparse.applyDoers.byKind({ id: "130", type: [4, 91] }),
    };

    // Common entry points
    static entryPoints = {
        data: message => message.data,
        developmentCardsState: message => {
            let e = message.data.payload;
            if (Object.hasOwn(e, "gameState"))
                e = e.gameState;
            if (Object.hasOwn(e, "diff"))
                e = e.diff;
            e = e
                .mechanicDevelopmentCardsState;
            // .bankDevelopmentCards
            // .cards;
            return e;
        },
        // Return the payload.gameState or payload.diff. Usefol when wanting to
        // observe changes to the game state without caring too much about
        // missing elements.
        stateOrDiff: message => {
            let e = message.data.payload;
            if (Object.hasOwn(e, "gameState"))
                e = e.gameState;
            if (Object.hasOwn(e, "diff"))
                e = e.diff;
            console.assert(!Object.is(message.data.payload, e),
                "Should have gameState or diff to use this entry point");
            return e;
        },
        gameLogState: message => {
            let e = Reparse.entryPoints.stateOrDiff(message);
            return e.gameLogState;
        },
        playerUserStates: message => {
            let e = message.data.payload;
            if (Object.hasOwn(e, "diff"))
                e = e.diff;
            e = e.playerUserStates;
            return e;
        },
        payload: message => {
            let e = message.data.payload;
            return e;
        },
    }

    static allReparsers = [];

    static register(...args) {
        let reparser = new Reparse(...args);
        reparser.register();
    }

    static applyAll(message) {
        Reparse.allReparsers = Reparse.allReparsers.filter((parser) => {
            let res = null;
            try {
                res = parser.apply(message);
            } catch (e) {
                console.error("Failed reparser apply:", parser.name, e);
                debugger;
            }
            if (res !== null) {
                try {
                    // Disable when callback returns true
                    return !parser.callback(res);
                } catch (e) {
                    console.error("Failed reparser callback:", parser.name, e);
                    debugger;
                }
            }
            return true;
        });
    }

    // @param name:  Human readable name.
    // @param doesApply: Function message -> bool
    // @param getEntryPoint: Function message -> subobject. May work for
    //                       different message ids/types.
    // @param parse: Function entryPoint -> { <some ocmbination of subobects> }
    // @param callback: Function parse_result -> application logic
    //
    // The idea is that we use function composition to do all 4 parts in order.
    // Ideally the application need not change when the message format changes.
    // 1. doesApply verifies the id/type.
    // 2. getEntryPoint Decides on the message subobject used as root for data
    //    extraction
    // 3. parse collects the parts of the root node that are needed, independent
    //    of their name in the message itself
    // 4. The application logic callback sees only data it wants.
    constructor(
        name,
        doesApply,
        getEntryPoint, // Allowed to fail or return falsy (rest is not)
        parse,
        callback
    ) {
        this.name = name;
        this.doesApply = doesApply;
        this.getEntryPoint = getEntryPoint; // Function message -> entry point
        this.parse = parse;
        this.callback = callback;
    }

    apply(message) {
        try {
            if (!this.doesApply(message)) {
                // console.debug("🚫 Does not apply");
                return null;
            }
        }
        catch (e) {
            console.log("Failed reparser doesApply:", this.name);
            debugger;
            throw e;
        }
        // console.debug("✅ Does apply");
        let entryPoint;
        try {
            entryPoint = this.getEntryPoint(message);
            // console.debug("Entry point: ", entryPoint);
        }
        catch (e) {
            console.log("Failed reparser getEntryPoint:", this.name);
            debugger;
        }
        if (!entryPoint) {
            // console.debug("❌ Failed to apply", this.name);
            return null;
        }
        let result;
        try {
            result = this.parse(entryPoint);
        } catch (e) {
            console.warn("Failed reparser parse:", this.name);
            debugger;
            throw e;
        }
        return result;
    }
}

Reparse.prototype.register = function () {
    console.debug("Reparse: +", this.name);
    Reparse.allReparsers.push(this);
    // console.debug("Active reparsers:", Reparse.allReparsers.map(r => r.name));
    console.debug("Active reparsers:", Reparse.allReparsers.length);
}

// ╭───────────────────────────────────────────────────────────────────────────╮
// │ Predefined reparser helpers                                               │
// ╰───────────────────────────────────────────────────────────────────────────╯

function check_country_code(entryPoint) {
    let codes = {};
    for (let p of entryPoint) {
        p.countryCode ??= "Bot";
        let prev = codes[p.countryCode] ?? [];
        prev.push(p.username);
        codes[p.countryCode] = prev;
    }
    let ret = [];
    for (let [code, players] of Object.entries(codes)) {
        if (players.length >= 2) {
            ret.push({ code: code, players: players });
        }
    }
    return ret;
}

// @entryPoint developmentCardsState object.
// @return { bank: <cards>, players: { 1: <cards>, ... } }
function check_development_cards(entryPoint) {
    let res = {};
    if (Object.hasOwn(entryPoint, "bankDevelopmentCards"))
        res.bank = entryPoint.bankDevelopmentCards.cards;

    let players = {};
    // Ignore played cards
    for (let [player, usedAndUnused] of Object.entries(entryPoint.players)) {
        // If only the devs bought this turn are updated this is missing
        if (!usedAndUnused) continue;
        if (!usedAndUnused.developmentCards) continue;
        let devs = usedAndUnused.developmentCards.cards;
        if (devs.length === 0) continue;
        players[player] = devs;
    }
    res.players = players;
    // TODO: Its a little odd that we always have .players but only sometime
    //       .bank - make more consistent.
    return res;
}

function check_type(entryPoint) {
    return entryPoint.type;
}
