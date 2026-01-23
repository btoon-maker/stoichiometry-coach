let DATA = null;

const state = {
  mode: "stoich",          // "stoich" or "conversion"
  problem: null,
  slotCount: 3,
  slots: []
};

function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}

function parseEquation(eq) {
  const [lhs, rhs] = eq.split("->").map(s => s.trim());

  const parseSide = (side) =>
    side.split("+").map(part => {
      const p = part.trim();
      const m = p.match(/^(\d+)\s+(.+)$/);
      if (m) return { coef: Number(m[1]), sp: m[2].trim() };
      return { coef: 1, sp: p };
    });

  return { reactants: parseSide(lhs), products: parseSide(rhs) };
}

/**
 * Convert only formula digits to subscripts (NOT coefficients).
 */
function chemHTML(text) {
  const s = String(text ?? "");
  return s.replace(/([A-Za-z\)])(\d+)/g, "$1<sub>$2</sub>");
}

function setSetupFeedback(msg, ok = null) {
  const box = document.getElementById("setupFeedback");
  box.className = "feedback" + (ok === true ? " good" : ok === false ? " bad" : "");
  box.innerHTML = msg;
}

function setFinalFeedback(msg, ok = null) {
  const box = document.getElementById("finalFeedback");
  box.className = "feedback" + (ok === true ? " good" : ok === false ? " bad" : "");
  box.innerHTML = msg;
}

function setPathLine(text) {
  const el = document.getElementById("pathLine");
  if (!el) return;
  el.innerHTML = text;
}

// ------------------------------
// Drag factor cards
// ------------------------------
function makeFactorCard(factor) {
  const div = document.createElement("div");
  div.className = "factor";
  div.draggable = true;
  div.dataset.factorId = factor.id;

  div.innerHTML = `
    <div class="frac mini">
      <div class="num">${chemHTML(factor.top)}</div>
      <div class="bar"></div>
      <div class="den">${chemHTML(factor.bottom)}</div>
    </div>
  `;

  div.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", factor.id);
  });

  return div;
}

function renderBank() {
  const bank = document.getElementById("bank");
  bank.innerHTML = "";
  state.problem.factorBank.forEach(f => bank.appendChild(makeFactorCard(f)));
}

function makePlacedFactor(slotIndex, factor) {
  const wrap = document.createElement("div");
  wrap.className = "placed";

  const top = factor.flipped ? factor.bottom : factor.top;
  const bottom = factor.flipped ? factor.top : factor.bottom;

  wrap.innerHTML = `
    <div class="placedInner">
      <div class="frac mini">
        <div class="num">${chemHTML(top)}</div>
        <div class="bar"></div>
        <div class="den">${chemHTML(bottom)}</div>
      </div>
      <div class="placedBtns">
        <button class="btn tiny" data-action="flip" data-slot="${slotIndex}">Flip</button>
        <button class="btn tiny" data-action="clear" data-slot="${slotIndex}">Clear</button>
      </div>
    </div>
  `;

  return wrap;
}

function placeFactor(slotIndex, factorId) {
  const factor = state.problem.factorBank.find(f => f.id === factorId);
  if (!factor) return;
  state.slots[slotIndex] = { ...factor };
  renderSlots();
}

function renderSlots() {
  const slotsWrap = document.getElementById("slots");
  slotsWrap.innerHTML = "";

  const count = state.slotCount;

  for (let i = 0; i < count; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.dataset.slot = String(i);

    slot.addEventListener("dragover", (e) => e.preventDefault());
    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      placeFactor(i, id);
    });

    const current = state.slots[i];
    if (!current) {
      slot.innerHTML = `<div class="slotHint">Drop factor here</div>`;
    } else {
      slot.appendChild(makePlacedFactor(i, current));
    }

    slotsWrap.appendChild(slot);

    if (i < count - 1) {
      const times = document.createElement("span");
      times.className = "times";
      times.textContent = "×";
      times.setAttribute("aria-hidden", "true");
      slotsWrap.appendChild(times);
    }
  }

  slotsWrap.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const slotIndex = Number(btn.dataset.slot);
      if (!Number.isFinite(slotIndex)) return;

      if (action === "flip" && state.slots[slotIndex]) {
        state.slots[slotIndex].flipped = !state.slots[slotIndex].flipped;
        renderSlots();
      }
      if (action === "clear") {
        state.slots[slotIndex] = null;
        renderSlots();
      }
    });
  });
}

