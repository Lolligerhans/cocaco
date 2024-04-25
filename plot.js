// TODO
//  - Try multi-category plot
//  - Plot colour-coded histogram
//    - https://plotly.com/python/colorscales/ (imshow as workaround)
//    - bar plot relative mode + color interpolation (1 trace per roll)
//      - https://stackoverflow.com/questions/45857682/interpolation-of-colors
//      - https://plotly.com/javascript/bar-charts/
//  - double axes: https://plotly.com/javascript/multiple-axes/

// https://plotly.com/javascript/plotly-fundamentals/

//============================================================
// Config
//============================================================

// Number of generated "samples"
const configSampleCount = 100;
const configPlotTests = true;

const divideSizes = 1.2;

//============================================================
//
//============================================================

const testBubblePlotDivId = "testBubblePlotDivision";
const testPlotDiv = "testPlotDiv";
const testHistogramPlotDivId = "testHistogramPlotDiv";

//============================================================
// Helpers
//============================================================

function randomFloat(min, max)
{
    return Math.random() * (max - min) + min;
}

function randomInt(min, max)
{
    return Math.floor(randomFloat(min, max + 1));
}

function randomDie()
{
  return randomInt(1, 6);
}

function generateTraceFromMwDistribution(distribution, player, resource)
{
    // Generate would-be samples for calculated distribution
    let y = [];
    for (let numb = 0; numb < distribution[player][resource].length; ++numb)
    {
        // Generate fake samples for having 'numb' many of this card
        const d = distribution[player][resource];
        const fakeSampleCount = Math.round(configSampleCount * d[numb].toFixed(2));
        for (let j = 0; j < fakeSampleCount; ++j)
            y.push(numb);
    }
    const x = y.map(y => resource);
    return [x, y];
}

function generatePerCountBubbles(allPlayers, distribution, player, resource, totalCards, spread = 0.3)
{
    // Generate one bubble for each count, accumulated over all worlds
    let size = [];
    let y = [];
    let opacity = [];
//    log("Generating distribution bubble for", player, resource);
//    log(distribution[player][resource]);


    // Offset values for better readability
    const playerIdx = allPlayers.indexOf(player);
    const divisor = Math.max(allPlayers.length - 1, 1);
    const offset = -spread/2 + spread/divisor * playerIdx;

    for (let numb = 0; numb < distribution[player][resource].length; ++numb)
    {
        const probability = distribution[player][resource][numb];
        if (probability > 0 && (numb > 0 || probability < 0.999))
        {
            // Good options
            // y=n, s=r, o=c.png
            // y=r, s=n, o=c.png

            // Scaled values approximately into [0,1]
            const rarity = 0.1 + 0.3 * numb / (Math.max(1, totalCards));
            const number = numb;
            const chance = probability;

            // Mapping: Plot_property = catan_property
            const yVal = number;
            const sVal = rarity;
            const oVal = chance;


            y.push(yVal + offset/2);
            size.push(sVal * 1000); // Bubble marker size should be up to 1000
            opacity.push(oVal);


            /*
            y.push(numb);

            // (!) Switched to test effect
            const opFactor = numb / totalCards;
            const probFactor = probability;

            const opacityScale = 0.1 + 0.9 * probFactor;
            const probScale = 1000 * opFactor;

            size.push(probScale);
            opacity.push(opacityScale);

            // Set opacity by size: large circles get more transparent to not
            // hide others. Small ones are opaque to be seen.
//            opacity.push(1 - probability * 0.90);
            */
        }
    }
    const slot = resourceTypes.indexOf(resource) + 1 + offset;
    const x = size.map(y => slot);

    return [x, y, size, opacity];
}

//============================================================
// Scratchpad to test how plotting works
//============================================================

