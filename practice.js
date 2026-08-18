let DATA = null;

const STP = 22.4; // L per mol at STP

const state = {
  current: null,
  streak: 0,
  correct: 0,
  total: 0,
  hintLevel: 0,
  activeFocus: "mixed",
  pendingFocus: null
};

// Convert only formula digits to subscripts (NOT coefficients).
function chemHTML(text) {
  const s = String(text ?? "");
  return s.replace(/([A-Za-z\)])(\d+)/g, "$1<sub>$2</sub>");
}

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

function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function choice(arr) {
  return arr[rnd(0, arr.length - 1)];
}

function roundSig(x, sig = 4) {
  if (x === 0) return 0;
  const p = Math.pow(10, sig - Math.floor(Math.log10(Math.abs(x))) - 1);
  return Math.round(x * p) / p;
}

function pct(n) { return Math.round(n * 100); }

function setFeedback(msg, ok = null) {
  const box = document.getElementById("feedback");
  box.className = "feedback" + (ok === true ? " good" : ok === false ? " bad" : "");
  box.innerHTML = msg;
}

function setSteps(html) {
  document.getElementById("steps").innerHTML = html;
}

function updateStats() {
  document.getElementById("streak").textContent = String(state.streak);
  const mastery = state.total ? (state.correct / state.total) : 0;
  document.getElementById("mastery").textContent = `${pct(mastery)}%`;
}

function normalizeNumber(s) {
  const cleaned = String(s).replace(/,/g, "").trim();
  const v = Number(cleaned);
  return Number.isFinite(v) ? v : null;
}

// -------------------------------
// Problem picking (controlled random)
// -------------------------------
function getFocus() {
  const el = document.getElementById("focus");
  return el ? el.value : "mixed";
}

function weightedPickType(focus) {
  // Conversion-only types (same substance, no mole ratio)
  const conversionTypes = [
    "conv_g_to_mol",
    "conv_mol_to_g",
    "conv_L_to_mol",
    "conv_mol_to_L",
    "conv_L_to_g", // 2-step
    "conv_g_to_L"  // 2-step
  ];

  // Stoichiometry types (between substances; no particles)
  const stoichTypes = [
    "sto_g_to_g",
    "sto_g_to_mol",
    "sto_mol_to_g",
    "sto_L_to_g",
    "sto_g_to_L",
    "sto_L_to_L"
  ];

  if (focus === "conversion") return choice(conversionTypes);
  if (focus === "stoich") return choice(stoichTypes);

  // mixed: slight preference toward stoich
  const r = Math.random();
  if (r < 0.4) return choice(conversionTypes); // 40%
  return choice(stoichTypes);                   // 60%
}

function pickConversionContext(type) {
  const usesGasVolume = type.includes("_L");

  const eligibleReactions = DATA.reactions
    .map(rxn => {
      const parsed = parseEquation(rxn.equation);
      const allSpecies = [...parsed.reactants, ...parsed.products];
      const eligibleSpecies = allSpecies.filter(item => {
        if (!usesGasVolume) return true;
        return rxn.species[item.sp]?.gasAtSTP === true;
      });

      return { rxn, parsed, eligibleSpecies };
    })
    .filter(item => item.eligibleSpecies.length > 0);

  if (!eligibleReactions.length) {
    throw new Error(`No eligible conversion species found for problem type: ${type}`);
  }

  const context = choice(eligibleReactions);
  const single = choice(context.eligibleSpecies);

  return {
    rxn: context.rxn,
    parsed: context.parsed,
    single
  };
}

function pickStoichiometryContext(type) {
  const needsGasReactant =
    type === "sto_L_to_g" || type === "sto_L_to_L";
  const needsGasProduct =
    type === "sto_g_to_L" || type === "sto_L_to_L";

  const eligibleReactions = DATA.reactions
    .map(rxn => {
      const parsed = parseEquation(rxn.equation);

      const eligibleReactants = parsed.reactants.filter(item => {
        if (!needsGasReactant) return true;
        return rxn.species[item.sp]?.gasAtSTP === true;
      });

      const eligibleProducts = parsed.products.filter(item => {
        if (!needsGasProduct) return true;
        return rxn.species[item.sp]?.gasAtSTP === true;
      });

      return {
        rxn,
        parsed,
        eligibleReactants,
        eligibleProducts
      };
    })
    .filter(item =>
      item.eligibleReactants.length > 0 &&
      item.eligibleProducts.length > 0
    );

  if (!eligibleReactions.length) {
    throw new Error(`No eligible stoichiometry species found for problem type: ${type}`);
  }

  const context = choice(eligibleReactions);

  return {
    rxn: context.rxn,
    parsed: context.parsed,
    react: choice(context.eligibleReactants),
    prod: choice(context.eligibleProducts)
  };
}

