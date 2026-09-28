import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		rollupOptions: {
			input: {
				volume01: 'index.html',
				volume02: 'volumn2.html',
			},
		},
	},
});
