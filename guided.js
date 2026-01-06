// Guided Practice Generator (MVP)
// Focus: grams of A -> grams of B with 3-factor setup
// Students drag factors into slots and flip orientation for unit cancellation.

let DATA = null;

const state = {
  problem: null,
  slots: [null, null, null] // each slot holds { id, type, top, bottom, flipped }
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

function roundSig(x, sig=4){
  if (x === 0) return 0;
  const p = Math.pow(10, sig - Math.floor(Math.log10(Math.abs(x))) - 1);
  return Math.round(x * p) / p;
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
    <div class="placedLabel muted">${factor.label}</div>
  `;

  return wrap;
}

function renderSlots(){
  const slots = document.getElementById("slots");
  slots.innerHTML = "";

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

    slots.appendChild(slot);
  }

  // Wire flip/clear buttons
  slots.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const slot = Number(btn.dataset.slot);
      if (action === "flip") {
        state.slots[slot].flipped = !state.slots[slot].flipped;
        renderSlots();
      }
      if (action === "clear") {
        state.slots[slot] = null;
        renderSlots();
      }
    });
  });
}

function placeFactor(slotIndex, factorId){
  const factor = state.problem.factorBank.find(f => f.id === factorId);
  if (!factor) return;

  // Place a copy into slot
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
    build the setup to find <strong>grams</strong> of <strong>${prod.sp}</strong> produced (assume excess).`;

  // correct factor requirements by slot:
  // slot 0: mm_in unflipped (1 mol / g)
  // slot 1: ratio unflipped (mol prod / mol react)
  // slot 2: mm_out unflipped (g / mol)
  const correct = [
    { id: "mm_in", flipped: false },
    { id: "ratio", flipped: false },
    { id: "mm_out", flipped: false }
  ];

  return {
    rxn, react, prod,
    givenGrams, mmReact, mmProd,
    prompt,
    factorBank,
    correct
  };
}

function setSetupFeedback(msg, ok=null){
  const box = document.getElementById("setupFeedback");
  box.className = "feedback" + (ok === true ? " good" : ok === false ? " bad" : "");
  box.innerHTML = msg;
}

function checkPath(){
  const a = document.getElementById("convertIn").checked;
  const b = document.getElementById("ratio").checked;
  const c = document.getElementById("convertOut").checked;
  return a && b && c;
}

function checkSetup(){
  if (!checkPath()){
    setSetupFeedback("First, select the full path: <strong>convert → ratio → convert</strong>.", false);
    return;
  }

  for (let i=0; i<3; i++){
    if (!state.slots[i]){
      setSetupFeedback("You still have an empty slot. Drag a factor into <strong>each</strong> slot.", false);
      return;
    }
  }

  const expected = state.problem.correct;
  const errors = [];

  for (let i=0; i<3; i++){
    const placed = state.slots[i];
    const need = expected[i];

    if (placed.id !== need.id){
      errors.push(`Slot ${i+1}: wrong factor type.`);
      continue;
    }
    if (placed.flipped !== need.flipped){
      errors.push(`Slot ${i+1}: correct factor, but it needs to be <strong>${need.flipped ? "flipped" : "not flipped"}</strong> so units cancel.`);
    }
  }

  if (errors.length){
    setSetupFeedback(`❌ Not yet. Fix these:<br><ul>${errors.map(e => `<li>${e}</li>`).join("")}</ul>`, false);
    return;
  }

  setSetupFeedback("✅ Setup correct! Your units cancel properly. Now you can multiply across the top and divide by the bottom.", true);
}

function showCorrectSetup(){
  // Place correct factors into slots automatically
  const need = state.problem.correct;
  state.slots = need.map(req => {
    const f = state.problem.factorBank.find(x => x.id === req.id);
    return { ...f, flipped: req.flipped };
  });
  renderSlots();
  setSetupFeedback("Here’s the correct setup. Notice how the units cancel step-by-step.", null);
}

function renderProblem(){
  document.getElementById("guidedProblemText").innerHTML = state.problem.prompt;

  document.getElementById("givenValue").value = String(state.problem.givenGrams);
  document.getElementById("givenUnit").textContent = `g ${state.problem.react.sp}`;
  document.getElementById("targetUnitTag").textContent = `g ${state.problem.prod.sp}`;

  renderPathChecks();
  renderBank();

  state.slots = [null, null, null];
  renderSlots();

  setSetupFeedback("Drag factors into each slot, then click <strong>Check my setup</strong>.", null);
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

  state.problem = buildGuidedProblem();
  renderProblem();
}

init();
