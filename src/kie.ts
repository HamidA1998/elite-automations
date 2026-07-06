import fs from "node:fs/promises";
import path from "node:path";

import {brand, kie} from "@/config";
import {escapeHtml, writeBinary, writeText} from "@/utils";

type KieTaskResponse = {
  code?: number;
  msg?: string;
  data?: {
    taskId?: string;
    resultUrls?: string[];
    response?: {
      resultUrls?: string[];
    };
    works?: Array<{
      resource?: {
        resource?: string;
      };
    }>;
  };
  successFlag?: number;
  progress?: string;
  errorMessage?: string;
};

export type KieModelKind = "image" | "video";
export type KieModelGenerationMode = "text-to-image" | "image-edit" | "text-to-video" | "image-to-video";
type KieEndpointType = "jobs" | "gpt4o-image" | "flux-kontext";

export interface KieModelDefinition {
  id: string;
  name: string;
  provider: string;
  kind: KieModelKind;
  endpointType: KieEndpointType;
  supports: KieModelGenerationMode[];
  description: string;
  defaultAspectRatio: string;
  docsUrl: string;
  supportsDirectGeneration: boolean;
  inputHints: string[];
  fields: Array<{
    key: string;
    label: string;
    type: "text" | "number" | "boolean" | "select";
    helper: string;
    required?: boolean;
    options?: string[];
  }>;
}

export interface KieImageGenerationRequest {
  modelId: string;
  prompt: string;
  aspectRatio?: string;
  title?: string;
  subtitle?: string;
  inputImageUrls?: string[];
  maskUrl?: string | null;
  variants?: number;
}

export interface KieVideoGenerationRequest {
  modelId: string;
  prompt: string;
  aspectRatio?: string;
  inputImageUrls?: string[];
  duration?: string;
  resolution?: string;
  audio?: boolean;
  cameraFixed?: boolean;
}

export interface KieAssetGenerationResult {
  live: boolean;
  filePath: string;
  modelId: string;
  taskId: string | null;
  sourceUrl: string | null;
}

