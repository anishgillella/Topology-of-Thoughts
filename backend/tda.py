"""Topological Data Analysis module.
Computes persistent homology from node embeddings using ripser."""
import numpy as np

try:
    from ripser import ripser
    HAS_RIPSER = True
except ImportError:
    HAS_RIPSER = False

try:
    from sklearn.metrics import pairwise_distances
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False


def compute_persistence(
    embeddings: list[list[float]],
    max_dimension: int = 2,
) -> dict:
    """Compute persistent homology from point cloud embeddings.

    Returns:
        dict with betti_0, betti_1, betti_2, persistence_diagram, cycles
    """
    if not HAS_RIPSER or not HAS_SKLEARN:
        return {
            "betti_0": len(embeddings),
            "betti_1": 0,
            "betti_2": 0,
            "persistence_diagram": [],
            "cycles": [],
            "error": "ripser or scikit-learn not installed",
        }

    if len(embeddings) < 2:
        return {
            "betti_0": len(embeddings),
            "betti_1": 0,
            "betti_2": 0,
            "persistence_diagram": [],
            "cycles": [],
        }

    points = np.array(embeddings)
    distance_matrix = pairwise_distances(points, metric="cosine")

    # Run ripser
    max_dim = min(max_dimension, len(embeddings) - 2)
    if max_dim < 0:
        max_dim = 0

    result = ripser(
        distance_matrix,
        maxdim=max_dim,
        distance_matrix=True,
    )

    diagrams = result["dgms"]

    # Build persistence diagram entries
    persistence_diagram = []
    for dim, dgm in enumerate(diagrams):
        for birth, death in dgm:
            if np.isinf(death):
                death = float(2.0)  # Cap infinite death for visualization
            persistence_diagram.append({
                "dimension": dim,
                "birth": float(birth),
                "death": float(death),
            })

    # Compute Betti numbers (features that persist beyond a threshold)
    threshold = 0.3  # Persistence threshold
    betti = [0, 0, 0]
    for dim, dgm in enumerate(diagrams):
        if dim > 2:
            break
        for birth, death in dgm:
            persistence = (death if not np.isinf(death) else 2.0) - birth
            if persistence > threshold:
                betti[dim] += 1

    # Extract cycle info (which nodes participate in topological features)
    cycles = []
    if len(diagrams) > 1:
        for idx, (birth, death) in enumerate(diagrams[1]):
            persistence = (death if not np.isinf(death) else 2.0) - birth
            if persistence > threshold:
                # Find nodes close to the birth radius
                cycle_nodes = []
                for i in range(len(distance_matrix)):
                    for j in range(i + 1, len(distance_matrix)):
                        if abs(distance_matrix[i][j] - birth) < 0.1:
                            if i not in cycle_nodes:
                                cycle_nodes.append(i)
                            if j not in cycle_nodes:
                                cycle_nodes.append(j)
                cycles.append({
                    "dimension": 1,
                    "nodes": [str(n) for n in cycle_nodes[:6]],  # Limit to 6 nodes
                })

    return {
        "betti_0": betti[0],
        "betti_1": betti[1],
        "betti_2": betti[2],
        "persistence_diagram": persistence_diagram,
        "cycles": cycles,
    }
