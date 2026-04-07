import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiGet, apiPatch } from '../client.js';
import {
  formatTable,
  statusColor,
  formatDate,
  truncate,
  printError,
} from '../utils.js';

interface Page {
  id: string;
  url: string;
  archive_url: string;
  title: string | null;
  status: string;
  is_scraped: boolean;
  is_rewritten: boolean;
  posted_to_wordpress: boolean;
  seo: {
    traffic: number | null;
    keywords: number | null;
    backlinks: number | null;
  };
  featured_image_url: string | null;
  wordpress_category_id: number | null;
  wordpress_category_name: string | null;
  created_at: string;
}

export function registerPagesCommand(program: Command): void {
  const pages = program.command('pages').description('Browse project pages');

  pages
    .command('list')
    .description('List pages for a project')
    .argument('<project_id>', 'Project ID')
    .option('-s, --status <status>', 'Filter by status (pending, scraped, empty, failed, rewritten, published)')
    .option('--has-data <source>', 'Only pages with SEO data (haloscan, majestic, any)')
    .option('--sort <field>', 'Sort by field (created_at, total_traffic, backlinks_count, url, title)')
    .option('--order <dir>', 'Sort order (asc, desc)', 'desc')
    .option('-l, --limit <number>', 'Results per page', '50')
    .option('-p, --page <number>', 'Page number', '1')
    .option('--search <term>', 'Search by URL or title')
    .action(async (projectId: string, opts) => {
      const spinner = ora('Fetching pages...').start();

      try {
        const { data, pagination } = await apiGet<Page[]>(
          `/projects/${projectId}/pages`,
          {
            status: opts.status,
            has_data: opts.hasData,
            sort: opts.sort,
            order: opts.order,
            limit: opts.limit,
            page: opts.page,
            search: opts.search,
          },
        );

        spinner.stop();

        if (!data || data.length === 0) {
          console.log(chalk.gray('\nNo pages found.\n'));
          return;
        }

        console.log(chalk.bold('\nPages\n'));

        const headers = ['ID', 'URL', 'Status', 'Cat', 'Traffic', 'KW', 'BL', 'Title'];
        const rows = data.map((p) => [
          p.id,
          truncate(p.url, 40),
          statusColor(p.status),
          p.wordpress_category_name || (p.wordpress_category_id != null ? String(p.wordpress_category_id) : '-'),
          p.seo?.traffic != null ? String(p.seo.traffic) : '-',
          p.seo?.keywords != null ? String(p.seo.keywords) : '-',
          p.seo?.backlinks != null ? String(p.seo.backlinks) : '-',
          truncate(p.title || '', 30),
        ]);

        console.log(formatTable(headers, rows));

        if (pagination) {
          console.log(
            chalk.gray(
              `\nPage ${pagination.page}/${pagination.totalPages} (${pagination.total} total)`,
            ),
          );
        }
        console.log();
      } catch (error) {
        spinner.fail('Failed to list pages');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  pages
    .command('get')
    .description('Get detailed info for a page')
    .argument('<id>', 'Page ID')
    .action(async (id: string) => {
      const spinner = ora('Fetching page details...').start();

      try {
        const { data } = await apiGet<any>(`/pages/${id}`);
        spinner.stop();

        console.log(chalk.bold('\nPage Details\n'));
        console.log(`  ID:        ${data.id}`);
        console.log(`  URL:       ${chalk.cyan(data.url)}`);
        console.log(`  Archive:   ${chalk.gray(data.archive_url || '-')}`);
        console.log(`  Title:     ${data.title || '-'}`);
        console.log(`  Status:    ${statusColor(data.status)}`);
        console.log(`  Scraped:   ${data.scrape?.is_scraped ? chalk.green('Yes') : chalk.gray('No')}`);
        console.log(`  Rewritten: ${data.rewrite?.is_rewritten ? chalk.green('Yes') : chalk.gray('No')}`);
        console.log(`  Published: ${data.wordpress?.posted ? chalk.green('Yes') : chalk.gray('No')}`);

        const catName = data.wordpress?.category_name;
        const catId = data.wordpress?.category_id;
        if (catName || catId) {
          console.log(`  Category:  ${chalk.cyan(catName || String(catId))}`);
        }

        if (data.seo) {
          console.log(chalk.bold('\n  SEO:'));
          console.log(`    Traffic:   ${data.seo.traffic ?? '-'}`);
          console.log(`    Keywords:  ${data.seo.keywords ?? '-'}`);
          console.log(`    Backlinks: ${data.seo.backlinks ?? '-'}`);
        }

        if (data.featured_image_url) {
          console.log(`\n  Image: ${chalk.cyan(data.featured_image_url)}`);
        }

        console.log(`\n  Created: ${formatDate(data.created_at)}`);
        console.log();
      } catch (error) {
        spinner.fail('Failed to fetch page');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  pages
    .command('update')
    .description('Update a page\'s category and/or author assignment')
    .argument('<id>', 'Page ID')
    .option('-c, --category <id>', 'WordPress category ID (use "null" to clear)')
    .option('-a, --author <id>', 'WordPress author ID (use "null" to clear)')
    .action(async (id: string, opts) => {
      const body: Record<string, unknown> = {};

      if (opts.category !== undefined) {
        body.category_id = opts.category === 'null' ? null : parseInt(opts.category, 10);
      }
      if (opts.author !== undefined) {
        body.author_id = opts.author === 'null' ? null : parseInt(opts.author, 10);
      }

      if (Object.keys(body).length === 0) {
        printError('Provide at least --category or --author');
        process.exit(1);
      }

      const spinner = ora('Updating page...').start();

      try {
        await apiPatch(`/pages/${id}`, body);
        spinner.stop();
        console.log(chalk.green('\n✔ Page updated\n'));
        if (body.category_id !== undefined) {
          console.log(`  Category: ${body.category_id === null ? chalk.gray('cleared') : chalk.cyan(String(body.category_id))}`);
        }
        if (body.author_id !== undefined) {
          console.log(`  Author: ${body.author_id === null ? chalk.gray('cleared') : chalk.yellow(String(body.author_id))}`);
        }
        console.log();
      } catch (error) {
        spinner.fail('Failed to update page');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