// ------------------------------
// Correctness logic
// ------------------------------
function setupIsCorrect() {
  // Must fill all slots shown
  for (let i = 0; i < state.slotCount; i++) if (!state.slots[i]) return false;

  const expected = state.problem.correct;
  if (expected.length !== state.slotCount) return false;

  for (let i = 0; i < state.slotCount; i++) {
    const placed = state.slots[i];
    const need = expected[i];
    if (placed.id !== need.id) return false;
    if (placed.flipped !== need.flipped) return false;
  }
  return true;
}

function checkSetup() {
  // Empty slots?
  for (let i = 0; i < state.slotCount; i++) {
    if (!state.slots[i]) {
      setSetupFeedback("You still have an empty box. Drag a factor into <strong>each</strong> box.", false);
      return;
    }
  }

  const expected = state.problem.correct;
  const errors = [];

  for (let i = 0; i < state.slotCount; i++) {
    const placed = state.slots[i];
    const need = expected[i];

    if (placed.id !== need.id) {
      errors.push(`Box ${i + 1}: wrong factor.`);
      continue;
    }
    if (placed.flipped !== need.flipped) {
      errors.push(
        `Box ${i + 1}: correct factor, but it needs to be <strong>${need.flipped ? "flipped" : "not flipped"}</strong> so units cancel.`
      );
    }
  }

  if (errors.length) {
    setSetupFeedback(`❌ Not yet. Fix these:<br><ul>${errors.map(e => `<li>${e}</li>`).join("")}</ul>`, false);
    return;
  }

  setSetupFeedback("✅ Setup correct! Units cancel properly. Now do the math in <strong>Step 3</strong> and check your final number.", true);
}

function showCorrectSetup() {
  const need = state.problem.correct;
  state.slots = need.map(req => {
    const f = state.problem.factorBank.find(x => x.id === req.id);
    return { ...f, flipped: req.flipped };
  });
  renderSlots();
  setSetupFeedback("Here’s the correct setup. Notice how the units cancel step-by-step.", null);
}

// ------------------------------
// Problem builders
// ------------------------------
function buildStoichProblem() {
  const rxn = DATA.reactions[rnd(0, DATA.reactions.length - 1)];
  const parsed = parseEquation(rxn.equation);

  const react = parsed.reactants[rnd(0, parsed.reactants.length - 1)];
  const prod = parsed.products[rnd(0, parsed.products.length - 1)];

  const givenGrams = rnd(6, 40);

  const mmReact = toNum(rxn.species[react.sp].molarMass);
  const mmProd = toNum(rxn.species[prod.sp].molarMass);

  const ratioTop = `${prod.coef} mol ${prod.sp}`;
  const ratioBottom = `${react.coef} mol ${react.sp}`;

  const correctGrams =
    (givenGrams / mmReact) *
    (prod.coef / react.coef) *
    (mmProd);

  const factorBank = [
    { id: "mm_in", top: `1 mol ${react.sp}`, bottom: `${mmReact} g ${react.sp}`, flipped: false },
    { id: "ratio", top: ratioTop, bottom: ratioBottom, flipped: false },
    { id: "mm_out", top: `${mmProd} g ${prod.sp}`, bottom: `1 mol ${prod.sp}`, flipped: false },

    // distractors
    { id: "mm_in_wrong", top: `1 mol ${prod.sp}`, bottom: `${mmProd} g ${prod.sp}`, flipped: false },
    { id: "ratio_flipped", top: ratioBottom, bottom: ratioTop, flipped: false }
  ];

  const prompt = `A reaction occurs: <strong>${chemHTML(rxn.equation)}</strong><br>
    If you start with <strong>${givenGrams} g</strong> of <strong>${chemHTML(react.sp)}</strong>,
    build the setup to find <strong>grams</strong> of <strong>${chemHTML(prod.sp)}</strong> produced (assume excess).`;

  const correct = [
    { id: "mm_in", flipped: false },
    { id: "ratio", flipped: false },
    { id: "mm_out", flipped: false }
  ];

  return {
    mode: "stoich",
    slotCount: 3,
    prompt,
    factorBank,
    correct,
    correctValue: correctGrams,
    givenValue: givenGrams,
    givenUnitHTML: chemHTML(`g ${react.sp}`),
    targetUnitHTML: chemHTML(`g ${prod.sp}`),
    targetLabel: "g",
    // used for feedback wording:
    expectedUnitName: "g"
  };
}

