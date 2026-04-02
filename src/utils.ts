import chalk from 'chalk';

export function formatTable(
  headers: string[],
  rows: string[][],
): string {
  const colWidths = headers.map((h, i) => {
    const maxRow = rows.reduce((max, row) => Math.max(max, (row[i] || '').length), 0);
    return Math.max(h.length, maxRow);
  });

  const sep = colWidths.map((w) => '-'.repeat(w + 2)).join('+');
  const headerLine = headers
    .map((h, i) => ` ${chalk.bold(h.padEnd(colWidths[i]))} `)
    .join('|');

  const dataLines = rows.map((row) =>
    row.map((cell, i) => ` ${(cell || '').padEnd(colWidths[i])} `).join('|'),
  );

  return [headerLine, sep, ...dataLines].join('\n');
}

export function statusColor(status: string): string {
  switch (status) {
    case 'completed':
    case 'published':
    case 'scraped':
    case 'rewritten':
      return chalk.green(status);
    case 'failed':
    case 'scrape_failed':
    case 'cancelled':
      return chalk.red(status);
    case 'pending':
    case 'processing':
    case 'rewriting':
      return chalk.yellow(status);
    case 'empty':
      return chalk.gray(status);
    default:
      return status;
  }
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function truncate(str: string, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '\u2026' : str;
}

export function printSuccess(message: string): void {
  console.log(chalk.green('\u2714 ') + message);
}

export function printError(message: string): void {
  console.error(chalk.red('\u2718 ') + message);
}

export function printWarning(message: string): void {
  console.log(chalk.yellow('\u26A0 ') + message);
}

export function printInfo(message: string): void {
  console.log(chalk.cyan('\u2139 ') + message);
}

export function printJobStarted(jobId: string): void {
  printSuccess(`Job started: ${chalk.bold(jobId)}`);
  printInfo(`Track progress: ${chalk.cyan(`wr jobs wait ${jobId}`)}`);
}

export async function confirm(message: string): Promise<boolean> {
  // Non-interactive mode: skip prompt, auto-confirm
  if (global.__wrAutoYes) return true;

  const { default: Enquirer } = await import('enquirer');
  const enquirer = new Enquirer();
  const response = (await enquirer.prompt({
    type: 'confirm',
    name: 'confirm',
    message,
    initial: true,
  })) as { confirm: boolean };
  return response.confirm;
}

export async function promptInput(message: string, options?: { type?: string }): Promise<string> {
  const { default: Enquirer } = await import('enquirer');
  const enquirer = new Enquirer();
  const response = (await enquirer.prompt({
    type: options?.type || 'input',
    name: 'value',
    message,
  })) as { value: string };
  return response.value;
}
