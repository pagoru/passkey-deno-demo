import React, { useState } from "react";

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

    const bufferToBase64 = (arrayBuffer: Uint8Array): string =>
      btoa(String.fromCharCode.apply(null, new Uint8Array(arrayBuffer)));

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
    console.log(atob(clientDataJSON.challenge), passableCredential);
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

  const onRegister = async (event) => {
    console.log("?");
    event.preventDefault();
    try {
      await createAccount();
    } catch (e) {
      console.error(e);
    }
  };

  const onLogin = async (event) => {
    event.preventDefault();
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
