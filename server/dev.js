import { spawn } from 'child_process';

const commands = [
  ['server', 'node', ['server/index.js']],
  ['client', 'npx', ['vite', '--host', '0.0.0.0']]
];

const children = commands.map(([name, command, args]) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      process.exit(code);
    }
  });

  return child;
});

function shutdown() {
  for (const child of children) child.kill();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
