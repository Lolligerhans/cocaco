"use strict";

class Replay {
    static frames = [
        { example: "example" }
    ];

    static #isSend(frame) {
        return Object.hasOwn(frame, "v0");
    }

    static #isReceive(frame) {
        return Object.hasOwn(frame, "id");
    }

    static #send(frame) {
        const encodedFrame = cocaco_encode_send(frame);
        send_MAIN(encodedFrame, { native: true, doReparse: true });
    }

    static #receive(frame) {
        const encodedFrame = cocaco_encode_receive(frame);
        receive_MAIN(encodedFrame, { native: true, doReparse: true });
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
        console.debug("⏯️ Next position", this.position, "/", Replay.frames.length);
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

    start() {
        this.stop();
        const activeIndex = this.active;
        console.info("▶️ Replaying from position", this.position);
        setDoInterval(
            () => {
                if (this.active !== activeIndex) {
                    return true;
                }
                return this.#step()
            },
            cocaco_config.replayInterval,
        );
    }

    stop() {
        if (this.active !== 0) {
            console.info("⏸️ Stopping replay at position", this.position);
        }
        this.active += 1;
    }
};



