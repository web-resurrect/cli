import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiPost } from '../client.js';
import { printSuccess, printError } from '../utils.js';

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
}
