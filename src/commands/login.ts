import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getBaseUrl, setApiKey, getConfig } from '../client.js';
import { printSuccess, printError, promptInput } from '../utils.js';

export function registerLoginCommand(program: Command): void {
  program
    .command('login')
    .description('Authenticate with your Web Resurrect API key')
    .option('-k, --key <api_key>', 'API key (non-interactive mode)')
    .action(async (opts) => {
      let apiKey: string;

      if (opts.key) {
        // Non-interactive: key provided via flag
        apiKey = opts.key;
      } else {
        // Interactive: prompt for key
        console.log(chalk.bold('\nWeb Resurrect CLI Login\n'));
        console.log(
          `Get your API key from ${chalk.cyan('https://web-resurrect.com/dashboard')}\n`,
        );
        apiKey = await promptInput('API Key (wr_live_xxx):', { type: 'password' });
      }

      if (!apiKey.startsWith('wr_live_') && !apiKey.startsWith('wr_test_')) {
        printError('Invalid API key format. Keys start with wr_live_ or wr_test_');
        process.exit(1);
      }

      const spinner = ora('Validating API key...').start();

      try {
        const baseUrl = getBaseUrl();
        const response = await fetch(`${baseUrl}/api/v1/credits`, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          spinner.fail('Invalid API key');
          process.exit(1);
        }

        const json = (await response.json()) as {
          success: boolean;
          data: { credits: number; email: string };
        };

        setApiKey(apiKey);
        spinner.succeed('Authenticated successfully');

        console.log();
        console.log(`  Email:   ${chalk.cyan(json.data.email)}`);
        console.log(`  Credits: ${chalk.green(String(json.data.credits))}`);
        console.log(
          `\n  Config saved to ${chalk.gray(getConfig().path)}`,
        );
        console.log();
      } catch (error) {
        spinner.fail('Failed to validate API key');
        printError(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
