import {useEffect, useMemo, useState} from "react";
import {AlertCircle, ArrowUpRight, Film, ImageIcon, Loader2, Sparkles, Wand2} from "lucide-react";
import {useQuery} from "@tanstack/react-query";

import {Button} from "@/components/ui/Button";
import {fetchKieModels, fetchLeadPipeline, generateKieImage, generateKieVideo} from "@/services/api";
import type {KieImageGenerationResponse, KieModelDefinition, KieVideoGenerationResponse} from "@/types/frontend";

type StudioMode = "image" | "video";

export function ImageGenPage() {
  const [mode, setMode] = useState<StudioMode>("image");
  const [selectedLead, setSelectedLead] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [inputImageUrl, setInputImageUrl] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [duration, setDuration] = useState("5");
  const [resolution, setResolution] = useState("720p");
  const [audio, setAudio] = useState(false);
  const [cameraFixed, setCameraFixed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageResult, setImageResult] = useState<KieImageGenerationResponse | null>(null);
  const [videoResult, setVideoResult] = useState<KieVideoGenerationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {data: pipelineData} = useQuery({
    queryKey: ["lead-pipeline"],
    queryFn: fetchLeadPipeline,
    staleTime: 60_000,
  });

  const {data: kieData} = useQuery({
    queryKey: ["kie-models"],
    queryFn: fetchKieModels,
    staleTime: 10 * 60_000,
  });

  const leads = pipelineData?.leads ?? [];
  const models = kieData?.models ?? [];
  const filteredModels = useMemo(
    () => models.filter((model) => model.kind === mode),
    [mode, models],
  );
  const selectedModel = filteredModels.find((model) => model.id === selectedModelId) ?? filteredModels[0] ?? null;

  useEffect(() => {
    if (filteredModels.length && !filteredModels.some((model) => model.id === selectedModelId)) {
      setSelectedModelId(filteredModels[0].id);
      setAspectRatio(filteredModels[0].defaultAspectRatio);
    }
  }, [filteredModels, selectedModelId]);

  useEffect(() => {
    if (selectedModel) {
      setAspectRatio(selectedModel.defaultAspectRatio);
    }
  }, [selectedModel?.id]);

  function fillFromLead(clientId: string) {
    const lead = leads.find((item) => item.clientId === clientId);
    if (!lead) return;
    setTitle(lead.businessName);
    setSubtitle(`${lead.businessType} · ${lead.area}`);
    setPrompt(
      mode === "image"
        ? `Premium homepage hero image for ${lead.businessName}, a ${lead.businessType.toLowerCase()} in ${lead.area}. Cinematic local-business photography, clean, trustworthy, modern, commercially strong.`
        : `A polished promotional video for ${lead.businessName}, a ${lead.businessType.toLowerCase()} in ${lead.area}. Show strong exterior/interior moments, modern service presentation, and a confident premium finish.`,
    );
    if (lead.imageHero) {
      setInputImageUrl(lead.imageHero.startsWith("/") ? lead.imageHero : `/${lead.imageHero.split("/output/").pop() ?? ""}`);
    }
  }

  async function handleGenerate() {
    if (!prompt.trim() || !selectedModel) return;
    setLoading(true);
    setError(null);
    setImageResult(null);
    setVideoResult(null);

    try {
      if (selectedModel.kind === "image") {
        const result = await generateKieImage({
          prompt: prompt.trim(),
          title: title.trim(),
          subtitle: subtitle.trim(),
          clientId: selectedLead || undefined,
          modelId: selectedModel.id,
          aspectRatio,
          inputImageUrls: inputImageUrl.trim() ? [inputImageUrl.trim()] : undefined,
          variants: selectedModel.id === "gpt4o-image" ? 1 : undefined,
        });
        setImageResult(result);
      } else {
        const result = await generateKieVideo({
          prompt: prompt.trim(),
          clientId: selectedLead || undefined,
          modelId: selectedModel.id,
          inputImageUrls: inputImageUrl.trim() ? [inputImageUrl.trim()] : undefined,
          duration,
          resolution,
          audio,
          cameraFixed,
        });
        setVideoResult(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1520px] px-6 py-8 md:px-10 md:py-10">
      <div className="grid gap-8 xl:grid-cols-[0.9fr_0.85fr_1.1fr]">
        <section className="space-y-6">
          <header className="space-y-3">
            <p className="section-kicker">AI creative</p>
            <div className="space-y-2">
              <h1 className="display-title max-w-[10ch]">KIE media studio</h1>
              <p className="max-w-[52ch] text-sm leading-7 text-[var(--color-text-muted)]">
                Choose the model family, read its capability envelope, then generate the exact still or motion asset
                you need for a live lead.
              </p>
            </div>
          </header>

          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)]/78 p-2">
            <div className="grid grid-cols-2 gap-2">
              {([
                {id: "image", label: "Image", icon: ImageIcon},
                {id: "video", label: "Video", icon: Film},
              ] as const).map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMode(item.id)}
                    className={[
                      "flex items-center gap-3 rounded-[var(--radius-xl)] px-4 py-3 transition-all duration-[var(--duration-base)]",
                      mode === item.id
                        ? "bg-[var(--color-surface-2)] text-[var(--color-text)] shadow-[var(--shadow-sm)]"
                        : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]/70 hover:text-[var(--color-text)]",
                    ].join(" ")}
                  >
                    <span className="inline-flex size-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]">
                      <Icon size={15} />
                    </span>
                    <div className="text-left">
                      <p className="section-kicker !text-[9px]">{item.id === "image" ? "still output" : "motion output"}</p>
                      <p className="text-sm font-medium">{item.label} studio</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <section className="space-y-4 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)]/78 p-6">
            <div className="space-y-2">
              <label className="section-kicker">Lead context</label>
              <select
                value={selectedLead}
                onChange={(event) => {
                  setSelectedLead(event.target.value);
                  fillFromLead(event.target.value);
                }}
                className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)]/60"
              >
                <option value="">Select a lead</option>
                {leads.map((lead) => (
                  <option key={lead.clientId} value={lead.clientId}>{lead.businessName}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="section-kicker">Model family</label>
              <select
                value={selectedModel?.id ?? ""}
                onChange={(event) => setSelectedModelId(event.target.value)}
                className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)]/60"
              >
                {filteredModels.map((model) => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="section-kicker">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Business name or asset title"
                  className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)]/60"
                />
              </div>
              <div className="space-y-2">
                <label className="section-kicker">Subtitle</label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(event) => setSubtitle(event.target.value)}
                  placeholder="Type · area · offer"
                  className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)]/60"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="section-kicker">Prompt</label>
              <textarea
                rows={6}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={mode === "image" ? "Describe the still image in detail..." : "Describe the motion, subject, pacing, and camera feel..."}
                className="w-full resize-none rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm leading-7 text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)]/60"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="section-kicker">Aspect ratio</label>
                <select
                  value={aspectRatio}
                  onChange={(event) => setAspectRatio(event.target.value)}
                  className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)]/60"
                >
                  {["1:1", "4:3", "3:2", "16:9", "9:16"].map((ratio) => (
                    <option key={ratio} value={ratio}>{ratio}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="section-kicker">{mode === "image" ? "Reference image URL" : "Seed frame URL"}</label>
                <input
                  type="url"
                  value={inputImageUrl}
                  onChange={(event) => setInputImageUrl(event.target.value)}
                  placeholder="Optional hosted image URL"
                  className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)]/60"
                />
              </div>
            </div>

            {mode === "video" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="section-kicker">Duration</label>
                  <select
                    value={duration}
                    onChange={(event) => setDuration(event.target.value)}
                    className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)]/60"
                  >
                    <option value="5">5 seconds</option>
                    <option value="8">8 seconds</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="section-kicker">Resolution</label>
                  <select
                    value={resolution}
                    onChange={(event) => setResolution(event.target.value)}
                    className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)]/60"
                  >
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                  </select>
                </div>
                <label className="flex items-center gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)]">
                  <input type="checkbox" checked={audio} onChange={(event) => setAudio(event.target.checked)} />
                  <span>Generate native audio</span>
                </label>
                <label className="flex items-center gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)]">
                  <input type="checkbox" checked={cameraFixed} onChange={(event) => setCameraFixed(event.target.checked)} />
                  <span>Prefer fixed camera</span>
                </label>
              </div>
            ) : null}

            <Button
              variant="glow"
              onClick={handleGenerate}
              disabled={loading || !prompt.trim() || !selectedModel}
              className="w-full justify-center"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
              <span>
                {loading
                  ? `Generating with ${selectedModel?.name ?? "KIE"}...`
                  : selectedModel?.supportsDirectGeneration
                    ? `Generate with ${selectedModel?.name ?? "selected model"}`
                    : `Open ${selectedModel?.name ?? "model"} docs`}
              </span>
            </Button>

            {error ? (
              <div className="flex items-start gap-3 rounded-[var(--radius-xl)] border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
          </section>
        </section>

        <section className="space-y-6">
          <article className="space-y-4 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)]/78 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker">Model intelligence</p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--color-text)]">{selectedModel?.name ?? "Choose a model"}</h2>
                <p className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">
                  {selectedModel?.description ?? "Pick a model to inspect capabilities, docs, and runtime support."}
                </p>
              </div>
              {selectedModel?.docsUrl ? (
                <a
                  href={selectedModel.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 text-sm text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                >
                  <ArrowUpRight size={15} />
                  <span>Docs</span>
                </a>
              ) : null}
            </div>

            {selectedModel ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Metric label="Provider" value={selectedModel.provider} />
                  <Metric label="Direct runtime" value={selectedModel.supportsDirectGeneration ? "Enabled" : "Docs only"} />
                  <Metric label="Default ratio" value={selectedModel.defaultAspectRatio} />
                  <Metric label="Modes" value={selectedModel.supports.join(", ")} />
                </div>

                <div className="space-y-3">
                  <p className="section-kicker">Operational notes</p>
                  <div className="space-y-2 text-sm leading-7 text-[var(--color-text-muted)]">
                    {selectedModel.inputHints.map((hint) => (
                      <div key={hint} className="flex gap-2">
                        <Sparkles size={15} className="mt-1 shrink-0 text-[var(--color-accent)]" />
                        <span>{hint}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="section-kicker">Exposed controls</p>
                  <div className="space-y-3">
                    {selectedModel.fields.map((field) => (
                      <div key={field.key} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-[var(--color-text)]">{field.label}</p>
                          <span className="rounded-full bg-[var(--color-surface-3)] px-3 py-1 text-[11px] text-[var(--color-text-muted)]">{field.type}</span>
                        </div>
                        <p className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">{field.helper}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </article>
        </section>

        <section className="space-y-6">
          <article className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)]/78">
            <div className="border-b border-[var(--color-border)] px-6 py-5">
              <p className="section-kicker">Output preview</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--color-text)]">
                {mode === "image" ? "Generated still" : "Generated motion"}
              </h2>
            </div>

            {mode === "image" && imageResult ? (
              <div className="space-y-5 p-6">
                <img src={imageResult.imageUrl} alt={imageResult.title || "Generated creative"} className="aspect-video w-full rounded-[var(--radius-xl)] object-cover" />
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-[var(--color-text)]">{imageResult.title || selectedLead || "Generated image"}</h3>
                  <p className="text-sm text-[var(--color-text-muted)]">{imageResult.subtitle}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={imageResult.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 text-sm text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                  >
                    <ArrowUpRight size={15} />
                    <span>Open asset</span>
                  </a>
                  {imageResult.sourceUrl ? (
                    <a
                      href={imageResult.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 text-sm text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                    >
                      <ArrowUpRight size={15} />
                      <span>KIE result URL</span>
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            {mode === "video" && videoResult ? (
              <div className="space-y-5 p-6">
                <video src={videoResult.videoUrl} controls className="aspect-video w-full rounded-[var(--radius-xl)] bg-black object-cover" />
                <div className="flex flex-wrap gap-3">
                  <a
                    href={videoResult.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 text-sm text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                  >
                    <ArrowUpRight size={15} />
                    <span>Open render</span>
                  </a>
                  {videoResult.sourceUrl ? (
                    <a
                      href={videoResult.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 text-sm text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                    >
                      <ArrowUpRight size={15} />
                      <span>KIE result URL</span>
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            {((mode === "image" && !imageResult) || (mode === "video" && !videoResult)) ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center px-8 text-center">
                {mode === "image" ? <ImageIcon size={42} className="text-[var(--color-text-muted)]/45" /> : <Film size={42} className="text-[var(--color-text-muted)]/45" />}
                <p className="mt-5 text-sm leading-7 text-[var(--color-text-muted)]">
                  The generated asset appears here once the selected KIE model finishes its job.
                </p>
              </div>
            ) : null}
          </article>
        </section>
      </div>
    </div>
  );
}

function Metric({label, value}: {label: string; value: string}) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
      <p className="section-kicker">{label}</p>
      <p className="mt-2 text-sm font-medium text-[var(--color-text)]">{value}</p>
    </div>
  );
}
