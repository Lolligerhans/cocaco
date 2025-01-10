"use strict";

/**
 * Class to inject pre-recorded frames. So we can test without having to visit
 * the host website. Set matching URLS to "<all_urls>" in manifest to test on
 * any website.
 *
 * The frame data is hardcoded in JS, coming from data/. In the future this
 * could be a web-accessible resources to be loaded.
 */
class Replay {

    /**
     * This object is overwritten on startup by hardcoded frames given in
     * data/example.js.
     * @type {*[]}
     */
    static frames = [{example: "example"}];

    static #isSend(frame) {
        return Object.hasOwn(frame, "v0");
    }

    static #isReceive(frame) {
        return Object.hasOwn(frame, "id");
    }

    /**
     * Emulate a sent frame by calling the same function used by the MAIN world
     * to pass frames to content scripts.
     * @param {*} frame Frame, decoded, to be encoded and "sent"
     */
    static #send(frame) {
        const encodedFrame = cocaco_encode_send(frame);
        send_MAIN(encodedFrame, {native: true, doReparse: true});
    }

    /**
     * Emulate a received frame by calling the same function used by the MAIN
     * world to pass frames to content scripts.
     * @param {*} frame Frame, decoded, to be encoded and "received"
     */
    static #receive(frame) {
        const encodedFrame = cocaco_encode_receive(frame);
        receive_MAIN(encodedFrame, {native: true, doReparse: true});
    }

    constructor() {
        this.position = 0;
        this.active = 0;
    }

    #done() {
        const ret = this.position >= Replay.frames.length;
        if (ret === true) {
            console.debug("⏹️ Replay done");
        }
        return ret;
    }

    #next() {
        console.debug("⏯️ Next position", this.position, "/",
                      Replay.frames.length);
        const frame = Replay.frames[this.position];
        ++this.position;
        return frame;
    }

    #step() {
        const frame = this.#next();
        if (Replay.#isSend(frame)) {
            Replay.#send(frame);
        } else if (Replay.#isReceive(frame)) {
            Replay.#receive(frame);
        } else {
            console.assert(false, "Unreachable");
            debugger;
        }
        return this.#done();
    }

    /**
     * Start emitting frames at a constant rate. Can be stooped with stop().
     */
    start() {
        this.stop();
        const activeIndex = this.active;
        console.info("▶️ Replaying from position", this.position);
        setDoInterval(() => {
            if (this.active !== activeIndex) {
                return true;
            }
            return this.#step()
        }, cocaco_config.replayInterval);
    }

    /**
     * Stop emitting frames after having called start() previously. Does nothing
     * if start() was not called.
     */
    stop() {
        if (this.active !== 0) {
            console.info("⏸️ Stopping replay at position", this.position);
        }
        this.active += 1;
    }
};