function plotTest()
{
    console.log("Running plot test");

    log("example_players:", example_players);
    log("Colours:", example_player_colors);

    var x = ['day 1', 'day 1', 'day 1', 'day 1', 'day 1', 'day 1',
        'day 2', 'day 2', 'day 2', 'day 2', 'day 2', 'day 2']

    var trace1 = {
        y: [0.2, 0.2, 0.6, 1.0, 0.5, 0.4, 0.2, 0.7, 0.9, 0.1, 0.5, 0.3],
        x: x,
        name: 'kale',
        marker: {color: '#3D9970'},
        type: 'box'
    };

    var trace2 = {
        y: [0.6, 0.7, 0.3, 0.6, 0.0, 0.5, 0.7, 0.9, 0.5, 0.8, 0.7, 0.2],
        x: x,
        name: 'radishes',
        marker: {color: '#FF4136'},
        type: 'box'
    };

    var trace3 = {
        y: [0.1, 0.3, 0.1, 0.9, 0.6, 0.6, 0.9, 1.0, 0.3, 0.6, 0.8, 0.5],
        x: x,
        name: 'carrots',
        marker: {color: '#FF851B'},
        type: 'box'
    };

    var traceTest =
    {
        y: [0.0, 0.1, 0.2, 0.3, 1.4, 1.5,   // day1
            0.6, 0.7, 0.8, 0.9, 0.0, 0.1],  // day2
        x: x,
        name: 'test',
        marker: {color: '#000000'},
        type: 'box'
    };

    const t1 = generateTraceFromMwDistribution(example_mwDistribution,
        "Leon",
        "wood");
    var traceWood1 =
    {
        y: t1[1],
        x: t1[0],
        name: 'wood Leon',
        marker: {color: '#00FF00'},
        type: "box"
    };
    const t2 = generateTraceFromMwDistribution(example_mwDistribution,
        "Leon",
        "brick");
    var tracebrick1 =
    {
        y: t2[1],
        x: t2[0],
        name: 'brick Leon',
        marker: {color: '#00FF00'},
        type: "box"
    };

    let LeonTraces = [];
    for (let i = 0; i < resourceTypes.length; ++i)
    {
        const res = resourceTypes[i];
        let [vx, vy] = generateTraceFromMwDistribution(
            example_mwDistribution, "Leon", res);
        LeonTraces[i] =
        {
            y: vy,
            x: vx,
            name: "Leon",
            marker: {color: '#00FF00'},
            type: "box"
        };
    }

    let playerTraces = [];
    for (let j = 0; j < example_players.length; ++j)
    {
        const player = example_players[j];
        for (let i = 0; i < resourceTypes.length; ++i)
        {
            const res = resourceTypes[i];
            let [vx, vy] = generateTraceFromMwDistribution(
                example_mwDistribution, player, res);
            playerTraces[resourceTypes.length * j + i] =
            {
                y: vy,
                x: vx,
                name: player,
                marker: {color: example_player_colors[player]},
                type: 'box',
                showlegend: false,
            };
        }
    }

    const data = [trace1, trace2, trace3, traceTest/*, traceWood1, tracebrick1*/]
        .concat(LeonTraces).concat(playerTraces);
    log(playerTraces);
    log(LeonTraces);
    log(data);

    const layout = {
        yaxis:
        {
            title: 'normalized moisture',
            zeroline: false
        },
        boxmode: 'group'
        //  paper_bgcolor: '#7f7f7f',
        //  plot_bgcolor: '#c7c7c7'
        //    autosize: false,
        //    width: 300,
        //    height: 300,
        //    margin:
        //      l: 5
        //      r: 5,
        //      b: 10,
        //      t: 10,
        //      pad: 4
        //    },
    };

    Plotly.newPlot(testPlotDiv, playerTraces, layout);
    log("Done plot box test");
}

function bubbleTest()
{
    log("Starting bubble test");
  /*
    var trace1 = {
          x: [1, 2, 3, 4],
          y: [10, 11, 12, 13],
          mode: 'markers',
          marker: {
                  color: ['rgb(93, 164, 214)', 'rgb(255, 144, 14)',  'rgb(44, 160, 101)', 'rgb(255, 65, 54)'],
                  opacity: [1, 0.8, 0.6, 0.4],
                  size: [40, 60, 80, 100]
                }
    };

    let traceUp =
    {
        x: [1, 1, 1, 1],
        y: [1, 2, 3, 6],
        name: "trace up?",
        mode: "markers",
        marker: { color: ['rgb(33, 33, 33)', 'rgb(33, 33, 33)',  'rgb(33, 33, 33)', 'rgb(33, 33, 33)'],
                  opacity: [0.3, 0.3, 0.5, 0.5],
                  size: [100, 200, 400, 800],
                  sizemode: "area" }
    };

    let b1 = generatePerCountBubbles(example_mwDistribution, "Ennie",
        "wood");
    log("Bubble trace b1:", b1);
    let traceWood  ={
        y: b1[1],
        x: b1[0],
        name: "wood Ennie",
        mode: "markers",
        marker: { color: b1[3],
                  size: b1[2],
                  opacity: b1[4],
                  sizemode: "area" }
//        size: b1[2]
    };
*/

    let playerBubbles = [];
    const totalResources = generateFullNamesFromWorld(example_mw[0]);
    for (let j = 0; j < example_players.length; ++j)
    {
        const player = example_players[j];
        for (let i = 0; i < resourceTypes.length; ++i)
        {
            const res = resourceTypes[i];
            let [tx, ty, tsize, topacity]  // Trace
                = generatePerCountBubbles(
                    example_players,
                    example_mwDistribution,
                    player,
                    res,
                    totalResources[res],
                    0.4);
            const ttext = topacity.map(o => { const perc = 100 * o.toFixed(2); return `${perc}%`});
            playerBubbles[resourceTypes.length * j + i] =
            {
                y: ty,
                x: tx,
                name: player,
                mode: "markers",
                marker: { color: example_player_colors[player],
                    opacity: topacity,
                    sizemode: "area",
                    //                          size: tsize,
                    size: 20,
                    line: {color: "black", width: 1}
                },
                text: ttext
            };
        }
    }

    let bubbleData = playerBubbles;
//    log("ok traces:", traceUp, traceWood);
//    log("failing traces:", playerBubbles);

    let layout = {
        title: 'y=number, size=chance, opacity=rarity',
        showlegend: false,
        height: 400,
        width: 400,
        xaxis:
        {
            tickvals: [1, 2, 3, 4, 5],
            ticktext: resourceTypes
        },
        yaxis:
        {
            tick0: 0,
            dtick: 1,
            autorange: true,
        }
    };

    Plotly.newPlot(testBubblePlotDivId, bubbleData, layout);
    log("Done bubble test");
}

