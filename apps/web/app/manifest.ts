import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Project Professional Wrestling",
    short_name: "PPW",
    description: "Persistent living-world wrestling management",
    start_url: "/",
    display: "standalone",
    background_color: "#080b10",
    theme_color: "#080b10",
    orientation: "portrait",
  };
}
