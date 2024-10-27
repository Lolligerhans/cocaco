"use strict";

class Resend {

    // When true, all resenders will quit on next invocation. This prevents
    // infinite refresh loops when the sequence number in automatically sent
    // frames is broken.
    aborted = false;

    logger = new MessageLog();

    // The sequence number the next host frame should have. After we injected
    // messages the host sequence number will match this, but the post-send
    // verification will expecte a higher value.
    sequence = null;
    // The serverId each 3-1 frame includes
    serverId = null;
    // Number of frames injected by Resend.
    injectionOffset = 0; // #injected_frames - #intercepted_frames

    // Because Resend interferes with the global host sequence number we track
    // the number of instances. Only a single instance is intended.
    static instanceCount = 0;

    set(sequence) {
        console.error("Setting sequence to:", v);
        console.trace();
        this.sequence = sequence;
    }

    // NOTE: Because we require some information from reparsers, the Resender
    //       should be generated before registering other reparsers. This allows
    //       the resender to learn something from a frame and a different
    //       reparser use that knowledge immediately after. Also, the sequence
    //       number correction must be first to hide frames from other
    //       reparsers.
    constructor() {
        this.logger.enabled = cocaco_config.log.resend;
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
            null,
            `Resend: constructing instance ${Resend.instanceCount++}`,
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
                null,
                `Resend: Choosing sequence ${chosenSequence}` +
                ` (was ${frame.message.sequence})`
            );
            frame.message.sequence = chosenSequence;
            ++this.injectionOffset;
        }

        // If we do not register Resend as the first reparsers we may be unable
        // to send messages immediately when reparsing them (because resend my
        // need the data from that message to do so).
        console.assert(Reparse.reparsers.receive.length === 0);
        console.assert(Reparse.reparsers.send.length === 0);

        this.#register();
    }

    abort(set = null) {
        if (set === null) {
            return this.aborted;
        }
        console.assert(set === true);
        if (cocaco_config.abort === true) {
            this.aborted = set;
        }
        console.info("❌ resend.js: Aborting");
    }

    checkSequcence(sequence) {
        const correct = sequence === this.expectedSequence();
        const printWrong = () => {
            console.warn(
                "Resend is out of sync:", sequence,
                `(frame) !== (expected)`, this.expectedSequence(),
            );
        };
        const printCorrect = () => {
            this.logger.log(null,
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

    expectedSequence() {
        // @return The sequence number the next outgoing frame should have.
        //         Including our injected frames.
        return this.sequence + this.injectionOffset;
    }

    #register() {
        for (const regFunc of Resend.registerFunctions) {
            regFunc.call(this);
        }
    }

    regularSequence() {
        // @return The sequence number the next outgoing 3-1 host frame should
        //         have. Excluding our injected frames.
        return this.sequence;
    }

    sendFrame(
        frame,
        reparseOptions = new ReparseOptions(),
    ) {
        // Currently users should use sendMessage because we expect only 3-1
        // frames.
        console.assert(reparseOptions.adjustSequence === null);
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

    test() {
    }

};

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
                // Sequene injection should prevent this from happening. If this
                // happens regularly, something is wrong.
                this.serverId = message.payload;
                this.sequence = message.sequence;
                this.injectionOffset = 0;
                console.error("resend.js: 🔁 Resetting sequence", this.sequence);
                return { isDone: false };
            }
            console.assert(message.sequence === this.regularSequence());
            const newSequence = this.expectedSequence();
            this.logger.log(null,
                `resend.js: Correcting sequence ` +
                `${message.sequence} 🔀 ${newSequence}`,
            );
            message.sequence = deepCopy(newSequence);
            return { isDone: false, frame: frame };
        },
    );
};

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
            this.logger.log(null,
                `Resend: Starting expected sequence:` +
                `${this.expectedSequence()}`,
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
                this.logger.log(null,
                    `Resend: Server ID set to: ${str}`,
                );
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

// Resend.prototype.registerChatEcho = function () {
//     Reparse.register(
//         "send",
//         "Resend-ChatEcho",
//         Reparse.applySend.inGame(),
//         Reparse.entryPointsSend.message,
//         message => message,
//         (message, frame, reparse) => {
//             if (cocaco_config.echo === false) {
//                 return { isDone: true };
//             }
//             if (this.abort()) {
//                 return { isDone: true };
//             }
//             if (reparse.native === false) {
//                 console.debug("😄 Skipping injected message:", message);
//                 return { isDone: false, frame: frame };
//             }
//             if (message.action == null) {
//                 return { isDone: false };
//             }
//             if (message.action !== 0) {
//                 return { isDone: false };
//             }
//
//             const copy = deepCopy(frame);
//             copy.message.payload += "+";
//             copy.message.sequence += 1;
//             this.sendFrame(copy, { native: false, doReparse: true });
//
//             const copy2 = deepCopy(frame);
//             copy2.message.payload += "(+)";
//             copy2.message.sequence += 2;
//             this.sendFrame(copy2, { native: false, doReparse: false });
//
//             message.payload += "_";
//             console.debug("Modifying chat to:", message.sequence, "=", message);
//             // this.sendMessage(message);
//             return { isDone: false, frame: frame };
//         },
//     );
// };

// Resend.prototype.registerTest = function () {
//     Reparse.register(
//         "send",
//         "Resend-test",
//         Reparse.applySend.isAction(50),
//         Reparse.entryPointsSend.message,
//         message => message,
//         (_message, _frame, _reparse) => {
//             if (cocaco_config.resendTest === false) {
//                 return { isDone: true };
//             }
//             return { isDone: false };
//         },
//     );
// };

Resend.registerFunctions = [
    Resend.prototype.registerSequenceCorrector,
    Resend.prototype.registerSequenceCounter,
    // Resend.prototype.registerChatMuter,
    Resend.prototype.registerServerId,
    // Resend.prototype.registerChatEcho,
    // Resend.prototype.registerTest,
];
