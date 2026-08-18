let DATA = null;

const state = {
  mode: "stoich",
  problem: null,
  slotCount: 3,
  slots: [],
  selectedFactorId: null,
  pendingMode: null
};

function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function toNum(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function parseEquation(equation) {
  const [leftSide, rightSide] = equation
    .split("->")
    .map(side => side.trim());

  function parseSide(side) {
    return side.split("+").map(part => {
      const trimmedPart = part.trim();
      const match = trimmedPart.match(/^(\d+)\s+(.+)$/);

      if (match) {
        return {
          coef: Number(match[1]),
          sp: match[2].trim()
        };
      }

      return {
        coef: 1,
        sp: trimmedPart
      };
    });
  }

  return {
    reactants: parseSide(leftSide),
    products: parseSide(rightSide)
  };
}

/**
 * Converts formula digits to subscripts.
 * Equation coefficients remain normal-sized.
 */
function chemHTML(text) {
  return String(text ?? "")
    .replace(/([A-Za-z\)])(\d+)/g, "$1<sub>$2</sub>");
}

function setSetupFeedback(message, status = null) {
  const box = document.getElementById("setupFeedback");

  box.className =
    "feedback" +
    (status === true
      ? " good"
      : status === false
        ? " bad"
        : "");

  box.innerHTML = message;
}

function setFinalFeedback(message, status = null) {
  const box = document.getElementById("finalFeedback");

  box.className =
    "feedback" +
    (status === true
      ? " good"
      : status === false
        ? " bad"
        : "");

  box.innerHTML = message;
}

function setPathLine(text) {
  const element = document.getElementById("pathLine");

  if (element) {
    element.innerHTML = text;
  }
}

/* -------------------------------------------------
   Factor selection, dragging, and placement
------------------------------------------------- */

function getDisplayedSides(factor) {
  if (factor.flipped) {
    return {
      top: factor.bottom,
      bottom: factor.top
    };
  }

  return {
    top: factor.top,
    bottom: factor.bottom
  };
}

function getFactorSpokenLabel(factor) {
  return `Numerator ${factor.top}. Denominator ${factor.bottom}.`;
}

function updateSelectionStatus() {
  const status = document.getElementById("factorSelectionStatus");
  const cards = document.querySelectorAll(".factor");

  cards.forEach(card => {
    const selected =
      card.dataset.factorId === state.selectedFactorId;

    card.classList.toggle("selected", selected);

    card.setAttribute(
      "aria-pressed",
      selected ? "true" : "false"
    );
  });

  if (!status) {
    return;
  }

  if (!state.selectedFactorId) {
    status.textContent = "No factor selected.";
    return;
  }

  const factor = state.problem.factorBank.find(
    item => item.id === state.selectedFactorId
  );

  if (!factor) {
    status.textContent = "No factor selected.";
    return;
  }

  status.innerHTML = `
    <strong>Selected:</strong>
    ${chemHTML(factor.top)}
    over
    ${chemHTML(factor.bottom)}.
    Now select a factor box.
  `;
}

function selectFactor(factorId) {
  if (state.selectedFactorId === factorId) {
    state.selectedFactorId = null;
  } else {
    state.selectedFactorId = factorId;
  }

  updateSelectionStatus();
  renderSlots();
}

function makeFactorCard(factor) {
  const card = document.createElement("div");

  card.className = "factor";
  card.draggable = true;
  card.tabIndex = 0;
  card.dataset.factorId = factor.id;

  card.setAttribute("role", "button");
  card.setAttribute("aria-pressed", "false");

  card.setAttribute(
    "aria-label",
    `Select conversion factor. ${getFactorSpokenLabel(factor)}`
  );

  card.innerHTML = `
    <div class="frac mini" aria-hidden="true">
      <div class="num">
        ${chemHTML(factor.top)}
      </div>

      <div class="bar"></div>

      <div class="den">
        ${chemHTML(factor.bottom)}
      </div>
    </div>

    <div class="factorSelectHint" aria-hidden="true">
      Select factor
    </div>
  `;

  card.addEventListener("click", () => {
    selectFactor(factor.id);
  });

  card.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectFactor(factor.id);
    }
  });

  card.addEventListener("dragstart", event => {
    event.dataTransfer.setData("text/plain", factor.id);
    event.dataTransfer.effectAllowed = "copy";
  });

  return card;
}