// Conversion practice: same substance
// Supports grams↔moles, liters(STP)↔moles, and 2-step grams↔liters via moles.
// (You can extend later to particles if you want.)
function buildConversionProblem() {
  const rxn = DATA.reactions[rnd(0, DATA.reactions.length - 1)];
  const parsed = parseEquation(rxn.equation);

  // pick any species from either side
  const all = [...parsed.reactants, ...parsed.products];
  const pick = all[rnd(0, all.length - 1)];
  const sp = pick.sp;

  const mm = toNum(rxn.species[sp].molarMass);

  // choose conversion type
  // 1-step: g->mol, mol->g, L->mol, mol->L
  // 2-step: L->g, g->L
  const types = ["g_to_mol", "mol_to_g", "L_to_mol", "mol_to_L", "L_to_g", "g_to_L"];
  const type = types[rnd(0, types.length - 1)];

  // generate a reasonable given number by type
  let givenValue = 10;
  if (type.includes("mol")) givenValue = Number((Math.random() * 2 + 0.2).toFixed(2)); // 0.20–2.20 mol
  if (type.includes("g_to") || type.includes("L_to")) givenValue = rnd(5, 45);          // 5–45 g or L
  if (type === "mol_to_L") givenValue = Number((Math.random() * 1.5 + 0.2).toFixed(2));

  // Build factors & correct answer
  const factorBank = [];
  const correct = [];

  // Core factors we may need
  const f_g_to_mol = { id: "mm_in", top: `1 mol ${sp}`, bottom: `${mm} g ${sp}`, flipped: false };
  const f_mol_to_g = { id: "mm_out", top: `${mm} g ${sp}`, bottom: `1 mol ${sp}`, flipped: false };

  const f_L_to_mol = { id: "stp_in", top: `1 mol ${sp}`, bottom: `22.4 L ${sp}`, flipped: false };
  const f_mol_to_L = { id: "stp_out", top: `22.4 L ${sp}`, bottom: `1 mol ${sp}`, flipped: false };

  // Distractors
  const d_mm_flipped = { id: "mm_flipped", top: `${mm} g ${sp}`, bottom: `1 mol ${sp}`, flipped: false }; // same as mm_out but labeled as distractor id
  const d_stp_flipped = { id: "stp_flipped", top: `22.4 L ${sp}`, bottom: `1 mol ${sp}`, flipped: false }; // same as stp_out but labeled as distractor id

  // NOTE: We will include real needed factors + some common wrong-direction distractors.
  // We'll also include an "equation ratio" distractor so students don't think it's always needed.
  factorBank.push(
    f_g_to_mol,
    f_mol_to_g,
    f_L_to_mol,
    f_mol_to_L,
    // distractors
    { id: "ratio_distractor", top: `2 mol ${sp}`, bottom: `1 mol ${sp}`, flipped: false },
    { id: "mm_wrong_dir", top: `${mm} g ${sp}`, bottom: `1 mol ${sp}`, flipped: false },
    { id: "stp_wrong_dir", top: `22.4 L ${sp}`, bottom: `1 mol ${sp}`, flipped: false }
  );

  let prompt = "";
  let givenUnitHTML = "";
  let targetUnitHTML = "";
  let correctValue = NaN;

  if (type === "g_to_mol") {
    state.slotCount = 1;
    correct.push({ id: "mm_in", flipped: false });
    correctValue = givenValue / mm;

    prompt = `Convert within one substance (no mole ratio needed).<br>
      If you start with <strong>${givenValue} g</strong> of <strong>${chemHTML(sp)}</strong>,
      build the setup to find <strong>moles</strong> of <strong>${chemHTML(sp)}</strong>.`;

    givenUnitHTML = chemHTML(`g ${sp}`);
    targetUnitHTML = chemHTML(`mol ${sp}`);
  }

  if (type === "mol_to_g") {
    state.slotCount = 1;
    correct.push({ id: "mm_out", flipped: false });
    correctValue = givenValue * mm;

    prompt = `Convert within one substance (no mole ratio needed).<br>
      If you start with <strong>${givenValue} mol</strong> of <strong>${chemHTML(sp)}</strong>,
      build the setup to find <strong>grams</strong> of <strong>${chemHTML(sp)}</strong>.`;

    givenUnitHTML = chemHTML(`mol ${sp}`);
    targetUnitHTML = chemHTML(`g ${sp}`);
  }

  if (type === "L_to_mol") {
    state.slotCount = 1;
    correct.push({ id: "stp_in", flipped: false });
    correctValue = givenValue / 22.4;

    prompt = `Convert within one substance (gas at STP — no mole ratio needed).<br>
      If you start with <strong>${givenValue} L</strong> of <strong>${chemHTML(sp)}</strong> (at STP),
      build the setup to find <strong>moles</strong> of <strong>${chemHTML(sp)}</strong>.`;

    givenUnitHTML = chemHTML(`L ${sp}`);
    targetUnitHTML = chemHTML(`mol ${sp}`);
  }

  if (type === "mol_to_L") {
    state.slotCount = 1;
    correct.push({ id: "stp_out", flipped: false });
    correctValue = givenValue * 22.4;

    prompt = `Convert within one substance (gas at STP — no mole ratio needed).<br>
      If you start with <strong>${givenValue} mol</strong> of <strong>${chemHTML(sp)}</strong>,
      build the setup to find <strong>liters</strong> of <strong>${chemHTML(sp)}</strong> (at STP).`;

    givenUnitHTML = chemHTML(`mol ${sp}`);
    targetUnitHTML = chemHTML(`L ${sp}`);
  }

  if (type === "L_to_g") {
    state.slotCount = 2;
    correct.push({ id: "stp_in", flipped: false });
    correct.push({ id: "mm_out", flipped: false });
    correctValue = (givenValue / 22.4) * mm;

    prompt = `Convert within one substance (gas at STP — no mole ratio needed).<br>
      If you start with <strong>${givenValue} L</strong> of <strong>${chemHTML(sp)}</strong> (at STP),
      build the setup to find <strong>grams</strong> of <strong>${chemHTML(sp)}</strong>.`;

    givenUnitHTML = chemHTML(`L ${sp}`);
    targetUnitHTML = chemHTML(`g ${sp}`);
  }

  if (type === "g_to_L") {
    state.slotCount = 2;
    correct.push({ id: "mm_in", flipped: false });
    correct.push({ id: "stp_out", flipped: false });
    correctValue = (givenValue / mm) * 22.4;

    prompt = `Convert within one substance (gas at STP — no mole ratio needed).<br>
      If you start with <strong>${givenValue} g</strong> of <strong>${chemHTML(sp)}</strong>,
      build the setup to find <strong>liters</strong> of <strong>${chemHTML(sp)}</strong> (at STP).`;

    givenUnitHTML = chemHTML(`g ${sp}`);
    targetUnitHTML = chemHTML(`L ${sp}`);
  }

  // Return in a shared structure used by render + checker
  return {
    mode: "conversion",
    slotCount: state.slotCount,
    prompt,
    factorBank,
    correct,
    correctValue,
    givenValue,
    givenUnitHTML,
    targetUnitHTML,
    expectedUnitName: "unit"
  };
}

