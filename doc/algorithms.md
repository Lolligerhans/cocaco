# Cocaco Algorithms

<!--toc:start-->
- [Cocaco Algorithms](#cocaco-algorithms)
  - [Card counting](#card-counting)
  - [UI](#ui)
  - [DOM pipeline](#dom-pipeline)
  - [Socket pipeline](#socket-pipeline)
<!--toc:end-->

## Card counting

| Algorithm term | Meaning |
|-|-|
| World | Concrete state of all players' resources |
| Slice | Concrete state of one player's resources |
| Multiverse | Code Module implementing card tracking |
| Collapse | Process of eliminating inconsistent worlds |
| Transform | Process of changing worlds |
| Branch | Process of adding new worlds from a random event |

We implement Bayesian updates for observations with known probabilities (certain
or uniform events: getting resources, trading, stealing, ...).

Our current belief is a distribution over all possible states (**_worlds_**). This
distribution is represented as the set of worlds consistent with all previous
observations. Each world in the set is paired with the probability of being
true. New observations affect the probabilities of each world according to
Bayes' theorem.

Worlds contain one set of resources (**_slices_**) for each player, and the
epistemic probability of it matching the true state.

Observations that are the result of hidden randomness increase the amount of
consistent world (**_branching_**). For example, unknown robs split each world into
five new consistent worlds, one for each resource being stolen.
Observations that are inconsistent with some worlds eliminate inconsistent
worlds (**_collapsing_**). For example, revealing cards by creating a trade offer.
Operations that only change the slices of existing worlds are called
**_transforming_**. For example, obtaining resources from the bank.

After branching operations operations, duplicate worlds (worlds with identical
slices) are merged to minimise the number of explicitly represented worlds.
Typically, only one world is consistent with all past observations. Almost
always it is less than ten. When adjusting the rules to allow keeping more than
7 cards it is possible to DoS Cocaco due to a large world
count and inefficient implementation.

Marginal resource probabilities (and all other desired stats) are generated from
the set of worlds. This data is updated on request only (every time the render
module wants to update).

## UI

## DOM pipeline

## Socket pipeline
