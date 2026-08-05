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
// Factor cards: drag, touch, and keyboard placement
// ------------------------------
function displayedSides(factor) {
  return factor.flipped
    ? { top: factor.bottom, bottom: factor.top }
    : { top: factor.top, bottom: factor.bottom };
}

function makeFactorCard(factor) {
  const div = document.createElement("div");
  div.className = "factor";
  div.draggable = true;
  div.dataset.factorId = factor.id;
  div.setAttribute("role", "group");
  div.setAttribute(
    "aria-label",
    `Conversion factor. Numerator ${factor.top}. Denominator ${factor.bottom}.`
  );

  const boxButtons = Array.from({ length: state.slotCount }, (_, slotIndex) => `
    <button
      type="button"
      class="btn tiny factorPlaceBtn"
      data-factor-id="${factor.id}"
      data-slot="${slotIndex}"
      aria-label="Place this factor in Box ${slotIndex + 1}"
    >
      Box ${slotIndex + 1}
    </button>
  `).join("");

  div.innerHTML = `
    <div class="factorFraction" aria-hidden="true">
      <div class="frac mini">
        <div class="num">${chemHTML(factor.top)}</div>
        <div class="bar"></div>
        <div class="den">${chemHTML(factor.bottom)}</div>
      </div>
    </div>
    <div class="factorPlaceLabel">Place in:</div>
    <div class="factorActions">${boxButtons}</div>
  `;

  div.addEventListener("dragstart", (e) => {
    e.dataTransfer.setData("text/plain", factor.id);
    e.dataTransfer.effectAllowed = "copy";
  });

  div.querySelectorAll(".factorPlaceBtn").forEach(button => {
    button.addEventListener("click", () => {
      const slotIndex = Number(button.dataset.slot);
      placeFactor(slotIndex, button.dataset.factorId);
      setSetupFeedback(`Placed the selected factor in <strong>Box ${slotIndex + 1}</strong>.`, null);
    });
  });

  return div;
}

function renderBank() {
  const bank = document.getElementById("bank");
  bank.innerHTML = "";
  state.problem.factorBank.forEach(factor => bank.appendChild(makeFactorCard(factor)));
}

function makePlacedFactor(slotIndex, factor) {
  const wrap = document.createElement("div");
  wrap.className = "placed";

  const { top, bottom } = displayedSides(factor);

  wrap.innerHTML = `
    <div class="placedInner">
      <div
        class="frac mini"
        role="img"
        aria-label="Numerator ${top}. Denominator ${bottom}."
      >
        <div class="num" aria-hidden="true">${chemHTML(top)}</div>
        <div class="bar" aria-hidden="true"></div>
        <div class="den" aria-hidden="true">${chemHTML(bottom)}</div>
      </div>
      <div class="placedBtns">
        <button type="button" class="btn tiny" data-action="flip" data-slot="${slotIndex}">Flip</button>
        <button type="button" class="btn tiny" data-action="clear" data-slot="${slotIndex}">Clear</button>
      </div>
    </div>
  `;

  return wrap;
}

function placeFactor(slotIndex, factorId) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= state.slotCount) return;

  const factor = state.problem.factorBank.find(item => item.id === factorId);
  if (!factor) return;

  state.slots[slotIndex] = { ...factor };
  renderSlots();
}

function renderSlots() {
  const slotsWrap = document.getElementById("slots");
  slotsWrap.innerHTML = "";

  for (let i = 0; i < state.slotCount; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.dataset.slot = String(i);
    slot.setAttribute("role", "group");
    slot.setAttribute("aria-label", `Factor Box ${i + 1}`);

    slot.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });

    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain");
      placeFactor(i, id);
      setSetupFeedback(`Placed the selected factor in <strong>Box ${i + 1}</strong>.`, null);
    });

    const current = state.slots[i];
    if (!current) {
      slot.innerHTML = `
        <div class="slotHint">
          <strong>Box ${i + 1}</strong><br />
          Drop a factor here or use a Box ${i + 1} button below.
        </div>
      `;
    } else {
      slot.appendChild(makePlacedFactor(i, current));
    }

    slotsWrap.appendChild(slot);

    if (i < state.slotCount - 1) {
      const times = document.createElement("span");
      times.className = "times";
      times.textContent = "×";
      times.setAttribute("aria-hidden", "true");
      slotsWrap.appendChild(times);
    }
  }

  slotsWrap.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      const slotIndex = Number(button.dataset.slot);
      if (!Number.isInteger(slotIndex)) return;

      if (action === "flip" && state.slots[slotIndex]) {
        state.slots[slotIndex].flipped = !state.slots[slotIndex].flipped;
        renderSlots();
        setSetupFeedback(`Flipped the factor in <strong>Box ${slotIndex + 1}</strong>.`, null);
      }

      if (action === "clear") {
        state.slots[slotIndex] = null;
        renderSlots();
        setSetupFeedback(`Cleared <strong>Box ${slotIndex + 1}</strong>.`, null);
      }
    });
  });
}

