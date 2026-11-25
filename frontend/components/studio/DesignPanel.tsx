"use client";
import { useState } from "react";
import Image from "next/image";
import { ImagePlus, Palette, Upload } from "lucide-react";
import { fonts, type DesignOptions } from "@/lib/templates";
import { toast } from "./ToastViewport";
export function DesignPanel({
  design,
  onChange,
}: {
  design: DesignOptions;
  onChange: (d: DesignOptions, label: string) => void;
}) {
  const [url, setUrl] = useState(""),
    [importing, setImporting] = useState(false);
  const update = (value: Partial<DesignOptions>, label: string) =>
    onChange({ ...design, ...value }, label);
  async function logo(file?: File) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 500000) {
      toast("Choose a PNG, JPEG or WebP logo under 500 KB", "info");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new window.Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 32;
        const ctx = canvas.getContext("2d");
        let accent = design.accent;
        if (ctx) {
          ctx.drawImage(image, 0, 0, 32, 32);
          const pixels = ctx.getImageData(0, 0, 32, 32).data;
          const buckets = new Map<string, number>();
          for (let i = 0; i < pixels.length; i += 4) {
            if (
              pixels[i + 3] < 128 ||
              Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) -
                Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) <
                35
            )
              continue;
            const hex =
              "#" +
              [pixels[i], pixels[i + 1], pixels[i + 2]]
                .map((v) =>
                  Math.min(255, Math.round(v / 24) * 24)
                    .toString(16)
                    .padStart(2, "0"),
                )
                .join("");
            buckets.set(hex, (buckets.get(hex) || 0) + 1);
          }
          accent =
            [...buckets.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ||
            accent;
        }
        update(
          { logo: String(reader.result), accent },
          "Imported brand logo and palette",
        );
        toast("Logo added and a starting accent extracted");
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }
  async function importBrand() {
    if (!/^https:\/\//.test(url)) {
      toast("Enter an HTTPS website URL", "info");
      return;
    }
    setImporting(true);
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        credentials: "omit",
      });
      if (!response.ok) throw new Error();
      const text = await response.text();
      const colors = text.match(/#[a-fA-F0-9]{6}\b/g);
      if (!colors?.length) throw new Error();
      const counts = new Map<string, number>();
      colors.forEach((c) => counts.set(c, (counts.get(c) || 0) + 1));
      const accent = [...counts.entries()]
        .filter(([c]) => !/^#(fff|000|eee|ddd)/i.test(c))
        .sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!accent) throw new Error();
      update({ accent }, "Imported website accent");
      toast("Starting accent imported. Review it against your brand.");
    } catch {
      toast(
        "This site doesn’t allow browser imports. Upload your logo to extract a palette.",
        "info",
      );
    } finally {
      setImporting(false);
    }
  }
  return (
    <div className="sc-inspector-content">
      <div className="sc-panel-heading">
        <Palette size={17} />
        <h3>Make it feel like you</h3>
      </div>
      <p className="sc-small sc-muted">
        Visual edits are saved in this browser. HTML export includes your
        changes.
      </p>
      <label className="sc-field-label">Brand color</label>
      <div className="sc-color-field">
        <input
          type="color"
          aria-label="Brand color"
          value={design.accent}
          onChange={(e) =>
            update({ accent: e.target.value }, "Changed brand color")
          }
        />
        <code>{design.accent}</code>
      </div>
      <div className="sc-swatches sc-design-swatches">
        {["#9b442b", "#6554c0", "#216e65", "#d94e32", "#315c9e", "#222d28"].map(
          (color) => (
            <button
              key={color}
              aria-label={`Set accent ${color}`}
              style={{ background: color }}
              onClick={() => update({ accent: color }, "Changed brand color")}
            />
          ),
        )}
      </div>
      <label className="sc-field-label" htmlFor="design-font">
        Typography
      </label>
      <select
        id="design-font"
        className="sc-input"
        value={design.font}
        onChange={(e) => update({ font: e.target.value }, "Changed typography")}
      >
        {fonts.map((font) => (
          <option key={font}>{font}</option>
        ))}
      </select>
      {(
        [
          ["radius", "Corner radius", 0, 40, "px"],
          ["spacing", "Section spacing", 24, 112, "px"],
          ["width", "Page width", 800, 1440, "px"],
        ] as const
      ).map(([key, label, min, max, unit]) => (
        <label className="sc-range-field" key={key}>
          <span>
            {label}
            <b>
              {design[key]}
              {unit}
            </b>
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={key === "width" ? 20 : 4}
            value={design[key]}
            onChange={(e) =>
              update(
                { [key]: Number(e.target.value) },
                `Changed ${label.toLowerCase()}`,
              )
            }
          />
        </label>
      ))}
      <label className="sc-toggle-row">
        <span>Dark direction</span>
        <input
          type="checkbox"
          checked={design.dark}
          onChange={(e) =>
            update({ dark: e.target.checked }, "Changed color direction")
          }
        />
      </label>
      <label className="sc-field-label">Component presets</label>
      <div className="sc-preset-grid">
        {[
          ["Editorial", 0, 88, "Georgia"],
          ["Soft", 24, 72, "Arial"],
          ["Compact", 8, 40, "Verdana"],
        ].map(([name, radius, spacing, font]) => (
          <button
            key={name}
            onClick={() =>
              update(
                {
                  radius: Number(radius),
                  spacing: Number(spacing),
                  font: String(font),
                },
                `${name} design preset`,
              )
            }
          >
            {name}
          </button>
        ))}
      </div>
      <hr />
      <div className="sc-panel-heading">
        <ImagePlus size={17} />
        <h3>Brand kit</h3>
      </div>
      <label className="sc-upload">
        <Upload size={17} /> Upload a logo
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => void logo(e.target.files?.[0])}
        />
      </label>
      {design.logo && (
        <div className="sc-logo-preview">
          <Image
            src={design.logo}
            alt="Uploaded brand logo"
            width={100}
            height={40}
            unoptimized
          />
          <button
            className="sc-text-btn"
            onClick={() => update({ logo: "" }, "Removed logo")}
          >
            Remove
          </button>
        </div>
      )}
      <p className="sc-small sc-muted">
        PNG, JPEG or WebP, up to 500 KB. Extracts a starting accent from the
        image.
      </p>
      <label className="sc-field-label" htmlFor="brand-url">
        Or import an accent from a website
      </label>
      <input
        id="brand-url"
        type="url"
        className="sc-input"
        placeholder="https://your-brand.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button
        className="sc-btn sc-btn-outline sc-full"
        disabled={importing}
        onClick={() => void importBrand()}
      >
        {importing ? "Reading…" : "Find brand color"}
      </button>
      <p className="sc-small sc-muted">
        Works when the website permits browser access.
      </p>
    </div>
  );
}
