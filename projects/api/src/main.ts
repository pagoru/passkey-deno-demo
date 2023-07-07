import { Application, Router } from "oak/mod.ts";
import { oakCors } from "cors";
import { cryptoRandomString } from "crypto_random_string";
import { Fido2Lib } from "fido2";

const kv = await Deno.openKv();
// await kv.delete(["users", "pagoru"]);

const router = new Router();

const f2l = new Fido2Lib({
  timeout: 60000,
  rpId: Deno.env.get("RP_ID"),
  rpName: "Testing auth",
  // rpIcon: "https://example.com/logo.png",
  challengeSize: 128,
  attestation: "none",
  cryptoParams: [-7, -257],
  authenticatorAttachment: "platform",
  authenticatorRequireResidentKey: false,
  authenticatorUserVerification: "required",
});

const bufferToBase64 = (arrayBuffer: Uint8Array): string =>
  btoa(String.fromCharCode.apply(null, new Uint8Array(arrayBuffer)));

const base64ToBuffer = (base64String: string): Uint8Array => {
  const decodedString = atob(base64String);
  const uint8Array = new Uint8Array(decodedString.length);

  for (let i = 0; i < decodedString.length; i++) {
    uint8Array[i] = decodedString.charCodeAt(i);
  }
  return uint8Array.buffer;
};

router
  .get("/register", async (context) => {
    const challenge = cryptoRandomString({ length: 64 });
    const userId = cryptoRandomString({ length: 32 });

    const username = context.request.url.searchParams.get("username");

    const res = await kv.get(["users", username]);
    if (res && res.value?.status === "verified") {
      context.response.status = 409;
      return;
    }
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
      console.info("HELLO?");
      const { credential, userId } = await context.request.body().value;

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
        origin: Deno.env.get("WEB_URL"),
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

      const updated = await kv.set(user.key, {
        ...user.value,
        authnr: { credId, counter, publicKey },
        status: "verified",
      });
      context.response.status = 200;
    } catch (e) {
      console.error(e);
      context.response.status = 500;
    }
  })
  .get("/validate", async (context) => {
    const username = context.request.url.searchParams.get("username");

    const res = await kv.get(["users", username]);
    if (!res || res.value.status !== "verified") {
      context.response.status = 406;
      return;
    }
    const authnOptions = await f2l.attestationOptions();

    //TODO Needs a new challenge
    authnOptions.challenge = res.value.challenge;
    authnOptions.allowCredentials = [
      { type: "public-key", id: bufferToBase64(res.value.authnr.credId) },
    ];

    context.response.body = authnOptions;
  })
  .post("/validate", async (context) => {
    try {
      const { credential, userId } = await context.request.body().value;

      const attestation = {
        id: credential.id,
        rawId: base64ToBuffer(credential.rawId),
        response: {
          clientDataJSON: credential.response.clientDataJSON,
          authenticatorData: base64ToBuffer(
            credential.response.authenticatorData,
          ),
          signature: base64ToBuffer(credential.response.signature),
          userHandle: credential.response.userHandle, // credential.response.userHandle,
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

      const assertionExpectations = {
        challenge: btoa(user.value.challenge),
        origin: Deno.env.get("WEB_URL"),
        factor: "either",
        publicKey: user.value.authnr.publicKey,
        prevCounter: user.value.authnr.counter,
        userHandle: user.value.userId,
      };

      await f2l.assertionResult(attestation, assertionExpectations);

      console.log("Validated user");
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
