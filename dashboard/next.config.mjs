const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "invenstment";
const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: isGitHubPages ? `/${repoName}` : undefined,
  assetPrefix: isGitHubPages ? `/${repoName}/` : undefined,
  typedRoutes: false
};

export default nextConfig;