function pickProblem() {
  const focus = getFocus();
  const type = weightedPickType(focus);
  const mode = type.startsWith("conv_") ? "conversion" : "stoich";

  let rxn;
  let parsed;
  let react;
  let prod;
  let single;

  if (mode === "conversion") {
    const context = pickConversionContext(type);
    rxn = context.rxn;
    parsed = context.parsed;
    single = context.single;

    // These are carried on the problem object for shared helpers,
    // but conversion problems use only the selected single species.
    react = choice(parsed.reactants);
    prod = choice(parsed.products);
  } else {
    const context = pickStoichiometryContext(type);
    rxn = context.rxn;
    parsed = context.parsed;
    react = context.react;
    prod = context.prod;

    // Keep a single-species value available for the shared problem object.
    single = choice([...parsed.reactants, ...parsed.products]);
  }

  const mmReact = Number(rxn.species[react.sp].molarMass);
  const mmProd = Number(rxn.species[prod.sp].molarMass);
  const ratio = prod.coef / react.coef;

  const sp = single.sp;
  const mmSingle = Number(rxn.species[sp].molarMass);

  // Values
  const givenGrams = rnd(5, 45);
  const givenLiters = rnd(5, 60); // STP liters
  const givenMoles = Number((Math.random() * 1.8 + 0.2).toFixed(2)); // 0.20–2.00 mol

  let askedUnit = "g";
  let prompt = "";
  let answer = 0;

  // mode was set above so hints and feedback match the problem type.

  // --------------------
  // Conversion-only (same substance)
  // --------------------
  if (type === "conv_g_to_mol") {
    askedUnit = "mol";
    answer = givenGrams / mmSingle;

    prompt = `Conversion practice (same substance).<br><br>
      If you start with <strong>${givenGrams} g</strong> of <strong>${chemHTML(sp)}</strong>,<br>
      how many <strong>moles</strong> of <strong>${chemHTML(sp)}</strong> is that?`;

    return finalizeProblem({ type, mode, rxn, react, prod, sp, mmSingle, givenGrams, givenMoles, givenLiters, mmReact, mmProd, ratio, askedUnit, prompt, answer });
  }

  if (type === "conv_mol_to_g") {
    askedUnit = "g";
    answer = givenMoles * mmSingle;

    prompt = `Conversion practice (same substance).<br><br>
      If you start with <strong>${givenMoles} mol</strong> of <strong>${chemHTML(sp)}</strong>,<br>
      how many <strong>grams</strong> of <strong>${chemHTML(sp)}</strong> is that?`;

    return finalizeProblem({ type, mode, rxn, react, prod, sp, mmSingle, givenGrams, givenMoles, givenLiters, mmReact, mmProd, ratio, askedUnit, prompt, answer });
  }

  if (type === "conv_L_to_mol") {
    askedUnit = "mol";
    answer = givenLiters / STP;

    prompt = `Conversion practice (gas at STP).<br><br>
      If you start with <strong>${givenLiters} L</strong> of <strong>${chemHTML(sp)}</strong> (at STP),<br>
      how many <strong>moles</strong> of <strong>${chemHTML(sp)}</strong> is that?`;

    return finalizeProblem({ type, mode, rxn, react, prod, sp, mmSingle, givenGrams, givenMoles, givenLiters, mmReact, mmProd, ratio, askedUnit, prompt, answer });
  }

  if (type === "conv_mol_to_L") {
    askedUnit = "L";
    answer = givenMoles * STP;

    prompt = `Conversion practice (gas at STP).<br><br>
      If you start with <strong>${givenMoles} mol</strong> of <strong>${chemHTML(sp)}</strong>,<br>
      what volume is that in <strong>liters</strong> at STP?`;

    return finalizeProblem({ type, mode, rxn, react, prod, sp, mmSingle, givenGrams, givenMoles, givenLiters, mmReact, mmProd, ratio, askedUnit, prompt, answer });
  }

  if (type === "conv_L_to_g") {
    askedUnit = "g";
    const mol = givenLiters / STP;
    answer = mol * mmSingle;

    prompt = `Conversion practice (gas at STP; two steps).<br><br>
      If you start with <strong>${givenLiters} L</strong> of <strong>${chemHTML(sp)}</strong> (at STP),<br>
      how many <strong>grams</strong> of <strong>${chemHTML(sp)}</strong> is that?`;

    return finalizeProblem({ type, mode, rxn, react, prod, sp, mmSingle, givenGrams, givenMoles, givenLiters, mmReact, mmProd, ratio, askedUnit, prompt, answer });
  }

  if (type === "conv_g_to_L") {
    askedUnit = "L";
    const mol = givenGrams / mmSingle;
    answer = mol * STP;

    prompt = `Conversion practice (gas at STP; two steps).<br><br>
      If you start with <strong>${givenGrams} g</strong> of <strong>${chemHTML(sp)}</strong>,<br>
      what volume is that in <strong>liters</strong> at STP?`;

    return finalizeProblem({ type, mode, rxn, react, prod, sp, mmSingle, givenGrams, givenMoles, givenLiters, mmReact, mmProd, ratio, askedUnit, prompt, answer });
  }

  // --------------------
  // Stoichiometry (between substances)
  // --------------------
  if (type === "sto_g_to_g") {
    askedUnit = "g";
    const molReact = givenGrams / mmReact;
    const molProd = molReact * ratio;
    answer = molProd * mmProd;

    prompt = `A reaction occurs: <strong>${chemHTML(rxn.equation)}</strong><br><br>
      If you start with <strong>${givenGrams} g</strong> of <strong>${chemHTML(react.sp)}</strong>,<br>
      how many <strong>grams</strong> of <strong>${chemHTML(prod.sp)}</strong> can be produced (assume excess of the other reactant)?`;

    return finalizeProblem({ type, mode, rxn, react, prod, sp, mmSingle, givenGrams, givenMoles, givenLiters, mmReact, mmProd, ratio, askedUnit, prompt, answer });
  }

  if (type === "sto_g_to_mol") {
    askedUnit = "mol";
    const molReact = givenGrams / mmReact;
    answer = molReact * ratio;

    prompt = `A reaction occurs: <strong>${chemHTML(rxn.equation)}</strong><br><br>
      If you start with <strong>${givenGrams} g</strong> of <strong>${chemHTML(react.sp)}</strong>,<br>
      how many <strong>moles</strong> of <strong>${chemHTML(prod.sp)}</strong> can be produced (assume excess)?`;

    return finalizeProblem({ type, mode, rxn, react, prod, sp, mmSingle, givenGrams, givenMoles, givenLiters, mmReact, mmProd, ratio, askedUnit, prompt, answer });
  }

  if (type === "sto_mol_to_g") {
    askedUnit = "g";
    const molProd = givenMoles * ratio;
    answer = molProd * mmProd;

    prompt = `A reaction occurs: <strong>${chemHTML(rxn.equation)}</strong><br><br>
      If you start with <strong>${givenMoles} mol</strong> of <strong>${chemHTML(react.sp)}</strong>,<br>
      how many <strong>grams</strong> of <strong>${chemHTML(prod.sp)}</strong> can be produced (assume excess)?`;

    return finalizeProblem({ type, mode, rxn, react, prod, sp, mmSingle, givenGrams, givenMoles, givenLiters, mmReact, mmProd, ratio, askedUnit, prompt, answer });
  }

  if (type === "sto_L_to_g") {
    askedUnit = "g";
    const molReact = givenLiters / STP;
    const molProd = molReact * ratio;
    answer = molProd * mmProd;

    prompt = `A reaction occurs: <strong>${chemHTML(rxn.equation)}</strong><br><br>
      If you start with <strong>${givenLiters} L</strong> of <strong>${chemHTML(react.sp)}</strong> (gas at STP),<br>
      how many <strong>grams</strong> of <strong>${chemHTML(prod.sp)}</strong> can be produced (assume excess)?`;

    return finalizeProblem({ type, mode, rxn, react, prod, sp, mmSingle, givenGrams, givenMoles, givenLiters, mmReact, mmProd, ratio, askedUnit, prompt, answer });
  }

  if (type === "sto_g_to_L") {
    askedUnit = "L";
    const molReact = givenGrams / mmReact;
    const molProd = molReact * ratio;
    answer = molProd * STP;

    prompt = `A reaction occurs: <strong>${chemHTML(rxn.equation)}</strong><br><br>
      If you start with <strong>${givenGrams} g</strong> of <strong>${chemHTML(react.sp)}</strong>,<br>
      what volume of <strong>${chemHTML(prod.sp)}</strong> is produced in <strong>liters</strong> at STP (assume excess)?`;

    return finalizeProblem({ type, mode, rxn, react, prod, sp, mmSingle, givenGrams, givenMoles, givenLiters, mmReact, mmProd, ratio, askedUnit, prompt, answer });
  }

  // sto_L_to_L
  askedUnit = "L";
  const molReact = givenLiters / STP;
  const molProd = molReact * ratio;
  answer = molProd * STP;

  prompt = `A reaction occurs: <strong>${chemHTML(rxn.equation)}</strong><br><br>
    If you start with <strong>${givenLiters} L</strong> of <strong>${chemHTML(react.sp)}</strong> (gas at STP),<br>
    what volume of <strong>${chemHTML(prod.sp)}</strong> is produced in <strong>liters</strong> at STP (assume excess)?`;

  return finalizeProblem({ type, mode, rxn, react, prod, sp, mmSingle, givenGrams, givenMoles, givenLiters, mmReact, mmProd, ratio, askedUnit, prompt, answer });
}

