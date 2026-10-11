// Exercise video upload + range streaming on R2. Ports server.py:906-988.
import { APIError, json, securityHeaders, MAX_VIDEO } from "./http";
import { Env, publicOrigin } from "./env";
import { getWorkspace, putWorkspace, getVideoMeta, setVideoMeta, UserRow } from "./db";
import { viewFor } from "./analytics";
import { randomHex } from "./crypto";

const MIMES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];

function eq(b: Uint8Array, off: number, bytes: number[]): boolean {
  return bytes.every((v, i) => b[off + i] === v);
}
// Same magic-byte sniff as server.py:913-917.
function looksLikeVideo(b: Uint8Array): boolean {
  const first = eq(b, 0, [0x1a, 0x45, 0xdf, 0xa3]) || eq(b, 0, [0x4f, 0x67, 0x67, 0x53]); // EBML / OggS
  const at4 =
    eq(b, 4, [0x66, 0x74, 0x79, 0x70]) || // ftyp
    eq(b, 4, [0x6d, 0x6f, 0x6f, 0x76]) || // moov
    eq(b, 4, [0x77, 0x69, 0x64, 0x65]); // wide
  return first || at4;
}

export async function uploadVideo(
  req: Request,
  env: Env,
  user: UserRow,
  eid: string,
): Promise<Response> {
  const origin = publicOrigin(req, env);
  if (user.role !== "coach") throw new APIError("Only your coach can upload exercise videos.", 403);
  const mime = (req.headers.get("Content-Type") || "").split(";")[0];
  if (!MIMES.includes(mime)) throw new APIError("Choose MP4, WebM, Ogg or MOV.", 415);
  const len = req.headers.get("Content-Length");
  if (len && Number(len) > MAX_VIDEO) throw new APIError("That upload is too large.", 413);

  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.byteLength > MAX_VIDEO) throw new APIError("That upload is too large.", 413);
  if (!buf.byteLength || !looksLikeVideo(buf)) {
    throw new APIError("This file does not look like a supported video.", 415);
  }

  const { w, revision } = await getWorkspace(env.DB);
  const ex = w.exercises.find((e: any) => e.id === eid);
  if (!ex) throw new APIError("Exercise not found.", 404);

  const filename = randomHex(24) + ".video";
  const old = await getVideoMeta(env.DB, eid);
  await env.VIDEOS.put(filename, buf);
  try {
    await setVideoMeta(env.DB, eid, filename, mime);
    ex.video = true;
    const newRevision = await putWorkspace(env.DB, JSON.stringify(w), revision);
    if (newRevision === null) throw new APIError("Another update arrived. Please try again.", 409);
    if (old) await env.VIDEOS.delete(old.file);
    return json({ workspace: viewFor(user, w), revision: newRevision }, 200, {}, origin);
  } catch (e) {
    await env.VIDEOS.delete(filename); // roll back the orphaned object
    throw e;
  }
}

export async function serveVideo(
  req: Request,
  env: Env,
  eid: string,
  head: boolean,
): Promise<Response> {
  const origin = publicOrigin(req, env);
  const meta = await getVideoMeta(env.DB, eid);
  if (!meta) throw new APIError("Video not found.", 404);
  const headObj = await env.VIDEOS.head(meta.file);
  if (!headObj) throw new APIError("Video not found.", 404);
  const size = headObj.size;

  let start = 0;
  let end = size - 1;
  let status = 200;
  const rng = req.headers.get("Range");
  if (rng) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rng);
    if (!match || (!match[1] && !match[2])) throw new APIError("Invalid video range.", 416);
    if (!match[1]) {
      start = Math.max(0, size - Number(match[2]));
    } else {
      start = Number(match[1]);
      end = match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
    }
    if (start >= size || end < start) throw new APIError("Video range is outside the file.", 416);
    status = 206;
  }

  const headers: Record<string, string> = {
    "Content-Type": meta.mime,
    "Content-Length": String(end - start + 1),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    ...securityHeaders(origin),
  };
  if (status === 206) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  if (head) return new Response(null, { status, headers });

  const obj = await env.VIDEOS.get(meta.file, {
    range: { offset: start, length: end - start + 1 },
  });
  return new Response(obj?.body ?? null, { status, headers });
}