function histogramTest()
{
  // DATA
  let N = 36 + 18;
  const useFix = false;

  if (useFix) N = 36;
  const c = N / 36;
  log("Starting histogram test");
  let testRolls = new Array(N).fill(0);
  testRolls = testRolls.map(() => {return randomDie() + randomDie();});
  if (useFix) testRolls= [5,9,11,4,8,3,10,8,2,3,6,8,10,5,6,10,7,4,7,3,9,3,11,6,8,6,8,8,3,7,5,4,9,7,6,9];
  testHist = new Array(13).fill(0);
  for (let r of testRolls)
  {
    testHist[r] += 1;
    testHist[0] += 1;
    testHist[1] = Math.max(testHist[1], testHist[r]);
  }
  log("testRolls:", testRolls, "testHist:", testHist);

  let x = testRolls;
  let y = x.map(() => 1);
  const col = [255, 102, 51];
//  const cok = [0, 85, 0]; // Forest green
//  const cok = [85, 51, 136]; // Half purple
  const cok = [0, 0, 0]; // Black
  const colo = x.map((v, i) => { const f = i / x.length;
                                 return `rgb(${Math.floor(cok[0] * (1-f) + col[0] * f)},${Math.floor(cok[1] * (1-f) + col[1] * f)},${Math.floor(cok[2] * (1-f) + col[2] * f)})`; });
  log("x:", x, "y:", y, "colo:", colo);
  let trace =
  {
    type: 'bar',
    x: x,
    y: y,
    marker:
    {
      color: colo,
    },
    width: x.map(() => 1),
    hoverinfo: x.map((_, i) => i.toString()),
//    histfunc: "count",
    name: "dice rolls",
    xbins:
    {
      start: 2,
      end: 12,
      size: 1,
    },
  };
  // Expectation
  const probability36 = [1,1,2,3,4,5,6,5,4,3,2,1,1];
  const probability = probability36.map(x => x / 36);
  const testLineX = [1.5,2,3,4,5,6,7,8,9,10,11,12,12.5];
  const testLineY = probability36.map(x => c*x);  // Expectation
//  let testLineY = [c,1*c,2*c,3*c,4*c,5*c,6*c,5*c,4*c,3*c,2*c,1*c,c];

  // Luck
  let dist = [];
  for (let i = 2; i <= 12; ++i)
  {
    dist[i-2] = stats.binomialDistribution(N, probability[i-1]);
  }

  const clampProb = p => Math.min(Math.max(p, 0), 1);
  let lessMoreDist = [];
  const precomputeMoreOrLess = (number) =>
  {
    if (number <= 1 || 13 <= number) alertIf("need number from 2 to 12 for dist");
    // (!) Start loop at i=1 and inline i=0
    let lessOrEqualAcc = dist[number-2][0];
    let moreOrEqualAcc = 1;
    lessMoreDist[number-2] = [];
    lessMoreDist[number-2][0] = [clampProb(lessOrEqualAcc), clampProb(moreOrEqualAcc)];
    for (let i = 1; i <= N; ++i)
    {
      lessOrEqualAcc += dist[number-2][i    ];
      moreOrEqualAcc -= dist[number-2][i - 1];
      lessMoreDist[number-2][i] = [clampProb(lessOrEqualAcc), clampProb(moreOrEqualAcc)];
    }
  };
  // TODO symmetric: copy 2-6 to 12-8
  for (let number = 2; number <= 12; ++number)
    precomputeMoreOrLess(number);
  log("Precomputed less or more distr:", lessMoreDist);

  log("dist:", dist);
  let prob = (x, number) =>
  {
    log(`\n===== number=${number}, x=${x} ===== `);
    if (number <= 1 || 13 <= number) alertIf("need number from 2 to 12 for dist");
    // Generate total probability mass with density <= p(x). x \in [0,N].
    let sum = 0;
    const pr = dist[number-2][x];
    log("probability:", pr);
    for (const d of dist[number-2])
    {
      if (d <= pr+0.00000001)
      {
        sum += d;
//        log(`numer=${number}, x=${x}, more likely: ${d}<=${pr} -> sum=${sum}`);
      }
    }
    sum = Math.min(Math.max(sum, 0), 1);
    log("Total (clamped): sum=", sum);
    return sum;
  };
  let probAdjust = (p) =>
  {
    const distrib = stats.binomialDistribution(11, p);
    const sum = distrib.reduce((acc, val) => acc + val) - distrib[0];
    return Math.min(Math.max(sum, 0), 1);
  };
  let histPercent = testHist.slice(2).map((v, i, arr) => { return v / testLineY[i+1] - 1 });
  let maxPercent = Math.max.apply(null, histPercent);
  log("===========================================");
  let minChance = { number: 0, chance: 2.0 }; // Invalid initialization
  let minAdjustedChance = { number: 0, chance: 2.0 }; // Invalid initialization
  const chanceLevel = testHist.slice(2).map( (v,i) =>
  {
    let p = prob(v, i + 2);
    if (p <= minChance.chance)
    {
      minChance.number = i + 2;
      minChance.chance = p;
      minAdjustedChance.number = i + 2;
      minAdjustedChance.chance = probAdjust(p);
    }
    return p;
  });

  const lessMoreChance = testHist.slice(2).map( (v,i) => lessMoreDist[i][v] );
  const lessChance = lessMoreChance.map( lm => lm[0] );
  const lessStrict = lessChance.map( (p, i) => p - dist[i][testHist[i+2]] );
  const moreChance = lessMoreChance.map( lm => lm[1] );
  const moreStrict = moreChance.map( (p,i) => p - dist[i][testHist[i+2]] );
  log("lessMoreChance:", lessMoreChance);
  log("lessChance:", lessChance);
  log("moreChance:", moreChance);

  const adjustedChance = chanceLevel.map(p => probAdjust(p));
  // TODO have local slicedHist = testHist.slice()
  const realLuck = testHist.slice(2).map((v,i,arr) =>
  {
    // Return probability of an event this rare or rarer
    const res = chanceLevel[i];
    //        = prob(v, i+2); // Probability of this or a less likely event

//    const luckNumber = Math.log(1/res);
//    const luckNumber = 1/res; // Proportional to probability (?)
//    const luckNumber = 1-res;
//    const luckNumber = 1/res * probability[i+1];
//    const luckNumber = 1/res * (v - testLineY[i+1]);  // Unstable (good?)
//    const luckNumber = -Math.log(res) * (v - testLineY[i+1]);
    //const luckNumber = (1 - 1/res) * (v - testLineY[i+1]);
//    const luckNumber = (1/res - 1) * (v - testLineY[i+1]);

      const luckNumber = (1/res - 1) * (v - testLineY[i+1]);

//    const luckNumber = (1-res) * (v - testLineY[i+1]);
//    const res = (1 / rarity[i] - 1) * (v - ey[i+1]);
//    const res = 1/rarity[i] * (v - ey[i+1]);  // Problem: Nonzero effect at 100% chance.
//    const res = (1 - rarity[i]) * (v - ey[i+1]);  // Problem: 1% has same effect as 10% chance.
//    const res = -Math.log(rarity[i]) * (v - ey[i+1]);

    log(`count=${v}, number=${i+2}, luckNumber =`, luckNumber);
    return luckNumber;
  });
  const adjustedRealLuck = testHist.slice(2).map((v,i,arr) =>
  {
    // Return probability of an event this rare or rarer
    const res = adjustedChance[i];
    const luckNumber = (1/res - 1) * (v - testLineY[i+1]);
    return luckNumber;
  });
  const luckColor = adjustedChance.map(rar =>
  {
    const r = Math.ceil(255 * Math.cos(Math.PI * rar / 2));
    const g = Math.ceil(255 * Math.sin(Math.PI * rar / 2));
    const col = `rgb(${r}, ${g}, 0)`;
    log("Generated color:", col);
    return col;
  });

  // minChance.xoffset = minChance.number <= 7 ? (minChance.number - 3.5) * -30 / 2
  //                                           : (minChance.number - 10.5) * -30/2;
  // minChance.yoffset = (0.5 * (1-minChance.chance - 0.85) + 0.1 * (1-minChance.chance-0.85 > 0 ? 1 : -1)) * 7 * 30;
  // minAdjustedChance.xoffset = minAdjustedChance.number <= 7 ? (minAdjustedChance.number - 3.5) * -30 / 2
  //                                                           : (minAdjustedChance.number - 10.5) * -30/2;
  // minAdjustedChance.yoffset = (0.5 * (1-minAdjustedChance.chance - 0.85) + 0.1 * (1-minAdjustedChance.chance-0.85 > 0 ? 1 : -1)) * 7 * 30;

  minChance.xoffset = minChance.number <= 7 ? 11 : 3;
  minChance.yoffset = 0.05;
  minAdjustedChance.xoffset = minChance.xoffset;
  minAdjustedChance.yoffset = 0.15;

  const add = (x,y)=>x+y;
  const luckSum = realLuck.reduce((a,b)=>a+b);
  logs(`realLuck: ${realLuck}`);
  logs(`adjustedRealLuck: ${adjustedRealLuck}`);
  logs(`chanceLevel: ${chanceLevel}`);
  logs(`1-minChance: ${minChance.number}: ${1-minChance.chance}`);
  log(`Sum of luck: ${luckSum}`);
  const maxRealLuck = Math.max.apply(null, realLuck);

  // TRACES
  const layout =
  {
    hovermode: "closest",
    margin: {t:0, b: 15, l: 15, r: 25},
    showlegend: false,
    height: 292 / divideSizes,
    width: 300 / divideSizes,
    xaxis:
    {
      tickvals: [2,3,4,5,6,7,8,9,10,11,12],
      autorage: false,
    },
    yaxis:
    {
      dtick: Math.ceil(6 * c / 4),
      tick0: 0,
    },
    yaxis2:
    {
//      title: "luck",
      overlaying: "y",
      side: "right",
    //barmode: "overlay",
//      dtick: 1,
      tick0: 0,
      showgrid: false,
      //range: [-10,10],
//      autorage: false,
//      range: [-1, Math.max(1,maxPercent)],
    },
    yaxis3:
    {
      zeroline: false,
      overlaying: "y",
      side: "left",
      showgrid: false,
      showticklabels: false,
      autorange: false,
      range: [1, 0],
      //nticks: 0,
      //tickvals: [1.0],
    },
    annotations:
    [
      {
        x: minChance.number,
        y: minChance.chance,
        xref: 'x',
        yref: 'y3',

        ax: minChance.xoffset,
        ay: minChance.yoffset,
        axref: "x",
        ayref: "y3",

        text: `<b>${(minChance.chance * 100).toFixed(1)}%</b>`,
        bgcolor: "midnightblue",
        opacity: 0.8,
        showarrow: true,
        arrowhead: 6,
        arrowsize: 1,
        arrowwidth: 1,
        arrowcolor: "darkblue",
        font:
        {
          //family: "Courier New, monospace",
          size: 12,
          color: "white",
          fontweight: "bold",
        },
        //align="center",
        //bordercolor="#c7c7c7",
        //borderwidth=2,
        //borderpad=4,
      },
      {
        // Position where arrow points
        xref: "x",
        yref: "y3",
        x: minAdjustedChance.number,
        y: minAdjustedChance.chance,

        // Position of text
        ax: minAdjustedChance.xoffset,
        ay: minAdjustedChance.yoffset,
        axref: "x",
        ayref: "y3",

        text: `<b>${(minAdjustedChance.chance * 100).toFixed(1)}%</b>`,
        bgcolor: "red",
        opacity: 0.8,
        showarrow: true,
        arrowhead: 6,
        arrowsize: 1,
        arrowwidth: 1,
        arrowcolor: "darkred",
        font:
        {
          size: 12,
          color: "white",
          fontweight: "bold",
        },
      },
    ],
  };


  // expectation -----------------------------

  let trace2 =
  {
    x: testLineX,
    y: testLineY,
    mode: "lines",
    name: "expectation",
    marker: { color: "#0a0" },
    line: { width: 3, dash: "solid", shape: "hvh" },
  };

  // relative over draw -----------------------------

  // Old version where we just trace x / E(X) - 1
  /*
  let trace3 =
  {
    type: 'bar',
    x: testLineX.slice(1,13),
    y: histPercent,
    yaxis: "y2",
//    mode: "lines",
    width: 0.01,
    name: "luck",
//    base: histPercent.map(x => {return x < 0 ? x : 0}),
    marker:
    {
      color: "#0000",
//      dash: "+ots",
      line: { color: "#69f", width: 3, },
    },
  };
  */
  let trace3 =
  {
    type: 'bar',
    x: testLineX.slice(1,13),
    y: realLuck,
    yaxis: "y2",
    width: 0.2,
//    color: luckColor,
    name: "luck",
//    base: histPercent.map(x => {return x < 0 ? x : 0}),
    marker:
    {
//      color: "green",
//      color: "#69f",
      color: luckColor,
//      dash: "dots",
      //line: { color: "white", width: 3 },
    },
  };
//  let trace3_ =
//  {
//    type: 'bar',
//    x: testLineX.slice(1,13),
//    y: adjustedRealLuck,
//    yaxis: "y2",
//    width: 0.01,
//    name: "luck",
////    base: histPercent.map(x => {return x < 0 ? x : 0}),
//    marker:
//    {
//      color: "#0000",
////      dash: "dots",
//      line: { color: "#f96", width: 4 },
//    },
//  };
  let trace3_1 =
  {
    type: 'scatter',
    mode: "markers",
    x: testLineX.slice(1,13),
    y: chanceLevel,
    yaxis: "y3",
    name: "rarity level (%)",
    marker:
    {
      color: "midnightblue",
      size: 9,
      line: { color: "white", width: 2 },
    },
  }
  let trace3_2 =
  {
    type: 'scatter',
    mode: "markers",
    x: testLineX.slice(1,13),
    y: adjustedChance,
    yaxis: "y3",
    name: "Adjusted rarity level",
    marker:
    {
      color: "red",
      size: 9,
      line: { color: "white", width: 2 },
    },
  };
  let trace3_less =
  {
    type: 'scatter',
    mode: "markers",
    x: testLineX.slice(1,13),
    y: lessChance,
    yaxis: "y3",
    name: "P(X <= x)",
    marker:
    {
      color: "lightgray",
      size: 4,
      line: { color: "black", width: 0.5 },
      symbol: "triangle-down",
      opacity: 1.0,
    },
  };
  let trace3_less_strict =
  {
    type: 'scatter',
    mode: "markers",
    x: testLineX.slice(1,13),
    y: lessStrict,
    yaxis: "y3",
    name: "P(X < x)",
    marker:
    {
      color: "black",
      size: 4,
      line: { color: "lightgray", width: 0.5 },
      symbol: "triangle-down",
    },
  };
  let trace3_more =
  {
    type: 'scatter',
    mode: "markers",
    x: testLineX.slice(1,13),
    y: moreChance,
    yaxis: "y3",
    name: "p(X >= x)",
    marker:
    {
      color: "lightgray",
      size: 4,
      line: { color: "black", width: 0.5 },
      symbol: "triangle-up",
    },
  };
  let trace3_more_strict =
  {
    type: 'scatter',
    mode: "markers",
    x: testLineX.slice(1,13),
    y: moreStrict,
    yaxis: "y3",
    name: "p(X > x)",
    marker:
    {
      color: "black",
      size: 4,
      line: { color: "lightgray", width: 0.5 },
      symbol: "triangle-up",
    },
  };
  let trace4 =
  {
    x: [1.5, 12.5],
    y: [0, 0],
    yaxis: "y2",
    mode: "lines",
    name: "luck-neutral-reference",  // Name from trace
    marker: { color: "#69f" },
    line: { width: 1, dash: "line" },
  };
  // Test version
//  let realLuckTrace =
//  {
//    x: testLineX.slice(1,13),
//    y: realLuck,
//    type: 'scatter',
//    mode: "lines",
//    yaxis: "y2",
//    marker: {size: 20, color: "red"},
//    name: "realLuck",
//  };
  log("testLineY", testLineY);
  log("testHist:", testHist);
  log("histPercent:", histPercent);
  log("maxPercent:", maxPercent);
  log("realLuck (testHist):", realLuck);
  const config = { displayModeBar: false };
  const data =
  [
    trace, trace2,
    trace3_less, trace3_less_strict, trace3_more, trace3_more_strict,
    /*trace4,*/ trace3, trace3_2, trace3_1,
  ];
  Plotly.newPlot(testHistogramPlotDivId, data, layout, config);
}

