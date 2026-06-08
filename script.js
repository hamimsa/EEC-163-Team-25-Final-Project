const format_order = ["Vinyl", "Tape", "CD / Disc", "Digital Download", "Streaming"];

// map chart labels to variables
const labels = {
  Vinyl: "Vinyl",
  Tape: "Tape",
  "CD / Disc": "CD / Disc",
  "Digital Download": "Digital Download",
  Streaming: "Streaming",
  total_cpi: "CPI Adjusted",
  total_raw: "Raw Revenue",
  ownership: "Ownership",
  access: "Access (Stream)"
};

// define color palette
const colors = {
  Vinyl: "#f97316",
  Tape: "#22c55e",
  "CD / Disc": "#facc15",
  "Digital Download": "#60a5fa",
  Streaming: "#c084fc",
  total_cpi: "#f8fafc",
  total_raw: "#64748b",
  ownership: "#f43f5e",
  access: "#c084fc",
  Other: "#334155"
};

let cached_data = null;
let resize_timer = null;

// group subformats into larger format catagories
function classify_format(raw_format) {
  const f = String(raw_format).toLowerCase();
  if (f.includes("lp/ep") || f.includes("vinyl")) return "Vinyl";
  if (f.includes("cassette") || f.includes("8 - track") || f.includes("other tapes") || f.includes("tape")) return "Tape";
  if (f.includes("cd") || f.includes("disc") || f.includes("sacd")) return "CD / Disc";
  if (f.includes("download") || f.includes("kiosk") || f.includes("ringtones") || f.includes("other digital")) return "Digital Download";
  if (f.includes("streaming") || f.includes("subscription") || f.includes("soundexchange") || f.includes("on-demand")) return "Streaming";
  return null;
}

// convert dollar strings to numbers
function to_numeric(v) {
  if (!v) return 0;
  return (Number.parseFloat(String(v).replace(/[^0-9.-]+/g, "")) / 1e9) || 0;
}

// restructure CSV data to a wide format usable by D3
async function load_story_data() {
  const response = await fetch("./music_data.csv");
  const text = await response.text();
  const raw = text.includes("\t") ? d3.tsvParse(text) : d3.csvParse(text);

  const headers = Object.keys(raw[0]);
  const year_col = headers.find(k => k.toLowerCase().includes("year"));
  const format_col = headers.find(k => k.toLowerCase().includes("format") && !k.toLowerCase().includes("format2"));
  const cpi_col = headers.find(k => k.toLowerCase().includes("cpi"));
  const raw_col = headers.find(k => k.toLowerCase() === "revenue" || k.toLowerCase() === "value");

  // group format rows by year
  const by_year = d3.group(raw, (d) => Number.parseInt(d[year_col], 10));
  const wide_data = [];

  by_year.forEach((rows, year) => {
    if (!year) return;
    
    const point = { Year: year, total_cpi: 0, total_raw: 0, ownership: 0, access: 0 };
    format_order.forEach(k => point[k] = 0);

    rows.forEach((r) => {
      if (r[format_col] && String(r[format_col]).toLowerCase() === "total") return;
      
      const category = classify_format(r[format_col]);
      if (category) {
        const cpi_val = to_numeric(r[cpi_col]);
        const raw_val = to_numeric(r[raw_col]);
        
        point[category] += cpi_val;
        point.total_cpi += cpi_val;
        point.total_raw += raw_val;
        
        if (category === "Streaming") point.access += cpi_val;
        else point.ownership += cpi_val;
      }
    });
    wide_data.push(point);
  });

  return wide_data.sort((a, b) => a.Year - b.Year);
}

// axis generation helper function for the charts
function draw_axes(svg, x_scale, y_scale, width, height, margin) {
  // grid lines
  svg.append("g").attr("class", "grid").attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x_scale).ticks(6).tickSize(-(height - margin.top - margin.bottom)).tickFormat(() => ""));
  svg.append("g").attr("class", "grid").attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y_scale).ticks(5).tickSize(-(width - margin.left - margin.right)).tickFormat(() => ""));
  
  // axis labels
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x_scale).ticks(6).tickFormat(d3.format("d")));
  svg.append("g").attr("class", "axis").attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y_scale).ticks(5).tickFormat(d => "$" + d));
}

// creates SVG taking into account window size
function create_svg(container_id, min_height = 340) {
  const container = document.getElementById(container_id);
  container.innerHTML = "";
  const width = Math.max(container.clientWidth, 320);
  const height = Math.max(min_height, 340);
  const svg = d3.select(container).append("svg").attr("width", width).attr("height", height);
  return { svg, width, height, container: d3.select(container) };
}