function renderBank() {
  const bank = document.getElementById("bank");

  bank.innerHTML = "";

  state.problem.factorBank.forEach(factor => {
    bank.appendChild(makeFactorCard(factor));
  });

  updateSelectionStatus();
}

function makePlacedFactor(slotIndex, factor) {
  const wrapper = document.createElement("div");
  const displayed = getDisplayedSides(factor);

  wrapper.className = "placed";

  wrapper.innerHTML = `
    <div class="placedInner">
      <div
        class="frac mini"
        role="img"
        aria-label="Numerator ${displayed.top}. Denominator ${displayed.bottom}."
      >
        <div class="num" aria-hidden="true">
          ${chemHTML(displayed.top)}
        </div>

        <div class="bar" aria-hidden="true"></div>

        <div class="den" aria-hidden="true">
          ${chemHTML(displayed.bottom)}
        </div>
      </div>

      <div class="placedBtns">
        <button
          type="button"
          class="btn tiny"
          data-action="flip"
          data-slot="${slotIndex}"
        >
          Flip
        </button>

        <button
          type="button"
          class="btn tiny"
          data-action="clear"
          data-slot="${slotIndex}"
        >
          Clear
        </button>
      </div>
    </div>
  `;

  return wrapper;
}

function placeFactor(slotIndex, factorId) {
  if (
    !Number.isInteger(slotIndex) ||
    slotIndex < 0 ||
    slotIndex >= state.slotCount
  ) {
    return false;
  }

  const factor = state.problem.factorBank.find(
    item => item.id === factorId
  );

  if (!factor) {
    return false;
  }

  state.slots[slotIndex] = {
    ...factor
  };

  state.selectedFactorId = null;

  renderBank();
  renderSlots();

  return true;
}

function activateSlot(slotIndex) {
  if (!state.selectedFactorId) {
    setSetupFeedback(
      "Select a factor from the <strong>Factor bank</strong> first, then select the box where it belongs.",
      null
    );

    return;
  }

  if (placeFactor(slotIndex, state.selectedFactorId)) {
    setSetupFeedback(
      `Placed the selected factor in <strong>Box ${slotIndex + 1}</strong>.`,
      null
    );
  }
}

