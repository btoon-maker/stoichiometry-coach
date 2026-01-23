// Mole Map Coach
// You can add quick video links per step below.
// Keep them SHORT (1–3 min). You can use YouTube share links or LMS-hosted links.
const VIDEO = {
  grams_to_moles: "",     // e.g. "https://youtu.be/..."
  moles_to_grams: "",
  moles_to_particles: "",
  particles_to_moles: "",
  moles_to_liters: "",
  liters_to_moles: "",
  mole_ratio: ""
};

const STEPS = {
  grams_to_moles: {
    title: "Convert grams → moles",
    badge: "Convert",
    text: "Use molar mass (g/mol). Grams ÷ (g/mol) = moles.",
    videoKey: "grams_to_moles"
  },
  moles_to_grams: {
    title: "Convert moles → grams",
    badge: "Convert",
    text: "Use molar mass (g/mol). Moles × (g/mol) = grams.",
    videoKey: "moles_to_grams"
  },
  moles_to_particles: {
    title: "Convert moles → particles",
    badge: "Convert",
    text: "Use Avogadro’s number: 6.022×10²³ particles per mol.",
    videoKey: "moles_to_particles"
  },
  particles_to_moles: {
    title: "Convert particles → moles",
    badge: "Convert",
    text: "Particles ÷ (6.022×10²³) = moles.",
    videoKey: "particles_to_moles"
  },
  moles_to_liters: {
    title: "Convert moles → liters (STP)",
    badge: "Convert",
    text: "At STP: 1 mol gas = 22.4 L. Moles × 22.4 = liters.",
    videoKey: "moles_to_liters"
  },
  liters_to_moles: {
    title: "Convert liters → moles (STP)",
    badge: "Convert",
    text: "At STP: liters ÷ 22.4 = moles.",
    videoKey: "liters_to_moles"
  },
  mole_ratio: {
    title: "Use the mole ratio (balanced equation)",
    badge: "Ratio",
    text: "Use coefficients as mol:mol conversion between substances.",
    videoKey: "mole_ratio"
  }
};

// ------------------------------
// Helpers: parse start/target value
// ------------------------------
function parseChoice(value) {
  // value examples: gramsA, molesB, particlesA, litersB
  const unit = value.replace(/A$/, "").replace(/B$/, "");
  const substance = value.endsWith("A") ? "A" : "B";
  return { unit, substance };
}

// ------------------------------
// Path builders
// ------------------------------

// Same-substance conversion path (no mole ratio)
function buildSameSubstancePath(startUnit, targetUnit) {
  const path = [];

  // If already same unit, no steps.
  if (startUnit === targetUnit) return path;

  // Convert start to moles if needed
  if (startUnit !== "moles") {
    path.push(unitToMolesStep(startUnit));
  }

  // Convert moles to target if needed
  if (targetUnit !== "moles") {
    path.push(molesToUnitStep(targetUnit));
  }

  return path;
}

// Stoichiometry path: convert → ratio → convert
function buildStoichiometryPath(startUnit, targetUnit) {
  const path = [];

  // Step 1: ensure moles of start substance
  if (startUnit !== "moles") {
    path.push(unitToMolesStep(startUnit));
  }

  // Step 2: mole ratio (always needed if substance changes)
  path.push("mole_ratio");

  // Step 3: convert from moles to target unit (if needed)
  if (targetUnit !== "moles") {
    path.push(molesToUnitStep(targetUnit));
  }

  return path;
}

// Main router: choose same-substance vs cross-substance logic
function buildPath(startValue, targetValue) {
  const start = parseChoice(startValue);
  const target = parseChoice(targetValue);

  const sameSubstance = start.substance === target.substance;

  if (sameSubstance) {
    return buildSameSubstancePath(start.unit, target.unit);
  }

  return buildStoichiometryPath(start.unit, target.unit);
}

// ------------------------------
// Step key mappers
// ------------------------------
function unitToMolesStep(unit) {
  if (unit === "grams") return "grams_to_moles";
  if (unit === "particles") return "particles_to_moles";
  if (unit === "liters") return "liters_to_moles";
  return "grams_to_moles";
}

function molesToUnitStep(unit) {
  if (unit === "grams") return "moles_to_grams";
  if (unit === "particles") return "moles_to_particles";
  if (unit === "liters") return "moles_to_liters";
  return "moles_to_grams";
}

// ------------------------------
// Rendering
// ------------------------------
function renderPath(pathKeys, startValue, targetValue) {
  const area = document.getElementById("pathArea");
  area.innerHTML = "";

  const start = parseChoice(startValue);
  const target = parseChoice(targetValue);

  const isSameSubstance = start.substance === target.substance;

  // A small contextual header so students can "see" what type of path it is.
  const header = document.createElement("div");
  header.className = "step";
  header.innerHTML = `
    <div class="stepTitle">
      <div><strong>Your path type:</strong> ${
        isSameSubstance
          ? `Within Substance ${start.substance} (unit conversion)`
          : `Stoichiometry from ${start.substance} → ${target.substance}`
      }</div>
      <span class="badge">${isSameSubstance ? "Convert" : "Convert → Ratio → Convert"}</span>
    </div>
    <p class="muted" style="margin:0;">
      ${isSameSubstance
        ? "No mole ratio needed because you are staying within the same substance."
        : "You will convert to moles, use the mole ratio from the balanced equation, then convert to the target unit."
      }
    </p>
  `;
  area.appendChild(header);

  if (!pathKeys.length) {
    const div = document.createElement("div");
    div.className = "step";
    div.innerHTML = `
      <div class="stepTitle"><div><strong>No steps needed</strong></div><span class="badge">Done</span></div>
      <p>You’re already at the target form.</p>
    `;
    area.appendChild(div);
    return;
  }

  pathKeys.forEach((key, i) => {
    const step = STEPS[key];
    const videoLink = VIDEO[step.videoKey];

    const div = document.createElement("div");
    div.className = "step";
    div.innerHTML = `
      <div class="stepTitle">
        <div><strong>Step ${i + 1}:</strong> ${step.title}</div>
        <span class="badge">${step.badge}</span>
      </div>
      <p>${step.text}</p>
      ${videoLink ? `<p><a href="${videoLink}" target="_blank" rel="noopener">Watch a quick example</a></p>` : ``}
    `;
    area.appendChild(div);
  });
}

// ------------------------------
// Wire up UI
// ------------------------------
document.getElementById("buildPath").addEventListener("click", () => {
  const startValue = document.getElementById("start").value;
  const targetValue = document.getElementById("target").value;

  const path = buildPath(startValue, targetValue);
  renderPath(path, startValue, targetValue);
});

document.getElementById("reset").addEventListener("click", () => {
  document.getElementById("start").selectedIndex = 0;
  document.getElementById("target").selectedIndex = 0;
  document.getElementById("pathArea").innerHTML = "";
});