// create animation that reveals a line chart from left to right
function setup_animation(svg, container, paths, width, height, margin, duration = 4000) {
  const clip_id = `clip-${Math.random().toString(36).substr(2, 9)}`;
  const clip_rect = svg.append("clipPath").attr("id", clip_id).append("rect")
    .attr("x", margin.left).attr("y", margin.top).attr("width", 0).attr("height", height - margin.top - margin.bottom);
  
  paths.attr("clip-path", `url(#${clip_id})`);
  const delayed_elements = svg.selectAll(".delayed-label").attr("opacity", 0);
  const btn = container.append("button").attr("class", "play-overlay").text("Play Animation");

  btn.on("click", () => {
    btn.style("display", "none");
    clip_rect.transition().duration(duration).ease(d3.easeLinear).attr("width", width - margin.left - margin.right)
      .on("end", () => {
         delayed_elements.attr("opacity", 1);
         svg.selectAll(".delayed-interactivity").style("pointer-events", "all");
      });
  });
}

// attaches data tooltips to charts
function add_hover_tooltip(svg, container, width, height, margin, data, format_keys, is_delayed = false) {
  container.style("position", "relative");
  const tooltip = container.append("div").attr("class", "viz-tooltip").style("opacity", 0);
  const crosshair = svg.append("line").attr("y1", margin.top).attr("y2", height - margin.bottom)
    .attr("stroke", "#ffffff").attr("stroke-width", 1).attr("stroke-dasharray", "4,4").style("opacity", 0).style("pointer-events", "none");

  const x = d3.scaleLinear().domain(d3.extent(data, d => d.Year)).range([margin.left, width - margin.right]);
  const bisect_year = d3.bisector(d => d.Year).left;
  const overlay = svg.append("rect").attr("width", width).attr("height", height).style("fill", "none");

  if (is_delayed) overlay.attr("class", "delayed-interactivity").style("pointer-events", "none");
  else overlay.style("pointer-events", "all");

  overlay.on("mousemove", (event) => {
    const mouse_x = d3.pointer(event)[0];
    const x0 = x.invert(mouse_x);
    
    if (x0 < data[0].Year || x0 > data[data.length - 1].Year) {
      tooltip.style("opacity", 0);
      crosshair.style("opacity", 0);
      return;
    }

    const i = bisect_year(data, x0, 1);
    const d0 = data[i - 1];
    const d1 = data[i] || d0;
    const current_data = x0 - d0.Year > d1.Year - x0 ? d1 : d0;
    const current_x = x(current_data.Year);

    crosshair.attr("x1", current_x).attr("x2", current_x).style("opacity", 0.6);

    const sorted_keys = [...format_keys].sort((a, b) => current_data[b] - current_data[a]);
    let html = `<strong style="color: #fff; font-size: 1.1rem;">Year: ${current_data.Year}</strong><br/>
                <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px;">`;
    
    sorted_keys.forEach(key => {
        const val = current_data[key];
        if (val > 0) {
            html += `<div style="color: #e2e8f0; font-size: 0.95rem; display: flex; align-items: center;">
                       <span style="display:inline-block; width:10px; height:10px; background:${colors[key] || colors.Other}; margin-right:8px; border-radius:50%;"></span>
                       <span>${labels[key] || key}: <b style="color: #fff;">$${val.toFixed(2)}B</b></span>
                     </div>`;
        }
    });
    html += `</div>`;

    // boundary checking
    let tooltip_x = mouse_x + 20;
    if (tooltip_x + 160 > width) tooltip_x = mouse_x - 180; 

    tooltip.html(html).style("left", tooltip_x + "px").style("top", "20px").style("opacity", 1);
  });

  overlay.on("mouseout", () => {
    tooltip.style("opacity", 0);
    crosshair.style("opacity", 0);
  });
}


function render_hook_chart(data) {
  const c = create_svg("hook-chart");
  if (!c) return;
  const { svg, width, height, container } = c;
  const margin = { top: 20, right: 40, bottom: 40, left: 60 };
  
  const x = d3.scaleLinear().domain(d3.extent(data, d => d.Year)).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.total_cpi) * 1.1]).range([height - margin.bottom, margin.top]);
  
  draw_axes(svg, x, y, width, height, margin);

  const line_raw = d3.line().x(d => x(d.Year)).y(d => y(d.total_raw)).curve(d3.curveMonotoneX);
  const line_cpi = d3.line().x(d => x(d.Year)).y(d => y(d.total_cpi)).curve(d3.curveMonotoneX);

  const g = svg.append("g");
  g.append("path").datum(data).attr("fill", "none").attr("stroke", colors.total_raw).attr("stroke-width", 3).attr("stroke-dasharray", "6,6").attr("d", line_raw);
  g.append("path").datum(data).attr("fill", "none").attr("stroke", colors.total_cpi).attr("stroke-width", 4).attr("d", line_cpi);

  svg.append("text").attr("x", -height / 2).attr("y", 20).attr("transform", "rotate(-90)").attr("text-anchor", "middle").attr("fill", "#afbddf").attr("font-size", 12).text("Revenue (Billions USD)");

  const legend = svg.append("g").attr("transform", `translate(${margin.left + 20}, ${margin.top})`);
  const legend_data = [{ label: labels.total_cpi, color: colors.total_cpi, dash: "none" }, { label: labels.total_raw, color: colors.total_raw, dash: "6,6" }];

  legend.selectAll("g").data(legend_data).join("g").attr("transform", (d, i) => `translate(0, ${i * 24})`).call(grp => {
      grp.append("line").attr("x1", 0).attr("x2", 24).attr("y1", 4).attr("y2", 4).attr("stroke", d => d.color).attr("stroke-width", 3).attr("stroke-dasharray", d => d.dash);
      grp.append("text").attr("x", 34).attr("y", 9).attr("font-size", "13px").attr("font-weight", "bold").attr("fill", d => d.color).text(d => d.label);
  });

  setup_animation(svg, container, g, width, height, margin);
  add_hover_tooltip(svg, container, width, height, margin, data, ["total_cpi", "total_raw"], true);
}

