(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ConlluUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const INTEGER_ID = /^\d+$/;
  const RANGE_ID = /^\d+-\d+$/;
  const EMPTY_ID = /^\d+\.\d+$/;

  function normalizeNewlines(text) {
    return String(text == null ? "" : text)
      .replace(/^\uFEFF/, "")
      .replace(/\r\n?/g, "\n");
  }

  function splitSentences(text) {
    const normalized = normalizeNewlines(text).trim();
    if (!normalized) return [];
    return normalized
      .split(/\n[\t ]*\n+/)
      .map((block) => block.trim())
      .filter(Boolean);
  }

  function parseCommentMetadata(block) {
    const meta = {};
    for (const line of normalizeNewlines(block).split("\n")) {
      if (!line.startsWith("#")) continue;
      const match = line.match(/^#\s*([^=]+?)\s*=\s*(.*)$/);
      if (match) meta[match[1].trim()] = match[2].trim();
    }
    return meta;
  }

  function parseFeatureString(value) {
    if (!value || value === "_") return {};
    const output = {};
    for (const item of value.split("|")) {
      const eq = item.indexOf("=");
      if (eq <= 0) continue;
      output[item.slice(0, eq)] = item.slice(eq + 1);
    }
    return output;
  }

  function collectFeatureKeys(sentences) {
    const feats = new Set();
    const misc = new Set();
    for (const sentence of sentences) {
      for (const line of sentence.split("\n")) {
        if (!line || line.startsWith("#")) continue;
        const cols = line.split("\t");
        if (cols.length < 10 || !INTEGER_ID.test(cols[0])) continue;
        Object.keys(parseFeatureString(cols[5])).forEach((key) => feats.add(key));
        Object.keys(parseFeatureString(cols[9])).forEach((key) => misc.add(key));
      }
    }
    return {
      feats: Array.from(feats).sort((a, b) => a.localeCompare(b)),
      misc: Array.from(misc).sort((a, b) => a.localeCompare(b)),
    };
  }

  function reconstructText(block) {
    const forms = [];
    const lines = normalizeNewlines(block).split("\n");
    for (const line of lines) {
      if (!line || line.startsWith("#")) continue;
      const cols = line.split("\t");
      if (cols.length < 10) continue;
      const id = cols[0];
      if (RANGE_ID.test(id) || EMPTY_ID.test(id)) continue;
      if (!INTEGER_ID.test(id)) continue;
      forms.push({ form: cols[1], noSpace: cols[9].split("|").includes("SpaceAfter=No") });
    }
    return forms.map((item, index) => item.form + (item.noSpace || index === forms.length - 1 ? "" : " ")).join("");
  }

  function describeSentence(block, index) {
    const meta = parseCommentMetadata(block);
    return {
      index,
      id: meta.sent_id || meta.sentid || String(index + 1),
      text: meta.text || reconstructText(block),
      meta,
      raw: block,
    };
  }

  function validateSentence(block, sentenceIndex) {
    const errors = [];
    const warnings = [];
    const integerIds = new Set();
    const heads = [];
    let syntacticTokens = 0;
    let roots = 0;

    const lines = normalizeNewlines(block).split("\n");
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      if (!line || line.startsWith("#")) continue;
      const cols = line.split("\t");
      const where = `sentença ${sentenceIndex + 1}, linha ${lineIndex + 1}`;

      if (cols.length !== 10) {
        errors.push(`${where}: esperado 10 colunas separadas por TAB; recebido ${cols.length}.`);
        continue;
      }

      const id = cols[0];
      if (!(INTEGER_ID.test(id) || RANGE_ID.test(id) || EMPTY_ID.test(id))) {
        errors.push(`${where}: ID inválido “${id}”.`);
        continue;
      }

      if (INTEGER_ID.test(id)) {
        syntacticTokens += 1;
        const numericId = Number(id);
        if (integerIds.has(numericId)) errors.push(`${where}: ID ${id} repetido.`);
        integerIds.add(numericId);

        const head = cols[6];
        if (!/^\d+$/.test(head)) {
          errors.push(`${where}: HEAD “${head}” deve ser um inteiro para tokens sintáticos.`);
        } else {
          const numericHead = Number(head);
          heads.push({ head: numericHead, where, id: numericId });
          if (numericHead === 0) roots += 1;
          if (numericHead === numericId) errors.push(`${where}: o token ${id} aponta para si mesmo em HEAD.`);
        }

        if (!cols[1] || cols[1] === "_") warnings.push(`${where}: FORM está vazio ou “_”.`);
        if (!cols[7] || cols[7] === "_") warnings.push(`${where}: DEPREL está vazio ou “_”.`);
      }
    }

    if (syntacticTokens === 0) errors.push(`sentença ${sentenceIndex + 1}: nenhum token sintático inteiro encontrado.`);
    if (syntacticTokens > 0 && roots === 0) warnings.push(`sentença ${sentenceIndex + 1}: nenhum HEAD=0 encontrado.`);
    if (roots > 1) warnings.push(`sentença ${sentenceIndex + 1}: ${roots} tokens têm HEAD=0.`);

    for (const item of heads) {
      if (item.head !== 0 && !integerIds.has(item.head)) {
        errors.push(`${item.where}: HEAD=${item.head} não corresponde a nenhum ID inteiro da sentença.`);
      }
    }

    return { errors, warnings, syntacticTokens };
  }

  function validateDocument(text) {
    const sentences = splitSentences(text);
    const errors = [];
    const warnings = [];
    let tokens = 0;

    if (!sentences.length) {
      return { valid: false, sentences, errors: ["Nenhuma sentença CoNLL-U foi encontrada."], warnings, tokens: 0 };
    }

    sentences.forEach((sentence, index) => {
      const result = validateSentence(sentence, index);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
      tokens += result.syntacticTokens;
    });

    return { valid: errors.length === 0, sentences, errors, warnings, tokens };
  }

  function parseSyntacticTokens(block) {
    const meta = parseCommentMetadata(block);
    const tokens = [];
    for (const line of normalizeNewlines(block).split("\n")) {
      if (!line || line.startsWith("#")) continue;
      const cols = line.split("\t");
      if (cols.length < 10 || !INTEGER_ID.test(cols[0])) continue;
      tokens.push({
        id: Number(cols[0]),
        form: cols[1],
        lemma: cols[2],
        upos: cols[3],
        xpos: cols[4],
        feats: parseFeatureString(cols[5]),
        head: /^\d+$/.test(cols[6]) ? Number(cols[6]) : null,
        deprel: cols[7],
        deps: cols[8],
        misc: parseFeatureString(cols[9]),
        columns: cols.slice(0, 10),
      });
    }
    return {
      tokens,
      meta,
      id: meta.sent_id || meta.sentid || "",
      text: meta.text || reconstructText(block),
    };
  }

  function injectShownFeatures(block, features) {
    const clean = normalizeNewlines(block)
      .split("\n")
      .filter((line) => !/^#\s*shownfeatures\s*=/.test(line))
      .join("\n")
      .trim();
    const featureLine = `# shownfeatures = ${features.join(", ")}`;
    return `${featureLine}\n${clean}`;
  }

  function safeFilename(value, fallback) {
    const base = String(value || fallback || "tree")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80);
    return base || fallback || "tree";
  }

  return {
    normalizeNewlines,
    splitSentences,
    parseCommentMetadata,
    parseFeatureString,
    collectFeatureKeys,
    reconstructText,
    describeSentence,
    validateSentence,
    validateDocument,
    parseSyntacticTokens,
    injectShownFeatures,
    safeFilename,
  };
});
