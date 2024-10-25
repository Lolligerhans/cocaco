"use strict";

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

    // Other modules
    #multiverse = null;

    // Our state
    #colour_map = null;
    #playerNames = null;
    #assets = null;
    #sidebar = null;

    #cloneSidebar() {
        const sidebar = RenderCards.templates.sidebar.cloneNode(true);
        console.debug("Returning sidebar:", sidebar);
        return sidebar;
    }

    #cloneSidebarResourceEntry(playerName, playerColor) {
        let entry = RenderCards.templates.resourceEntry.cloneNode(true);
        let nameEntry = entry.querySelector(".playerName");
        nameEntry.textContent = playerName;
        nameEntry.style.color = playerColor;
        entry.querySelectorAll("img").forEach(node => {
            const newSrc = this.#assets[node.alt];
            console.debug("Replacing", node.src, "with", newSrc);
            node.src = newSrc;
        });
        console.debug("Returning entry:", entry);
        return entry;
    }

    static colonistAssetMap = (_path, resource) => {
        const newPath = `dist/images/${Colony.imageNameSnippets[resource]}.svg`;
        return newPath;
    };

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
        if (assetMap !== null) {
            mapObject(this.#assets, assetMap);
            console.debug("Assets:", this.#assets);
        }
    }

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

    render() {
        this.#ensureSidebar();
        this.#updateSidebar();
    }

    toggle() {
        console.warn("RenderCards does not have any toggle yet");
    }

    #generateNewSidebar() {
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

    generateData(data) {
        console.log("Got generation data:", data);
        debugger;
    }

    #updateEntry(entry, guessAndRange, distribution) {
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

            // if (r[3] - r[0] >= 2) {
            //     debugger;
            // }

            // Guaranteed cards: show them
            for (; i <= r[0]; increment()) {
                update(true);
                probability -= d[i];
                // updateCard(resourceIndex, i, true);
            }
            // Possible cards: update color
            for (; i <= r[3]; increment()) {
                console.assert(0 <= probability && probability <= 1);
                update(true, probability);
                probability -= d[i];
                // updateCard(resourceIndex, i, true, probability);
            }
            // Impossible cards: hide them
            const hidden = (x) => x.style.display === "none";
            for (; i <= 19; increment()) {
                if (hidden(resourceCards[childCardIndex - 1])) {
                    break;
                }
                update(false);
                // updateCard(resourceIndex, i, false);
            }
            increment(19 - i);
        });
    }

    #updateSidebar() {
        this.#multiverse.mwUpdateStats();
        const distribution = this.#multiverse.mwDistribution;
        const guessAndRange = this.#multiverse.worldGuessAndRange;
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

async function getData(url, andThen) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Response status: ${response.status}`);
    }

    const json = await response.json();
    json.then(andThen);
}

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

    // Construct entry from filled playerName and resourceCards
    templates.resourceEntry = document.createElement("div");
    templates.resourceEntry.classList.add("cocaco", "resourceEntry");
    templates.resourceEntry.appendChild(
        templates.playerName.cloneNode(true),
    );
    templates.resourceEntry.appendChild(
        templates.resourceCards.cloneNode(true),
    );

    // Construct empty resoures. Append copies of the filled resource entry into
    // it on construction.
    templates.resources = document.createElement("div");
    templates.resources.classList.add("cocaco", "resources");

    templates.sidebar = document.createElement("div");
    templates.sidebar.id = "cocaco-sidebar";
    templates.sidebar.classList.add("cocaco");
    templates.sidebar.appendChild(
        templates.resources.cloneNode(true),
    );

    console.debug("generated:", templates);
}

generateTemplates(RenderCards.templates);
