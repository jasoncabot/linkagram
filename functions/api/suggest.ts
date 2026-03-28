import smallWords from "../../public/data/small.json";

interface Env {
  GITHUB_TOKEN: string;
  SUGGESTIONS: KVNamespace;
}

const REPO = "jasoncabot/linkagram";
const DICT_PATH = "public/data/small.json";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env } = context;

  let body: { word?: string };
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ status: "invalid" }, 400);
  }

  const word = body.word?.toLowerCase().trim();

  // 1. Format check: alpha-only, 2-16 chars
  if (!word || !/^[a-z]{2,16}$/.test(word)) {
    return jsonResponse({ status: "invalid" }, 400);
  }

  // 2. Already in dictionary
  if ((smallWords as string[]).includes(word)) {
    return jsonResponse({ status: "already_exists" });
  }

  // 3. Already submitted (KV dedup)
  const existing = await env.SUGGESTIONS.get(`suggestion:${word}`);
  if (existing !== null) {
    return jsonResponse({ status: "already_suggested" });
  }

  // 4. Must have a real definition
  const defResponse = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
  );
  if (!defResponse.ok) {
    return jsonResponse({ status: "no_definition" });
  }
  const defData = (await defResponse.json()) as [
    { meanings?: { partOfSpeech: string }[] }
  ];
  if (!defData[0]?.meanings?.length) {
    return jsonResponse({ status: "no_definition" });
  }

  // 5. Create GitHub PR
  try {
    await createPullRequest(env.GITHUB_TOKEN, word);
  } catch (err) {
    console.error("GitHub PR creation failed:", err);
    return jsonResponse({ status: "error", message: "Failed to create suggestion" }, 500);
  }

  // 6. Mark as submitted in KV (no expiry)
  await env.SUGGESTIONS.put(`suggestion:${word}`, new Date().toISOString());

  return jsonResponse({ status: "created" });
};

const BRANCH = "suggested-words";

async function createPullRequest(token: string, word: string) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "linkagram-suggest",
    "Content-Type": "application/json",
  };

  // Try to get small.json from the suggested-words branch first (includes
  // previous suggestions not yet merged). Fall back to main if the branch
  // doesn't exist (e.g. after merging and deleting it).
  let ref = BRANCH;
  let fileRes = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${DICT_PATH}?ref=${BRANCH}`,
    { headers }
  );
  if (!fileRes.ok) {
    ref = "main";
    fileRes = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${DICT_PATH}?ref=main`,
      { headers }
    );
  }
  if (!fileRes.ok) throw new Error(`Failed to get file: ${fileRes.status}`);
  const fileData = (await fileRes.json()) as { sha: string; content: string };

  // Decode and parse current dictionary
  const content = atob(fileData.content.replace(/\n/g, ""));
  const words: string[] = JSON.parse(content);

  // Insert word in sorted position
  const insertIdx = words.findIndex((w) => w > word);
  if (insertIdx === -1) {
    words.push(word);
  } else {
    words.splice(insertIdx, 0, word);
  }

  const updatedContent = JSON.stringify(words);

  // Ensure the branch exists — create from main if it doesn't
  if (ref === "main") {
    const mainRef = await fetch(
      `https://api.github.com/repos/${REPO}/git/ref/heads/main`,
      { headers }
    );
    if (!mainRef.ok) throw new Error(`Failed to get main ref: ${mainRef.status}`);
    const mainData = (await mainRef.json()) as { object: { sha: string } };

    const branchRes = await fetch(
      `https://api.github.com/repos/${REPO}/git/refs`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          ref: `refs/heads/${BRANCH}`,
          sha: mainData.object.sha,
        }),
      }
    );
    if (!branchRes.ok && branchRes.status !== 422) {
      throw new Error(`Failed to create branch: ${branchRes.status}`);
    }
  }

  // Commit the updated file to the suggested-words branch
  const updateRes = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${DICT_PATH}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `Add word: ${word}`,
        content: btoa(updatedContent),
        sha: fileData.sha,
        branch: BRANCH,
      }),
    }
  );
  if (!updateRes.ok) throw new Error(`Failed to update file: ${updateRes.status}`);

  // Create PR if one isn't already open (422 = PR already exists for this head)
  const prRes = await fetch(`https://api.github.com/repos/${REPO}/pulls`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "Suggested words",
      head: BRANCH,
      base: "main",
      body: "Player-suggested dictionary additions.",
    }),
  });
  if (!prRes.ok && prRes.status !== 422) {
    throw new Error(`Failed to create PR: ${prRes.status}`);
  }
}

function jsonResponse(data: object, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
