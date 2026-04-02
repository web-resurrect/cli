import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiGet } from '../client.js';
import { printError, formatDate } from '../utils.js';

export function registerCreditsCommand(program: Command): void {
  program
    .command('credits')
    .description('Show your credit balance')
    .action(async () => {
      const spinner = ora('Fetching credit balance...').start();

      try {
        const { data } = await apiGet<{
          credits: number;
          email: string;
          member_since: string;
        }>('/credits');

        spinner.stop();

        console.log(chalk.bold('\nCredit Balance\n'));
        console.log(`  Credits:      ${chalk.green.bold(String(data.credits))}`);
        console.log(`  Email:        ${chalk.cyan(data.email)}`);
        console.log(`  Member since: ${formatDate(data.member_since)}`);
        console.log();
      } catch (error) {
        spinner.fail('Failed to fetch credits');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
