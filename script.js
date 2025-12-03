Promise.all([d3.json("./nyt_keyword_graph.json"), d3.json("./nyt_keyword_timeseries.json")])
  .then(([graph, timeseriesData]) => {
    const { nodes, links } = graph;
    const lengthColor = d3.scaleSequential()
      .domain([0, d3.max(nodes, d => d["median_word_count"])]) // min 0, max length
      .interpolator(d3.interpolateRdYlBu);
    const sectionColor = d3.scaleOrdinal([
      "#771155", "#AA4488", "#CC99BB", "#114477", "#4477AA",
      "#77AADD", "#117777", "#44AAAA", "#77CCCC", "#117744",
      "#44AA77", "#88CCAA", "#777711", "#AAAA44", "#DDDD77",
      "#774411", "#AA7744", "#DDAA77", "#771122", "#AA4455",
      "#DD7788", "#332288", "#88CCEE", "#882255", "#661100"  // added 4
    ]);
    createSectionLegend(nodes, sectionColor)
    plotNodeLink(nodes, links, timeseriesData, sectionColor, lengthColor);

  });

function createLengthLegend(nodes, lengthColor) {
  const legend = d3.select("#legend");
  legend.html("");

  const width = 300;
  const height = 20;

  const minVal = 0;
  const maxVal = d3.max(nodes, d => d["median_word_count"]);

  const container = legend
    .append("div")
    .style("display", "flex")
    .style("justify-content", "center")
    .style("align-items", "center")
    .style("width", "350px")
    .style("height", "120px");

  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", 60);

  const defs = svg.append("defs");
  const gradient = defs.append("linearGradient")
    .attr("id", "length-gradient")
    .attr("x1", "0%")
    .attr("x2", "100%")
    .attr("y1", "0%")
    .attr("y2", "0%");

  const steps = d3.range(0, 1.01, 0.1);
  steps.forEach(t => {
    gradient.append("stop")
      .attr("offset", `${t * 100}%`)
      .attr("stop-color", lengthColor(minVal + t * (maxVal - minVal)));
  });

  svg.append("rect")
    .attr("x", 0)
    .attr("y", 20)
    .attr("width", width)
    .attr("height", height)
    .style("fill", "url(#length-gradient)");

  svg.append("text")
    .attr("x", 0)
    .attr("y", 55)
    .style("font-size", "11px")
    .text(minVal);

  svg.append("text")
    .attr("x", width)
    .attr("y", 55)
    .style("font-size", "11px")
    .attr("text-anchor", "end")
    .text(maxVal);

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", 10)
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .attr("text-anchor", "middle")
    .text("Median Article Length");
}


function createSectionLegend(nodes, sectionColor) {
  const legend = d3.select("#legend");
  legend.html("");

  const sections = [...new Set(nodes.map(d => d["top_section"]))].sort(d3.ascending);

  const container = legend
    .append("div")
    .attr("class", "legend-section");

  const items = container.selectAll("div.legend-item")
    .data(sections)
    .join("div")
    .attr("class", "legend-item");

  items.append("div")
    .style("width", "14px")
    .style("height", "14px")
    .style("background-color", d => sectionColor(d));

  items.append("span")
    .text(d => `${d}`);
}


currKeyword = undefined;
currSeries = undefined;
colorMode = "section";

