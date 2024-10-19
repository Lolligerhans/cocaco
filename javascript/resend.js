"use strict";

class Resend {
    sequence = null;

    set(sequence) {
        console.error("Setting sequence to:", v);
        console.trace();
        this.sequence = sequence;
    }

    // NOTE: Because we require some information from reparsers, the Resender
    //       should be generated before registering other reparsers. This allows
    //       the resender to learn something from a frame and a different
    //       reparser use that knowledge immediately after.
    //       For example, the reparser can use resender with correct sequence
    //       number after reparsing a "send" frame.
    //       Also, the sequence number correction must be first to hide frames
    //       from other reparsers.
    constructor() {
        console.assert(socketsReady === false);

        this.aborted = false;

        // Track and validate contents (see message_format.md)
        this.str = null;
        this.injectionOffset = 0; // #injected_frames - #intercepted_frames

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
            console.debug(
                "Resend sequence OK:", sequence,
                `(frame) === (expected)`, this.expectedSequence(),
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
        // @return The sequence number the next reparsed outgoing frame is
        //         expected to have.
        return this.sequence + this.injectionOffset;
    }

    nextSequence() {
        // @return The sequence number users should set in their message objects
        //         when sending.
        return this.expectedSequence();
    }

    #register() {
        for (const regFunc of Resend.registerFunctions) {
            regFunc.call(this);
        }
    }

    sendFrame(frame, reparse = { native: false, doReparse: false }) {
        console.debug("resend.js: sendFrame(): Adding outgoing frame");
        outgoing.add({ direction: "send", frame: frame, reparse: reparse });
        ++this.injectionOffset;
        post_MAIN();
    }

    sendMessage(message, reparse = undefined) {
        if (this.str === null) {
            console.error("Must observe 'str' once before sending messages");
            return;
        }
        console.debug("Constructing new 3-1 frame for message =", message);
        this.sendFrame(
            { v0: 3, v1: 1, str: this.str, message: message },
            reparse,
        );
    }

    test(serverId) {
        if (!cocaco_config.test) {
            console.debug("Testig disabled!");
            return;
        }
        console.assert(serverId !== null);

        console.debug("Test message: wrong sequence number (13)");
        const message = {
            payload: true,
            sequence: 13,
            action: 2,
        };

        console.debug("☺ Sending test message:", message);
        console.debug("☺ Sending to serverId:", serverId);
        this.sendFrame(
            { v0: 3, v1: 1, str: serverId, message: message }
        );
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
                // TODO: Can we sequence injections s.t. the corrector works
                //       on them?
                return { isDone: false };
            }
            if (this.injectionOffset === 0) {
                return { isDone: false };
            }
            if (message.action === 68) {
                // Sequene injection should prevent this from happening in
                // normal use. If this happens regularly, something is wrong.
                console.error("resend.js: Resetting with host");
                this.str = message.payload;
                this.sequence = message.sequence;
                this.injectionOffset = 0;
                return { isDone: false };
            }
            const newSequence = message.sequence + this.injectionOffset;
            console.debug(
                `resend.js: Correcting ${message.sequence}→${newSequence}`
            );
            message.sequence = deepCopy(newSequence);
            return { isDone: false, frame: frame };
        },
    );
};

Resend.prototype.registerSequenceCounter = function () {
    const callback = (sequence, _frame, reparse) => {
        if (this.abort()) {
            return { isDone: true };
        }
        if (reparse.native === false) {
            return { isDone: false };
        }
        if (this.sequence === null) {
            this.sequence = sequence + 1;
            console.debug(
                "Resend: Starting expected sequence",
                this.expectedSequence(),
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

Resend.prototype.registerChatMuter = function () {
    Reparse.register(
        "send",
        "Resend-ChatMuter",
        Reparse.applySend.byType({ v0: 3, v1: 1, action: 0 }),
        Reparse.entryPointsSend.payload,
        payload => payload.action,
        (_action, frame, reparse) => {
            if (cocaco_config.mute === false) {
                return { isDone: true };
            }
            if (reparse.native === false) {
                // Would mess up sequence number
                return { isDone: false };
            }
            // Mute randomly so we can echo test at the same time
            if (Math.random() > 0.5) {
                console.debug("resend.js: Not muting chat message");
                return { isDone: false };
            }
            console.debug("resend.js: Muting chat message",
                frame.message.action);
            --this.injectionOffset;
            return { isDone: false, frame: null };
        },
    );
};

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
            if (this.str === null) {
                this.str = str;
                console.log("resend.js: saving str =", str);
                return { isDone: false };
            }
            const isConsistent = this.str === str;
            if (isConsistent) {
                return { isDone: false };
            }
            console.error("Resend inconsistent str:",
                str, "!==", this.str);
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
            copy.message.sequence += 1;
            this.sendFrame(copy, { native: false, doReparse: true });

            const copy2 = deepCopy(frame);
            copy2.message.payload += "(+)";
            copy2.message.sequence += 2;
            this.sendFrame(copy2, { native: false, doReparse: false });

            message.payload += "_";
            console.debug("Modifying chat to:", message.sequence, "=", message);
            // this.sendMessage(message);
            return { isDone: false, frame: frame };
        },
    );
};

Resend.prototype.registerTest = function () {
    Reparse.register(
        "send",
        "Resend-test",
        Reparse.applySend.isAction(50),
        Reparse.entryPointsSend.message,
        message => message,
        (message, _frame, _reparse) => {
            if (cocaco_config.resendTest === false) {
                return { isDone: true };
            }
            if (message.payload.response !== 0) {
                return { isDone: false };
            }
            console.warn("Accepting for the opponent");
            const forceMessage = {
                action: 51,
                payload: {
                    tradeId: message.payload.id,
                    playerToExecuteTradeWith: 1,
                },
                sequence: this.nextSequence(),
            };
            console.debug("The accept message:", p(forceMessage));
            this.sendMessage(forceMessage);
            return { isDone: false };
        },
    );
};

Resend.registerFunctions = [
    Resend.prototype.registerSequenceCorrector,
    Resend.prototype.registerSequenceCounter,
    Resend.prototype.registerChatMuter,
    Resend.prototype.registerServerId,
    Resend.prototype.registerChatEcho,
    Resend.prototype.registerTest,
];
