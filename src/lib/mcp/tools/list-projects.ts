import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauth } from "../supabase";

export default defineTool({
  name: "list_projects",
  title: "List projects",
  description:
    "List installation/site-survey/transport projects from StaffPlanner. Optional filters by status, project type, client name, assigned installer id, and unassigned-only. Reads from live database; RLS applies.",
  inputSchema: {
    status: z.enum(["open", "scheduled", "in-progress", "completed", "on-hold", "cancelled"]).optional(),
    projectType: z.enum(["installation", "site-survey", "transport"]).optional(),
    client: z.string().optional().describe("Client name (case-insensitive substring)."),
    assigneeId: z.string().uuid().optional().describe("Installer id filter."),
    unassignedOnly: z.boolean().optional(),
    includeSandbox: z.boolean().optional().describe("Include sandbox rows (default false)."),
    limit: z.number().int().positive().max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, projectType, client, assigneeId, unassignedOnly, includeSandbox, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauth();
    const sb = supabaseForUser(ctx);
    let q = sb.from("projects").select("*, clients(name), project_assignees(installer_id)").limit(limit ?? 50);
    if (status) q = q.eq("status", status);
    if (projectType) q = q.eq("project_type", projectType);
    if (!includeSandbox) q = q.eq("sandbox", false);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    let rows = data ?? [];
    if (client) {
      const needle = client.toLowerCase();
      rows = rows.filter((r: any) => (r.clients?.name ?? "").toLowerCase().includes(needle));
    }
    if (assigneeId) rows = rows.filter((r: any) => r.project_assignees?.some((a: any) => a.installer_id === assigneeId));
    if (unassignedOnly) rows = rows.filter((r: any) => (r.project_assignees ?? []).length === 0);
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { count: rows.length, projects: rows },
    };
  },
});
