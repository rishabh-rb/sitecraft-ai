"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Copy, Download, ExternalLink, Link2, QrCode } from "lucide-react";
import type { GeneratedWebsite } from "@/lib/api";
import { download, snapshotUrl } from "@/lib/studio";
import { Modal } from "./Modal";
import { toast } from "./ToastViewport";
export function ShareDialog({
  website,
  publishedUrl,
  onClose,
}: {
  website: GeneratedWebsite;
  publishedUrl?: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(""),
    [qr, setQr] = useState(""),
    [error, setError] = useState(""),
    [qrError, setQrError] = useState("");
  useEffect(() => {
    let active = true;
    void snapshotUrl(website)
      .then(async (link) => {
        if (!active) return;
        setUrl(link);
        const target = publishedUrl || link;
        try {
          if (target.length > 2200) throw new Error();
          const QRCode = (await import("qrcode")).default;
          const result = await QRCode.toDataURL(target, {
            width: 256,
            margin: 2,
            errorCorrectionLevel: "L",
            color: { dark: "#202a26", light: "#ffffff" },
          });
          if (active) setQr(result);
        } catch {
          if (active)
            setQrError(
              "This snapshot is too large for a QR code. Publish the server version for a shorter URL.",
            );
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [website, publishedUrl]);
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied to clipboard");
    } catch {
      toast("Select the text and copy it manually", "info");
    }
  }
  function socialImage() {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#f7f3eb";
    ctx.fillRect(0, 0, 1200, 630);
    ctx.fillStyle = website.plan.colorPalette.primary || "#d65339";
    ctx.fillRect(72, 180, 80, 8);
    ctx.font = "bold 30px Arial";
    ctx.fillStyle = "#1b2420";
    ctx.fillText("✦ SiteCraft AI", 72, 100);
    ctx.font = "bold 64px Arial";
    const title = website.plan.siteName;
    ctx.fillText(title.length > 28 ? title.slice(0, 28) + "…" : title, 72, 292);
    ctx.font = "26px Arial";
    ctx.fillStyle = "#626a65";
    ctx.fillText("A website idea, brought to life.", 72, 358);
    ctx.font = "21px Arial";
    ctx.fillText("Draft preview · Created with SiteCraft AI", 72, 548);
    canvas.toBlob((blob) => {
      if (blob) download(blob, "sitecraft-social-preview.png");
    }, "image/png");
  }
  return (
    <Modal title="Share a little possibility" onClose={onClose}>
      <p className="sc-muted">
        Share a read-only snapshot of this draft. Anyone with the link can view
        its content. Later edits need a new link.
      </p>
      {typeof location !== "undefined" &&
        /localhost|127\.0\.0\.1/.test(location.hostname) && (
          <div className="sc-notice">
            Local development link. Deploy SiteCraft itself before sharing this
            link outside your computer.
          </div>
        )}
      {error ? (
        <p className="sc-error" role="alert">
          {error}
        </p>
      ) : (
        <>
          <label className="sc-field-label" htmlFor="share-url">
            Portable preview link
          </label>
          <div className="sc-copy-field">
            <input
              id="share-url"
              readOnly
              value={url || "Preparing snapshot…"}
              className="sc-input"
            />
            <button
              className="sc-icon"
              aria-label="Copy snapshot link"
              disabled={!url}
              onClick={() => void copy(url)}
            >
              <Copy size={18} />
            </button>
          </div>
          <div className="sc-inline-actions sc-share-actions">
            <button
              className="sc-btn sc-btn-dark"
              disabled={!url}
              onClick={() => void copy(url)}
            >
              <Link2 size={16} /> Copy link
            </button>
            <a
              className="sc-btn sc-btn-outline"
              href={url || undefined}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} /> Open preview
            </a>
          </div>
          <label className="sc-field-label" htmlFor="embed-code">
            Embed code
          </label>
          <textarea
            id="embed-code"
            className="sc-input"
            readOnly
            rows={3}
            value={
              url
                ? `<iframe src="${url}" title="SiteCraft preview" width="100%" height="720" sandbox="allow-scripts allow-forms"></iframe>`
                : "Preparing…"
            }
          />
          <button
            className="sc-text-btn"
            disabled={!url}
            onClick={() =>
              void copy(
                `<iframe src="${url}" title="SiteCraft preview" width="100%" height="720" sandbox="allow-scripts allow-forms"></iframe>`,
              )
            }
          >
            <Copy size={14} /> Copy embed
          </button>
        </>
      )}
      <div className="sc-share-bottom">
        <div>
          <QrCode size={22} />
          <h3>Take it with you</h3>
          <p className="sc-small sc-muted">
            {publishedUrl
              ? "QR opens the last ready deployment."
              : "QR opens this snapshot, when its size allows."}
          </p>
          {qr ? (
            <>
              <Image
                className="sc-qr"
                src={qr}
                alt="QR code for the preview"
                width={148}
                height={148}
                unoptimized
              />
              <button
                className="sc-text-btn"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = qr;
                  a.download = "sitecraft-qr.png";
                  a.click();
                }}
              >
                Download QR
              </button>
            </>
          ) : (
            <p className="sc-small sc-muted">{qrError || "Preparing QR…"}</p>
          )}
        </div>
        <div>
          <Download size={22} />
          <h3>Social preview</h3>
          <p className="sc-small sc-muted">
            Download a branded PNG to attach to your post. Snapshot links use
            SiteCraft’s generic social metadata.
          </p>
          <button className="sc-btn sc-btn-outline" onClick={socialImage}>
            Download image
          </button>
        </div>
      </div>
    </Modal>
  );
}
