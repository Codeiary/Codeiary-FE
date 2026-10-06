import * as THREE from "three";

/** Keep the parent as a raycast target while batching its static visual details. */
export function instanceStaticMeshes(group: THREE.Group) {
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert();
  const batches = new Map<
    string,
    {
      geometry: THREE.BufferGeometry;
      material: THREE.Material;
      matrices: THREE.Matrix4[];
      cast: boolean;
      receive: boolean;
    }
  >();
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material))
      return;
    const key = `${object.geometry.uuid}:${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
    if (!batches.has(key))
      batches.set(key, {
        geometry: object.geometry,
        material: object.material,
        matrices: [],
        cast: object.castShadow,
        receive: object.receiveShadow,
      });
    batches
      .get(key)!
      .matrices.push(inverse.clone().multiply(object.matrixWorld));
  });
  group.clear();
  for (const batch of batches.values()) {
    const mesh = new THREE.InstancedMesh(
      batch.geometry,
      batch.material,
      batch.matrices.length,
    );
    batch.matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.castShadow = batch.cast;
    mesh.receiveShadow = batch.receive;
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
}
