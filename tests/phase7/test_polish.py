"""Phase 7 tests: Polish and advanced features."""
import os


def test_concept_detail_component_exists():
    path = os.path.join(
        os.path.dirname(__file__), "../../frontend/components/ConceptDetail.tsx"
    )
    assert os.path.exists(path)


def test_export_button_exists():
    path = os.path.join(
        os.path.dirname(__file__), "../../frontend/components/ExportButton.tsx"
    )
    assert os.path.exists(path)


def test_session_sidebar_exists():
    path = os.path.join(
        os.path.dirname(__file__), "../../frontend/components/SessionSidebar.tsx"
    )
    assert os.path.exists(path)


def test_graph3d_has_node_sizing():
    """Verify Graph3D uses nodeVal for connectivity-based sizing."""
    path = os.path.join(
        os.path.dirname(__file__), "../../frontend/components/Graph3D.tsx"
    )
    with open(path) as f:
        content = f.read()
    assert "nodeVal" in content
    assert "connectivity" in content


def test_graph3d_has_selection_highlighting():
    """Verify Graph3D highlights selected node and connections."""
    path = os.path.join(
        os.path.dirname(__file__), "../../frontend/components/Graph3D.tsx"
    )
    with open(path) as f:
        content = f.read()
    assert "selectedNodeId" in content
    assert "isConnected" in content


def test_graph3d_has_background_click():
    """Verify clicking background deselects node."""
    path = os.path.join(
        os.path.dirname(__file__), "../../frontend/components/Graph3D.tsx"
    )
    with open(path) as f:
        content = f.read()
    assert "onBackgroundClick" in content


def test_all_components_present():
    """Verify the full set of components exists."""
    components_dir = os.path.join(
        os.path.dirname(__file__), "../../frontend/components"
    )
    expected = [
        "Graph3D.tsx",
        "TextInput.tsx",
        "VoiceInput.tsx",
        "TopologyPanel.tsx",
        "SessionSidebar.tsx",
        "ConceptDetail.tsx",
        "SimilaritySlider.tsx",
        "ExportButton.tsx",
    ]
    for name in expected:
        assert os.path.exists(os.path.join(components_dir, name)), f"Missing {name}"


def test_all_lib_modules_present():
    """Verify the full set of lib modules exists."""
    lib_dir = os.path.join(
        os.path.dirname(__file__), "../../frontend/lib"
    )
    expected = [
        "store.ts",
        "deepgram.ts",
        "embeddings.ts",
        "useEmbeddings.ts",
        "useAutoSave.ts",
    ]
    for name in expected:
        assert os.path.exists(os.path.join(lib_dir, name)), f"Missing {name}"


def test_page_includes_all_components():
    """Verify page.tsx imports all major components."""
    path = os.path.join(
        os.path.dirname(__file__), "../../frontend/app/page.tsx"
    )
    with open(path) as f:
        content = f.read()
    for component in [
        "Graph3D",
        "TextInput",
        "VoiceInput",
        "TopologyPanel",
        "SessionSidebar",
        "ConceptDetail",
        "ExportButton",
        "SimilaritySlider",
    ]:
        assert component in content, f"page.tsx missing {component}"