function render_vinyl_rebirth(data) {
  const c = create_svg("vinyl-rebirth");
  if (!c) return;
  const { svg, width, height, container } = c;
  const margin = { top: 20, right: 40, bottom: 40, left: 60 };
  
  const x = d3.scaleLinear().domain(d3.extent(data, d => d.Year)).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => Math.max(d.Vinyl, d.Tape)) * 1.1]).range([height - margin.bottom, margin.top]);
  
  draw_axes(svg, x, y, width, height, margin);

  const line_vinyl = d3.line().x(d => x(d.Year)).y(d => y(d.Vinyl)).curve(d3.curveMonotoneX);
  const line_tape = d3.line().x(d => x(d.Year)).y(d => y(d.Tape)).curve(d3.curveMonotoneX);

  const g = svg.append("g");
  g.append("path").datum(data).attr("fill", "none").attr("stroke", colors.Vinyl).attr("stroke-width", 4).attr("d", line_vinyl);
  g.append("path").datum(data).attr("fill", "none").attr("stroke", colors.Tape).attr("stroke-width", 4).attr("d", line_tape);

  svg.append("text").attr("x", -height / 2).attr("y", 20).attr("transform", "rotate(-90)").attr("text-anchor", "middle").attr("fill", "#afbddf").attr("font-size", 12).text("Revenue (Billions USD)");

  const legend = svg.append("g").attr("transform", `translate(${margin.left + 20}, ${margin.top})`);
  const legend_data = [{ label: labels.Vinyl, color: colors.Vinyl }, { label: labels.Tape, color: colors.Tape }];

  legend.selectAll("g").data(legend_data).join("g").attr("transform", (d, i) => `translate(0, ${i * 24})`).call(grp => {
      grp.append("line").attr("x1", 0).attr("x2", 24).attr("y1", 4).attr("y2", 4).attr("stroke", d => d.color).attr("stroke-width", 4);
      grp.append("text").attr("x", 34).attr("y", 9).attr("font-size", "13px").attr("font-weight", "bold").attr("fill", d => d.color).text(d => d.label);
  });

  add_hover_tooltip(svg, container, width, height, margin, data, ["Vinyl", "Tape"]);
}

function render_cd_peak(data) {
  const c = create_svg("cd-peak");
  if (!c) return;
  const { svg, width, height, container } = c;
  const margin = { top: 20, right: 120, bottom: 40, left: 60 };
  
  const x = d3.scaleLinear().domain(d3.extent(data, d => d.Year)).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, d3.max(data, d => d.total_cpi) * 1.1]).range([height - margin.bottom, margin.top]);
  
  draw_axes(svg, x, y, width, height, margin);

  const area_total = d3.area().x(d => x(d.Year)).y0(y(0)).y1(d => y(d.total_cpi)).curve(d3.curveMonotoneX);
  const area_cd = d3.area().x(d => x(d.Year)).y0(y(0)).y1(d => y(d["CD / Disc"])).curve(d3.curveMonotoneX);

  const g = svg.append("g");
  g.append("path").datum(data).attr("fill", "rgba(248, 250, 252, 0.1)").attr("d", area_total);
  g.append("path").datum(data).attr("fill", "none").attr("stroke", colors.total_cpi).attr("stroke-width", 2).attr("stroke-dasharray", "4,4").attr("d", d3.line().x(d => x(d.Year)).y(d => y(d.total_cpi)).curve(d3.curveMonotoneX));
  g.append("path").datum(data).attr("fill", "rgba(250, 204, 21, 0.25)").attr("d", area_cd);
  g.append("path").datum(data).attr("fill", "none").attr("stroke", colors["CD / Disc"]).attr("stroke-width", 3).attr("d", d3.line().x(d => x(d.Year)).y(d => y(d["CD / Disc"])).curve(d3.curveMonotoneX));

  svg.append("text").attr("x", width - margin.right + 10).attr("y", y(data[data.length-1].total_cpi)).attr("fill", colors.total_cpi).attr("font-size", "12px").text("Total Industry");
  svg.append("text").attr("x", x(1999)).attr("y", y(data.find(d => d.Year === 1999)["CD / Disc"]) - 15).attr("text-anchor", "middle").attr("fill", colors["CD / Disc"]).attr("font-weight", "bold").attr("font-size", "14px").text("CD Revenue Peak");
  
  svg.append("line").attr("x1", x(1999)).attr("x2", x(1999)).attr("y1", y(0)).attr("y2", y(0) - 30).attr("stroke", "#fff").attr("stroke-dasharray", "2,2").attr("opacity", 0.4);
  svg.append("circle").attr("cx", x(1999)).attr("cy", y(0)).attr("r", 4).attr("fill", "#fff");
  svg.append("text").attr("x", x(1999)).attr("y", y(0) - 38).attr("text-anchor", "middle").attr("fill", "#e2e8f0").attr("font-size", "11px").text("Napster (1999)");

  svg.append("text").attr("x", -height / 2).attr("y", 20).attr("transform", "rotate(-90)").attr("text-anchor", "middle").attr("fill", "#afbddf").attr("font-size", 12).text("Revenue (Billions USD)");

  add_hover_tooltip(svg, container, width, height, margin, data, ["total_cpi", "CD / Disc"]);
}

