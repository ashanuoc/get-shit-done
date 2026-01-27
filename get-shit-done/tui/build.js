import { build } from 'esbuild';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
	// Create dist directory
	await mkdir('dist', { recursive: true });

	// Build the application
	await build({
		entryPoints: ['index.tsx'],
		outfile: 'dist/index.js',
		bundle: true,
		format: 'esm',
		platform: 'node',
		target: 'node16',
		external: ['ink', 'react'],
		define: {
			'process.env.NODE_ENV': '"production"',
		},
		loader: {
			'.tsx': 'tsx',
			'.ts': 'ts',
		},
	}).catch((error) => {
		console.error('Build failed:', error);
		process.exit(1);
	});

	console.log('Build completed successfully');
}

main();