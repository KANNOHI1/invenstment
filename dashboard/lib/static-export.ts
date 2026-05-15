import type { PositionInput } from "./dashboard-model";

export type PositionsFile = {
  currency?: string;
  positions?: PositionInput[];
};

export function selectPositionsFile(local: PositionsFile, published: PositionsFile): PositionsFile {
  return local.positions?.length ? local : published;
}

export function getAppBasePath(env: NodeJS.ProcessEnv = process.env): string {
  if (env.GITHUB_PAGES !== "true") return "";
  return `/${env.GITHUB_REPOSITORY?.split("/")[1] ?? "invenstment"}`;
}

export function getMemoHref(relativePath: string, basePath = getAppBasePath()): string {
  return `${basePath}/memo/${relativePath.split("/").map(encodeURIComponent).join("/")}/`;
}
