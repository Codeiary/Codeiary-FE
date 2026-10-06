import * as THREE from "three";
import { BLOCK_WIDTH, RESIDENTIAL_START } from "./residences";

/** Fade the actual world surfaces, so rotating the camera cannot open gaps in the mist. */
export function createBoundaryFog() {
  const east = { value: RESIDENTIAL_START };
  const west = { value: RESIDENTIAL_START };
  const westEnabled = { value: 0 };
  let eastTarget = east.value;
  let westTarget = west.value;
  const materials = new WeakSet<THREE.Material>();

  return {
    apply(material: THREE.Material) {
      if (materials.has(material)) return;
      materials.add(material);
      material.onBeforeCompile = (shader) => {
        shader.uniforms.boundaryEast = east;
        shader.uniforms.boundaryWest = west;
        shader.uniforms.boundaryWestEnabled = westEnabled;
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <fog_pars_vertex>",
            `
            #include <fog_pars_vertex>
            varying vec3 vBoundaryPosition;
          `,
          )
          .replace(
            "#include <fog_vertex>",
            `
            #include <fog_vertex>
            vec4 boundaryPosition = vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
              boundaryPosition = instanceMatrix * boundaryPosition;
            #endif
            vBoundaryPosition = (modelMatrix * boundaryPosition).xyz;
          `,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <fog_pars_fragment>",
            `
            #include <fog_pars_fragment>
            varying vec3 vBoundaryPosition;
            uniform float boundaryEast;
            uniform float boundaryWest;
            uniform float boundaryWestEnabled;
          `,
          )
          .replace(
            "#include <fog_fragment>",
            `
            #include <fog_fragment>
            #ifdef USE_FOG
              float boundaryDistance = vBoundaryPosition.x - boundaryEast;
              if (boundaryWestEnabled > 0.5) {
                boundaryDistance = max(boundaryDistance, boundaryWest - vBoundaryPosition.x);
              }
              // World-space variation stays still as the camera orbits; no billboard seams.
              float wisps = sin(vBoundaryPosition.z * 0.095 + vBoundaryPosition.y * 0.06) * 3.0
                + sin(vBoundaryPosition.z * 0.21 - vBoundaryPosition.x * 0.075) * 1.5;
              float boundaryMist = smoothstep(-10.0, 38.0, boundaryDistance + wisps);
              gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, boundaryMist);
            #endif
          `,
          );
      };
      material.customProgramCacheKey = () => "city-boundary-fog-v1";
      material.needsUpdate = true;
    },
    setBlocks(pages: readonly number[]) {
      eastTarget =
        RESIDENTIAL_START +
        (pages.length ? Math.max(...pages) + 1 : 0) * BLOCK_WIDTH;
      westTarget =
        RESIDENTIAL_START +
        (pages.length ? Math.min(...pages) : 0) * BLOCK_WIDTH;
      const showWest = pages.length > 0 && Math.min(...pages) > 0;
      // Cover evicted blocks immediately; reveal newly loaded scenery gradually.
      if (eastTarget < east.value || eastTarget - east.value > BLOCK_WIDTH * 2)
        east.value = eastTarget;
      if (
        westTarget > west.value ||
        west.value - westTarget > BLOCK_WIDTH * 2 ||
        !westEnabled.value
      )
        west.value = westTarget;
      westEnabled.value = Number(showWest);
    },
    update(delta: number) {
      east.value = THREE.MathUtils.damp(east.value, eastTarget, 2.8, delta);
      west.value = THREE.MathUtils.damp(west.value, westTarget, 2.8, delta);
    },
  };
}
