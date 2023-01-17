import { Stripe } from "stripe";

export interface Env {
	STRIPE_SECRET_KEY: string
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		if (request.method == "POST") {
			return createPaymentIntent(request, env);
		} else {
			return new Response("ok", { status: 200 });
		}
	},
};

const createPaymentIntent = async (request: Request, env: Env) => {
	const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
		httpClient: Stripe.createFetchHttpClient(),
		apiVersion: "2022-11-15",
		appInfo: {
			name: "linkagram",
			version: "1.0.0",
			url: "https://linkagram.jasoncabot.me"
		}
	});

	try {
		const paymentIntent = await stripe.paymentIntents.create({
			amount: 99,
			currency: 'gbp',
		});

		return new Response(JSON.stringify({
			secret: paymentIntent.client_secret
		}), {
			status: 201,
			headers: {
				'content-type': 'application/json;charset=UTF-8',
			}
		})
	} catch (e: any) {
		return new Response(JSON.stringify({
			error: {
				message: e.message
			}
		}), {
			status: 400,
			headers: {
				'content-type': 'application/json;charset=UTF-8',
			}
		})
	}
}
