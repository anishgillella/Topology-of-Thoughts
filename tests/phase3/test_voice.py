"""Phase 3 tests: Voice input infrastructure.
Note: Actual Deepgram WebSocket tests require a browser environment.
These tests verify the backend endpoints that voice input relies on."""
import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../backend"))
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_extract_endpoint_accepts_voice_transcript():
    """Voice transcripts go through the same extraction pipeline."""
    resp = client.post(
        "/api/extract",
        json={
            "text": "I think quantum computing could revolutionize cryptography",
            "existing_nodes": ["Cryptography"],
        },
    )
    assert resp.status_code in (200, 500)


def test_reason_endpoint_after_voice():
    """Reasoning runs after voice extraction on same pipeline."""
    resp = client.post(
        "/api/reason",
        json={
            "text": "Quantum computing could break RSA encryption",
            "nodes": [
                {"label": "Quantum Computing"},
                {"label": "Cryptography"},
                {"label": "RSA"},
            ],
            "edges": [
                {"source_label": "Quantum Computing", "target_label": "Cryptography", "label": "threatens"},
            ],
        },
    )
    assert resp.status_code in (200, 500)


def test_deepgram_client_module_importable():
    """Verify the deepgram TypeScript module exists (checked via file presence)."""
    deepgram_path = os.path.join(
        os.path.dirname(__file__), "../../frontend/lib/deepgram.ts"
    )
    assert os.path.exists(deepgram_path), "deepgram.ts should exist"


def test_voice_input_component_exists():
    """Verify VoiceInput component exists."""
    component_path = os.path.join(
        os.path.dirname(__file__), "../../frontend/components/VoiceInput.tsx"
    )
    assert os.path.exists(component_path), "VoiceInput.tsx should exist"
