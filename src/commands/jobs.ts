import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiGet, apiPost } from '../client.js';
import {
  formatTable,
  statusColor,
  formatDate,
  truncate,
  printSuccess,
  printError,
  printWarning,
  confirm,
} from '../utils.js';

interface Job {
  id: string;
  type: string;
  status: string;
  progress: {
    total: number;
    processed: number;
    failed: number;
    percentage: number;
  } | null;
  credits: {
    reserved: number;
    used: number;
    refunded: number;
  };
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export function registerJobsCommand(program: Command): void {
  const jobs = program.command('jobs').description('Track async operations');

  jobs
    .command('list')
    .description('List jobs')
    .option('-s, --status <status>', 'Filter by status (pending, processing, completed, failed)')
    .option('-t, --type <type>', 'Filter by type (scrape, rewrite, publish, enrich)')
    .option('-l, --limit <number>', 'Results per page', '20')
    .option('-p, --page <number>', 'Page number', '1')
    .action(async (opts) => {
      const spinner = ora('Fetching jobs...').start();

      try {
        const { data, pagination } = await apiGet<Job[]>('/jobs', {
          status: opts.status,
          type: opts.type,
          limit: opts.limit,
          page: opts.page,
        });

        spinner.stop();

        if (!data || data.length === 0) {
          console.log(chalk.gray('\nNo jobs found.\n'));
          return;
        }

        console.log(chalk.bold('\nJobs\n'));

        const headers = ['ID', 'Type', 'Status', 'Progress', 'Credits', 'Created'];
        const rows = data.map((j) => [
          j.id,
          j.type,
          statusColor(j.status),
          j.progress ? `${j.progress.percentage}%` : '-',
          String(j.credits?.used ?? 0),
          formatDate(j.created_at),
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
        spinner.fail('Failed to list jobs');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  jobs
    .command('get')
    .description('Get job details')
    .argument('<id>', 'Job ID')
    .action(async (id: string) => {
      const spinner = ora('Fetching job...').start();

      try {
        const { data } = await apiGet<Job>(`/jobs/${id}`);
        spinner.stop();

        console.log(chalk.bold('\nJob Details\n'));
        console.log(`  ID:        ${data.id}`);
        console.log(`  Type:      ${data.type}`);
        console.log(`  Status:    ${statusColor(data.status)}`);

        if (data.progress) {
          console.log(
            `  Progress:  ${progressBar(data.progress.percentage)} ${data.progress.processed}/${data.progress.total}`,
          );
          if (data.progress.failed > 0) {
            console.log(`  Failed:    ${chalk.red(String(data.progress.failed))}`);
          }
        }

        if (data.credits) {
          console.log(chalk.bold('\n  Credits:'));
          console.log(`    Reserved: ${data.credits.reserved}`);
          console.log(`    Used:     ${data.credits.used}`);
          if (data.credits.refunded > 0) {
            console.log(`    Refunded: ${chalk.green(String(data.credits.refunded))}`);
          }
        }

        if (data.error) {
          console.log(`\n  Error: ${chalk.red(data.error)}`);
        }

        console.log(`\n  Created:   ${formatDate(data.created_at)}`);
        if (data.started_at) console.log(`  Started:   ${formatDate(data.started_at)}`);
        if (data.completed_at) console.log(`  Completed: ${formatDate(data.completed_at)}`);
        console.log();
      } catch (error) {
        spinner.fail('Failed to fetch job');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  jobs
    .command('cancel')
    .description('Cancel a pending or processing job')
    .argument('<id>', 'Job ID')
    .action(async (id: string) => {
      try {
        const yes = await confirm(`Cancel job ${chalk.bold(id)}?`);
        if (!yes) {
          console.log(chalk.gray('Cancelled.'));
          return;
        }

        const spinner = ora('Cancelling job...').start();
        await apiPost(`/jobs/${id}/cancel`);
        spinner.stop();
        printSuccess('Job cancelled.');
        console.log();
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  jobs
    .command('wait')
    .description('Wait for a job to complete (polls every 3s)')
    .argument('<id>', 'Job ID')
    .option('--timeout <seconds>', 'Timeout in seconds', '300')
    .action(async (id: string, opts) => {
      const timeout = parseInt(opts.timeout, 10) * 1000;
      const start = Date.now();
      const spinner = ora('Waiting for job to complete...').start();

      try {
        while (true) {
          const { data } = await apiGet<Job>(`/jobs/${id}`);

          if (data.progress) {
            spinner.text = `${statusColor(data.status)} ${progressBar(data.progress.percentage)} ${data.progress.percentage}% (${data.progress.processed}/${data.progress.total})`;
          } else {
            spinner.text = `Status: ${statusColor(data.status)}`;
          }

          if (data.status === 'completed') {
            spinner.succeed('Job completed!');
            if (data.credits) {
              console.log(`  Credits used: ${chalk.yellow(String(data.credits.used))}`);
            }
            if (data.progress && data.progress.failed > 0) {
              printWarning(`${data.progress.failed} items failed`);
            }
            console.log();
            return;
          }

          if (data.status === 'failed') {
            spinner.fail('Job failed');
            if (data.error) {
              printError(data.error);
            }
            process.exit(1);
          }

          if (data.status === 'cancelled') {
            spinner.warn('Job was cancelled');
            process.exit(0);
          }

          if (Date.now() - start > timeout) {
            spinner.warn('Timeout reached');
            printWarning(`Job still ${data.status}. Check with: wr jobs get ${id}`);
            process.exit(1);
          }

          await sleep(3000);
        }
      } catch (error) {
        spinner.fail('Failed to poll job');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}

function progressBar(percentage: number): string {
  const width = 20;
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return chalk.green('\u2588'.repeat(filled)) + chalk.gray('\u2591'.repeat(empty));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
