import type { MetadataRoute } from "next";
import { getAppBasePath } from "@/lib/static-export";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const basePath = getAppBasePath();

  return {
    name: "ロマン枠 作戦司令室",
    short_name: "ロマン司令室",
    description: "個人用投資ダッシュボード",
    start_url: `${basePath}/`,
    display: "standalone",
    background_color: "#08090a",
    theme_color: "#08090a",
    icons: [
      {
        src: `${basePath}/icon.svg`,
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
