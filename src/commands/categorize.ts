import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiGet, apiPost } from '../client.js';
import { formatTable, printSuccess, printError, confirm } from '../utils.js';

interface CategorySuggestion {
  page_id: string;
  suggested_category: {
    id: number;
    name: string;
    slug: string;
    confidence: number;
  } | null;
  message?: string;
}

interface Page {
  id: string;
  url: string;
  title: string | null;
  status: string;
}

export function registerCategorizeCommand(program: Command): void {
  program
    .command('categorize')
    .description('AI-suggest WordPress categories for 1–50 pages (free)')
    .argument('<page_ids...>', 'Page IDs (1 to 50)')
    .requiredOption('-d, --domain <domain>', 'WordPress domain')
    .action(async (pageIds: string[], opts) => {
      if (pageIds.length > 50) {
        printError('Maximum 50 pages per batch');
        process.exit(1);
      }

      const spinner = ora(`Categorizing ${pageIds.length} page(s)...`).start();

      try {
        const { data } = await apiPost<{
          wordpress_domain: string;
          total: number;
          categorized: number;
          suggestions: CategorySuggestion[];
        }>('/categorize/bulk', {
          page_ids: pageIds,
          wordpress_domain: opts.domain,
        });

        spinner.stop();

        printSuccess(`${data.categorized}/${data.total} pages categorized`);
        console.log();

        for (const s of data.suggestions) {
          const pageShort = s.page_id.slice(0, 8);
          if (s.suggested_category) {
            const confidence = Math.round(s.suggested_category.confidence * 100);
            console.log(
              `  ${chalk.gray(pageShort)}  ${chalk.cyan(s.suggested_category.name)} ${chalk.gray(`(${s.suggested_category.slug}, ${confidence}%)`)}`,
            );
          } else {
            console.log(
              `  ${chalk.gray(pageShort)}  ${chalk.yellow('No suggestion')}${s.message ? chalk.gray(` — ${s.message}`) : ''}`,
            );
          }
        }
        console.log();
      } catch (error) {
        spinner.fail('Failed to categorize');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  program
    .command('categorize-bulk')
    .description(
      'AI-categorize all pages in a project by batch of 50 (free). Saves category to each page.',
    )
    .argument('<project_id>', 'Project ID')
    .requiredOption('-d, --domain <domain>', 'WordPress domain')
    .option(
      '-s, --status <status>',
      'Filter pages by status: scraped (default) or rewritten',
      'scraped',
    )
    .option('--has-data <source>', 'Only pages with SEO data (haloscan, majestic, any)')
    .option('-l, --limit <number>', 'Max pages to categorize', '500')
    .action(async (projectId: string, opts) => {
      const spinner = ora('Fetching pages...').start();

      try {
        // Fetch all matching pages (paginate to get all)
        const allPages: Page[] = [];
        let page = 1;
        const perPage = 50;
        const maxPages = parseInt(opts.limit, 10);

        while (allPages.length < maxPages) {
          const { data: pages, pagination } = await apiGet<Page[]>(
            `/projects/${projectId}/pages`,
            {
              status: opts.status,
              has_data: opts.hasData,
              limit: perPage,
              page,
            },
          );

          if (!pages || pages.length === 0) break;
          allPages.push(...pages);
          if (!pagination?.hasMore) break;
          page++;
        }

        // Trim to limit
        const pagesToCategorize = allPages.slice(0, maxPages);

        spinner.stop();

        if (pagesToCategorize.length === 0) {
          console.log(chalk.gray(`\nNo pages with status "${opts.status}" found.\n`));
          return;
        }

        const yes = await confirm(
          `Categorize ${chalk.bold(String(pagesToCategorize.length))} pages on ${chalk.cyan(opts.domain)}? (free)`,
        );
        if (!yes) {
          console.log(chalk.gray('Cancelled.'));
          return;
        }

        // Process in batches of 50
        const BATCH_SIZE = 50;
        let totalCategorized = 0;
        let totalFailed = 0;
        const allSuggestions: CategorySuggestion[] = [];

        for (let i = 0; i < pagesToCategorize.length; i += BATCH_SIZE) {
          const batch = pagesToCategorize.slice(i, i + BATCH_SIZE);
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(pagesToCategorize.length / BATCH_SIZE);

          const batchSpinner = ora(
            `Batch ${batchNum}/${totalBatches}: categorizing ${batch.length} pages...`,
          ).start();

          try {
            const { data } = await apiPost<{
              total: number;
              categorized: number;
              suggestions: CategorySuggestion[];
            }>('/categorize/bulk', {
              page_ids: batch.map((p) => p.id),
              wordpress_domain: opts.domain,
            });

            totalCategorized += data.categorized;
            totalFailed += data.total - data.categorized;
            allSuggestions.push(...data.suggestions);

            batchSpinner.succeed(
              `Batch ${batchNum}/${totalBatches}: ${data.categorized}/${data.total} categorized`,
            );
          } catch (error) {
            totalFailed += batch.length;
            batchSpinner.fail(
              `Batch ${batchNum}/${totalBatches}: failed — ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        // Summary
        console.log(
          chalk.bold(`\n✔ ${totalCategorized} categorized, ${totalFailed} failed\n`),
        );

        // Show results table
        if (allSuggestions.length > 0) {
          const headers = ['Page ID', 'Category', 'Confidence'];
          const rows = allSuggestions.map((s) => [
            s.page_id.slice(0, 8),
            s.suggested_category
              ? s.suggested_category.name
              : chalk.yellow('none'),
            s.suggested_category
              ? `${Math.round(s.suggested_category.confidence * 100)}%`
              : '-',
          ]);
          console.log(formatTable(headers, rows));
        }
        console.log();
      } catch (error) {
        spinner.fail('Failed to categorize');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
