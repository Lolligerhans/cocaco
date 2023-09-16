// TODO
//  - Try multi-category plot
//  - Plot colour-coded histogram
//    - https://plotly.com/python/colorscales/ (imshow as workaround)
//    - bar plot relative mode + color interpolation (1 trace per roll)
//      - https://stackoverflow.com/questions/45857682/interpolation-of-colors
//      - https://plotly.com/javascript/bar-charts/

// https://plotly.com/javascript/plotly-fundamentals/

//============================================================
// Config
//============================================================

// Number of generated "samples"
const configSampleCount = 100;
const configPlotTests = true;

const divideSizes = 1.2

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
  const N = 20;
  log("Starting histogram test");
  let testRolls = new Array(N).fill(0);
  testRolls = testRolls.map(() => {return randomDie() + randomDie();});
  log("testRolls:", testRolls);

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

  var data = [trace];

  const c = N / 36;
  const layout =
  {
    hovermode: "closest",
    margin: {t:15, b: 15, l:15, r: 15},
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
    }
  };

  Plotly.newPlot(testHistogramPlotDivId, data, layout);

  // -----------------------------

  testLineX = [1.5,2,3,4,5,6,7,8,9,10,11,12,12.5];
  testLineY = [c,1*c,2*c,3*c,4*c,5*c,6*c,5*c,4*c,3*c,2*c,1*c,c];
//  testLineX = [2,7,12];
//  testLineY = [c, 6*c, c];
  let trace2 =
  {
    x: testLineX,
    y: testLineY,
    mode: "lines",
    name: "expectation",
    marker: { color: "#0a0" },
    line: { width: 2, dash: "solid", shape: "hvh" },
  };
  Plotly.addTraces(testHistogramPlotDivId, trace2);
}

//============================================================
// Plotters that fill an element by ID
//============================================================

// Plots current global ManyWorlds status variables into 'idToPlotInto'
function plotResourcesAsBubbles(idToPlotInto)
{
    let playerBubbles = [];
    const totalResources = generateFullNamesFromWorld(manyWorlds);   // FIXME what is happening here?
    for (let j = 0; j < players.length; ++j)
    {
        const player = players[j];
        for (let i = 0; i < resourceTypes.length; ++i)
        {
            const res = resourceTypes[i];
            const [tx, ty, tsize, topacity]  // Trace
                = generatePerCountBubbles(
                    players,
                    mwDistribution,
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
                marker: { color: player_colors[player],
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
        margin: {t: 20, b: 20, l: 20, r: 20},
        showlegend: false,
        height: 300 / divideSizes,
        width: 400 / divideSizes,
        xaxis:
        {
            tickvals: [1, 2, 3, 4, 5],
            ticktext: resourceTypes,
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
    log("Finished plotting current MW state into ID =", idToPlotInto);
}

function plotRollsAsHistogram(idToPlotInto)
{
  const ones = new Array(rolls.length).fill(1);
  const c = [255, 102, 51]; // Base colour
  const colo = rolls.map((_, i) =>
  {
    // Linearly interpolate towards base colour starting at black during
    // progression in data (moves in the game).
    const f = i / rolls.length;
    return `rgb(${Math.ceil(c[0]*f)},${Math.ceil(c[1]*f)},${Math.ceil(c[2]*f)})`;
  });
  let trace =
  {
    type: "bar",
    x: rolls,
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
  let data = [trace];
  const n = rolls.length / 36;
  const layout =
  {
    margin: {t:15, b: 15, l:15, r: 15},
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
      dtick: Math.ceil(6 * n / 4),
      tick0: 0,
    }
  };
  const config = { displayModeBar: false };
  Plotly.newPlot(idToPlotInto, data, layout, config);
  log("Finished plotting rolls histogram into ID = ", idToPlotInto);

  // Add expectation line
  ex = [1.5,2,3,4,5,6,7,8,9,10,11,12,12.5]; // Cover the bars at the ends
  ey = [n,n,2*n,3*n,4*n,5*n,6*n,5*n,4*n,3*n,2*n,n,n];
  let expTrace =
  {
    x: ex,
    y: ey,
    mode: "lines",
    name: "expectation",   // Hidden
    marker: { color: "#0a0" },
    line: { width: 2, dash: "solid", shape: "hvh" },  // Also: shape=linear
  };
  Plotly.addTraces(idToPlotInto, expTrace);
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
