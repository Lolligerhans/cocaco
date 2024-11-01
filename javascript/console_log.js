"use strict";

/**
 * Console.log wrapper with enable/disable flag.
 *
 * We put an instance of this in each module for when the output helps in
 * testing only.
 */
class ConsoleLog {
    /**
     * Enable/disable logging
     * @type {Boolean}
     */
    #enabled = true;

    /**
     * Use icons because they are a lot easiert to spot in a log.
     * @type {String}
     */
    #icon = "";

    /**
     * Name to show in log messages
     * @type {string}
     */
    #name = "";

    /**
     * Typically, both name and icon should be provided. For debugging, can be
     * called empty.
     * @param {string} [name] Name to be shown in log. us used to lookup the
     *                        config option to disable the logger.
     * @param {String} [icon] Icon to be used at the start of the message
     * @param {Boolean} [enable] Set to true/false to enable/disable. If left
     *                           out, uses value from config.
     */
    constructor(name = null, icon = null, enable = null) {
        name ??= this.#name;
        icon ??= this.#icon;
        enable ??= cocaco_config.log[name];
        enable ??= this.#enabled;
        // Use 'true' as additional fallback if the lookup in config fails
        this.#enabled = enable;
        this.#icon = icon;
        this.#name = name;
        this.log("👋");
    }

    /**
     * Calls console.log() prefixed with [name]
     * @param {...*} args Arguments to pass to console.log
     */
    log(...args) {
        if (!this.#enabled) {
            return;
        }
        console.log(`${this.#icon} [${this.#name}]`, ...args);
    }
}
