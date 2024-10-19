"use strict";

class Trade {
    #logger = new MessageLog();

    // Used to filter 'tradeState' Source packets to keep only new, "active"
    // trades. This prevents responding to every Source packet containing
    // a 'tradeState', even if we responded earlier.

    #cleanup() {
        // Remove entries with value 'null' from 'this.trades'. Trades will get
        // that value when they are no longer available. We stop tracking at
        // that point, except in the 'this.oldTrades', which we assume stays
        // reasonably small.
        const filterTrades = trades => {
            const closedTrades = Object.keys(trades).filter(
                key => trades[key] == null,
            );
            closedTrades.forEach(key => delete trades[key]);
        };
        filterTrades(this.tradeState.activeOffers ?? {});
        filterTrades(this.tradeState.closedOffers ?? {});
    }

    countActiveTrades() {
        // @return Number of entries in the active trades
        let ret = Object.keys(this.tradeState.activeOffers ?? {}).length;
        return ret;
    }

    countClosedTrades() {
        // @return Number of entries in the closed trades
        let ret = Object.keys(this.tradeState.closedOffers ?? {}).length;
        return ret;
    }

    countOldTrades() {
        // @return Number of entries in the old trades
        let ret = this.oldTrades.size;
        return ret;
    }

    constructor() {
        // Save the trade objects transported by Source packets in the same
        // manner the host presumably would, updating on new 'tradeState' frames.
        this.tradeState = {};
        this.creators = {};
        // Enable knowing which trades were added last time. These trades are
        // assumed to potentially be open for response. This way we do not
        // respond more than once to each trade.
        this.newTrades = new Set();
        this.oldTrades = new Set();
        this.testRepetition = new Set();
    }

    creatorOfTrade(trade) {
        // If we join after some trades already existed, we may not know the
        // original creator, returning nullish.
        const ret = this.creatorOfTradeId(trade.id);
        if (ret == null) {
            debugger; // FIXME: Bug
        }
        return ret;
    }

    creatorOfTradeId(id) {
        const ret = this.creators[id];
        if (ret == null) {
            debugger; // FIXME: Bug
        }
        if (ret == null) {
            console.warn(
                `Creator of trade ${id} not found.`,
                "This may happen whenstarting the extension too late?",
            );
        }
        return ret;
    }

    static fillResourcesFromFrame(trade, frameTrade) {
        // Fill 'resources' parts of the Observer 'trade' property by converting
        // values from 'frameTrade'.
        // @param trade: Observer property 'trade', where all traders are
        //               already present. The 'resources' are added by this
        //               function.
        // @param frameTrade: Trade in frame format. Currently same as Source
        //                    format. See:
        //                    doc/colonist/message_format.md#activeOffers.
        const offer = frameTrade.offeredResources.map(r => {
            return ColonistObserver.cardMap[r];
        });
        const demand = frameTrade.wantedResources.map(
            r => ColonistObserver.cardMap[r]
        );
        trade.give.resources = offer;
        trade.take.resources = demand;
    }

    getByResponse(response = 1) {
        // Return all states currently active and responded to by any player
        // with the given response.
        let ret = {};
        Object.entries(this.tradeState.activeOffers).forEach(([id, trade]) => {
            if (Object.values(trade.playerResponses).includes(response)) {
                ret[id] = structuredClone(trade);
            }
        });
        return ret;
    }

    getByResponseAndPlayer(playerIndex, response = 1) {
        // Return all states currently active and responded to by the given
        // player with the given response.
        // FIXME: Unused function?
        let ret = {};
        Object.entries(this.tradeState.activeOffers).forEach(([id, trade]) => {
            if (trade.playerResponses[playerIndex] === response) {
                ret[id] = structuredClone(trade);
            } else {
                if (cocaco_config.tradeTest === true) {
                    if (trade.playerResponses[2] === 2) {
                        console.warn(
                            `Returning trade ${id} that was not accepted by player 2`
                        );
                        ret[id] = structuredClone(trade);
                    }
                }
            }
        });
        return ret;
    }

    #newTrades() {
        let ret = {};
        this.newTrades.forEach(key => {
            console.assert(Object.hasOwn(this.tradeState.activeOffers, key));
            ret[key] = this.tradeState.activeOffers[key];
        });
        if (Object.values(ret).includes(undefined)) {
            // Bug when a trade is 'undefiend'?
            debugger; // FIXME: Bug?
        }

        return ret;
    }

    reset(tradeState) {
        // Replace everything with new trades
        // @param tradeState: 'tradeState' object as given in Source packets
        // @return Object of newly active offers as represented in source
        //         packets.
        this.newTrades.clear();
        Object.keys(tradeState.activeOffers).forEach(
            key => this.newTrades.add(key)
        );
        this.tradeState = structuredClone(tradeState);
        this.#cleanup();
        return this.#newTrades();
    }

    static tradesHaveSameParticipants(trade1, trade2) {
        // Compute whether two trades have the same participants, in any order.
        // Assumes both trades have two distinct players each. And assumes that,
        // within a trade, transfers have the same traders. Assumes none of the
        // traders is the "bank".
        // @param trade1: Trade in Source packet format
        // @param trade2: Trade in Source packet format
        // @return true or false
        debugger; // TEST: Does it work?
        const firstFound = trade1.give.from.name == trade2.give.from.name ||
            trade1.give.from.name == trade2.give.to.name;
        const secondFound = trade1.give.to.name == trade2.give.from.name ||
            trade1.take.to.name == trade2.give.to.name;
        return firstFound && secondFound;
    }

    static tradeHasTheseTraders(trade, t1, t2) {
        // @param trade: Observer property 'trade'
        // @param t1: Observer property 'trader'
        // @param t2: Observer property 'trader'
        // @return 'true' if trade is a trade between t1 and t2, else 'false'
        const hasFirst =
            t1.name === trade.give.from.name ||
            t1.name === trade.give.to.name;
        const hasSecond =
            t2.name === trade.give.from.name ||
            t2.name === trade.give.to.name;
        const res = hasFirst && hasSecond;
        if (!res) {
            debugger; // TEST: Does it work?
        }
        return hasFirst && hasSecond;
    }

    static tradeCombined(trade) {
        // @param trade: Trade in Source packet format
        // @return Total resources traded away in the 'trade.give'-er point of
        //         view, with received resources as negative values. Returned as
        //         'Resources' object.
        let give = Resources.fromList(trade.give.resources);
        let take = Resources.fromList(trade.take.resources);
        give.subtract(take);
        return give;
    }

    static tradeMatchesTemplate(template, trade) {
        // A trade matches the template if all transferred resources are in the
        // template range. The template range consists of any number between
        // 0 and the number present in the template for the same resource.
        //
        // We use the pending collusion deficit as template to incoming trade
        // offers. If the offer matches, the trade is accepted as colluding.
        //
        // Trades with unknown resources are disallowed.
        //
        // @param template: Template in form of a 'Resource' object with
        //                  negative resource counts for the demand
        //                  ('trade.take').
        // @param trade: Trade as observer 'trade' property
        const tradeCombined = Trade.tradeCombined(trade);
        if (tradeCombined.unknown !== 0) {
            debugger; // TEST: Does it work?
            return false;
        }
        const intervalContainsValue = (interval, x) => {
            return interval[0] <= x && x <= interval[1];
        };
        let templateCopy = new Resources(template);
        templateCopy.merge(tradeCombined, (templateValue, tradeValue) => {
            const intervalEnds = [0, templateValue];
            const lo = Math.min(...intervalEnds);
            const hi = Math.max(...intervalEnds);
            const conformsToTemplate = intervalContainsValue([lo, hi], tradeValue);
            return conformsToTemplate ? 0 : 1;
        });
        const allConformToTemplate = templateCopy.countHamming() === 0;
        if (!allConformToTemplate) {
            const tradeStr = tradeCombined.toSymbols();
            const templateStr = template.toSymbols();
            console.debug(
                trade.give.from.name,
                `${tradeStr} 🚫 ${Collude.formatTemplate(template)}`,
                trade.give.to.name,
            );
        }
        return allConformToTemplate;
    }

    testNewTurn() {
        // Call this at the start of each turn
        this.testRepetition.clear();
    }

    update(tradeState) {
        // Add new, keep old, replace conflicting parts. Updates what trades
        // will be considered in the next call to 'subtrades()'.
        // @return Object of newly active offers as represented in source
        //         packets.
        this.newTrades.clear();
        Object.entries(tradeState.activeOffers ?? {}).forEach(
            ([tradeId, trade]) => {
                if (this.oldTrades.has(tradeId)) {
                    if (!this.testRepetition.has(tradeId)) {
                        // We must ensure that we excclude trades from this
                        // round because it may just be the same trade.
                        console.warn(
                            "A trade ID from an earlier round was re-used:",
                            tradeId,
                            this,
                        );
                        debugger;
                    }
                    console.debug("Old trade:", tradeId);
                    if (trade !== null) {
                        // This is just a test to check if the creator is always
                        // comuted identically. If trade IDs are reused they
                        // might change.
                        let newCreator;
                        if (Object.hasOwn(trade, "counterOfferInResponseToTradeId")) {
                            newCreator = this.creatorOfTradeId(
                                trade.counterOfferInResponseToTradeId,
                            );
                        } else {
                            const setTo = trade.creator;
                            newCreator = setTo;
                        }
                        if (newCreator != null && newCreator !== this.creators[tradeId]) {
                            debugger; // FIXME: Bug
                        }
                    }
                    return;
                }
                this.oldTrades.add(tradeId);
                this.testRepetition.add(tradeId);
                this.newTrades.add(tradeId);
                if (trade === null) {
                    debugger;
                    console.assert(
                        false,
                        "Can we assume that trades are never null when presented for the first time?",
                    );
                    return;
                }
                if (trade.counterOfferInResponseToTradeId != null) {
                    this.creators[tradeId] = this.creatorOfTradeId(
                        trade.counterOfferInResponseToTradeId,
                    );
                } else {
                    const setTo = trade.creator;
                    if (setTo == null) {
                        debugger; // FIXME: Bug
                    }
                    this.creators[tradeId] = setTo;
                }
            }
        );
        this.tradeState = combineObject(this.tradeState, tradeState);
        this.#cleanup();
        const newTrades = this.#newTrades();

        if (Object.values(newTrades).includes(undefined)) {
            // Bug when a trade is 'undefiend'?
            debugger; // FIXME: Bug?
        }

        this.#logger.log(
            null,
            `Trade: new=${Object.keys(newTrades).length}, ` +
            `active=${this.countActiveTrades()}, ` +
            `closed=${this.countClosedTrades()}, ` +
            `old=${this.countOldTrades()}`,
        );
        return newTrades;
    }

}
