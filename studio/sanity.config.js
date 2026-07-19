import {defineConfig} from "sanity"
import {structureTool} from "sanity/structure"
import {visionTool} from "@sanity/vision"
import {schemaTypes} from "./schemaTypes/index.js"

const projectId = process.env.SANITY_STUDIO_PROJECT_ID
const dataset = process.env.SANITY_STUDIO_DATASET || "production"

if (!projectId) {
  throw new Error("Missing SANITY_STUDIO_PROJECT_ID in studio/.env")
}

export default defineConfig({
  name: "cambium",
  title: "jun. Content Studio",
  projectId,
  dataset,
  plugins: [structureTool(), visionTool()],
  schema: {
    types: schemaTypes,
  },
})
