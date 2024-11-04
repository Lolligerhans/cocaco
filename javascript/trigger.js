"use strict";

// No dependencies

/**
 * @callback CallbackFunction
 * A callback function registered to be called on trigger events
 * @param {Object} data The data passed to 'activateTrigger()'
 * @return {Boolean} true to stop listening, false to continue
 */

/**
 * Implements events, but calling it "triggers". Prevent ambiguity with JS event
 * loop.
 */
class Trigger {

    static #always = "trigger_always";

    /**
     * Maps trigger names to an array of registerd callbacks
     * @type {Object<string, CallbackFunction[]>}
     */
    #triggers = {};

    /**
     * Should be used by derived classes.
     */
    constructor() {
        // Empty
    }

    /**
     * Generate an event. Unregisters callbacks returning true ("done"). Meant
     * to be called from derived classes (like protected).
     * @param {String} name Name of the event to fire.
     * @param {*} data Data to pass to each registered callback function
     */
    activateTrigger(name, data) {
        // For debugging, pretend 
        this.#ensureTrigger(Trigger.#always);
        this.#triggers[Trigger.#always] = this.#triggers[Trigger.#always]
            .filter(callback => {
                return !callback({ name: name, data: data });
            });
        // console.debug("trigger: Activating trigger:", name, data);
        this.#ensureTrigger(name);
        this.#triggers[name] = this.#triggers[name]
            .filter(callback => {
                return !callback(data);
            });
    }

    /**
     * If this.#triggers does not have the required key yet, add it.
     * @param {String} name Name of the trigger we want to ensure has an entry
     *                      in this.#triggers.
     */
    #ensureTrigger(name) {
        if (!Object.hasOwn(this.#triggers, name)) {
            // console.debug("Trigger: Ensuring trigger (by adding it empty):", name);
            this.#triggers[name] = [];
        }
    }

    /**
     * Register an event listener
     * @param {String} name
     * Name of the trigger to be listened to. The calling code must know what
     * triggers are available. Must not be equal to Trigger.#always, which is
     * reserved for debuggin.
     * @param {CallbackFunction} callback
     * Function to be called when the event fires. All registered callbacks are
     * called in the order in which they were registerd. If the callback returns
     * true ("done"), it is unregistered. If the callback returns false ("not
     * done"), it remains registered.
     */
    onTrigger(name, callback) {
        if (!name) {
            name = Trigger.#always;
        }
        this.#ensureTrigger(name);
        // console.debug("Trigger: registering onTrigger callback for:", name);
        this.#triggers[name].push(callback);
    }

}
