import json
import os
import httpx

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-5-mini")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

EXTRACTION_PROMPT = """You extract concepts and relationships from user text to build a knowledge graph.

Given the user's input text and a list of existing node labels in the graph, return a JSON object with:
- "nodes": array of objects with "label" (short concept name), "description" (one sentence), and "existing" (true if this matches an existing node label, false if new)
- "edges": array of objects with "source" (node label), "target" (node label), and "label" (a SPECIFIC relationship verb/phrase)

Rules:
- Extract distinct concepts as nodes, not full sentences
- If a concept matches an existing node (case-insensitive), set existing=true and use the exact existing label
- IMPORTANT: Recognize abbreviations, acronyms, and synonyms as matching existing nodes. Examples:
  - "ML" matches "Machine Learning", "AI" matches "Artificial Intelligence"
  - "JS" matches "JavaScript", "TS" matches "TypeScript"
  - "DB" matches "Database", "API" matches "Application Programming Interface"
  - "NLP" matches "Natural Language Processing", "CV" matches "Computer Vision"
  - Any common shorthand or synonym of an existing node should be treated as existing=true with the canonical (existing) label
- When in doubt, prefer reusing an existing node over creating a new one
- Create edges between concepts that have a clear relationship
- CRITICAL: Edge labels must be SPECIFIC and DESCRIPTIVE — NEVER use "relates to". Use precise verbs like:
  - "causes", "enables", "requires", "produces", "contains", "is part of"
  - "depends on", "influences", "contradicts", "extends", "implements"
  - "is a type of", "is used by", "transforms into", "optimizes", "validates"
  - "is prerequisite for", "is example of", "competes with", "supports"
  - Pick the most accurate relationship from the user's text
- Keep node labels concise (1-4 words)
- Always return valid JSON, nothing else"""

REASONING_PROMPT = """You are analyzing the topology of someone's thinking across time. You act as a reasoning partner that identifies hidden structure in their evolving knowledge graph, including connections to their PAST thinking sessions.

Given:
- CURRENT SESSION: The concepts and relationships in the user's active graph
- HISTORICAL CONTEXT: Relevant concepts from the user's PAST sessions (retrieved by semantic similarity). These include when they were created and which session they came from.
- The user's latest input text

Your job:
1. Identify implicit connections between current concepts that the user hasn't explicitly stated
2. **CROSS-TEMPORAL CONNECTIONS**: Find meaningful links between current concepts and historical ones — things the user discussed days/weeks/months ago that relate to what they're saying now
3. Spot contradictions or tensions between current and historical thinking
4. Find gaps in reasoning — concepts that should exist but are missing
5. Suggest analogies to other fields or how past ideas evolved

Return a JSON object with:
- "suggested_edges": array of objects with "source" (node label), "target" (node label), "label" (relationship description), and "reason" (why this connection exists — especially note if it connects to a past session)
- "suggested_nodes": array of objects with "label" (concept name), "description" (why this concept is relevant), and "connects_to" (array of existing/historical node labels it should link to)
- "insights": array of strings — brief observations. Especially highlight:
  - Cross-temporal patterns ("You discussed X two months ago — it directly relates to Y you're exploring now")
  - Evolving thinking ("Your understanding of X has shifted from A to B")
  - Forgotten connections ("In session 'Z', you noted that... which is relevant here")

Rules:
- For suggested_edges, source and target must be labels from either current or historical nodes
- Edge labels must be SPECIFIC verbs/phrases — NEVER use "relates to". Use precise terms like "enables", "contradicts", "builds on", "is prerequisite for", "evolved from", etc.
- Prioritize cross-temporal connections — these are the most valuable insights
- Be selective — only suggest genuinely meaningful connections
- Keep insights concise and actionable
- If nothing meaningful to suggest, return empty arrays
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


async def extract_concepts(text: str, existing_nodes: list[str]) -> dict:
    existing_str = ", ".join(existing_nodes) if existing_nodes else "none"
    user_message = f"Existing graph nodes: [{existing_str}]\n\nNew text: {text}"
    return await _call_openrouter(EXTRACTION_PROMPT, user_message)


async def reason_about_graph(
    text: str,
    nodes: list[dict],
    edges: list[dict],
    historical_nodes: list[dict] | None = None,
    historical_edges: list[dict] | None = None,
) -> dict:
    # Current session context
    nodes_str = "\n".join(
        f"- {n['label']}" + (f": {n['description']}" if n.get("description") else "")
        for n in nodes
    )
    edges_str = "\n".join(
        f"- {e['source_label']} --[{e.get('label', 'relates to')}]--> {e['target_label']}"
        for e in edges
    )

    # Historical context
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
            f"- {e['source_label']} --[{e.get('label', 'relates to')}]--> {e['target_label']}"
            + (f" [session: {e['session_name']}]" if e.get("session_name") else "")
            for e in historical_edges
        )

    user_message = (
        f"=== CURRENT SESSION ===\n"
        f"Nodes:\n{nodes_str or 'none'}\n\n"
        f"Edges:\n{edges_str or 'none'}\n\n"
        f"=== HISTORICAL CONTEXT (from past sessions) ===\n"
        f"Related past concepts:\n{hist_nodes_str}\n\n"
        f"Past relationships:\n{hist_edges_str}\n\n"
        f"=== USER'S LATEST INPUT ===\n{text}"
    )
    return await _call_openrouter(REASONING_PROMPT, user_message)