const KIE_MODELS: KieModelDefinition[] = [
  {
    id: "google/nano-banana-pro",
    name: "Nano Banana Pro",
    provider: "Google via KIE",
    kind: "image",
    endpointType: "jobs",
    supports: ["text-to-image"],
    description: "Premium commercial image generation for hero frames, web concepts, and polished marketing stills.",
    defaultAspectRatio: "16:9",
    docsUrl: "https://docs.kie.ai/",
    supportsDirectGeneration: true,
    inputHints: [
      "Strong for polished business visuals and staged commercial photography.",
      "Use for hero imagery, homepage banners, and lead-specific marketing art.",
    ],
    fields: [
      {key: "aspectRatio", label: "Aspect ratio", type: "select", helper: "Choose the layout shape for the generated frame.", options: ["1:1", "4:3", "3:2", "16:9", "9:16"]},
      {key: "prompt", label: "Prompt", type: "text", helper: "Describe the environment, subject, mood, and camera feel.", required: true},
    ],
  },
  {
    id: "gpt4o-image",
    name: "4o Image",
    provider: "OpenAI via KIE",
    kind: "image",
    endpointType: "gpt4o-image",
    supports: ["text-to-image", "image-edit"],
    description: "Flexible image generation and editing with variant support and prompt enhancement controls.",
    defaultAspectRatio: "1:1",
    docsUrl: "https://docs.kie.ai/4o-image-api/quickstart",
    supportsDirectGeneration: true,
    inputHints: [
      "Supports prompt-only image generation, masked edits, and multi-variant output.",
      "Best when you want controlled iteration or a square social/media asset.",
    ],
    fields: [
      {key: "aspectRatio", label: "Aspect ratio", type: "select", helper: "4o Image supports 1:1, 3:2, and 2:3 sizes.", options: ["1:1", "3:2", "2:3"]},
      {key: "variants", label: "Variants", type: "select", helper: "Choose 1, 2, or 4 outputs for ideation depth.", options: ["1", "2", "4"]},
      {key: "prompt", label: "Prompt", type: "text", helper: "Use a rich prompt or pair it with one or more reference images.", required: true},
    ],
  },
  {
    id: "flux-kontext-pro",
    name: "Flux Kontext Pro",
    provider: "Black Forest Labs via KIE",
    kind: "image",
    endpointType: "flux-kontext",
    supports: ["text-to-image", "image-edit"],
    description: "Fast high-quality scene generation with strong image-to-image editing support.",
    defaultAspectRatio: "16:9",
    docsUrl: "https://docs.kie.ai/flux-kontext-api/quickstart",
    supportsDirectGeneration: true,
    inputHints: [
      "Ideal for art direction passes where you want to preserve layout but alter the creative treatment.",
      "Can work from prompt-only or with an input image URL.",
    ],
    fields: [
      {key: "aspectRatio", label: "Aspect ratio", type: "select", helper: "Use cinematic or portrait ratios depending on the deliverable.", options: ["1:1", "4:3", "3:2", "16:9", "9:16"]},
      {key: "prompt", label: "Prompt", type: "text", helper: "Describe what should be generated or changed.", required: true},
    ],
  },
  {
    id: "bytedance/seedance-2",
    name: "Seedance 2.0",
    provider: "Bytedance via KIE",
    kind: "video",
    endpointType: "jobs",
    supports: ["text-to-video", "image-to-video"],
    description: "A balanced text and image to video model with camera controls and optional audio generation.",
    defaultAspectRatio: "16:9",
    docsUrl: "https://docs.kie.ai/32356532e0",
    supportsDirectGeneration: true,
    inputHints: [
      "Useful for concept clips when you want movement, mood, and optional audio in one pass.",
      "Works with prompt-only or reference-image-led animation.",
    ],
    fields: [
      {key: "duration", label: "Duration", type: "select", helper: "Shorter clips are faster and more reliable.", options: ["5", "8"]},
      {key: "resolution", label: "Resolution", type: "select", helper: "1080p looks best but costs more and takes longer.", options: ["720p", "1080p"]},
      {key: "audio", label: "Generate audio", type: "boolean", helper: "Enable only if the clip needs native ambient sound or speech."},
    ],
  },
  {
    id: "wan/2-6-text-to-video",
    name: "Wan 2.6 Text to Video",
    provider: "Wan via KIE",
    kind: "video",
    endpointType: "jobs",
    supports: ["text-to-video"],
    description: "Prompt-driven video generation for short, visually descriptive concept clips.",
    defaultAspectRatio: "16:9",
    docsUrl: "https://docs.kie.ai/market/wan/2-6-text-to-video",
    supportsDirectGeneration: true,
    inputHints: [
      "A good default for quick concept reels and motion references.",
      "Keep prompts tight and visual rather than narrative-heavy.",
    ],
    fields: [
      {key: "duration", label: "Duration", type: "select", helper: "Wan 2.6 works best with short clips.", options: ["5", "8"]},
      {key: "resolution", label: "Resolution", type: "select", helper: "Choose 720p for speed or 1080p for higher fidelity.", options: ["720p", "1080p"]},
    ],
  },
  {
    id: "wan/2-6-flash-image-to-video",
    name: "Wan 2.6 Flash Image to Video",
    provider: "Wan via KIE",
    kind: "video",
    endpointType: "jobs",
    supports: ["image-to-video"],
    description: "Fast image-to-video animation for turning a still concept frame into a polished teaser clip.",
    defaultAspectRatio: "16:9",
    docsUrl: "https://docs.kie.ai/market/wan/2-6-flash-image-to-video",
    supportsDirectGeneration: true,
    inputHints: [
      "Best when you already have a strong hero image and want fast motion.",
      "Supports optional audio and multi-shot generation.",
    ],
    fields: [
      {key: "duration", label: "Duration", type: "select", helper: "Default to 5 seconds for lead previews.", options: ["5", "8"]},
      {key: "resolution", label: "Resolution", type: "select", helper: "Higher resolution will take longer.", options: ["720p", "1080p"]},
      {key: "audio", label: "Generate audio", type: "boolean", helper: "Add native audio only when it helps the demo."},
    ],
  },
  {
    id: "kling/v2-1-master-image-to-video",
    name: "Kling 2.1 Master",
    provider: "Kling via KIE",
    kind: "video",
    endpointType: "jobs",
    supports: ["image-to-video"],
    description: "High-fidelity image-to-video generation with stronger cinematic motion and detail retention.",
    defaultAspectRatio: "16:9",
    docsUrl: "https://docs.kie.ai/market/kling/v2-1-master-image-to-video",
    supportsDirectGeneration: true,
    inputHints: [
      "Use when motion quality matters more than speed.",
      "Great for premium reveal clips from a single strong frame.",
    ],
    fields: [
      {key: "duration", label: "Duration", type: "select", helper: "Keep clips short and focused for better consistency.", options: ["5", "8"]},
      {key: "resolution", label: "Resolution", type: "select", helper: "Choose 1080p for premium client previews.", options: ["720p", "1080p"]},
    ],
  },
  {
    id: "sora2/sora-2-image-to-video",
    name: "Sora 2 Image to Video",
    provider: "OpenAI via KIE",
    kind: "video",
    endpointType: "jobs",
    supports: ["image-to-video"],
    description: "Higher-end motion generation from a reference image, suitable for richer cinematic concept videos.",
    defaultAspectRatio: "16:9",
    docsUrl: "https://docs.kie.ai/market/sora2/sora-2-image-to-video",
    supportsDirectGeneration: true,
    inputHints: [
      "Use when the still frame quality is already strong and the clip needs cinematic movement.",
      "Supports deeper character/motion extensions in the broader Sora 2 family.",
    ],
    fields: [
      {key: "duration", label: "Duration", type: "select", helper: "Keep the motion concise for stronger coherence.", options: ["5", "8"]},
      {key: "resolution", label: "Resolution", type: "select", helper: "Higher resolution improves detail but costs more.", options: ["720p", "1080p"]},
    ],
  },
  {
    id: "google/veo3",
    name: "Veo 3",
    provider: "Google via KIE",
    kind: "video",
    endpointType: "jobs",
    supports: ["text-to-video", "image-to-video"],
    description: "Google’s premium cinematic video family surfaced in KIE’s docs with high-quality but more specialized workflows.",
    defaultAspectRatio: "16:9",
    docsUrl: "https://docs.kie.ai/veo3-api",
    supportsDirectGeneration: false,
    inputHints: [
      "The docs expose richer Veo-specific flows than the generic studio endpoint currently supports.",
      "Use this entry for docs, capabilities, and prompt guidance before enabling a dedicated runtime.",
    ],
    fields: [
      {key: "duration", label: "Duration", type: "select", helper: "Direct Veo clips are typically limited to short durations.", options: ["8"]},
      {key: "resolution", label: "Resolution", type: "select", helper: "Veo supports premium HD exports.", options: ["1080p"]},
    ],
  },
  {
    id: "google/veo3_fast",
    name: "Veo 3 Fast",
    provider: "Google via KIE",
    kind: "video",
    endpointType: "jobs",
    supports: ["text-to-video", "image-to-video"],
    description: "Faster Veo option for shorter turnaround when concept speed matters more than maximum fidelity.",
    defaultAspectRatio: "16:9",
    docsUrl: "https://docs.kie.ai/veo3-api",
    supportsDirectGeneration: false,
    inputHints: [
      "Use this entry to compare prompt strategy and capability notes with the standard Veo model.",
      "Generation is intentionally disabled here until a dedicated Veo route is added.",
    ],
    fields: [
      {key: "duration", label: "Duration", type: "select", helper: "Fast mode focuses on short clips.", options: ["8"]},
      {key: "resolution", label: "Resolution", type: "select", helper: "Veo fast still targets HD output.", options: ["1080p"]},
    ],
  },
];

