import { defineTool } from "@lovable.dev/mcp-js";
import { installers } from "../../data/mockData.ts";

export default defineTool({
  name: "list_installers",
  title: "List installers",
  description: "List all installers (staff and sub-vendors) available in StaffPlanner.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text", text: JSON.stringify(installers, null, 2) }],
    structuredContent: { count: installers.length, installers },
  }),
});
