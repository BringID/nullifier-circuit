import { Barretenberg, UltraHonkBackend } from '@aztec/bb.js';
import { Noir } from '@noir-lang/noir_js';
import initNoirC from '@noir-lang/noirc_abi';
import initACVM from '@noir-lang/acvm_js';

// Import WASM modules
import acvm from '@noir-lang/acvm_js/web/acvm_js_bg.wasm?url';
import noirc from '@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url';

// Import compiled circuit
import circuit from '../target/nullifier_circuit.json';

// UI elements
const secretBaseInput = document.getElementById('secretBase');
const appIdInput = document.getElementById('appId');
const scopeInput = document.getElementById('scope');
const generateBtn = document.getElementById('generateBtn');
const verifyBtn = document.getElementById('verifyBtn');
const statusEl = document.getElementById('status');
const outputEl = document.getElementById('output');
const resultsEl = document.getElementById('results');

let noir;
let backend;
let currentProof;

function setStatus(message, type = 'loading') {
  statusEl.textContent = message;
  statusEl.className = type;
}

function showResults(data) {
  outputEl.style.display = 'block';
  resultsEl.innerHTML = Object.entries(data)
    .map(([key, value]) => `<strong>${key}:</strong><br>${value}<br><br>`)
    .join('');
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
    const api = await Barretenberg.new();

    // Create UltraHonk backend with API
    backend = new UltraHonkBackend(circuit.bytecode, api);

    setStatus('Ready! Enter values and generate a proof.', 'success');
    generateBtn.disabled = false;
  } catch (error) {
    console.error('Init error:', error);
    setStatus(`Initialization failed: ${error.message}`, 'error');
  }
}

// Generate proof
async function generateProof() {
  try {
    generateBtn.disabled = true;
    verifyBtn.disabled = true;
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
    currentProof = proof;

    const nullifier = '0x' + BigInt(returnValue).toString(16).padStart(64, '0');

    showResults({
      'Nullifier': nullifier,
      'Proof size': `${proof.proof.length} bytes`,
      'Proof (hex)': '0x' + Array.from(proof.proof.slice(0, 64))
        .map(b => b.toString(16).padStart(2, '0')).join('') + '...',
    });

    setStatus('Proof generated successfully!', 'success');
    verifyBtn.disabled = false;
  } catch (error) {
    console.error('Generate error:', error);
    setStatus(`Proof generation failed: ${error.message}`, 'error');
    showResults({ 'Error': error.message });
  } finally {
    generateBtn.disabled = false;
  }
}

// Verify proof
async function verifyProof() {
  if (!currentProof) {
    setStatus('No proof to verify', 'error');
    return;
  }

  try {
    verifyBtn.disabled = true;
    setStatus('Verifying proof...');

    const isValid = await backend.verifyProof(currentProof);

    setStatus(isValid ? 'Proof verified successfully!' : 'Proof verification failed!',
              isValid ? 'success' : 'error');

    showResults({
      'Verification result': isValid ? 'VALID' : 'INVALID',
      'Proof size': `${currentProof.proof.length} bytes`,
    });
  } catch (error) {
    console.error('Verify error:', error);
    setStatus(`Verification failed: ${error.message}`, 'error');
  } finally {
    verifyBtn.disabled = false;
  }
}

// Event listeners
generateBtn.addEventListener('click', generateProof);
verifyBtn.addEventListener('click', verifyProof);
generateBtn.disabled = true;

// Start initialization
init();
