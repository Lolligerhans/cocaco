"use strict";

/**
 * The Reparse class is effectively dummy code for interpreting WebSocket
 * frames. While it is a lot more code than simply writing
 *      frame.message.payload.type === 19,
 * using Reparse can prevent some magic numbers, and reduce the complexity at
 * the place where the frame is actually needed.
 *
 * Additionally using it bundles all access to frames, making it a bit easier to
 * debug, log, reason about, ..., because that can happen at a shared location.
 * For example, this enables us to be more explicit about the order in which
 * frames should be processed because every reparser is registered with a human
 * readable #name.
 */
class Reparse {

    static #logger = new ConsoleLog("Reparse", "🔍");

    #callback;
    #doesApply;
    #getEntryPoint;
    #name;
    #parse;

    /**
     * An incoming Colonist frame as described in the documentation
     * @typedef {Object} IncomingFrame
     * @property {string} id ID as described in the documentation
     * @property {Object} data
     * @property {Number} data.type
     * Message type as described in the documentation
     * @property {Object} data.payload
     * Type specific payload as described in the documentation
     * @property {Number} data.sequence
     * Sequence number counting up from 0. Because most content scripts start on
     * "document_idle" we may miss the first couple sequence numbers. 'Resend'
     * syncs with the first observed sequence number.
     */

    // ╭───────────────────────────────────────────────────────╮
    // │ Receive helpers                                       │
    // ╰───────────────────────────────────────────────────────╯

    // Use formatter when it can keep key: (arg) => in one line
    // clang-format off

    /**
     * Common '#doesApply' functions. The functions here return closures to be
     * applied to the message object in order filter them. This may be
     * surprising for the trivial ones, but we keep them consistent with the
     * ones actually needing the extra level.
     * @type {Object.<string,function(*): function(IncomingFrame : Boolean>}
     * Predefined "does-apply" functions to filter by common criteria
     */
    static applyDoers = {

        /**
         * @return {function():true}
         */

        always: () => (_message => true),
        /**
         * @param {Object} kinds Example: { type: [1,2,3], id: ["4","5","6" }
         * @param {Number[]} [kinds.type]
         * List of types one of which must be the message type to return true
         * @param {string[]} [kinds.id]
         * List if IDs one of which must be the message ID to return true
         * @return {function(IncomingFrame):boolean}
         * Closure returning true if message matches at least one of both
         * kinds.type and kinds.id (if they are present).
         */
        byKind: (kinds) => (message) => {
            // console.debug(
            //     "Does this apply? | should=",
            //     type, " ❓ is=", message.data.type,
            // );
            console.assert(
                message.id && message.data.type,
                "Can this ever not be the case?"
            );
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

        /**
         * Similar to byKind, but with predefined arguments to filter for frames
         * resetting the gameState.
         */
        isState: () => Reparse.applyDoers.byKind({ id: "130", type: [4] }),

        /**
         * Similar to byKind, but with predefined arguments to filter for frames
         * resetting or updating the gameState.
         */
        isStateOrDiff: () => Reparse.applyDoers.byKind({ id: "130", type: [4, 91] }),
    };

    /**
     * Common entry points. Entry points are functions taking in a Message
     * object and returning one of its sub-objects.
     * @type {Object.<string,function(IncomingFrame):*}
     */
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
            return e;
        },

        /**
         * Return the payload.gameState or payload.diff (whatever is present).
         * Useful when wanting to observe changes to the game state without
         * caring too much about missing elements.
         */
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

