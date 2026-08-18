(function (root) {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const U = root.ConlluUtils;
  let renderSerial = 0;

  function svgEl(name, attrs) {
    const node = document.createElementNS(SVG_NS, name);
    if (attrs) {
      Object.entries(attrs).forEach(([key, value]) => {
        if (value !== undefined && value !== null) node.setAttribute(key, String(value));
      });
    }
    return node;
  }

  function measureText(text, font) {
    const canvas = measureText.canvas || (measureText.canvas = document.createElement("canvas"));
    const ctx = canvas.getContext("2d");
    if (!ctx) return String(text || "").length * 8;
    ctx.font = font;
    return ctx.measureText(String(text || "")).width;
  }

  function featureValue(token, feature) {
    if (feature === "FORM") return token.form;
    if (feature === "LEMMA") return token.lemma === "_" ? "" : token.lemma;
    if (feature === "UPOS") return token.upos === "_" ? "" : token.upos;
    if (feature === "XPOS") return token.xpos === "_" ? "" : token.xpos;
    if (feature.startsWith("FEATS.")) return token.feats[feature.slice(6)] || "";
    if (feature.startsWith("MISC.")) return token.misc[feature.slice(5)] || "";
    return "";
  }

  function classForFeature(feature) {
    return `feature-${feature.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase()}`;
  }

  function buildLayout(tokens, features) {
    const extraFeatures = features.filter((f) => f !== "FORM");
    const cells = tokens.map((token) => {
      const values = [token.form, ...extraFeatures.map((f) => featureValue(token, f))];
      const widths = values.map((value, index) => {
        const font = index === 0 ? "600 17px Arial" : "12px Arial";
        return measureText(value || "", font);
      });
      return {
        token,
        values,
        width: Math.max(64, ...widths.map((w) => w + 28)),
      };
    });

    let cursor = 24;
    cells.forEach((cell) => {
      cell.x = cursor + cell.width / 2;
      cursor += cell.width;
    });

    const byId = new Map(cells.map((cell) => [cell.token.id, cell]));
    let maxLift = 64;
    for (const cell of cells) {
      const token = cell.token;
      if (token.head === 0) {
        maxLift = Math.max(maxLift, 86);
        continue;
      }
      const head = byId.get(token.head);
      if (!head) continue;
      const span = Math.max(1, Math.abs(token.id - token.head));
      maxLift = Math.max(maxLift, 34 + Math.min(250, Math.pow(span, 0.82) * 25));
    }

    const top = 28;
    const arcBaseY = top + maxLift + 22;
    const formY = arcBaseY + 31;
    const featureGap = 17;
    const bottom = 26;
    const height = formY + Math.max(0, extraFeatures.length) * featureGap + bottom;
    const width = Math.max(320, cursor + 24);

    return { cells, byId, width, height, top, arcBaseY, formY, featureGap, maxLift, extraFeatures };
  }

  function addLabel(svg, text, x, y, className) {
    const label = String(text || "");
    const w = Math.max(18, measureText(label, "italic 12px Arial") + 10);
    const rect = svgEl("rect", {
      x: x - w / 2,
      y: y - 12,
      width: w,
      height: 16,
      rx: 4,
      class: "dep-label-bg",
    });
    const txt = svgEl("text", {
      x,
      y,
      "text-anchor": "middle",
      class: className || "dep-label",
    });
    txt.textContent = label;
    svg.append(rect, txt);
  }

  function renderSentence(block, features, options) {
    if (!U) throw new Error("ConlluUtils não está disponível.");
    const parsed = U.parseSyntacticTokens(block);
    if (!parsed.tokens.length) throw new Error("A sentença não contém tokens sintáticos renderizáveis.");

    const layout = buildLayout(parsed.tokens, features);
    const serial = ++renderSerial;
    const markerId = `arrowhead-${serial}`;
    const svg = svgEl("svg", {
      xmlns: SVG_NS,
      width: Math.ceil(layout.width),
      height: Math.ceil(layout.height),
      viewBox: `0 0 ${Math.ceil(layout.width)} ${Math.ceil(layout.height)}`,
      role: "img",
      "aria-label": `Árvore de dependência: ${parsed.text || "sentença"}`,
      class: "dependency-tree-svg",
      preserveAspectRatio: "xMinYMin meet",
    });

    const title = svgEl("title");
    title.textContent = parsed.text || "Árvore de dependência";
    svg.appendChild(title);

    const style = svgEl("style");
    style.textContent = `
      .dep-arc{fill:none;stroke:#20242b;stroke-width:1.25}
      .dep-root{fill:none;stroke:#20242b;stroke-width:1.25}
      .dep-arrow{fill:#20242b}
      .dep-label{font:italic 12px Arial,sans-serif;fill:#501d7d}
      .dep-label-bg{fill:#fff;fill-opacity:.94}
      .token-form{font:600 17px Arial,sans-serif;fill:#111827}
      .token-feature{font:12px Arial,sans-serif;fill:#687386}
      .feature-upos{fill:#501d7d;font-weight:600}
      .feature-lemma{fill:#374151;font-style:italic}
      .token-id{font:10px Arial,sans-serif;fill:#9aa3b2}
    `;
    svg.appendChild(style);

    const defs = svgEl("defs");
    const marker = svgEl("marker", {
      id: markerId,
      markerWidth: 8,
      markerHeight: 8,
      refX: 7,
      refY: 4,
      orient: "auto",
      markerUnits: "userSpaceOnUse",
    });
    marker.appendChild(svgEl("path", { d: "M0,0 L8,4 L0,8 z", class: "dep-arrow" }));
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Dependencies are drawn before token labels so the words remain crisp on top.
    for (const cell of layout.cells) {
      const token = cell.token;
      const depX = cell.x;
      const endY = layout.arcBaseY - 5;

      if (token.head === 0) {
        const rootTop = layout.top + 18;
        svg.appendChild(svgEl("path", {
          d: `M ${depX} ${rootTop + 9} L ${depX} ${endY}`,
          class: "dep-root",
          "marker-end": `url(#${markerId})`,
        }));
        addLabel(svg, token.deprel || "root", depX, rootTop, "dep-label");
        continue;
      }

      const headCell = layout.byId.get(token.head);
      if (!headCell) continue;
      const headX = headCell.x;
      const span = Math.max(1, Math.abs(token.id - token.head));
      const lift = 34 + Math.min(250, Math.pow(span, 0.82) * 25);
      const peakY = layout.arcBaseY - lift;
      const path = `M ${headX} ${endY} C ${headX} ${peakY}, ${depX} ${peakY}, ${depX} ${endY}`;
      svg.appendChild(svgEl("path", {
        d: path,
        class: "dep-arc",
        "marker-end": `url(#${markerId})`,
      }));
      addLabel(svg, token.deprel || "dep", (headX + depX) / 2, peakY - 3, "dep-label");
    }

    for (const cell of layout.cells) {
      const group = svgEl("g", { transform: `translate(${cell.x},0)`, class: "token-group" });
      const form = svgEl("text", {
        x: 0,
        y: layout.formY,
        "text-anchor": "middle",
        class: "token-form",
      });
      form.textContent = cell.token.form;
      group.appendChild(form);

      layout.extraFeatures.forEach((feature, index) => {
        const value = featureValue(cell.token, feature);
        if (!value) return;
        const txt = svgEl("text", {
          x: 0,
          y: layout.formY + (index + 1) * layout.featureGap,
          "text-anchor": "middle",
          class: `token-feature ${classForFeature(feature)}`,
        });
        txt.textContent = value;
        group.appendChild(txt);
      });
      svg.appendChild(group);
    }

    if (options && options.dataIndex !== undefined) svg.dataset.index = String(options.dataIndex);
    return svg;
  }

  function render(container, blocks, features, options) {
    if (!container) throw new Error("Contêiner de renderização ausente.");
    const list = Array.isArray(blocks) ? blocks : [blocks];
    container.innerHTML = "";
    const svgs = [];

    list.forEach((block, index) => {
      const wrapper = document.createElement("div");
      wrapper.className = "svgbox";
      const descriptor = U.describeSentence(block, index);

      if (options && options.showCaptions && list.length > 1) {
        const caption = document.createElement("div");
        caption.className = "tree-caption";
        const id = document.createElement("span");
        id.className = "tree-caption-id";
        id.textContent = descriptor.id;
        const text = document.createElement("span");
        text.className = "tree-caption-text";
        text.textContent = descriptor.text;
        caption.append(id, text);
        wrapper.appendChild(caption);
      }

      const svg = renderSentence(block, features, { dataIndex: index });
      wrapper.appendChild(svg);
      container.appendChild(wrapper);
      svgs.push(svg);
    });

    return svgs;
  }

  root.DependencyTreeRenderer = { render, renderSentence };
})(typeof globalThis !== "undefined" ? globalThis : window);
