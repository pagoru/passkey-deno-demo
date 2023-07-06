import { Application, Router } from "oak/mod.ts";
import { oakCors } from "cors";
import { cryptoRandomString } from "crypto_random_string";
import { Fido2Lib } from "fido2";

const kv = await Deno.openKv();

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
  authenticatorUserVerification: "required",
});

router
  .get("/register", async (context) => {
    const challenge = cryptoRandomString({ length: 64 });
    const userId = cryptoRandomString({ length: 32 });

    const username = context.request.url.searchParams.get("username");

    const res = await kv.get(["users", username]);
    console.log(res && res.value.status);
    if (res && res.value.status === "verified") {
      context.response.status = 409;
      return;
    }
    console.log("challenge v1", challenge);
    await kv.set(["users", username], { challenge, userId, status: "pending" });

    const registrationOptions = await f2l.attestationOptions();
    registrationOptions.challenge = challenge;
    registrationOptions.user = {
      id: userId,
      name: "name-" + userId, // if use email...
      displayName: "displayName-" + userId,
    };

    context.response.body = registrationOptions;
  })
  .post("/register", async (context) => {
    try {
      const { credential, userId } = await context.request.body().value;

      const base64ToBuffer = (base64String: string): Uint8Array => {
        const decodedString = atob(base64String);
        const uint8Array = new Uint8Array(decodedString.length);

        for (let i = 0; i < decodedString.length; i++) {
          uint8Array[i] = decodedString.charCodeAt(i);
        }

        return uint8Array.buffer;
      };

      const attestation = {
        id: credential.id,
        rawId: base64ToBuffer(credential.rawId),
        response: {
          clientDataJSON: credential.response.clientDataJSON,
          attestationObject: base64ToBuffer(
            credential.response.attestationObject,
          ),
        },
        type: credential.type,
      };

      let user;

      const iter = await kv.list<string>({ prefix: ["users"] });
      for await (const currentUser of iter) {
        if (currentUser.value.userId === userId) {
          user = currentUser;
        }
      }

      const attestationExpectations = {
        challenge: btoa(user.value.challenge),
        origin: "https://web.local",
        factor: "either",
      };

      const regResult = await f2l.attestationResult(
        attestation,
        attestationExpectations,
      );
      const authnrData = regResult.authnrData;

      const credId = authnrData.get("credId"); // ArrayBuffer
      const counter = authnrData.get("counter"); // int
      const publicKey = authnrData.get("credentialPublicKeyPem"); // string

      await kv.set(user.key, {
        challenge: undefined,
        authnr: { credId, counter, publicKey },
        status: "verified",
      });
      context.response.status = 200;
    } catch (e) {
      console.error(e);
      context.response.status = 500;
    }
  });

const app = new Application();

app.use(oakCors());
app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: 9090 });
