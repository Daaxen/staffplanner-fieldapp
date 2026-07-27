import { defineMcp } from "@lovable.dev/mcp-js";
import listProjects from "./tools/list-projects";
import getProject from "./tools/get-project";
import listInstallers from "./tools/list-installers";
import listClients from "./tools/list-clients";

export default defineMcp({
  name: "staffplanner-mcp",
  title: "StaffPlanner MCP",
  version: "0.1.0",
  instructions:
    "Read-only tools for StaffPlanner, a retail installation scheduling app. Use list_projects to browse projects (filter by status, type, client, assignee, or unassigned). Use get_project for a single project by id. Use list_installers and list_clients for reference data.",
  tools: [listProjects, getProject, listInstallers, listClients],
});