// ------------------------------
// Correctness logic
// ------------------------------
function normalizeFactorText(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function factorSignature(factor) {
  const { top, bottom } = displayedSides(factor);
  return `${normalizeFactorText(top)}|||${normalizeFactorText(bottom)}`;
}

function inverseSignature(factor) {
  const { top, bottom } = displayedSides(factor);
  return `${normalizeFactorText(bottom)}|||${normalizeFactorText(top)}`;
}

function expectedDisplayedFactors() {
  return state.problem.correct.map(requirement => {
    const source = state.problem.factorBank.find(factor => factor.id === requirement.id);
    if (!source) throw new Error(`Missing expected factor: ${requirement.id}`);
    return { ...source, flipped: requirement.flipped };
  });
}

function compareSetup() {
  const emptySlots = [];
  state.slots.forEach((factor, index) => {
    if (!factor) emptySlots.push(index);
  });

  if (emptySlots.length) {
    return { ok: false, emptySlots, unmatchedPlaced: [] };
  }

  const remainingExpected = expectedDisplayedFactors().map(factorSignature);
  const unmatchedPlaced = [];

  state.slots.forEach((factor, slotIndex) => {
    const signature = factorSignature(factor);
    const matchIndex = remainingExpected.indexOf(signature);

    if (matchIndex >= 0) {
      remainingExpected.splice(matchIndex, 1);
    } else {
      unmatchedPlaced.push({ factor, slotIndex });
    }
  });

  return {
    ok: unmatchedPlaced.length === 0 && remainingExpected.length === 0,
    emptySlots: [],
    unmatchedPlaced,
    remainingExpected
  };
}

function setupIsCorrect() {
  return compareSetup().ok;
}

function checkSetup() {
  const comparison = compareSetup();

  if (comparison.emptySlots.length) {
    const boxes = comparison.emptySlots.map(index => index + 1).join(", ");
    setSetupFeedback(
      `Complete every factor box before checking. Empty box${comparison.emptySlots.length === 1 ? "" : "es"}: <strong>${boxes}</strong>.`,
      false
    );
    return;
  }

  if (comparison.ok) {
    setSetupFeedback(
      "✅ Setup correct! The displayed factors are mathematically equivalent and the units cancel properly. Now do the math in <strong>Step 3</strong>.",
      true
    );
    return;
  }

  const expectedSignatures = expectedDisplayedFactors().map(factorSignature);
  const errors = comparison.unmatchedPlaced.map(({ factor, slotIndex }) => {
    if (expectedSignatures.includes(inverseSignature(factor))) {
      return `Box ${slotIndex + 1}: this factor is upside down. Select <strong>Flip</strong>.`;
    }
    return `Box ${slotIndex + 1}: this displayed factor is not needed for the requested path.`;
  });

  setSetupFeedback(
    `❌ Not yet. Check the following:<ul>${errors.map(error => `<li>${error}</li>`).join("")}</ul>`,
    false
  );
}

function showCorrectSetup() {
  state.slots = expectedDisplayedFactors();
  renderSlots();
  setSetupFeedback(
    "Here’s one correct setup. Equivalent factors and a different factor order will also be accepted when the units cancel correctly.",
    null
  );
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
  // Choose the pathway first so liter-based questions can be limited to gases at STP.
  const types = ["g_to_mol", "mol_to_g", "L_to_mol", "mol_to_L", "L_to_g", "g_to_L"];
  const type = types[rnd(0, types.length - 1)];
  const usesGasVolume = type.includes("L");

  const candidates = [];

  DATA.reactions.forEach(rxn => {
    const parsed = parseEquation(rxn.equation);
    const uniqueSpecies = [...new Set(
      [...parsed.reactants, ...parsed.products].map(item => item.sp)
    )];

    uniqueSpecies.forEach(sp => {
      const speciesData = rxn.species[sp];
      if (!speciesData) return;

      // Require an explicit true flag for any liters-at-STP problem.
      if (usesGasVolume && speciesData.gasAtSTP !== true) return;

      candidates.push({ rxn, sp, speciesData });
    });
  });

  if (!candidates.length) {
    throw new Error("No eligible substances are available for this conversion type.");
  }

  const choice = candidates[rnd(0, candidates.length - 1)];
  const sp = choice.sp;
  const mm = toNum(choice.speciesData.molarMass);

  let givenValue = 10;
  if (type.includes("mol")) {
    givenValue = Number((Math.random() * 2 + 0.2).toFixed(2));
  }
  if (type.includes("g_to") || type.includes("L_to")) {
    givenValue = rnd(5, 45);
  }
  if (type === "mol_to_L") {
    givenValue = Number((Math.random() * 1.5 + 0.2).toFixed(2));
  }

  const factorBank = [];
  const correct = [];

  const f_g_to_mol = {
    id: "mm_in",
    top: `1 mol ${sp}`,
    bottom: `${mm} g ${sp}`,
    flipped: false
  };
  const f_mol_to_g = {
    id: "mm_out",
    top: `${mm} g ${sp}`,
    bottom: `1 mol ${sp}`,
    flipped: false
  };
  const f_L_to_mol = {
    id: "stp_in",
    top: `1 mol ${sp}`,
    bottom: `22.4 L ${sp}`,
    flipped: false
  };
  const f_mol_to_L = {
    id: "stp_out",
    top: `22.4 L ${sp}`,
    bottom: `1 mol ${sp}`,
    flipped: false
  };

  factorBank.push(f_g_to_mol, f_mol_to_g);

  // Only show gas-volume factors for substances that are gases at STP.
  if (choice.speciesData.gasAtSTP === true) {
    factorBank.push(f_L_to_mol, f_mol_to_L);
  }

  factorBank.push({
    id: "ratio_distractor",
    top: `2 mol ${sp}`,
    bottom: `1 mol ${sp}`,
    flipped: false
  });

  let prompt = "";
  let givenUnitHTML = "";
  let targetUnitHTML = "";
  let correctValue = NaN;
  let slotCount = 1;

  if (type === "g_to_mol") {
    slotCount = 1;
    correct.push({ id: "mm_in", flipped: false });
    correctValue = givenValue / mm;
    prompt = `Convert within one substance (no mole ratio needed).<br>
      If you start with <strong>${givenValue} g</strong> of <strong>${chemHTML(sp)}</strong>,
      build the setup to find <strong>moles</strong> of <strong>${chemHTML(sp)}</strong>.`;
    givenUnitHTML = chemHTML(`g ${sp}`);
    targetUnitHTML = chemHTML(`mol ${sp}`);
  }

  if (type === "mol_to_g") {
    slotCount = 1;
    correct.push({ id: "mm_out", flipped: false });
    correctValue = givenValue * mm;
    prompt = `Convert within one substance (no mole ratio needed).<br>
      If you start with <strong>${givenValue} mol</strong> of <strong>${chemHTML(sp)}</strong>,
      build the setup to find <strong>grams</strong> of <strong>${chemHTML(sp)}</strong>.`;
    givenUnitHTML = chemHTML(`mol ${sp}`);
    targetUnitHTML = chemHTML(`g ${sp}`);
  }

  if (type === "L_to_mol") {
    slotCount = 1;
    correct.push({ id: "stp_in", flipped: false });
    correctValue = givenValue / 22.4;
    prompt = `Convert within one substance (gas at STP — no mole ratio needed).<br>
      If you start with <strong>${givenValue} L</strong> of <strong>${chemHTML(sp)}</strong> (at STP),
      build the setup to find <strong>moles</strong> of <strong>${chemHTML(sp)}</strong>.`;
    givenUnitHTML = chemHTML(`L ${sp}`);
    targetUnitHTML = chemHTML(`mol ${sp}`);
  }

  if (type === "mol_to_L") {
    slotCount = 1;
    correct.push({ id: "stp_out", flipped: false });
    correctValue = givenValue * 22.4;
    prompt = `Convert within one substance (gas at STP — no mole ratio needed).<br>
      If you start with <strong>${givenValue} mol</strong> of <strong>${chemHTML(sp)}</strong>,
      build the setup to find <strong>liters</strong> of <strong>${chemHTML(sp)}</strong> (at STP).`;
    givenUnitHTML = chemHTML(`mol ${sp}`);
    targetUnitHTML = chemHTML(`L ${sp}`);
  }

  if (type === "L_to_g") {
    slotCount = 2;
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
    slotCount = 2;
    correct.push({ id: "mm_in", flipped: false });
    correct.push({ id: "stp_out", flipped: false });
    correctValue = (givenValue / mm) * 22.4;
    prompt = `Convert within one substance (gas at STP — no mole ratio needed).<br>
      If you start with <strong>${givenValue} g</strong> of <strong>${chemHTML(sp)}</strong>,
      build the setup to find <strong>liters</strong> of <strong>${chemHTML(sp)}</strong> (at STP).`;
    givenUnitHTML = chemHTML(`g ${sp}`);
    targetUnitHTML = chemHTML(`L ${sp}`);
  }

  return {
    mode: "conversion",
    slotCount,
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

  state.slotCount = state.problem.slotCount;
  state.slots = Array.from({ length: state.slotCount }, () => null);

  renderBank();
  renderSlots();

  document.getElementById("finalAnswer").value = "";
  setSetupFeedback(
    "Drag factors into the boxes or use the <strong>Box buttons</strong>, then select <strong>Check my setup</strong>.",
    null
  );
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
  try {
    const res = await fetch("problems.json");
    if (!res.ok) throw new Error(`Unable to load problems.json (${res.status}).`);
    DATA = await res.json();
  } catch (error) {
    console.error(error);
    setSetupFeedback(
      "The practice problems could not be loaded. Refresh the page or contact your teacher if the problem continues.",
      false
    );
    return;
  }

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
