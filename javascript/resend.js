"use strict";

/**
 * Resend orchestrates frame injections.
 *
 * Because we do not meddle in the host JS, just calling WebSocket.send() would
 * desynchronise the sequence number. Resend is used to inject outgoing frames
 * while keeping sequence numbers consistent. This involves:
 *  - Count frame to validate sequence number
 *  - Set correct sequence number for injected frames
 *  - Modify native frames to match sequence numbers after we injected any
 *    frames
 */
class Resend {

    /**
     * When true, all resenders will quit on next invocation. This prevents
     * infinite refresh loops when the sequence number in automatically sent
     * frames is broken.
     * @type {Boolean}
     */
    aborted = false;

    /**
     * Closure used to generate current-when-called sequence numbers. This
     * function is used as the default (and currently, only) value for
     * 'adjustSequence' in 'ReparseOptions'.
     * @type {function(*):void}
     * Function taking a frame (in decoded format), modifying the frame's
     * 'sequence' property.
     */
    defaultAdjustSequence;

    /**
     * @type {ConsoleLog}
     */
    logger = new ConsoleLog("Resend", "♻️");

    /**
     * The sequence number the next host frame should have. After we injected
     * messages the host sequence number will match this, but the post-send
     * verification will expect a higher value.
     * @type {Number}
     */
    sequence = null;

    /**
     * The serverId each 3-1 frame includes, as described by the documentation.
     * @type {string}
     */
    serverId = null;

    /**
     * Number of frames injected by Resend, starting at 0. When we inject
     * frames, injectionOffset increases. When we delete frames, it decreases.
     *
     * When the value is nonzero, all native sent frames are sequence-corrected.
     * For sequence correction, frames are replaced by a replica with corrected
     * sequence number.
     *
     * @type {Number}
     */
    injectionOffset = 0; // #injected_frames - #intercepted_frames

    /**
     * Because we register global resenders, and modify global WebSocket frames,
     * we cannot have more than 1 instance.
     * @type {Number}
     */
    static instanceCount = 0;

    // NOTE: Because we require some information from reparsers, the Resender
    //       should be generated before registering other reparsers. This allows
    //       the resender to learn something from a frame and a different
    //       reparser use that knowledge immediately after. Also, the sequence
    //       number correction must be first to hide frames from other
    //       reparsers.
    constructor() {
        console.assert(
            Reparse.reparserCount() === 0,
            "Resend should be constructed before registering other reparsers",
        );
        console.assert(socketsReady === false);
        console.assert(
            Resend.instanceCount === 0,
            "Multiple instances interfere with their sequence numbers",
        );

        this.logger.log(
            "Resend: constructing instance",
            Resend.instanceCount++,
        );

        this.defaultAdjustSequence = (frame) => {
            console.assert(frame.message.sequence,
                "We expect all frames to have sequencec numbers");
            console.assert(
                this.sequence !== null,
                "Must have seen the first real sequence nuber first",
            );
            const chosenSequence = this.expectedSequence();
            this.logger.log(
                "Resend: Choosing sequence", chosenSequence,
                `(was ${frame.message.sequence})`
            );
            frame.message.sequence = chosenSequence;
            ++this.injectionOffset;
        }

        // If we do not register Resend as the first reparsers we may be unable
        // to send messages immediately when reparsing them (because resend my
        // need the data from that message to do so).
        console.assert(Reparse.reparsers.receive.length === 0);
        console.assert(Reparse.reparsers.send.length === 0);

        this.#registerRequiredReparsers();
    }

    /**
     * Query or set abort flag. If this flag is enabled in 'cocaco_config',
     * Resend will permanently cease all function once the flag is set.
     *
     * This protects against infinite-reset loops that are generated if Resend
     * chooses a wrong sequence number (prompting the host to reset, only to
     * generate the wrong sequence number immediately after).
     * @param {Boolean} [setTo=null] If set to true/false, set the abort flag.
     * @return {Boolean} The current value of the abort flag (after executing
     *                   the current abort call).
     */
    abort(setTo = null) {
        if (setTo === null) {
            return this.aborted;
        }
        console.assert(setTo === true);
        if (cocaco_config.abort === true) {
            this.aborted = setTo;
        }
        console.info("❌ resend.js: Aborting");
        return this.aborted;
    }

