import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { projects } from "@/data/mockData";

export default defineTool({
  name: "get_project",
  title: "Get project",
  description: "Fetch a single project by its id, including schedule, contact, and assigned installer ids.",
  inputSchema: {
    id: z.string().min(1).describe("Project id, e.g. 'proj-1'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ id }) => {
    const project = projects.find((p) => p.id === id);
    if (!project) {
      return { content: [{ type: "text", text: `No project with id ${id}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(project, null, 2) }],
      structuredContent: { project },
    };
  },
});
