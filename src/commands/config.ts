import { Command } from 'commander';
import chalk from 'chalk';
import { getConfig, getWisewandKey, setWisewandKey } from '../client.js';

const KNOWN_KEYS: Record<string, { get: () => string; set: (v: string) => void; description: string }> = {
  'wisewand-key': {
    get: getWisewandKey,
    set: setWisewandKey,
    description: 'Your Wisewand API key (reduces rewrite cost to 1 credit)',
  },
};

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command('config')
    .description('Manage CLI configuration');

  configCmd
    .command('set')
    .description('Set a config value')
    .argument('<key>', `Config key (${Object.keys(KNOWN_KEYS).join(', ')})`)
    .argument('<value>', 'Value to set')
    .action((key: string, value: string) => {
      const entry = KNOWN_KEYS[key];
      if (!entry) {
        console.error(chalk.red(`Unknown config key: ${key}`));
        console.log(chalk.gray(`Available keys: ${Object.keys(KNOWN_KEYS).join(', ')}`));
        process.exit(1);
      }
      entry.set(value);
      console.log(chalk.green(`${key} saved.`));
    });

  configCmd
    .command('get')
    .description('Get a config value')
    .argument('<key>', `Config key (${Object.keys(KNOWN_KEYS).join(', ')})`)
    .action((key: string) => {
      const entry = KNOWN_KEYS[key];
      if (!entry) {
        console.error(chalk.red(`Unknown config key: ${key}`));
        console.log(chalk.gray(`Available keys: ${Object.keys(KNOWN_KEYS).join(', ')}`));
        process.exit(1);
      }
      const value = entry.get();
      if (value) {
        // Mask all but last 4 chars for secrets
        const masked = value.length > 8
          ? '•'.repeat(value.length - 4) + value.slice(-4)
          : value;
        console.log(`${key}: ${masked}`);
      } else {
        console.log(chalk.gray(`${key}: (not set)`));
      }
    });

  configCmd
    .command('delete')
    .description('Remove a config value')
    .argument('<key>', `Config key (${Object.keys(KNOWN_KEYS).join(', ')})`)
    .action((key: string) => {
      const entry = KNOWN_KEYS[key];
      if (!entry) {
        console.error(chalk.red(`Unknown config key: ${key}`));
        process.exit(1);
      }
      entry.set('');
      console.log(chalk.green(`${key} removed.`));
    });

  configCmd
    .command('list')
    .description('List all config keys and their status')
    .action(() => {
      console.log(chalk.bold('\nConfiguration:\n'));
      for (const [key, entry] of Object.entries(KNOWN_KEYS)) {
        const value = entry.get();
        const status = value ? chalk.green('set') : chalk.gray('not set');
        console.log(`  ${key.padEnd(20)} ${status}  ${chalk.gray(entry.description)}`);
      }
      console.log();
    });
}