const plotNodeLink = function (nodes, links, timeseriesData, sectionColor, lengthColor) {

  const simWidth = 2500;
  const simHeight = 2000;

  const svg = d3.select("#network")
    .append("svg")
    .attr("viewBox", [-simWidth / 2, -simHeight / 2, simWidth, simHeight])
    .attr("preserveAspectRatio", "xMidYMid meet");

  const container = svg.append("g");

  zoomBehavior = d3.zoom()
    .scaleExtent([0.01, 8])
    .on("zoom", (event) => {
      container.attr("transform", event.transform);
    })
  svg.call(zoomBehavior);

  const defaultScale = 0.04;
  const defaultTranslate = [0, 0];

  svg.call(
    zoomBehavior.transform,
    d3.zoomIdentity
      .translate(defaultTranslate[0], defaultTranslate[1])
      .scale(defaultScale)
  );
  const maxStrength = d3.max(links, d => d.strength);
  const maxDist = 20;
  const minDist = 20;

  const simulation = d3.forceSimulation(nodes)
    .force("node", d3.forceManyBody()
      .strength(-10).distanceMax(maxDist))
    .force("link", d3.forceLink(links)
      .id(d => d.keyword)
      .distance(d => { return maxDist - (d.strength / maxStrength * (maxDist - minDist)) })
      .strength(d => d.strength / maxStrength))
    .force("center", d3.forceCenter())
    .force("collision", d3.forceCollide()
      .radius(d => d["count"] + 20)
      //.iterations(40)
    )
    .on("tick", ticked);

  const link = container.append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke", "#999")
    .attr("stroke-width", d => 20 + 400 * d.strength / maxStrength)
    .attr("stroke-opacity", 0.3);

  const node = container.append("g")
    .selectAll("circle")
    .data(nodes)
    .join("circle")
    .attr("r", d => (d["count"] / 10))
    .attr("fill", d => sectionColor(d["top_section"]))
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 1.5)
    .on("click", (event, d) => {
      const keyword = d.keyword;
      currKeyword = keyword;
      const series = timeseriesData[keyword];
      currSeries = series;
      if (series) {
        showHistogram(series, keyword, colorMode, sectionColor, lengthColor);
      }
    });

  node.append("title").text(d => `${d.keyword}\n` +
    `Articles in Data: ${d['count']}\nDominant Section: ${d["top_section"]}\n` +
    `Median Article Word Count: ${d["median_word_count"]}`);

  d3.select("#color-select").on("change", function () {
    const value = this.value;
    colorMode = value

    node.transition().duration(600)
      .attr("fill", d =>
        value === "section"
          ? sectionColor(d["top_section"])
          : lengthColor(d["count"])
      );

    if (value === "section") {
      createSectionLegend(nodes, sectionColor);
    } else {
      createLengthLegend(nodes, lengthColor);
    }

    if (currSeries) {
      showHistogram(currSeries, currKeyword, colorMode, sectionColor, lengthColor);
    }
  });

  const labels = container.append("g")
    .selectAll("text")
    .data(nodes)
    .join("text")
    .text(d => d.keyword)
    .attr("font-size", d => 28 + d.count / 100)
    .attr("font-weight", "bold")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .attr("pointer-events", "none");

  function ticked() {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);

    labels
      .attr("x", d => d.x)
      .attr("y", d => d.y);
  }
};
function showHistogram(series, keyword, colorMode, sectionColor, lengthColor) {

  const container = d3.select("#histogram");
  const width = 500;
  const height = 260;
  const margin = { top: 30, right: 20, bottom: 40, left: 60 };

  let svg = container.select("svg").attr("viewBox", [0, 0, width, height])
    .attr("preserveAspectRatio", "xMidYMid meet");
  const isNew = svg.empty();

  if (isNew) {
    svg = container.append("svg")
      .attr("width", width)
      .attr("height", height).attr("viewBox", [0, 0, width, height])
      .attr("preserveAspectRatio", "xMidYMid meet");;

    svg.append("g").attr("class", "bars");
    svg.append("g").attr("class", "x-axis").attr("transform", `translate(0,${height - margin.bottom})`);
    svg.append("g").attr("class", "y-axis").attr("transform", `translate(${margin.left},0)`);
    svg.append("text")
      .attr("class", "hist-title")
      .attr("x", width / 2)
      .attr("y", margin.top - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "16px");
  }

  const x = d3.scaleBand()
    .domain(series.map(d => d.time))
    .range([margin.left, width - margin.right])
    .padding(0.1);

  const y = d3.scaleLinear()
    .domain([0, d3.max(series, d => d.proportion)])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const maxTicks = 6;
  const domain = x.domain();
  const step = Math.ceil(domain.length / maxTicks);
  const tickValues = domain.filter((d, i) => i % step === 0);

  svg.select(".x-axis")
    .transition()
    .duration(600)
    .call(
      d3.axisBottom(x)
        .tickValues(tickValues)
        .tickFormat(d => d)
    );

  svg.select(".y-axis")
    .transition()
    .duration(600)
    .call(d3.axisLeft(y));

  svg.select(".x-axis-label").remove();
  svg.append("text")
    .attr("class", "x-axis-label")
    .attr("x", width / 2)
    .attr("y", height - 5)
    .attr("text-anchor", "middle")
    .text("Time (YYYY-MM)");

  // Y-axis label
  svg.select(".y-axis-label").remove();
  svg.append("text")
    .attr("class", "y-axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", 20)
    .attr("text-anchor", "middle")
    .text("Proportion relative to all articles with the keyword");

  svg.select(".hist-title").remove();

  svg.append("text")
    .attr("class", "hist-title")
    .attr("x", width / 2)
    .attr("y", -30)
    .attr("text-anchor", "middle")
    .attr("font-weight", "bold")
    .attr("font-size", "16px")
    .selectAll("tspan")
    .data([`Distribution of the occurrences of`, `"${keyword}"`])
    .join("tspan")
    .attr("x", width / 2)
    .attr("dy", (d, i) => i === 0 ? 0 : "1.2em")
    .text(d => d);

  const bars = svg.select(".bars")
    .selectAll("rect")
    .data(series, d => d.time);

  const tooltip = d3.select("#bar-tooltip");

  bars.exit()
    .transition()
    .duration(300)
    .attr("y", y(0))
    .attr("height", 0)
    .remove();

  bars.transition()
    .duration(600)
    .attr("x", d => x(d.time))
    .attr("y", d => y(d.proportion))
    .attr("width", x.bandwidth())
    .attr("height", d => y(0) - y(d.proportion));

  bars.enter()
    .append("rect")
    .merge(bars)
    .attr("x", d => x(d.time))
    .attr("y", y(0))
    .attr("width", x.bandwidth())
    .attr("height", 0)
    .attr("fill", d => colorMode === "section"
      ? sectionColor(d["top_section"])
      : lengthColor(d["median_word_count"]))
    .transition()
    .duration(600)
    .attr("y", d => y(d.proportion))
    .attr("height", d => y(0) - y(d.proportion));

}