// ------------------------------
// Render problem
// ------------------------------
function renderProblem() {
  document.getElementById("guidedProblemText").innerHTML = state.problem.prompt;

  document.getElementById("givenValue").value = String(state.problem.givenValue);
  document.getElementById("givenUnit").innerHTML = state.problem.givenUnitHTML;

  document.getElementById("targetUnitTag").innerHTML = state.problem.targetUnitHTML;

  // Path line (visible to students)
  if (state.problem.mode === "stoich") {
    setPathLine(`<strong>Path:</strong> Convert → Ratio → Convert (3 factors)`);
  } else {
    setPathLine(
      `<strong>Path:</strong> Conversion only (no mole ratio) — ${state.problem.slotCount} factor${state.problem.slotCount === 1 ? "" : "s"}`
    );
  }

  renderBank();

  state.slotCount = state.problem.slotCount;
  state.slots = Array.from({ length: state.slotCount }, () => null);
  renderSlots();

  document.getElementById("finalAnswer").value = "";
  setSetupFeedback("Drag factors into each box, then click <strong>Check my setup</strong>.", null);
  setFinalFeedback("Enter your final number and click <strong>Check my final answer</strong>.", null);
}

// ------------------------------
// Final answer checking
// ------------------------------
function checkFinal() {
  if (!setupIsCorrect()) {
    setFinalFeedback(
      "First, make sure your <strong>setup is correct</strong> in Step 2 (units cancel). Then calculate your final number here.",
      false
    );
    return;
  }

  const raw = document.getElementById("finalAnswer").value.trim().replace(/,/g, "");
  const userVal = Number(raw);

  if (!Number.isFinite(userVal)) {
    setFinalFeedback("Type a number (example: <strong>31.5</strong>).", false);
    return;
  }

  const expected = state.problem.correctValue;

  // tolerance: fixed minimum + percent band
  const tol = Math.max(0.05, Math.abs(expected) * 0.015);
  const diff = Math.abs(userVal - expected);

  if (diff <= tol) {
    setFinalFeedback(`✅ Correct! (Expected about <strong>${expected.toFixed(3)}</strong>.)`, true);
  } else {
    const dir = userVal > expected ? "high" : "low";
    const tip =
      state.problem.mode === "stoich"
        ? "Tip: multiply tops then divide by bottoms, and re-check your mole ratio direction."
        : "Tip: make sure units cancel and check whether your conversion factor needs to be flipped.";

    setFinalFeedback(
      `❌ Not yet — your answer is a bit <strong>too ${dir}</strong>.<br>
       Expected about <strong>${expected.toFixed(3)}</strong>.<br>
       ${tip}`,
      false
    );
  }
}

