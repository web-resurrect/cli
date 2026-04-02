import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiGet, apiPost, apiDelete } from '../client.js';
import {
  formatTable,
  formatDate,
  truncate,
  printSuccess,
  printError,
  printJobStarted,
  confirm,
} from '../utils.js';

interface Project {
  id: string;
  domain: string;
  name: string;
  created_at: string;
  pages_count?: number;
  stats?: {
    total: number;
    pending: number;
    scraped: number;
    rewritten: number;
    published: number;
  };
}

export function registerProjectsCommand(program: Command): void {
  const projects = program
    .command('projects')
    .description('Manage resurrection projects');

  projects
    .command('list')
    .description('List all projects')
    .option('-p, --page <number>', 'Page number', '1')
    .option('-l, --limit <number>', 'Results per page', '20')
    .action(async (opts) => {
      const spinner = ora('Fetching projects...').start();

      try {
        const { data, pagination } = await apiGet<Project[]>('/projects', {
          page: opts.page,
          limit: opts.limit,
        });

        spinner.stop();

        if (!data || data.length === 0) {
          console.log(chalk.gray('\nNo projects found.\n'));
          return;
        }

        console.log(chalk.bold('\nProjects\n'));

        const headers = ['ID', 'Domain', 'Name', 'Pages', 'Created'];
        const rows = data.map((p) => [
          p.id,
          chalk.cyan(p.domain),
          truncate(p.name || p.domain, 30),
          String(p.pages_count ?? '-'),
          formatDate(p.created_at),
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
        spinner.fail('Failed to list projects');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  projects
    .command('create')
    .description('Create a new project (auto-fetches archived URLs)')
    .argument('<domain>', 'Expired domain to analyze')
    .option('-n, --name <name>', 'Project name (defaults to domain)')
    .action(async (domain: string, opts) => {
      const spinner = ora(`Creating project for ${chalk.cyan(domain)}...`).start();

      try {
        const body: Record<string, unknown> = { domain };
        if (opts.name) body.name = opts.name;

        const { data } = await apiPost<{
          project_id: string;
          domain: string;
          name: string;
          job_id: string;
        }>('/projects', body);

        spinner.succeed(`Project created: ${chalk.bold(data.project_id)}`);
        console.log(`  Domain: ${chalk.cyan(data.domain)}`);
        console.log(`  Name:   ${data.name}`);
        console.log();
        printJobStarted(data.job_id);
        console.log();
      } catch (error) {
        spinner.fail('Failed to create project');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  projects
    .command('get')
    .description('Get project details and stats')
    .argument('<id>', 'Project ID')
    .action(async (id: string) => {
      const spinner = ora('Fetching project details...').start();

      try {
        const { data } = await apiGet<Project>(`/projects/${id}`);
        spinner.stop();

        console.log(chalk.bold('\nProject Details\n'));
        console.log(`  ID:      ${data.id}`);
        console.log(`  Domain:  ${chalk.cyan(data.domain)}`);
        console.log(`  Name:    ${data.name}`);
        console.log(`  Created: ${formatDate(data.created_at)}`);

        if (data.stats) {
          console.log(chalk.bold('\n  Stats:'));
          console.log(`    Total:     ${data.stats.total}`);
          console.log(`    Pending:   ${chalk.yellow(String(data.stats.pending))}`);
          console.log(`    Scraped:   ${chalk.blue(String(data.stats.scraped))}`);
          console.log(`    Rewritten: ${chalk.magenta(String(data.stats.rewritten))}`);
          console.log(`    Published: ${chalk.green(String(data.stats.published))}`);
        }
        console.log();
      } catch (error) {
        spinner.fail('Failed to fetch project');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  projects
    .command('delete')
    .description('Delete a project and all its pages')
    .argument('<id>', 'Project ID')
    .action(async (id: string) => {
      try {
        const yes = await confirm(
          `Delete project ${chalk.bold(id)} and all its pages? This cannot be undone.`,
        );

        if (!yes) {
          console.log(chalk.gray('Cancelled.'));
          return;
        }

        const spinner = ora('Deleting project...').start();
        await apiDelete(`/projects/${id}`);
        spinner.stop();
        printSuccess('Project deleted.');
        console.log();
      } catch (error) {
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
