import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";

// Minimal Env used for tests — Stripe is only hit on POST, so GET tests
// don't require a real key.
const env = { STRIPE_SECRET_KEY: "sk_test_dummy" } as never;

describe("linkagram-pay worker", () => {
	it("returns ok on GET", async () => {
		const request = new Request("http://example.com/", { method: "GET" });
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ok");
	});
});
