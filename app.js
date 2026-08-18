(function () {
  "use strict";

  const U = window.ConlluUtils;
  const Renderer = window.DependencyTreeRenderer;
  const Zip = window.ZipUtils;

  const SAMPLE_A = `# sent_id = exemplo-1
# text = A pesquisadora analisou os dados.
1\tA\to\tDET\t_\tDefinite=Def|Gender=Fem|Number=Sing|PronType=Art\t2\tdet\t_\t_
2\tpesquisadora\tpesquisador\tNOUN\t_\tGender=Fem|Number=Sing\t3\tnsubj\t_\t_
3\tanalisou\tanalisar\tVERB\t_\tMood=Ind|Number=Sing|Person=3|Tense=Past|VerbForm=Fin\t0\troot\t_\t_
4\tos\to\tDET\t_\tDefinite=Def|Gender=Masc|Number=Plur|PronType=Art\t5\tdet\t_\t_
5\tdados\tdado\tNOUN\t_\tGender=Masc|Number=Plur\t3\tobj\t_\tSpaceAfter=No
6\t.\t.\tPUNCT\t_\t_\t3\tpunct\t_\t_

# sent_id = exemplo-2
# text = Árvores sintáticas tornam relações visíveis.
1\tÁrvores\tárvore\tNOUN\t_\tGender=Fem|Number=Plur\t3\tnsubj\t_\t_
2\tsintáticas\tsintático\tADJ\t_\tGender=Fem|Number=Plur\t1\tamod\t_\t_
3\ttornam\ttornar\tVERB\t_\tMood=Ind|Number=Plur|Person=3|Tense=Pres|VerbForm=Fin\t0\troot\t_\t_
4\trelações\trelação\tNOUN\t_\tGender=Fem|Number=Plur\t3\tobj\t_\t_
5\tvisíveis\tvisível\tADJ\t_\tNumber=Plur\t4\txcomp\t_\tSpaceAfter=No
6\t.\t.\tPUNCT\t_\t_\t3\tpunct\t_\t_`;

  const SAMPLE_B = SAMPLE_A.replace("3\tobj\t_\tSpaceAfter=No", "3\tobl\t_\tSpaceAfter=No");

  const STORAGE = {
    textA: "visconllu:v1:text:A",
    textB: "visconllu:v1:text:B",
    activeKindA: "visconllu:v1:kind:A",
    activeKindB: "visconllu:v1:kind:B",
    showRaw: "visconllu:v1:raw",
  };

  function blankMemory(kind) {
    return { kind, content: "", filename: null, size: null };
  }

  function blankSlot(name) {
    return {
      name,
      role: name === "A" ? "Referência" : "Candidato",
      activeKind: "file",
      file: blankMemory("file"),
      text: blankMemory("text"),
      snapshot: null,
      locked: false,
      zoom: 1,
    };
  }

  const state = {
    slots: { A: blankSlot("A"), B: blankSlot("B") },
    editingSlot: "A",
    viewMode: "single",
    singleSlot: "A",
    continuousSlot: "A",
    compareLayout: "side",
    showRaw: false,
    features: ["FORM", "UPOS", "LEMMA"],
    rendering: false,
  };

  const el = {};
  const ids = [
    "slotTabA", "slotTabB", "slotStatusA", "slotStatusB", "editingSlotBadge", "editingSlotTitle", "lockSlotBtn",
    "memoryFileTab", "memoryTextTab", "fileMemoryPanel", "textMemoryPanel", "dropZone", "fileInput", "fileInfo", "fileName", "fileDetails", "filePreviewDetails", "filePreview", "clearFileMemoryBtn",
    "textSlotLetter", "sampleBtn", "conlluInput", "clearTextMemoryBtn", "memoryStateNote", "updateSlotBtn", "validationBox",
    "viewerStats", "emptyState", "viewerUi", "rawBtn", "dynamicFeatures",
    "singleView", "singleSlotA", "singleSlotB", "prevBtn", "nextBtn", "sentenceNumber", "sentenceTotal", "updateSingleBtn", "singleDirtyNotice", "sentId", "sentText", "singleRenderStatus", "svgwell", "rawConllu",
    "singleZoomOut", "singleZoomReset", "singleZoomIn", "singleZoomFit", "downloadSvgBtn", "downloadPngBtn",
    "continuousView", "continuousSlotA", "continuousSlotB", "updateContinuousBtn", "continuousDirtyNotice", "continuousSummary", "continuousZoomOut", "continuousZoomReset", "continuousZoomIn", "continuousZoomFit", "downloadAllSvgBtn", "continuousRenderStatus", "continuousWell",
    "compareView", "sideBySideBtn", "stackedBtn", "alignSentIdBtn", "updateBothBtn", "compareRenderStatus", "compareGrid",
    "compareTitleA", "compareTitleB", "compareSourceA", "compareSourceB", "lockCompareA", "lockCompareB", "dirtyNoticeA", "dirtyNoticeB", "compareSentenceA", "compareSentenceB", "updateCompareA", "updateCompareB", "compareIdA", "compareIdB", "compareTextA", "compareTextB", "compareTreeA", "compareTreeB", "compareRawA", "compareRawB",
    "zoomOutA", "zoomResetA", "zoomInA", "zoomFitA", "zoomOutB", "zoomResetB", "zoomInB", "zoomFitB", "downloadCompareA", "downloadCompareB"
  ];

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    ids.forEach((id) => { el[id] = document.getElementById(id); });
    if (!U) return fatal("Falha ao carregar conllu-utils.js.");
    if (!Renderer) return fatal("Falha ao carregar tree-renderer.js.");
    if (!Zip) return fatal("Falha ao carregar zip-utils.js.");
    restoreSession();
    bindEvents();
    syncAllUi();
    exposeTestApi();
  }

  function restoreSession() {
    try {
      state.slots.A.text.content = sessionStorage.getItem(STORAGE.textA) || "";
      state.slots.B.text.content = sessionStorage.getItem(STORAGE.textB) || "";
      const kindA = sessionStorage.getItem(STORAGE.activeKindA);
      const kindB = sessionStorage.getItem(STORAGE.activeKindB);
      if (kindA === "file" || kindA === "text") state.slots.A.activeKind = kindA;
      if (kindB === "file" || kindB === "text") state.slots.B.activeKind = kindB;
      state.showRaw = sessionStorage.getItem(STORAGE.showRaw) === "1";
    } catch (_) {}
  }

  function persistText(name) {
    try { sessionStorage.setItem(name === "A" ? STORAGE.textA : STORAGE.textB, state.slots[name].text.content); } catch (_) {}
  }

  function persistKind(name) {
    try { sessionStorage.setItem(name === "A" ? STORAGE.activeKindA : STORAGE.activeKindB, state.slots[name].activeKind); } catch (_) {}
  }

  function bindEvents() {
    el.slotTabA.addEventListener("click", () => editSlot("A"));
    el.slotTabB.addEventListener("click", () => editSlot("B"));
    el.memoryFileTab.addEventListener("click", () => setEditingMemoryKind("file"));
    el.memoryTextTab.addEventListener("click", () => setEditingMemoryKind("text"));
    el.lockSlotBtn.addEventListener("click", () => toggleLock(state.editingSlot));
    el.lockCompareA.addEventListener("click", () => toggleLock("A"));
    el.lockCompareB.addEventListener("click", () => toggleLock("B"));

    el.fileInput.addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) loadFileIntoSlot(state.editingSlot, file);
    });
    ["dragenter", "dragover"].forEach((type) => el.dropZone.addEventListener(type, (event) => {
      event.preventDefault();
      if (!activeEditingSlot().locked) el.dropZone.classList.add("dragging");
    }));
    ["dragleave", "drop"].forEach((type) => el.dropZone.addEventListener(type, (event) => {
      event.preventDefault(); el.dropZone.classList.remove("dragging");
    }));
    el.dropZone.addEventListener("drop", (event) => {
      if (activeEditingSlot().locked) return;
      const file = event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) loadFileIntoSlot(state.editingSlot, file);
    });
    el.dropZone.addEventListener("keydown", (event) => {
      if (activeEditingSlot().locked) return;
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); el.fileInput.click(); }
    });

    el.conlluInput.addEventListener("input", () => {
      const slot = activeEditingSlot();
      if (slot.locked) return;
      slot.text.content = el.conlluInput.value;
      persistText(slot.name);
      syncAllUi();
    });
    el.sampleBtn.addEventListener("click", () => {
      const slot = activeEditingSlot();
      if (slot.locked) return;
      slot.activeKind = "text";
      slot.text.content = slot.name === "A" ? SAMPLE_A : SAMPLE_B;
      persistKind(slot.name); persistText(slot.name);
      syncAllUi();
    });
    el.clearFileMemoryBtn.addEventListener("click", () => clearMemory(state.editingSlot, "file"));
    el.clearTextMemoryBtn.addEventListener("click", () => clearMemory(state.editingSlot, "text"));
    el.updateSlotBtn.addEventListener("click", () => updateSlotSnapshot(state.editingSlot));

    document.querySelectorAll("[data-view-mode]").forEach((button) => button.addEventListener("click", () => setViewMode(button.dataset.viewMode)));
    el.rawBtn.addEventListener("click", toggleRaw);
    document.querySelectorAll(".feature-toggle").forEach((input) => input.addEventListener("change", updateFeatures));

    el.singleSlotA.addEventListener("click", () => setSingleSlot("A"));
    el.singleSlotB.addEventListener("click", () => setSingleSlot("B"));
    el.prevBtn.addEventListener("click", () => moveSentence(state.singleSlot, -1, "single"));
    el.nextBtn.addEventListener("click", () => moveSentence(state.singleSlot, 1, "single"));
    el.sentenceNumber.addEventListener("change", () => setSentenceIndex(state.singleSlot, Number(el.sentenceNumber.value) - 1, "single"));
    el.updateSingleBtn.addEventListener("click", () => updateSlotSnapshot(state.singleSlot));
    bindZoom("single", el.singleZoomOut, el.singleZoomReset, el.singleZoomIn, el.singleZoomFit);
    el.downloadSvgBtn.addEventListener("click", () => downloadSlotSvg(state.singleSlot));
    el.downloadPngBtn.addEventListener("click", () => downloadSlotPng(state.singleSlot));

    el.continuousSlotA.addEventListener("click", () => setContinuousSlot("A"));
    el.continuousSlotB.addEventListener("click", () => setContinuousSlot("B"));
    el.updateContinuousBtn.addEventListener("click", () => updateSlotSnapshot(state.continuousSlot));
    bindZoom("continuous", el.continuousZoomOut, el.continuousZoomReset, el.continuousZoomIn, el.continuousZoomFit);
    el.downloadAllSvgBtn.addEventListener("click", () => downloadAllSvgZip(state.continuousSlot));

    el.sideBySideBtn.addEventListener("click", () => setCompareLayout("side"));
    el.stackedBtn.addEventListener("click", () => setCompareLayout("stacked"));
    el.alignSentIdBtn.addEventListener("click", alignBySentId);
    el.updateBothBtn.addEventListener("click", updateBothSnapshots);
    el.compareSentenceA.addEventListener("change", () => setSentenceIndex("A", Number(el.compareSentenceA.value) - 1, "compare"));
    el.compareSentenceB.addEventListener("change", () => setSentenceIndex("B", Number(el.compareSentenceB.value) - 1, "compare"));
    el.updateCompareA.addEventListener("click", () => updateSlotSnapshot("A"));
    el.updateCompareB.addEventListener("click", () => updateSlotSnapshot("B"));
    bindZoom("A", el.zoomOutA, el.zoomResetA, el.zoomInA, el.zoomFitA);
    bindZoom("B", el.zoomOutB, el.zoomResetB, el.zoomInB, el.zoomFitB);
    el.downloadCompareA.addEventListener("click", () => downloadSlotSvg("A"));
    el.downloadCompareB.addEventListener("click", () => downloadSlotSvg("B"));

    document.addEventListener("keydown", (event) => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
      if (state.viewMode !== "single") return;
      if (event.key === "ArrowLeft") moveSentence(state.singleSlot, -1, "single");
      if (event.key === "ArrowRight") moveSentence(state.singleSlot, 1, "single");
    });
  }

  function bindZoom(target, out, reset, inn, fit) {
    out.addEventListener("click", () => changeZoom(target, -0.1));
    inn.addEventListener("click", () => changeZoom(target, 0.1));
    reset.addEventListener("click", () => setZoom(target, 1));
    fit.addEventListener("click", () => fitZoom(target));
  }

  function activeEditingSlot() { return state.slots[state.editingSlot]; }
  function memoryOf(slot) { return slot[slot.activeKind]; }
  function snapshotOf(name) { return state.slots[name].snapshot; }

  function editSlot(name) {
    state.editingSlot = name;
    syncAllUi();
  }

  function setEditingMemoryKind(kind) {
    const slot = activeEditingSlot();
    if (slot.locked) return;
    slot.activeKind = kind;
    persistKind(slot.name);
    syncAllUi();
  }

  async function loadFileIntoSlot(name, file) {
    const slot = state.slots[name];
    if (slot.locked) return;
    try {
      const content = await file.text();
      slot.file = { kind: "file", content: U.normalizeNewlines(content), filename: file.name, size: file.size };
      slot.activeKind = "file";
      persistKind(name);
      if (state.editingSlot !== name) state.editingSlot = name;
      showMemoryValidation(name);
      syncAllUi();
    } catch (error) {
      showValidation("error", [`Não foi possível ler ${file.name}: ${error.message || error}`]);
    } finally {
      el.fileInput.value = "";
    }
  }

  function clearMemory(name, kind) {
    const slot = state.slots[name];
    if (slot.locked) return;
    if (kind === "file") slot.file = blankMemory("file");
    else { slot.text = blankMemory("text"); persistText(name); }
    syncAllUi();
  }

  function currentMemoryStatus(slot) {
    const mem = memoryOf(slot);
    if (!mem.content.trim()) return "vazia";
    if (slot.activeKind === "file") return mem.filename || "arquivo";
    return `${mem.content.length.toLocaleString("pt-BR")} caracteres`;
  }

  function isDirty(name) {
    const slot = state.slots[name];
    const snap = slot.snapshot;
    const mem = memoryOf(slot);
    if (!snap) return Boolean(mem.content.trim());
    return snap.kind !== slot.activeKind || snap.content !== mem.content || (snap.kind === "file" && snap.filename !== mem.filename);
  }

  function parseDocument(content) {
    const validation = U.validateDocument(content);
    if (!validation.valid) return { validation, doc: null };
    const sentences = validation.sentences;
    const descriptors = sentences.map((block, index) => U.describeSentence(block, index));
    return {
      validation,
      doc: {
        sentences,
        descriptors,
        tokens: validation.tokens,
        featureKeys: U.collectFeatureKeys(sentences),
      },
    };
  }

  function preserveSentenceIndex(oldSnapshot, newDoc) {
    if (!oldSnapshot || !oldSnapshot.doc) return 0;
    const oldDescriptor = oldSnapshot.doc.descriptors[oldSnapshot.current];
    if (oldDescriptor && oldDescriptor.id) {
      const byId = newDoc.descriptors.findIndex((d) => d.id === oldDescriptor.id);
      if (byId >= 0) return byId;
    }
    return clamp(oldSnapshot.current || 0, 0, newDoc.sentences.length - 1);
  }

  async function updateSlotSnapshot(name, options) {
    const slot = state.slots[name];
    const force = options && options.force;
    if (slot.locked && slot.snapshot && !force) {
      showValidation("warning", [`A entrada ${name} está fixada. Desfixe-a para substituir o snapshot.`]);
      return false;
    }
    const mem = memoryOf(slot);
    if (!mem.content.trim()) {
      showValidation("error", [`A memória ${name} (${slot.activeKind === "file" ? "arquivo" : "texto"}) está vazia.`]);
      return false;
    }

    const parsed = parseDocument(mem.content);
    if (!parsed.validation.valid) {
      showValidation("error", parsed.validation.errors.slice(0, 8), Math.max(0, parsed.validation.errors.length - 8));
      return false;
    }

    const oldSnapshot = slot.snapshot;
    const current = preserveSentenceIndex(oldSnapshot, parsed.doc);
    slot.snapshot = {
      kind: slot.activeKind,
      content: mem.content,
      filename: mem.filename,
      size: mem.size,
      doc: parsed.doc,
      current,
      updatedAt: Date.now(),
    };

    const messages = [`${parsed.doc.sentences.length} sentença(s) e ${parsed.doc.tokens} token(s) sintático(s) em ${name}.`];
    if (parsed.validation.warnings.length) showValidation("warning", messages.concat(parsed.validation.warnings.slice(0, 4)), Math.max(0, parsed.validation.warnings.length - 4));
    else showValidation("success", messages);

    if (!snapshotOf(state.singleSlot)) state.singleSlot = name;
    if (!snapshotOf(state.continuousSlot)) state.continuousSlot = name;
    refreshDynamicFeatures();
    syncAllUi();
    await renderSlotImpact(name);
    return true;
  }

  async function renderSlotImpact(name) {
    if (state.viewMode === "compare") {
      renderComparePane(name);
      el.compareRenderStatus.textContent = snapshotOf("A") && snapshotOf("B") ? "A e B renderizadas de forma independente." : "Atualize os dois lados para uma comparação completa.";
      syncAllUi();
      return;
    }
    if (state.viewMode === "single") {
      if (state.singleSlot === name) renderSingle(); else syncAllUi();
      return;
    }
    if (state.viewMode === "continuous") {
      if (state.continuousSlot === name) await renderContinuous(); else syncAllUi();
    }
  }

  async function updateBothSnapshots() {
    let any = false;
    for (const name of ["A", "B"]) {
      const slot = state.slots[name];
      if (slot.locked && slot.snapshot) continue;
      if (!memoryOf(slot).content.trim()) continue;
      const ok = await updateSlotSnapshot(name);
      any = any || ok;
    }
    if (!any) el.compareRenderStatus.textContent = "Nada foi atualizado: ambas as entradas estão vazias ou fixadas.";
  }

  function toggleLock(name) {
    const slot = state.slots[name];
    if (!slot.snapshot && !slot.locked) {
      showValidation("warning", [`Atualize ${name} uma vez antes de fixá-la como referência.`]);
      return;
    }
    slot.locked = !slot.locked;
    syncAllUi();
  }

  function showMemoryValidation(name) {
    const mem = memoryOf(state.slots[name]);
    if (!mem.content.trim()) return;
    const parsed = parseDocument(mem.content);
    if (!parsed.validation.valid) showValidation("error", parsed.validation.errors.slice(0, 8), Math.max(0, parsed.validation.errors.length - 8));
    else showValidation(parsed.validation.warnings.length ? "warning" : "success", [`Memória ${name}: ${parsed.doc.sentences.length} sentença(s), ${parsed.doc.tokens} token(s).`]);
  }

  function setViewMode(mode) {
    if (!["single", "continuous", "compare"].includes(mode)) return;
    state.viewMode = mode;
    syncViewModeUi();
    renderVisibleView();
  }

  function setSingleSlot(name) {
    state.singleSlot = name;
    syncAllUi();
    renderSingle();
  }

  function setContinuousSlot(name) {
    state.continuousSlot = name;
    syncAllUi();
    renderContinuous();
  }

  function setSentenceIndex(name, index, context) {
    const snap = snapshotOf(name);
    if (!snap) return;
    snap.current = clamp(index, 0, snap.doc.sentences.length - 1);
    syncAllUi();
    if (context === "compare") renderCompare(); else renderSingle();
  }

  function moveSentence(name, delta, context) {
    const snap = snapshotOf(name);
    if (!snap) return;
    setSentenceIndex(name, snap.current + delta, context);
  }

  async function renderVisibleView() {
    if (!snapshotOf("A") && !snapshotOf("B")) { syncAllUi(); return; }
    if (state.viewMode === "single") return renderSingle();
    if (state.viewMode === "continuous") return renderContinuous();
    return renderCompare();
  }

  function renderSingle() {
    const name = ensureExistingSlot(state.singleSlot);
    state.singleSlot = name;
    const snap = snapshotOf(name);
    if (!snap) {
      el.singleRenderStatus.textContent = `A entrada ${name} ainda não tem snapshot.`;
      el.svgwell.innerHTML = "";
      syncAllUi();
      return;
    }
    const descriptor = snap.doc.descriptors[snap.current];
    const block = snap.doc.sentences[snap.current];
    el.sentId.textContent = descriptor.id || "—";
    el.sentText.textContent = descriptor.text || "—";
    el.sentenceNumber.max = String(snap.doc.sentences.length);
    el.sentenceNumber.value = String(snap.current + 1);
    el.sentenceTotal.textContent = `/ ${snap.doc.sentences.length}`;
    el.singleRenderStatus.textContent = `${slotSnapshotLabel(name)} · sentença ${snap.current + 1}/${snap.doc.sentences.length}`;
    try {
      const svgs = Renderer.render(el.svgwell, [block], state.features, { showCaptions: false });
      if (svgs.length !== 1) throw new Error("SVG não produzido.");
      applyZoom(name, el.svgwell);
    } catch (error) {
      renderError(el.svgwell, error);
    }
    el.rawConllu.querySelector("code").textContent = block;
    el.rawConllu.hidden = !state.showRaw;
    syncAllUi();
  }

  async function renderContinuous() {
    const name = ensureExistingSlot(state.continuousSlot);
    state.continuousSlot = name;
    const snap = snapshotOf(name);
    if (!snap) {
      el.continuousRenderStatus.textContent = `A entrada ${name} ainda não tem snapshot.`;
      el.continuousWell.innerHTML = "";
      syncAllUi();
      return;
    }
    el.continuousRenderStatus.textContent = `Renderizando ${snap.doc.sentences.length} árvore(s)…`;
    el.continuousWell.classList.add("busy");
    await nextFrame();
    try {
      Renderer.render(el.continuousWell, snap.doc.sentences, state.features, { showCaptions: true });
      Array.from(el.continuousWell.querySelectorAll(".svgbox")).forEach((box, index) => {
        box.classList.add("continuous-item");
        const pre = document.createElement("pre");
        pre.className = "raw-conllu inline-raw";
        pre.hidden = !state.showRaw;
        const code = document.createElement("code");
        code.textContent = snap.doc.sentences[index];
        pre.appendChild(code);
        box.appendChild(pre);
      });
      applyZoom(name, el.continuousWell);
      el.continuousRenderStatus.textContent = `${snap.doc.sentences.length} árvore(s) renderizada(s).`;
    } catch (error) {
      renderError(el.continuousWell, error);
      el.continuousRenderStatus.textContent = "Falha na renderização contínua.";
    } finally {
      el.continuousWell.classList.remove("busy");
      syncAllUi();
    }
  }

  function renderCompare() {
    ["A", "B"].forEach((name) => renderComparePane(name));
    if (snapshotOf("A") && snapshotOf("B")) el.compareRenderStatus.textContent = "A e B renderizadas de forma independente.";
    else el.compareRenderStatus.textContent = "Atualize os dois lados para uma comparação completa.";
    syncAllUi();
  }

  function renderComparePane(name) {
    const snap = snapshotOf(name);
    const tree = name === "A" ? el.compareTreeA : el.compareTreeB;
    const id = name === "A" ? el.compareIdA : el.compareIdB;
    const text = name === "A" ? el.compareTextA : el.compareTextB;
    const raw = name === "A" ? el.compareRawA : el.compareRawB;
    const sentenceInput = name === "A" ? el.compareSentenceA : el.compareSentenceB;
    if (!snap) {
      tree.innerHTML = `<div class="pane-empty"><strong>${name} ainda não foi atualizada.</strong><span>Carregue arquivo ou texto na memória ${name} e clique em “Atualizar ${name}”.</span></div>`;
      id.textContent = "—"; text.textContent = "—"; raw.hidden = true; sentenceInput.disabled = true;
      return;
    }
    sentenceInput.disabled = false;
    sentenceInput.max = String(snap.doc.sentences.length);
    sentenceInput.value = String(snap.current + 1);
    const descriptor = snap.doc.descriptors[snap.current];
    const block = snap.doc.sentences[snap.current];
    id.textContent = descriptor.id || "—";
    text.textContent = descriptor.text || "—";
    raw.querySelector("code").textContent = block;
    raw.hidden = !state.showRaw;
    try {
      const svgs = Renderer.render(tree, [block], state.features, { showCaptions: false });
      if (svgs.length !== 1) throw new Error(`SVG ${name} não produzido.`);
      applyZoom(name, tree);
    } catch (error) { renderError(tree, error); }
  }

  function ensureExistingSlot(preferred) {
    if (snapshotOf(preferred)) return preferred;
    return snapshotOf(preferred === "A" ? "B" : "A") ? (preferred === "A" ? "B" : "A") : preferred;
  }

  function alignBySentId() {
    const a = snapshotOf("A"), b = snapshotOf("B");
    if (!a || !b) return;
    const id = a.doc.descriptors[a.current] && a.doc.descriptors[a.current].id;
    if (!id) return;
    const match = b.doc.descriptors.findIndex((d) => d.id === id);
    if (match < 0) { el.compareRenderStatus.textContent = `B não contém sent_id “${id}”.`; return; }
    b.current = match;
    renderCompare();
  }

  function setCompareLayout(layout) {
    state.compareLayout = layout;
    syncCompareLayout();
    requestAnimationFrame(() => { applyZoom("A", el.compareTreeA); applyZoom("B", el.compareTreeB); });
  }

  function updateFeatures() {
    state.features = ["FORM"];
    document.querySelectorAll(".feature-toggle:checked").forEach((input) => {
      if (!state.features.includes(input.value)) state.features.push(input.value);
    });
    renderVisibleView();
  }

  function refreshDynamicFeatures() {
    const feats = new Set(), misc = new Set();
    ["A", "B"].forEach((name) => {
      const snap = snapshotOf(name);
      if (!snap) return;
      snap.doc.featureKeys.feats.forEach((x) => feats.add(x));
      snap.doc.featureKeys.misc.forEach((x) => misc.add(x));
    });
    const values = [
      ...Array.from(feats).sort().map((key) => ({ label: key, value: `FEATS.${key}` })),
      ...Array.from(misc).filter((x) => x !== "SpaceAfter").sort().map((key) => ({ label: `MISC:${key}`, value: `MISC.${key}` })),
    ];
    el.dynamicFeatures.innerHTML = "";
    values.forEach(({ label, value }) => {
      const wrapper = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox"; input.className = "feature-toggle dynamic-feature-toggle"; input.value = value; input.checked = state.features.includes(value);
      input.addEventListener("change", updateFeatures);
      wrapper.append(input, document.createTextNode(` ${label}`));
      el.dynamicFeatures.appendChild(wrapper);
    });
  }

  function toggleRaw() {
    state.showRaw = !state.showRaw;
    try { sessionStorage.setItem(STORAGE.showRaw, state.showRaw ? "1" : "0"); } catch (_) {}
    syncAllUi();
  }

  function changeZoom(target, delta) {
    const name = target === "single" ? state.singleSlot : target === "continuous" ? state.continuousSlot : target;
    setZoom(target, state.slots[name].zoom + delta);
  }

  function setZoom(target, value) {
    const name = target === "single" ? state.singleSlot : target === "continuous" ? state.continuousSlot : target;
    state.slots[name].zoom = Math.round(clamp(value, 0.3, 3) * 10) / 10;
    if (target === "single") applyZoom(name, el.svgwell);
    else if (target === "continuous") applyZoom(name, el.continuousWell);
    else applyZoom(name, name === "A" ? el.compareTreeA : el.compareTreeB);
    syncZoomUi();
  }

  function applyZoom(name, container) {
    if (!container) return;
    const zoom = state.slots[name].zoom;
    container.querySelectorAll("svg.dependency-tree-svg").forEach((svg) => {
      const baseWidth = Number(svg.dataset.baseWidth || svg.getAttribute("width"));
      const baseHeight = Number(svg.dataset.baseHeight || svg.getAttribute("height"));
      if (!svg.dataset.baseWidth) svg.dataset.baseWidth = String(baseWidth);
      if (!svg.dataset.baseHeight) svg.dataset.baseHeight = String(baseHeight);
      svg.style.width = `${Math.round(baseWidth * zoom)}px`;
      svg.style.height = `${Math.round(baseHeight * zoom)}px`;
    });
  }

  function fitZoom(target) {
    const name = target === "single" ? state.singleSlot : target === "continuous" ? state.continuousSlot : target;
    const container = target === "single" ? el.svgwell : target === "continuous" ? el.continuousWell : (name === "A" ? el.compareTreeA : el.compareTreeB);
    if (!container) return;
    const ratios = [];
    const available = Math.max(120, container.clientWidth - 28);
    container.querySelectorAll("svg.dependency-tree-svg").forEach((svg) => {
      const baseWidth = Number(svg.dataset.baseWidth || svg.getAttribute("width"));
      if (baseWidth > 0) ratios.push(available / baseWidth);
    });
    if (ratios.length) setZoom(target, clamp(Math.floor(Math.min(...ratios) * 10) / 10, 0.3, 3));
  }

  function syncAllUi() {
    syncInputUi();
    syncViewerShell();
    syncViewModeUi();
    syncSingleUi();
    syncContinuousUi();
    syncCompareUi();
    syncZoomUi();
  }

  function syncInputUi() {
    const slot = activeEditingSlot();
    const mem = memoryOf(slot);
    el.slotTabA.classList.toggle("active", state.editingSlot === "A");
    el.slotTabB.classList.toggle("active", state.editingSlot === "B");
    el.slotTabA.setAttribute("aria-selected", String(state.editingSlot === "A"));
    el.slotTabB.setAttribute("aria-selected", String(state.editingSlot === "B"));
    el.slotStatusA.textContent = slotTabSummary("A");
    el.slotStatusB.textContent = slotTabSummary("B");
    el.editingSlotBadge.textContent = slot.name;
    el.editingSlotTitle.textContent = `${slot.role} ${slot.name}`;
    el.textSlotLetter.textContent = slot.name;

    el.memoryFileTab.classList.toggle("active", slot.activeKind === "file");
    el.memoryTextTab.classList.toggle("active", slot.activeKind === "text");
    el.fileMemoryPanel.hidden = slot.activeKind !== "file";
    el.textMemoryPanel.hidden = slot.activeKind !== "text";

    if (el.conlluInput.value !== slot.text.content) el.conlluInput.value = slot.text.content;
    el.conlluInput.disabled = slot.locked;
    el.sampleBtn.disabled = slot.locked;
    el.clearTextMemoryBtn.disabled = slot.locked || !slot.text.content;
    el.clearFileMemoryBtn.disabled = slot.locked || !slot.file.content;
    el.memoryFileTab.disabled = slot.locked;
    el.memoryTextTab.disabled = slot.locked;
    el.fileInput.disabled = slot.locked;
    el.dropZone.classList.toggle("locked", slot.locked);

    if (slot.file.content) {
      el.fileInfo.hidden = false;
      el.fileName.textContent = slot.file.filename || "arquivo sem nome";
      el.fileDetails.textContent = `${formatBytes(slot.file.size)} · ${slot.file.content.length.toLocaleString("pt-BR")} caracteres`;
      el.filePreviewDetails.hidden = false;
      el.filePreview.querySelector("code").textContent = slot.file.content;
    } else {
      el.fileInfo.hidden = true; el.filePreviewDetails.hidden = true; el.filePreview.querySelector("code").textContent = "";
    }

    el.lockSlotBtn.textContent = slot.locked ? `Desfixar ${slot.name}` : `Fixar ${slot.name}`;
    el.lockSlotBtn.classList.toggle("active-lock", slot.locked);
    el.lockSlotBtn.disabled = !slot.snapshot && !slot.locked;
    el.updateSlotBtn.textContent = `Atualizar ${slot.name} na visualização`;
    el.updateSlotBtn.disabled = slot.locked || !mem.content.trim();

    const dirty = isDirty(slot.name);
    if (slot.locked) {
      el.memoryStateNote.className = "memory-state-note fixed";
      el.memoryStateNote.textContent = `${slot.name} está fixa. O snapshot não muda até você desfixar.`;
    } else if (!slot.snapshot && mem.content.trim()) {
      el.memoryStateNote.className = "memory-state-note pending";
      el.memoryStateNote.textContent = `${slot.name} tem conteúdo em memória, mas ainda não foi enviada à visualização.`;
    } else if (dirty) {
      el.memoryStateNote.className = "memory-state-note pending";
      el.memoryStateNote.textContent = `A memória ${slot.name} mudou. O snapshot exibido continua intacto até “Atualizar ${slot.name}”.`;
    } else if (slot.snapshot) {
      el.memoryStateNote.className = "memory-state-note synced";
      el.memoryStateNote.textContent = `${slot.name} está sincronizada com a visualização.`;
    } else {
      el.memoryStateNote.className = "memory-state-note";
      el.memoryStateNote.textContent = `Escolha arquivo ou texto para a entrada ${slot.name}.`;
    }
  }

  function slotTabSummary(name) {
    const slot = state.slots[name];
    const snap = slot.snapshot;
    const dirty = isDirty(name);
    if (!snap) return currentMemoryStatus(slot) === "vazia" ? "vazia" : `${currentMemoryStatus(slot)} · não renderizada`;
    const lock = slot.locked ? " · fixa" : "";
    const changed = dirty ? " · alterada" : "";
    return `${snap.kind === "file" ? snap.filename || "arquivo" : "texto"}${lock}${changed}`;
  }

  function syncViewerShell() {
    const hasAny = Boolean(snapshotOf("A") || snapshotOf("B"));
    el.emptyState.hidden = hasAny;
    el.viewerUi.hidden = !hasAny;
    const summaries = ["A", "B"].map((n) => snapshotOf(n) ? `${n}: ${slotSnapshotLabel(n)}` : `${n}: não renderizada`);
    el.viewerStats.textContent = summaries.join(" · ");
    el.rawBtn.classList.toggle("active", state.showRaw);
    el.rawBtn.textContent = state.showRaw ? "Ocultar CoNLL-U" : "CoNLL-U abaixo";
  }

  function syncViewModeUi() {
    document.querySelectorAll("[data-view-mode]").forEach((button) => button.classList.toggle("active", button.dataset.viewMode === state.viewMode));
    el.singleView.hidden = state.viewMode !== "single";
    el.continuousView.hidden = state.viewMode !== "continuous";
    el.compareView.hidden = state.viewMode !== "compare";
  }

  function syncSingleUi() {
    el.singleSlotA.classList.toggle("active", state.singleSlot === "A");
    el.singleSlotB.classList.toggle("active", state.singleSlot === "B");
    const snap = snapshotOf(state.singleSlot);
    el.singleSlotA.disabled = !snapshotOf("A");
    el.singleSlotB.disabled = !snapshotOf("B");
    el.updateSingleBtn.textContent = `↻ Atualizar ${state.singleSlot}`;
    el.updateSingleBtn.disabled = state.slots[state.singleSlot].locked || !memoryOf(state.slots[state.singleSlot]).content.trim();
    syncDirtyNotice(el.singleDirtyNotice, state.singleSlot);
    el.prevBtn.disabled = !snap || snap.current <= 0;
    el.nextBtn.disabled = !snap || snap.current >= snap.doc.sentences.length - 1;
    el.sentenceNumber.disabled = !snap;
    el.downloadSvgBtn.disabled = !snap;
    el.downloadPngBtn.disabled = !snap;
  }

  function syncContinuousUi() {
    el.continuousSlotA.classList.toggle("active", state.continuousSlot === "A");
    el.continuousSlotB.classList.toggle("active", state.continuousSlot === "B");
    el.continuousSlotA.disabled = !snapshotOf("A");
    el.continuousSlotB.disabled = !snapshotOf("B");
    const snap = snapshotOf(state.continuousSlot);
    el.updateContinuousBtn.textContent = `↻ Atualizar ${state.continuousSlot}`;
    el.updateContinuousBtn.disabled = state.slots[state.continuousSlot].locked || !memoryOf(state.slots[state.continuousSlot]).content.trim();
    syncDirtyNotice(el.continuousDirtyNotice, state.continuousSlot);
    el.continuousSummary.textContent = snap ? `${slotSnapshotLabel(state.continuousSlot)} · ${snap.doc.sentences.length} sentença(s)` : "";
    el.downloadAllSvgBtn.disabled = !snap;
  }

  function syncCompareUi() {
    ["A", "B"].forEach((name) => {
      const slot = state.slots[name];
      const snap = slot.snapshot;
      const source = name === "A" ? el.compareSourceA : el.compareSourceB;
      const title = name === "A" ? el.compareTitleA : el.compareTitleB;
      const lock = name === "A" ? el.lockCompareA : el.lockCompareB;
      const update = name === "A" ? el.updateCompareA : el.updateCompareB;
      const input = name === "A" ? el.compareSentenceA : el.compareSentenceB;
      const download = name === "A" ? el.downloadCompareA : el.downloadCompareB;
      title.textContent = `${slot.role} ${name}`;
      source.textContent = snap ? slotSnapshotLabel(name) : "sem snapshot";
      lock.textContent = slot.locked ? `Desfixar ${name}` : `Fixar ${name}`;
      lock.classList.toggle("active-lock", slot.locked);
      lock.disabled = !snap && !slot.locked;
      update.disabled = slot.locked || !memoryOf(slot).content.trim();
      input.disabled = !snap;
      download.disabled = !snap;
      syncDirtyNotice(name === "A" ? el.dirtyNoticeA : el.dirtyNoticeB, name);
      if (snap) { input.max = String(snap.doc.sentences.length); input.value = String(snap.current + 1); }
    });
    el.alignSentIdBtn.disabled = !(snapshotOf("A") && snapshotOf("B"));
    el.updateBothBtn.disabled = ["A", "B"].every((n) => state.slots[n].locked || !memoryOf(state.slots[n]).content.trim());
    syncCompareLayout();
  }

  function syncCompareLayout() {
    el.sideBySideBtn.classList.toggle("active", state.compareLayout === "side");
    el.stackedBtn.classList.toggle("active", state.compareLayout === "stacked");
    el.compareGrid.classList.toggle("side-by-side", state.compareLayout === "side");
    el.compareGrid.classList.toggle("stacked", state.compareLayout === "stacked");
  }

  function syncDirtyNotice(node, name) {
    const slot = state.slots[name];
    if (!slot.snapshot) { node.hidden = true; node.textContent = ""; return; }
    if (isDirty(name)) {
      node.hidden = false;
      node.className = `pane-dirty-notice${slot.locked ? " fixed" : ""}`;
      node.textContent = slot.locked
        ? `${name} está fixa; há uma memória diferente preservada, mas ela não substitui o snapshot.`
        : `${name} mudou na memória. Esta árvore ainda mostra o snapshot anterior; atualize somente ${name} quando quiser.`;
    } else if (slot.locked) {
      node.hidden = false;
      node.className = "pane-dirty-notice fixed";
      node.textContent = `${name} está fixa como referência.`;
    } else { node.hidden = true; node.textContent = ""; }
  }

  function syncZoomUi() {
    const update = (name, out, reset, inn, fit) => {
      const has = Boolean(snapshotOf(name));
      reset.textContent = `${Math.round(state.slots[name].zoom * 100)}%`;
      out.disabled = !has || state.slots[name].zoom <= 0.3;
      inn.disabled = !has || state.slots[name].zoom >= 3;
      fit.disabled = !has;
    };
    update(state.singleSlot, el.singleZoomOut, el.singleZoomReset, el.singleZoomIn, el.singleZoomFit);
    update(state.continuousSlot, el.continuousZoomOut, el.continuousZoomReset, el.continuousZoomIn, el.continuousZoomFit);
    update("A", el.zoomOutA, el.zoomResetA, el.zoomInA, el.zoomFitA);
    update("B", el.zoomOutB, el.zoomResetB, el.zoomInB, el.zoomFitB);
  }

  function slotSnapshotLabel(name) {
    const snap = snapshotOf(name);
    if (!snap) return "—";
    if (snap.kind === "file") return snap.filename || "arquivo";
    return `texto ${name}`;
  }

  function showValidation(kind, messages, extraCount) {
    el.validationBox.hidden = false;
    el.validationBox.className = `validation-box ${kind}`;
    const title = kind === "error" ? "O CoNLL-U precisa de correção." : kind === "warning" ? "Estado preservado com aviso." : "CoNLL-U válido para visualização.";
    const items = messages.map((m) => `<li>${escapeHtml(m)}</li>`).join("");
    const extra = extraCount ? `<li>… e mais ${extraCount} ocorrência(s).</li>` : "";
    el.validationBox.innerHTML = `<strong>${title}</strong><ul>${items}${extra}</ul>`;
  }

  function getRenderedSvg(name) {
    if (state.viewMode === "compare") return (name === "A" ? el.compareTreeA : el.compareTreeB).querySelector("svg.dependency-tree-svg");
    if (state.viewMode === "single" && name === state.singleSlot) return el.svgwell.querySelector("svg.dependency-tree-svg");
    const snap = snapshotOf(name);
    if (!snap) return null;
    const holder = document.createElement("div");
    return Renderer.render(holder, [snap.doc.sentences[snap.current]], state.features, { showCaptions: false })[0] || null;
  }

  function svgString(svg) {
    const clone = svg.cloneNode(true);
    clone.style.removeProperty("width"); clone.style.removeProperty("height");
    clone.removeAttribute("data-base-width"); clone.removeAttribute("data-base-height");
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg"); clone.setAttribute("version", "1.1");
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
  }

  function downloadSlotSvg(name) {
    const svg = getRenderedSvg(name); if (!svg) return;
    triggerDownload(new Blob([svgString(svg)], { type: "image/svg+xml;charset=utf-8" }), `${baseName(name)}.svg`);
  }

  async function downloadSlotPng(name) {
    const svg = getRenderedSvg(name); if (!svg) return;
    try { triggerDownload(await svgToPng(svg, 3), `${baseName(name)}.png`); }
    catch (error) { showValidation("error", [`Falha ao converter SVG para PNG: ${error.message || error}`]); }
  }

  async function downloadAllSvgZip(name) {
    const snap = snapshotOf(name); if (!snap) return;
    if (snap.doc.sentences.length > 500 && !window.confirm(`Exportar ${snap.doc.sentences.length} SVGs pode consumir bastante memória. Continuar?`)) return;
    el.continuousRenderStatus.textContent = `Preparando ${snap.doc.sentences.length} SVGs…`;
    await nextFrame();
    try {
      const holder = document.createElement("div");
      const svgs = Renderer.render(holder, snap.doc.sentences, state.features, { showCaptions: false });
      const stem = U.safeFilename(snap.kind === "file" && snap.filename ? snap.filename.replace(/\.[^.]+$/, "") : `texto_${name}`, `trees_${name}`);
      const files = svgs.map((svg, i) => ({ name: `${stem}_svg/${String(i + 1).padStart(5, "0")}_${U.safeFilename(snap.doc.descriptors[i].id, "tree")}.svg`, data: svgString(svg) }));
      triggerDownload(Zip.createZip(files), `${stem}_svg.zip`);
      el.continuousRenderStatus.textContent = `${files.length} SVGs exportados.`;
    } catch (error) { el.continuousRenderStatus.textContent = `Falha no ZIP: ${error.message || error}`; }
  }

  function baseName(name) {
    const snap = snapshotOf(name); if (!snap) return `tree_${name}`;
    const d = snap.doc.descriptors[snap.current];
    const stem = snap.kind === "file" && snap.filename ? snap.filename.replace(/\.[^.]+$/, "") : `texto_${name}`;
    return U.safeFilename(`${stem}_${String(snap.current + 1).padStart(4, "0")}_${d.id}`, `tree_${name}`);
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function svgToPng(svg, scale) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([svgString(svg)], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob); const image = new Image();
      image.onload = () => {
        try {
          const width = Number(svg.getAttribute("width")) || 800, height = Number(svg.getAttribute("height")) || 500;
          const canvas = document.createElement("canvas"); canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(height * scale);
          const ctx = canvas.getContext("2d"); ctx.scale(scale, scale); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height); ctx.drawImage(image, 0, 0, width, height);
          canvas.toBlob((png) => { URL.revokeObjectURL(url); png ? resolve(png) : reject(new Error("Canvas vazio.")); }, "image/png");
        } catch (error) { URL.revokeObjectURL(url); reject(error); }
      };
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Falha ao rasterizar SVG.")); };
      image.src = url;
    });
  }

  function renderError(container, error) {
    container.innerHTML = `<div class="render-error"><strong>Não foi possível desenhar esta árvore.</strong><span>${escapeHtml(error.message || String(error))}</span></div>`;
  }

  function formatBytes(bytes) {
    const value = Number(bytes); if (!Number.isFinite(value)) return "";
    if (value < 1024) return `${value} B`; if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  function clamp(v, min, max) { return Math.min(Math.max(Number(v), min), max); }
  function nextFrame() { return new Promise((resolve) => requestAnimationFrame(resolve)); }
  function escapeHtml(value) { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;"); }
  function fatal(message) { document.body.innerHTML = `<main style="max-width:760px;margin:60px auto;padding:24px;font-family:system-ui"><h1>VisCoNLL-U</h1><p>${escapeHtml(message)}</p></main>`; }

  function exposeTestApi() {
    window.__CTV = {
      state,
      setText(name, content) { const s = state.slots[name]; if (s.locked) return false; s.activeKind = "text"; s.text.content = content; persistText(name); syncAllUi(); return true; },
      async update(name) { return updateSlotSnapshot(name); },
      lock(name) { toggleLock(name); },
      mode(mode) { setViewMode(mode); },
      zoom(name, value) { setZoom(name, value); },
      sampleA: SAMPLE_A,
      sampleB: SAMPLE_B,
      dirty: isDirty,
    };
  }
})();
