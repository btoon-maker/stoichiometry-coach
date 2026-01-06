let DATA = null;

const state = {
  current: null,
  streak: 0,
  correct: 0,
  total: 0,
  hintLevel: 0
};

function parseEquation(eq) {
  // Minimal parser for forms like: "2 H2 + O2 -> 2 H2O"
  // Returns { reactants:[{coef,sp}], products:[{coef,sp}] }
  const [lhs, rhs] = eq.split("->").map(s => s.trim());
  const parseSide = (side) => side.split("+").map(part => {
    const p = part.trim();
    const m = p.match(/^(\d+)\s+(.+)$/);
    if (m) return { coef: Number(m[1]), sp: m[2].trim() };
    return { coef: 1, sp: p };
  });
  return { reactants: parseSide(lhs), products: parseSide(rhs) };
}

function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function roundSig(x, sig=4){
  if (x === 0) return 0;
  const p = Math.pow(10, sig - Math.floor(Math.log10(Math.abs(x))) - 1);
  return Math.round(x * p) / p;
}

function pct(n){ return Math.round(n*100); }

function setFeedback(msg, ok=null){
  const box = document.getElementById("feedback");
  box.className = "feedback" + (ok === true ? " good" : ok === false ? " bad" : "");
  box.innerHTML = msg;
}

function setSteps(html){
  document.getElementById("steps").innerHTML = html;
}

function updateStats(){
  document.getElementById("streak").textContent = String(state.streak);
  const mastery = state.total ? (state.correct / state.total) : 0;
  document.getElementById("mastery").textContent = `${pct(mastery)}%`;
}

function pickProblem() {
  const rxn = DATA.reactions[rnd(0, DATA.reactions.length - 1)];
  const parsed = parseEquation(rxn.equation);

  // Choose type: grams->grams OR grams->moles OR moles->grams
  const types = ["g_to_g", "g_to_mol", "mol_to_g"];
  const type = types[rnd(0, types.length - 1)];

  // choose reactant and product
  const react = parsed.reactants[rnd(0, parsed.reactants.length - 1)];
  const prod = parsed.products[rnd(0, parsed.products.length - 1)];

  // given amount
  const givenGrams = rnd(5, 45);        // grams
  const givenMoles = rnd(1, 6) / 2;     // 0.5 to 3.0 mol

  // compute correct answer
  const mmReact = rxn.species[react.sp].molarMass;
  const mmProd = rxn.species[prod.sp].molarMass;

  // ratio (react -> product)
  const ratio = prod.coef / react.coef;

  let askedUnit = "g";
  let prompt = "";
  let answer = 0;

  if (type === "g_to_g") {
    askedUnit = "g";
    const molReact = givenGrams / mmReact;
    const molProd = molReact * ratio;
    answer = molProd * mmProd;
    prompt = `A reaction occurs: <strong>${rxn.equation}</strong><br>
      If you start with <strong>${givenGrams} g</strong> of <strong>${react.sp}</strong>,
      how many <strong>grams</strong> of <strong>${prod.sp}</strong> can be produced (assume excess of the other reactant)?`;
  } else if (type === "g_to_mol") {
    askedUnit = "mol";
    const molReact = givenGrams / mmReact;
    const molProd = molReact * ratio;
    answer = molProd;
    prompt = `A reaction occurs: <strong>${rxn.equation}</strong><br>
      If you start with <strong>${givenGrams} g</strong> of <strong>${react.sp}</strong>,
      how many <strong>moles</strong> of <strong>${prod.sp}</strong> can be produced (assume excess)?`;
  } else { // mol_to_g
    askedUnit = "g";
    const molReact = givenMoles;
    const molProd = molReact * ratio;
    answer = molProd * mmProd;
    prompt = `A reaction occurs: <strong>${rxn.equation}</strong><br>
      If you start with <strong>${givenMoles} mol</strong> of <strong>${react.sp}</strong>,
      how many <strong>grams</strong> of <strong>${prod.sp}</strong> can be produced (assume excess)?`;
  }

  // store full steps for explanations
  const steps = buildSteps(type, { rxn, react, prod, givenGrams, givenMoles, mmReact, mmProd, ratio });

  // IMPORTANT FIX: include steps on the problem object so Show steps works
  return {
    type,
    rxn,
    react,
    prod,
    givenGrams,
    givenMoles,
    mmReact,
    mmProd,
    ratio,
    askedUnit,
    prompt,
    answer: answer,
    steps: steps
  };
}

