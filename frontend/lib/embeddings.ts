// In-browser embeddings using @huggingface/transformers
// Uses EmbeddingGemma-300M (q4) — SOTA for on-device embeddings
// Outputs truncated to 256d via Matryoshka for speed + quality

const MODEL_ID = "onnx-community/embeddinggemma-300m-ONNX";
const EMBED_DIM = 256; // Matryoshka truncation (768 → 256)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipeline: any = null;
let loadPromise: Promise<void> | null = null;

async function loadModel(): Promise<void> {
  if (pipeline) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { pipeline: createPipeline } = await import(
      "@huggingface/transformers"
    );
    pipeline = await createPipeline("feature-extraction", MODEL_ID, {
      dtype: "q4",
    });
  })();
  return loadPromise;
}

function truncateAndNormalize(embedding: number[], dim: number): number[] {
  const truncated = embedding.slice(0, dim);
  let norm = 0;
  for (let i = 0; i < truncated.length; i++) {
    norm += truncated[i] * truncated[i];
  }
  norm = Math.sqrt(norm);
  if (norm === 0) return truncated;
  return truncated.map((v) => v / norm);
}

export async function getEmbedding(text: string): Promise<number[]> {
  await loadModel();
  if (!pipeline) throw new Error("Embedding model not loaded");

  const result = await pipeline(text, {
    pooling: "mean",
    normalize: true,
  });
  const full = Array.from(result.data as Float32Array);
  return truncateAndNormalize(full, EMBED_DIM);
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  await loadModel();
  if (!pipeline) throw new Error("Embedding model not loaded");

  const results: number[][] = [];
  for (const text of texts) {
    const result = await pipeline(text, {
      pooling: "mean",
      normalize: true,
    });
    const full = Array.from(result.data as Float32Array);
    results.push(truncateAndNormalize(full, EMBED_DIM));
  }
  return results;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
