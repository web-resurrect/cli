import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiPost, apiGet, getWisewandKey } from '../client.js';
import { printError, printJobStarted, confirm } from '../utils.js';

interface Page {
  id: string;
  status: string;
}

function resolveWisewandKey(opts: { wisewandKey?: string }): string | null {
  return opts.wisewandKey || getWisewandKey() || null;
}

function getRewriteCostInfo(wisewand: boolean, wisewandKey: string | null): string {
  if (!wisewand) return '1 credit';
  return wisewandKey ? '1 credit (own Wisewand key)' : '10 credits (shared Wisewand key)';
}

export function registerRewriteCommand(program: Command): void {
  program
    .command('rewrite')
    .description('Rewrite a page. Use --wisewand for premium SEO-optimized content (recommended).')
    .argument('<page_id>', 'Page ID')
    .option('--wisewand', 'Use Wisewand for premium SEO-optimized rewrite (10 credits, 1 with own key)')
    .option('-w, --wisewand-key <key>', 'Your Wisewand API key (implies --wisewand). Or use `wr config set wisewand-key`')
    .option('-i, --instructions <text>', 'Custom rewrite instructions (basic mode only)')
    .option('-s, --subject <text>', 'Custom subject (Wisewand mode only)')
    .action(async (pageId: string, opts) => {
      try {
        const useWisewand = opts.wisewand || !!opts.wisewandKey;
        const wisewandKey = useWisewand ? resolveWisewandKey(opts) : null;
        const costInfo = getRewriteCostInfo(useWisewand, wisewandKey);

        const yes = await confirm(`This will cost ${costInfo}. Continue?`);
        if (!yes) {
          console.log(chalk.gray('Cancelled.'));
          return;
        }

        const label = useWisewand ? 'Wisewand rewrite' : 'rewrite';
        const spinner = ora(`Starting ${label}...`).start();

        if (useWisewand) {
          const body: Record<string, unknown> = { page_id: pageId };
          if (opts.subject) body.subject = opts.subject;
          if (wisewandKey) body.wisewand_api_key = wisewandKey;

          const { data } = await apiPost<{ job_id: string }>('/rewrite/wisewand', body);
          spinner.stop();
          printJobStarted(data.job_id);
        } else {
          const body: Record<string, unknown> = { page_id: pageId };
          if (opts.instructions) body.instructions = opts.instructions;

          const { data } = await apiPost<{ job_id: string }>('/rewrite', body);
          spinner.stop();
          printJobStarted(data.job_id);
        }

        console.log();
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  program
    .command('rewrite-bulk')
    .description('Rewrite all scraped pages. Use --wisewand for premium SEO-optimized content.')
    .argument('<project_id>', 'Project ID')
    .option('--wisewand', 'Use Wisewand for premium SEO-optimized rewrite (10 credits/page, 1 with own key)')
    .option('-w, --wisewand-key <key>', 'Your Wisewand API key (implies --wisewand). Or use `wr config set wisewand-key`')
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

        const useWisewand = opts.wisewand || !!opts.wisewandKey;
        const wisewandKey = useWisewand ? resolveWisewandKey(opts) : null;
        const count = pages.length;
        const creditsPer = useWisewand ? (wisewandKey ? 1 : 10) : 1;
        const totalCredits = count * creditsPer;

        const modeLabel = useWisewand ? 'Wisewand' : 'GPT';
        const yes = await confirm(
          `Rewrite ${chalk.bold(String(count))} pages with ${modeLabel}? Cost: ${chalk.yellow(String(totalCredits))} credits. Continue?`,
        );
        if (!yes) {
          console.log(chalk.gray('Cancelled.'));
          return;
        }

        const bulkSpinner = ora(`Rewriting ${count} pages with ${modeLabel}...`).start();

        const body: Record<string, unknown> = { page_ids: pages.map((p) => p.id) };
        if (useWisewand) {
          body.engine = 'wisewand';
          if (wisewandKey) body.wisewand_api_key = wisewandKey;
        }

        const { data } = await apiPost<{
          job_id: string;
          pages_count: number;
          credits_reserved: number;
        }>('/rewrite/bulk', body);

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