function render_download_mountain(data) {
  const c = create_svg("download-mountain");
  if (!c) return;
  const { svg, width, height, container } = c;
  const margin = { top: 20, right: 80, bottom: 40, left: 60 };
  
  const filtered = data.filter(d => d.Year >= 1998 && d.Year <= 2025);
  const x = d3.scaleLinear().domain(d3.extent(filtered, d => d.Year)).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, d3.max(filtered, d => d["Digital Download"]) * 1.1]).range([height - margin.bottom, margin.top]);
  
  draw_axes(svg, x, y, width, height, margin);

  const area = d3.area().x(d => x(d.Year)).y0(y(0)).y1(d => y(d["Digital Download"])).curve(d3.curveMonotoneX);
  const line = d3.line().x(d => x(d.Year)).y(d => y(d["Digital Download"])).curve(d3.curveMonotoneX);

  const g = svg.append("g");
  g.append("path").datum(filtered).attr("fill", "rgba(96, 165, 250, 0.25)").attr("d", area);
  g.append("path").datum(filtered).attr("fill", "none").attr("stroke", colors["Digital Download"]).attr("stroke-width", 4).attr("d", line);

  svg.append("text").attr("x", x(2012)).attr("y", y(filtered.find(d => d.Year === 2012)["Digital Download"]) - 15).attr("text-anchor", "middle").attr("fill", colors["Digital Download"]).attr("font-weight", "bold").attr("font-size", "14px").text("Downloads Peak");
  
  svg.append("line").attr("x1", x(2003)).attr("x2", x(2003)).attr("y1", y(0)).attr("y2", y(0) - 30).attr("stroke", "#fff").attr("stroke-dasharray", "2,2").attr("opacity", 0.4);
  svg.append("circle").attr("cx", x(2003)).attr("cy", y(0)).attr("r", 4).attr("fill", "#fff");
  svg.append("text").attr("x", x(2003)).attr("y", y(0) - 38).attr("text-anchor", "middle").attr("fill", "#e2e8f0").attr("font-size", "11px").text("iTunes Store (2003)");
  
  svg.append("text").attr("x", -height / 2).attr("y", 20).attr("transform", "rotate(-90)").attr("text-anchor", "middle").attr("fill", "#afbddf").attr("font-size", 12).text("Revenue (Billions USD)");

  add_hover_tooltip(svg, container, width, height, margin, filtered, ["Digital Download"]);
}