function renderSlots() {
  const slotsWrapper = document.getElementById("slots");

  slotsWrapper.innerHTML = "";

  for (let index = 0; index < state.slotCount; index += 1) {
    const slot = document.createElement("div");

    slot.className = "slot";
    slot.dataset.slot = String(index);
    slot.tabIndex = 0;

    slot.setAttribute("role", "button");

    slot.setAttribute(
      "aria-label",
      state.selectedFactorId
        ? `Place the selected factor in Box ${index + 1}`
        : `Factor Box ${index + 1}. Select a factor from the bank first.`
    );

    if (state.selectedFactorId) {
      slot.classList.add("slotReady");
    }

    slot.addEventListener("click", event => {
      if (event.target.closest("button")) {
        return;
      }

      activateSlot(index);
    });

    slot.addEventListener("keydown", event => {
      if (event.target.closest("button")) {
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activateSlot(index);
      }
    });

    slot.addEventListener("dragover", event => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      slot.classList.add("slotDragOver");
    });

    slot.addEventListener("dragleave", () => {
      slot.classList.remove("slotDragOver");
    });

    slot.addEventListener("drop", event => {
      event.preventDefault();

      slot.classList.remove("slotDragOver");

      const factorId =
        event.dataTransfer.getData("text/plain");

      if (placeFactor(index, factorId)) {
        setSetupFeedback(
          `Placed the dragged factor in <strong>Box ${index + 1}</strong>.`,
          null
        );
      }
    });

    const currentFactor = state.slots[index];

    if (!currentFactor) {
      slot.innerHTML = `
        <div class="slotHint">
          <strong>Box ${index + 1}</strong>
          <br />

          ${
            state.selectedFactorId
              ? "Select this box to place the highlighted factor."
              : "Select a factor below, then select this box."
          }
        </div>
      `;
    } else {
      slot.appendChild(
        makePlacedFactor(index, currentFactor)
      );
    }

    slotsWrapper.appendChild(slot);

    if (index < state.slotCount - 1) {
      const multiplicationSign =
        document.createElement("span");

      multiplicationSign.className = "times";
      multiplicationSign.textContent = "×";

      multiplicationSign.setAttribute(
        "aria-hidden",
        "true"
      );

      slotsWrapper.appendChild(multiplicationSign);
    }
  }

  slotsWrapper
    .querySelectorAll("button")
    .forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();

        const action = button.dataset.action;
        const slotIndex = Number(button.dataset.slot);

        if (!Number.isInteger(slotIndex)) {
          return;
        }

        if (
          action === "flip" &&
          state.slots[slotIndex]
        ) {
          state.slots[slotIndex].flipped =
            !state.slots[slotIndex].flipped;

          renderSlots();

          setSetupFeedback(
            `Flipped the factor in <strong>Box ${slotIndex + 1}</strong>.`,
            null
          );
        }

        if (action === "clear") {
          state.slots[slotIndex] = null;

          renderSlots();

          setSetupFeedback(
            `Cleared <strong>Box ${slotIndex + 1}</strong>.`,
            null
          );
        }
      });
    });
}

/* -------------------------------------------------
   Correctness checking
------------------------------------------------- */

