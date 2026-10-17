/**
 * The last step of `npm run deploy`. By this point the stories have validated
 * and the app has built, so all that is left is to push, which hands over to
 * the GitHub Pages workflow.
 *
 * Content changes under content/ are committed for you — that is the weekly
 * routine. Anything changed outside content/ stops the deploy, because a
 * half-finished code change is not something to publish by accident.
 */
import { execFileSync } from 'node:child_process';

const run = (args: string[]): string =>
  execFileSync('git', args, { encoding: 'utf8' }).trim();

function fail(message: string): never {
  console.error(`\x1b[31m${message}\x1b[0m`);
  process.exit(1);
}

try {
  run(['rev-parse', '--git-dir']);
} catch {
  fail('Not a git repository. Run `git init` and add a GitHub remote first.');
}

const branch = run(['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'main') {
  fail(`On branch "${branch}". The Pages workflow deploys from main — switch branches first.`);
}

// Porcelain lines look like "XY path"; the path starts at column 3.
const status = run(['status', '--porcelain']).split('\n').filter(Boolean);
const changed = status.map((line) => line.slice(3));
const outsideContent = changed.filter((p) => !p.startsWith('content/'));

if (outsideContent.length > 0) {
  console.error('Uncommitted changes outside content/:');
  for (const p of outsideContent) console.error(`  ${p}`);
  fail('Commit or stash them, then run `npm run deploy` again.');
}

if (changed.length > 0) {
  const stories = changed.filter((p) => p.startsWith('content/stories/')).length;
  const message =
    stories > 0
      ? `Add ${stories} ${stories === 1 ? 'story' : 'stories'}`
      : 'Update content';
  console.log(`Committing ${changed.length} content change(s): ${message}`);
  run(['add', 'content']);
  run(['commit', '-m', message]);
}

let remote: string;
try {
  remote = run(['remote', 'get-url', 'origin']);
} catch {
  fail('No "origin" remote. Add your GitHub repo: git remote add origin <url>');
}

console.log(`Pushing to ${remote} …`);
execFileSync('git', ['push', 'origin', 'main'], { stdio: 'inherit' });

const repo = /github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/.exec(remote);
if (repo) {
  const [, owner, name] = repo as unknown as [string, string, string];
  console.log(`\nBuild:  https://github.com/${owner}/${name}/actions`);
  console.log(`App:    https://${owner}.github.io/${name}/`);
  console.log('\nThe deploy takes a minute or two. Open the app on your phone once it is green.');
} else {
  console.log('\nPushed. Watch the Actions tab for the deploy.');
}
