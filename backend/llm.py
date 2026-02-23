import json
import os
import httpx

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-5-mini")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

UNIFIED_PROMPT = """You are building a knowledge graph from the user's speech/text. You do TWO things in one pass:
1. EXTRACT concepts and relationships from the new input
2. REASON about connections — including to historical concepts from past sessions

Given:
- The user's new input text
- Existing node labels already in the graph
- Historical context: concepts from past sessions (with session names, similarity scores, timestamps)

Return a JSON object with:

"extracted_nodes": array of objects with:
  - "label" (short concept name, 1-4 words)
  - "description" (one sentence)
  - "existing" (true if matches an existing node label — including abbreviations/synonyms like "ML"="Machine Learning", "JS"="JavaScript")
  Use the exact existing label when existing=true.

"extracted_edges": array of objects with:
  - "source" (node label)
  - "target" (node label)
  - "label" (SPECIFIC relationship verb — NEVER "relates to" or "connects to")

"suggested_edges": array of objects with:
  - "source" (node label from current or historical)
  - "target" (node label from current or historical)
  - "label" (SPECIFIC relationship verb)
  - "reason" (brief explanation, especially note cross-session connections)

"suggested_nodes": array of objects with:
  - "label" (concept name)
  - "description" (why relevant)
  - "connects_to" (array of existing/historical node labels)
  - "edge_labels" (array of SPECIFIC relationship labels, one per connects_to entry)

"insights": array of strings — brief observations about:
  - Cross-temporal patterns ("You discussed X previously — it directly enables Y")
  - Contradictions or tensions
  - Knowledge gaps worth exploring

Rules:
- Edge labels must be SPECIFIC: "causes", "enables", "requires", "depends on", "contradicts", "extends", "is part of", "builds on", "evolved from", etc.
- NEVER use generic labels like "relates to", "connects to", "connected", "associated with"
- Prefer reusing existing nodes over creating new ones (check abbreviations/synonyms)
- Be selective with suggestions — only genuinely meaningful connections
- If nothing meaningful to suggest beyond extraction, return empty arrays for suggested_* and insights
- Always return valid JSON, nothing else"""


async def _call_openrouter(system_prompt: str, user_message: str) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": OPENROUTER_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.3,
            },
        )
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        return json.loads(content)


async def process_input(
    text: str,
    existing_nodes: list[str],
    current_nodes: list[dict] | None = None,
    current_edges: list[dict] | None = None,
    historical_nodes: list[dict] | None = None,
    historical_edges: list[dict] | None = None,
) -> dict:
    """Single LLM call that extracts concepts AND reasons about connections."""
    existing_str = ", ".join(existing_nodes) if existing_nodes else "none"

    # Build current graph context
    nodes_str = "none"
    edges_str = "none"
    if current_nodes:
        nodes_str = "\n".join(
            f"- {n['label']}" + (f": {n['description']}" if n.get("description") else "")
            for n in current_nodes
        )
    if current_edges:
        edges_str = "\n".join(
            (f"- {e['source_label']} --[{e['label']}]--> {e['target_label']}" if e.get('label')
             else f"- {e['source_label']} --> {e['target_label']}")
            for e in current_edges
        )

    # Build historical context
    hist_nodes_str = "none"
    hist_edges_str = "none"
    if historical_nodes:
        hist_nodes_str = "\n".join(
            f"- {n['label']}"
            + (f": {n['description']}" if n.get("description") else "")
            + (f" [session: {n['session_name']}, similarity: {n['similarity']:.2f}]" if n.get("similarity") else "")
            + (f" [created: {n['created_at']}]" if n.get("created_at") else "")
            for n in historical_nodes
        )
    if historical_edges:
        hist_edges_str = "\n".join(
            (f"- {e['source_label']} --[{e['label']}]--> {e['target_label']}" if e.get('label')
             else f"- {e['source_label']} --> {e['target_label']}")
            + (f" [session: {e['session_name']}]" if e.get("session_name") else "")
            for e in historical_edges
        )

    user_message = (
        f"Existing graph nodes: [{existing_str}]\n\n"
        f"=== CURRENT SESSION GRAPH ===\n"
        f"Nodes:\n{nodes_str}\n\n"
        f"Edges:\n{edges_str}\n\n"
        f"=== HISTORICAL CONTEXT (from past sessions) ===\n"
        f"Related past concepts:\n{hist_nodes_str}\n\n"
        f"Past relationships:\n{hist_edges_str}\n\n"
        f"=== NEW INPUT ===\n{text}"
    )
    return await _call_openrouter(UNIFIED_PROMPT, user_message)
