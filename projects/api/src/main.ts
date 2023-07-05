import { Application, Router } from "oak/mod.ts";
import { oakCors } from "cors";
import { cryptoRandomString  } from "crypto_random_string";
import { Fido2Lib } from "fido2";

const kv = await Deno.openKv();

// kv.delete(["users", "alice"])
// const res = await kv.get(["users", "alice"]);

const router = new Router();

const f2l = new Fido2Lib({
	timeout: 60000,
	rpId: "web.local",
	rpName: "Testing auth",
	// rpIcon: "https://example.com/logo.png",
	challengeSize: 128,
	attestation: "none",
	cryptoParams: [-7, -257],
	authenticatorAttachment: "platform",
	authenticatorRequireResidentKey: false,
	authenticatorUserVerification: "required"
});

router
	.get("/register", async (context) => {
		const challenge = cryptoRandomString({ length: 64 });
		const userId = cryptoRandomString({ length: 32 });
		
		const username = context.request.url.searchParams.get('username');
		
		const res = await kv.get(["users", username]);
		if(res && res.status === 'verified') {
			context.response.body = {
				error: true,
				error_description: 'User already registered!'
			}
			return;
		}
		console.log('challenge v1', challenge)
		await kv.set(["users", username], { challenge, userId, status: 'pending' });
		
		const registrationOptions = await f2l.attestationOptions();
		registrationOptions.challenge = challenge
		registrationOptions.user = {
			id: userId,
			name: 'name-' + userId, // if use email...
			displayName: 'displayName-' + userId,
		}
		
		context.response.body = registrationOptions;
	})
	.post("/register", async (context) => {
		const credential = await context.request.body().value;
		credential.rawId = new Int32Array(credential.rawId).buffer;
		// credential.response.clientDataJSON = new Int32Array(credential.response.clientDataJSON).buffer;
		// credential.response.attestationObject = new Int32Array(credential.response.attestationObject).buffer;
		// credential.rawId = b_ab( b64url_b(credential.rawId) )
		// console.log(credential)
		
		console.log(credential)
		
		credential.response.clientDataJSON = JSON.parse(atob(credential.response.clientDataJSON));
		credential.response.clientDataJSON.challenge = atob(credential.response.clientDataJSON.challenge);
		credential.response.clientDataJSON = btoa(JSON.stringify(credential.response.clientDataJSON));
		
		// console.log(atob(JSON.parse(atob(credential.response.clientDataJSON)).challenge));
		
		let user;
		
		const iter = await kv.list<string>({ prefix: ["users"] });
		for await (const currentUser of iter) {
			if(currentUser.value.userId === credential.userId) user = currentUser
		}
		
		// console.log(user.value.challenge)
		
		// console.log(user);
		const attestationExpectations = {
			challenge: user.value.challenge,
			origin: "https://web.local",
			factor: "either"
		};
		const regResult = await f2l.attestationResult(credential, attestationExpectations);
		console.log(regResult)
	})

const app = new Application();

app.use(oakCors());
app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: 9090 });