function finalizeProblem(p) {
  p.steps = buildSteps(p);
  return p;
}

// -------------------------------
// Steps builder (matches your existing “Show steps” style)
// -------------------------------
function buildSteps(p) {
  const { type, react, prod, sp, givenGrams, givenMoles, givenLiters, mmReact, mmProd, mmSingle, ratio } = p;

  // Conversion steps
  if (type === "conv_g_to_mol") {
    const mol = givenGrams / mmSingle;
    return `
      <div class="stepBox"><strong>Convert:</strong> grams → moles<br><br>
        ${givenGrams} g ${chemHTML(sp)} × (1 mol / ${mmSingle} g) = <strong>${roundSig(mol)} mol ${chemHTML(sp)}</strong>
      </div>
    `;
  }

  if (type === "conv_mol_to_g") {
    const grams = givenMoles * mmSingle;
    return `
      <div class="stepBox"><strong>Convert:</strong> moles → grams<br><br>
        ${givenMoles} mol ${chemHTML(sp)} × (${mmSingle} g / 1 mol) = <strong>${roundSig(grams)} g ${chemHTML(sp)}</strong>
      </div>
    `;
  }

  if (type === "conv_L_to_mol") {
    const mol = givenLiters / STP;
    return `
      <div class="stepBox"><strong>Convert (STP):</strong> liters → moles<br><br>
        ${givenLiters} L ${chemHTML(sp)} × (1 mol / ${STP} L) = <strong>${roundSig(mol)} mol ${chemHTML(sp)}</strong>
      </div>
    `;
  }

  if (type === "conv_mol_to_L") {
    const L = givenMoles * STP;
    return `
      <div class="stepBox"><strong>Convert (STP):</strong> moles → liters<br><br>
        ${givenMoles} mol ${chemHTML(sp)} × (${STP} L / 1 mol) = <strong>${roundSig(L)} L ${chemHTML(sp)}</strong>
      </div>
    `;
  }

  if (type === "conv_L_to_g") {
    const mol = givenLiters / STP;
    const grams = mol * mmSingle;
    return `
      <div class="stepBox"><strong>Convert (STP):</strong> liters → moles<br><br>
        ${givenLiters} L ${chemHTML(sp)} × (1 mol / ${STP} L) = <strong>${roundSig(mol)} mol ${chemHTML(sp)}</strong>
      </div>
      <div class="stepBox"><strong>Convert:</strong> moles → grams<br><br>
        ${roundSig(mol)} mol ${chemHTML(sp)} × (${mmSingle} g / 1 mol) = <strong>${roundSig(grams)} g ${chemHTML(sp)}</strong>
      </div>
    `;
  }

  if (type === "conv_g_to_L") {
    const mol = givenGrams / mmSingle;
    const L = mol * STP;
    return `
      <div class="stepBox"><strong>Convert:</strong> grams → moles<br><br>
        ${givenGrams} g ${chemHTML(sp)} × (1 mol / ${mmSingle} g) = <strong>${roundSig(mol)} mol ${chemHTML(sp)}</strong>
      </div>
      <div class="stepBox"><strong>Convert (STP):</strong> moles → liters<br><br>
        ${roundSig(mol)} mol ${chemHTML(sp)} × (${STP} L / 1 mol) = <strong>${roundSig(L)} L ${chemHTML(sp)}</strong>
      </div>
    `;
  }

  // Stoichiometry steps (3 moves, sometimes with STP)
  if (type === "sto_g_to_g") {
    const molReact = givenGrams / mmReact;
    const molProd = molReact * ratio;
    const gramsProd = molProd * mmProd;

    return `
      <div class="stepBox"><strong>Convert:</strong> grams → moles (reactant)<br><br>
        ${givenGrams} g ${chemHTML(react.sp)} × (1 mol / ${mmReact} g) = <strong>${roundSig(molReact)} mol ${chemHTML(react.sp)}</strong>
      </div>
      <div class="stepBox"><strong>Ratio:</strong> use coefficients<br><br>
        ${roundSig(molReact)} mol ${chemHTML(react.sp)} × (${prod.coef} mol ${chemHTML(prod.sp)} / ${react.coef} mol ${chemHTML(react.sp)})
        = <strong>${roundSig(molProd)} mol ${chemHTML(prod.sp)}</strong>
      </div>
      <div class="stepBox"><strong>Convert:</strong> moles → grams (product)<br><br>
        ${roundSig(molProd)} mol ${chemHTML(prod.sp)} × (${mmProd} g / 1 mol) = <strong>${roundSig(gramsProd)} g ${chemHTML(prod.sp)}</strong>
      </div>
    `;
  }

  if (type === "sto_g_to_mol") {
    const molReact = givenGrams / mmReact;
    const molProd = molReact * ratio;

    return `
      <div class="stepBox"><strong>Convert:</strong> grams → moles (reactant)<br><br>
        ${givenGrams} g ${chemHTML(react.sp)} × (1 mol / ${mmReact} g) = <strong>${roundSig(molReact)} mol ${chemHTML(react.sp)}</strong>
      </div>
      <div class="stepBox"><strong>Ratio:</strong> use coefficients<br><br>
        ${roundSig(molReact)} mol ${chemHTML(react.sp)} × (${prod.coef} mol ${chemHTML(prod.sp)} / ${react.coef} mol ${chemHTML(react.sp)})
        = <strong>${roundSig(molProd)} mol ${chemHTML(prod.sp)}</strong>
      </div>
      <div class="stepBox"><strong>Done:</strong> target was moles of product.</div>
    `;
  }

  if (type === "sto_mol_to_g") {
    const molProd = givenMoles * ratio;
    const gramsProd = molProd * mmProd;

    return `
      <div class="stepBox"><strong>Start:</strong> already in moles (reactant)<br><br>
        <strong>${givenMoles} mol ${chemHTML(react.sp)}</strong>
      </div>
      <div class="stepBox"><strong>Ratio:</strong> use coefficients<br><br>
        ${givenMoles} mol ${chemHTML(react.sp)} × (${prod.coef} mol ${chemHTML(prod.sp)} / ${react.coef} mol ${chemHTML(react.sp)})
        = <strong>${roundSig(molProd)} mol ${chemHTML(prod.sp)}</strong>
      </div>
      <div class="stepBox"><strong>Convert:</strong> moles → grams (product)<br><br>
        ${roundSig(molProd)} mol ${chemHTML(prod.sp)} × (${mmProd} g / 1 mol) = <strong>${roundSig(gramsProd)} g ${chemHTML(prod.sp)}</strong>
      </div>
    `;
  }

  if (type === "sto_L_to_g") {
    const molReact = givenLiters / STP;
    const molProd = molReact * ratio;
    const gramsProd = molProd * mmProd;

    return `
      <div class="stepBox"><strong>Convert (STP):</strong> liters → moles (reactant)<br><br>
        ${givenLiters} L ${chemHTML(react.sp)} × (1 mol / ${STP} L) = <strong>${roundSig(molReact)} mol ${chemHTML(react.sp)}</strong>
      </div>
      <div class="stepBox"><strong>Ratio:</strong> use coefficients<br><br>
        ${roundSig(molReact)} mol ${chemHTML(react.sp)} × (${prod.coef} mol ${chemHTML(prod.sp)} / ${react.coef} mol ${chemHTML(react.sp)})
        = <strong>${roundSig(molProd)} mol ${chemHTML(prod.sp)}</strong>
      </div>
      <div class="stepBox"><strong>Convert:</strong> moles → grams (product)<br><br>
        ${roundSig(molProd)} mol ${chemHTML(prod.sp)} × (${mmProd} g / 1 mol) = <strong>${roundSig(gramsProd)} g ${chemHTML(prod.sp)}</strong>
      </div>
    `;
  }

  if (type === "sto_g_to_L") {
    const molReact = givenGrams / mmReact;
    const molProd = molReact * ratio;
    const L = molProd * STP;

    return `
      <div class="stepBox"><strong>Convert:</strong> grams → moles (reactant)<br><br>
        ${givenGrams} g ${chemHTML(react.sp)} × (1 mol / ${mmReact} g) = <strong>${roundSig(molReact)} mol ${chemHTML(react.sp)}</strong>
      </div>
      <div class="stepBox"><strong>Ratio:</strong> use coefficients<br><br>
        ${roundSig(molReact)} mol ${chemHTML(react.sp)} × (${prod.coef} mol ${chemHTML(prod.sp)} / ${react.coef} mol ${chemHTML(react.sp)})
        = <strong>${roundSig(molProd)} mol ${chemHTML(prod.sp)}</strong>
      </div>
      <div class="stepBox"><strong>Convert (STP):</strong> moles → liters (product)<br><br>
        ${roundSig(molProd)} mol ${chemHTML(prod.sp)} × (${STP} L / 1 mol) = <strong>${roundSig(L)} L ${chemHTML(prod.sp)}</strong>
      </div>
    `;
  }

  // sto_L_to_L
  const molReact2 = givenLiters / STP;
  const molProd2 = molReact2 * ratio;
  const L2 = molProd2 * STP;

  return `
    <div class="stepBox"><strong>Convert (STP):</strong> liters → moles (reactant)<br><br>
      ${givenLiters} L ${chemHTML(react.sp)} × (1 mol / ${STP} L) = <strong>${roundSig(molReact2)} mol ${chemHTML(react.sp)}</strong>
    </div>
    <div class="stepBox"><strong>Ratio:</strong> use coefficients<br><br>
      ${roundSig(molReact2)} mol ${chemHTML(react.sp)} × (${prod.coef} mol ${chemHTML(prod.sp)} / ${react.coef} mol ${chemHTML(react.sp)})
      = <strong>${roundSig(molProd2)} mol ${chemHTML(prod.sp)}</strong>
    </div>
    <div class="stepBox"><strong>Convert (STP):</strong> moles → liters (product)<br><br>
      ${roundSig(molProd2)} mol ${chemHTML(prod.sp)} × (${STP} L / 1 mol) = <strong>${roundSig(L2)} L ${chemHTML(prod.sp)}</strong>
    </div>
  `;
}

