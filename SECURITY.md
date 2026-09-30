# Security

Please report security problems privately via GitHub's "Report a vulnerability" (Security tab) rather than in a public issue.

What the package does:
- The graphs render data you give them. Labels are escaped before they reach the page.
- They make no network requests except the URLs you pass to `createHost` or `createStaticSemantic`.
- `tools/semantic/build.py` sends note text only to the embeddings endpoint you choose (local Ollama by default). It never writes note text to its output.
