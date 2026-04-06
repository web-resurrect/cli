import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { apiGet, apiPost } from '../client.js';
import { printError } from '../utils.js';

interface RedirectExport {
  format: string;
  count: number;
  redirects: unknown[];
  groups?: unknown[];
}

interface PushResult {
  pushed: number;
  published_urls: number;
  homepage_redirects: number;
  redirect_to: string;
  message: string;
}

export function registerRedirectsCommand(program: Command): void {
  const redirects = program
    .command('redirects')
    .description('Manage URL mappings for a project');

  redirects
    .command('export')
    .description('Export URL mappings to file (only needed for Basic Auth mode)')
    .argument('<project_id>', 'Project ID')
    .option(
      '-f, --format <format>',
      'Output format: redirection (John Godley plugin) or rankmath',
      'redirection',
    )
    .option('-o, --output <path>', 'Save to file (default: redirects-<format>.json)')
    .action(async (projectId: string, opts) => {
      const spinner = ora('Generating redirect file...').start();

      try {
        const { data } = await apiGet<RedirectExport>(
          `/projects/${projectId}/redirects`,
          { format: opts.format },
        );

        spinner.stop();

        if (!data) {
          console.log(chalk.gray('\nNo published pages found.\n'));
          return;
        }

        const filename = opts.output || `redirects-${opts.format}.json`;
        const filepath = resolve(process.cwd(), filename);

        let output: string;
        if (opts.format === 'redirection') {
          output = JSON.stringify(
            { redirects: data.redirects, groups: data.groups },
            null,
            2,
          );
        } else {
          output = JSON.stringify(data.redirects, null, 2);
        }

        writeFileSync(filepath, output, 'utf-8');

        console.log(
          chalk.green(`\n✔ ${data.count} redirects exported to ${chalk.bold(filepath)}\n`),
        );
        console.log(
          chalk.gray(
            opts.format === 'redirection'
              ? 'Import in WordPress: Redirection plugin → Tools → Import → JSON'
              : 'Import in WordPress: Rank Math → Redirections → Import/Export → Import',
          ),
        );
        console.log();
      } catch (error) {
        spinner.fail('Failed to export redirects');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  redirects
    .command('push')
    .description(
      `Push URL redirects to the WordPress plugin (requires plugin mode).

Without --urls: pushes ALL project pages at once.
  - Published pages → served at their original URL
  - Non-published pages → 301 to homepage (or --redirect-to)
  WARNING: replaces all existing redirects. Make sure pages like
  /contact, /mentions-legales are excluded or already published.

With --urls: only redirects the specified URLs (does NOT replace existing).`,
    )
    .argument('<project_id>', 'Project ID')
    .requiredOption('-d, --domain <domain>', 'WordPress domain')
    .option(
      '-u, --urls <urls...>',
      'Specific URL paths to redirect (e.g. /old-page.html /category/sub/)',
    )
    .option(
      '-r, --redirect-to <url>',
      'Custom redirect target (default: homepage)',
    )
    .action(async (projectId: string, opts) => {
      const spinner = ora('Pushing URL mappings to WordPress...').start();

      try {
        const body: Record<string, unknown> = { wordpress_domain: opts.domain };
        if (opts.urls) body.urls = opts.urls;
        if (opts.redirectTo) body.redirect_to = opts.redirectTo;

        const { data } = await apiPost<PushResult>(
          `/projects/${projectId}/redirects/push`,
          body,
        );

        spinner.stop();

        if (!data) {
          console.log(chalk.gray('\nNo pages found.\n'));
          return;
        }

        console.log(chalk.green(`\n✔ ${data.message}\n`));
        if (data.published_urls > 0) {
          console.log(
            `  ${chalk.cyan(String(data.published_urls))} pages served at original URLs`,
          );
        }
        if (data.homepage_redirects > 0) {
          console.log(
            `  ${chalk.yellow(String(data.homepage_redirects))} URLs → ${data.redirect_to || 'homepage'}`,
          );
        }
        console.log();
      } catch (error) {
        spinner.fail('Failed to push redirects');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
