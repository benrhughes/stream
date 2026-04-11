/**
 * Deploy-template data for the "bring your own proxy" setup step.
 *
 * Each entry describes a cloud platform the user can deploy the Stream
 * proxy to under their own account. The corresponding source lives under
 * `proxies/<id>/` in the repository.
 *
 * We intentionally do not ship "Deploy to X" one-click buttons in this
 * version. Those buttons require the proxy source to be hosted on GitHub
 * in a public repository, and Stream's canonical repo is on framagit.
 * Users follow the README in each proxies/ subdirectory, deploy, then
 * paste the resulting URL back into Stream. That's a couple of minutes
 * the first time and zero after that.
 */

export interface DeployTemplate {
  id:          'cloudflare-worker' | 'deno-deploy' | 'vercel-edge';
  name:        string;
  description: string;
  /**
   * Example shape of the URL the user will paste back after deploying.
   * Shown as placeholder text in the input field.
   */
  exampleUrl:  string;
  /**
   * Path inside the Stream repository where the user can find the source
   * and a README with step-by-step deploy instructions.
   */
  repoPath:    string;
}

export const DEPLOY_TEMPLATES: readonly DeployTemplate[] = [
  {
    id:          'cloudflare-worker',
    name:        'Cloudflare Workers',
    description: 'Free tier, 100,000 requests per day, fastest cold starts.',
    exampleUrl:  'https://stream-proxy.<you>.workers.dev',
    repoPath:    'proxies/cloudflare-worker/',
  },
  {
    id:          'deno-deploy',
    name:        'Deno Deploy',
    description: 'Free tier, deploys straight from a TypeScript file.',
    exampleUrl:  'https://stream-proxy-<you>.deno.dev',
    repoPath:    'proxies/deno-deploy/',
  },
  {
    id:          'vercel-edge',
    name:        'Vercel Edge Functions',
    description: 'Free hobby tier, deploys from any Git repository.',
    exampleUrl:  'https://stream-proxy.vercel.app/api/proxy',
    repoPath:    'proxies/vercel-edge/',
  },
];
