"use strict";

/**
 * Renderer for the more casual card-based resoruce display
 */
class RenderCards {

    static templates = document.createDocumentFragment();
    static resourceTypes = ["wood", "brick", "sheep", "wheat", "ore"];
    static assets = mapObject({
        wood: "../assets/wood31.jpg",
        brick: "../assets/brick24.jpg",
        sheep: "../assets/sheep1.jpg",
        wheat: "../assets/wheat2.jpg",
        ore: "../assets/ore27.jpg",
    }, value => browser.runtime.getURL(value));

    #assets = null;

    /**
     * @type {Object<string,string>} Map player name -> player colour
     */
    #colour_map = null;

    #logger = new ConsoleLog("RenderCards", "🖵");

    /**
     * @type {Multiverse}
     */
    #multiverse = null;

    /**
     * @type {string[]} Player names in order of display
     */
    #playerNames = null;

    /**
     * When a sidebar is currently shown, this is the DOM element. When the
     * sidebar is removed, this is null.
     * @type {HTMLElement|null}
     */
    #sidebar = null;

    /**
     * Generate a new sidebar element by cloning the template
     * @return {HTMLElement}
     */
    #cloneSidebar() {
        const sidebar = RenderCards.templates.sidebar.cloneNode(true);
        // console.debug("Returning sidebar:", sidebar);
        return sidebar;
    }

    /**
     * Generate a new resource entry element by cloning the template
     * @return {HTMLElement}
     */
    #cloneSidebarResourceEntry(playerName, playerColor) {
        let entry = RenderCards.templates.resourceEntry.cloneNode(true);
        let nameEntry = entry.querySelector(".playerName");
        nameEntry.textContent = playerName;
        nameEntry.style.color = playerColor;
        entry.querySelectorAll("img").forEach(node => {
            const newSrc = this.#assets[node.alt];
            // console.debug("Replacing", node.src, "with", newSrc);
            node.src = newSrc;
        });
        // console.debug("Returning entry:", entry);
        return entry;
    }

    /**
     * Default asset map that uses Colonist assets
     * @param {string} _path Ignored
     * @param {string} resource Name of the resource to map
     * @return {string} New path to be used as "src" in <img> tags
     */
    static colonistAssetMap = (_path, resource) => {
        const newPath = `dist/images/${Colony.imageNameSnippets[resource]}.svg`;
        return newPath;
    };

    /**
     * @param {Multiverse} multiverse
     * @param {Track} track
     * @param {string[]} playerNames
     * @param {Object.<string,string>} colour_map
     * @param {(_path: string, resource: string) => string} [assetMap=RenderCards.colonistAssetMap]
     */
    constructor(
        multiverse,
        track,
        playerNames,
        colour_map,
        assetMap = RenderCards.colonistAssetMap,
    ) {
        this.#multiverse = multiverse;
        track; // Unused
        this.#playerNames = playerNames;
        this.#colour_map = colour_map;
        this.#assets = RenderCards.assets;
        if (cocaco_config.ownIcons === false && assetMap !== null) {
            mapObject(this.#assets, assetMap);
            // console.debug("Assets:", this.#assets);
        }
    }

    /**
     * Ensures that the sidebar element is shown. Generates a new element if
     * needed. After this function was called, this.#sidebar will be the current
     * sidebar element.
     * @return {void}
     */
    #ensureSidebar() {
        if (this.#sidebar !== null) {
            return;
        }
        let sidebar = document.getElementById("sidebar");
        if (sidebar === null) {
            sidebar = this.#generateNewSidebar();
            document.body.appendChild(sidebar);
        }
        this.#sidebar = sidebar;
    }

    /**
     * Show the current game state in the sidebar element. Generates a new
     * sidebar if necessary.
     */
    render() {
        this.#ensureSidebar();
        this.#updateSidebar();
    }

    // TODO: make the displayed element toggle-able
    toggle() {
        console.warn("RenderCards does not have any toggle yet");
    }

    /**
     * Generate new sidebar element by cloning the template. A new resource
     * entry is provided for each player.
     * @return {HTMLElement}
     */
    #generateNewSidebar() {
        this.#logger.log("Generating sidebar")
        let sidebar = this.#cloneSidebar();
        for (const player of this.#playerNames) {
            sidebar.querySelector(".resources").appendChild(
                this.#cloneSidebarResourceEntry(
                    player,
                    this.#colour_map[player],
                ),
            );
        }
        return sidebar;
    }

    /**
     * Remove the display DOM element
     */
    unrender() {
        if (!this.#sidebar) {
            return;
        }
        this.#sidebar.remove();
        this.#sidebar = null;
    }

    /**
     * Update a resource entry element
     * @param {HTMLElement} entry
     * The resource entry element to be updated. See the template for its
     * structure.
     * @param {*} guessAndRange
     * Multiverse guess and range object to obtain data from
     * @param {*} distribution
     * Multiverse distribution object to obtain data from
     */
    #updateEntry(entry, guessAndRange, distribution) {
        // This function loops through all 95 pre-existing cards in the resource
        // cards element. Cards which are meant to be shown have their CSS
        // property "display" accordingly (i.e., the first N cards). The
        // remaining cards are set to display: "none". Cards with uncertainty
        // get a colour coded outline.
        // We never remove any of the 19 resource card elements that exist for
        // every player-resource pair. We only change their "display" property.
        // There are only 19 cards of each type so this is always enough.
        // HACK: This function is quite hard to follow
        let resourceCards = entry.childNodes[1].childNodes;
        const cardCount = resourceCards.length;
        console.assert(cardCount === 19 * 5);
        let childCardIndex = 0; // [0, 95)
        let i = 0; // [0, 19]
        const increment = (offset = 1) => {
            i += offset;
            childCardIndex += offset;
        };
        const updateCard = (
            resourceIndex, count,
            show = true, chance = null,
        ) => {
            if (count === 0) {
                return; // Cannot update the 0th card
            }
            const cardIndex = resourceIndex * 19 + count - 1;
            const card = resourceCards[cardIndex];
            if (show === false) {
                card.style.display = "none";
                return;
            }
            card.style.display = "flex";
            if (chance === null)
                card.style["outline-color"] = "#0000";
            else
                card.style["outline-color"] = colourInterpolate(chance);
        };
        RenderCards.resourceTypes.forEach((resourceType, resourceIndex) => {
            i = 0;
            childCardIndex = resourceIndex * 19;
            let probability = 1;

            const update = (show, chance) => updateCard(
                resourceIndex, i,
                show, chance,
            );
            const r = guessAndRange[resourceType];
            const d = distribution[resourceType];
            console.assert(d.length === 20);

            // Guaranteed cards: show them
            for (; i <= r[0]; increment()) {
                update(true);
                probability -= d[i];
            }
            // Possible cards: update color
            for (; i <= r[3]; increment()) {
                console.assert(0 <= probability && probability <= 1);
                update(true, probability);
                probability -= d[i];
            }
            // Impossible cards: hide them
            const hidden = (x) => x.style.display === "none";
            for (; i <= 19; increment()) {
                if (hidden(resourceCards[childCardIndex - 1])) {
                    break;
                }
                update(false);
            }
            increment(19 - i);
        });
    }

    /**
     * Update the data shown in the existing sidebar element
     */
    #updateSidebar() {
        // this.#logger.log("Updating sidebar");
        this.#multiverse.updateStats();
        const distribution = this.#multiverse.marginalDistribution;
        const guessAndRange = this.#multiverse.guessAndRange;
        let entries = this.#sidebar.firstElementChild.childNodes;
        Object.entries(this.#playerNames).forEach(([index, playerName]) => {
            this.#updateEntry(
                entries[index],
                guessAndRange[playerName],
                distribution[playerName],
            );
        });
    }

}

