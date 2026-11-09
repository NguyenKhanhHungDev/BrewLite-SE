import { handleSessionRequest } from "@/lib/session-server";

type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  return handleSessionRequest(request, (await context.params).path);
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