// -------------------------------
// Answer checking + hints
// -------------------------------
function checkAnswer() {
  const userVal = normalizeNumber(document.getElementById("answer").value);
  const unit = document.getElementById("unit").value;
  const p = state.current;

  state.total += 1;

  if (userVal === null) {
    state.streak = 0;
    setFeedback("Type a number (example: <strong>12.5</strong>).", false);
    updateStats();
    return;
  }

  if (unit !== p.askedUnit) {
    state.streak = 0;
    setFeedback(
      `Your unit is <strong>${unit}</strong>, but the question asked for <strong>${p.askedUnit}</strong>.<br>
       Fix the unit first — then re-check.`,
      false
    );
    updateStats();
    return;
  }

  const correct = p.answer;
  const tol = Math.max(0.02 * Math.abs(correct), 0.05);
  const diff = Math.abs(userVal - correct);

  if (diff <= tol) {
    state.correct += 1;
    state.streak += 1;
    setFeedback(`✅ Correct! (Expected about <strong>${roundSig(correct)}</strong> ${unit}.)`, true);
  } else {
    state.streak = 0;

    let nudge = `Not quite. Expected about <strong>${roundSig(correct)}</strong> ${unit}.`;

    // “Common mistake” checks
    if (p.mode === "stoich") {
      // Missing ratio (or ratio flipped) sometimes looks like being off by a coefficient factor.
      const altNoRatio = correct / p.ratio;
      if (Math.abs(userVal - altNoRatio) <= tol) {
        nudge += `<br><span class="muted">It looks like the <strong>mole ratio</strong> step may be missing or flipped.</span>`;
      }

      // If grams involved, wrong molar mass swap can happen
      const mmSwapGuess = correct * (p.mmReact / p.mmProd);
      if (Number.isFinite(mmSwapGuess) && Math.abs(userVal - mmSwapGuess) <= tol) {
        nudge += `<br><span class="muted">It looks like a <strong>molar mass</strong> may be from the wrong substance.</span>`;
      }

      // If liters involved, wrong STP direction can happen
      if (p.type.includes("_L_")) {
        const stpFlipGuess = correct / (STP * STP); // crude “way too small” guess
        if (Number.isFinite(stpFlipGuess) && Math.abs(userVal - stpFlipGuess) <= tol) {
          nudge += `<br><span class="muted">Check the <strong>22.4 L/mol</strong> step direction (divide vs multiply).</span>`;
        }
      }
    } else {
      // conversion mode: ratio hint is irrelevant
      nudge += `<br><span class="muted">Check: did you <strong>flip</strong> the factor so units cancel?</span>`;
      if (p.type.includes("L")) {
        nudge += `<br><span class="muted">For STP gases: use <strong>22.4 L = 1 mol</strong>.</span>`;
      }
    }

    setFeedback(`❌ ${nudge}`, false);
  }

  updateStats();
}