//============================================================
// Plotters that fill an element by ID
//============================================================

// Plots current global ManyWorlds status variables into 'idToPlotInto'
function plotResourcesAsBubbles(idToPlotInto, trackerObject, colour_map)
{
    let playerBubbles = [];
    const totalResources = mw.generateFullNamesFromWorld(trackerObject);   // FIXME what is happening here?
    for (let j = 0; j < trackerObject.playerNames.length; ++j)
    {
        const player = trackerObject.playerNames[j];
        for (let i = 0; i < resourceTypes.length; ++i)
        {
            const res = resourceTypes[i];
            const [tx, ty, tsize, topacity]  // Trace
                = generatePerCountBubbles(
                    trackerObject.playerNames,
                    trackerObject.mwDistribution,
                    player,
                    res,
                    totalResources[res],
                    0.4);
            const ttext = topacity.map(o => { const perc = 100 * o.toFixed(2); return `${perc}%`});
            playerBubbles[resourceTypes.length * j + i] =
            {
                y: ty,
                x: tx,
                name: player,
                mode: "markers",
                marker: { color: colour_map[player],
                          opacity: topacity,
                          sizemode: "area",
                          size: 20 / (divideSizes**2),
                          line: {color: "black", width: 1}
                        },
                text: ttext
            };
        }
    }

    const layout = {
        margin: {t: 0, b: 15, l: 10, r: 0},
        showlegend: false,
        height: 300 / divideSizes,
        width: 400 / divideSizes,
        xaxis:
        {
            tickvals: [1, 2, 3, 4, 5],
            ticktext: resourceTypes.map(res => resourceIcons[res]),
            autorange: false
        },
        yaxis:
        {
            tick0: 0,
            dtick: 1,
            rangemode: "tozero",
            autorange: true,
        }
    };

    const config = { displayModeBar: false };

    Plotly.newPlot(idToPlotInto, playerBubbles, layout, config);
    console.debug("🫧 Finished plotting MW resources into", `ID=${idToPlotInto}`);
}

