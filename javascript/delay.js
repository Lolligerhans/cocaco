"use strict";

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
//      Restarted timeout again defer new events. Event restarts the timeout.
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

/**
 * Use this class for events to ensure a minimum delay between events. Do NOT
 * use when each of the events must be preserved (i.e., when the events carry
 * data).
 *
 * We use this for reducing the UI update frequency when triggered by socket
 * frames.
 */
class Delay {

    /**
     * Update member function bound to 'this'. To be used for intervals.
     */
    #boundUpdate;

    /**
     * @type {function(void):void} Function to be run with possible delay
     */
    delayAction;

    /**
     * Timeout ID produced by setTimeout, corresponding to the currently active
     * timeout. -1 when there is no active timeout.
     * @type {Number}
     */
    timeout = -1;

    /**
     * Options to tweak behaviour
     * @property {Number} delayTime
     * @property {Boolean} delayInitially
     * @property {Boolean} refresh
     */
    options;

    /**
     * Set by 'request()' to indicate outstanding action. Reset by 'action()'
     * whenever an action is executed.
     * @type {Boolean}
     */
    waiting = false;

    constructor(
        /**
         * @type {function(void):void} Function to be run with possible delay
         */
        action,
        {
            /**
             * Minimum duration between actions, in milliseconds
             * @type {Number}
             */
            delayTime = 1000,
            /**
             * On a first event, start timeout and execute it at completion
             * instead of executing immediately.
             * @type {Boolean}
             */
            delayInitially = false,
            /**
             * Delete active interval on every new request (delaying the action
             * indefinitely if more and more requests occur in time).
             * @type {Boolean}
             */
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
        this.#boundUpdate = this.#update.bind(this);
        // console.debug("delay.js: created", this.options);
    }

    /**
     * Request a new action. Delay will enact the request with the appropriate
     * delay. If there is a previous action already waiting, Delay will not
     * execute two actions.
     */
    request() {
        // console.debug("delay.js: request()");
        this.waiting = true;
        this.#begin();
        return;
    }

    /**
     * Call the entry point depending on whether the Delay is currently free or
     * not.
     */
    #begin() {
        if (this.#isTimeout()) {
            // console.debug("delay.js: delayed during interval!");
            this.#refresh();
            return;
        }
        this.#first();
    }

    /**
     * If the refresh option is set, resets the ongoing timeout. Does nothing if
     * the reset option is not set.
     */
    #refresh() {
        console.assert(this.#isTimeout());
        if (this.options.refresh === true) {
            // console.debug("delay.js: refresh()-ing");
            this.#stop();
            this.#start();
        }
    }

    /**
     * Implements an action request assuming the Delay is currently free.
     */
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

    /**
     * Resolves waiting request. When an action is enacted, a new timeout is
     * started.
     */
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

    /**
     * Starts delay timeout
     */
    #start() {
        console.assert(this.#isFree());
        // let timeoutId = NaN;
        this.timeout = setTimeout(this.#boundUpdate, this.options.delayTime);
        // timeoutId = deepCopy(this.timeout);
        // console.debug(
        //     "delay.js: start()-ing interval",
        //     this.timeout,
        //     "delayTime:", this.options.delayTime,
        // );
    }

    /**
     * The update function called when the timeout ends. Used as binding
     * 'this.#boundUpdate'.
     */
    #update() {
        // console.debug("delay.js: update()-ing at end of interval", id);
        // Since this update was reached, the interval has not been aborted
        this.timeout = -1;
        this.#stop();
        console.assert(this.#isFree());
        this.#action();
    }

    // ╭───────────────────────────────────────────────────────╮
    // │ Non-conditional helpers                               │
    // ╰───────────────────────────────────────────────────────╯

    /**
     * Test if the Delay is free, meaning that it is in the resting state.
     *
     * Being free implies that
     * there is no pending action. Being not free does not imply a pending
     * action: After the last pending action is enacted, a timeout is started to
     * catch the next action, without leading to an action by itself.
     * @return {Boolean} true if there are no pending timeouts
     */
    #isFree() {
        return this.timeout === -1;
    }

    /**
     * Test if the Delay has an ongoing timeout.
     *
     * Ongoing timeouts do not imply a pending action. But pending actions imply
     * ongoing timeouts.
     */
    #isTimeout() {
        return !this.#isFree();
    }

    /**
     * Clears remaining timeout, if any
     */
    #stop() {
        // console.debug("delay.js: stop()-ing interval", this.timeout);
        clearTimeout(this.timeout);
        this.timeout = -1;
    }
};
