interface Env {
  DEFINITIONS: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const word = (context.params.word as string).toLowerCase().trim();

  if (!word || !/^[a-z]{2,16}$/.test(word)) {
    return new Response(JSON.stringify([]), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check KV cache first
  const cached = await context.env.DEFINITIONS.get(word);
  if (cached !== null) {
    return new Response(cached, {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch from external API
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
  );

  if (!res.ok) {
    return new Response(JSON.stringify([]), {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await res.text();

  // Store in KV — definitions don't change, no expiry needed
  await context.env.DEFINITIONS.put(word, body);

  return new Response(body, {
    headers: { "Content-Type": "application/json" },
  });
};
