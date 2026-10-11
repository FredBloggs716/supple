// Workspace read/write. Ports server.py:667-709.
import { APIError, json, readJson } from "./http";
import { Env, publicOrigin } from "./env";
import { getWorkspace, putWorkspace, videoIdSet, UserRow } from "./db";
import { validateWorkspace } from "./validate";
import { viewFor } from "./analytics";

export async function getWorkspaceHandler(req: Request, env: Env, user: UserRow): Promise<Response> {
  const origin = publicOrigin(req, env);
  const { w, revision } = await getWorkspace(env.DB);
  return json({ workspace: viewFor(user, w), revision }, 200, {}, origin);
}

export async function putWorkspaceHandler(req: Request, env: Env, user: UserRow): Promise<Response> {
  const origin = publicOrigin(req, env);
  if (user.role !== "coach") throw new APIError("Only your coach can edit the workspace.", 403);
  const body = await readJson(req);
  const w = validateWorkspace(body.workspace);

  const { revision } = await getWorkspace(env.DB);
  const conflict = "Another update arrived. Your workspace has been refreshed; please retry your change.";
  if (body.revision !== revision) throw new APIError(conflict, 409);

  // Linked member accounts must keep their id + email (server.py:684-695).
  const linked = await env.DB
    .prepare("SELECT client,email FROM users WHERE role='member'")
    .all<{ client: string; email: string }>();
  for (const account of linked.results) {
    const c = w.clients.find((c: any) => c.id === account.client);
    if (!c || c.email.toLowerCase() !== account.email) {
      throw new APIError("Keep existing account records and their email addresses.", 409);
    }
  }

  // Video presence is authoritative on the server, never a browser flag.
  const videoIds = await videoIdSet(env.DB);
  for (const ex of w.exercises) ex.video = videoIds.has(ex.id);

  const newRevision = await putWorkspace(env.DB, JSON.stringify(w), revision);
  if (newRevision === null) throw new APIError(conflict, 409);
  return json({ workspace: viewFor(user, w), revision: newRevision }, 200, {}, origin);
}
