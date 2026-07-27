import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauth } from "../supabase";

export default defineTool({
  name: "list_installers",
  title: "List installers",
  description: "List installers (own staff and sub-vendors) from the live database. RLS applies.",
  inputSchema: {
    includeSandbox: z.boolean().optional().describe("Include sandbox rows (default false)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ includeSandbox }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const sb = supabaseForUser(ctx);
    let q = sb.from("installers").select("*");
    if (!includeSandbox) q = q.eq("sandbox", false);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { count: data?.length ?? 0, installers: data ?? [] },
    };
  },
});