// Despite the similar name, trackerObject here is 'Track', above is
// 'ManyWorlds' TODO Fix that
function plotRollsAsHistogram(trackerObject, idToPlotInto)
{
  // Rolls
  const ones = new Array(trackerObject.rolls.length).fill(1);
  const c = [255, 102, 51]; // Base colour
  const colo = trackerObject.rolls.map((_, i) =>
  {
    // Linearly interpolate towards base colour starting at black during
    // progression in data (moves in the game).
    const f = i / trackerObject.rolls.length;
    return `rgb(${Math.ceil(c[0]*f)},${Math.ceil(c[1]*f)},${Math.ceil(c[2]*f)})`;
  });

  const N = trackerObject.rolls.length;
  const n = trackerObject.rolls.length / 36;

  // Expectation
  const probability36 = [1,1,2,3,4,5,6,5,4,3,2,1,1];
  const probability = probability36.map(x => x / 36);
  const ex = [1.5,2,3,4,5,6,7,8,9,10,11,12,12.5]; // Cover the bars at the ends
  const ey = probability.map(x => N*x); // Expectation

  // Precompute distributions
  let dist = [];
  for (let i = 2; i <= 12; ++i)
  {
    dist[i-2] = stats.binomialDistribution(N, probability[i-1]);
  }
  const clampProb = p => Math.min(Math.max(p, 0), 1);
  let lessMoreDist = [];  // <=, >=
  const precomputeMoreOrLess = (number) =>
  {
    if (number <= 1 || 13 <= number) alertIf("need number from 2 to 12 for dist");
    // (!) Start loop at i=1 and inline i=0
    let lessOrEqualAcc = dist[number-2][0];
    let moreOrEqualAcc = 1;
    lessMoreDist[number-2] = [];
    lessMoreDist[number-2][0] = [clampProb(lessOrEqualAcc), clampProb(moreOrEqualAcc)];
    for (let i = 1; i <= N; ++i)
    {
      lessOrEqualAcc += dist[number-2][i    ];
      moreOrEqualAcc -= dist[number-2][i - 1];
      lessMoreDist[number-2][i] = [clampProb(lessOrEqualAcc), clampProb(moreOrEqualAcc)];
    }
  };
  // TODO symmetric: copy 2-6 to 12-8
  for (let number = 2; number <= 12; ++number)
    precomputeMoreOrLess(number);

  let prob = (x, number) =>
  {
    if (number <= 1 || 13 <= number) alertIf("need number from 2 to 12 for dist");
    // Generate total probability mass with density <= p(x). x \in [0,N].
    let sum = 0;
    const pr = dist[number-2][x];
    // Add small epsilon for stability
    for (const d of dist[number-2]) { if (d <= pr+0.00000001) sum += d; }
    sum = Math.min(Math.max(sum, 0), 1);
    return sum;
  };
  let probAdjust = (p) =>
  {
    const distrib = stats.binomialDistribution(11, p);
    const sum = distrib.reduce((acc, val) => acc + val) - distrib[0];
    return Math.min(Math.max(sum, 0), 1);
  };

  // Luck
  // Old version: Luck := x / E(X)
//  const luck = rollsHistogram.slice(2).map((v, i, arr) => { return v / ey[i+1] - 1 });
//  const maxLuck = Math.max.apply(null, luck);
  let minChance = { number: 7, chance: 0.9 }; // Arbitrary initialization
  let minAdjustedChance = { number: 7, chance: probAdjust(0.9) }; // Arbitrary initialization
  const rarity = trackerObject.rollsHistogram.slice(2).map((v,i,arr) =>
  {
    const p = prob(v, i + 2);
    if (p <= minChance.chance)
    {
      minChance.number = i + 2;
      minChance.chance = p;
      minAdjustedChance.number = i + 2;
      minAdjustedChance.chance = probAdjust(p);
    }
    return p;
    // Return cumulative probability of an event this rare or rarer
  });

  const lessMoreChance = trackerObject.rollsHistogram.slice(2).map( (v,i) => lessMoreDist[i][v] );
  const lessChance = lessMoreChance.map( x => x[0] );
  const moreChance = lessMoreChance.map( x => x[1] );
  const lessStrict = lessChance.map( (p,i) => p - dist[i][trackerObject.rollsHistogram[i+2]] );
  const moreStrict = moreChance.map( (p,i) => p - dist[i][trackerObject.rollsHistogram[i+2]] );

  const adjustedRarity = rarity.map(p => probAdjust(p));
  // Define luck
  const realLuck = trackerObject.rollsHistogram.slice(2).map((v,i) =>
  {
    // Alternative definitions: see 'histogramTest'
    // For 25% probability, multiply the card gain by 3
    // For 50% probability, multiply by 1
    // For 75% probability, multiply by 1/3
    const res = (1 / rarity[i] - 1) * (v - ey[i+1]);

//    log(`[DEBUG] count=${v}, number=${i+2}, rarity=${rarity[i]}, luckNumber =`, res);
    return res;
  });
  const adjustedRealLuck = trackerObject.rollsHistogram.slice(2).map((v,i) =>
  {
    return (1 / adjustedRarity[i] - 1) * (v - ey[i+1]);
  });
  minChance.xoffset = minChance.number <= 7 ? 11 : 3;
  minChance.yoffset = 0.05;
  minAdjustedChance.xoffset = minChance.xoffset;
  minAdjustedChance.yoffset = 0.15;

  // -----------------------------------------------

  let rollTrace =
  {
    type: "bar",
    x: trackerObject.rolls,
    y: ones,
    width: ones,
    marker: { color: colo },
    name: "dice rolls", // Not shown
    xbins:
    {
      start: 2,
      end: 12,
      size: 1,
    },
  };
  let expTrace =
  {
    x: ex,
    y: ey,
    mode: "lines",
    name: "expectation",   // Hidden
    marker: { color: "#0a0" },
    line: { width: 3, dash: "solid", shape: "hvh" },  // Also: shape=linear
  };
  const luckColor = adjustedRarity.map(rar =>
  {
    const r = Math.ceil(255 * Math.cos(Math.PI * rar / 2));
    const g = Math.ceil(255 * Math.sin(Math.PI * rar / 2));
    const col = `rgb(${r}, ${g}, 0)`;
    return col;
  });
  /*
  let luckTrace =
  {
    type: 'bar',
    x: ex.slice(1,13),
    y: luck,
    yaxis: "y2",
    width: 0.01,
    name: "luck",
    marker:
    {
      line: { color: "#69f", width: 3, },
    },
  };
  */
  // TODO Make zero line colored like the luck bar
  const zeroColor = [luckColor[0]].concat(luckColor).concat(luckColor.slice(-1));
  /*
  let zeroTrace =
  {
    x: ex,
    y: ex.map(x=>0),
    yaxis: "y2",
    mode: "lines",
    name: "luck", // Give name of luckTrace because hovering over luckTrace does nothing
    marker: { color: "#080" },
//    color: zeroColor,
    line: { width: 2, dash: "line" },
  };
  */
  let realLuckTrace =
  {
    type: 'bar',
    x: ex.slice(1,13),
    y: realLuck,
    yaxis: "y2",
    width: 0.2,
    marker: { color: luckColor, },
    name: "luck",
  };
  let rarityTrace =
  {
    type: "scatter",
    mode: "markers",
    x: ex.slice(1,13),
    y: rarity,
    yaxis: "y3",
    name: "rarity",
    marker:
    {
      color: "midnightblue",
      size: 9,
      line: { color: "white", width: 2 },
    },
  };
  let adjustedRarityTrace =
  {
    type: "scatter",
    mode: "markers",
    x: ex.slice(1,13),
    y: adjustedRarity,
    yaxis: "y3",
    name: "adjusted rarity",
    marker:
    {
      color: "red",
      size: 9,
      line: { color: "white", width: 2 },
    },
  };
  let lessTrace =
  {
    type: 'scatter',
    mode: "markers",
    x: ex.slice(1,13),
    y: lessChance,
    yaxis: "y3",
    name: "P(X <= x)",
    marker:
    {
      color: "lightgray",
      size: 4,
      line: { color: "black", width: 0.5 },
      symbol: "triangle-down",
    },
  };
  let lessTraceStrict =
  {
    type: 'scatter',
    mode: "markers",
    x: ex.slice(1,13),
    y: lessStrict,
    yaxis: "y3",
    name: "P(X < x)",
    marker:
    {
      color: "black",
      size: 4,
      line: { color: "lightgray", width: 0.5 },
      symbol: "triangle-down",
    },
  };
  let moreTrace =
  {
    type: 'scatter',
    mode: "markers",
    x: ex.slice(1,13),
    y: moreChance,
    yaxis: "y3",
    name: "p(X >= x)",
    marker:
    {
      color: "lightgray",
      size: 4,
      line: { color: "black", width: 0.5 },
      symbol: "triangle-up",
    },
  };
  let moreTraceStrict =
  {
    type: 'scatter',
    mode: "markers",
    x: ex.slice(1,13),
    y: moreStrict,
    yaxis: "y3",
    name: "p(X > x)",
    marker:
    {
      color: "black",
      size: 4,
      line: { color: "lightgray", width: 0.5 },
      symbol: "triangle-up",
    },
  };

  const layout =
  {
    hovermode: "closest",
    margin: {t:0, b: 15, l: 15, r: 25},
    showlegend: false,
    height: 300 / divideSizes,
    width: 300 / divideSizes,
    xaxis:
    {
      tickvals: [2,3,4,5,6,7,8,9,10,11,12],
      autorage: false,
    },
    yaxis:  // Rolls bar chart + expectation
    {
      dtick: Math.ceil(6 * n / 4),
      tick0: 0,
    },
    yaxis2: // Luck bar chart
    {
      overlaying: "y",
      side: "right",
//      dtick: 1,
      tick0: 0,
      showgrid: false,
//      autorage: false,
//      range: [-1, Math.max(1,maxLuck)], // [-1, 1] ?
    },
    yaxis3:
    {
      zeroline: false,
      overlaying: "y",
      side: "left",
      showgrid: false,
      showticklabels: false,
      autorange: false,
      range: [1, 0],
      //autorange: "reversed",
    },
    annotations:
    [
      {
        // Pointed at position
        x: minChance.number,
        y: minChance.chance,
        xref: "x",
        yref: "y3",

        // Text position
        ax: minChance.xoffset,
        ay: minChance.yoffset,
        axref: "x",
        ayref: "y3",

        text: `<b>${(minChance.chance * 100).toFixed(1)}%</b>`,
        bgcolor: "midnightblue",
        opacity: 0.8,
        showarrow: true,
        arrowhead: 6,
        arrowsize: 1,
        arrowwidth: 1,
        arrowcolor: "darkblue",
        font:
        {
          size: 12,
          color: "white",
          fontweight: "bold",
        },
      },
      {
        x: minAdjustedChance.number,
        y: minAdjustedChance.chance,
        xref: "x",
        yref: "y3",

        ax: minAdjustedChance.xoffset,
        ay: minAdjustedChance.yoffset,
        axref: "x",
        ayref: "y3",

        text: `<b>${(minAdjustedChance.chance * 100).toFixed(1)}%</b>`,
        bgcolor: "red",
        opacity: 0.8,
        showarrow: true,
        arrowhead: 6,
        arrowsize: 1,
        arrowwidth: 1,
        arrowcolor: "darkred",
        font:
        {
          size: 12,
          color: "white",
          fontweight: "bold",
        },
      },
    ],
  };

  const config = { displayModeBar: false };
  const data =
  [
    rollTrace, expTrace,
    /*zeroTrace,*/ realLuckTrace,
    lessTrace, moreTrace, lessTraceStrict, moreTraceStrict,
    adjustedRarityTrace, rarityTrace
  ];
  Plotly.newPlot(idToPlotInto, data, layout, config);
  console.debug("📊 Finished plotting rolls histogram into", `ID=${idToPlotInto}`);
}

//============================================================
// ?
//============================================================

if (configPlotTests === true)
{
    document.addEventListener('DOMContentLoaded', function()
    {
        if (document.getElementById(testPlotDiv                 ) !== null) plotTest();
        if (document.getElementById(testBubblePlotDivId) !== null) bubbleTest();
        if (document.getElementById(testHistogramPlotDivId) !== null) histogramTest();
    }, false);
}
