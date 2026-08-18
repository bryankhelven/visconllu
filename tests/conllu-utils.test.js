const test = require("node:test");
const assert = require("node:assert/strict");
const U = require("../conllu-utils.js");

const DOC = `# sent_id = s1\n# text = Eu vejo.\n1\tEu\teu\tPRON\t_\tNumber=Sing\t2\tnsubj\t_\t_\n2\tvejo\tver\tVERB\t_\tPerson=1\t0\troot\t_\tSpaceAfter=No\n3\t.\t.\tPUNCT\t_\t_\t2\tpunct\t_\t_\n\n# sent_id = s2\n1\tTeste\tteste\tNOUN\t_\tGender=Masc\t0\troot\t_\t_`;

test("splitSentences separa blocos CoNLL-U", () => {
  assert.equal(U.splitSentences(DOC).length, 2);
});

test("validateDocument aceita CoNLL-U válido", () => {
  const result = U.validateDocument(DOC);
  assert.equal(result.valid, true);
  assert.equal(result.tokens, 4);
});

test("validateDocument rejeita linha sem 10 colunas", () => {
  const result = U.validateDocument("1\tOi\t_\tINTJ");
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /10 colunas/);
});

test("validateDocument rejeita HEAD inexistente", () => {
  const bad = "1\tOi\toi\tINTJ\t_\t_\t9\troot\t_\t_";
  const result = U.validateDocument(bad);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => /HEAD=9/.test(e)));
});

test("collectFeatureKeys encontra FEATS e MISC", () => {
  const result = U.collectFeatureKeys(U.splitSentences(DOC));
  assert.deepEqual(result.feats, ["Gender", "Number", "Person"]);
  assert.deepEqual(result.misc, ["SpaceAfter"]);
});

test("reconstructText respeita SpaceAfter=No", () => {
  assert.equal(U.reconstructText(U.splitSentences(DOC)[0]), "Eu vejo.");
});

test("injectShownFeatures substitui metadado anterior", () => {
  const block = "# shownfeatures = FORM\n1\tX\tx\tNOUN\t_\t_\t0\troot\t_\t_";
  const output = U.injectShownFeatures(block, ["FORM", "UPOS"]);
  assert.equal((output.match(/shownfeatures/g) || []).length, 1);
  assert.match(output, /FORM, UPOS/);
});

test("parseSyntacticTokens ignora MWT e preserva relações", () => {
  const block = `# sent_id = mwt\n# text = do teste\n1-2\tdo\t_\t_\t_\t_\t_\t_\t_\t_\n1\tde\tde\tADP\t_\t_\t2\tcase\t_\t_\n2\to\to\tDET\t_\tGender=Masc\t3\tdet\t_\t_\n3\tteste\tteste\tNOUN\t_\t_\t0\troot\t_\t_`;
  const parsed = U.parseSyntacticTokens(block);
  assert.equal(parsed.tokens.length, 3);
  assert.equal(parsed.tokens[0].head, 2);
  assert.equal(parsed.tokens[2].deprel, "root");
  assert.equal(parsed.id, "mwt");
});