function render_ownership_access(data) {
  const c = create_svg("ownership-access");
  if (!c) return;
  const { svg, width, height, container } = c;
  const margin = { top: 20, right: 40, bottom: 40, left: 60 };
  
  const filtered = data.filter(d => d.Year >= 2000);
  const x = d3.scaleLinear().domain(d3.extent(filtered, d => d.Year)).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, d3.max(filtered, d => Math.max(d.ownership, d.access)) * 1.1]).range([height - margin.bottom, margin.top]);
  
  draw_axes(svg, x, y, width, height, margin);

  const line_own = d3.line().x(d => x(d.Year)).y(d => y(d.ownership)).curve(d3.curveMonotoneX);
  const line_access = d3.line().x(d => x(d.Year)).y(d => y(d.access)).curve(d3.curveMonotoneX);

  const g = svg.append("g");
  g.append("path").datum(filtered).attr("fill", "none").attr("stroke", colors.ownership).attr("stroke-width", 4).attr("d", line_own);
  g.append("path").datum(filtered).attr("fill", "none").attr("stroke", colors.access).attr("stroke-width", 4).attr("d", line_access);

  svg.append("text").attr("x", -height / 2).attr("y", 20).attr("transform", "rotate(-90)").attr("text-anchor", "middle").attr("fill", "#afbddf").attr("font-size", 12).text("Revenue (Billions USD)");

  const legend = svg.append("g").attr("transform", `translate(${margin.left + 20}, ${margin.top})`);
  const legend_data = [{ label: labels.ownership, color: colors.ownership }, { label: labels.access, color: colors.access }];

  legend.selectAll("g").data(legend_data).join("g").attr("transform", (d, i) => `translate(0, ${i * 24})`).call(grp => {
      grp.append("line").attr("x1", 0).attr("x2", 24).attr("y1", 4).attr("y2", 4).attr("stroke", d => d.color).attr("stroke-width", 4);
      grp.append("text").attr("x", 34).attr("y", 9).attr("font-size", "13px").attr("font-weight", "bold").attr("fill", d => d.color).text(d => d.label);
  });

  const timeline_events = [
    { year: 2008, text: "Spotify Launch (2008)", offset: 30 },
    { year: 2015, text: "Mobile Streaming Scale (2015)", offset: 60 },
    { year: 2020, text: "Subscription Mainstream (2020)", offset: 30 }
  ];

  timeline_events.forEach(e => {
    svg.append("line").attr("x1", x(e.year)).attr("x2", x(e.year)).attr("y1", y(0)).attr("y2", y(0) - e.offset).attr("stroke", "#fff").attr("stroke-dasharray", "2,2").attr("opacity", 0.4);
    svg.append("circle").attr("cx", x(e.year)).attr("cy", y(0)).attr("r", 4).attr("fill", "#fff");
    svg.append("text").attr("x", x(e.year)).attr("y", y(0) - e.offset - 8).attr("text-anchor", "middle").attr("fill", "#e2e8f0").attr("font-size", "11px").text(e.text);
  });

  add_hover_tooltip(svg, container, width, height, margin, filtered, ["ownership", "access"]);
}

function render_streaming_dominance(data) {
  const c = create_svg("streaming-dominance", 340);
  if (!c) return;
  const { svg, width, height, container } = c;
  
  const target_data = data.find(d => d.Year === 2019);
  if (!target_data) return;

  const total = d3.sum(format_order, k => target_data[k]);
  const share_data = format_order.map(label => ({
    label,
    value: target_data[label],
    pct: total > 0 ? (target_data[label] / total) * 100 : 0
  })).filter(d => d.value > 0);

  const cx = width * 0.38;
  const cy = height / 2;
  const pie_radius = Math.min(width * 0.34, height * 0.38);
  const inner_radius = pie_radius * 0.58;

  const pie = d3.pie().value(d => d.value).sort(null);
  const arc = d3.arc().innerRadius(inner_radius).outerRadius(pie_radius);
  const hover_arc = d3.arc().innerRadius(inner_radius).outerRadius(pie_radius * 1.06);

  const chart = svg.append("g").attr("transform", `translate(${cx}, ${cy})`);
  const donut_data = pie(share_data);

  const slices = chart.selectAll("path.slice").data(donut_data).join("path")
    .attr("class", "slice").attr("fill", d => colors[d.data.label])
    .attr("stroke", "#0a0b10").attr("stroke-width", 2).attr("d", arc).style("cursor", "pointer");

  container.style("position", "relative");
  const tooltip = container.append("div").attr("class", "viz-tooltip").style("opacity", 0);

  slices.on("mousemove", function(event, d) {
    // expand on hover
    d3.select(this).transition().duration(200).attr("d", hover_arc); 
    
    let html = `<strong style="color: #fff; font-size: 1.1rem;">${labels[d.data.label] || d.data.label}</strong><br/>
                <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px;">
                  <div style="color: #e2e8f0; font-size: 0.95rem; display: flex; align-items: center;">
                     <span style="display:inline-block; width:10px; height:10px; background:${colors[d.data.label]}; margin-right:8px; border-radius:50%;"></span>
                     <span>Revenue: <b style="color: #fff;">$${d.data.value.toFixed(2)}B</b></span>
                  </div>
                  <div style="color: #e2e8f0; font-size: 0.95rem; padding-left: 18px;">
                     Market Share: <b style="color: #fff;">${d.data.pct.toFixed(1)}%</b>
                  </div>
                </div>`;
                
    const bounds = container.node().getBoundingClientRect();
    let tooltip_x = event.clientX - bounds.left + 20;
    let tooltip_y = event.clientY - bounds.top - 20;
    if (tooltip_x + 180 > width) tooltip_x = event.clientX - bounds.left - 180;
    
    tooltip.html(html).style("left", tooltip_x + "px").style("top", tooltip_y + "px").style("opacity", 1);
  }).on("mouseout", function() {
    // shrink when hover ends
    d3.select(this).transition().duration(200).attr("d", arc);
    tooltip.style("opacity", 0);
  });

  const streaming_pct = share_data.find(d => d.label === "Streaming")?.pct ?? 0;
  chart.append("text").attr("text-anchor", "middle").attr("y", -5).attr("font-size", "24px").attr("font-weight", "bold").attr("fill", "#fff").text(`${streaming_pct.toFixed(0)}%`);
  chart.append("text").attr("text-anchor", "middle").attr("y", 15).attr("font-size", "12px").attr("fill", "#afbddf").text(`Streaming in 2019`);

  const legend = svg.append("g").attr("transform", `translate(${width * 0.75}, ${height * 0.2})`);
  share_data.forEach((d, i) => {
    const g = legend.append("g").attr("transform", `translate(0, ${i * 25})`);
    g.append("rect").attr("width", 12).attr("height", 12).attr("rx", 2).attr("fill", colors[d.label]);
    g.append("text").attr("x", 20).attr("y", 10).attr("fill", "#ded6ff").attr("font-size", "12px").text(`${labels[d.label]} (${d.pct.toFixed(1)}%)`);
  });
}

