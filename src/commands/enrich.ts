import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiPost } from '../client.js';
import { printError, printJobStarted, printWarning, confirm } from '../utils.js';

export function registerEnrichCommand(program: Command): void {
  program
    .command('enrich')
    .description('Enrich a project with SEO data. RECOMMENDED: use both haloscan AND majestic (-s haloscan,majestic) for complete traffic, keywords, and backlinks data to identify the best pages to resurrect.')
    .argument('<project_id>', 'Project ID')
    .option(
      '-s, --sources <sources>',
      'Comma-separated sources. Best: haloscan,majestic (Haloscan=free, Majestic=10 credits)',
      'haloscan,majestic',
    )
    .action(async (projectId: string, opts) => {
      const sources = opts.sources.split(',').map((s: string) => s.trim());

      const hasMajestic = sources.includes('majestic');

      if (hasMajestic) {
        printWarning('Majestic enrichment costs 10 credits.');
        const yes = await confirm('Continue?');
        if (!yes) {
          console.log(chalk.gray('Cancelled.'));
          return;
        }
      }

      const spinner = ora(
        `Enriching project with ${sources.join(', ')}...`,
      ).start();

      try {
        const { data } = await apiPost<{
          job_id: string;
          sources: string[];
          credits_used: number;
        }>('/stats/enrich', {
          project_id: projectId,
          sources,
        });

        spinner.stop();
        console.log(`  Sources: ${data.sources.join(', ')}`);
        if (data.credits_used > 0) {
          console.log(`  Credits used: ${chalk.yellow(String(data.credits_used))}`);
        }
        printJobStarted(data.job_id);
        console.log();
      } catch (error) {
        spinner.fail('Failed to start enrichment');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