function showHint() {
  const p = state.current;
  state.hintLevel = Math.min(state.hintLevel + 1, 3);

  if (p.mode === "conversion") {
    if (state.hintLevel === 1) {
      setFeedback(`Hint 1: Decide if you need <strong>moles</strong> as the bridge. Many conversions go through moles.`, null);
      return;
    }
    if (state.hintLevel === 2) {
      const msg = p.type.includes("L")
        ? `Hint 2: For STP gases: <strong>1 mol = 22.4 L</strong>. Choose multiply or divide so units cancel.`
        : `Hint 2: Use molar mass: <strong>1 mol</strong> over <strong>g</strong> (or the flipped version) so units cancel.`;
      setFeedback(msg, null);
      return;
    }
    setFeedback(`Hint 3: Use <strong>Show steps</strong>, then try copying the structure on a new problem.`, null);
    return;
  }

  // stoichiometry hints
  if (state.hintLevel === 1) {
    setFeedback(`Hint 1: Ask yourself: <strong>Do I have moles yet?</strong> If not, convert first.`, null);
    return;
  }
  if (state.hintLevel === 2) {
    setFeedback(
      `Hint 2: Your mole ratio comes from the balanced equation coefficients for <strong>${chemHTML(p.react.sp)}</strong> and <strong>${chemHTML(p.prod.sp)}</strong>.`,
      null
    );
    return;
  }
  setFeedback(`Hint 3: Use <strong>Show steps</strong> and copy the structure, then try a new problem.`, null);
}

