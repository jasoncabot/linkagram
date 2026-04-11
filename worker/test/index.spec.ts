import { env } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";

describe("linkagram-img worker", () => {
	it("renders a PNG for a given set of letters", async () => {
		const request = new Request("http://example.com/", {
			method: "POST",
			body: JSON.stringify(["l", "i", "n", "k", "a", "g", "r", "a", "m", "x", "x", "x", "x", "x", "x", "x"]),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/png");

		const buffer = await response.arrayBuffer();
		expect(buffer.byteLength).toBeGreaterThan(0);
	});

	it("falls back to a default board on an invalid body", async () => {
		const request = new Request("http://example.com/", {
			method: "POST",
			body: "not-json",
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("image/png");
	});
});
