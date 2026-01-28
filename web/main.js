import {
  createIdentity,
  generateProof,
  verifyProof,
  computeNullifier,
  extractPublicInputs,
} from "@bringid/nullifier";

// UI elements - Prover
const secretBaseInput = document.getElementById("secretBase");
const appIdInput = document.getElementById("appId");
const scopeInput = document.getElementById("scope");
const generateBtn = document.getElementById("generateBtn");
const statusEl = document.getElementById("status");

// UI elements - Proof Output
const proofOutput = document.getElementById("proofOutput");
const publicInputsDisplay = document.getElementById("publicInputsDisplay");
const proofHex = document.getElementById("proofHex");
const vkHex = document.getElementById("vkHex");
const copyProofBtn = document.getElementById("copyProofBtn");

// UI elements - Verifier
const verifyInput = document.getElementById("verifyInput");
const verifyBtn = document.getElementById("verifyBtn");
const verifyResult = document.getElementById("verifyResult");

let currentProofData = null;

function setStatus(message, type = "loading") {
  statusEl.textContent = message;
  statusEl.className = type;
}

function formatNullifier(n) {
  return "0x" + n.toString(16).padStart(64, "0");
}

// Initialize - WASM is now auto-initialized by the package
async function init() {
  setStatus("Ready! Enter values and generate a proof.", "success");
  generateBtn.disabled = false;
  verifyBtn.disabled = false;
}

// Generate proof using @bringid/nullifier
async function handleGenerateProof() {
  try {
    generateBtn.disabled = true;
    setStatus("Creating identity...");

    // Create identity from inputs
    const identity = createIdentity(
      secretBaseInput.value,
      appIdInput.value
    );

    // Preview nullifier (instant, no ZK)
    const previewNullifier = computeNullifier(identity, scopeInput.value);
    setStatus(`Generating ZK proof for nullifier ${formatNullifier(previewNullifier).slice(0, 18)}...`);

    // Generate ZK proof
    const proof = await generateProof(identity, scopeInput.value);

    // Store for verification
    currentProofData = {
      publicInputs: proof.publicInputs,
      proof: proof.proof,
      vk: proof.verificationKey,
    };

    // Display public inputs
    const { appId, scope, nullifier } = extractPublicInputs(proof);
    publicInputsDisplay.textContent =
      `app_id:    ${appId}\n` +
      `scope:     ${scope}\n` +
      `nullifier: ${formatNullifier(nullifier)}\n\n` +
      `Raw: ${JSON.stringify(proof.publicInputs, null, 2)}`;

    // Display proof and VK
    proofHex.value = proof.proof;
    vkHex.value = proof.verificationKey;

    // Auto-fill verifier input
    verifyInput.value = JSON.stringify(currentProofData, null, 2);

    // Show proof output section
    proofOutput.style.display = "block";

    setStatus("Proof generated successfully!", "success");
  } catch (error) {
    console.error("Generate error:", error);
    setStatus(`Proof generation failed: ${error.message}`, "error");
  } finally {
    generateBtn.disabled = false;
  }
}

// Copy proof data to clipboard
function handleCopyProof() {
  if (currentProofData) {
    navigator.clipboard.writeText(JSON.stringify(currentProofData, null, 2));
    copyProofBtn.textContent = "Copied!";
    setTimeout(() => {
      copyProofBtn.textContent = "Copy Proof Data as JSON";
    }, 2000);
  }
}

// Verify proof using @bringid/nullifier
async function handleVerifyProof() {
  try {
    verifyBtn.disabled = true;
    setStatus("Verifying proof...");
    verifyResult.style.display = "block";

    // Parse input
    let proofData;
    try {
      proofData = JSON.parse(verifyInput.value);
    } catch (e) {
      throw new Error("Invalid JSON. Please paste valid proof data.");
    }

    if (!proofData.publicInputs || !proofData.proof) {
      throw new Error("Missing required fields: publicInputs, proof");
    }

    // Verify using @bringid/nullifier
    const isValid = await verifyProof(proofData);

    // Extract public inputs for display
    const nullifierHex = "0x" + BigInt(proofData.publicInputs[2]).toString(16).padStart(64, "0");

    verifyResult.innerHTML = isValid
      ? `<span style="color: #00ff88">✓ PROOF VALID</span>\n\n` +
        `Verified public inputs:\n` +
        `  app_id:    ${proofData.publicInputs[0]}\n` +
        `  scope:     ${proofData.publicInputs[1]}\n` +
        `  nullifier: ${nullifierHex}\n\n` +
        `The prover knows a valid secret_base for this nullifier.`
      : `<span style="color: #ff4444">✗ PROOF INVALID</span>\n\n` +
        `The proof does not verify. Either:\n` +
        `  - The proof was tampered with\n` +
        `  - The public inputs don't match\n` +
        `  - The prover doesn't know a valid secret`;

    setStatus(isValid ? "Proof verified!" : "Proof invalid!", isValid ? "success" : "error");
  } catch (error) {
    console.error("Verify error:", error);
    verifyResult.innerHTML = `<span style="color: #ff4444">Error: ${error.message}</span>`;
    setStatus(`Verification failed: ${error.message}`, "error");
  } finally {
    verifyBtn.disabled = false;
  }
}

// Event listeners
generateBtn.addEventListener("click", handleGenerateProof);
copyProofBtn.addEventListener("click", handleCopyProof);
verifyBtn.addEventListener("click", handleVerifyProof);
generateBtn.disabled = true;
verifyBtn.disabled = true;

// Start initialization
init();
