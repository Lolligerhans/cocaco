"use strict";

/**
 * Implements toggleable flags identified by strings.
 *
 * This is used to enable/disable rendering some parts in the render classes.
 */
class Toggle {

    /**
     * Object mapping the name of each flag to its value
     * @type {Object<string,boolean>}
     *
     * The "global" flag has a special role: The test functions return the
     * conjunction of individual flags with the global flag.
     *
     * We need the global flag to toggle all render panels such that a second
     * toggle brings back the same panels as before.
     */
    #flags;

    #logger = new ConsoleLog("Toggle", "⚙️");

    /**
     * Starts with a set of flags set to false. The available flags cannot be
     * changed later.
     * @param {...string} names
     * The names of all available flags. The name "global" is reserved.
     */
    constructor(...names) {
        this.#flags = Object.fromEntries(
            names.map(n => [n, false])
        );
        this.#flags.global = true;
        this.print();
    }

    /**
     * Disable multiple flags at once
     * @param {...string} which
     * The names of the flags to disable. If empty, disable all flags.
     * @return {Toggle} this
     */
    disable(...which) {
        if (which.length === 0) {
            return this.disable(...this.flags());
        }
        console.assert(this.has(...which));
        which.forEach(w => this.toggle(w, false));
        return this;
    }

    /**
     * Enable multiple flags at once
     * @param {...string} which
     * The names of the flags to enable. If empty, enables all flags.
     * @return {Toggle} this
     */
    enable(...which) {
        if (which.length === 0) {
            return this.enable(...this.flags());
        }
        console.assert(this.has(...which));
        which.forEach(w => this.toggle(w, true));
        return this;
    }

    /**
     * Get the names of all flags
     * @return {string[]}
     */
    flags() {
        const allFlags = Object.keys(this.#flags);
        return allFlags;
    }

    /**
     * Read or write the special "global" flag
     * @param {boolean} [value] Value to write
     * @return {boolean}
     * The value of the special "global" flag. The new value when changing.
     */
    global(value = null) {
        if (value !== null) {
            this.#flags.global = value;
        }
        return this.#flags.global;
    }

    /**
     * Test if the Toggle instance has flags
     * @param {...string} which Names of the flags to test
     * @return {boolean} true if all requested flags exist, else false
     */
    has(...which) {
        console.assert(which.length >= 1);
        const ret = which.every(w => Object.hasOwn(this.#flags, w));
        // Currently we do not expect to ever not have a requested property. If
        // a property does not exist previously, setting it may silently add it.
        // Here in 'has()', it would be fine to not have it once we actually
        // intend for this to happen.
        console.assert(ret, "The toggle object does not have:", which);
        return ret;
    }

    /**
     * Test all flags at once, disregarding the special "global" flag. The
     * global flag is still considered as a regular flag.
     * @param {boolean} [value=true] Value to test for. Default true.
     * @return {boolean} The disjunction of comparisons of all flags to value
     */
    #isAnyFlagToggled(value = true) {
        const allFlags = this.flags();
        const flagMatches = flag => this.#isToggledFlag(flag, value);
        return allFlags.some(flagMatches);
    }

    /**
     * Test all flags at once
     * @param {boolean} [value=true] Value to test for. Default true.
     * @param {boolean} [respectGlobal=true]
     * When the special "global" flag is not respected, it still counts as
     * individual flag for this test.
     * @return {boolean} The disjunction of comparisons of all flags to value
     */
    isAnyToggled(value = true) {
        if (this.global() === false && this.global() !== value) {
            return false;
        }
        const allFlags = this.flags();
        const flagMatches = flag => this.isToggled(flag, value);
        return allFlags.some(flagMatches);
    }

    /**
     * Test flags. Respects the special "global" flag.
     * @param {string|Number} [which=null]
     * Name (or index) of the flag to be tested. If not set, test if any flag is
     * set (see 'isAnyToggled()').
     * @param {boolean} [value=true] Value to test for
     * @return {boolean} true if the tested flag is equal to value
     */
    isToggled(which, value = true) {
        // Special case: Negative "global" flag masks the other flags
        if (this.global() === false && this.global() !== value) {
            return false;
        }
        // Special case: Test for any flag
        if (which === null) {
            return this.isAnyToggled(value);
        }
        return this.#isToggledFlag(which, value);
    }

    /**
     * Test flag disregarding the special "global" flag. We need this when
     * "global" flag is "false" but we want to know the actual flag value.
     * @param {string|number} [which=null]
     * Name (or index) of the flag to be tested. If not set, test if any flag is
     * set (see 'isAnyToggled(_, false)').
     * @param {boolean} [value=true] Value to test for
     * @return {boolean} true if the tested flag is equal to value
     */
    #isToggledFlag(which = null, value = true) {
        // Special case: Test for any flag
        if (which === null) {
            return this.#isAnyFlagToggled(value);
        }
        // If a number N is given, use the N-th flag
        if (typeof which === "number") {
            const allFlags = this.flags();
            console.assert(0 <= which && which < allFlags.length);
            which = allFlags[which];
        }
        console.assert(this.has(which));
        const flagValue = this.#flags[which];
        return flagValue === value;
    }

    /**
     * Private version of print in which we must explicitly set if we want to
     * print global. This is inconvenient as interface, but allows using simple
     * recurring to print everything.
     * @param {boolean} printGlobal
     * When true, prepend the value of the global flag
     * @param {...string} which Flags to print. If empty, print all flags.
     */
    #printPrivate(printGlobal, ...which) {
        if (which.length === 0) {
            this.#printPrivate(false, ...this.flags());
            return;
        }
        console.assert(this.has(...which));
        if (printGlobal && !which.includes("global")) {
            this.printGlobal();
        }
        const logFlag = name => this.#logger.log(
            name, "===", this.isToggled(name),
        );
        which.forEach(logFlag);
    }

    /**
     * Output state using this.#logger. Always includes the global flag.
     * @param {...string} which Flags to output. If empty, output all flags
     */
    print(...which) {
        this.#printPrivate(true, ...which);
    }


    /**
     * Print only the global flag
     */
    printGlobal() {
        this.#logger.log("<global>", "===", this.isToggledGlobal());
    }

    /**
     * Toggle a flag.
     * @param {string|Number} [which=null]
     * If a number N is given, toggles flag number N. The order is arbitrary.
     * But I hope it is constant. 👀 This is so we do not need to know all the
     * flag names if dont care which number toggles which flag.
     * When null or missing, toggle all flags (see '#toggleAll()').
     * @param {boolean} value
     * If missing, invert the flag. If provided, set to the provided value.
     * @return {boolean} New value of the changed flags
     */
    toggle(which = null, value = null) {
        // If nothing is given delegate to 'toggleAll()'
        if (which === null) {
            return this.#toggleAll(value);
        }

        // If a number N is given, use the N-th flag
        if (typeof which === "number") {
            const allFlags = this.flags();
            console.assert(0 <= which && which < allFlags.length);
            which = allFlags[which];
        }
        console.assert(this.has(which));
        const newValue = value ?? !this.#isToggledFlag(which);
        this.#flags[which] = newValue;

        this.#logger.log(which, "⟶", newValue);

        return newValue;
    }

    /**
     * Toggle all flags at once. When no value is given, turn all flags off. If
     * nothing can be turned off, turn everything on.
     * Changes individual flags, not the global flag.
     * @param {boolean} value If present, set all flags to this value
     * @return {boolean} The value all flags are set to after the operation
     */
    #toggleAll(value = null) {
        // If value is given, use it
        if (value === true) {
            this.enable();
            return true;
        } else if (value === false) {
            this.disable();
            return false;
        }

        // If not yet, turn everything off. Else turn everything on.
        if (this.isAnyToggled()) {
            this.disable();
            return false;
        } else {
            this.enable();
            return true;
        }
    }

}