function buildSteps(type, ctx){
  const { rxn, react, prod, givenGrams, givenMoles, mmReact, mmProd, ratio } = ctx;

  // Always show convert → ratio → convert
  if (type === "g_to_g") {
    const molReact = givenGrams / mmReact;
    const molProd = molReact * ratio;
    const gramsProd = molProd * mmProd;

    return `
      <div class="stepBox"><strong>Convert:</strong> grams → moles (reactant)<br>
        ${givenGrams} g ${react.sp} × (1 mol / ${mmReact} g) = <strong>${roundSig(molReact)} mol ${react.sp}</strong>
      </div>
      <div class="stepBox"><strong>Ratio:</strong> use coefficients<br>
        ${molReact.toFixed(4)} mol ${react.sp} × (${prod.coef} mol ${prod.sp} / ${react.coef} mol ${react.sp})
        = <strong>${roundSig(molProd)} mol ${prod.sp}</strong>
      </div>
      <div class="stepBox"><strong>Convert:</strong> moles → grams (product)<br>
        ${molProd.toFixed(4)} mol ${prod.sp} × (${mmProd} g / 1 mol) = <strong>${roundSig(gramsProd)} g ${prod.sp}</strong>
      </div>
    `;
  }

  if (type === "g_to_mol") {
    const molReact = givenGrams / mmReact;
    const molProd = molReact * ratio;

    return `
      <div class="stepBox"><strong>Convert:</strong> grams → moles (reactant)<br>
        ${givenGrams} g ${react.sp} × (1 mol / ${mmReact} g) = <strong>${roundSig(molReact)} mol ${react.sp}</strong>
      </div>
      <div class="stepBox"><strong>Ratio:</strong> use coefficients<br>
        ${molReact.toFixed(4)} mol ${react.sp} × (${prod.coef} mol ${prod.sp} / ${react.coef} mol ${react.sp})
        = <strong>${roundSig(molProd)} mol ${prod.sp}</strong>
      </div>
      <div class="stepBox"><strong>Done:</strong> target was moles of product.</div>
    `;
  }

  // mol_to_g
  const molReact = givenMoles;
  const molProd = molReact * ratio;
  const gramsProd = molProd * mmProd;

  return `
    <div class="stepBox"><strong>Start:</strong> already in moles (reactant)<br>
      <strong>${givenMoles} mol ${react.sp}</strong>
    </div>
    <div class="stepBox"><strong>Ratio:</strong> use coefficients<br>
      ${givenMoles} mol ${react.sp} × (${prod.coef} mol ${prod.sp} / ${react.coef} mol ${react.sp})
      = <strong>${roundSig(molProd)} mol ${prod.sp}</strong>
    </div>
    <div class="stepBox"><strong>Convert:</strong> moles → grams (product)<br>
      ${molProd.toFixed(4)} mol ${prod.sp} × (${mmProd} g / 1 mol) = <strong>${roundSig(gramsProd)} g ${prod.sp}</strong>
    </div>
  `;
}

function normalizeNumber(s){
  // accept commas, spaces
  const cleaned = String(s).replace(/,/g,"").trim();
  const v = Number(cleaned);
  return Number.isFinite(v) ? v : null;
}

function checkAnswer(){
  const userVal = normalizeNumber(document.getElementById("answer").value);
  const unit = document.getElementById("unit").value;
  const p = state.current;

  state.total += 1;

  if (userVal === null){
    state.streak = 0;
    setFeedback("Type a number (example: <strong>12.5</strong>).", false);
    updateStats();
    return;
  }

  // Unit check
  if (unit !== p.askedUnit){
    state.streak = 0;
    setFeedback(
      `Your unit is <strong>${unit}</strong>, but the question asked for <strong>${p.askedUnit}</strong>.
       Fix the unit first — then re-check.`,
      false
    );
    updateStats();
    return;
  }

  // Tolerance (student rounding)
  const correct = p.answer;
  const tol = Math.max(0.02 * Math.abs(correct), 0.05); // 2% or 0.05
  const diff = Math.abs(userVal - correct);

  if (diff <= tol){
    state.correct += 1;
    state.streak += 1;
    setFeedback(`✅ Correct! Nice. (Expected about <strong>${roundSig(correct)}</strong> ${unit}.)`, true);
  } else {
    state.streak = 0;

    // targeted nudges
    const ratioOff = Math.abs(userVal - (correct / p.ratio)) <= tol; // crude guess
    const mmMixUp = Math.abs(userVal - (correct * (p.mmReact / p.mmProd))) <= tol;

    let nudge = `Not quite. Expected about <strong>${roundSig(correct)}</strong> ${unit}.`;

    if (p.type.includes("g_to") && !p.type.includes("g_to_mol")) {
      nudge += `<br><span class="muted">Check: did you convert to <strong>moles</strong> before using the mole ratio?</span>`;
    }
    if (ratioOff){
      nudge += `<br><span class="muted">It looks like the <strong>mole ratio</strong> step may be missing or flipped.</span>`;
    }
    if (mmMixUp){
      nudge += `<br><span class="muted">It looks like a <strong>molar mass</strong> may be from the wrong substance.</span>`;
    }

    setFeedback(`❌ ${nudge}`, false);
  }

  updateStats();
}

function showHint(){
  const p = state.current;
  state.hintLevel = Math.min(state.hintLevel + 1, 3);

  if (state.hintLevel === 1){
    setFeedback(
      `Hint 1: Ask yourself: <strong>Do I have moles yet?</strong> If not, convert first.`,
      null
    );
    return;
  }
  if (state.hintLevel === 2){
    setFeedback(
      `Hint 2: Your mole ratio comes from the balanced equation coefficients for <strong>${p.react.sp}</strong> and <strong>${p.prod.sp}</strong>.`,
      null
    );
    return;
  }
  setFeedback(
    `Hint 3: Use <strong>Show steps</strong> and copy the structure, then try a new problem.`,
    null
  );
}

function showSteps(){
  const p = state.current;
  document.getElementById("stepsBox").open = true;
  setSteps(p.steps || "<div class='stepBox'>No steps available for this problem yet.</div>");
}

function newProblem(){
  state.current = pickProblem();
  state.hintLevel = 0;

  document.getElementById("problemText").innerHTML = state.current.prompt;
  document.getElementById("answer").value = "";
  document.getElementById("unit").value = state.current.askedUnit;
  setFeedback("Enter your answer and press <strong>Check</strong>.", null);

  // Clear steps each time
  setSteps("");
  document.getElementById("stepsBox").open = false;
}

async function init(){
  const res = await fetch("problems.json");
  DATA = await res.json();

  document.getElementById("check").addEventListener("click", checkAnswer);
  document.getElementById("hint").addEventListener("click", showHint);
  document.getElementById("showSteps").addEventListener("click", showSteps);
  document.getElementById("newProblem").addEventListener("click", newProblem);

  updateStats();
  newProblem();
}

init();
