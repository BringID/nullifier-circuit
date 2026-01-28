/**
 * Nullifier identity containing the secret and app binding
 */
export type NullifierIdentity = {
  /** The private secret (never revealed) */
  secretBase: bigint;
  /** The application identifier */
  appId: bigint;
  /** The derived identity secret: poseidon([secretBase, appId]) */
  identitySecret: bigint;
};

/**
 * Proof inputs for generating a nullifier proof
 */
export type NullifierProofInput = {
  /** The nullifier identity */
  identity: NullifierIdentity;
  /** The scope/context for this proof */
  scope: bigint;
};

/**
 * The generated proof data
 */
export type NullifierProof = {
  /** The deterministic nullifier */
  nullifier: bigint;
  /** Public inputs: [appId, scope, nullifier] */
  publicInputs: string[];
  /** The ZK proof bytes as hex string */
  proof: string;
};

/**
 * Full proof data including verification key (for standalone verification)
 */
export type NullifierProofWithVK = NullifierProof & {
  /** Verification key as hex string */
  verificationKey: string;
};

/**
 * Options for proof generation
 */
export type ProofOptions = {
  /** Include verification key in output (default: true) */
  includeVK?: boolean;
};
