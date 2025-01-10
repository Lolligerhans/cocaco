"use strict";

/**
 * Implement classes to represent players. Construct them once and use as if
 * immutable after.
 */

/**
 * @typedef {string|Number} Id
 * The Source/Data facing identifier for players. The Source/Data can choose any
 * kind of id. IDs must be chosen to uniquely identify players. We need to be
 * able to:
 *  - use it as Object key
 *  - compare them with ===
 * The Observer implements the stateful components to translate IDs to 'Player'
 * Objects. When generating frames, the player ID must be used to identify the
 * player.
 *
 * For Colonist the colour enum plays the role of the player ID.
 */

/**
 * Data class combining the name, ID, colour and index of a player.
 */
class Player {

    /**
     * @type {string}
     */
    colour;

    /**
     * An id of pipeline-specific type and content. For example, Colonist uses
     * a colour enum to identify players.
     * @type {Id} id
     */
    id;

    /**
     * Index to be used for the array in 'Players'. And for player-related
     * arrays in general. This property will be set from the 'Players'
     * constructor.
     * @type {Number}
     */
    index;

    /**
     * @type {string}
     */
    name;

    constructor({
        /**
         * @param {string} colour CSS colour string
         */
        colour,
        /**
         * @param {Id} index ID as chosen by the pipeline Source
         */
        id,
        /**
         * @param {Number} index Index in the players array. Should be set by
         *                       'Players'.
         */
        index,
        /**
         * @param {string} name Player name
         */
        name,
    }) {
        this.colour = colour;
        this.id = id;
        this.index = index;
        this.name = name;
    }

    /**
     * Compare to other players. Two players are equal if their player IDs
     * compare equal using ===. The behaviour for 0 arguments is not specified.
     * @param {...Player} others 1 or more players to compare to
     * @return {boolean} Return true if this player is equal to each of the
     *                   other players.
     */
    equals(...others) {
        return others.every(o => o instanceof Player && this.id === o.id);
    }
}

/**
 * Represent the set of all players. Allows to query 'Player' instances from
 * either of the identifying values. Cannot change after construction.
 * The values returned from the member functions are references to the internal
 * state. They must not be modified.
 *
 * This class is meant to represent exactly all participating players, not any
 * subset of players.
 */
class Players {

    // ── Data members ───────────────────────────────────────────

    /**
     * @type {Object.<Id,Player>} Mapping from Id to player
     */
    #ids = {};

    /**
     * @type {Object.<Number,Player>} Mapping from index to player
     */
    #indices = {};

    /**
     * @type {Object.<string,Player>} Mapping from name to player
     */
    #names = {};

    /**
     * @type {Player[]} Array "owning" the actual data
     */
    #allPlayers = [];

    // ── Implementation ─────────────────────────────────────────

    /**
     * Get all players
     * @return {Player[]} Array containing all players. The index of each player
     *                    matches their position the array.
     */
    all() {
        return this.#allPlayers;
    }

    /**
     * @return {string[]} New array containing all player colours in index order
     */
    allColours() {
        return this.#allPlayers.map(p => p.colour);
    }

    /**
     * @return {string[]} New array containing all player names in index order
     */
    allNames() {
        return this.#allPlayers.map(p => p.name);
    }

    /**
     * Creates a new set of players. The 'index' of each player is replaced by
     * their position in the arguments. Requires a name to be selected as last
     * player. If the players are in the correct order, any display code can
     * then simply show the players in the index order.
     * @param {string} lastname Name of the player to be put in the last
     *                          position (with the highest index).
     * @param {Player[]} players All players. Cannot be changed later.
     * @param {Id[]} playOrder
     * Play order represented by player IDs (colour enums).
     */
    constructor(lastName, players, playOrder) {
        console.assert(players.length >= 1); // Required
        // Sanity only. Remove when intended.
        console.assert(players.length >= 2);
        this.#allPlayers = players;
        this.#generateIds(); // Needed to sort by playOrder
        this.#orderPlayers(lastName, playOrder);
        this.#generteIndices();
        this.#generateNames();
        this.print();
        if (!(this.name(lastName).index === this.#allPlayers.length - 1)) {
            debugger; // BUG: should not happen
        }
        console.assert(this.name(lastName).index ===
                           this.#allPlayers.length - 1,
                       "The indicated player should be in last position");
    }

    #generateIds() {
        const addId = player => { this.#ids[player.id] = player; };
        this.#allPlayers.forEach(addId);
    }

    #generteIndices() {
        const addIndex = (player, index) => {
            player.index = index;
            this.#indices[index] = player; // Not player.index
        };
        this.#allPlayers.forEach(addIndex);
    }

    #generateNames() {
        const addName = player => { this.#names[player.name] = player; };
        this.#allPlayers.forEach(addName);
    }

    /**
     * Get player by id
     * @param {Id} id Id as specified on construction
     * @return {Player} Player with given id
     */
    id(id) {
        return this.#ids[id];
    }

    /**
     * Get player by index
     * @param {Number} index Index of the player
     */
    index(index) {
        return this.#indices[index];
    }

    /**
     * Get player by name
     * @param {string} name
     * @return {Player|undefined}
     * The player with the given name when existing. Else undefined.
     */
    name(name) {
        return this.#names[name];
    }

    /**
     * @return {string[]} All names in the order of the player indices
     */
    nameArray() {
        return this.#allPlayers.map(p => p.name);
    }

    /**
     * Reorder players such that the player with name 'lastName' is in last
     * place.
     * @param {string} lastName
     * @param {Id[]} playOrder If provided, order players in this order
     */
    #orderPlayers(lastName, playOrder = null) {
        // Since the order is not crucial, skip 'playOrder' as fallback
        if (playOrder !== null) {
            this.#allPlayers = this.#reorderByPlayOrder(playOrder);
        }
        this.#rotateNameToLastPlayer(lastName);
    }

    print() {
        console.debug("Players:", this);
    }

    /**
     * Return a shallow copy of this.#allPlayers array with entries sorted like
     * 'playOrder'.
     * @param {Id[]} playOrder Order of player IDs
     * @return {Player[]}
     */
    #reorderByPlayOrder(playOrder) {
        let ret = [];
        const pickPlayerWithId = id => {
            const picked = this.id(id); // Requires IDs to be set
            ret.push(picked);
        };
        playOrder.forEach(pickPlayerWithId);
        return ret;
    }

    #rotateNameToLastPlayer(lastName) {
        const double = this.#allPlayers.concat(this.#allPlayers);
        const firstOccurence = double.findIndex(p => p.name === lastName);
        const [start, end] = [
            firstOccurence + 1,
            firstOccurence + 1 + this.#allPlayers.length,
        ];
        const rotated = double.slice(start, end);
        this.#allPlayers = rotated;
    }

    /**
     * Get the number if players.
     * @return {Number} Number of players
     */
    size() {
        return this.#allPlayers.length;
    }
}