// stacked area chart
function render_stacked_area(data) {
  const c = create_svg("stacked-area");
  if (!c) return;
  const { svg, width, height, container } = c;
  const margin = { top: 30, right: 120, bottom: 40, left: 60 };
  
  const series = d3.stack().keys(format_order)(data);
  const x = d3.scaleLinear().domain(d3.extent(data, d => d.Year)).range([margin.left, width - margin.right]);
  const y = d3.scaleLinear().domain([0, d3.max(series, s => d3.max(s, d => d[1]))]).range([height - margin.bottom, margin.top]);

  draw_axes(svg, x, y, width, height, margin);

  const area = d3.area().x(d => x(d.data.Year)).y0(d => y(d[0])).y1(d => y(d[1])).curve(d3.curveMonotoneX);

  const paths = svg.append("g").selectAll("path").data(series).join("path").attr("fill", d => colors[d.key]).attr("opacity", 0.85).attr("d", area);

  const clip_id = `clip-stacked-${Math.random().toString(36).substr(2, 9)}`;
  const clip_rect = svg.append("clipPath").attr("id", clip_id).append("rect")
    .attr("x", margin.left).attr("y", margin.top).attr("width", 0).attr("height", height - margin.top - margin.bottom);
  paths.attr("clip-path", `url(#${clip_id})`);

  const marker = svg.append("line").attr("y1", margin.top).attr("y2", height - margin.bottom).attr("stroke", "#f8fbff").attr("stroke-width", 1.5).attr("opacity", 0);
  const era_label = svg.append("text").attr("x", margin.left + 10).attr("y", margin.top + 25).attr("font-size", 18).attr("font-weight", "bold").text("");
  const year_label = svg.append("text").attr("x", width - margin.right - 12).attr("y", margin.top + 34).attr("text-anchor", "end").attr("font-size", 24).attr("font-weight", "800").attr("fill", "#eef2ff").attr("opacity", 0.82).text("");

  const replay_button = container.append("button").attr("class", "replay-btn").text("Play 50-Year History");

  function run_stacked_animation() {
    clip_rect.interrupt();
    replay_button.style("display", "none");
    marker.attr("opacity", 0.6);

    clip_rect.attr("width", 0);
    const start_year = d3.min(data, d => d.Year);
    const end_year = d3.max(data, d => d.Year);
    
    // animate the clip path from left to right and dynamically update the year and era labels
    clip_rect.transition().duration(8000).ease(d3.easeLinear)
      .attrTween("width", function() {
        const total_width = width - margin.left - margin.right;
        return function(t) {
          const current_year = Math.round(start_year + t * (end_year - start_year));
          const current_x = x(current_year);
          
          year_label.text(current_year);
          marker.attr("x1", current_x).attr("x2", current_x);

          if (current_year < 1980) era_label.text("Vinyl Era").attr("fill", colors.Vinyl);
          else if (current_year < 1990) era_label.text("Tape Era").attr("fill", colors.Tape);
          else if (current_year < 2005) era_label.text("CD Dominance").attr("fill", colors["CD / Disc"]);
          else if (current_year < 2015) era_label.text("Digital Transition").attr("fill", colors["Digital Download"]);
          else era_label.text("Streaming Era").attr("fill", colors.Streaming);

          return t * total_width;
        };
      })
      .on("end", () => {
        replay_button.text("↻ Replay").style("display", "inline-flex");
        marker.attr("opacity", 0);
      });
  }

  replay_button.on("click", run_stacked_animation);

  svg.append("text").attr("x", -height / 2).attr("y", 20).attr("transform", "rotate(-90)").attr("text-anchor", "middle").attr("fill", "#afbddf").attr("font-size", 12).text("Revenue (Billions USD)");

  const legend = svg.append("g").attr("transform", `translate(${width - margin.right + 20}, ${margin.top})`);
  legend.selectAll("g").data(format_order.slice().reverse()).join("g").attr("transform", (d, i) => `translate(0, ${i * 24})`).call(g => {
      g.append("rect").attr("width", 14).attr("height", 14).attr("fill", d => colors[d]);
      g.append("text").attr("x", 20).attr("y", 12).attr("font-size", 12).attr("fill", "#dbe6ff").text(d => d);
  });
}