function revealFinal() {
  const expected = state.problem.correctValue;
  setFinalFeedback(`Expected about <strong>${expected.toFixed(3)}</strong>.`, null);
}

// ------------------------------
// Mode handling + init
// ------------------------------
function buildProblemForMode(mode) {
  if (mode === "conversion") return buildConversionProblem();
  return buildStoichProblem();
}

function applyModeFromUI() {
  const checked = document.querySelector('input[name="practiceMode"]:checked');
  const mode = checked ? checked.value : "stoich";
  state.mode = mode;
}

async function init() {
  const res = await fetch("problems.json");
  DATA = await res.json();

  // Mode selector listeners
  document.querySelectorAll('input[name="practiceMode"]').forEach(r => {
    r.addEventListener("change", () => {
      applyModeFromUI();
      state.problem = buildProblemForMode(state.mode);
      renderProblem();
    });
  });

  document.getElementById("newGuided").addEventListener("click", () => {
    applyModeFromUI();
    state.problem = buildProblemForMode(state.mode);
    renderProblem();
  });

  document.getElementById("checkSetup").addEventListener("click", checkSetup);
  document.getElementById("showCorrectSetup").addEventListener("click", showCorrectSetup);

  document.getElementById("checkFinal").addEventListener("click", checkFinal);
  document.getElementById("revealFinal").addEventListener("click", revealFinal);

  // initial
  applyModeFromUI();
  state.problem = buildProblemForMode(state.mode);
  renderProblem();
}

init();
