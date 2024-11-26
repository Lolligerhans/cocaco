"use strict";

/**
 * Renderer for the more casual card-based resource display
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
     * Keep track of the toggle state of each panel. The strings used by
     * '#toggle' match the CSS class assigned to the element. That way we can
     * querySelector the elements easily. Toggling an element off sets the CSS
     * visibility styling.
     * @type {Toggle}
     */
    #toggle = new Toggle("resourcesPanel", "rollsPlot")
        .enable("resourcesPanel");

    /**
     * The 'Track' object used to get rolls data from. This object is only read.
     * @type {Track}
     */
    #track = null;

    /**
     * Adds "click" event listeners to all images in the given element. We use
     * them to obtain user-provided guesses for the resource counts. Hence we
     * need access to the tracking object and the player name related to the
     * resources.
     * @param {HTMLElement} element
     * The 'resourceCards' element containing images to add listeners to
     * @param {string} playerName
     * The player name that should be passed to the 'Multiverse' guess function
     * @param {Multiverse} multiverse
     * The 'Multiverse' card tracking object to manipulate on click
     */
    #addResourceGuessEventListeners(element, playerName) {
        /**
         * Invoke the Multiverse guess function
         * @param {string} type Resource type, obtained from the image alt name
         * @param {Number} count
         * The count used to instantiate the predicate, obtained from the index
         * of the resource clicked on.
         * @param {*} predicate
         * One of the values of the global 'predicates' object. Not just any
         * function.
         * @return {void}
         */
        const guessPredicate = (type, count, predicate) => {
            this.#multiverse.weightGuessPredicate(
                playerName,
                Multiverse.getResourceIndex(type),
                predicate.f(count),
                predicate.name(count),
            );
            this.render();
        };
        /**
         * Add event listener to an element
         * @param {HTMLElement} element The image element to add a listener to
         * @param {string} type Resource type, obtained from the image alt name
         * @param {Number} count
         * The count used to instantiate the predicate, obtained from the index
         * of the resource clicked on.
         * @param {*} predicate
         * One of the values of the global 'predicates' object. Not just any
         * function.
         */
        const addListener = (element, type, count) => {
            // Make sure the element is an "<img>" element
            console.assert(element.tagName === "IMG");
            // HACK: Not sure why we can not click the images directly. We
            //       simply catch the click on the parent 'firstCard' or
            //       'notFirstCard' element.
            const onClick = (pred = ">=") => {
                const predicate = predicates[pred];
                this.#logger.log(
                    `Guessing ${playerName}[${type}] ${predicate.name(count)}`,
                );
                guessPredicate(type, count, predicate);
            };
            element.parentNode.addEventListener("click", _event => {
                onClick(">=");
            });
            element.parentNode.addEventListener("contextmenu", event => {
                onClick("<");
                event.preventDefault();
            });
        };
        /**
         * Add the event listeners for all images with a given alt (naming the
         * resource type).
         * @param {string} type Resource type, obtained from the image alt name
         */
        const addListenersByType = type => {
            let typeImages = element.querySelectorAll(`img[alt="${type}"]`);
            typeImages.forEach((imageElement, resourceImageIndex) => {
                // typeImages[0] represents having 1 card, not 0
                addListener(imageElement, type, resourceImageIndex + 1);
            });

        };
        for (const type of RenderCards.resourceTypes) {
            addListenersByType(type);
        }
    }

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
     * @param {string} playerName
     * @param {string} playerColour CSS colour string
     * @return {HTMLElement}
     */
    #cloneSidebarResourceEntry(playerName, playerColour) {
        let entry = RenderCards.templates.resourceEntry.cloneNode(true);
        let nameEntry = entry.querySelector(".playerName");
        nameEntry.textContent = playerName;
        nameEntry.style.color = playerColour;
        entry.querySelectorAll("img").forEach(node => {
            const newSrc = this.#assets[node.alt];
            // console.debug("Replacing", node.src, "with", newSrc);
            node.src = newSrc;
        });
        // console.debug("Returning entry:", entry);
        entry.addEventListener("mouseenter", _event =>
            this.#updateResourceWorlds(playerName)
        );
        return entry;
    }

    /**
     * Generate a new resourceEntry element by cloning the template
     * @param {string} playerName
     * @param {string} playerColour CSS colour string
     * @returns {HTMLElement}
     */
    #cloneSidebarResourceTypeEntry(playerName, playerColour) {
        let entry = RenderCards.templates.resourceTypeEntry.cloneNode(true);
        let nameEntry = entry.querySelector(".playerName");
        nameEntry.textContent = playerName;
        nameEntry.style.color = playerColour;
        entry.querySelectorAll("img").forEach(node => {
            const newSrc = this.#assets[node.alt];
            // console.debug("Replacing", node.src, "with", newSrc);
            node.src = newSrc;
        });
        return entry;
    }

    /**
     * Ensures that the sidebar element exists. Generates a new element if
     * needed. After this function was called, 'this.#sidebar' will be the
     * current sidebar element.
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
     * Generate new division holding the granular display of all possible hands
     * for some player.
     * @param {string} playerName
     * @param {string} playerColour
     * @return {HTMLElement}
     */
    #generateNewResourceWorlds(playerName, playerColour) {
        let resourceWorlds = RenderCards.templates.resourceWorlds.cloneNode(true);
        // // For testing, just append to body
        // document.body.appendChild(resourceWorlds);
        let nameEntry = resourceWorlds.querySelector(".playerName");
        nameEntry.textContent = playerName;
        nameEntry.style.color = playerColour;
        const cardElements = this.#generateResourceWorldCards(playerName);
        cardElements.forEach(card => resourceWorlds.appendChild(card));
        return resourceWorlds;
    }

    /**
     * Generate new sidebar element by cloning the template. A new resource
     * entry is provided for each player.
     * @return {HTMLElement}
     */
    #generateNewSidebar() {
        this.#logger.log("Generating sidebar")
        let sidebar = this.#cloneSidebar();
        /**
         * @param {string} name
         * The name must match the string used for 'this.toggle()'. They match the
         * CSS class name used by the panel to be toggled. They are the same as the
         * property name in '#templates').
         * @param {string} symbol
         * Text content of the button. We want buttons to be small and just use
         * UTF8 symbols for display.
         */
        const addButton = (name, symbol = null) => {
            let newButton = RenderCards.templates.button.cloneNode(true);
            newButton.textContent = symbol ?? newButton.textContent;
            newButton.addEventListener("click", _event => {
                this.toggle(name);
            });
            sidebar.querySelector(".buttons").appendChild(newButton);
        };
        addButton("resourcesPanel", " 🂠");
        addButton("rollsPlot", " 📊");
        let resourcesElement = sidebar.querySelector(".resources");
        let resStealChanceElem = sidebar.querySelector(".resourceStealChance");
        for (const player of this.#playerNames) {
            let newResourcesEntry = this.#cloneSidebarResourceEntry(
                player,
                this.#colour_map[player],
            );
            this.#addResourceGuessEventListeners(
                newResourcesEntry,
                player,
                this.#multiverse,
            );
            resourcesElement.appendChild(newResourcesEntry);
            resStealChanceElem.appendChild(
                this.#cloneSidebarResourceTypeEntry(
                    player,
                    this.#colour_map[player],
                ),
            );
        }
        return sidebar;
    }

    /**
     * Generate an array of HTMLElements for every possible resource combination
     * of the given player. The returned elements are meant to be added as child
     * nodes to the 'resourceEntry' element in the 'resourceWorlds' element.
     * @param {string} playerName
     * @return {HTMLElement[]}
     * Array of elements derived from 'templates.resourceCards'. Each contains
     * the cards of one world for the given player.
     */
    #generateResourceWorldCards(playerName) {
        const playerResources = this.#multiverse.getPlayerResources(playerName);
        let res = [];
        playerResources.forEach(({ chance, resources }) => {
            let cards = RenderCards.templates.resourceCards.cloneNode(true);

            // HACK: Generate a guess-and-range object like 'Multiverse' would.
            //       Once the guess and range object has its own class use that.
            let fakeResourceGuessAndRange = {};
            const addFakeRange = resourceName => {
                fakeResourceGuessAndRange[resourceName] = [
                    // This describes a guessAndRange[player][resourceName] by
                    // pretending that the resource count belonging to the
                    // currently processed slice has 100% probability.
                    resources[resourceName],
                    1.0,
                    resources[resourceName],
                    resources[resourceName],
                ];
            };
            Resources.names().forEach(addFakeRange);
            let cardsElement = RenderCards.templates.resourceCards.cloneNode(true);
            RenderCards.#updateCardsElement(cardsElement, fakeResourceGuessAndRange);
            let outlineColour = chance >= 1 ? "#0000" : colourInterpolate(chance);
            cardsElement.style["outline-color"] = outlineColour;
            cardsElement.querySelectorAll("img").forEach(node => {
                const newSrc = this.#assets[node.alt];
                // console.debug("Replacing", node.src, "with", newSrc);
                node.src = newSrc;
            });
            res.push(cardsElement);
        });
        return res;
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
            console.assert(d.length === 20, "Expect 20 entries for a card distribution", d);

            // Guaranteed cards: show them
            for (; i <= r[0]; increment()) {
                update(true);
                probability -= d[i];
            }
            // Possible cards: update color
            for (; i <= r[3]; increment()) {
                console.assert(
                    // This may be violated when the user is unreasonably click
                    // happy with the probability guessing. Since this is for
                    // display only that would not be a big deal.
                    0 <= probability && probability <= 1,
                    "Card probabilities should be withing [0,1]. Is:",
                    probability,
                );
                probability = clampProbability(probability);
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
     * Update the steal chances of a resourceEntry element
     * @param {HTMLElement} entry Clone of 'resourceTypeEntry' template
     * The resource entry element to be updated. See the template for its
     * structure.
     * @param {*} stealProbability
     * Multiverse stealProbability object to obtain data from
     */
    #updateEntrySteals(entry, stealProbability) {
        let resourceCards = entry.childNodes[1].childNodes;
        const cardCount = resourceCards.length;
        console.assert(cardCount === 5);
        const updateCard = (index, value) => {
            const card = resourceCards[index];
            if (value === 0) {
                card.style.visibility = "hidden";
            }
            else {
                card.style.visibility = "visible";
                card.style["outline-color"] = colourInterpolate(value);
            }
        };
        updateCard(0, stealProbability["wood"]);
        updateCard(1, stealProbability["brick"]);
        updateCard(2, stealProbability["sheep"]);
        updateCard(3, stealProbability["wheat"]);
        updateCard(4, stealProbability["ore"]);
    }

    /**
     * Update the data shown in the rolls plot element
     */
    #updateRollsPlot() {
        let rollsPlotDiv = this.#sidebar.querySelector(".rollsPlot");
        if (!this.#toggle.isToggled("rollsPlot")) {
            // Save the cycles when nothing has to be shown anyway
            hide(rollsPlotDiv);
            return;
        }
        this.#track.updateRollsData();
        plotRollsAsHistogram(
            this.#track,
            rollsPlotDiv,
        );
        unhide(rollsPlotDiv);
    }

    /**
     * Update the resourceWorlds name and slices
     * @param {string} playerName Name of the players who's data is to be used
     */
    #updateResourceWorlds(playerName) {
        const playerColour = this.#colour_map[playerName];
        let resourceWorldsElem = this.#sidebar.querySelector(".resourceWorlds");
        let nameEntry = resourceWorldsElem.querySelector(".playerName")
        nameEntry.textContent = playerName;
        nameEntry.style.color = playerColour;
        let oldCards = resourceWorldsElem.querySelectorAll(".resourceCards");
        oldCards.forEach(cards => cards.remove());
        const cardElements = this.#generateResourceWorldCards(playerName);
        cardElements.forEach(card => resourceWorldsElem.appendChild(card));
    }

    /**
     * Update the data shown in the existing 'resources' element
     */
    #updateResources() {
        let resourcesDiv = this.#sidebar.querySelector(".resources");
        let resourceStealChanceDiv = this.#sidebar.querySelector(".resourceStealChance");
        if (!this.#toggle.isToggled("resourcesPanel")) {
            // Save the cycles when nothing has to be shown anyway
            hide(resourcesDiv);
            hide(resourceStealChanceDiv);
            return;
        }
        // this.#logger.log("Updating sidebar");
        this.#multiverse.updateStats();
        const distribution = this.#multiverse.marginalDistribution;
        const guessAndRange = this.#multiverse.guessAndRange;
        const stealProbabilitiy = this.#multiverse.stealProbability;
        let entries = resourcesDiv.childNodes;
        let stealEntries = resourceStealChanceDiv.childNodes;
        Object.entries(this.#playerNames).forEach(([index, playerName]) => {
            const indexNumber = Number.parseInt(index);
            this.#updateEntry(
                entries[indexNumber],
                guessAndRange[playerName],
                distribution[playerName],
            );
            this.#updateEntrySteals(
                stealEntries[indexNumber],
                stealProbabilitiy[playerName],
            );
        });
        unhide(resourcesDiv);
    }

    /**
     * Update a 'resourceCards' element from a guess and range object.
     * NOTE: Currently only for such guess and range objects that have certainly
     *       (and therefore only used for the possible worlds popup). In the
     *       future, use this function in the update the regular resourceEntry
     *       as well.
     *
     * @param {HTMLElement} cardsElement 'resourceCards' element
     * @param {Object} guessAndRange Guess-and-range subobject for a specific
     *                               player.
     */
    static #updateCardsElement(cardsElement, guessAndRange) {
        const cards = cardsElement.childNodes;
        console.assert(cards.length === 19 * 5, "Sanity check");
        const indexMap = { wood: 0, brick: 1, sheep: 2, wheat: 3, ore: 4 };
        const updateAs = (resourceName, subResourceIndex, isShown) => {
            const cardIndex = 19 * indexMap[resourceName] + subResourceIndex;
            const card = cards[cardIndex];
            console.assert(card.firstElementChild.alt === resourceName, "Santiy check");
            if (isShown) {
                card.style.display = "flex";
            } else {
                card.style.display = "none";
            }
            card.style["outline-color"] = "#0000";
        };
        const updateFromRange = (resourceName, guessAndRange) => {
            console.assert(
                guessAndRange[0] === guessAndRange[3],
                "Min should be equal to max for now",
            );
            for (let i = 1; i <= 19; ++i) {
                updateAs(
                    resourceName,
                    i - 1,
                    i <= guessAndRange[0],
                );
            }
        };
        RenderCards.resourceTypes.forEach(resourceName => {
            updateFromRange(resourceName, guessAndRange[resourceName]);
        });
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
        this.#track = track;
        this.#playerNames = playerNames;
        this.#colour_map = colour_map;
        this.#assets = RenderCards.assets;
        if (cocaco_config.ownIcons === false && assetMap !== null) {
            mapObject(this.#assets, assetMap);
            // console.debug("Assets:", this.#assets);
        }
    }

    /**
     * Show the current game state in the sidebar element. Generates a new
     * sidebar if necessary.
     * @return {void}
     */
    render() {
        this.#ensureSidebar();
        this.#updateResources();
        this.#updateRollsPlot();
    }

    /**
     * Hide/unhide the sidebar
     * @return {void}
     */
    toggle(which = "global") {
        this.#toggle.toggle(which);
        this.render();
    }

    /**
     * Remove the display DOM element
     * @return {void}
     */
    unrender() {
        if (!this.#sidebar) {
            return;
        }
        this.#sidebar.remove();
        this.#sidebar = null;
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

    // A template for each resource type
    {
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
    }

    // The 'playerName' element shows a name in the player color
    {
        templates.playerName = document.createElement("div");
        templates.playerName.classList.add("cocaco", "playerName", "oneline");
        templates.playerName.textContent = "John#1234";
    }

    // Containers containing exactly one resource image each. We distinguish
    // first from non-first cards for styling. 'cardNotFirst' has x offset to
    // make it cover the previous card.
    {
        templates.cardFirst = document.createElement("div");
        templates.cardFirst.classList.add("cocaco", "card", "cardFirst")

        templates.cardNotFirst = document.createElement("div");
        templates.cardNotFirst.classList.add("cocaco", "card", "cardNotFirst");
    }

    // The 95 cards for a single player go in 'resourceCards'
    {
        templates.resourceCards = document.createElement("div");
        templates.resourceCards.classList.add("cocaco", "resourceCards")
    }

    // The 5 cards to indicate steal chance for a single player go in
    // 'resourceCardsSingle'
    {
        templates.resourceCardsSingle = document.createElement("div");
        templates.resourceCardsSingle.classList.add("cocaco", "resourceCards")
    }

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

    // Construct filled resource row for the steal chance
    for (const resource of RenderCards.resourceTypes) {
        const onlyCard = templates.cardFirst.cloneNode(true);
        insertResourceCardIntoDiv(onlyCard, resource);
        templates.resourceCardsSingle.appendChild(onlyCard);
    }

    // 'resourceEntry' is one row in the resources panel, including name and the
    // resource cards.
    {
        templates.resourceEntry = document.createElement("div");
        templates.resourceEntry.classList.add("cocaco", "resourceEntry");
        templates.resourceEntry.appendChild(
            templates.playerName.cloneNode(true),
        );
        let currentResourceCards = templates.resourceCards.cloneNode(true);
        templates.resourceEntry.appendChild(currentResourceCards);
    }

    // 'resourceTypeEntry' is one row in the resourceStealChance panel,
    // including name and the resource types.
    {
        templates.resourceTypeEntry = document.createElement("div");
        templates.resourceTypeEntry.classList.add("cocaco", "resourceTypeEntry");
        templates.resourceTypeEntry.appendChild(
            templates.playerName.cloneNode(true),
        );
        let currentResourceChance = templates.resourceCardsSingle.cloneNode(true);
        currentResourceChance.classList.add("show-on-hover");
        templates.resourceTypeEntry.appendChild(currentResourceChance);
    }

    // Construct empty resources. Append copies of the filled 'resourceEntry'
    // into it on construction.
    {
        templates.resources = document.createElement("div");
        templates.resources.classList.add("cocaco", "resources");
    }

    // 'resourceSummary' is the popout panel showing the steal chance for each
    // resource type. Append copies of the filled 'resourceTypeEntry' on
    // construction.
    {
        templates.resourceStealChance = document.createElement("div");
        templates.resourceStealChance.classList.add("cocaco", "resourceStealChance");
        templates.resourceStealChance.classList.add("show-on-hover");
    }

    // 'resourceWorlds' is the popout panel showing all possible hands of some
    // player on hover. On construction, append a 'templates.resourceCards'
    // element for each possible world.
    {
        templates.resourceWorlds = document.createElement("div");
        templates.resourceWorlds.classList.add("cocaco", "resourceWorlds");
        templates.resourceWorlds.classList.add("show-on-hover");
        templates.resourceWorlds.appendChild(
            templates.playerName.cloneNode(true),
        );
    }

    // The resourcesPanel is the element containing the whole unit of resources
    // and resource worlds popout. It is toggled as a unit.
    {
        templates.resourcesPanel = document.createElement("div");
        templates.resourcesPanel.classList.add("cocaco", "resourcesPanel");
        templates.resourcesPanel.appendChild(
            templates.resources.cloneNode(true),
        );
        templates.resourcesPanel.appendChild(
            templates.resourceStealChance.cloneNode(true),
        );
        templates.resourcesPanel.appendChild(
            templates.resourceWorlds.cloneNode(true),
        );
    }

    // A div element for the plotting code to plot into
    {
        templates.rollsPlot = document.createElement("div");
        templates.rollsPlot.classList.add("cocaco", "rollsPlot");
    }

    // A single button used in the 'buttons' element. Add click event listener
    // when cloning.
    {
        templates.button = document.createElement("span");
        templates.button.classList.add("cocaco", "button");
        templates.button.textContent = " 🔘";
    }

    // The buttons used to trigger other panels. You have to add buttons
    // manually when cloning. We do this because we need the class context for
    // the click event listener anyway.
    {
        templates.buttons = document.createElement("div");
        templates.buttons.classList.add("cocaco", "buttons");
    }

    // The sidebar is the block element containing all card render things
    {
        templates.sidebar = document.createElement("div");
        templates.sidebar.id = "cocaco-sidebar";
        templates.sidebar.classList.add("cocaco");
        templates.sidebar.appendChild(
            templates.buttons.cloneNode(true),
        )
        templates.sidebar.appendChild(
            templates.resourcesPanel.cloneNode(true),
        );
        templates.sidebar.appendChild(
            templates.rollsPlot.cloneNode(true),
        );
    }

    // console.debug("generated:", templates);
}

// Generate the static templates variable once
generateTemplates(RenderCards.templates);