// build interactive dashboard
function render_dashboard(data) {
  const controls = d3.select("#controls");
  controls.html("");
  const selected = new Set(["Vinyl", "CD / Disc", "Streaming"]);
  
  // create buttons for the formats
  format_order.forEach((f) => {
    controls.append("button").attr("class", `chip ${selected.has(f) ? "active" : ""}`).text(labels[f]).on("click", function () {
        if (selected.has(f)) selected.delete(f);
        else selected.add(f);
        d3.select(this).classed("active", selected.has(f));
        draw(selected); 
      });
  });

  const c = create_svg("interactive-dashboard", 400); 
  if (!c) return;
  const { svg, width, height, container } = c;
  
  const line_chart_width = width * 0.65;
  const pie_chart_width = width * 0.35;
  const margin = { top: 20, right: 30, bottom: 40, left: 60 };
  
  container.style("position", "relative");

  const tooltip = container.append("div").attr("class", "viz-tooltip").style("opacity", 0);
  
  const x = d3.scaleLinear().domain(d3.extent(data, d => d.Year)).range([margin.left, line_chart_width - margin.right]);
  const y = d3.scaleLinear().range([height - margin.bottom, margin.top]);
  
  const x_axis_group = svg.append("g").attr("class", "axis").attr("transform", `translate(0,${height - margin.bottom})`);
  const y_axis_group = svg.append("g").attr("class", "axis").attr("transform", `translate(${margin.left},0)`);
  const y_grid_group = svg.append("g").attr("class", "grid").attr("transform", `translate(${margin.left},0)`);
  const lines_group = svg.append("g"); 

  svg.append("text").attr("x", -height / 2).attr("y", 20).attr("transform", "rotate(-90)").attr("text-anchor", "middle").attr("fill", "#afbddf").attr("font-size", 12).text("Revenue (Billions USD)");

  const crosshair = svg.append("line").attr("y1", margin.top).attr("y2", height - margin.bottom)
    .attr("stroke", "#ffffff").attr("stroke-width", 1).attr("stroke-dasharray", "4,4").style("opacity", 0);

  const overlay = svg.append("rect").attr("width", line_chart_width).attr("height", height).style("fill", "none").style("pointer-events", "all");

  const pie_radius = Math.min(pie_chart_width, height - margin.top - margin.bottom) / 2.2;
  const pie_group = svg.append("g").attr("transform", `translate(${line_chart_width + pie_chart_width / 2 - margin.right + 20}, ${height / 2})`);
    
  const pie_generator = d3.pie().value(d => d.value).sort(null);
  const arc_generator = d3.arc().innerRadius(pie_radius * 0.6).outerRadius(pie_radius);
  
  const pie_center_year = pie_group.append("text").attr("text-anchor", "middle").attr("y", -5).attr("font-size", "24px").attr("font-weight", "bold").attr("fill", "#fff");
  const pie_center_total = pie_group.append("text").attr("text-anchor", "middle").attr("y", 15).attr("font-size", "12px").attr("fill", "#afbddf");

  // redraw line chart when button is toggled
  function draw(active_formats) {
    const entries = [...active_formats];
    
    // adjust the y-axis based on selected buttons
    const max_val = entries.length > 0 ? d3.max(data, d => d3.max(entries, k => d[k])) : 1;
    y.domain([0, max_val * 1.1]); 

    x_axis_group.call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")));
    y_axis_group.call(d3.axisLeft(y).ticks(5).tickFormat(d => "$" + d));
    y_grid_group.call(d3.axisLeft(y).ticks(5).tickSize(-(line_chart_width - margin.left - margin.right)).tickFormat(() => ""));

    const group = lines_group.selectAll("path.dashboard-line").data(entries, d => d);
    group.join(
      enter => enter.append("path").attr("class", "dashboard-line").attr("fill", "none").attr("stroke-width", 3).attr("stroke", d => colors[d]).attr("d", key => d3.line().x(d => x(d.Year)).y(d => y(d[key])).curve(d3.curveMonotoneX)(data)),
      update => update.attr("stroke", d => colors[d]).attr("d", key => d3.line().x(d => x(d.Year)).y(d => y(d[key])).curve(d3.curveMonotoneX)(data)),
      exit => exit.remove()
    );
    
    update_donut(data[data.length - 1], entries);
  }

  // update donut chart based on year selected
  function update_donut(year_data, active_formats) {
    let active_sum = 0;
    const donut_data = [];
    
    active_formats.forEach(key => {
      const val = year_data[key];
      if (val > 0) {
        donut_data.push({ label: key, value: val, color: colors[key] });
        active_sum += val;
      }
    });
    
    // calculate "other formats" slice
    const other_value = year_data.total_raw - active_sum;
    if (other_value > 0.01) donut_data.push({ label: "Other Formats", value: other_value, color: colors.Other });
    
    pie_center_year.text(year_data.Year);
    pie_center_total.text(`Total: $${year_data.total_raw.toFixed(1)}B`);

    const slices = pie_group.selectAll("path.slice").data(pie_generator(donut_data), d => d.data.label)
      .join(
        enter => enter.append("path").attr("class", "slice").attr("fill", d => d.data.color).attr("d", arc_generator).attr("stroke", "#0a0b10").attr("stroke-width", 2).style("cursor", "pointer"),
        update => update.attr("d", arc_generator),
        exit => exit.remove()
      );

    slices
      .on("mousemove", function(event, d) {
        const total = d3.sum(donut_data, p => p.value);
        const pct = ((d.data.value / total) * 100).toFixed(1);
        
        let html = `<strong style="color: #fff; font-size: 1.1rem;">${labels[d.data.label] || d.data.label}</strong><br/>
                    <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px;">
                      <div style="color: #e2e8f0; font-size: 0.95rem; display: flex; align-items: center;">
                         <span style="display:inline-block; width:10px; height:10px; background:${d.data.color}; margin-right:8px; border-radius:50%;"></span>
                         <span>Revenue: <b style="color: #fff;">$${d.data.value.toFixed(2)}B</b></span>
                      </div>
                      <div style="color: #e2e8f0; font-size: 0.95rem; padding-left: 18px;">
                         Market Share: <b style="color: #fff;">${pct}%</b>
                      </div>
                    </div>`;
                    
        const bounds = container.node().getBoundingClientRect();
        let tooltip_x = event.clientX - bounds.left + 20;
        let tooltip_y = event.clientY - bounds.top - 20;
        
        if (tooltip_x + 180 > width) tooltip_x = event.clientX - bounds.left - 180;
        
        tooltip.html(html).style("left", tooltip_x + "px").style("top", tooltip_y + "px").style("opacity", 1);
        d3.select(this).transition().duration(200).attr("d", hover_arc); 
      })
      .on("mouseout", function() {
        tooltip.style("opacity", 0);
        d3.select(this).transition().duration(200).attr("d", arc); 
      });
  }

  draw(selected);

  const bisect_year = d3.bisector(d => d.Year).left;

  // brushing logic
  const drag_scrubber = d3.drag()
    .on("start drag", (event) => {
      if (selected.size === 0) return; 

      const clamped_x = Math.max(margin.left, Math.min(event.x, line_chart_width - margin.right));
      const x0 = x.invert(clamped_x);

      if (x0 < data[0].Year || x0 > data[data.length - 1].Year) return;

      const i = bisect_year(data, x0, 1);
      const d0 = data[i - 1];
      const d1 = data[i] || d0;
      const current_data = x0 - d0.Year > d1.Year - x0 ? d1 : d0;
      const current_x = x(current_data.Year);

      crosshair.attr("x1", current_x).attr("x2", current_x).style("opacity", 0.6);

      update_donut(current_data, [...selected]);

      const active_sorted = [...selected].sort((a, b) => current_data[b] - current_data[a]);
      let html = `<strong style="color: #fff; font-size: 1.1rem;">Year: ${current_data.Year}</strong><br/>
                  <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px;">`;
      
      active_sorted.forEach(key => {
          const val = current_data[key];
          if (val > 0) {
              html += `<div style="color: #e2e8f0; font-size: 0.95rem; display: flex; align-items: center;">
                         <span style="display:inline-block; width:10px; height:10px; background:${colors[key]}; margin-right:8px; border-radius:50%;"></span>
                         <span>${labels[key]}: <b style="color: #fff;">$${val.toFixed(2)}B</b></span>
                       </div>`;
          }
      });
      html += `</div>`;

      let tooltip_x = clamped_x + 20;
      if (tooltip_x + 160 > line_chart_width) tooltip_x = clamped_x - 180; 

      tooltip.html(html).style("left", tooltip_x + "px").style("top", "20px").style("opacity", 1);
    });

  overlay.style("cursor", "ew-resize").call(drag_scrubber);
}

// load data and render components
async function init() {
  cached_data = await load_story_data();
  render_all_charts(cached_data);
  
  const start_btn = document.getElementById("start-btn");
  if (start_btn) {
    start_btn.addEventListener("click", (e) => {
      e.preventDefault();
      document.body.classList.remove("scroll-locked");
      document.querySelector("#section-hook").scrollIntoView({ behavior: "smooth" });
    });
  }

  // add delay to rerendering visualiztions when resizing window
  window.addEventListener("resize", () => {
    if (!cached_data) return;
    clearTimeout(resize_timer);
    resize_timer = setTimeout(() => render_all_charts(cached_data), 180);
  });
}

window.addEventListener("DOMContentLoaded", init);

// main grouped render function
function render_all_charts(data) {
  if (!data || data.length === 0) return;
  render_hook_chart(data);
  render_vinyl_rebirth(data);
  render_cd_peak(data);
  render_download_mountain(data);
  render_ownership_access(data);
  render_streaming_dominance(data); 
  render_stacked_area(data);
  render_dashboard(data);
}