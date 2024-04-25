#!/usr/bin/env python3

# This script checks test 5
import random
import numpy as np

n = 500000

# Initialize lists to store the results
#alice_results = []
#bob_results = []
hadSHeep = 0
hadNosheep = 0
total_one_wood = 0
total = 0
shown = 1;
# Run the experiment 1000 times
def showthem():
    print(f"Bob had {hadSHeep} sheep and {hadNosheep} no sheep out of {total_one_wood} trials with one wood each")
    if (total_one_wood == 0):
        return
    sheep_rate = hadSHeep/total_one_wood
    nosheep_rate = hadNosheep/total_one_wood
    print(f"sheep rate: {sheep_rate}")
    print(f"nosheep rate: {nosheep_rate}")

for _ in range(n):

    # Initialize Alice's and Bob's resources
    alice_resources = ["wood"] * 10 + ["brick"] * 5 + ["sheep"]
    bob_resources = []

    # Bob takes one of Alice's resources randomly, 5 times in a row
    for i in range(5):
        # Generate uniform int in range [0, alice_resources.length)
        rng = np.random.default_rng()
        index = rng.integers(0, len(alice_resources))
        #print(f"The index is {index} / {len(alice_resources)}")

        stolen = alice_resources[index]
        bob_resources.append(stolen)
        alice_resources.pop(index)

    # Store the results
#    alice_results.append(alice_resources.copy())
#    bob_results.append(bob_resources.copy())
    total += 1
    if bob_resources.count("wood") == 1:
        # Show resources with 1/shown chance
        total_one_wood += 1
        if "sheep" in bob_resources:
            hadSHeep += 1
        else:
            hadNosheep += 1
        if random.random() < 1/shown:
            print(bob_resources, "←", alice_resources)
            showthem()
            shown += 1

# Print some sample results
#print("Alice's resources after the procedure:")
#for i in range(5):
#    print(f"Trial {i+1}: {alice_results[i]}")
#print("Bob's resources after the procedure:")
#for i in range(5):
#    print(f"Trial {i+1}: {bob_results[i]}")
#

print("historic sheep rate: 0.663 (500k)")
print("theoretical chance of having a sheep ignoring wood: after 5 steps [0.6875 0.3125]")
