import { initWasm, Resvg } from "@resvg/resvg-wasm";

import wasm from "../node_modules/@resvg/resvg-wasm/index_bg.wasm";
import fontData from "./SpaceGrotesk.ttf";

export interface Env {
}

let initialisedWasm = false;
const fontBytes = new Uint8Array(fontData);

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {

		let letters: string[];
		try {
			letters = await request.json<string[]>();
		} catch {
			letters = ["l", "i", "n", "k", "g", "r", "a", "m", "x", "x", "x", "x", "g", "a", "m", "e"];
		}

		const size = 256;
		const cols = 4;
		const padding = 12;
		const gap = 6;
		const tileSize = (size - padding * 2 - gap * (cols - 1)) / cols;
		const borderRadius = Math.round(tileSize * 0.28);
		const fontSize = Math.round(tileSize * 0.5);

		const tiles = letters.map((letter, idx) => {
			const row = Math.floor(idx / cols);
			const col = idx % cols;
			const x = padding + col * (tileSize + gap);
			const y = padding + row * (tileSize + gap);
			const cx = x + tileSize / 2;
			const cy = y + tileSize / 2;
			return `
				<rect x="${x}" y="${y}" width="${tileSize}" height="${tileSize}" rx="${borderRadius}" ry="${borderRadius}"
					fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" />
				<text x="${cx}" y="${cy}" dy="0.35em" font-family="Space Grotesk" font-size="${fontSize}" font-weight="700"
					fill="rgba(255,255,255,0.9)" text-anchor="middle">${letter.toUpperCase()}</text>`;
		}).join("\n");

		const svg = `<?xml version="1.0" standalone="no"?>
		<svg width="${size}" height="${size}" version="1.1" xmlns="http://www.w3.org/2000/svg">
		<defs>
			<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
				<stop offset="0%" stop-color="#0a0a1a"/>
				<stop offset="33%" stop-color="#1a0a2e"/>
				<stop offset="66%" stop-color="#0d1b2a"/>
				<stop offset="100%" stop-color="#0a0a1a"/>
			</linearGradient>
		</defs>
		<rect x="0" y="0" width="${size}" height="${size}" fill="url(#bg)" />
		${tiles}
		</svg>`;

		if (!initialisedWasm) {
			try {
				await initWasm(wasm);
				initialisedWasm = true;
			} catch (error) {
				console.error(error);
			}
		}

		const resvgJS = new Resvg(svg, {
			fitTo: { mode: "width", value: 400 },
			font: {
				fontBuffers: [fontBytes],
				loadSystemFonts: false,
				defaultFontFamily: "Space Grotesk",
			},
		});
		const pngData = resvgJS.render();
		const pngBuffer = pngData.asPng();

		return new Response(pngBuffer, {
			headers: {
				'Content-Type': 'image/png',
				'Cache-Control': 'no-store'
			}
		});
	},
};
