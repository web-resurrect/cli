import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiPost, apiGet } from '../client.js';
import { printError, printJobStarted, confirm } from '../utils.js';

interface Page {
  id: string;
  status: string;
  featured_image_url: string | null;
}

export function registerImageCommand(program: Command): void {
  program
    .command('image')
    .description('Generate an AI featured image for a page (1 credit). Always generate an image after rewriting — pages without images look incomplete on WordPress.')
    .argument('<page_id>', 'Page ID')
    .action(async (pageId: string) => {
      try {
        const yes = await confirm('This will cost 1 credit. Continue?');
        if (!yes) {
          console.log(chalk.gray('Cancelled.'));
          return;
        }

        const spinner = ora('Generating image...').start();

        const { data } = await apiPost<{ job_id: string }>('/generate-image', {
          page_id: pageId,
        });

        spinner.stop();
        printJobStarted(data.job_id);
        console.log();
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  program
    .command('image-bulk')
    .description('Generate featured images for all rewritten pages (1 credit/page). Always generate images — pages without them look incomplete on WordPress.')
    .argument('<project_id>', 'Project ID')
    .option('-l, --limit <number>', 'Max pages', '50')
    .action(async (projectId: string, opts) => {
      const spinner = ora('Fetching pages without images...').start();

      try {
        const { data: pages } = await apiGet<Page[]>(
          `/projects/${projectId}/pages`,
          { status: 'rewritten', limit: opts.limit },
        );

        if (!pages || pages.length === 0) {
          spinner.stop();
          console.log(chalk.gray('\nNo rewritten pages found.\n'));
          return;
        }

        const needsImage = pages.filter((p) => !p.featured_image_url);
        if (needsImage.length === 0) {
          spinner.stop();
          console.log(chalk.gray('\nAll rewritten pages already have images.\n'));
          return;
        }

        spinner.stop();

        const pageIds = needsImage.map((p) => p.id);

        const yes = await confirm(
          `Generate images for ${chalk.bold(String(pageIds.length))} pages? Cost: ${chalk.yellow(String(pageIds.length))} credits. Continue?`,
        );
        if (!yes) {
          console.log(chalk.gray('Cancelled.'));
          return;
        }

        const bulkSpinner = ora(`Generating ${pageIds.length} images...`).start();

        const { data } = await apiPost<{
          job_id: string;
          pages_count: number;
          credits_reserved: number;
        }>('/generate-image/bulk', { page_ids: pageIds });

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
