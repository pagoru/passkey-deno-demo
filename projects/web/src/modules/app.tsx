import React, { useState } from "react";

export const App = () => {
  const [username, setUsername] = useState<string>("pagoru");

  const ab_b64 = (buf) =>
    btoa(buf.reduce((data, val) => data + String.fromCharCode(val), ""));

  const createAccount = async () => {
    let response = await fetch(`https://api.local/register?username=${username}`)
    const credentialsCreateProps = await response.json();
    credentialsCreateProps.challenge = new TextEncoder().encode(credentialsCreateProps.challenge);
    credentialsCreateProps.user.id = new TextEncoder().encode(credentialsCreateProps.user.id);
    
    const credential = (await navigator.credentials.create({
      publicKey: credentialsCreateProps,
    })) as any;

    // console.log("credential", credential);
    // console.log("credential.rawId", credential.rawId);
    // console.log("credential2", ab_b64(new Uint8Array(credential.rawId)));

    console.log(credential.response.clientDataJSON)
    const passableCredential = {
      id: credential.id,
      rawId: new Uint8Array(credential.rawId),
      response: {
        clientDataJSON: ab_b64(new Uint8Array(credential.response.clientDataJSON)),
        attestationObject: ab_b64(new Uint8Array(credential.response.attestationObject)),
      },
      userId: new TextDecoder().decode(credentialsCreateProps.user.id),
      type: credential.type,
    };
    response = await fetch('https://api.local/register', {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(passableCredential)
    })
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
