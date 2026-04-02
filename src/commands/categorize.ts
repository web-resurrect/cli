import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiPost } from '../client.js';
import { printSuccess, printError } from '../utils.js';

export function registerCategorizeCommand(program: Command): void {
  program
    .command('categorize')
    .description('Suggest a WordPress category for a page (free)')
    .argument('<page_id>', 'Page ID')
    .requiredOption('-d, --domain <domain>', 'WordPress domain')
    .action(async (pageId: string, opts) => {
      const spinner = ora('Categorizing page...').start();

      try {
        const { data } = await apiPost<{
          page_id: string;
          suggested_category: {
            id: number;
            name: string;
            slug: string;
            confidence: number;
          } | null;
        }>('/categorize', {
          page_id: pageId,
          wordpress_domain: opts.domain,
        });

        spinner.stop();

        if (data.suggested_category) {
          printSuccess('Category suggested:');
          console.log(`  Name:       ${chalk.cyan(data.suggested_category.name)}`);
          console.log(`  Slug:       ${data.suggested_category.slug}`);
          console.log(`  ID:         ${data.suggested_category.id}`);
          console.log(
            `  Confidence: ${chalk.green(
              `${Math.round(data.suggested_category.confidence * 100)}%`,
            )}`,
          );
        } else {
          console.log(chalk.yellow('\nNo category suggestion available.'));
        }
        console.log();
      } catch (error) {
        spinner.fail('Failed to categorize');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
