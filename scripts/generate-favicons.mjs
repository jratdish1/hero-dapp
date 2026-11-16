/**
 * Favicon / web-manifest icon generator
 * Rasterizes the PNG embedded in client/public/favicon.svg into every icon that
 * client/index.html and client/public/site.webmanifest reference.
 *
 * Requires ffmpeg on PATH. Output is byte-for-byte reproducible for a given
 * ffmpeg build (bitexact flags, no metadata, fixed lanczos scaling).
 *
 * Usage: node scripts/generate-favicons.mjs
 */
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const PUBLIC_DIR = "client/public";
const BACKGROUND = "0x0b0f14";
const SCALE = "flags=lanczos+accurate_rnd+full_chroma_int";
const PNG_ARGS = ["-c:v", "png", "-pix_fmt", "rgb24", "-pred", "mixed", "-compression_level", "9"];

const svg = readFileSync(join(PUBLIC_DIR, "favicon.svg"), "utf8");
const embedded = svg.match(/<image width="64" height="64" href="data:image\/png;base64,([A-Za-z0-9+/=]+)"/);
if (!svg.includes('viewBox="0 0 64 64"') || !embedded) {
  throw new Error("favicon.svg is no longer a full-bleed 64x64 embedded PNG; update this generator");
}

const work = mkdtempSync(join(tmpdir(), "favicons-"));
const source = join(work, "source.png");
writeFileSync(source, Buffer.from(embedded[1], "base64"));

function ffmpeg(filter, out, codecArgs) {
  execFileSync(
    "ffmpeg",
    ["-v", "error", "-y", "-i", source, "-vf", filter, "-frames:v", "1", "-map_metadata", "-1",
      "-fflags", "+bitexact", "-flags", "+bitexact", ...codecArgs, out],
    { stdio: "inherit" },
  );
}

function png(size, out) {
  ffmpeg(`format=rgb24,scale=${size}:${size}:${SCALE}`, out, PNG_ARGS);
}

// Logo centered on the theme background; inset keeps a maskable icon inside the 80% safe zone.
function padded(width, height, logo, out, codecArgs) {
  const filter = `format=rgb24,scale=${logo}:${logo}:${SCALE},pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${BACKGROUND}`;
  ffmpeg(filter, out, codecArgs);
}

// ICO container with PNG-compressed entries (supported by all current browsers and Windows Vista+).
function ico(sizes, out) {
  const images = sizes.map((size) => {
    const file = join(work, `ico-${size}.png`);
    png(size, file);
    return { size, data: readFileSync(file) };
  });
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  writeFileSync(out, Buffer.concat([header, ...images.map((image) => image.data)]));
}

try {
  ico([16, 32, 48], join(PUBLIC_DIR, "favicon.ico"));
  png(96, join(PUBLIC_DIR, "favicon-96x96.png"));
  png(180, join(PUBLIC_DIR, "apple-touch-icon.png"));
  png(192, join(PUBLIC_DIR, "icon-192.png"));
  png(512, join(PUBLIC_DIR, "icon-512.png"));
  padded(512, 512, 408, join(PUBLIC_DIR, "icon-512-maskable.png"), PNG_ARGS);
  padded(1200, 630, 512, join(PUBLIC_DIR, "og-image-1200x630.jpg"), ["-c:v", "mjpeg", "-q:v", "2", "-pix_fmt", "yuvj444p"]);
} finally {
  rmSync(work, { recursive: true, force: true });
}
