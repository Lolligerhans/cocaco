"use strinct";

/**
 * The available connection types. The {@see @type Connect} instance uses these
 * to multiplex the messaging API. On events, a trigger with the same name is
 * activated.
 * @typedef {"page_action"} ConnectionType
 *
 * @typedef ConnectMessage
 * @property {ConnectionType} type
 * String used to distinguish between the use cases.
 * @property {*} payload Type specific payload
 */

/**
 * Class to create ports and messaging to the background script. For messaging,
 * add an 'onTrigger()' handler for a trigger name matching a @see
 * ConnectionType.
 *
 * TODO: ports
 */
class Connect extends Trigger {

    /**
     * Initializes ports and listeners
     */
    constructor() {
        super();

        /**
         * @param {ConnectMessage} request
         */
        const dispatch = request => this.#dispatch(request);
        browser.runtime.onMessage.addListener(dispatch);

        // Add more onMessages and port here
    }

    /**
     * Accept any event and decide what to do with it
     * @param {ConnectMessage} request
     * Data given to the onMessage() event listener
     */
    #dispatch(request) {
        this.activateTrigger(request.type, request.payload);
    }
};
