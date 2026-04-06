import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiGet, apiPost } from '../client.js';
import { formatTable, printSuccess, printError, printJobStarted, confirm, promptInput } from '../utils.js';

export function registerWordPressCommand(program: Command): void {
  const wp = program.command('wp').description('WordPress integration');

  wp.command('check')
    .description('Check if WordPress plugin is installed and connected')
    .argument('<domain>', 'WordPress domain')
    .action(async (domain: string) => {
      const spinner = ora(`Checking ${chalk.cyan(domain)}...`).start();

      try {
        const { data } = await apiPost<{
          domain: string;
          plugin_detected: boolean;
          connected: boolean;
          plugin_version: string | null;
          categories: Array<{ id: number; name: string }>;
          authors: Array<{ id: number; name: string }>;
        }>('/wordpress/plugin/check', { domain });

        spinner.stop();

        console.log(chalk.bold('\nWordPress Plugin Status\n'));
        console.log(`  Domain:   ${chalk.cyan(data.domain)}`);
        console.log(
          `  Plugin:   ${data.plugin_detected ? chalk.green('Detected') : chalk.red('Not found')}`,
        );
        console.log(
          `  Connected: ${data.connected ? chalk.green('Yes') : chalk.red('No')}`,
        );
        if (data.plugin_version) {
          console.log(`  Version:  ${data.plugin_version}`);
        }
        if (data.categories?.length) {
          console.log(`  Categories: ${data.categories.length}`);
        }
        if (data.authors?.length) {
          console.log(`  Authors:    ${data.authors.length}`);
        }
        console.log();
      } catch (error) {
        spinner.fail('Check failed');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  wp.command('configure')
    .description('Configure WordPress connection')
    .argument('<site_url>', 'WordPress site URL')
    .option('-m, --mode <mode>', 'Connection mode (plugin or basic_auth)', 'plugin')
    .action(async (siteUrl: string, opts) => {
      try {
        const body: Record<string, unknown> = { site_url: siteUrl };

        if (opts.mode === 'plugin') {
          body.mode = 'plugin';
        } else {
          const username = await promptInput('WordPress username:');
          const appPassword = await promptInput('Application password:', { type: 'password' });
          body.username = username;
          body.app_password = appPassword;
        }

        const spinner = ora('Configuring WordPress...').start();
        await apiPost('/wordpress/credentials', body);
        spinner.stop();

        printSuccess(`WordPress configured for ${chalk.cyan(siteUrl)}`);
        console.log();
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  wp.command('validate')
    .description('Validate WordPress connection')
    .argument('<domain>', 'WordPress domain')
    .action(async (domain: string) => {
      const spinner = ora(`Validating ${chalk.cyan(domain)}...`).start();

      try {
        const { data } = await apiPost<{
          domain: string;
          valid: boolean;
          mode: string;
          message?: string;
        }>('/wordpress/credentials/validate', { domain });

        spinner.stop();

        if (data.valid) {
          printSuccess(`Connection valid (${data.mode} mode)`);
        } else {
          printError(`Connection invalid: ${data.message || 'Unknown error'}`);
        }
        console.log();
      } catch (error) {
        spinner.fail('Validation failed');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  wp.command('categories')
    .description('List WordPress categories')
    .argument('<domain>', 'WordPress domain')
    .action(async (domain: string) => {
      const spinner = ora('Fetching categories...').start();

      try {
        const { data } = await apiGet<{ categories: Array<{ id: number; name: string; slug: string; count?: number }> }>(
          `/wordpress/categories/${domain}`,
        );

        spinner.stop();

        const categories = data?.categories || [];
        if (categories.length === 0) {
          console.log(chalk.gray('\nNo categories found.\n'));
          return;
        }

        console.log(chalk.bold('\nWordPress Categories\n'));

        const headers = ['ID', 'Name', 'Slug', 'Posts'];
        const rows = categories.map((c) => [
          String(c.id),
          c.name,
          c.slug,
          String(c.count ?? '-'),
        ]);

        console.log(formatTable(headers, rows));
        console.log();
      } catch (error) {
        spinner.fail('Failed to fetch categories');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  wp.command('authors')
    .description('List WordPress authors')
    .argument('<domain>', 'WordPress domain')
    .action(async (domain: string) => {
      const spinner = ora('Fetching authors...').start();

      try {
        const { data } = await apiGet<{ authors: Array<{ id: number; name: string; slug?: string }> }>(
          `/wordpress/authors/${domain}`,
        );

        spinner.stop();

        const authors = data?.authors || [];
        if (authors.length === 0) {
          console.log(chalk.gray('\nNo authors found.\n'));
          return;
        }

        console.log(chalk.bold('\nWordPress Authors\n'));

        const headers = ['ID', 'Name', 'Slug'];
        const rows = authors.map((a) => [
          String(a.id),
          a.name,
          a.slug || '-',
        ]);

        console.log(formatTable(headers, rows));
        console.log();
      } catch (error) {
        spinner.fail('Failed to fetch authors');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  wp.command('publish')
    .description('Publish a page to WordPress (free)')
    .argument('<page_id>', 'Page ID')
    .requiredOption('-d, --domain <domain>', 'WordPress domain')
    .option('-c, --category <id>', 'Category ID')
    .option('-a, --author <id>', 'Author ID')
    .option('--status <status>', 'Post status (draft, publish)', 'draft')
    .option('--type <type>', 'Post type (post, page)', 'post')
    .option('--no-rewritten', 'Use original content instead of rewritten')
    .option('--remove-links', 'Remove links from content')
    .action(async (pageId: string, opts) => {
      try {
        const yes = await confirm(
          `Publish page to ${chalk.cyan(opts.domain)} as ${chalk.yellow(opts.status)}?`,
        );
        if (!yes) {
          console.log(chalk.gray('Cancelled.'));
          return;
        }

        const spinner = ora('Publishing to WordPress...').start();

        const body: Record<string, unknown> = {
          page_id: pageId,
          wordpress_domain: opts.domain,
          status: opts.status,
          post_type: opts.type,
          use_rewritten_content: opts.rewritten !== false,
          remove_links: opts.removeLinks || false,
        };
        if (opts.category) body.category_id = parseInt(opts.category, 10);
        if (opts.author) body.author_id = parseInt(opts.author, 10);

        const { data } = await apiPost<{ job_id: string }>('/wordpress/publish', body);

        spinner.stop();
        printJobStarted(data.job_id);
        console.log();
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