function showSteps() {
  const p = state.current;
  document.getElementById("stepsBox").open = true;
  setSteps(p.steps || "<div class='stepBox'>No steps available for this problem yet.</div>");
}

function newProblem() {
  state.current = pickProblem();
  state.hintLevel = 0;

  document.getElementById("problemText").innerHTML = state.current.prompt;
  document.getElementById("answer").value = "";
  document.getElementById("unit").value = state.current.askedUnit;

  setFeedback("Enter your answer and press <strong>Check</strong>.", null);

  setSteps("");
  document.getElementById("stepsBox").open = false;
}


function practiceHasProgress() {
  const answerEl = document.getElementById("answer");
  const unitEl = document.getElementById("unit");
  const stepsBox = document.getElementById("stepsBox");

  const hasTypedAnswer =
    Boolean(answerEl && answerEl.value.trim());

  const hasChangedUnit =
    Boolean(
      state.current &&
      unitEl &&
      unitEl.value !== state.current.askedUnit
    );

  const hasUsedHint = state.hintLevel > 0;
  const hasViewedSteps = Boolean(stepsBox && stepsBox.open);

  return (
    hasTypedAnswer ||
    hasChangedUnit ||
    hasUsedHint ||
    hasViewedSteps
  );
}

function closeModeChangeDialog() {
  const dialog = document.getElementById("modeChangeDialog");

  if (dialog && dialog.open) {
    dialog.close();
  }
}

