"use strict";

class Reparse {

    // ╭───────────────────────────────────────────────────────╮
    // │ Receive helpers                                       │
    // ╰───────────────────────────────────────────────────────╯

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
        gameChatState: message => {
            let e = Reparse.entryPoints.stateOrDiff(message);
            return e.gameChatState;
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
        serverId: message => {
            let e = message.data.payload.serverId;
            return e;
        },
    }

    // ╭───────────────────────────────────────────────────────╮
    // │ Send helpers                                          │
    // ╰───────────────────────────────────────────────────────╯

    static applySend = {
        always: () => (_frame => true),
        // Apply when the frame's value matches (one of) the provided value(s)
        // @params value, or array of values, or null
        byType: ({
            v0 = null,
            v1 = null,
            str = null,
            action = null,
            sequence = null,
        }) => frame => {
            const frameHas = (p, v, obj = frame) => {
                // If v is undefined or null it is fulfilled
                return v == null || hasOneOf(obj, p, v);
            };
            const has_v0 = frameHas("v0", v0);
            const has_v1 = frameHas("v1", v1);
            const has_str = frameHas("str", str);
            const has_action = frameHas("action", action, frame.message);
            const has_sequence = frameHas("sequence", sequence, frame.message);
            const r = has_v0 && has_v1 && has_str && has_action && has_sequence;
            // debugger;
            return r;
            // return frameHas("v0", v0) &&
            //     frameHas("v1", v1) &&
            //     frameHas("str", str) &&
            //     frameHas("action", action, frame.message) &&
            //     frameHas("sequence", sequence, frame.message);
        },
        inGame: () => {
            return Reparse.applySend.byType({ v0: 3, v1: 1 });
        },
        isAction: actionIndex => frame => {
            if (!Reparse.applySend.inGame()(frame)) {
                return false;
            }
            const matchingAction = frame.message.action === actionIndex;
            return matchingAction;
        },
        chatMessages: () => {
            return Reparse.applySend.byType({ v0: 3, v1: 1, action: 0 });
        },
    };

    static entryPointsSend = {
        frame: frame => frame,
        message: frame => {
            let e = frame.message;
            return e;
        },
        payload: frame => {
            let message = Reparse.entryPointsSend.message(frame);
            return message.payload;
        },
    };

    // ╭───────────────────────────────────────────────────────╮
    // │ Application                                           │
    // ╰───────────────────────────────────────────────────────╯

    static reparsers = { send: [], receive: [] };

    // TODO:Accept a config object with defaults instead of forcing so many
    //      arguments in order.
    static register(direction, ...args) {
        let reparser = new Reparse(...args);
        let all = Reparse.reparsers[direction];
        all.push(reparser);
        const symbol = direction === "receive" ? "⬇️" : "⬆️";
        console.debug("Reparse", all.length, symbol, reparser.name);
    }

    static applyAll(direction, frame, reparse) {
        console.assert(direction === "receive" || direction === "send");
        let didRemoveFrame = false; // Pretend the frame was deleted
        let didChangeFrame = false;
        Reparse.reparsers[direction] = Reparse.reparsers[direction].filter(
            reparser => {
                if (didRemoveFrame === true) {
                    // Emulate 'break;' behaviour
                    return true;
                }
                const { isDone, frame: returnedFrame } = reparser.apply(
                    frame,
                    reparse,
                );
                // When returning
                //  - undefined:            Regular behaviour
                //  - null:                 Delete frame
                //  - else (frame assumed): Replace frame
                if (returnedFrame === null) {
                    console.debug("reparse.js: applyAll(): Deleting frame")
                    didRemoveFrame = true;
                } else if (typeof returnedFrame === "undefined") {
                    // Nothing
                } else {
                    console.debug("reparse.js: applyAll(): Editing frame");
                    frame = returnedFrame;
                    didChangeFrame = true;
                }
                return !isDone;
            });
        if (didRemoveFrame === true) {
            return null;
        }
        if (didChangeFrame === false) {
            return undefined;
        }
        console.debug("reparse.js: applyAll(): Re-encoding edited frame")
        // HACK: This is unintuitive. Who sohuld be responsible to encode
        //       this? Maybe receive_MAIN and send_MAIN should do this? Or
        //       the handle() function?
        const encoder = direction === "receive" ?
            cocaco_encode_receive : cocaco_encode_send;
        const encodedFrame = encoder(frame);
        return encodedFrame;
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

    apply(frame, reparse) {
        console.assert(frame != null);
        let res = null;
        try {
            res = this.#generate(frame);
        } catch (e) {
            console.error(`reparse.js: ⚠️  "${this.name} (generate):`, e);
            debugger;
        }
        if (res === null) {
            return { isDone: false };
        }
        try {
            const ret = this.callback(res, frame, reparse);
            return ret;
        } catch (e) {
            console.error(`reparse.js: ❌ "${this.name}" (callback):`, e);
            debugger;
            return { isDone: true };
        }
    }

    #generate(frame) {
        try {
            if (!this.doesApply(frame)) {
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
            entryPoint = this.getEntryPoint(frame);
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
            result = this.parse(entryPoint, frame);
        } catch (e) {
            console.warn("Failed reparser parse:", this.name);
            debugger;
            throw e;
        }
        return result;
    }
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