    /**
     * Verify 'sequence' matches the currently expected sequence number. Log
     * correct checks using this.logger. Warn about incorrect results on
     * console.
     * @param {Number} sequence
     * @return {Boolean} true if the sequence number is correct, else false
     */
    checkSequcence(sequence) {
        const correct = sequence === this.expectedSequence();
        const printWrong = () => {
            console.warn(
                "Resend is out of sync:", sequence,
                `(frame) !== (expected)`, this.expectedSequence(),
            );
        };
        const printCorrect = () => {
            this.logger.log(
                `Resend sequence OK: ${sequence}` +
                `(frame) === (expected) ${this.expectedSequence()}`,
            );
        };
        if (correct) {
            if (sequence % cocaco_config.printResendSequence === 0) {
                printCorrect();
            }
        } else {
            printWrong();
        }
        return correct;
    }

    /**
     * @return {Number}
     * The sequence number the next frame should have, adjusted for our
     * injections.
     */
    expectedSequence() {
        // @return The sequence number the next outgoing frame should have.
        //         Including our injected frames.
        return this.sequence + this.injectionOffset;
    }

    /**
     * Register all our required reparsers with the 'Reparse' module. 'Resend'
     * uses 'Reparse' as its source of data.
     */
    #registerRequiredReparsers() {
        for (const regFunc of Resend.registerFunctions) {
            regFunc.call(this);
        }
    }

    /**
     * @return {Number}
     * The sequence number the next outgoing 3-1 host frame should have.
     * Excluding our injected frames.
     */
    regularSequence() {
        return this.sequence;
    }

    /**
     * Inject frame. This function adds to the outgoing queue, which will
     * process the frame in a later event cycle.
     *
     * Currently we only use this function indirectly for frames constructed by
     * 'sendMessage()'.
     * @param {*} frame Decoded frame to be encoded and sent.
     * @param {ReparseOptions} [reparseOptions=new ReparseOptions()]
     * If the injected frame must be treated differently by 'Reparse', this can
     * be specified by 'ReparseOptions'. For regular injection the default is
     * fine.
     */
    sendFrame(
        frame,
        reparseOptions = new ReparseOptions(),
    ) {
        // Currently users should use sendMessage because we expect only 3-1
        // frames.
        // Currently we expect no adjustSequence, but is valid in principle.
        console.assert(reparseOptions.adjustSequence === null);
        if (!(reparseOptions.adjustSequence === null)) {
            debugger; // FIXME: Bug
        }
        if (reparseOptions.adjustSequence === null) {
            reparseOptions.adjustSequence = this.defaultAdjustSequence;
        }
        // console.debug("resend.js: sendFrame(): Adding outgoing frame");
        outgoing.add({
            direction: "send",
            frame: frame,
            reparseOptions: reparseOptions,
        });
        post_MAIN();
    }

    /**
     * Constructs and sends a 3-1 frame for the provided message.
     * @param {*} message Message (decoded) to be sent
     * @param {ReparseOptions} [reparseOptions]
     * If the injected frame must be treated differently by 'Reparse', this can
     * be specified by 'ReparseOptions'. For regular injection, do not provide
     * a value
     */
    sendMessage(message, reparseOptions = undefined) {
        if (this.serverId === null) {
            console.error("Must observe 'str' once before sending messages");
            return;
        }
        // console.debug("Constructing new 3-1 frame for message =", message);
        this.sendFrame(
            { v0: 3, v1: 1, str: this.serverId, message: message },
            reparseOptions,
        );
    }

    /**
     * For implementing ad-hoc tests. Enabled in config. An onclick event is
     * added to call this function.
     */
    test() {
        if (cocaco_config.resendTestOnClick === false) {
            return;
        }
        console.info("Testing");

        const message = {
            action: 0,
            payload: "test",
        };
        this.sendMessage(message);
    }

};

/**
 * The sequence corrector replaces host frames by a replica with a different
 * sequence number. Frames with correct sequence number are not replaced.
 * Sequence numbers can be incorrect after we injected frames; the host will
 * continue with its own sequence number, lagging behind the sequence number
 * expected from the outside.
 */
Resend.prototype.registerSequenceCorrector = function () {
    Reparse.register(
        "send",
        "Resend-SequenceCorrector",
        Reparse.applySend.byType({ v0: 3, v1: 1 }),
        Reparse.entryPointsSend.message,
        message => message,
        (message, frame, reparse) => {
            if (reparse.native === false) {
                return { isDone: false };
            }
            if (this.injectionOffset === 0) {
                return { isDone: false };
            }
            if (message.action === 68) {
                // Sequence injection should prevent this from happening. If
                // this happens regularly, something is wrong.
                this.serverId = message.payload;
                this.sequence = message.sequence;
                this.injectionOffset = 0;
                console.error("resend.js: 🔁 Resetting sequence", this.sequence);
                return { isDone: false };
            }
            console.assert(message.sequence === this.regularSequence());
            if (!(message.sequence === this.regularSequence())) {
                debugger; // FIXME: Bug
            }
            const newSequence = this.expectedSequence();
            this.logger.log(
                `resend.js: Correcting sequence ${message.sequence} 🔀`,
                newSequence,
            );
            message.sequence = deepCopy(newSequence);
            return { isDone: false, frame: frame };
        },
    );
};

