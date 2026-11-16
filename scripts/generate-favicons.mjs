/**
 * Favicon / web-manifest icon generator
 * Rasterizes the official 512x512 HERO logo (client/public/brand/hero-logo-512.png)
 * into every icon that client/index.html and client/public/site.webmanifest
 * reference, and rewrites client/public/favicon.svg to embed a 64x64 rendition.
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
const MASTER = join(PUBLIC_DIR, "brand/hero-logo-512.png");
const MASTER_SIZE = 512;
const BACKGROUND = "0x0b0f14";
const SCALE = "flags=lanczos+accurate_rnd+full_chroma_int";
const PNG_ARGS = ["-c:v", "png", "-pix_fmt", "rgb24", "-pred", "mixed", "-compression_level", "9"];
const JPEG_ARGS = ["-c:v", "mjpeg", "-q:v", "2", "-pix_fmt", "yuvj444p"];

const probe = execFileSync(
  "ffprobe",
  ["-v", "error", "-show_entries", "stream=width,height,color_primaries", "-of", "default=nw=1", MASTER],
  { encoding: "utf8" },
);
const info = Object.fromEntries(probe.trim().split("\n").map((line) => line.split("=")));
if (Number(info.width) !== MASTER_SIZE || Number(info.height) !== MASTER_SIZE) {
  throw new Error(`${MASTER} must be ${MASTER_SIZE}x${MASTER_SIZE}, got ${info.width}x${info.height}`);
}

// Outputs carry no colour profile, so browsers treat them as sRGB; a Display P3 master must be converted first.
const TO_SRGB = {
  smpte432: "zscale=primariesin=smpte432:transferin=iec61966-2-1:matrixin=gbr:rangein=full:primaries=bt709:transfer=iec61966-2-1:matrix=gbr:range=full,",
  bt709: "",
  unknown: "",
}[info.color_primaries];
if (TO_SRGB === undefined) {
  throw new Error(`unsupported colour primaries in ${MASTER}: ${info.color_primaries}`);
}

const work = mkdtempSync(join(tmpdir(), "favicons-"));

function ffmpeg(filter, out, codecArgs) {
  execFileSync(
    "ffmpeg",
    ["-v", "error", "-y", "-i", MASTER, "-vf", `${TO_SRGB}format=rgb24,${filter}`, "-frames:v", "1",
      "-map_metadata", "-1", "-fflags", "+bitexact", "-flags", "+bitexact", ...codecArgs, out],
    { stdio: "inherit" },
  );
}

function resize(size) {
  return size === MASTER_SIZE ? "null" : `scale=${size}:${size}:${SCALE}`;
}

function png(size, out) {
  ffmpeg(resize(size), out, PNG_ARGS);
}

// Logo centered on the theme background; inset keeps a maskable icon inside the 80% safe zone.
function padded(width, height, logo, out, codecArgs) {
  ffmpeg(`${resize(logo)},pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=${BACKGROUND}`, out, codecArgs);
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

function svg(size, out) {
  const file = join(work, `svg-${size}.png`);
  png(size, file);
  const href = `data:image/png;base64,${readFileSync(file).toString("base64")}`;
  writeFileSync(
    out,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><image width="${size}" height="${size}" href="${href}"/></svg>\n`,
  );
}

try {
  ico([16, 32, 48], join(PUBLIC_DIR, "favicon.ico"));
  svg(64, join(PUBLIC_DIR, "favicon.svg"));
  png(96, join(PUBLIC_DIR, "favicon-96x96.png"));
  png(180, join(PUBLIC_DIR, "apple-touch-icon.png"));
  png(192, join(PUBLIC_DIR, "icon-192.png"));
  png(512, join(PUBLIC_DIR, "icon-512.png"));
  padded(512, 512, 408, join(PUBLIC_DIR, "icon-512-maskable.png"), PNG_ARGS);
  padded(1200, 630, 512, join(PUBLIC_DIR, "og-image-1200x630.jpg"), JPEG_ARGS);
} finally {
  rmSync(work, { recursive: true, force: true });
}
