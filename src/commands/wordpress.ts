import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiGet, apiPost, apiPut } from '../client.js';
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

  wp.command('mapping')
    .description('Show current category-to-author mapping for a WordPress domain')
    .argument('<domain>', 'WordPress domain')
    .action(async (domain: string) => {
      const spinner = ora('Fetching mapping...').start();

      try {
        const { data } = await apiGet<{
          mappings: Array<{ category_id: number; author_id: number }>;
          default_author_id: number | null;
          default_category_id: number | null;
        }>(`/wordpress/mapping/${domain}`);

        spinner.stop();

        if (!data) {
          console.log(chalk.gray('\nNo mapping configured.\n'));
          return;
        }

        console.log(chalk.bold('\nCategory-Author Mapping\n'));

        const mappings = data.mappings || [];
        if (mappings.length > 0) {
          const headers = ['Category ID', 'Author ID'];
          const rows = mappings.map((m) => [String(m.category_id), String(m.author_id)]);
          console.log(formatTable(headers, rows));
        } else {
          console.log(chalk.gray('  No category-author mappings configured.'));
        }

        console.log(`\n  Default author: ${data.default_author_id ?? chalk.gray('none')}`);
        console.log(`  Default category: ${data.default_category_id ?? chalk.gray('none')}\n`);
      } catch (error) {
        spinner.fail('Failed to fetch mapping');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  wp.command('set-mapping')
    .description(
      `Configure category-to-author mapping. MUST be done before categorizing pages.

Example: wr wp set-mapping example.com --map 5:3 --map 7:2 --default-author 3
This maps category 5 → author 3, category 7 → author 2, default author = 3.`,
    )
    .argument('<domain>', 'WordPress domain')
    .option('-m, --map <mapping...>', 'Category-author pairs as category_id:author_id (e.g. 5:3 7:2)')
    .option('--default-author <id>', 'Default author ID')
    .option('--default-category <id>', 'Default category ID')
    .action(async (domain: string, opts) => {
      const mappings: Array<{ category_id: number; author_id: number }> = [];

      if (opts.map) {
        for (const pair of opts.map) {
          const [catId, authId] = pair.split(':').map(Number);
          if (!catId || !authId) {
            printError(`Invalid mapping format: ${pair}. Use category_id:author_id (e.g. 5:3)`);
            process.exit(1);
          }
          mappings.push({ category_id: catId, author_id: authId });
        }
      }

      const spinner = ora('Saving mapping...').start();

      try {
        const body: Record<string, unknown> = { mappings };
        if (opts.defaultAuthor) body.default_author_id = parseInt(opts.defaultAuthor, 10);
        if (opts.defaultCategory) body.default_category_id = parseInt(opts.defaultCategory, 10);

        await apiPut(`/wordpress/mapping/${domain}`, body);

        spinner.stop();
        console.log(chalk.green(`\n✔ Mapping saved for ${chalk.bold(domain)}\n`));
        if (mappings.length > 0) {
          mappings.forEach((m) => {
            console.log(`  Category ${chalk.cyan(String(m.category_id))} → Author ${chalk.yellow(String(m.author_id))}`);
          });
        }
        if (opts.defaultAuthor) console.log(`  Default author: ${chalk.yellow(opts.defaultAuthor)}`);
        if (opts.defaultCategory) console.log(`  Default category: ${chalk.cyan(opts.defaultCategory)}`);
        console.log();
      } catch (error) {
        spinner.fail('Failed to save mapping');
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

  wp.command('publish-bulk')
    .description('Publish multiple pages to WordPress at once (free). Author auto-resolved from category-author mapping.')
    .argument('<page_ids...>', 'Page IDs to publish')
    .requiredOption('-d, --domain <domain>', 'WordPress domain')
    .option('-c, --category <id>', 'Category ID (overrides page categories)')
    .option('-a, --author <id>', 'Author ID (overrides mapping)')
    .option('--status <status>', 'Post status (draft, publish)', 'draft')
    .option('--type <type>', 'Post type (post, page)', 'post')
    .option('--no-rewritten', 'Use original content instead of rewritten')
    .option('--remove-links', 'Remove links from content')
    .action(async (pageIds: string[], opts) => {
      try {
        const yes = await confirm(
          `Publish ${chalk.bold(String(pageIds.length))} pages to ${chalk.cyan(opts.domain)} as ${chalk.yellow(opts.status)}?`,
        );
        if (!yes) {
          console.log(chalk.gray('Cancelled.'));
          return;
        }

        const spinner = ora(`Publishing ${pageIds.length} pages to WordPress...`).start();

        const body: Record<string, unknown> = {
          page_ids: pageIds,
          wordpress_domain: opts.domain,
          status: opts.status,
          post_type: opts.type,
          use_rewritten_content: opts.rewritten !== false,
          remove_links: opts.removeLinks || false,
        };
        if (opts.category) body.category_id = parseInt(opts.category, 10);
        if (opts.author) body.author_id = parseInt(opts.author, 10);

        const { data } = await apiPost<{ job_id: string; total_items: number }>(
          '/wordpress/publish/bulk',
          body,
        );

        spinner.stop();
        printJobStarted(data.job_id);
        console.log(chalk.gray(`  ${data.total_items} pages queued for publishing\n`));
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