/**
 * The sequence counter initialises the sequence number.
 *
 * Also verifies the correctness of later sequence numbers, but that is not very
 * useful at the moment.
 */
Resend.prototype.registerSequenceCounter = function () {
    const callback = (sequence, _frame, reparseOptions) => {
        if (this.abort()) {
            return { isDone: true };
        }
        if (reparseOptions.native === false) {
            return { isDone: false };
        }
        if (this.sequence === null) {
            this.sequence = sequence + 1;
            this.logger.log(
                "Resend: Starting expected sequence:", this.sequence,
            );
            return { isDone: false };
        }
        const correctSequence = this.checkSequcence(sequence);
        if (!correctSequence) {
            this.abort(true);
        }
        ++this.sequence;
        return { isDone: false };
    };
    Reparse.register(
        "send",
        "Resend-SequenceCounter",
        Reparse.applySend.byType({ v0: 3, v1: 1 }),
        Reparse.entryPointsSend.message,
        message => message.sequence,
        callback,
    );
};

// Resend.prototype.registerChatMuter = function () {
//     Reparse.register(
//         "send",
//         "Resend-ChatMuter",
//         Reparse.applySend.byType({ v0: 3, v1: 1, action: 0 }),
//         Reparse.entryPointsSend.payload,
//         payload => payload.action,
//         (_action, frame, reparse) => {
//             if (cocaco_config.mute === false) {
//                 return { isDone: true };
//             }
//             if (reparse.native === false) {
//                 // Would mess up sequence number
//                 return { isDone: false };
//             }
//             // Mute randomly so we can echo test at the same time
//             if (Math.random() > 0.5) {
//                 console.debug("resend.js: Not muting chat message");
//                 return { isDone: false };
//             }
//             console.debug("resend.js: Muting chat message",
//                 frame.message.action);
//             --this.injectionOffset;
//             return { isDone: false, frame: null };
//         },
//     );
// };

/**
 * The server ID reparser waits for the first frame containing the server ID.
 * The server ID is saved and the reparser shuts down. We need the server ID to
 * construct valid outgoing frames.
 *
 * Before the server ID was found, no frames can be sent.
 */
Resend.prototype.registerServerId = function () {
    Reparse.register(
        "send",
        "Resend-ServerId",
        Reparse.applySend.byType({ v0: 3, v1: 1 }),
        frame => frame,
        frame => frame.str,
        str => {
            if (this.abort()) {
                return { isDone: true };
            }
            if (this.serverId === null) {
                this.serverId = str;
                this.logger.log("Resend: Server ID set to:", str);
                return { isDone: false };
            }
            const isConsistent = this.serverId === str;
            if (isConsistent) {
                return { isDone: false };
            }
            console.error("Resend inconsistent str:",
                str, "!==", this.serverId);
            this.abort(true);
            return { isDone: true };
        },
    );
};

Resend.prototype.registerChatEcho = function () {
    Reparse.register(
        "send",
        "Resend-ChatEcho",
        Reparse.applySend.inGame(),
        Reparse.entryPointsSend.message,
        message => message,
        (message, frame, reparse) => {
            if (cocaco_config.echo === false) {
                return { isDone: true };
            }
            if (this.abort()) {
                return { isDone: true };
            }
            if (reparse.native === false) {
                console.debug("😄 Skipping injected message:", message);
                return { isDone: false, frame: frame };
            }
            if (message.action == null) {
                return { isDone: false };
            }
            if (message.action !== 0) {
                return { isDone: false };
            }

            const copy = deepCopy(frame);
            copy.message.payload += "+";
            this.sendFrame(
                copy,
                new ReparseOptions({ native: false, doReaprse: true }),
            );

            const copy2 = deepCopy(frame);
            copy2.message.payload += "(+)";
            this.sendFrame(
                copy2,
                new ReparseOptions({ native: false, doReaprse: false }),
            );

            message.payload += "_";
            console.debug("Modifying chat to:", message.sequence, "=", message);
            // this.sendMessage(message);
            return { isDone: false, frame: frame };
        },
    );
};

/**
 * Array of prototype functions that will be called on construction to
 * register the required reparsers. The order matters.
 * @type {(function():void)[]}
 */
Resend.registerFunctions = [
    Resend.prototype.registerSequenceCorrector,
    Resend.prototype.registerSequenceCounter,
    // Resend.prototype.registerChatMuter,
    Resend.prototype.registerServerId,
    Resend.prototype.registerChatEcho,
];
