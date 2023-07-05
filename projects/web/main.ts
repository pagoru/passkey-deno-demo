import { webServe } from 'denoWebServe';

await webServe({
	port: 8080,
	indexFileName: 'main.tsx',
	minify: Deno.env.get('ENVIRONMENT') !== 'DEVELOPMENT',
	externals: [],
	envs: ['ENVIRONMENT']
});