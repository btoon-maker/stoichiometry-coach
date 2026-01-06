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

// Route builder: always do convert → ratio → convert
function buildPath(start, target) {
  const startUnit = start.replace(/A$/,"").replace(/B$/,""); // grams/moles/particles/liters
  const targetUnit = target.replace(/A$/,"").replace(/B$/,"");

  const startSubstance = start.endsWith("A") ? "A" : "B";
  const targetSubstance = target.endsWith("A") ? "A" : "B";

  const path = [];

  // Step 1: ensure moles of start substance
  if (startUnit !== "moles") {
    path.push(unitToMolesStep(startUnit));
  }

  // Step 2: if substance changes, do mole ratio
  if (startSubstance !== targetSubstance) {
    path.push("mole_ratio");
  }

  // Step 3: convert from moles to target unit (if needed)
  if (targetUnit !== "moles") {
    path.push(molesToUnitStep(targetUnit));
  }

  return path;
}

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

function renderPath(pathKeys) {
  const area = document.getElementById("pathArea");
  area.innerHTML = "";

  if (!pathKeys.length) {
    area.innerHTML = `<div class="step"><div class="stepTitle"><strong>No steps needed</strong></div>
      <p>You’re already at the target form.</p></div>`;
    return;
  }

  pathKeys.forEach((key, i) => {
    const step = STEPS[key];
    const videoLink = VIDEO[step.videoKey];

    const div = document.createElement("div");
    div.className = "step";
    div.innerHTML = `
      <div class="stepTitle">
        <div><strong>Step ${i+1}:</strong> ${step.title}</div>
        <span class="badge">${step.badge}</span>
      </div>
      <p>${step.text}</p>
      ${videoLink ? `<p><a href="${videoLink}" target="_blank" rel="noopener">Watch a quick example</a></p>` : ``}
    `;
    area.appendChild(div);
  });
}

// Wire up UI
document.getElementById("buildPath").addEventListener("click", () => {
  const start = document.getElementById("start").value;
  const target = document.getElementById("target").value;
  const path = buildPath(start, target);
  renderPath(path);
});

document.getElementById("reset").addEventListener("click", () => {
  document.getElementById("start").selectedIndex = 0;
  document.getElementById("target").selectedIndex = 0;
  document.getElementById("pathArea").innerHTML = "";
});