function normalizeFactorText(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function getFactorSignature(factor) {
  const displayed = getDisplayedSides(factor);

  return (
    `${normalizeFactorText(displayed.top)}` +
    "|||" +
    `${normalizeFactorText(displayed.bottom)}`
  );
}

function getInverseSignature(factor) {
  const displayed = getDisplayedSides(factor);

  return (
    `${normalizeFactorText(displayed.bottom)}` +
    "|||" +
    `${normalizeFactorText(displayed.top)}`
  );
}

function getExpectedDisplayedFactors() {
  return state.problem.correct.map(requirement => {
    const sourceFactor =
      state.problem.factorBank.find(
        factor => factor.id === requirement.id
      );

    if (!sourceFactor) {
      throw new Error(
        `Missing expected factor: ${requirement.id}`
      );
    }

    return {
      ...sourceFactor,
      flipped: requirement.flipped
    };
  });
}

function compareSetup() {
  const emptySlots = [];

  state.slots.forEach((factor, index) => {
    if (!factor) {
      emptySlots.push(index);
    }
  });

  if (emptySlots.length > 0) {
    return {
      ok: false,
      emptySlots,
      unmatchedPlaced: [],
      remainingExpected: []
    };
  }

  const remainingExpected =
    getExpectedDisplayedFactors().map(getFactorSignature);

  const unmatchedPlaced = [];

  state.slots.forEach((factor, slotIndex) => {
    const signature = getFactorSignature(factor);

    const matchIndex =
      remainingExpected.indexOf(signature);

    if (matchIndex >= 0) {
      remainingExpected.splice(matchIndex, 1);
    } else {
      unmatchedPlaced.push({
        factor,
        slotIndex
      });
    }
  });

  return {
    ok:
      unmatchedPlaced.length === 0 &&
      remainingExpected.length === 0,
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

  if (comparison.emptySlots.length > 0) {
    const boxNumbers = comparison.emptySlots
      .map(index => index + 1)
      .join(", ");

    setSetupFeedback(
      `Complete every factor box before checking. ` +
      `Empty box${comparison.emptySlots.length === 1 ? "" : "es"}: ` +
      `<strong>${boxNumbers}</strong>.`,
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

  const expectedSignatures =
    getExpectedDisplayedFactors().map(getFactorSignature);

  const errors = comparison.unmatchedPlaced.map(
    ({ factor, slotIndex }) => {
      if (
        expectedSignatures.includes(
          getInverseSignature(factor)
        )
      ) {
        return (
          `Box ${slotIndex + 1}: ` +
          `this factor is upside down. ` +
          `Select <strong>Flip</strong>.`
        );
      }

      return (
        `Box ${slotIndex + 1}: ` +
        `this displayed factor is not needed ` +
        `for the requested path.`
      );
    }
  );

  setSetupFeedback(
    `❌ Not yet. Check the following:` +
    `<ul>` +
    errors.map(error => `<li>${error}</li>`).join("") +
    `</ul>`,
    false
  );
}

function showCorrectSetup() {
  state.slots = getExpectedDisplayedFactors();

  renderSlots();

  setSetupFeedback(
    "Here is one correct setup. Equivalent factors and a different factor order will also be accepted when the units cancel correctly.",
    null
  );
}

/* -------------------------------------------------
   Stoichiometry problem builder
------------------------------------------------- */

function buildStoichProblem() {
  const reaction =
    DATA.reactions[
      rnd(0, DATA.reactions.length - 1)
    ];

  const parsedEquation =
    parseEquation(reaction.equation);

  const reactant =
    parsedEquation.reactants[
      rnd(0, parsedEquation.reactants.length - 1)
    ];

  const product =
    parsedEquation.products[
      rnd(0, parsedEquation.products.length - 1)
    ];

  const givenGrams = rnd(6, 40);

  const reactantMolarMass = toNum(
    reaction.species[reactant.sp].molarMass
  );

  const productMolarMass = toNum(
    reaction.species[product.sp].molarMass
  );

  const ratioTop =
    `${product.coef} mol ${product.sp}`;

  const ratioBottom =
    `${reactant.coef} mol ${reactant.sp}`;

  const correctGrams =
    (givenGrams / reactantMolarMass) *
    (product.coef / reactant.coef) *
    productMolarMass;

  const factorBank = [
    {
      id: "mm_in",
      top: `1 mol ${reactant.sp}`,
      bottom: `${reactantMolarMass} g ${reactant.sp}`,
      flipped: false
    },
    {
      id: "ratio",
      top: ratioTop,
      bottom: ratioBottom,
      flipped: false
    },
    {
      id: "mm_out",
      top: `${productMolarMass} g ${product.sp}`,
      bottom: `1 mol ${product.sp}`,
      flipped: false
    },

    {
      id: "mm_in_wrong",
      top: `1 mol ${product.sp}`,
      bottom: `${productMolarMass} g ${product.sp}`,
      flipped: false
    },
    {
      id: "ratio_flipped",
      top: ratioBottom,
      bottom: ratioTop,
      flipped: false
    }
  ];

  const prompt = `
    A reaction occurs:
    <strong>${chemHTML(reaction.equation)}</strong>
    <br />

    If you start with
    <strong>${givenGrams} g</strong>
    of
    <strong>${chemHTML(reactant.sp)}</strong>,
    build the setup to find
    <strong>grams</strong>
    of
    <strong>${chemHTML(product.sp)}</strong>
    produced (assume excess).
  `;

  const correct = [
    {
      id: "mm_in",
      flipped: false
    },
    {
      id: "ratio",
      flipped: false
    },
    {
      id: "mm_out",
      flipped: false
    }
  ];

  return {
    mode: "stoich",
    slotCount: 3,
    prompt,
    factorBank,
    correct,
    correctValue: correctGrams,
    givenValue: givenGrams,
    givenUnitHTML:
      chemHTML(`g ${reactant.sp}`),
    targetUnitHTML:
      chemHTML(`g ${product.sp}`),
    expectedUnitName: "g"
  };
}

/* -------------------------------------------------
   Conversion problem builder
------------------------------------------------- */

function buildConversionProblem() {
  const conversionTypes = [
    "g_to_mol",
    "mol_to_g",
    "L_to_mol",
    "mol_to_L",
    "L_to_g",
    "g_to_L"
  ];

  const conversionType =
    conversionTypes[
      rnd(0, conversionTypes.length - 1)
    ];

  const usesGasVolume =
    conversionType.includes("L");

  const eligibleSubstances = [];

  DATA.reactions.forEach(reaction => {
    const parsedEquation =
      parseEquation(reaction.equation);

    const speciesNames = [
      ...new Set(
        [
          ...parsedEquation.reactants,
          ...parsedEquation.products
        ].map(item => item.sp)
      )
    ];

    speciesNames.forEach(speciesName => {
      const speciesData =
        reaction.species[speciesName];

      if (!speciesData) {
        return;
      }

      if (
        usesGasVolume &&
        speciesData.gasAtSTP !== true
      ) {
        return;
      }

      eligibleSubstances.push({
        reaction,
        speciesName,
        speciesData
      });
    });
  });

  if (eligibleSubstances.length === 0) {
    throw new Error(
      "No eligible substances are available for this conversion type."
    );
  }

  const selectedSubstance =
    eligibleSubstances[
      rnd(0, eligibleSubstances.length - 1)
    ];

  const speciesName =
    selectedSubstance.speciesName;

  const speciesData =
    selectedSubstance.speciesData;

  const molarMass =
    toNum(speciesData.molarMass);

  let givenValue = 10;

  if (conversionType.includes("mol")) {
    givenValue = Number(
      (Math.random() * 2 + 0.2).toFixed(2)
    );
  }

  if (
    conversionType.includes("g_to") ||
    conversionType.includes("L_to")
  ) {
    givenValue = rnd(5, 45);
  }

  if (conversionType === "mol_to_L") {
    givenValue = Number(
      (Math.random() * 1.5 + 0.2).toFixed(2)
    );
  }

  const factorBank = [];
  const correct = [];

  const gramsToMolesFactor = {
    id: "mm_in",
    top: `1 mol ${speciesName}`,
    bottom: `${molarMass} g ${speciesName}`,
    flipped: false
  };

  const molesToGramsFactor = {
    id: "mm_out",
    top: `${molarMass} g ${speciesName}`,
    bottom: `1 mol ${speciesName}`,
    flipped: false
  };

  const litersToMolesFactor = {
    id: "stp_in",
    top: `1 mol ${speciesName}`,
    bottom: `22.4 L ${speciesName}`,
    flipped: false
  };

  const molesToLitersFactor = {
    id: "stp_out",
    top: `22.4 L ${speciesName}`,
    bottom: `1 mol ${speciesName}`,
    flipped: false
  };

  factorBank.push(
    gramsToMolesFactor,
    molesToGramsFactor
  );

  if (speciesData.gasAtSTP === true) {
    factorBank.push(
      litersToMolesFactor,
      molesToLitersFactor
    );
  }

  factorBank.push({
    id: "ratio_distractor",
    top: `2 mol ${speciesName}`,
    bottom: `1 mol ${speciesName}`,
    flipped: false
  });

  let prompt = "";
  let givenUnitHTML = "";
  let targetUnitHTML = "";
  let correctValue = NaN;
  let slotCount = 1;

  if (conversionType === "g_to_mol") {
    slotCount = 1;

    correct.push({
      id: "mm_in",
      flipped: false
    });

    correctValue =
      givenValue / molarMass;

    prompt = `
      Convert within one substance
      (no mole ratio needed).
      <br />

      If you start with
      <strong>${givenValue} g</strong>
      of
      <strong>${chemHTML(speciesName)}</strong>,
      build the setup to find
      <strong>moles</strong>
      of
      <strong>${chemHTML(speciesName)}</strong>.
    `;

    givenUnitHTML =
      chemHTML(`g ${speciesName}`);

    targetUnitHTML =
      chemHTML(`mol ${speciesName}`);
  }

  if (conversionType === "mol_to_g") {
    slotCount = 1;

    correct.push({
      id: "mm_out",
      flipped: false
    });

    correctValue =
      givenValue * molarMass;

    prompt = `
      Convert within one substance
      (no mole ratio needed).
      <br />

      If you start with
      <strong>${givenValue} mol</strong>
      of
      <strong>${chemHTML(speciesName)}</strong>,
      build the setup to find
      <strong>grams</strong>
      of
      <strong>${chemHTML(speciesName)}</strong>.
    `;

    givenUnitHTML =
      chemHTML(`mol ${speciesName}`);

    targetUnitHTML =
      chemHTML(`g ${speciesName}`);
  }

  if (conversionType === "L_to_mol") {
    slotCount = 1;

    correct.push({
      id: "stp_in",
      flipped: false
    });

    correctValue =
      givenValue / 22.4;

    prompt = `
      Convert within one substance
      (gas at STP — no mole ratio needed).
      <br />

      If you start with
      <strong>${givenValue} L</strong>
      of
      <strong>${chemHTML(speciesName)}</strong>
      at STP,
      build the setup to find
      <strong>moles</strong>
      of
      <strong>${chemHTML(speciesName)}</strong>.
    `;

    givenUnitHTML =
      chemHTML(`L ${speciesName}`);

    targetUnitHTML =
      chemHTML(`mol ${speciesName}`);
  }

  if (conversionType === "mol_to_L") {
    slotCount = 1;

    correct.push({
      id: "stp_out",
      flipped: false
    });

    correctValue =
      givenValue * 22.4;

    prompt = `
      Convert within one substance
      (gas at STP — no mole ratio needed).
      <br />

      If you start with
      <strong>${givenValue} mol</strong>
      of
      <strong>${chemHTML(speciesName)}</strong>,
      build the setup to find
      <strong>liters</strong>
      of
      <strong>${chemHTML(speciesName)}</strong>
      at STP.
    `;

    givenUnitHTML =
      chemHTML(`mol ${speciesName}`);

    targetUnitHTML =
      chemHTML(`L ${speciesName}`);
  }

  if (conversionType === "L_to_g") {
    slotCount = 2;

    correct.push({
      id: "stp_in",
      flipped: false
    });

    correct.push({
      id: "mm_out",
      flipped: false
    });

    correctValue =
      (givenValue / 22.4) * molarMass;

    prompt = `
      Convert within one substance
      (gas at STP — no mole ratio needed).
      <br />

      If you start with
      <strong>${givenValue} L</strong>
      of
      <strong>${chemHTML(speciesName)}</strong>
      at STP,
      build the setup to find
      <strong>grams</strong>
      of
      <strong>${chemHTML(speciesName)}</strong>.
    `;

    givenUnitHTML =
      chemHTML(`L ${speciesName}`);

    targetUnitHTML =
      chemHTML(`g ${speciesName}`);
  }

  if (conversionType === "g_to_L") {
    slotCount = 2;

    correct.push({
      id: "mm_in",
      flipped: false
    });

    correct.push({
      id: "stp_out",
      flipped: false
    });

    correctValue =
      (givenValue / molarMass) * 22.4;

    prompt = `
      Convert within one substance
      (gas at STP — no mole ratio needed).
      <br />

      If you start with
      <strong>${givenValue} g</strong>
      of
      <strong>${chemHTML(speciesName)}</strong>,
      build the setup to find
      <strong>liters</strong>
      of
      <strong>${chemHTML(speciesName)}</strong>
      at STP.
    `;

    givenUnitHTML =
      chemHTML(`g ${speciesName}`);

    targetUnitHTML =
      chemHTML(`L ${speciesName}`);
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

/* -------------------------------------------------
   Render the generated problem
------------------------------------------------- */

function renderProblem() {
  document.getElementById(
    "guidedProblemText"
  ).innerHTML = state.problem.prompt;

  document.getElementById(
    "givenValue"
  ).value = String(state.problem.givenValue);

  document.getElementById(
    "givenUnit"
  ).innerHTML = state.problem.givenUnitHTML;

  document.getElementById(
    "targetUnitTag"
  ).innerHTML = state.problem.targetUnitHTML;

  if (state.problem.mode === "stoich") {
    setPathLine(
      "<strong>Path:</strong> Convert → Ratio → Convert (3 factors)"
    );
  } else {
    setPathLine(
      `<strong>Path:</strong> ` +
      `Conversion only (no mole ratio) — ` +
      `${state.problem.slotCount} ` +
      `factor${state.problem.slotCount === 1 ? "" : "s"}`
    );
  }

  state.slotCount =
    state.problem.slotCount;

  state.slots = Array.from(
    {
      length: state.slotCount
    },
    () => null
  );

  state.selectedFactorId = null;

  renderBank();
  renderSlots();

  document.getElementById(
    "finalAnswer"
  ).value = "";

  setSetupFeedback(
    "Select a factor from the bank, then select a box. You can also drag factors into the boxes.",
    null
  );

  setFinalFeedback(
    "Enter your final number and click <strong>Check my final answer</strong>.",
    null
  );
}

/* -------------------------------------------------
   Final answer checking
------------------------------------------------- */

function checkFinal() {
  if (!setupIsCorrect()) {
    setFinalFeedback(
      "First, make sure your <strong>setup is correct</strong> in Step 2 so the units cancel. Then calculate your final number here.",
      false
    );

    return;
  }

  const rawAnswer = document
    .getElementById("finalAnswer")
    .value
    .trim()
    .replace(/,/g, "");

  const studentAnswer = Number(rawAnswer);

  if (!Number.isFinite(studentAnswer)) {
    setFinalFeedback(
      "Type a number, such as <strong>31.5</strong>.",
      false
    );

    return;
  }

  const expectedAnswer =
    state.problem.correctValue;

  const tolerance = Math.max(
    0.05,
    Math.abs(expectedAnswer) * 0.015
  );

  const difference = Math.abs(
    studentAnswer - expectedAnswer
  );

  if (difference <= tolerance) {
    setFinalFeedback(
      `✅ Correct! Expected about ` +
      `<strong>${expectedAnswer.toFixed(3)}</strong>.`,
      true
    );

    return;
  }

  const direction =
    studentAnswer > expectedAnswer
      ? "high"
      : "low";

  const tip =
    state.problem.mode === "stoich"
      ? "Tip: multiply the numerators, divide by the denominators, and re-check the mole-ratio direction."
      : "Tip: make sure the units cancel and check whether a conversion factor needs to be flipped.";

  setFinalFeedback(
    `❌ Not yet — your answer is a little ` +
    `<strong>too ${direction}</strong>.<br />` +
    `Expected about ` +
    `<strong>${expectedAnswer.toFixed(3)}</strong>.<br />` +
    `${tip}`,
    false
  );
}

function revealFinal() {
  const expectedAnswer =
    state.problem.correctValue;

  setFinalFeedback(
    `Expected about ` +
    `<strong>${expectedAnswer.toFixed(3)}</strong>.`,
    null
  );
}

/* -------------------------------------------------
   Mode handling and initialization
------------------------------------------------- */

function buildProblemForMode(mode) {
  if (mode === "conversion") {
    return buildConversionProblem();
  }

  return buildStoichProblem();
}

function applyModeFromUI() {
  const selectedRadio =
    document.querySelector(
      'input[name="practiceMode"]:checked'
    );

  state.mode = selectedRadio
    ? selectedRadio.value
    : "stoich";
}


function guidedHasProgress() {
  const hasPlacedFactor =
    Array.isArray(state.slots) &&
    state.slots.some(Boolean);

  const finalAnswer =
    document.getElementById("finalAnswer");

  const hasTypedFinalAnswer =
    Boolean(
      finalAnswer &&
      finalAnswer.value.trim()
    );

  return hasPlacedFactor || hasTypedFinalAnswer;
}

function setPracticeModeRadio(mode) {
  const radio =
    document.querySelector(
      `input[name="practiceMode"][value="${mode}"]`
    );

  if (radio) {
    radio.checked = true;
  }
}

function closeModeChangeDialog() {
  const dialog =
    document.getElementById("modeChangeDialog");

  if (dialog && dialog.open) {
    dialog.close();
  }
}

function cancelModeChange() {
  state.pendingMode = null;

  setPracticeModeRadio(state.mode);
  closeModeChangeDialog();

  const activeRadio =
    document.querySelector(
      `input[name="practiceMode"][value="${state.mode}"]`
    );

  if (activeRadio) {
    activeRadio.focus();
  }
}

function confirmModeChange() {
  if (!state.pendingMode) {
    return;
  }

  const requestedMode = state.pendingMode;
  state.pendingMode = null;
  state.mode = requestedMode;

  setPracticeModeRadio(requestedMode);
  closeModeChangeDialog();

  state.problem =
    buildProblemForMode(state.mode);

  renderProblem();

  const activeRadio =
    document.querySelector(
      `input[name="practiceMode"][value="${state.mode}"]`
    );

  if (activeRadio) {
    activeRadio.focus();
  }
}

function requestModeChange(requestedMode) {
  if (requestedMode === state.mode) {
    return;
  }

  if (!guidedHasProgress()) {
    state.mode = requestedMode;

    state.problem =
      buildProblemForMode(state.mode);

    renderProblem();
    return;
  }

  state.pendingMode = requestedMode;

  // Keep the current radio selected while the student decides.
  setPracticeModeRadio(state.mode);

  const dialog =
    document.getElementById("modeChangeDialog");

  const keepWorkingButton =
    document.getElementById("keepWorking");

  if (
    dialog &&
    typeof dialog.showModal === "function"
  ) {
    dialog.showModal();

    if (keepWorkingButton) {
      keepWorkingButton.focus();
    }

    return;
  }

  // Graceful fallback if <dialog> is unavailable.
  const shouldChange = window.confirm(
    "Change practice type?\n\nYour current problem and progress will be cleared."
  );

  if (shouldChange) {
    confirmModeChange();
  } else {
    cancelModeChange();
  }
}

async function init() {
  try {
    const response = await fetch(
      "problems.json?v=20260804b"
    );

    if (!response.ok) {
      throw new Error(
        `Unable to load problems.json (${response.status}).`
      );
    }

    DATA = await response.json();
  } catch (error) {
    console.error(error);

    setSetupFeedback(
      "The practice problems could not be loaded. Refresh the page or contact your teacher if the problem continues.",
      false
    );

    return;
  }

  document
    .querySelectorAll(
      'input[name="practiceMode"]'
    )
    .forEach(radio => {
      radio.addEventListener("change", () => {
        requestModeChange(radio.value);
      });
    });

  document
    .getElementById("newGuided")
    .addEventListener("click", () => {
      applyModeFromUI();

      state.problem =
        buildProblemForMode(state.mode);

      renderProblem();
    });

  document
    .getElementById("checkSetup")
    .addEventListener(
      "click",
      checkSetup
    );

  document
    .getElementById("showCorrectSetup")
    .addEventListener(
      "click",
      showCorrectSetup
    );

  document
    .getElementById("checkFinal")
    .addEventListener(
      "click",
      checkFinal
    );

  document
    .getElementById("revealFinal")
    .addEventListener(
      "click",
      revealFinal
    );

  const keepWorkingButton =
    document.getElementById("keepWorking");

  if (keepWorkingButton) {
    keepWorkingButton.addEventListener(
      "click",
      cancelModeChange
    );
  }

  const confirmModeChangeButton =
    document.getElementById("confirmModeChange");

  if (confirmModeChangeButton) {
    confirmModeChangeButton.addEventListener(
      "click",
      confirmModeChange
    );
  }

  const modeChangeDialog =
    document.getElementById("modeChangeDialog");

  if (modeChangeDialog) {
    modeChangeDialog.addEventListener(
      "cancel",
      event => {
        event.preventDefault();
        cancelModeChange();
      }
    );
  }

  applyModeFromUI();

  state.problem =
    buildProblemForMode(state.mode);

  renderProblem();
}

init();
