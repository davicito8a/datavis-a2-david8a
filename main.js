

const CSV_FILE = "cars.csv";   

const xAttr     = "Retail Price";
const yAttr     = "Horsepower(HP)";
const colorAttr = "Type";
const sizeAttr  = "City Miles Per Gallon";

const detailAttrs = [
  "Name",
  "Type",
  "Retail Price",
  "Horsepower(HP)",
  "Engine Size (l)",
  "City Miles Per Gallon",
  "Highway Miles Per Gallon"
];

// attributes to show in the starplot (global so drawStarplot can access)
const starAttrs = [
  "Retail Price",
  "Dealer Cost",
  "Horsepower(HP)",
  "Engine Size (l)",
  "City MPG",
  "Highway MPG"
];

let starDomains = {};

function sanitizeId(s) {
  return s.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// column names MUST match the CSV EXACTLY
const margin = { top: 40, right: 150, bottom: 60, left: 80 };
const width  = 800 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

// ==== create svg ====

const svg = d3.select("#chart")
  .append("svg")
    .attr("width",  width  + margin.left + margin.right)
    .attr("height", height + margin.top  + margin.bottom)
  .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

let selectedDot = null;

// ==== load csv (d3 v5, no autotype) ====

d3.csv(CSV_FILE, d => {
  // convert to number only what we need
  d[xAttr]    = +d[xAttr];
  d[yAttr]    = +d[yAttr];
  d[sizeAttr] = +d[sizeAttr];
  d["Engine Size (l)"] = +d["Engine Size (l)"];
  // the rest (name, type, etc.) remain as strings
  return d;
}).then(data => {
  console.log("csv columns:", data.columns);
  console.log("first row:", data[0]);

  // ==== scales ====
  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d[xAttr])).nice()
    .range([0, width]);

  const y = d3.scaleLinear()
    .domain(d3.extent(data, d => d[yAttr])).nice()
    .range([height, 0]);

  const size = d3.scaleSqrt()
    .domain(d3.extent(data, d => d[sizeAttr]))
    .range([3, 12]);

  const types = Array.from(new Set(data.map(d => d[colorAttr])));
  const color = d3.scaleOrdinal()
    .domain(types)
    .range(d3.schemeCategory10);

  // compute domains for normalization (0..1) into the global starDomains
  starDomains = {};
  starAttrs.forEach(a => {
    starDomains[a] = d3.extent(data, d => {
      const v = +d[a];
      return (isNaN(v) ? null : v);
    });
  });

  // tooltip for on-hover details (figure-ground + proximity)
  const tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  // ==== axes ====

  // gridlines (continuity) + x-axis
  svg.append("g")
    .attr("class", "grid")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x)
      .ticks(6)
      .tickSize(-height)
      .tickFormat("")
    );

  svg.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x).ticks(6));

  svg.append("text")
    .attr("class", "axis-label")
    .attr("x", width / 2)
    .attr("y", height + 40)
    .attr("text-anchor", "middle")
    .text(xAttr);

  // y-axis
  // y axis + subtle gridlines already added via x-axis grid
  svg.append("g")
    .call(d3.axisLeft(y).ticks(6));

  svg.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -60)
    .attr("text-anchor", "middle")
    .text(yAttr);

  // optional title
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .text("Car models: Horsepower vs. Price");

  // poits
  // create an html legend inside the details panel (keeps svg area clean)
  const detailsLegend = d3.select('#details-content').selectAll('.legend-html').data([1]);
  const legendWrap = detailsLegend.enter()
    .append('div')
      .attr('class', 'legend-html')
      .style('margin', '6px 0 12px 0')
    .merge(detailsLegend);

  // populate legend items
  const items = legendWrap.selectAll('.legend-item-html')
    .data(types);

  const itemsEnter = items.enter().append('div').attr('class', 'legend-item-html')
    .style('display', 'flex')
    .style('align-items', 'center')
    .style('gap', '8px')
    .style('margin', '4px 0');

  itemsEnter.append('span')
    .style('width', '12px')
    .style('height', '12px')
    .style('display', 'inline-block')
    .style('border-radius', '6px')
    .style('background', d => color(d));

  itemsEnter.append('span').text(d => d).style('color', '#234').style('font-size', '12px');

  items.exit().remove();

  // add viewBox to svg so it scales responsively
  d3.select('#chart').select('svg').attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
    .attr('preserveAspectRatio', 'xMinYMin meet');

  // points with hover and transition (continuity + figure focus)
  svg.append("g")
    .selectAll("circle")
    .data(data)
    .enter()
    .append("circle")
      .attr("class", "dot")
      .attr("cx", d => x(d[xAttr]))
      .attr("cy", d => y(d[yAttr]))
      .attr("r", 0)
      .attr("fill", d => color(d[colorAttr]))
      .attr("stroke", "rgba(0,0,0,0.18)")
      .attr("stroke-width", 1)
      .style("cursor", "pointer")
      .on("mouseover", function(d) {
        d3.select(this).raise();
        d3.select(this).transition().duration(120).attr("r", d => size(d[sizeAttr]) * 1.6).attr("stroke", "#111");
        tooltip.transition().duration(100).style("opacity", 0.95);
        tooltip.html(`<strong>${d[detailAttrs[0]]}</strong><br/>${xAttr}: ${d[xAttr]}<br/>${yAttr}: ${d[yAttr]}`)
          .style("left", (d3.event.pageX + 12) + "px")
          .style("top", (d3.event.pageY - 28) + "px");
      })
      .on("mouseout", function(d) {
        d3.select(this).transition().duration(120).attr("r", d => size(d[sizeAttr])).attr("stroke", "rgba(0,0,0,0.18)");
        tooltip.transition().duration(200).style("opacity", 0);
      })
      .on("click", function(d) {
        if (selectedDot) selectedDot.classed("selected", false);
        selectedDot = d3.select(this);
        selectedDot.classed("selected", true);
        console.log("Clicked data:", d);
        updateDetails(d);
      })
      .transition()
      .duration(700)
      .attr("r", d => size(d[sizeAttr]));

}).catch(err => {
  console.error("Error cargando CSV:", err);
});

