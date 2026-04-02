import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiGet } from '../client.js';
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
  created_at: string;
}

export function registerPagesCommand(program: Command): void {
  const pages = program.command('pages').description('Browse project pages');

  pages
    .command('list')
    .description('List pages for a project')
    .argument('<project_id>', 'Project ID')
    .option('-s, --status <status>', 'Filter by status (pending, scraped, rewritten, published)')
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

        const headers = ['ID', 'URL', 'Status', 'Traffic', 'KW', 'BL', 'Title'];
        const rows = data.map((p) => [
          p.id,
          truncate(p.url, 40),
          statusColor(p.status),
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
        const { data } = await apiGet<Page>(`/pages/${id}`);
        spinner.stop();

        console.log(chalk.bold('\nPage Details\n'));
        console.log(`  ID:        ${data.id}`);
        console.log(`  URL:       ${chalk.cyan(data.url)}`);
        console.log(`  Archive:   ${chalk.gray(data.archive_url || '-')}`);
        console.log(`  Title:     ${data.title || '-'}`);
        console.log(`  Status:    ${statusColor(data.status)}`);
        console.log(`  Scraped:   ${data.is_scraped ? chalk.green('Yes') : chalk.gray('No')}`);
        console.log(`  Rewritten: ${data.is_rewritten ? chalk.green('Yes') : chalk.gray('No')}`);
        console.log(`  Published: ${data.posted_to_wordpress ? chalk.green('Yes') : chalk.gray('No')}`);

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
}
