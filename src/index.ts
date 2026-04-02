#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { registerLoginCommand } from './commands/login.js';
import { registerCreditsCommand } from './commands/credits.js';
import { registerProjectsCommand } from './commands/projects.js';
import { registerPagesCommand } from './commands/pages.js';
import { registerScrapeCommand } from './commands/scrape.js';
import { registerEnrichCommand } from './commands/enrich.js';
import { registerRewriteCommand } from './commands/rewrite.js';
import { registerImageCommand } from './commands/image.js';
import { registerCategorizeCommand } from './commands/categorize.js';
import { registerWordPressCommand } from './commands/wordpress.js';
import { registerJobsCommand } from './commands/jobs.js';
import { registerConfigCommand } from './commands/config.js';
import { setRuntimeBaseUrl } from './client.js';

const program = new Command();

program
  .name('wr')
  .description(`Web Resurrect CLI - Resurrect expired domains from the command line.

Recommended workflow:
  1. wr projects create <domain>     Create project (auto-fetches archived URLs)
  2. wr enrich <project_id>          Enrich with SEO data (use haloscan,majestic for best results)
  3. wr pages <project_id> --sort total_traffic  Pick the best pages to resurrect
  4. wr scrape <page_id>             Scrape archived content (required before rewrite)
  5. wr rewrite-wisewand <page_id>   Rewrite with Wisewand (RECOMMENDED over basic rewrite)
  6. wr image <page_id>              Generate featured image (always do this)
  7. wr wp publish <page_id> ...     Publish to WordPress`)
  .version('1.0.0')
  .enablePositionalOptions()
  .passThroughOptions()
  .option('-y, --yes', 'Skip all confirmation prompts (non-interactive mode)')
  .option('--base-url <url>', 'Override API base URL')
  .option('--json', 'Output raw JSON (machine-readable)')
  .hook('preAction', (_thisCommand, actionCommand) => {
    // Propagate global options to all commands
    const root = actionCommand.optsWithGlobals();
    if (root.baseUrl) {
      setRuntimeBaseUrl(root.baseUrl);
    }
    // Store global flags for utils to read
    global.__wrAutoYes = !!root.yes;
    global.__wrJsonOutput = !!root.json;
  });

registerLoginCommand(program);
registerCreditsCommand(program);
registerProjectsCommand(program);
registerPagesCommand(program);
registerScrapeCommand(program);
registerEnrichCommand(program);
registerRewriteCommand(program);
registerImageCommand(program);
registerCategorizeCommand(program);
registerWordPressCommand(program);
registerJobsCommand(program);
registerConfigCommand(program);

program.parseAsync(process.argv).catch((error) => {
  console.error(chalk.red(`\nError: ${error.message}\n`));
  process.exit(1);
});
