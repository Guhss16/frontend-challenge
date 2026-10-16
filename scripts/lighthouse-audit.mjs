import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const reports = resolve(root, 'audits/reports/lighthouse');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = resolve(reports, runId);
const baseUrl = 'http://127.0.0.1:54131';
const pnpmCli = process.env.npm_execpath;
const viteCli = resolve(root, 'node_modules/vite/bin/vite.js');
const lighthouseCli = resolve(root, 'node_modules/lighthouse/cli/index.js');

if (!pnpmCli) throw new Error('pnpm did not expose npm_execpath.');
await mkdir(reports, { recursive: true });
await mkdir(outputDir, { recursive: true });

function run(command, args, options = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: root,
      env: { ...process.env, VITE_MOCKS: 'true', ...options.env },
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', rejectRun);
    child.once('exit', (code, signal) => {
      if (code === 0) resolveRun();
      else
        rejectRun(
          new Error(
            `${command} exited with code ${code ?? 'null'}${signal ? ` (${signal})` : ''}.`
          )
        );
    });
  });
}

async function waitForServer(server) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null)
      throw new Error(`Vite preview exited with code ${server.exitCode}.`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      await delay(400);
    }
  }
  throw new Error(`Vite preview did not become ready at ${baseUrl}.`);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

const pages = [
  { id: 'catalog', path: '/' },
  { id: 'nft-detail', path: '/nfts/golden-signal-160' },
];
const profiles = [
  {
    id: 'mobile',
    args: [
      '--form-factor=mobile',
      '--screenEmulation.mobile=true',
      '--screenEmulation.width=390',
      '--screenEmulation.height=844',
      '--screenEmulation.deviceScaleFactor=1',
    ],
  },
  { id: 'desktop', args: ['--preset=desktop'] },
];

await run(process.execPath, [pnpmCli, 'build']);
const preview = spawn(
  process.execPath,
  [
    viteCli,
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '54131',
    '--strictPort',
  ],
  {
    cwd: root,
    env: { ...process.env, VITE_MOCKS: 'true' },
    stdio: 'inherit',
    windowsHide: true,
  }
);

try {
  await waitForServer(preview);
  const summary = [];
  for (const page of pages) {
    for (const profile of profiles) {
      const runs = [];
      for (let repetition = 1; repetition <= 3; repetition += 1) {
        const name = `${page.id}-${profile.id}-${repetition}`;
        const outputPath = resolve(outputDir, name);
        console.log(`\nLighthouse ${name}: ${page.path}`);
        await run(process.execPath, [
          lighthouseCli,
          `${baseUrl}${page.path}`,
          ...profile.args,
          '--output=json',
          '--output=html',
          `--output-path=${outputPath}`,
          '--chrome-flags=--headless',
        ]);
        const report = JSON.parse(
          await readFile(`${outputPath}.report.json`, 'utf8')
        );
        const audits = report.audits;
        runs.push({
          performance: Math.round(report.categories.performance.score * 100),
          accessibility: Math.round(
            report.categories.accessibility.score * 100
          ),
          bestPractices: Math.round(
            report.categories['best-practices'].score * 100
          ),
          seo: Math.round(report.categories.seo.score * 100),
          lcp: audits['largest-contentful-paint'].numericValue,
          cls: audits['cumulative-layout-shift'].numericValue,
          tbt: audits['total-blocking-time'].numericValue,
          json: `${name}.report.json`,
          html: `${name}.report.html`,
        });
      }
      const metricNames = [
        'performance',
        'accessibility',
        'bestPractices',
        'seo',
        'lcp',
        'cls',
        'tbt',
      ];
      summary.push({
        page: page.id,
        path: page.path,
        profile: profile.id,
        runs,
        median: Object.fromEntries(
          metricNames.map((metric) => [
            metric,
            median(runs.map((runResult) => runResult[metric])),
          ])
        ),
      });
    }
  }

  await writeFile(
    resolve(outputDir, 'summary.json'),
    `${JSON.stringify(
      { generatedAt: new Date().toISOString(), baseUrl, results: summary },
      null,
      2
    )}\n`
  );
  const rows = summary.map(({ page, path, profile, median: result }) => {
    const values = [
      page,
      path,
      profile,
      result.performance,
      result.accessibility,
      result.bestPractices,
      result.seo,
      `${Math.round(result.lcp)} ms`,
      result.cls.toFixed(3),
      `${Math.round(result.tbt)} ms`,
    ];
    return `| ${values.join(' | ')} |`;
  });
  await writeFile(
    resolve(outputDir, 'summary.md'),
    [
      '# Lighthouse audit',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '| Page | Path | Profile | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |',
      '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
      ...rows,
      '',
      'Each result is the median of three sequential runs. Individual JSON and HTML reports are stored alongside this summary.',
      '',
    ].join('\n')
  );
  console.log(`\nLighthouse reports written to ${outputDir}`);
} finally {
  if (preview.exitCode === null) {
    const stopped = new Promise((resolveExit) =>
      preview.once('exit', resolveExit)
    );
    preview.kill();
    await stopped;
  }
}
