import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import { Noir } from '@noir-lang/noir_js';
import initNoirC from '@noir-lang/noirc_abi';
import initACVM from '@noir-lang/acvm_js';

// Import WASM modules
import acvm from '@noir-lang/acvm_js/web/acvm_js_bg.wasm?url';
import noirc from '@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url';

// Import compiled circuit
import circuit from '../target/nullifier_circuit.json';

// UI elements - Prover
const secretBaseInput = document.getElementById('secretBase');
const appIdInput = document.getElementById('appId');
const scopeInput = document.getElementById('scope');
const generateBtn = document.getElementById('generateBtn');
const statusEl = document.getElementById('status');

// UI elements - Proof Output
const proofOutput = document.getElementById('proofOutput');
const publicInputsDisplay = document.getElementById('publicInputsDisplay');
const proofHex = document.getElementById('proofHex');
const vkHex = document.getElementById('vkHex');
const copyProofBtn = document.getElementById('copyProofBtn');

// UI elements - Verifier
const verifyInput = document.getElementById('verifyInput');
const verifyBtn = document.getElementById('verifyBtn');
const verifyResult = document.getElementById('verifyResult');

let noir;
let backend;
let api;
let currentProofData = null;

function setStatus(message, type = 'loading') {
  statusEl.textContent = message;
  statusEl.className = type;
}

function uint8ArrayToHex(arr) {
  return '0x' + Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToUint8Array(hex) {
  hex = hex.replace(/^0x/, '');
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return arr;
}

// Initialize WASM modules
async function init() {
  try {
    setStatus('Initializing WASM modules...');

    // Initialize Noir WASM
    await Promise.all([
      initACVM(fetch(acvm)),
      initNoirC(fetch(noirc))
    ]);

    // Create Noir instance
    noir = new Noir(circuit);

    setStatus('Initializing Barretenberg...');

    // Initialize Barretenberg API
    api = await Barretenberg.new();

    // Create UltraHonk backend with API
    backend = new UltraHonkBackend(circuit.bytecode, api);

    setStatus('Ready! Enter values and generate a proof.', 'success');
    generateBtn.disabled = false;
    verifyBtn.disabled = false;
  } catch (error) {
    console.error('Init error:', error);
    setStatus(`Initialization failed: ${error.message}`, 'error');
  }
}

// Generate proof
async function generateProof() {
  try {
    generateBtn.disabled = true;
    setStatus('Executing circuit...');

    const inputs = {
      secret_base: secretBaseInput.value,
      app_id: appIdInput.value,
      scope: scopeInput.value,
    };

    console.log('Inputs:', inputs);

    // Execute circuit to get witness
    const { witness, returnValue } = await noir.execute(inputs);

    setStatus('Generating proof (this may take a moment)...');

    // Generate proof
    const proof = await backend.generateProof(witness);

    // Get verification key
    const vk = await backend.getVerificationKey();

    // Format nullifier
    const nullifier = '0x' + BigInt(returnValue).toString(16).padStart(64, '0');

    // Store current proof data
    currentProofData = {
      publicInputs: proof.publicInputs,
      proof: uint8ArrayToHex(proof.proof),
      vk: uint8ArrayToHex(vk),
    };

    // Display public inputs
    publicInputsDisplay.textContent =
      `app_id:    ${proof.publicInputs[0]}\n` +
      `scope:     ${proof.publicInputs[1]}\n` +
      `nullifier: ${nullifier}\n\n` +
      `Raw: ${JSON.stringify(proof.publicInputs, null, 2)}`;

    // Display proof and VK
    proofHex.value = currentProofData.proof;
    vkHex.value = currentProofData.vk;

    // Auto-fill verifier input
    verifyInput.value = JSON.stringify(currentProofData, null, 2);

    // Show proof output section
    proofOutput.style.display = 'block';

    setStatus('Proof generated successfully!', 'success');
  } catch (error) {
    console.error('Generate error:', error);
    setStatus(`Proof generation failed: ${error.message}`, 'error');
  } finally {
    generateBtn.disabled = false;
  }
}

// Copy proof data to clipboard
function copyProofData() {
  if (currentProofData) {
    navigator.clipboard.writeText(JSON.stringify(currentProofData, null, 2));
    copyProofBtn.textContent = 'Copied!';
    setTimeout(() => { copyProofBtn.textContent = 'Copy Proof Data as JSON'; }, 2000);
  }
}

// Verify proof
async function verifyProof() {
  try {
    verifyBtn.disabled = true;
    setStatus('Verifying proof...');
    verifyResult.style.display = 'block';

    // Parse input
    let proofData;
    try {
      proofData = JSON.parse(verifyInput.value);
    } catch (e) {
      throw new Error('Invalid JSON. Please paste valid proof data.');
    }

    if (!proofData.publicInputs || !proofData.proof || !proofData.vk) {
      throw new Error('Missing required fields: publicInputs, proof, vk');
    }

    // Convert hex strings back to Uint8Array
    const proofBytes = hexToUint8Array(proofData.proof);
    const vkBytes = hexToUint8Array(proofData.vk);

    // Reconstruct ProofData object
    const proofToVerify = {
      publicInputs: proofData.publicInputs,
      proof: proofBytes,
    };

    // Verify using the verification key
    // Note: In bb.js 3.x, verifyProof uses the VK from the backend
    // For standalone verification with a provided VK, we need UltraHonkVerifierBackend
    const isValid = await backend.verifyProof(proofToVerify);

    const nullifierHex = '0x' + BigInt(proofData.publicInputs[2]).toString(16).padStart(64, '0');

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

    setStatus(isValid ? 'Proof verified!' : 'Proof invalid!', isValid ? 'success' : 'error');
  } catch (error) {
    console.error('Verify error:', error);
    verifyResult.innerHTML = `<span style="color: #ff4444">Error: ${error.message}</span>`;
    setStatus(`Verification failed: ${error.message}`, 'error');
  } finally {
    verifyBtn.disabled = false;
  }
}

// Event listeners
generateBtn.addEventListener('click', generateProof);
copyProofBtn.addEventListener('click', copyProofData);
verifyBtn.addEventListener('click', verifyProof);
generateBtn.disabled = true;
verifyBtn.disabled = true;

// Start initialization
init();
