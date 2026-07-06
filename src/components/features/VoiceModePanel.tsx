import { useEffect, useRef, useState } from "react";
import { Activity, Mic2, PauseCircle, Radio, Send, ShieldCheck, Volume2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  createOpenAiRealtimeAnswer,
  fetchOperatorStatus,
  fetchOpenAiVoiceStatus,
  runOperatorCommand,
  runOpenAiVoiceTool,
  transcribeOpenAiVoiceAudio,
} from "@/services/api";
import type { OpenAiVoiceStatusResponse, OperatorStatusResponse } from "@/types/frontend";

type VoiceConnectionState = "idle" | "connecting" | "listening" | "fallback-listening" | "speaking" | "error";
type MicrophonePermissionState = PermissionState | "checking" | "unsupported" | "unknown";
type VoiceToolName =
  | "get_dashboard_context"
  | "get_visible_app_snapshot"
  | "navigate"
  | "run_acquisition"
  | "ask_dashboard_ai"
  | "open_highest_priority_lead";

interface VoiceModePanelProps {
  open: boolean;
  onClose: () => void;
}

interface RealtimeEvent {
  type?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  delta?: string;
  transcript?: string;
  error?: {
    message?: string;
  };
  item?: {
    type?: string;
    name?: string;
    call_id?: string;
    arguments?: string;
    content?: Array<{
      text?: string;
      transcript?: string;
    }>;
  };
}

interface VoiceLogItem {
  id: string;
  label: string;
  detail: string;
  tone: "neutral" | "live" | "warning";
}

const voiceToolNames = new Set<VoiceToolName>([
  "get_dashboard_context",
  "get_visible_app_snapshot",
  "navigate",
  "run_acquisition",
  "ask_dashboard_ai",
  "open_highest_priority_lead",
]);

function nowLabel() {
  return new Date().toLocaleTimeString("en-GB", {hour: "2-digit", minute: "2-digit", second: "2-digit"});
}

function supportsRealtimeVoice() {
  return typeof window !== "undefined"
    && "RTCPeerConnection" in window
    && Boolean(navigator.mediaDevices?.getUserMedia);
}

function supportsCommandVoice() {
  return typeof window !== "undefined"
    && "MediaRecorder" in window
    && Boolean(navigator.mediaDevices?.getUserMedia);
}

function getRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read recorded audio."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] ?? "" : result);
    };
    reader.readAsDataURL(blob);
  });
}

function describeMicrophoneAccessError(error: unknown) {
  const blockedMessage = [
    "Microphone permission is blocked.",
    "Open the browser site controls for 127.0.0.1 and set Microphone to Allow.",
    "If macOS blocked it, enable this browser in System Settings > Privacy & Security > Microphone, then reload the dashboard.",
  ].join(" ");

  if (error instanceof DOMException) {
    if (["NotAllowedError", "PermissionDeniedError"].includes(error.name)) return blockedMessage;
    if (error.name === "SecurityError") {
      return "Microphone access is blocked by browser security. Use http://127.0.0.1:5173 or localhost, allow microphone access, then reload.";
    }
    if (error.name === "NotFoundError") return "No microphone was found. Connect or enable a microphone, then try voice again.";
    if (error.name === "NotReadableError") return "The microphone is already in use by another app. Close the other app and try again.";
    if (error.name === "OverconstrainedError") return "The selected microphone does not support the requested audio settings. Try the system default microphone.";
  }

  const message = error instanceof Error ? error.message : "Microphone access failed.";
  return /permission denied|not allowed/i.test(message) ? blockedMessage : message;
}

function microphonePermissionLabel(state: MicrophonePermissionState) {
  if (state === "granted") return "Allowed";
  if (state === "prompt") return "Ask on start";
  if (state === "denied") return "Blocked";
  if (state === "checking") return "Checking";
  if (state === "unsupported") return "Browser unknown";
  return "Unknown";
}

