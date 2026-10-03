"use client";
// VideoCard.tsx: one configured video: native player (controls, no autoplay, poster, WebVTT captions),
// title, duration, transcript and its QR. Without a configured file or link it renders a labelled
// placeholder that names what is missing; nothing is simulated.
import { useEffect, useState } from "react";
import type { Lang } from "../types";
import type { Dict } from "../i18n";
import type { VideoConfig } from "../landing";
import { QrBlock } from "./QrBlock";

export interface VideoCardProps {
  video: VideoConfig;
  lang: Lang;
  tr: Dict;
  /** Large layout for the featured video. */
  featured?: boolean;
}

function Transcript({ src, tr }: { src: string | null; tr: Dict }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!src) return;
    fetch(src).then((r) => (r.ok ? r.text() : null)).then(setText, () => setText(null));
  }, [src]);
  if (!src) return <p className="rr-meta rr-video-missing">{tr.transcriptPending}</p>;
  return (
    <details className="rr-transcript">
      <summary>{tr.transcript}</summary>
      {text ? <div className="rr-transcript-body">{text}</div> : <p className="rr-meta">{tr.loading}</p>}
    </details>
  );
}

export function VideoCard({ video: v, lang, tr, featured }: VideoCardProps) {
  const title = v.title[lang] ?? v.title.en;
  const caption = v.captions[lang] ?? v.captions.en;
  const transcript = v.transcript[lang] ?? v.transcript.en;
  const playable = !!v.src;
  const missing = [
    !v.src && !v.url && tr.missingVideo,
    !v.poster && tr.missingPoster,
    !caption && tr.missingCaptions,
    !transcript && tr.missingTranscript,
  ].filter(Boolean) as string[];

  return (
    <article className={`rr-video ${featured ? "rr-video-featured" : ""}`} aria-labelledby={`v-${v.id}`}>
      <div className="rr-video-frame">
        {playable ? (
          <video controls preload="none" playsInline poster={v.poster ?? undefined} className="rr-video-el">
            <source src={v.src!} />
            {v.captions.en && <track kind="captions" src={v.captions.en} srcLang="en" label="English" default={lang === "en"} />}
            {v.captions.es && <track kind="captions" src={v.captions.es} srcLang="es" label="Español" default={lang === "es"} />}
          </video>
        ) : (
          <div className="rr-video-ph" role="img" aria-label={`${title}: ${tr.videoPending}`}>
            {v.poster && <img src={v.poster} alt="" className="rr-video-poster" />}
            <span className="rr-video-play" aria-hidden />
            <span className="rr-video-ph-label">{v.url ? tr.videoExternal : tr.videoPending}</span>
            <span className="rr-mono">{v.id}</span>
          </div>
        )}
      </div>
      <div className="rr-video-meta">
        <h3 id={`v-${v.id}`} className="rr-video-title">{title}</h3>
        <p className="rr-meta">
          {v.duration ? <><span className="rr-label">{tr.duration}</span> {v.duration}</> : tr.durationPending}
          {v.src && !caption && <> · {tr.noCaptions}</>}
        </p>
        <Transcript src={transcript} tr={tr} />
        {missing.length > 0 && (
          <p className="rr-video-missing"><span className="rr-label">{tr.pendingFiles}</span> {missing.join(" · ")}</p>
        )}
        <QrBlock label={tr.watchVideo} target={v.qr_target} qr={v.qr} tr={tr} />
      </div>
    </article>
  );
}
