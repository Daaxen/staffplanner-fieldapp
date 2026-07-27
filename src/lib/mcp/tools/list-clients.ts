import { defineTool } from "@lovable.dev/mcp-js";
import { clients } from "../../data/mockData.ts";

export default defineTool({
  name: "list_clients",
  title: "List clients",
  description: "List all retail clients StaffPlanner works with.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [{ type: "text", text: JSON.stringify(clients, null, 2) }],
    structuredContent: { count: clients.length, clients },
  }),
});
