import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiPost, apiGet } from '../client.js';
import { printError, printJobStarted, confirm } from '../utils.js';

interface Page {
  id: string;
  status: string;
}

export function registerScrapeCommand(program: Command): void {
  program
    .command('scrape')
    .description('Scrape an archived page from the Wayback Machine (1 credit). Required first step before rewriting or generating images.')
    .argument('<page_id>', 'Page ID')
    .option('-t, --type <type>', 'Content type (article, product, productList, jina)', 'article')
    .action(async (pageId: string, opts) => {
      try {
        const yes = await confirm('This will cost 1 credit. Continue?');
        if (!yes) {
          console.log(chalk.gray('Cancelled.'));
          return;
        }

        const spinner = ora('Starting scrape...').start();

        const { data } = await apiPost<{
          job_id: string;
          status: string;
          page_id: string;
          credits_used: number;
        }>('/scrape', {
          page_id: pageId,
          content_type: opts.type,
        });

        spinner.stop();
        console.log(`  Credits used: ${chalk.yellow(String(data.credits_used))}`);
        printJobStarted(data.job_id);
        console.log();
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  program
    .command('scrape-bulk')
    .description('Scrape all pending pages in a project (1 credit/page). Required before rewriting or image generation.')
    .argument('<project_id>', 'Project ID')
    .option('-s, --status <status>', 'Filter pages by status', 'pending')
    .option('-l, --limit <number>', 'Max pages to scrape', '50')
    .option('-t, --type <type>', 'Content type', 'article')
    .action(async (projectId: string, opts) => {
      const spinner = ora('Fetching pages...').start();

      try {
        const { data: pages } = await apiGet<Page[]>(
          `/projects/${projectId}/pages`,
          { status: opts.status, limit: opts.limit },
        );

        if (!pages || pages.length === 0) {
          spinner.stop();
          console.log(chalk.gray('\nNo matching pages found.\n'));
          return;
        }

        spinner.stop();

        const pageIds = pages.map((p) => p.id);
        const cost = pageIds.length;

        const yes = await confirm(
          `Scrape ${chalk.bold(String(pageIds.length))} pages? Cost: ${chalk.yellow(String(cost))} credits. Continue?`,
        );
        if (!yes) {
          console.log(chalk.gray('Cancelled.'));
          return;
        }

        const bulkSpinner = ora(`Scraping ${pageIds.length} pages...`).start();

        const { data } = await apiPost<{
          job_id: string;
          pages_count: number;
          credits_reserved: number;
        }>('/scrape/bulk', {
          page_ids: pageIds,
          content_type: opts.type,
        });

        bulkSpinner.stop();
        console.log(`  Pages:           ${data.pages_count}`);
        console.log(`  Credits reserved: ${chalk.yellow(String(data.credits_reserved))}`);
        printJobStarted(data.job_id);
        console.log();
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
