import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiPost, apiGet, getWisewandKey } from '../client.js';
import { printError, printJobStarted, confirm } from '../utils.js';

interface Page {
  id: string;
  status: string;
}

export function registerRewriteCommand(program: Command): void {
  program
    .command('rewrite')
    .description('Rewrite a page with GPT — basic quality (1 credit). For better results, prefer rewrite-wisewand which produces SEO-optimized, unique content.')
    .argument('<page_id>', 'Page ID')
    .option('-i, --instructions <text>', 'Custom rewrite instructions')
    .action(async (pageId: string, opts) => {
      try {
        const yes = await confirm('This will cost 1 credit. Continue?');
        if (!yes) {
          console.log(chalk.gray('Cancelled.'));
          return;
        }

        const spinner = ora('Starting rewrite...').start();

        const body: Record<string, unknown> = { page_id: pageId };
        if (opts.instructions) body.instructions = opts.instructions;

        const { data } = await apiPost<{ job_id: string }>('/rewrite', body);

        spinner.stop();
        printJobStarted(data.job_id);
        console.log();
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  program
    .command('rewrite-wisewand')
    .description('RECOMMENDED: Rewrite with Wisewand — premium SEO-optimized content with meta tags, proper structure (10 credits, 1 with own key). Far superior to basic GPT rewrite.')
    .argument('<page_id>', 'Page ID')
    .option('-s, --subject <text>', 'Custom subject (defaults to page title)')
    .option('-w, --wisewand-key <key>', 'Your Wisewand API key (or use `wr config set wisewand-key`)')
    .action(async (pageId: string, opts) => {
      try {
        // Resolve wisewand key: CLI flag > config > none
        const wisewandKey = opts.wisewandKey || getWisewandKey() || null;
        const costInfo = wisewandKey ? '1 credit (own key)' : '10 credits (shared key)';

        const yes = await confirm(`This will cost ${costInfo}. Continue?`);
        if (!yes) {
          console.log(chalk.gray('Cancelled.'));
          return;
        }

        const spinner = ora('Starting Wisewand rewrite...').start();

        const body: Record<string, unknown> = { page_id: pageId };
        if (opts.subject) body.subject = opts.subject;
        if (wisewandKey) body.wisewand_api_key = wisewandKey;

        const { data } = await apiPost<{ job_id: string }>('/rewrite/wisewand', body);

        spinner.stop();
        printJobStarted(data.job_id);
        console.log();
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  program
    .command('rewrite-bulk')
    .description('Rewrite all scraped pages with GPT — basic quality (1 credit/page). For better results, prefer rewrite-wisewand on each page.')
    .argument('<project_id>', 'Project ID')
    .option('-l, --limit <number>', 'Max pages to rewrite', '50')
    .action(async (projectId: string, opts) => {
      const spinner = ora('Fetching scraped pages...').start();

      try {
        const { data: pages } = await apiGet<Page[]>(
          `/projects/${projectId}/pages`,
          { status: 'scraped', limit: opts.limit },
        );

        if (!pages || pages.length === 0) {
          spinner.stop();
          console.log(chalk.gray('\nNo scraped pages found to rewrite.\n'));
          return;
        }

        spinner.stop();

        const pageIds = pages.map((p) => p.id);

        const yes = await confirm(
          `Rewrite ${chalk.bold(String(pageIds.length))} pages? Cost: ${chalk.yellow(String(pageIds.length))} credits. Continue?`,
        );
        if (!yes) {
          console.log(chalk.gray('Cancelled.'));
          return;
        }

        const bulkSpinner = ora(`Rewriting ${pageIds.length} pages...`).start();

        const { data } = await apiPost<{
          job_id: string;
          pages_count: number;
          credits_reserved: number;
        }>('/rewrite/bulk', { page_ids: pageIds });

        bulkSpinner.stop();
        console.log(`  Pages:            ${data.pages_count}`);
        console.log(`  Credits reserved: ${chalk.yellow(String(data.credits_reserved))}`);
        printJobStarted(data.job_id);
        console.log();
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