const DEFAULT_VIDEO_DURATION = "5";
const DEFAULT_VIDEO_RESOLUTION = "720p";

function getKieModel(modelId: string) {
  return KIE_MODELS.find((model) => model.id === modelId);
}

export function listKieModels() {
  return KIE_MODELS;
}

function mapAspectRatioTo4oSize(aspectRatio: string | undefined) {
  switch (aspectRatio) {
    case "3:2":
    case "4:3":
    case "16:9":
      return "3:2";
    case "9:16":
      return "2:3";
    default:
      return "1:1";
  }
}

function extractResultUrls(data: KieTaskResponse) {
  return [
    ...(data.data?.resultUrls ?? []),
    ...(data.data?.response?.resultUrls ?? []),
    ...((data.data?.works ?? []).flatMap((work) => (work.resource?.resource ? [work.resource.resource] : []))),
  ].filter(Boolean);
}

async function kieRequest<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  const data = (await response.json()) as T & {msg?: string; error?: string};
  if (!response.ok) {
    throw new Error(data.msg ?? data.error ?? "KIE request failed.");
  }
  return data;
}

async function submitJobsTask(model: KieModelDefinition, input: Record<string, unknown>) {
  const data = await kieRequest<KieTaskResponse>(`${kie.baseUrl}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${kie.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model.id,
      input,
    }),
  });

  return data.data?.taskId ?? null;
}

async function submit4oImageTask(request: KieImageGenerationRequest) {
  const data = await kieRequest<KieTaskResponse>(`${kie.baseUrl}/api/v1/gpt4o-image/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${kie.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: request.prompt,
      filesUrl: request.inputImageUrls,
      maskUrl: request.maskUrl ?? undefined,
      size: mapAspectRatioTo4oSize(request.aspectRatio),
      nVariants: request.variants ?? 1,
      isEnhance: false,
      enableFallback: true,
    }),
  });

  return data.data?.taskId ?? null;
}