export function VoiceModePanel({open, onClose}: VoiceModePanelProps) {
  const [voiceStatus, setVoiceStatus] = useState<OpenAiVoiceStatusResponse | null>(null);
  const [operatorStatus, setOperatorStatus] = useState<OperatorStatusResponse | null>(null);
  const [state, setState] = useState<VoiceConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [microphonePermission, setMicrophonePermission] = useState<MicrophonePermissionState>("unknown");
  const [command, setCommand] = useState("");
  const [logs, setLogs] = useState<VoiceLogItem[]>([
    {
      id: "boot",
      label: "Voice cockpit ready",
      detail: "Open the channel, speak naturally, and JARVIS will answer through the dashboard.",
      tone: "neutral",
    },
  ]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingAbortRef = useRef(false);
  const handledToolCallsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchOpenAiVoiceStatus()
      .then((status) => {
        if (!cancelled) setVoiceStatus(status);
      })
      .catch((statusError: unknown) => {
        if (!cancelled) {
          setError(statusError instanceof Error ? statusError.message : "Voice status could not be checked.");
        }
      });
    fetchOperatorStatus()
      .then((status) => {
        if (!cancelled) setOperatorStatus(status);
      })
      .catch(() => {
        if (!cancelled) {
          pushLog({
            label: "Operator runtime unavailable",
            detail: "Voice can still open, but local tool orchestration did not respond.",
            tone: "warning",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!navigator.permissions?.query) {
      setMicrophonePermission("unsupported");
      return;
    }

    let disposed = false;
    let permissionStatus: PermissionStatus | null = null;
    setMicrophonePermission("checking");
    navigator.permissions.query({name: "microphone" as PermissionName})
      .then((status) => {
        if (disposed) return;
        permissionStatus = status;
        setMicrophonePermission(status.state);
        status.onchange = () => setMicrophonePermission(status.state);
      })
      .catch(() => {
        if (!disposed) setMicrophonePermission("unknown");
      });

    return () => {
      disposed = true;
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, [open]);

  const pushLog = (item: Omit<VoiceLogItem, "id">) => {
    setLogs((current) => [
      {id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, ...item},
      ...current,
    ].slice(0, 8));
  };

  const refreshMicrophonePermission = async (announce = false) => {
    if (!navigator.permissions?.query) {
      setMicrophonePermission("unsupported");
      if (announce) {
        pushLog({
          label: "Mic permission check",
          detail: "This browser does not expose microphone permission status. Try Backup voice to request access.",
          tone: "neutral",
        });
      }
      return "unsupported" as MicrophonePermissionState;
    }

    setMicrophonePermission("checking");
    try {
      const status = await navigator.permissions.query({name: "microphone" as PermissionName});
      setMicrophonePermission(status.state);
      if (announce) {
        pushLog({
          label: "Mic permission check",
          detail: `Browser reports microphone permission: ${microphonePermissionLabel(status.state)}.`,
          tone: status.state === "denied" ? "warning" : "neutral",
        });
      }
      return status.state;
    } catch {
      setMicrophonePermission("unknown");
      return "unknown" as MicrophonePermissionState;
    }
  };

  const requestMicrophoneStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      setMicrophonePermission("granted");
      return stream;
    } catch (streamError) {
      void refreshMicrophonePermission();
      throw new Error(describeMicrophoneAccessError(streamError));
    }
  };

  const stopVoice = (announce = true) => {
    const hadSession = Boolean(peerRef.current || localStreamRef.current || dataChannelRef.current || mediaRecorderRef.current);
    recordingAbortRef.current = true;
    if (recordingTimerRef.current) {
      window.clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    dataChannelRef.current?.close();
    peerRef.current?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    dataChannelRef.current = null;
    peerRef.current = null;
    localStreamRef.current = null;
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    setState("idle");
    if (announce && hadSession) {
      pushLog({label: "Voice channel closed", detail: `${nowLabel()} · microphone released`, tone: "neutral"});
    }
  };

  useEffect(() => {
    if (!open) stopVoice(false);
    return () => {
      stopVoice(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const sendToolOutput = (callId: string, output: unknown) => {
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") return;
    channel.send(JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(output),
      },
    }));
    channel.send(JSON.stringify({type: "response.create"}));
  };

  const parseToolArgs = (rawArgs: string | undefined): Record<string, unknown> => {
    if (!rawArgs?.trim()) return {};
    try {
      const parsed = JSON.parse(rawArgs) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  };

  const handleToolCall = async (event: RealtimeEvent) => {
    const name = event.name ?? event.item?.name;
    const callId = event.call_id ?? event.item?.call_id;
    const rawArgs = event.arguments ?? event.item?.arguments;
    if (!name || !voiceToolNames.has(name as VoiceToolName) || !callId) return false;
    if (!event.type?.includes("function_call") && event.item?.type !== "function_call") return false;

    const fingerprint = `${callId}:${rawArgs ?? ""}`;
    if (handledToolCallsRef.current.has(fingerprint)) return true;
    handledToolCallsRef.current.add(fingerprint);

    pushLog({label: "Tool requested", detail: `${name} · ${nowLabel()}`, tone: "live"});
    if (name === "get_visible_app_snapshot") {
      const snapshot = {
        ok: true,
        route: window.location.hash.replace(/^#/, "") || "/",
        title: document.title,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        visibleText: document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 7000),
      };
      pushLog({label: "App snapshot read", detail: "JARVIS can now inspect the current visible screen.", tone: "live"});
      sendToolOutput(callId, snapshot);
      return true;
    }

    try {
      const result = await runOpenAiVoiceTool({
        name: name as VoiceToolName,
        arguments: parseToolArgs(rawArgs),
      });
      if ((result.action === "navigate" || result.action === "refresh") && result.route) {
        window.location.hash = result.route;
      }
      pushLog({
        label: result.requiresApproval ? "Approval needed" : "Tool completed",
        detail: result.message ?? `${name} returned dashboard data.`,
        tone: result.requiresApproval ? "warning" : "live",
      });
      sendToolOutput(callId, result);
    } catch (toolError) {
      const message = toolError instanceof Error ? toolError.message : "Dashboard tool failed.";
      pushLog({label: "Tool failed", detail: message, tone: "warning"});
      sendToolOutput(callId, {ok: false, error: message});
    }
    return true;
  };

  const handleRealtimeEvent = async (raw: string) => {
    try {
      const event = JSON.parse(raw) as RealtimeEvent;
      if (await handleToolCall(event)) return;
      if (event.type === "error") {
        const message = event.error?.message ?? "Realtime voice event failed.";
        setError(message);
        setState("error");
        pushLog({label: "Realtime error", detail: message, tone: "warning"});
        return;
      }
      if (event.type === "response.audio_transcript.done" && event.transcript) {
        pushLog({label: "JARVIS replied", detail: event.transcript, tone: "live"});
        return;
      }
      if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) {
        pushLog({label: "Heard command", detail: event.transcript, tone: "neutral"});
        return;
      }
      const itemText = event.item?.content?.map((part) => part.text ?? part.transcript ?? "").join(" ").trim();
      if (itemText) {
        pushLog({label: "Voice event", detail: itemText, tone: "neutral"});
      }
    } catch {
      pushLog({label: "Voice event", detail: raw.slice(0, 180), tone: "neutral"});
    }
  };

  const getVisibleDashboardContext = () => {
    return [
      `Current route: ${window.location.hash.replace(/^#/, "") || "/"}`,
      `Page title: ${document.title}`,
      `Visible dashboard text: ${document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 5000)}`,
    ].join("\n");
  };

  const speakFallbackReply = (reply: string) => {
    if (!("speechSynthesis" in window)) {
      setState("idle");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(reply.slice(0, 1100));
    utterance.lang = "en-GB";
    utterance.rate = 0.94;
    utterance.pitch = 0.9;
    utterance.onend = () => setState("idle");
    utterance.onerror = () => setState("idle");
    setState("speaking");
    window.speechSynthesis.speak(utterance);
  };

  const runFallbackCommand = async (text: string, source: "voice" | "text" = "voice") => {
    const cleanText = text.trim();
    if (!cleanText) return;
    setError(null);
    setState("connecting");
    pushLog({label: "Heard command", detail: cleanText, tone: "neutral"});
    try {
      const response = await runOperatorCommand({
        message: cleanText,
        source,
        route: window.location.hash.replace(/^#/, "") || "/",
        visibleText: getVisibleDashboardContext(),
      });
      response.session.events.slice(-5).forEach((event) => {
        pushLog({
          label: event.label,
          detail: event.detail,
          tone: event.tone === "danger" ? "warning" : event.tone,
        });
      });
      response.actions.forEach((action) => {
        if ((action.type === "navigate" || action.type === "open_record") && action.route) {
          window.location.hash = action.route;
        }
        if (action.type === "approval") {
          pushLog({
            label: "Approval queued",
            detail: `${action.label}. Review it before any spend or external action runs.`,
            tone: "warning",
          });
        }
      });
      pushLog({label: "JARVIS replied", detail: response.reply, tone: "live"});
      speakFallbackReply(response.reply);
    } catch (fallbackError) {
      const message = fallbackError instanceof Error ? fallbackError.message : "Operator command mode failed.";
      setError(message);
      setState("error");
      pushLog({label: "Operator voice failed", detail: message, tone: "warning"});
    }
  };

  const startFallbackVoice = async () => {
    if (!supportsCommandVoice()) {
      setError("This browser cannot record microphone audio for backup voice mode.");
      setState("error");
      return;
    }

    stopVoice(false);
    setError(null);
    setState("fallback-listening");

    try {
      const stream = await requestMicrophoneStream();
      const mimeType = getRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? {mimeType} : undefined);
      localStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      recordingAbortRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        recordingAbortRef.current = true;
        setError("Microphone recorder failed before it could send audio.");
        setState("error");
      };
      recorder.onstop = () => {
        if (recordingTimerRef.current) {
          window.clearTimeout(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        const chunks = [...recordingChunksRef.current];
        recordingChunksRef.current = [];
        mediaRecorderRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        if (localStreamRef.current === stream) localStreamRef.current = null;
        if (recordingAbortRef.current) return;

        void (async () => {
          try {
            setState("connecting");
            const audioBlob = new Blob(chunks, {type: recorder.mimeType || "audio/webm"});
            const audioBase64 = await blobToBase64(audioBlob);
            const transcription = await transcribeOpenAiVoiceAudio({
              audioBase64,
              mimeType: audioBlob.type || "audio/webm",
            });
            pushLog({
              label: "Transcribed command",
              detail: `${transcription.text} · ${transcription.model}`,
              tone: "live",
            });
            await runFallbackCommand(transcription.text);
          } catch (recordingError) {
            const message = recordingError instanceof Error ? recordingError.message : "Voice transcription failed.";
            setError(message);
            setState("error");
            pushLog({label: "Voice transcription failed", detail: message, tone: "warning"});
          }
        })();
      };

      recorder.start();
      recordingTimerRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      }, 8_000);
      pushLog({
        label: "Recorder online",
        detail: "Speak now. It will auto-send after 8 seconds, or press Stop and send.",
        tone: "live",
      });
    } catch (event) {
      const message = event instanceof Error ? event.message : "Microphone access failed.";
      setError(message);
      setState("error");
      pushLog({label: "Recorder failed", detail: message, tone: "warning"});
    }
  };

  const stopFallbackRecording = () => {
    if (recordingTimerRef.current) {
      window.clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    recordingAbortRef.current = false;
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      return;
    }
    stopVoice();
  };

  const startVoice = async () => {
    if (!voiceStatus?.configured) {
      setError(`OpenAI voice is not configured. Add ${voiceStatus?.missingEnv.join(", ") || "OPENAI_API_KEY"} to .env.local.`);
      return;
    }
    if (!supportsRealtimeVoice()) {
      setError("This browser cannot open a WebRTC microphone session.");
      return;
    }

    setError(null);
    setState("connecting");
    try {
      const localStream = await requestMicrophoneStream();
      const peer = new RTCPeerConnection();
      localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
      peer.ontrack = (event) => {
        if (audioRef.current && event.streams[0]) {
          audioRef.current.srcObject = event.streams[0];
        }
      };
      const dataChannel = peer.createDataChannel("oai-events");
      dataChannel.onopen = () => {
        setState("listening");
        pushLog({label: "Realtime channel live", detail: `${voiceStatus.model} · ${voiceStatus.voice} voice`, tone: "live"});
      };
      dataChannel.onmessage = (event) => {
        void handleRealtimeEvent(String(event.data));
      };
      dataChannel.onerror = () => {
        setState("error");
        setError("Realtime data channel reported an error.");
      };

      localStreamRef.current = localStream;
      peerRef.current = peer;
      dataChannelRef.current = dataChannel;

      const offer = await peer.createOffer({offerToReceiveAudio: true});
      await peer.setLocalDescription(offer);
      const answerSdp = await createOpenAiRealtimeAnswer(offer.sdp ?? "");
      await peer.setRemoteDescription({type: "answer", sdp: answerSdp});
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : "Voice mode could not start.";
      stopVoice(false);
      if (/model .*does not exist|not have access|realtime/i.test(message)) {
        setError("OpenAI Realtime is not enabled for this API key yet, so I switched to backup voice command mode.");
        pushLog({label: "Realtime unavailable", detail: message, tone: "warning"});
        await startFallbackVoice();
        return;
      }
      setState("error");
      setError(message);
    }
  };

  const sendTextCommand = async () => {
    const text = command.trim();
    if (!text) return;
    const channel = dataChannelRef.current;
    if (!channel || channel.readyState !== "open") {
      setCommand("");
      await runFallbackCommand(text, "text");
      return;
    }
    channel.send(JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{type: "input_text", text}],
      },
    }));
    channel.send(JSON.stringify({type: "response.create"}));
    pushLog({label: "Typed command sent", detail: text, tone: "neutral"});
    setCommand("");
  };

  const isLive = state === "listening";
  const isBusy = state === "connecting" || state === "fallback-listening" || state === "speaking";
  const canStart = voiceStatus?.configured && supportsRealtimeVoice() && !isBusy;
  const canStartFallback = voiceStatus?.configured && supportsCommandVoice() && !isBusy;

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="JARVIS Voice"
      title="Voice command mode"
      description="A live OpenAI Realtime voice channel with dashboard context, safe internal tools, and approval routing for anything sensitive."
      size="wide"
    >
      <div className="voice-mode-grid">
        <section className="voice-orb-panel">
          <audio ref={audioRef} autoPlay />
          <div className="voice-orb" data-state={isLive ? "live" : state}>
            <Mic2 size={34} />
            <span>
              {isLive || state === "fallback-listening"
                ? "Listening"
                : state === "speaking"
                  ? "Speaking"
                  : state === "connecting"
                    ? "Connecting"
                    : "Standby"}
            </span>
          </div>
          <div className="voice-stack">
            <div>
              <span>Model</span>
              <strong>{voiceStatus?.model ?? "Checking"}</strong>
            </div>
            <div>
              <span>Voice</span>
              <strong>{voiceStatus?.voice ?? "Checking"}</strong>
            </div>
            <div>
              <span>Security</span>
              <strong>Server-key protected</strong>
            </div>
            <div>
              <span>Dash access</span>
              <strong>Context + tools</strong>
            </div>
            <div>
              <span>Runtime</span>
              <strong>{operatorStatus?.runtime.mode ?? "Local-first"}</strong>
            </div>
            <div>
              <span>Owned tools</span>
              <strong>{operatorStatus ? `${operatorStatus.tools.length} live` : "Checking"}</strong>
            </div>
            <div>
              <span>Mic permission</span>
              <strong>{microphonePermissionLabel(microphonePermission)}</strong>
            </div>
          </div>
          <div className="voice-actions">
            {isLive || isBusy ? (
              <Button variant="secondary" onClick={state === "fallback-listening" ? stopFallbackRecording : () => stopVoice()}>
                <PauseCircle size={16} />
                {state === "fallback-listening" ? "Stop and send" : "End voice"}
              </Button>
            ) : (
              <>
                <Button disabled={!canStart} onClick={startVoice}>
                  <Radio size={16} />
                  Start voice
                </Button>
                <Button variant="secondary" disabled={!canStartFallback} onClick={startFallbackVoice}>
                  <Mic2 size={16} />
                  Backup voice
                </Button>
              </>
            )}
          </div>
          {error ? <p className="voice-error">{error}</p> : null}
          {microphonePermission === "denied" ? (
            <div className="voice-permission-card">
              <strong>Mic access is blocked</strong>
              <span>Allow microphone access in the browser address bar and macOS privacy settings, then reload or recheck.</span>
              <Button variant="secondary" onClick={() => void refreshMicrophonePermission(true)}>Recheck mic</Button>
            </div>
          ) : null}
        </section>

        <section className="voice-command-panel">
          <div className="voice-safety-strip">
            <ShieldCheck size={16} />
            <span>JARVIS can read live dashboard context, open workspaces, run safe tools, and route sensitive actions through approvals.</span>
          </div>
          <label className="voice-input-label" htmlFor="jarvis-voice-command">
            Send a written command into JARVIS
          </label>
          <div className="voice-input-row">
            <textarea
              id="jarvis-voice-command"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="Example: JARVIS, open the highest-priority lead and tell me what to do next."
            />
            <Button variant="secondary" onClick={sendTextCommand}>
              <Send size={15} />
              Send
            </Button>
          </div>
          <div className="voice-log">
            {logs.map((log) => (
              <div key={log.id} className="voice-log-row" data-tone={log.tone}>
                <Activity size={14} />
                <div>
                  <strong>{log.label}</strong>
                  <p>{log.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="voice-note">
            <Volume2 size={15} />
            <span>Try: “open markets”, “check the dashboard”, “run five leads”, or “ask strategy what I should do next.”</span>
          </div>
        </section>
      </div>
    </Modal>
  );
}
