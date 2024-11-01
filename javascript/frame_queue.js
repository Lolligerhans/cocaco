"use strict";

/**
 * Implements a FIFO buffer which we use for our own generated outgoing frames.
 * The main goal is to delay the call to WebSocket.send() until the next event
 * cycle (our frames will almost always be generated as a response to reparsing
 * a host frame in the same event cycle).
 *
 * Do do so we must additionally ensure that the values remain valid if, during
 * consumption, we add more elements to the end of the queue. We do this by
 * using indices and keeping all elements until the queue is empty. Not sure if
 * there could even be invalidation problems in JS when using a for-of loop (?).
 *
 * Because the queue is meant for our outgoing frames we call the elements in it
 * "frames". Technically the class can be used for any kind of data.
 */
class FrameQueue {

    /**
     * Flag to ensure that we do not recurse in the code consuming the queue.
     * @type {boolean}
     */
    #occupied = false;

    /**
     * Current read position. Once this reaches the end, the queue counts as
     * empty and the #queue property can be cleared. A position index cannot be
     * invalidated when the #queue array gows or sth.
     * @type {Number}
     */
    #position = 0;

    /**
     * Array holding the actual data. The user decides on the form and type of
     * data they want to use. We only append to the array until all elements are
     * consumed. Only then do we clear the array.
     * @type {*[]}
     */
    #queue = [];

    constructor() {
        // Empty
    }

    /**
     * Append an element to the queue
     * @param {*} frame The element to append
     */
    add(frame) {
        this.#queue.push(frame);
        console.assert(this.#queue.length >= 1, "Sanity check");
    }

    clear() {
        console.assert(!this.isOccupied());
        this.#position = 0;
        this.#queue.length = 0;
    }

    /**
     * Stop occupying the frame queue. Only leave once the queue is empty.
     */
    leave() {
        // These asserts are not technically required, but this is intended use.
        console.assert(this.isOccupied(), "Frame queue is not occupied");
        console.assert(this.isEmpty(), "Valid but not expected at the moment");
        this.#occupied = false;
        this.clear();
    }

    isEmpty() {
        console.assert(this.isOccupied(), "Only use when active");
        console.assert(this.#position <= this.#queue.length, "Sanity check");
        if (!(this.isOccupied())) {
            console.trace();
            debugger;
        }
        if (!(this.#position <= this.#queue.length)) {
            console.trace();
            debugger;
        }
        return this.#position === this.#queue.length;
    }

    isOccupied() {
        return this.#occupied;
    }

    /**
     * Set the occupation flag. Allows the user to not accidentall recurse in
     * the code processing the queue. The user should verify that the queue is
     * no occupied, and then occupy the queue, before taking elements from it.
     *
     * After ocupying the queue, it must be emptied before leaving it. This is
     * not technically required; but it is the only intended use, so we sanity
     * check it.
     */
    occupy() {
        console.assert(!this.isOccupied(), "Frame queue is already occupied");
        this.#occupied = true;
    }

    /**
     * Take the next element, removing it from the queue.
     * @return {*} The next element in the queue
     */
    take() {
        console.assert(this.isOccupied(), "Only take frames when occupied");
        const nextFrame = this.#queue[this.#position];
        ++this.#position;
        return nextFrame;
    }

}
