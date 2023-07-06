import React, { useState } from "react";

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

export const App = () => {
  const [username, setUsername] = useState<string>("pagoru");

  const createAccount = async () => {
    let response = await fetch(
      `https://api.local/register?username=${username}`,
    );
    const credentialsCreateProps = await response.json();
    credentialsCreateProps.challenge = new TextEncoder().encode(
      credentialsCreateProps.challenge,
    );
    credentialsCreateProps.user.id = new TextEncoder().encode(
      credentialsCreateProps.user.id,
    );

    const credential = (await navigator.credentials.create({
      publicKey: credentialsCreateProps,
    })) as any;

    console.log(credential);

    // console.log("credential", credential);
    // console.log("credential.rawId", credential.rawId);
    // console.log("credential2", ab_b64(new Uint8Array(credential.rawId)));

    const clientDataJSON = JSON.parse(
      new TextDecoder().decode(
        new Uint8Array(credential.response.clientDataJSON),
      ),
    );
    const passableCredential = {
      id: credential.id,
      rawId: bufferToBase64(new Uint8Array(credential.rawId)),
      response: {
        clientDataJSON: btoa(
          JSON.stringify({
            challenge: atob(clientDataJSON.challenge),
            ...clientDataJSON,
          }),
        ),
        attestationObject: bufferToBase64(
          new Uint8Array(credential.response.attestationObject),
        ),
      },
      type: credential.type,
    };

    response = await fetch("https://api.local/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        credential: passableCredential,
        userId: new TextDecoder().decode(
          new Uint8Array(credentialsCreateProps.user.id),
        ),
      }),
    });
  };

  const validateAccount = async () => {
    let response = await fetch(
      `https://api.local/validate?username=${username}`,
    );
    const authnOptions = await response.json();
    console.log(authnOptions.allowCredentials);
    authnOptions.allowCredentials = authnOptions.allowCredentials.map(
      (item) => ({
        ...item,
        id: base64ToBuffer(item.id),
      }),
    );
    authnOptions.challenge = new TextEncoder().encode(authnOptions.challenge);

    console.log("???");
    const credential = await navigator.credentials.get({
      publicKey: authnOptions,
    });
    console.log("??? v2");

    const clientDataJSON = JSON.parse(
      new TextDecoder().decode(
        new Uint8Array(credential.response.clientDataJSON),
      ),
    );

    const passableCredential = {
      id: credential.id,
      rawId: bufferToBase64(new Uint8Array(credential.rawId)),
      response: {
        clientDataJSON: btoa(
          JSON.stringify({
            challenge: atob(clientDataJSON.challenge),
            ...clientDataJSON,
          }),
        ),
        authenticatorData: bufferToBase64(
          new Uint8Array(credential.response.authenticatorData),
        ),
        signature: bufferToBase64(
          new Uint8Array(credential.response.signature),
        ),
        userHandle: new TextDecoder().decode(
          new Uint8Array(credential.response.userHandle),
        ), // credential.response.userHandle,
      },
      type: credential.type,
    };
    console.log(passableCredential);

    response = await fetch("https://api.local/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        credential: passableCredential,
        userId: passableCredential.response.userHandle,
      }),
    });
  };

  const onRegister = async (event) => {
    event.preventDefault();
    try {
      await createAccount();
    } catch (e) {
      console.error(e);
    }
  };

  const onLogin = async (event) => {
    event.preventDefault();
    try {
      await validateAccount();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>
      <form onSubmit={(event) => event.preventDefault()}>
        <input
          placeholder="username"
          name="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <button onClick={onRegister}>register</button>
        <button onClick={onLogin}>login</button>
      </form>
    </div>
  );
};
