"use strict";

//      clear             add ⨉ 3             occupy              take
//
//  ⎡ -1:  ---  ⎤←pos  ⎡ -1:  ---  ⎤←pos  ⎡ -1:  ---  ⎤      ⎡ -1:  ---  ⎤
//  ⎢  0:  ---  ⎢      ⎢  0: frame ⎢      ⎢  0: frame ⎢←pos  ⎢  0: frame ⎢
//  ⎢  1:  ---  ⎢      ⎢  1: frame ⎢      ⎢  1: frame ⎢      ⎢  1: frame ⎢←pos
//  ⎢  2:  ---  ⎢      ⎢  2: frame ⎢      ⎢  2: frame ⎢      ⎢  2: frame ⎢
//  ⎢  3:  ---  ⎢      ⎢  3:  ---  ⎢      ⎢  3:  ---  ⎢      ⎢  3:  ---  ⎢
//  ⎢  ⋮        ⎥      ⎢  ⋮        ⎥      ⎢  ⋮        ⎥      ⎢  ⋮        ⎥
//  ⎣  N:  ---  ⎦      ⎣  N:  ---  ⎦      ⎣  N:  ---  ⎦      ⎣  N:  ---  ⎦

// NOTE: Implement such that modification during iteration is possible

class FrameQueue {
    constructor() {
        this.position = -1;
        this.queue = [];
        this.clear();
    }

    add(frame) {
        this.queue.push(frame);
        console.assert(this.queue.length >= 1, "Sanity check");
    }

    clear() {
        this.position = -1;
        this.queue.length = 0;
    }

    leave() {
        // These asserts are not technically required, but this is intended use.
        console.assert(this.isOccupied(), "Frame queue is not occupied");
        console.assert(this.position === this.queue.length);
        this.clear();
    }

    isEmpty() {
        console.assert(this.isOccupied(), "Only use when active");
        console.assert(this.position <= this.queue.length, "Sanity check");
        if(!(this.isOccupied())) {
            console.trace();
            debugger;
        }
        if(!(this.position <= this.queue.length)) {
            console.trace();
            debugger;
        }
        return this.position === this.queue.length;
    }

    isOccupied() {
        console.assert(this.position >= -1, "Sanity check");
        return this.position !== -1;
    }

    occupy() {
        console.assert(!this.isOccupied(), "Frame queue is already occupied");
        this.position = 0;
    }

    take() {
        console.assert(this.isOccupied(), "Only take frames when occupied");
        const nextFrame = this.queue[this.position];
        ++this.position;
        return nextFrame;
    }

}
