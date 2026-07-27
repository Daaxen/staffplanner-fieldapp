import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { projects, type ProjectStatus, type ProjectType } from "../../data/mockData";

export default defineTool({
  name: "list_projects",
  title: "List projects",
  description:
    "List installation/site-survey/transport projects tracked in StaffPlanner. Optional filters by status, project type, client, and assigned installer id.",
  inputSchema: {
    status: z
      .enum(["open", "scheduled", "in-progress", "completed", "on-hold", "cancelled"])
      .optional()
      .describe("Filter by project status."),
    projectType: z
      .enum(["installation", "site-survey", "transport"])
      .optional()
      .describe("Filter by project type."),
    client: z.string().optional().describe("Filter by client name (case-insensitive substring)."),
    assigneeId: z.string().optional().describe("Return only projects assigned to this installer id."),
    unassignedOnly: z.boolean().optional().describe("If true, return only projects with no assignees."),
    limit: z.number().int().positive().optional().describe("Max results (default 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ status, projectType, client, assigneeId, unassignedOnly, limit }) => {
    let rows = projects.slice();
    if (status) rows = rows.filter((p) => p.status === (status as ProjectStatus));
    if (projectType) rows = rows.filter((p) => p.projectType === (projectType as ProjectType));
    if (client) {
      const needle = client.toLowerCase();
      rows = rows.filter((p) => p.client.toLowerCase().includes(needle));
    }
    if (assigneeId) rows = rows.filter((p) => p.assigneeIds.includes(assigneeId));
    if (unassignedOnly) rows = rows.filter((p) => p.assigneeIds.length === 0);
    const capped = rows.slice(0, limit ?? 50);
    return {
      content: [{ type: "text", text: JSON.stringify(capped, null, 2) }],
      structuredContent: { count: capped.length, total: rows.length, projects: capped },
    };
  },
});
