import { readFile } from "node:fs/promises";
import nodePath from "node:path";

import { NextResponse } from "next/server";

const AUDIO_ASSET_ROOT = nodePath.resolve(process.cwd(), "../../public");
const ALLOWED_TRACKS = new Set(["Awakening.mp3", "Felt Letter.mp3", "First Words.mp3"]);

function resolveAudioPath(segments: string[]): string | undefined {
  if (segments.length !== 1) {
    return undefined;
  }

  const [filename] = segments;
  if (!filename || filename.includes("/") || filename.includes("\\") || filename === ".." || !ALLOWED_TRACKS.has(filename)) {
    return undefined;
  }

  const resolvedPath = nodePath.resolve(AUDIO_ASSET_ROOT, filename);
  if (!resolvedPath.startsWith(`${AUDIO_ASSET_ROOT}${nodePath.sep}`)) {
    return undefined;
  }

  return resolvedPath;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const audioPath = resolveAudioPath(path);
  if (!audioPath) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const body = await readFile(audioPath);

    return new NextResponse(body, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": "audio/mpeg",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