        /**
         *  Returns 'playerUserStates' either from a state diff or reset
         *  message.
         */
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
    };

    // ╭───────────────────────────────────────────────────────╮
    // │ Send helpers                                          │
    // ╰───────────────────────────────────────────────────────╯

    /**
     * Like Reparse.applyDoers, but for outgoing frames
     */
    static applySend = {
        always: () => (_frame => true),
        // Apply when the frame's value matches (one of) the provided value(s).
        // Arguments can be values, or array of values, or null.
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
            return r;
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

    /**
     * Similar to Reparse.entryPoints, but for outgoing frames
     */
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

    // clang-format on
    // ╭───────────────────────────────────────────────────────╮
    // │ Application                                           │
    // ╰───────────────────────────────────────────────────────╯

    /**
     * List of all active reparsers. Anything that wants to access obtained
     * frames should register a reparser, creating an entry in this object.
     */
    static reparsers = {
        /**
         * @type {Reparse[]}
         */
        send: [],
        /**
         * @type {Reparse[]}
         */
        receive: [],
    };

    /**
     * @return {Number} Number of active reparsers
     */
    static reparserCount() {
        return Reparse.reparsers.send.length + Reparse.reparsers.receive.length;
    }

    /**
     * Register a reparser.
     * @param {"send" | "receive"} direction
     * Direction to register a new reparser for.
     * @param {...*} args
     * Arguments to be used for construction of the reparser. Same as needed for
     * 'Reparse' constructor.
     */
    static register(direction, ...args) {
        let reparser = new Reparse(...args);
        let all = Reparse.reparsers[direction];
        all.push(reparser);
        const symbol = direction === "receive" ? "⬇️" : "⬆️";
        Reparse.#logger.log("Register", all.length, symbol, reparser.#name);
    }

    /**
     * Run registered reparsers on the provided frame
     * @param {"send" | "receive"} direction
     * @param {*} frame Decoded frame
     * @param {ReparseOptions} reparseOptions
     */
    static applyAll(direction, frame, reparseOptions) {
        console.assert(direction === "receive" || direction === "send");
        let didRemoveFrame = false; // Pretend the frame was deleted
        let didChangeFrame = false;
        Reparse.reparsers[direction] =
            Reparse.reparsers[direction].filter(reparser => {
                if (didRemoveFrame === true) {
                    // Emulate 'break;' behaviour
                    return true;
                }
                const {isDone, frame: returnedFrame} =
                    reparser.apply(frame, reparseOptions);
                // When returning
                //  - undefined:            Regular behaviour
                //  - null:                 Delete frame
                //  - else (frame assumed): Replace frame
                if (returnedFrame === null) {
                    Reparse.#logger.log("Deleting frame");
                    didRemoveFrame = true;
                } else if (typeof returnedFrame === "undefined") {
                    // Nothing
                } else {
                    Reparse.#logger.log("Editing frame");
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
        Reparse.#logger.log("Re-encoding edited frame");
        // HACK: This is unintuitive. Who should be responsible to encode
        //       this? Maybe receive_MAIN and send_MAIN should do this? Or
        //       the handle() function?
        const encoder = direction === "receive" ? cocaco_encode_receive
                                                : cocaco_encode_send;
        const encodedFrame = encoder(frame);
        return encodedFrame;
    }

    /**
     * Construct a reparser. This is to be used by the
     *      static registerReparser()
     * method.
     *
     * The 'gerEntryPoint' and '#parse' are composed to generate an input for
     * '#callback'. Callback then implements some behaviour on the presented
     * data, returning { isDone: boolean, frame: {null,undefined,Frame}}.
     *
     * @param {string} name Human readable name for the reparser
     * @param {function(*):boolean} #doesApply
     * Function used to ensure the frame is of interest for the constructed
     * reparser, and exit early if not. Typically tests "type" or for existence
     * of required properties.
     * If not needed, can be the constant true function.
     * Must not fail.
     * @param {function(*):*} getEntryPoint
     * Function used to pick only the relevant parts of the frame object.
     * Typically something like a "state" object or a payload.
     * Is composed with '#parse' to generate the input for the #callback.
     * If not needed, can be the identity function.
     * May fail, leading the reparser to not apply to that frame.
     * @param {function(*):*} parse
     * Function used to generate interesting data from the entry point.
     * Typically, this function would pick relevant sub-objects from the entry
     * point.
     * Is composed with 'getEntryPoint' to generate the input for the #callback.
     * If not needed, can be the identify function.
     * Must not fail.
     * @param {function(*):{isDone:boolean,frame:*}} callback
     * Function used to implement behaviour on the parsed data. When 'isDone' is
     * 'true', the reparser will be removed.
     * When 'frame' is undefined, nothing happens. When 'frame' is 'null', the
     * frame is dropped (for the remaining reparsers and the WebSocket).
     * When 'frame' is any other value, the reparsed frame is replaced by this
     * value (for all remaining reparsers and the WebSocket).
     */
    constructor(name, doesApply, getEntryPoint, parse, callback) {
        this.#name = name;
        this.#doesApply = doesApply;
        this.#getEntryPoint = getEntryPoint; // Function message -> entry point
        this.#parse = parse;
        this.#callback = callback;
    }

    /**
     * Runs the #callback on the data generated by the other 3 functions.
     * @param {*} frame Decoded frame
     * @param {ReparseOptions} reparse
     * @return {{isDone:boolean, frame:*}}
     * When isDone is true, the reparser will be removed. When frame is
     *  - undefined: No effect
     *  - null: Frame is deleted
     *  - any other value: The processed frame is replaced by this value for the
     *    remaining reparsers and the WebSocket.
     */
    apply(frame, reparse) {
        console.assert(frame != null);
        let res = null;
        try {
            res = this.#generate(frame);
        } catch (e) {
            console.error(`reparse.js: ⚠️  "${this.#name} (generate):`, e);
            debugger;
        }
        if (res === null) {
            return {isDone: false};
        }
        try {
            const ret = this.#callback(res, frame, reparse);
            return ret;
        } catch (e) {
            console.error(`reparse.js: ❌ "${this.#name}" (#callback):`, e);
            debugger;
            return {isDone: true};
        }
    }

    /**
     * Function combining all steps before the '#callback' application. The
     * result of this function can be used as input to '#callback' (unless the
     * return value is 'null').
     * @param frame Decoded frame to be processed
     * @return {Object|null}
     * When '#doesApply' returns false, or '#getEntryPoint' fails, returns null.
     * Else returns the result of composing '#getEntryPoint' and 'parser' applied
     * to 'frame'.
     */
    #generate(frame) {
        try {
            if (!this.#doesApply(frame)) {
                // console.debug("🚫 Does not apply");
                return null;
            }
        } catch (e) {
            console.error("Failed reparser #doesApply:", this.#name);
            throw e;
        }
        // console.debug("✅ Does apply");
        let entryPoint;
        try {
            entryPoint = this.#getEntryPoint(frame);
            // console.debug("Entry point: ", entryPoint);
        } catch (e) {
            Reparse.#logger.log("Failed reparser #getEntryPoint:", this.#name);
        }
        if (!entryPoint) {
            // console.debug("❌ Failed to apply", this.#name);
            return null;
        }
        let result;
        try {
            result = this.#parse(entryPoint, frame);
        } catch (e) {
            console.error("Failed reparser #parse:", this.#name);
            throw e;
        }
        return result;
    }
}

// ╭───────────────────────────────────────────────────────────────────────────╮
// │ Predefined reparser helpers                                               │
// ╰───────────────────────────────────────────────────────────────────────────╯

/**
 * Predefined function for the '#parse' function of a 'Reparse' instance.
 * Returns groups with matching country codes.
 * @param {Object} entryPoint
 * 'playerUserStates' object. Can be obtained from 'entryPoint.playerUserStates'
 * @return {Array.<{code:string,players:string[]}>}
 * Groups of at least 2 players with matching country codes. Empty array if no
 * country codes match.
 */
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
            ret.push({code: code, players: players});
        }
    }
    return ret;
}

/**
 * Generates the development card from a 'developmentCardsState' object. Can be
 * used as the '#parse' argument when constructing a 'Reparse' instance.
 * @param {*} entryPoint developmentCardsState object.
 * @return {{bank:number[],players:Object.<string,number[]>}}
 * Cards are identified by the enum used by the host. Players are identified by
 * the colour enum used by the host. Translation can be done using the
 * 'playerUserStates' part of the 'gameState'.
 *
 * Replaces 'check_development_cards' which filters for non-emptyness. This
 * function does not filter.
 */
function check_all_development_cards(entryPoint) {
    let res = {};
    if (Object.hasOwn(entryPoint, "bankDevelopmentCards"))
        res.bank = entryPoint.bankDevelopmentCards.cards;

    let players = {};
    // Ignore played cards
    for (let [player, usedAndUnused] of Object.entries(entryPoint.players)) {
        // If only the devs bought this turn are updated this is missing
        if (!usedAndUnused)
            continue;
        if (!usedAndUnused.developmentCards)
            continue;
        let devs = usedAndUnused.developmentCards.cards;
        players[player] = devs;
    }
    res.players = players;
    return res;
}

/**
 * Deprecated: Remove once all uses are replaced. Use
 * 'check_all_development_cards' instead.
 *
 * Generates the development card from a 'developmentCardsState' object. Can be
 * used as the '#parse' argument when constructing a 'Reparse' instance.
 * @param {*} entryPoint developmentCardsState object.
 * @return {{bank:number[],players:Object.<string,number[]>}}
 * Cards are identified by the enum used by the host. Players are identified by
 * the colour enum used by the host. Translation can be done using the
 * 'playerUserStates' part of the 'gameState'.
 */
function check_development_cards(entryPoint) {
    let res = {};
    if (Object.hasOwn(entryPoint, "bankDevelopmentCards"))
        res.bank = entryPoint.bankDevelopmentCards.cards;

    let players = {};
    // Ignore played cards
    for (let [player, usedAndUnused] of Object.entries(entryPoint.players)) {
        // If only the devs bought this turn are updated this is missing
        if (!usedAndUnused)
            continue;
        if (!usedAndUnused.developmentCards)
            continue;
        let devs = usedAndUnused.developmentCards.cards;
        if (devs.length === 0)
            continue;
        players[player] = devs;
    }
    res.players = players;
    // TODO: Its a little odd that we always have .players but only sometime
    //       .bank - make more consistent.
    return res;
}

/**
 * Used as '#parse' argument when constructing a 'Reparse' instance.
 * @param {*} entryPoint Decoded frame
 * @return {number} Property "type" of the frame
 */
function check_type(entryPoint) {
    return entryPoint.type;
}