/**
 * Generate the HTML template elements describing the sidebar layout. We
 * construct the sidebar element by cloning these elements as required.
 *
 * I would rather provide the template as HTML, but I am not sure how we can
 * supply Firefox with it effectively and in a way that is easy to access from
 * content scripts.
 *
 * @param {DocumentFragment} templates Fragment to hold the template elements.
 */
function generateTemplates(templates) {

    templates.wood = document.createElement("img");
    templates.wood.src = RenderCards.assets.wood;
    templates.wood.classList.add("cocaco")
    templates.wood.alt = "wood";

    templates.brick = document.createElement("img");
    templates.brick.src = RenderCards.assets.brick;
    templates.brick.classList.add("cocaco");
    templates.brick.alt = "brick";

    templates.sheep = document.createElement("img");
    templates.sheep.src = RenderCards.assets.sheep;
    templates.sheep.classList.add("cocaco");
    templates.sheep.alt = "sheep";

    templates.wheat = document.createElement("img");
    templates.wheat.src = RenderCards.assets.wheat;
    templates.wheat.classList.add("cocaco");
    templates.wheat.alt = "wheat";

    templates.ore = document.createElement("img");
    templates.ore.src = RenderCards.assets.ore;
    templates.ore.classList.add("cocaco");
    templates.ore.alt = "ore";

    templates.playerName = document.createElement("div");
    templates.playerName.classList.add("cocaco", "playerName", "oneline");
    templates.playerName.textContent = "John#1234";

    templates.cardFirst = document.createElement("div");
    templates.cardFirst.classList.add("cocaco", "card", "cardFirst")

    templates.cardNotFirst = document.createElement("div");
    templates.cardNotFirst.classList.add("cocaco", "card", "cardNotFirst");

    // The 95 cards for a single player go in 'resourceCards'
    templates.resourceCards = document.createElement("div");
    templates.resourceCards.classList.add("cocaco", "resourceCards")

    // Construct filled resource row
    const insertResourceCardIntoDiv = (div, typeString) => {
        const image = templates[typeString].cloneNode(true);
        div.appendChild(image);
    }
    for (const resource of RenderCards.resourceTypes) {
        const firstCard = templates.cardFirst.cloneNode(true);
        insertResourceCardIntoDiv(firstCard, resource);
        templates.resourceCards.appendChild(firstCard);
        // Start at 1 because we insert the first separately
        for (let cardIndex = 1; cardIndex < 19; ++cardIndex) {
            const anotherCard = templates.cardNotFirst.cloneNode(true);
            insertResourceCardIntoDiv(anotherCard, resource);
            templates.resourceCards.appendChild(anotherCard);
        }
    }

    // 'resourceEntry' is the whole row, including name and the resource cards
    templates.resourceEntry = document.createElement("div");
    templates.resourceEntry.classList.add("cocaco", "resourceEntry");
    templates.resourceEntry.appendChild(
        templates.playerName.cloneNode(true),
    );
    templates.resourceEntry.appendChild(
        templates.resourceCards.cloneNode(true),
    );

    // Construct empty resources. Append copies of the filled resource entry into
    // it on construction.
    templates.resources = document.createElement("div");
    templates.resources.classList.add("cocaco", "resources");

    templates.sidebar = document.createElement("div");
    templates.sidebar.id = "cocaco-sidebar";
    templates.sidebar.classList.add("cocaco");
    templates.sidebar.appendChild(
        templates.resources.cloneNode(true),
    );

    // console.debug("generated:", templates);
}

// Generate the static templates variable once
generateTemplates(RenderCards.templates);
