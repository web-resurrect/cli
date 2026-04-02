# @web-resurrect/cli

Command-line interface for the [Web Resurrect](https://web-resurrect.com) API. Resurrect expired domains from your terminal.

## Installation

```bash
npm install -g @web-resurrect/cli
```

## Quick Start

```bash
# Authenticate with your API key
wr login

# Check credit balance
wr credits

# Create a project for an expired domain
wr projects create example.fr --name "My Project"

# Wait for URL fetching to complete
wr jobs wait <job_id>

# Enrich with SEO data
wr enrich <project_id> --sources haloscan,majestic

# List pages sorted by traffic
wr pages list <project_id> --sort total_traffic

# Scrape all pending pages
wr scrape-bulk <project_id>

# Rewrite all scraped pages (add --wisewand for premium quality)
wr rewrite-bulk <project_id> --wisewand

# Generate images
wr image-bulk <project_id>

# Publish to WordPress
wr wp configure https://mysite.com --mode plugin
wr wp publish <page_id> --domain mysite.com --status draft
```

## Commands

### Authentication & Account
| Command | Description |
|---------|-------------|
| `wr login` | Authenticate with your API key |
| `wr credits` | Show credit balance |

### Projects
| Command | Description |
|---------|-------------|
| `wr projects list` | List all projects |
| `wr projects create <domain> [--name]` | Create a project |
| `wr projects get <id>` | Project details + stats |
| `wr projects delete <id>` | Delete project (with confirmation) |

### Pages
| Command | Description |
|---------|-------------|
| `wr pages list <project_id> [--status] [--sort] [--limit]` | List pages |
| `wr pages get <id>` | Page details |

### Content Processing
| Command | Cost | Description |
|---------|------|-------------|
| `wr scrape <page_id> [--type]` | 1 credit | Scrape a page |
| `wr scrape-bulk <project_id> [--status] [--limit]` | 1/page | Scrape pages in bulk |
| `wr enrich <project_id> [--sources]` | 0-10 | SEO enrichment |
| `wr rewrite <page_id> [--wisewand] [-w key]` | 1-10 credits | Rewrite (GPT default, Wisewand with `--wisewand`) |
| `wr rewrite-bulk <project_id> [--wisewand] [--limit]` | 1-10/page | Bulk rewrite |
| `wr image <page_id>` | 1 credit | Generate featured image |
| `wr image-bulk <project_id> [--limit]` | 1/page | Bulk image generation |
| `wr categorize <page_id> --domain=<wp>` | Free | Suggest category |

### WordPress
| Command | Description |
|---------|-------------|
| `wr wp check <domain>` | Check plugin status |
| `wr wp configure <url> [--mode]` | Configure connection |
| `wr wp validate <domain>` | Validate connection |
| `wr wp categories <domain>` | List categories |
| `wr wp authors <domain>` | List authors |
| `wr wp publish <page_id> --domain=<wp>` | Publish page |

### Jobs
| Command | Description |
|---------|-------------|
| `wr jobs list [--status] [--type]` | List jobs |
| `wr jobs get <id>` | Job details |
| `wr jobs cancel <id>` | Cancel a job |
| `wr jobs wait <id> [--timeout=300]` | Wait for completion |

## Credit Costs

| Action | Cost |
|--------|------|
| Create project + URL fetch | Free |
| Haloscan enrichment | Free |
| Majestic enrichment | 10 credits |
| Scrape a page | 1 credit |
| Rewrite (GPT) | 1 credit |
| Rewrite (Wisewand) | 10 credits (1 with own key) |
| Image generation | 1 credit |
| Categorization | Free |
| WordPress publish | Free |

## Configuration

Config is stored at `~/.config/wr/config.json`. You can also set:

- `WR_API_KEY` environment variable
- `WR_BASE_URL` to override the API base URL

## Development

```bash
npm install
npm run build
node dist/index.js
```