function cancelFocusChange() {
  const focusEl = document.getElementById("focus");

  state.pendingFocus = null;

  if (focusEl) {
    focusEl.value = state.activeFocus;
  }

  closeModeChangeDialog();

  if (focusEl) {
    focusEl.focus();
  }
}

function confirmFocusChange() {
  if (!state.pendingFocus) {
    return;
  }

  const focusEl = document.getElementById("focus");
  const requestedFocus = state.pendingFocus;

  state.pendingFocus = null;
  state.activeFocus = requestedFocus;

  if (focusEl) {
    focusEl.value = requestedFocus;
  }

  closeModeChangeDialog();
  newProblem();

  if (focusEl) {
    focusEl.focus();
  }
}

function requestFocusChange(requestedFocus) {
  const focusEl = document.getElementById("focus");

  if (requestedFocus === state.activeFocus) {
    return;
  }

  if (!practiceHasProgress()) {
    state.activeFocus = requestedFocus;
    newProblem();
    return;
  }

  state.pendingFocus = requestedFocus;

  // Restore the current selection while the student decides.
  if (focusEl) {
    focusEl.value = state.activeFocus;
  }

  const dialog = document.getElementById("modeChangeDialog");
  const keepWorkingButton = document.getElementById("keepWorking");

  if (dialog && typeof dialog.showModal === "function") {
    dialog.showModal();

    if (keepWorkingButton) {
      keepWorkingButton.focus();
    }

    return;
  }

  // Graceful fallback if <dialog> is unavailable.
  const shouldChange = window.confirm(
    "Change practice focus?\n\nYour current problem and progress will be cleared."
  );

  if (shouldChange) {
    confirmFocusChange();
  } else {
    cancelFocusChange();
  }
}

