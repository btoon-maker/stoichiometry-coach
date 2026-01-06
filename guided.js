// Guided Practice Generator
// Focus: grams of reactant -> grams of product with 3-factor setup
// Students drag factors into slots and flip orientation for unit cancellation.
// Step 2 checks setup ONLY (does not show target unit/answer).
// Step 3 teaches grouped multiplication and checks the final numeric answer.

let DATA = null;

const state = {
  problem: null,
  slots: [null, null, null] // each slot holds { id, type, label, top, bottom, flipped }
};

function rnd(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }

function parseEquation(eq) {
  const [lhs, rhs] = eq.split("->").map(s => s.trim());
  const parseSide = (side) => side.split("+").map(part => {
    const p = part.trim();
    const m = p.match(/^(\d+)\s+(.+)$/);
    if (m) return { coef: Number(m[1]), sp: m[2].trim() };
    return { coef: 1, sp: p };
  });
  return { reactants: parseSide(lhs), products: parseSide(rhs) };
}

function makeFactorCard(factor){
  const div = document.createElement("div");
  div.className = "factor";
  div.draggable = true;
  div.dataset.factorId = factor.id;

  div.innerHTML = `
    <div class="factorTitle">${factor.label}</div>
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

function makePlacedFactor(slotIndex, factor){
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

function renderSlots(){
  const slotsWrap = document.getElementById("slots");
  slotsWrap.innerHTML = "";

  for (let i=0; i<3; i++){
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
    if (!current){
      slot.innerHTML = `<div class="slotHint">Drop factor here</div>`;
    } else {
      slot.appendChild(makePlacedFactor(i, current));
    }

    slotsWrap.appendChild(slot);

    // Add × between boxes (but not after the last slot)
    if (i < 2){
      const times = document.createElement("span");
      times.className = "times";
      times.textContent = "×";
      times.setAttribute("aria-hidden", "true");
      slotsWrap.appendChild(times);
    }
  }

  // Wire flip/clear buttons (inside rendered slots)
  slotsWrap.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const slotIndex = Number(btn.dataset.slot);

      if (!Number.isFinite(slotIndex)) return;

      if (action === "flip" && state.slots[slotIndex]){
        state.slots[slotIndex].flipped = !state.slots[slotIndex].flipped;
        renderSlots();
      }
      if (action === "clear"){
        state.slots[slotIndex] = null;
        renderSlots();
      }
    });
  });
}

function placeFactor(slotIndex, factorId){
  const factor = state.problem.factorBank.find(f => f.id === factorId);
  if (!factor) return;

  state.slots[slotIndex] = { ...factor };
  renderSlots();
}

function renderBank(){
  const bank = document.getElementById("bank");
  bank.innerHTML = "";
  state.problem.factorBank.forEach(f => bank.appendChild(makeFactorCard(f)));
}

function renderPathChecks(){
  const wrap = document.getElementById("pathChecks");
  wrap.innerHTML = "";

  const items = [
    { id:"convertIn", label:"Convert to moles (grams → moles)" },
    { id:"ratio", label:"Use mole ratio (balanced equation)" },
    { id:"convertOut", label:"Convert to grams (moles → grams)" }
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

function buildGuidedProblem(){
  const rxn = DATA.reactions[rnd(0, DATA.reactions.length - 1)];
  const parsed = parseEquation(rxn.equation);

  const react = parsed.reactants[rnd(0, parsed.reactants.length - 1)];
  const prod = parsed.products[rnd(0, parsed.products.length - 1)];

  const givenGrams = rnd(6, 40);
  const mmReact = rxn.species[react.sp].molarMass;
  const mmProd = rxn.species[prod.sp].molarMass;

  const ratioTop = `${prod.coef} mol ${prod.sp}`;
  const ratioBottom = `${react.coef} mol ${react.sp}`;

  // correct answer (grams product)
  const correctGrams =
    (givenGrams / mmReact) *
    (prod.coef / react.coef) *
    (mmProd);

  const factorBank = [
    // correct factors
    {
      id: "mm_in",
      type: "mm_in",
      label: "Molar mass (grams → moles)",
      top: `1 mol ${react.sp}`,
      bottom: `${mmReact} g ${react.sp}`,
      flipped: false
    },
    {
      id: "ratio",
      type: "ratio",
      label: "Mole ratio (equation)",
      top: ratioTop,
      bottom: ratioBottom,
      flipped: false
    },
    {
      id: "mm_out",
      type: "mm_out",
      label: "Molar mass (moles → grams)",
      top: `${mmProd} g ${prod.sp}`,
      bottom: `1 mol ${prod.sp}`,
      flipped: false
    },

    // distractors (common mistakes)
    {
      id: "mm_in_wrong",
      type: "mm_in_wrong",
      label: "Wrong molar mass (product)",
      top: `1 mol ${prod.sp}`,
      bottom: `${mmProd} g ${prod.sp}`,
      flipped: false
    },
    {
      id: "ratio_flipped",
      type: "ratio_flipped",
      label: "Mole ratio (flipped)",
      top: ratioBottom,
      bottom: ratioTop,
      flipped: false
    }
  ];

  const prompt = `A reaction occurs: <strong>${rxn.equation}</strong><br>
    If you start with <strong>${givenGrams} g</strong> of <strong>${react.sp}</strong>,
    build the setup to find <strong>grams</strong> of product produced (assume excess).`;

  const correct = [
    { id: "mm_in", flipped: false },
    { id: "ratio", flipped: false },
    { id: "mm_out", flipped: false }
  ];

  return { rxn, react, prod, givenGrams, mmReact, mmProd, prompt, factorBank, correct, correctGrams };
}

function setSetupFeedback(msg, ok=null){
  const box = document.getElementById("setupFeedback");
  box.className = "feedback" + (ok === true ? " good" : ok === false ? " bad" : "");
  box.innerHTML = msg;
}

function setFinalFeedback(msg, ok=null){
  const box = document.getElementById("finalFeedback");
  box.className = "feedback" + (ok === true ? " good" : ok === false ? " bad" : "");
  box.innerHTML = msg;
}

function checkPath(){
  const a = document.getElementById("convertIn").checked;
  const b = document.getElementById("ratio").checked;
  const c = document.getElementById("convertOut").checked;
  return a && b && c;
}

function setupIsCorrect(){
  if (!checkPath()) return false;
  for (let i=0; i<3; i++){
    if (!state.slots[i]) return false;
  }
  const expected = state.problem.correct;
  for (let i=0; i<3; i++){
    const placed = state.slots[i];
    const need = expected[i];
    if (placed.id !== need.id) return false;
    if (placed.flipped !== need.flipped) return false;
  }
  return true;
}

function checkSetup(){
  if (!checkPath()){
    setSetupFeedback("First, select the full path: <strong>convert → ratio → convert</strong>.", false);
    return;
  }

  for (let i=0; i<3; i++){
    if (!state.slots[i]){
      setSetupFeedback("You still have an empty box. Drag a factor into <strong>each</strong> box.", false);
      return;
    }
  }

  const expected = state.problem.correct;
  const errors = [];

  for (let i=0; i<3; i++){
    const placed = state.slots[i];
    const need = expected[i];

    if (placed.id !== need.id){
      errors.push(`Box ${i+1}: wrong factor type.`);
      continue;
    }
    if (placed.flipped !== need.flipped){
      errors.push(`Box ${i+1}: correct factor, but it needs to be <strong>${need.flipped ? "flipped" : "not flipped"}</strong> so units cancel.`);
    }
  }

  if (errors.length){
    setSetupFeedback(`❌ Not yet. Fix these:<br><ul>${errors.map(e => `<li>${e}</li>`).join("")}</ul>`, false);
    return;
  }

  setSetupFeedback("✅ Setup correct! Units cancel properly. Now go to <strong>Step 3</strong> to multiply/divide and check your final answer.", true);
}

function showCorrectSetup(){
  const need = state.problem.correct;
  state.slots = need.map(req => {
    const f = state.problem.factorBank.find(x => x.id === req.id);
    return { ...f, flipped: req.flipped };
  });
  renderSlots();
  setSetupFeedback("Here’s the correct setup. Notice how the units cancel step-by-step.", null);
}

function formatVal(n){
  // show cleaner numbers (molar masses already have 3 decimals in JSON typically)
  const s = Number(n).toString();
  return s;
}

function updateStep3Numbers(){
  // We show the "numbers only" idea based on the correct calculation.
  // Numerators: givenGrams, prodCoef, mmProd (and 1s omitted)
  // Denominators: mmReact, reactCoef (and 1s omitted)
  const g = state.problem.givenGrams;
  const mmR = state.problem.mmReact;
  const mmP = state.problem.mmProd;
  const reactCoef = state.problem.react.coef;
  const prodCoef = state.problem.prod.coef;

  const nums = [g, prodCoef, mmP].filter(v => v !== 1);
  const dens = [mmR, reactCoef].filter(v => v !== 1);

  document.getElementById("numVals").textContent = nums.map(formatVal).join(" × ");
  document.getElementById("denVals").textContent = dens.map(formatVal).join(" × ");

  // Clear final answer box/feedback for new problem
  document.getElementById("finalAnswer").value = "";
  setFinalFeedback("Enter your final number and click <strong>Check my final answer</strong>.", null);
}

function checkFinal(){
  if (!setupIsCorrect()){
    setFinalFeedback("First, make sure your <strong>setup is correct</strong> in Step 2 (units cancel). Then calculate your final number here.", false);
    return;
  }

  const raw = document.getElementById("finalAnswer").value.trim().replace(/,/g, "");
  const userVal = Number(raw);

  if (!Number.isFinite(userVal)){
    setFinalFeedback("Type a number (example: <strong>31.5</strong>).", false);
    return;
  }

  const expected = state.problem.correctGrams;

  // tolerance: 1.5% or 0.05 g (whichever is larger)
  const tol = Math.max(0.05, expected * 0.015);
  const diff = Math.abs(userVal - expected);

  if (diff <= tol){
    setFinalFeedback(`✅ Correct! (Expected about <strong>${expected.toFixed(3)}</strong> g.)`, true);
  } else {
    // gentle nudge: too high/low + likely step issue
    const dir = userVal > expected ? "high" : "low";
    setFinalFeedback(
      `❌ Not yet — your answer is a bit <strong>too ${dir}</strong>.<br>
       Expected about <strong>${expected.toFixed(3)}</strong> g.<br>
       Tip: re-check (1) molar mass placement, (2) mole ratio direction, and (3) that you multiplied all top values and divided by all bottom values.`,
      false
    );
  }
}

function revealFinal(){
  if (!setupIsCorrect()){
    setFinalFeedback("You can reveal the expected answer, but try to get your <strong>setup correct</strong> first so this helps you learn the pattern.", null);
  }
  const expected = state.problem.correctGrams;
  setFinalFeedback(`Expected about <strong>${expected.toFixed(3)}</strong> g. Use this to diagnose where your setup/calculation went off.`, null);
}

function renderProblem(){
  document.getElementById("guidedProblemText").innerHTML = state.problem.prompt;

  document.getElementById("givenValue").value = String(state.problem.givenGrams);
  document.getElementById("givenUnit").textContent = `g ${state.problem.react.sp}`;

  // Step 2: DO NOT show the product/answer unit anymore
  document.getElementById("targetUnitTag").textContent = "final";

  renderPathChecks();
  renderBank();

  state.slots = [null, null, null];
  renderSlots();

  setSetupFeedback("Drag factors into each box, then click <strong>Check my setup</strong>.", null);

  updateStep3Numbers();
}

async function init(){
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
