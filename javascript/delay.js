"use strict";

// Use this class for events to ensure a minimum delay between events. Do NOT
// use when each of the events must be preserved (i.e., when the events carry
// data).

// We use this for socket events that trigger updates to the state. Example:
// the DOM should not be updated after every frame.

// Illustration:
//      A timeout interval is started after executing an event.
//            +             +
//          --<======>------<======>--
//            ✔             ✔
//
//      Events during timeout are deferred until the timeout concludes. The
//      deferred event restarts the timeout.
//            +  +               +  +
//          --<======|======>----<======|======>--
//            ✔  ✖   ●           ✔  ✖   ●
//
//      Restarted timeouts again defer new evets. event restarts the timeout.
//            +  +      +               +  +      +      +
//          --<======|======|======>----<======|======|======|======>
//            ✔  ✖   ●  ✖   ●           ✔  ✖   ●  ✖   ●  ✖   ●
//
//      Multiple events during a timeout result in only a single delayed event.
//            + + +              + + +
//          --<======|======>----<======|======>
//            ✔ ✖ ✖  ●           ✔ ✖ ✖  ●
//
//
//      Option delayInitially = true.
//            +                  +  +
//          --<======|======>----<======|======>--
//            ✖      ●           ✖  ✖   ●
//
//      Option refresh = true.
//            +  +           +  +     +  +
//          --<==|======>----<==|=====|==|======|======>--
//            ✔  ✖           ✔  ✖     ✖  ✖      ●

// Legend:
//      -------  Time moving right
//            +  Event request by user
//            ✔  Event executed immediately
//            ✖  Event deleted during delay
//            ●  Event injected after the delay time
//        <===>  Timeout interval
//      <==|==>  Extended timeout interval after delayed action

class Delay {

    constructor(
        action,
        {
            // Duration of delay time in milliseconds
            delayTime = 1000,
            // On initial event, start timeout and execute it at completion
            // instead of executing immediately. This option is to delay
            // auto-actions like trades that result from socket input.
            delayInitially = false,
            // Delete running interval ony every new request (delaying the
            // action indefinitely if more and more requests occur). This option
            // is to delay auto-actions like trades that result from socket
            // input.
            refresh = false,
        } = {},
    ) {
        // The action to be executed with at least 'options.delayTime' delay.
        // Should be an action without state or data, like triggering an event.
        this.delayAction = action;
        // Options to select between predefined behaviours
        this.options = {
            delayTime: delayTime,
            delayInitially: delayInitially,
            refresh: refresh,
        };
        // -1 when interval is inactive. The interval id when delay interval is
        //  active. We have at most a single interval active at a time. When we
        //  want to prolong an ongoing interval, we delete the old interval and
        //  start a new one.
        this.timeout = -1;
        // Set by 'request()' to indicate outstanding action. Reset by
        // 'action()' whenever an action is executed.
        this.waiting = false;

        // console.debug("delay.js: created", this.options);
    }

    request() {
        // console.debug("delay.js: request()");
        this.waiting = true;
        this.#begin();
        return;
    }

    #begin() {
        if (this.#isTimeout()) {
            // console.debug("delay.js: delayed during interval!");
            this.#refresh();
            return;
        }
        this.#first();
    }

    #refresh() {
        console.assert(this.#isTimeout());
        if (this.options.refresh === true) {
            // console.debug("delay.js: refresh()-ing");
            this.#stop();
            this.#start();
        }
    }

    #first() {
        console.assert(this.#isFree());
        if (this.options.delayInitially === true) {
            // console.debug("delay.js: delaying first() action");
            this.#start();
        } else {
            // console.debug("delay.js: Executing first() action");
            this.#action();
        }
    }

    // Resolves waiting request
    #action() {
        console.assert(this.#isFree());
        if (this.waiting === false) {
            return;
        }
        // console.debug("delay.js: executing action()");
        this.waiting = false;
        (this.delayAction)();
        this.#start();
    }

    // ╭───────────────────────────────────────────────────────╮
    // │ Delay                                                 │
    // ╰───────────────────────────────────────────────────────╯

    // Starts delay time
    #start() {

        console.assert(this.#isFree());
        let timeoutId = NaN;
        this.timeout = setTimeout(
            () => this.#update(timeoutId),
            this.options.delayTime,
        );
        timeoutId = deepCopy(this.timeout);
        // console.debug(
        //     "delay.js: start()-ing interval",
        //     this.timeout,
        //     "delayTime:", this.options.delayTime,
        // );
    }

    // Called whenever the delay time ends
    #update(id) {
        // console.debug("delay.js: update()-ing at end of interval", id);
        // Since this update was reached, the interval has not beed aborted
        this.timeout = -1;
        this.#stop();
        console.assert(this.#isFree());
        this.#action();
    }

    // ╭───────────────────────────────────────────────────────╮
    // │ Non-conditional helpers                               │
    // ╰───────────────────────────────────────────────────────╯

    #isFree() {
        return this.timeout === -1;
    }

    #isTimeout() {
        return !this.#isFree();
    }

    #stop() {
        // console.debug("delay.js: stop()-ing interval", this.timeout);
        clearTimeout(this.timeout);
        this.timeout = -1;
    }


};