async function submitFluxKontextTask(request: KieImageGenerationRequest) {
  const data = await kieRequest<KieTaskResponse>(`${kie.baseUrl}/api/v1/flux/kontext/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${kie.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: request.prompt,
      inputImage: request.inputImageUrls?.[0],
      aspectRatio: request.aspectRatio ?? "16:9",
      model: request.modelId,
      enableTranslation: true,
    }),
  });

  return data.data?.taskId ?? null;
}

async function pollTask(taskId: string, model: KieModelDefinition) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const url =
      model.endpointType === "gpt4o-image"
        ? `${kie.baseUrl}/api/v1/gpt4o-image/record-info?taskId=${encodeURIComponent(taskId)}`
        : model.endpointType === "flux-kontext"
          ? `${kie.baseUrl}/api/v1/flux/kontext/record-info?taskId=${encodeURIComponent(taskId)}`
          : `${kie.baseUrl}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`;

    const response = await kieRequest<KieTaskResponse>(url, {
      headers: {
        Authorization: `Bearer ${kie.apiKey}`,
      },
    });

    const resultUrls = extractResultUrls(response);
    if (resultUrls[0]) {
      return resultUrls[0];
    }

    if (response.successFlag === 2) {
      throw new Error(response.errorMessage ?? response.msg ?? `KIE task ${taskId} failed.`);
    }

    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  throw new Error(`Timed out waiting for KIE task ${taskId}.`);
}

async function downloadAsset(url: string, targetFile: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(60_000)});
      if (!response.ok) {
        throw new Error(`Asset download failed for ${url} (HTTP ${response.status})`);
      }
      await writeBinary(targetFile, await response.arrayBuffer());
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2_000 * (attempt + 1)));
    }
  }
}

async function createSvgPlaceholder(filePath: string, title: string, subtitle: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#07131f"/>
      <stop offset="50%" stop-color="#14324c"/>
      <stop offset="100%" stop-color="#f7b267"/>
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#bg)"/>
  <circle cx="1460" cy="220" r="220" fill="rgba(255,255,255,0.08)"/>
  <circle cx="260" cy="860" r="180" fill="rgba(255,255,255,0.08)"/>
  <text x="120" y="250" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="54" font-weight="700">${escapeHtml(title)}</text>
  <text x="120" y="340" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="92" font-weight="700">${escapeHtml(subtitle)}</text>
  <text x="120" y="460" fill="#d6e7f6" font-family="Arial, Helvetica, sans-serif" font-size="40">Free demo concept by ${escapeHtml(brand.businessName)}</text>
  </svg>`;
  await writeText(filePath, svg);
}

export async function generateKieImageAsset(filePath: string, request: KieImageGenerationRequest): Promise<KieAssetGenerationResult> {
  await fs.mkdir(path.dirname(filePath), {recursive: true});

  const model = getKieModel(request.modelId);
  if (!model || model.kind !== "image") {
    throw new Error(`Unsupported image model: ${request.modelId}`);
  }

  if (!kie.apiKey) {
    await createSvgPlaceholder(filePath, request.title ?? "Image preview", request.subtitle ?? "KIE not configured");
    return {live: false, filePath, modelId: model.id, taskId: null, sourceUrl: null};
  }

  if (!model.supportsDirectGeneration) {
    throw new Error(`${model.name} is documented in the studio, but not yet enabled for direct generation.`);
  }

  const taskId =
    model.endpointType === "gpt4o-image"
      ? await submit4oImageTask(request)
      : model.endpointType === "flux-kontext"
        ? await submitFluxKontextTask(request)
        : await submitJobsTask(model, {
            prompt: request.prompt,
            imageSize: request.aspectRatio === "9:16" ? "2160x3840" : "3840x2160",
            outputFormat: "jpeg",
          });

  if (!taskId) {
    await createSvgPlaceholder(filePath, request.title ?? "Image preview", request.subtitle ?? "Task unavailable");
    return {live: false, filePath, modelId: model.id, taskId: null, sourceUrl: null};
  }

  const assetUrl = await pollTask(taskId, model);
  await downloadAsset(assetUrl, filePath);
  return {live: true, filePath, modelId: model.id, taskId, sourceUrl: assetUrl};
}

export async function generateKieVideoAsset(filePath: string, request: KieVideoGenerationRequest): Promise<KieAssetGenerationResult> {
  await fs.mkdir(path.dirname(filePath), {recursive: true});

  const model = getKieModel(request.modelId);
  if (!model || model.kind !== "video") {
    throw new Error(`Unsupported video model: ${request.modelId}`);
  }

  if (!kie.apiKey) {
    throw new Error("KIE_API_KEY is missing.");
  }

  if (!model.supportsDirectGeneration) {
    throw new Error(`${model.name} is documented in the studio, but not yet enabled for direct generation.`);
  }

  const input: Record<string, unknown> = {
    prompt: request.prompt,
    duration: request.duration ?? DEFAULT_VIDEO_DURATION,
    resolution: request.resolution ?? DEFAULT_VIDEO_RESOLUTION,
  };

  if (request.inputImageUrls?.length) {
    input.image_urls = request.inputImageUrls;
  }

  if (typeof request.audio === "boolean") {
    input.audio = request.audio;
  }

  if (typeof request.cameraFixed === "boolean") {
    input.camera_fixed = request.cameraFixed;
  }

  const taskId = await submitJobsTask(model, input);
  if (!taskId) {
    throw new Error(`Unable to create video task for ${model.name}.`);
  }

  const assetUrl = await pollTask(taskId, model);
  await downloadAsset(assetUrl, filePath);
  return {live: true, filePath, modelId: model.id, taskId, sourceUrl: assetUrl};
}

export async function generateImageAsset(filePath: string, prompt: string, title: string, subtitle: string) {
  return generateKieImageAsset(filePath, {
    modelId: kie.model,
    prompt,
    title,
    subtitle,
    aspectRatio: "16:9",
  });
}
