import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import {
  ConfigurationFiles, ImageMagick, MagickColors, MagickFormat, initializeImageMagick,
} from '@imagemagick/magick-wasm';

const envelope = { maxBytes: 10_485_760, maxWidth: 8_192, maxHeight: 8_192, maxPixels: 16_000_000 };
const wasmPath = path.join(process.cwd(), 'node_modules', '@imagemagick', 'magick-wasm', 'dist', 'magick.wasm');
const wasm = await fs.readFile(wasmPath);
const configuration = ConfigurationFiles.default;
configuration.policy.data = `<?xml version="1.0" encoding="UTF-8"?><policymap>
<policy domain="resource" name="width" value="8192"/><policy domain="resource" name="height" value="8192"/>
<policy domain="resource" name="area" value="64MP"/><policy domain="resource" name="memory" value="1GiB"/>
<policy domain="resource" name="map" value="2GiB"/><policy domain="resource" name="disk" value="0"/>
<policy domain="resource" name="thread" value="2"/>
</policymap>`;
const initStarted = performance.now();
await initializeImageMagick(wasm, configuration);
const coldInitializationMs = performance.now() - initStarted;

const generate = (width, height) => ImageMagick.read(MagickColors.White, width, height, (image) => {
  image.comment = 'synthetic GPS metadata must be stripped';
  image.quality = 90;
  return image.write(MagickFormat.Jpeg, (bytes) => Uint8Array.from(bytes));
});

const fixtures = [
  ['approximately_8mp', generate(4_000, 2_000)],
  ['approximately_12mp', generate(4_000, 3_000)],
  ['approved_16mp_maximum', generate(4_000, 4_000)],
];

function sanitize(bytes) {
  return ImageMagick.read(bytes, (image) => {
    const source = { width: image.width, height: image.height };
    if (source.width > envelope.maxWidth || source.height > envelope.maxHeight
      || source.width * source.height > envelope.maxPixels) throw new Error('fixture exceeds envelope');
    image.autoOrient();
    image.strip();
    image.quality = 82;
    return image.write(MagickFormat.WebP, (output) => ({ source, output: Uint8Array.from(output) }));
  });
}

function verify(output) {
  return ImageMagick.read(output, (image) => ({
    width: image.width,
    height: image.height,
    format: String(image.format),
    commentRemoved: image.comment === null,
    profilesRemaining: [...image.profileNames],
  }));
}

async function runFixture(name, bytes, iterations = 3) {
  const timings = [];
  const hashes = [];
  const rssBefore = process.memoryUsage().rss;
  let evidence;
  for (let index = 0; index < iterations; index += 1) {
    const started = performance.now();
    const result = sanitize(bytes);
    timings.push(performance.now() - started);
    hashes.push(createHash('sha256').update(result.output).digest('hex'));
    evidence = { inputBytes: bytes.byteLength, outputBytes: result.output.byteLength, ...verify(result.output) };
  }
  const rssAfter = process.memoryUsage().rss;
  return {
    name,
    iterations,
    runtimeMs: {
      min: Math.min(...timings),
      median: [...timings].sort((a, b) => a - b)[Math.floor(timings.length / 2)],
      max: Math.max(...timings),
    },
    rssBeforeBytes: rssBefore,
    rssAfterBytes: rssAfter,
    rssDeltaBytes: rssAfter - rssBefore,
    outputSha256: hashes[0],
    hashStable: new Set(hashes).size === 1,
    outputCorrect: evidence.width * evidence.height <= envelope.maxPixels && evidence.format.toUpperCase() === 'WEBP',
    ...evidence,
  };
}

async function directoryBytes(directory) {
  let total = 0;
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    total += entry.isDirectory() ? await directoryBytes(target) : (await fs.stat(target)).size;
  }
  return total;
}

const fixtureEvidence = [];
for (const [name, bytes] of fixtures) {
  fixtureEvidence.push(await runFixture(name, bytes));
}

const report = {
  evidenceClass: 'local dedicated-worker Node/WASM sizing evidence; not deployed-runtime proof and not Supabase Edge feasibility evidence',
  runtime: { node: process.version, platform: process.platform, arch: process.arch },
  dependency: { name: '@imagemagick/magick-wasm', version: '0.0.41', license: 'Apache-2.0' },
  envelope,
  coldInitializationMs,
  peakRssBytesAvailable: false,
  processMaxRss: process.resourceUsage().maxRSS,
  wasmBytes: wasm.byteLength,
  packageBytes: await directoryBytes(path.dirname(path.dirname(wasmPath))),
  resourcePolicy: { memory: '1GiB', map: '2GiB', disk: 0, threads: 2, dimensions: '8192x8192', cacheArea: '64MP', acceptedPixels: '16MP' },
  fixtures: fixtureEvidence,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
