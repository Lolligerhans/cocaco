"use strict";

/**
 * @return {String|null} Username of the player, parsed from the colonist
 *                       webpage.
 */
function parse_username(document) {
    const landingPageUsername = document.querySelector(".web-header-username");
    console.assert(landingPageUsername,
                   "We expect to always find the username here");
    return landingPageUsername?.textContent ?? null;
}
