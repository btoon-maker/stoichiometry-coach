// guided.js
// Step 2: check setup ONLY (no final unit/answer shown)
// Step 3: student enters final number; "Show expected answer" reveals correct calculated grams

let DATA = null;

const state = {
  problem: null,
  slots: [null, null, null]
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

function renderPathChecks() {
  const wrap = document.getElementById("pathChecks");
  wrap.innerHTML = "";

  const items = [
    { id: "convertIn", label: "Convert to moles (grams → moles)" },
    { id: "ratio", label: "Use mole ratio (balanced equation)" },
    { id: "convertOut", label: "Convert to grams (moles → grams)" }
  ];

  items.forEach(item => {
    const row = document.createElement("label");
    row.className = "checkRow";
    row.innerHTML = `
      <input type="checkbox" id="${item.id}" checked />
      <span><strong>${item.label}</strong></span>
    `;
    wrap.appendChild(row);
  });
}

function checkPath() {
  return (
    document.getElementById("convertIn").checked &&
    document.getElementById("ratio").checked &&
    document.getElementById("convertOut").checked
  );
}

function makeFactorCard(factor) {
  const div = document.createElement("div");
  div.className = "factor";
  div.draggable = true;
  div.dataset.factorId = factor.id;

  // ✅ No titles (per request)
  div.innerHTML = `
    <div class="frac mini">
      <div class="num">${factor.top}</div>
      <div class="bar"></div>
      <div class="den">${factor.bottom}</div>
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
        <div class="num">${top}</div>
        <div class="bar"></div>
        <div class="den">${bottom}</div>
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

  for (let i = 0; i < 3; i++) {
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

    if (i < 2) {
      const times = document.createElement("span");
      times.className = "times";
      times.textContent = "×";
      times.setAttribute("aria-hidden", "true");
      slotsWrap.appendChild(times);
    }
  }

  // wire buttons
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

function setupIsCorrect() {
  if (!checkPath()) return false;
  for (let i = 0; i < 3; i++) if (!state.slots[i]) return false;

  const expected = state.problem.correct;
  for (let i = 0; i < 3; i++) {
    const placed = state.slots[i];
    const need = expected[i];
    if (placed.id !== need.id) return false;
    if (placed.flipped !== need.flipped) return false;
  }
  return true;
}

function checkSetup() {
  if (!checkPath()) {
    setSetupFeedback("First, select the full path: <strong>convert → ratio → convert</strong>.", false);
    return;
  }

  for (let i = 0; i < 3; i++) {
    if (!state.slots[i]) {
      setSetupFeedback("You still have an empty box. Drag a factor into <strong>each</strong> box.", false);
      return;
    }
  }

  const expected = state.problem.correct;
  const errors = [];

  for (let i = 0; i < 3; i++) {
    const placed = state.slots[i];
    const need = expected[i];

    if (placed.id !== need.id) {
      errors.push(`Box ${i + 1}: wrong factor.`);
      continue;
    }
    if (placed.flipped !== need.flipped) {
      errors.push(`Box ${i + 1}: correct factor, but it needs to be <strong>${need.flipped ? "flipped" : "not flipped"}</strong> so units cancel.`);
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

function buildGuidedProblem() {
  const rxn = DATA.reactions[rnd(0, DATA.reactions.length - 1)];
  const parsed = parseEquation(rxn.equation);

  const react = parsed.reactants[rnd(0, parsed.reactants.length - 1)];
  const prod = parsed.products[rnd(0, parsed.products.length - 1)];

  const givenGrams = rnd(6, 40);

  const mmReact = toNum(rxn.species[react.sp].molarMass);
  const mmProd = toNum(rxn.species[prod.sp].molarMass);

  // Robust guard
  if (!Number.isFinite(mmReact) || !Number.isFinite(mmProd)) {
    throw new Error("Invalid molar mass data in problems.json for selected species.");
  }

  const ratioTop = `${prod.coef} mol ${prod.sp}`;
  const ratioBottom = `${react.coef} mol ${react.sp}`;

  const correctGrams =
    (givenGrams / mmReact) *
    (prod.coef / react.coef) *
    (mmProd);

  const factorBank = [
    {
      id: "mm_in",
      type: "mm_in",
      top: `1 mol ${react.sp}`,
      bottom: `${mmReact} g ${react.sp}`,
      flipped: false
    },
    {
      id: "ratio",
      type: "ratio",
      top: ratioTop,
      bottom: ratioBottom,
      flipped: false
    },
    {
      id: "mm_out",
      type: "mm_out",
      top: `${mmProd} g ${prod.sp}`,
      bottom: `1 mol ${prod.sp}`,
      flipped: false
    },

    // distractors
    {
      id: "mm_in_wrong",
      type: "mm_in_wrong",
      top: `1 mol ${prod.sp}`,
      bottom: `${mmProd} g ${prod.sp}`,
      flipped: false
    },
    {
      id: "ratio_flipped",
      type: "ratio_flipped",
      top: ratioBottom,
      bottom: ratioTop,
      flipped: false
    }
  ];

  const prompt = `A reaction occurs: <strong>${rxn.equation}</strong><br>
    If you start with <strong>${givenGrams} g</strong> of <strong>${react.sp}</strong>,
    build the setup to find <strong>grams</strong> of <strong>${prod.sp}</strong> produced (assume excess).`;

  const correct = [
    { id: "mm_in", flipped: false },
    { id: "ratio", flipped: false },
    { id: "mm_out", flipped: false }
  ];

  return { rxn, react, prod, givenGrams, mmReact, mmProd, prompt, factorBank, correct, correctGrams };
}

function renderProblem() {
  document.getElementById("guidedProblemText").innerHTML = state.problem.prompt;

  document.getElementById("givenValue").value = String(state.problem.givenGrams);
  document.getElementById("givenUnit").textContent = `g ${state.problem.react.sp}`;

  // Step 2 neutral
  document.getElementById("targetUnitTag").textContent = "final";

  renderPathChecks();
  renderBank();

  state.slots = [null, null, null];
  renderSlots();

  document.getElementById("finalAnswer").value = "";
  setSetupFeedback("Drag factors into each box, then click <strong>Check my setup</strong>.", null);
  setFinalFeedback("Enter your final number and click <strong>Check my final answer</strong>.", null);
}

function checkFinal() {
  if (!setupIsCorrect()) {
    setFinalFeedback("First, make sure your <strong>setup is correct</strong> in Step 2 (units cancel). Then calculate your final number here.", false);
    return;
  }

  const raw = document.getElementById("finalAnswer").value.trim().replace(/,/g, "");
  const userVal = Number(raw);

  if (!Number.isFinite(userVal)) {
    setFinalFeedback("Type a number (example: <strong>31.5</strong>).", false);
    return;
  }

  const expected = state.problem.correctGrams;
  const tol = Math.max(0.05, expected * 0.015);
  const diff = Math.abs(userVal - expected);

  if (diff <= tol) {
    setFinalFeedback(`✅ Correct! (Expected about <strong>${expected.toFixed(3)}</strong> g.)`, true);
  } else {
    const dir = userVal > expected ? "high" : "low";
    setFinalFeedback(
      `❌ Not yet — your answer is a bit <strong>too ${dir}</strong>.<br>
       Expected about <strong>${expected.toFixed(3)}</strong> g.<br>
       Tip: re-check (1) molar mass placement, (2) mole ratio direction, and (3) multiply tops then divide by bottoms.`,
      false
    );
  }
}

function revealFinal() {
  // ✅ Always shows the correct expected answer for the current problem
  const expected = state.problem.correctGrams;
  setFinalFeedback(`Expected about <strong>${expected.toFixed(3)}</strong> g.`, null);
}

async function init() {
  const res = await fetch("problems.json");
  DATA = await res.json();

  document.getElementById("newGuided").addEventListener("click", () => {
    state.problem = buildGuidedProblem();
    renderProblem();
  });

  document.getElementById("checkSetup").addEventListener("click", checkSetup);
  document.getElementById("showCorrectSetup").addEventListener("click", showCorrectSetup);

  document.getElementById("checkFinal").addEventListener("click", checkFinal);
  document.getElementById("revealFinal").addEventListener("click", revealFinal);

  state.problem = buildGuidedProblem();
  renderProblem();
}

init();