// ==== detalles ====

function updateDetails(d) {
  // Fill the details table fields
  detailAttrs.forEach(attr => {
    const value = d && d[attr] !== undefined && d[attr] !== null && d[attr] !== "" ? d[attr] : 'N/A';
    const id = `d-${sanitizeId(attr)}`;
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });

  drawStarplot(d);
}

// Radar/starplot renderer
function drawStarplot(d) {
  const svg = d3.select('#starplot-svg');
  const w = +svg.attr('width');
  const h = +svg.attr('height');
  const cx = w / 2;
  const cy = h / 2 + 10;
  const radius = Math.min(w, h) * 0.29;

  svg.selectAll('*').remove();

  if (!d) {
    // placeholder text
    svg.append('text')
      .attr('x', cx)
      .attr('y', cy)
      .attr('text-anchor', 'middle')
      .attr('fill', '#888')
      .text('Select a point');
    return;
  }

  // build normalized values (0..1) for each starAttr
  const values = starAttrs.map((attr, i) => {
    const raw = +d[attr];
    const dom = starDomains[attr] || [0, 1];
    let norm = 0;
    if (!isNaN(raw) && dom[0] !== dom[1]) norm = (raw - dom[0]) / (dom[1] - dom[0]);
    return { attr, raw, norm };
  });

  const angleStep = (Math.PI * 2) / values.length;

  // draw radial axes and labels
  const axes = svg.append('g').attr('class', 'star-axes');
  values.forEach((v, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    axes.append('line')
      .attr('x1', cx).attr('y1', cy)
      .attr('x2', x).attr('y2', y)
      .attr('stroke', '#e0e6ea').attr('stroke-width', 1);

    const lx = cx + Math.cos(angle) * (radius + 18);
    const ly = cy + Math.sin(angle) * (radius + 18);
    axes.append('text')
      .attr('x', lx).attr('y', ly)
      .attr('text-anchor', Math.abs(Math.cos(angle)) < 0.1 ? 'middle' : (Math.cos(angle) > 0 ? 'start' : 'end'))
      .attr('dy', '0.35em')
      .attr('fill', '#234')
      .attr('font-size', 8)
      .text(v.attr.replace(/\s*\(.*\)/, ''));
  });

  // concentric rings for reference
  const rings = 3;
  for (let r = 1; r <= rings; r++) {
    svg.append('circle')
      .attr('cx', cx).attr('cy', cy)
      .attr('r', radius * (r / rings))
      .attr('fill', 'none')
      .attr('stroke', '#f0f4f7')
      .attr('stroke-width', 1);
  }

  // polygon points
  const pts = values.map((v, i) => {
    const angle = -Math.PI / 2 + i * angleStep;
    const r = Math.max(0, v.norm) * radius;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
  });

  // draw polygon
  svg.append('polygon')
    .attr('points', pts.map(p => p.join(',')).join(' '))
    .attr('fill', 'rgba(255,153,51,0.55)')
    .attr('stroke', 'rgba(200,100,20,0.9)')
    .attr('stroke-width', 1.5);

  // draw small circles on points
  svg.selectAll('.star-point')
    .data(pts)
    .enter()
    .append('circle')
      .attr('class', 'star-point')
      .attr('cx', d => d[0])
      .attr('cy', d => d[1])
      .attr('r', 3)
      .attr('fill', '#f59c2a')
      .attr('stroke', '#824e05')
      .attr('stroke-width', 0.8);
}
