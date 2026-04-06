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
import { registerRedirectsCommand } from './commands/redirects.js';
import { registerConfigCommand } from './commands/config.js';
import { setRuntimeBaseUrl } from './client.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const program = new Command();

program
  .name('wr')
  .description(`Web Resurrect CLI - Resurrect expired domains from the command line.

Workflow — from expired domain to live WordPress site:

  1. CREATE PROJECT
     wr projects create <domain>
     Auto-fetches all archived URLs from the Wayback Machine.
     Check the retrieved pages: wr pages list <project_id>

  2. ENRICH WITH SEO DATA
     wr enrich <project_id> -s haloscan,majestic
     Always use both sources for the best results:
     - Haloscan: traffic estimates and keyword data (free)
     - Majestic: backlink data (10 credits)

  3. PICK THE BEST PAGES TO RESURRECT
     wr pages list <project_id> --sort total_traffic
     Prioritize pages that have SEO data (traffic and/or backlinks).
     Pages with no Haloscan/Majestic data are low-priority.

  4. SCRAPE ARCHIVED CONTENT
     wr scrape <page_id>              Single page (1 credit)
     wr scrape-bulk <project_id>      All pending pages (1 credit/page)

  5. REWRITE CONTENT
     wr rewrite <page_id> --wisewand  Premium SEO rewrite (recommended, costs credits)
     wr rewrite <page_id>             Basic rewrite (1 credit)
     wr rewrite-bulk <project_id>     Bulk rewrite all scraped pages
     Add -y to skip confirmation prompts (e.g. wr -y rewrite-bulk ...)

  6. GENERATE FEATURED IMAGES
     wr image <page_id>               Single page (1 credit)
     wr image-bulk <project_id>       All rewritten pages (1 credit/page)
     Always generate images — pages without them look incomplete.

  7. CONNECT WORDPRESS
     wr wp check <domain>             Check plugin or app-password connection
     wr wp configure <domain>         Set up credentials if needed
     The connection is required to fetch categories and authors.

  8. MAP CATEGORIES TO AUTHORS (must be done before categorizing!)
     wr wp categories <domain>        List available categories
     wr wp authors <domain>           List available authors
     wr wp set-mapping <domain> --map 5:3 --map 7:2 --default-author 3
     Maps each category to its author for auto-assignment at publish.

  9. CATEGORIZE ARTICLES
     wr categorize <page_ids...> -d <domain>
     AI-suggests WordPress categories based on page content (free, 1–50 pages).
     Saves the category to each page in the database.

 10. PUBLISH TO WORDPRESS
     wr wp publish <page_id> -d <domain>
     Author is auto-resolved from category-author mapping. No need for -a.

 11. PUSH REDIRECTS
     wr redirects push <project_id> -d <domain>
     Published pages served at original URLs, rest → homepage.`)
  .version(version)
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
registerRedirectsCommand(program);
registerConfigCommand(program);

program.parseAsync(process.argv).catch((error) => {
  console.error(chalk.red(`\nError: ${error.message}\n`));
  process.exit(1);
});
