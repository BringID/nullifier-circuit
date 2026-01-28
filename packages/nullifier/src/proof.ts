import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import type {
  NullifierIdentity,
  NullifierProof,
  NullifierProofWithVK,
  ProofOptions,
} from "./types.js";
import { computeNullifier } from "./identity.js";

// Circuit will be loaded dynamically
let circuitPromise: Promise<any> | null = null;
let noirInstance: Noir | null = null;
let backendInstance: UltraHonkBackend | null = null;
let apiInstance: Barretenberg | null = null;
let wasmInitialized = false;
let wasmInitPromise: Promise<void> | null = null;

/**
 * Initialize WASM modules automatically.
 * Called internally before proof generation.
 */
async function autoInitWasm(): Promise<void> {
  if (wasmInitialized) return;
  if (wasmInitPromise) return wasmInitPromise;

  wasmInitPromise = (async () => {
    // Check if we're in browser
    if (typeof window !== "undefined" && typeof fetch !== "undefined") {
      try {
        // Dynamically import the init functions
        const [acvmModule, noircModule] = await Promise.all([
          import("@noir-lang/acvm_js"),
          import("@noir-lang/noirc_abi"),
        ]);

        const initACVM = acvmModule.default;
        const initNoirC = noircModule.default;

        // Try to fetch WASM from common CDN paths or node_modules
        const wasmPaths = [
          // Vite dev server paths
          "/node_modules/@noir-lang/acvm_js/web/acvm_js_bg.wasm",
          "/node_modules/@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm",
        ];

        // Try fetching from node_modules path (works with Vite)
        const [acvmWasm, noircWasm] = await Promise.all([
          fetch(wasmPaths[0]),
          fetch(wasmPaths[1]),
        ]);

        if (acvmWasm.ok && noircWasm.ok) {
          await Promise.all([
            initACVM(acvmWasm),
            initNoirC(noircWasm),
          ]);
        } else {
          throw new Error("WASM files not found at expected paths");
        }
      } catch (e) {
        console.warn("Auto WASM init failed. Call initWasm() manually with WASM URLs.", e);
        // Don't throw - allow manual init
      }
    }
    wasmInitialized = true;
  })();

  return wasmInitPromise;
}

/**
 * Initialize WASM modules manually. Required for browser environments
 * if automatic initialization fails.
 *
 * @example
 * ```typescript
 * // Vite
 * import acvm from '@noir-lang/acvm_js/web/acvm_js_bg.wasm?url';
 * import noirc from '@noir-lang/noirc_abi/web/noirc_abi_wasm_bg.wasm?url';
 * await initWasm(acvm, noirc);
 * ```
 */
export async function initWasm(acvmUrl: string, noircUrl: string): Promise<void> {
  if (wasmInitialized) return;

  const [initACVM, initNoirC] = await Promise.all([
    import("@noir-lang/acvm_js").then(m => m.default),
    import("@noir-lang/noirc_abi").then(m => m.default),
  ]);

  await Promise.all([
    initACVM(fetch(acvmUrl)),
    initNoirC(fetch(noircUrl)),
  ]);

  wasmInitialized = true;
  wasmInitPromise = Promise.resolve();
}

/**
 * Load the circuit JSON.
 */
async function loadCircuit(): Promise<any> {
  if (!circuitPromise) {
    circuitPromise = (async () => {
      try {
        const circuit = await import("../circuit/nullifier_circuit.json", {
          assert: { type: "json" },
        });
        return circuit.default || circuit;
      } catch {
        throw new Error(
          "Circuit not found. Make sure nullifier_circuit.json is in the circuit/ directory."
        );
      }
    })();
  }
  return circuitPromise;
}

/**
 * Initialize the Noir and Barretenberg instances.
 */
async function initialize(): Promise<{
  noir: Noir;
  backend: UltraHonkBackend;
  api: Barretenberg;
}> {
  if (noirInstance && backendInstance && apiInstance) {
    return { noir: noirInstance, backend: backendInstance, api: apiInstance };
  }

  // Auto-init WASM (browser only)
  await autoInitWasm();

  const circuit = await loadCircuit();

  apiInstance = await Barretenberg.new();
  noirInstance = new Noir(circuit);
  backendInstance = new UltraHonkBackend(circuit.bytecode, apiInstance);

  return {
    noir: noirInstance,
    backend: backendInstance,
    api: apiInstance,
  };
}

function toHex(arr: Uint8Array): string {
  return "0x" + Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  hex = hex.replace(/^0x/, "");
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return arr;
}

/**
 * Generate a ZK proof that you know the secret for a nullifier.
 *
 * @param identity - The nullifier identity
 * @param scope - The scope/context for this proof
 * @param options - Proof generation options
 * @returns The proof data including nullifier and ZK proof
 *
 * @example
 * ```typescript
 * const identity = createIdentity(12345n, 1n);
 * const proof = await generateProof(identity, 100n);
 * ```
 */
export async function generateProof(
  identity: NullifierIdentity,
  scope: bigint | number | string,
  options: ProofOptions = {}
): Promise<NullifierProofWithVK> {
  const { includeVK = true } = options;
  const scopeBigInt = BigInt(scope);

  const { noir, backend } = await initialize();

  const inputs = {
    secret_base: identity.secretBase.toString(),
    app_id: identity.appId.toString(),
    scope: scopeBigInt.toString(),
  };

  const { witness, returnValue } = await noir.execute(inputs);
  const proofData = await backend.generateProof(witness);
  const nullifier = BigInt(returnValue as string);

  const expectedNullifier = computeNullifier(identity, scopeBigInt);
  if (nullifier !== expectedNullifier) {
    throw new Error("Nullifier mismatch - circuit execution error");
  }

  const result: NullifierProofWithVK = {
    nullifier,
    publicInputs: proofData.publicInputs,
    proof: toHex(proofData.proof),
    verificationKey: "",
  };

  if (includeVK) {
    const vk = await backend.getVerificationKey();
    result.verificationKey = toHex(vk);
  }

  return result;
}

/**
 * Verify a nullifier proof.
 *
 * @param proof - The proof to verify
 * @returns True if the proof is valid
 */
export async function verifyProof(
  proof: NullifierProof | NullifierProofWithVK
): Promise<boolean> {
  const { backend } = await initialize();

  const proofData = {
    publicInputs: proof.publicInputs,
    proof: fromHex(proof.proof),
  };

  return backend.verifyProof(proofData);
}

/**
 * Extract public values from a proof.
 */
export function extractPublicInputs(proof: NullifierProof): {
  appId: bigint;
  scope: bigint;
  nullifier: bigint;
} {
  return {
    appId: BigInt(proof.publicInputs[0]),
    scope: BigInt(proof.publicInputs[1]),
    nullifier: BigInt(proof.publicInputs[2]),
  };
}

/**
 * Cleanup resources.
 */
export async function cleanup(): Promise<void> {
  if (apiInstance) {
    await apiInstance.destroy();
  }
  noirInstance = null;
  backendInstance = null;
  apiInstance = null;
  circuitPromise = null;
  wasmInitialized = false;
  wasmInitPromise = null;
}
