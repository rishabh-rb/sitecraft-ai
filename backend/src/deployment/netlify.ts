import JSZip from "jszip";
import type { DeploymentResult } from "./vercel.js";

export async function deployToNetlify(
  _projectName: string,
  files: Array<{ path: string; content: string }>,
  token?: string
): Promise<DeploymentResult> {
  const netlifyToken = token || process.env.NETLIFY_AUTH_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;

  if (!netlifyToken || !netlifyToken.trim()) {
    return {
      success: false,
      provider: "netlify",
      status: "ERROR",
      error: "Netlify deployment is not configured. Add NETLIFY_AUTH_TOKEN to .env."
    };
  }
  if (!siteId || !siteId.trim()) {
    return {
      success: false,
      provider: "netlify",
      status: "ERROR",
      error: "Netlify deployment is not configured. Add NETLIFY_SITE_ID to .env."
    };
  }

  try {
    const archive = new JSZip();
    for (const file of files) archive.file(file.path, file.content);
    const payload = await archive.generateAsync({ type: "nodebuffer" });
    const response = await fetch(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}/deploys`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${netlifyToken}`,
        "Content-Type": "application/zip"
      },
      body: new Uint8Array(payload)
    });
    const data = (await response.json()) as {
      id?: string;
      state?: string;
      url?: string;
      ssl_url?: string;
      error_message?: string;
      msg?: string;
    };

    if (!response.ok) {
      return {
        success: false,
        provider: "netlify",
        status: "ERROR",
        error: data.error_message || data.msg || `Netlify deployment failed with status ${response.status}`
      };
    }

    return {
      success: true,
      provider: "netlify",
      status: data.state === "ready" ? "READY" : "BUILDING",
      deploymentId: data.id,
      deploymentUrl: data.ssl_url || data.url
    };
  } catch (caught) {
    return {
      success: false,
      provider: "netlify",
      status: "ERROR",
      error: caught instanceof Error ? caught.message : "Netlify deployment failed"
    };
  }
}