async function init() {
  const res = await fetch("problems.json");
  DATA = await res.json();

  document.getElementById("check").addEventListener("click", checkAnswer);
  document.getElementById("hint").addEventListener("click", showHint);
  document.getElementById("showSteps").addEventListener("click", showSteps);
  document.getElementById("newProblem").addEventListener("click", newProblem);

  // Top “New problem” button
  const topBtn = document.getElementById("newProblemTop");
  if (topBtn) topBtn.addEventListener("click", newProblem);

  // Practice-focus switching: warn only when work would be lost.
  const focusEl = document.getElementById("focus");

  if (focusEl) {
    state.activeFocus = focusEl.value;

    focusEl.addEventListener("change", () => {
      requestFocusChange(focusEl.value);
    });
  }

  const keepWorkingButton =
    document.getElementById("keepWorking");

  if (keepWorkingButton) {
    keepWorkingButton.addEventListener(
      "click",
      cancelFocusChange
    );
  }

  const confirmModeChangeButton =
    document.getElementById("confirmModeChange");

  if (confirmModeChangeButton) {
    confirmModeChangeButton.addEventListener(
      "click",
      confirmFocusChange
    );
  }

  const modeChangeDialog =
    document.getElementById("modeChangeDialog");

  if (modeChangeDialog) {
    modeChangeDialog.addEventListener("cancel", event => {
      event.preventDefault();
      cancelFocusChange();
    });
  }

  updateStats();
  newProblem();
}

init();
