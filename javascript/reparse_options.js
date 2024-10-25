"use strict";

class ReparseOptions {
    // Describes the reparse options for 'Resend' so we dont have to guess what
    // is expected.
    native = false;
    doReparse = false;
    adjustSequence = null;
    constructor({ native = null, doReparse = null, adjustSequence = null } = {}) {
        /**
         * Options added to events in the outgoing queue by Resend, interpreted
         * by Reparse. For regular sending, use defaults.
         * @param native Set to 'true' if the message is from the host. Only set
         *        by the code handling socket frames.
         * @param doReparse Set to ''
         * @param adjustSequence Function used to generate the sequence number
         *        just before sending. That is, such that no other events can
         *        come before WebSocket.send() is called. This is needed because
         *        we append all regular send operations to the event cycle
         *        (rather than sending immediately) to ensure sequence
         *        correctness of the host's messages. 'adjustSequence' can react
         *        to the action the host took during the events in-between.
         */
        if (native) this.native = native;
        if (doReparse) this.doReparse = doReparse;
        if (adjustSequence) this.adjustSequence = adjustSequence;
    }
}
