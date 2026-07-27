import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjects from "./tools/list-projects";
import getProject from "./tools/get-project";
import listInstallers from "./tools/list-installers";
import listClients from "./tools/list-clients";
import whoAmI from "./tools/whoami";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "staffplanner-mcp",
  title: "StaffPlanner MCP",
  version: "0.2.0",
  instructions:
    "Signed-in tools for StaffPlanner (retail installation scheduling). All tools act as the connected user and respect Row-Level Security. Use list_projects/get_project to browse work, list_installers/list_clients for reference data, and whoami to see your identity and roles.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProjects, getProject, listInstallers, listClients, whoAmI],
});
