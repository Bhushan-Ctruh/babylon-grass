import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import {
  Color3,
  Matrix,
  Quaternion,
  Vector3,
} from "@babylonjs/core/Maths/math";

// Side-effects only imports allowing the standard material to be used as default.
import "@babylonjs/core/Materials/standardMaterial";
// Side-effects only imports allowing Mesh to create default shapes (to enhance tree shaking, the construction methods on mesh are not available if the meshbuilder has not been imported).
import "@babylonjs/core/Meshes/Builders/sphereBuilder";
import "@babylonjs/core/Meshes/Builders/boxBuilder";
import "@babylonjs/core/Meshes/Builders/groundBuilder";
import "@babylonjs/loaders/glTF";

import {
  AbstractMesh,
  ArcRotateCamera,
  Buffer,
  Camera,
  Constants,
  Effect,
  FreeCamera,
  GizmoManager,
  Mesh,
  MeshBuilder,
  RenderTargetTexture,
  SSAORenderingPipeline,
  SceneLoader,
  ShaderMaterial,
  StandardMaterial,
  Texture,
  VertexData,
} from "@babylonjs/core";
import { Noise2D, divideRectangleIntoChunks } from "./util";

const PLANE_SIZE = 100;
const BLADE_COUNT = 10000;
const BLADE_WIDTH = 0.1;
const BLADE_HEIGHT = 0.8;
const BLADE_HEIGHT_VARIATION = 0.6;
const MID_WIDTH = BLADE_WIDTH * 0.5;
const BLADE_PER_CHUNK = 10000;
const NO_OF_CHUNKS = 4;

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas);
const scene = new Scene(engine);

// This creates and positions a free camera (non-mesh)
const camera = new ArcRotateCamera(
  "camera",
  0,
  0,
  0,
  new Vector3(26.4, 32.5, 7.8),
  scene
);
// camera.minZ = 0.1;
// camera.maxZ = 100000000;

// This targets the camera to scene origin
camera.setTarget(Vector3.Zero());

// This attaches the camera to the canvas
camera.attachControl(canvas, true);

scene.createDefaultLight();

window.addEventListener("resize", () => {
  engine.resize();
});

const loadGrassMesh = (path: string, file: string) => {
  return new Promise<AbstractMesh>((resolve, reject) => {
    SceneLoader.ImportMesh(
      "",
      path,
      file,
      scene,
      function (newMeshes) {
        const mesh = newMeshes[1];
        if (mesh) {
          resolve(mesh);
        } else {
          reject("Failed to load grass mesh");
        }
      },
      null,
      () => {
        reject("Failed to load grass mesh");
      }
    );
  });
};

const res = Promise.all([
  loadGrassMesh("/", "grassBladeHigh.glb"),
  loadGrassMesh("/", "grassBladeHigh.glb"),
  loadGrassMesh("/", "grassBladeHigh.glb"),
  loadGrassMesh("/", "grassBladeHigh.glb"),
  loadGrassMesh("/", "grassBladeLow.glb"),
  loadGrassMesh("/", "grassBladeLow.glb"),
  loadGrassMesh("/", "grassBladeLow.glb"),
  loadGrassMesh("/", "grassBladeLow.glb"),
]);

// class GrassMatrial {
//   constructor(name: string, scene: Scene) {
//     const grassTexture = new Texture("/grass.jpg", scene);
//     const cloudTexture = new Texture("/cloud.jpg", scene);
//   }
// }

const fieldChunks = divideRectangleIntoChunks(
  PLANE_SIZE,
  PLANE_SIZE,
  NO_OF_CHUNKS / 2,
  NO_OF_CHUNKS / 2,
  80,
  80
);

Effect.ShadersStore["ttVertexShader"] = `
            precision highp float;

            // Attributes
            attribute vec3 position;
            attribute vec2 uv;
            attribute vec3 color;
            attribute vec3 normal;
            attribute float aRandom;
            attribute vec2 aOffset;
            attribute float aScale;

            // Uniforms
            uniform mat4 viewProjection;
            uniform float uTime;

            // Varying
            varying vec2 vUV;
            varying vec3 vColor;
            varying vec3 vNormal;
            varying vec3 vPosition;

            #include<instancesDeclaration>

            vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
            vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
            vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

            float cnoise(vec3 P){
              vec3 Pi0 = floor(P); // Integer part for indexing
              vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
              Pi0 = mod(Pi0, 289.0);
              Pi1 = mod(Pi1, 289.0);
              vec3 Pf0 = fract(P); // Fractional part for interpolation
              vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
              vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
              vec4 iy = vec4(Pi0.yy, Pi1.yy);
              vec4 iz0 = Pi0.zzzz;
              vec4 iz1 = Pi1.zzzz;

              vec4 ixy = permute(permute(ix) + iy);
              vec4 ixy0 = permute(ixy + iz0);
              vec4 ixy1 = permute(ixy + iz1);

              vec4 gx0 = ixy0 / 7.0;
              vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
              gx0 = fract(gx0);
              vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
              vec4 sz0 = step(gz0, vec4(0.0));
              gx0 -= sz0 * (step(0.0, gx0) - 0.5);
              gy0 -= sz0 * (step(0.0, gy0) - 0.5);

              vec4 gx1 = ixy1 / 7.0;
              vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
              gx1 = fract(gx1);
              vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
              vec4 sz1 = step(gz1, vec4(0.0));
              gx1 -= sz1 * (step(0.0, gx1) - 0.5);
              gy1 -= sz1 * (step(0.0, gy1) - 0.5);

              vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
              vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
              vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
              vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
              vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
              vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
              vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
              vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

              vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
              g000 *= norm0.x;
              g010 *= norm0.y;
              g100 *= norm0.z;
              g110 *= norm0.w;
              vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
              g001 *= norm1.x;
              g011 *= norm1.y;
              g101 *= norm1.z;
              g111 *= norm1.w;

              float n000 = dot(g000, Pf0);
              float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
              float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
              float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
              float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
              float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
              float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
              float n111 = dot(g111, Pf1);

              vec3 fade_xyz = fade(Pf0);
              vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
              vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
              float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
              return 2.2 * n_xyz;
            }

            float exponentialIn(float t) {
              return t == 0.0 ? t : pow(2.0, 10.0 * (t - 1.0));
            }

            void main(void) {
                #include<instancesVertex>
                float waveSize = 10.0f;
                float tipDistance = 0.3f;
                float centerDistance = 0.1f;

                vec3 cpos = position;

                float wind = cnoise(vec3(aOffset.x, aOffset.y, uTime * 0.0007 * aScale));

                float cosRotation = cos(aRandom * 3.14);
                float sinRotation = sin(aRandom * 3.14);
                mat3 rotationMatrix = mat3(
                    cosRotation, 0.0, sinRotation,
                    0.0, 1.0, 0.0,
                    -sinRotation, 0.0, cosRotation
                );

                vec3 norm = normalize(cross(position, vec3(0.0, 1.0, 0.0)));
                norm = normal;
                cpos = rotationMatrix * cpos;
                norm = rotationMatrix * norm;

                // cpos.x += wind * cpos.y * 0.15;
                cpos.z += wind * (uv.y * uv.y * uv.y) * 1.5;
                cpos.y *= 1.0 + aScale * 1.5;
                // cpos.x *= 0.01;
                vec4 wPos =  finalWorld * vec4(cpos, 1.0);
                vec4 wNorm = finalWorld * vec4(norm, 0.0);
                gl_Position = viewProjection * wPos;

                vUV = uv;
                vColor = color;
                vNormal = wNorm.xyz;
                vPosition = wPos.xyz;
            }
        `;
Effect.ShadersStore["ttFragmentShader"] = `
            precision highp float;

            varying vec2 vUV;
            varying vec3 vColor;
            varying vec3 vNormal;
            varying vec3 vPosition;

            uniform vec3 sunDirection;
            uniform sampler2D normalMap;
            uniform float uTime;
            uniform sampler2D grassColorTexture;
            uniform sampler2D cloudMap;

            vec3 ACESFilm(vec3 x){
              float a = 2.51;
              float b = 0.03;
              float c = 2.43;
              float d = 0.59;
              float e = 0.14;
              return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
            }

            float inverseLerp(float v, float minValue, float maxValue) {
              return (v - minValue) / (maxValue - minValue);
            }

            float remap(float v, float inMin, float inMax, float outMin, float outMax) {
              float t = inverseLerp(v, inMin, inMax);
              return mix(outMin, outMax, t);
            }

            float exponentialIn(float t) {
              return t == 0.0 ? t : pow(2.0, 10.0 * (t - 1.0));
            }

            void main(void) {
              vec3 BOTTOM_COLOR = vec3(0.83, 1.0, 0.0);
              vec3 TOP_COLOR = vec3(0.019, 0.47, 0.14);

                vec3 normal = vNormal ;
                // if(gl_FrontFacing){
                //   normal = normalize(normal);
                // }else{
                //   normal = normalize(-normal);
                // }

                vec2 globalUV = vPosition.xz + ${(PLANE_SIZE / 2).toFixed(2)};
                vec3 colorSample = texture2D(grassColorTexture, globalUV/${PLANE_SIZE.toFixed(
                  2
                )}).rgb;
                vec3 cloudSample = texture2D(cloudMap, globalUV/${PLANE_SIZE.toFixed(
                  2
                )} + uTime * 0.0001).rgb;

                cloudSample.r = remap(cloudSample.r, 0.0, 1.0, 0.4, 1.0);
                cloudSample.g = remap(cloudSample.g, 0.0, 1.0, 0.4, 1.0);
                cloudSample.b = remap(cloudSample.b, 0.0, 1.0, 0.4, 1.0);

                vec3 lighting = vec3(0.0);

                vec3 skyColour = vec3(0.0, 0.3, 0.6);
                vec3 groundColour = vec3(0.6, 0.3, 0.1);

                vec3 hemi = mix(groundColour, skyColour, remap(normal.y, -1.0, 1.0, 0.0, 1.0));

                float cosRotation = cos(uTime * 0.001);
                float sinRotation = sin(uTime * 0.001);
                mat3 rotationMatrix = mat3(
                    cosRotation, 0.0, sinRotation,
                    0.0, 1.0, 0.0,
                    -sinRotation, 0.0, cosRotation
                );
                vec3 lightDir = rotationMatrix * normalize(vec3(1.0, 1.0, 1.0));
                vec3 lightColour = vec3(1.0, 1.0, 1.0);
                float dp = max(0.0, dot(lightDir, normal));

                vec3 diffuse = dp * lightColour;
                vec3 specular = vec3(0.0);

                lighting = hemi * 0.1 + diffuse * 0.5;

                float ao = 1.0 - mix(1.0, 0.0, smoothstep(0.0, 1.0, vUV.y));
                vec3 baseColor = mix(TOP_COLOR, BOTTOM_COLOR, vUV.y);
                vec3 lightTimesTexture = vec3(1.0, 1.0, 1.0) * baseColor;

                gl_FragColor = vec4( baseColor, 1.0);
                gl_FragColor.rgb *= ao;

                //Tonemapping
                gl_FragColor.rgb = ACESFilm(gl_FragColor.rgb);

                //Gamma correction 1.0/2.2 = 0.4545...
                gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(0.4545));
                // gl_FragColor.rgb = normal;
                gl_FragColor.rgb = colorSample * ao * cloudSample;
            }
        `;

const grassMaterial = new ShaderMaterial(
  "shader",
  scene,
  {
    vertex: "tt",
    fragment: "tt",
  },
  {
    attributes: ["position", "normal", "uv", "aRandom", "aOffset", "aScale"],
    uniforms: [
      "world",
      "worldView",
      "worldViewProjection",
      "view",
      "projection",
      "viewProjection",
      "uTime",
      "sunDirection",
    ],
    samplers: ["normalMap", "grassColorTexture", "cloudMap"],
  }
);

grassMaterial.setTexture("normalMap", new Texture("/normal.png", scene));
grassMaterial.setTexture("grassColorTexture", new Texture("/grass.jpg", scene));
grassMaterial.setTexture("cloudMap", new Texture("/cloud.jpg", scene));

res.then((meshes) => {
  //   const grassMeshHigh = meshes[0];
  //   const grassMeshLow = meshes[1];

  //   const grassClones = fieldChunks.map((chunk, i) => grassMeshHigh.clone(`grassblade${i}`, null));

  //   for (let j = 0; j < NO_OF_CHUNKS; j++) {
  //     const BLADE_COUNT_PER_CHUNK = Math.floor(BLADE_COUNT / NO_OF_CHUNKS);

  //     const random = new Float32Array(1 * BLADE_COUNT_PER_CHUNK);
  //     for (let index = 0; index < random.length; index++) {
  //       random[index] = 0.5 - Math.random();
  //     }

  //     const material = new StandardMaterial(`grassMaterial-${j}`, scene);
  //     material.diffuseColor = colors[j]

  //     const grassMesh = meshes[j];

  //     const bufferMatrices = new Float32Array(16 * BLADE_COUNT_PER_CHUNK);
  //     const offset = new Float32Array(2 * BLADE_COUNT_PER_CHUNK);
  //     const scale = new Float32Array(1 * BLADE_COUNT_PER_CHUNK);
  //     for (let i = 0; i < BLADE_COUNT_PER_CHUNK; i++) {
  //       const radius = PLANE_SIZE / 2;

  //       const r = radius * Math.sqrt(Math.random());
  //       const partSize = (2 * Math.PI) / NO_OF_CHUNKS;
  //       const minAngle = j * partSize;
  //       const maxAngle = minAngle + partSize;
  //       const theta = randomIntFromInterval(minAngle, maxAngle);
  //       console.log(theta, minAngle, maxAngle);

  //       const x = r * Math.cos(theta);
  //       const y = r * Math.sin(theta);

  //       offset[i] = x / r;
  //       offset[i + 1] = y / r;

  //       scale[i] = Noise2D(x, y);

  //       const matrix1 = Matrix.Translation(x, 0, y);

  //       // const matrix1 = Matrix.Translation(x, 0, y);
  //       matrix1.copyToArray(bufferMatrices, i * 16)
  //     }

  //     if (grassMesh) {
  //       grassMesh.thinInstanceSetBuffer("aOffset", offset, 2);
  //       grassMesh.thinInstanceSetBuffer("aRandom", random, 1);
  //       grassMesh.thinInstanceSetBuffer("aScale", scale, 1);
  //       grassMesh.thinInstanceSetBuffer("matrix", bufferMatrices);
  //       grassMesh.material = material;
  //     }
  //   }

  //   grassMeshHigh.dispose();
  //   grassMeshLow.dispose();

  fieldChunks.forEach((chunk, index) => {
    const random = new Float32Array(1 * chunk.length);
    const bufferMatrices = new Float32Array(16 * chunk.length);
    const offset = new Float32Array(2 * chunk.length);
    const scale = new Float32Array(1 * chunk.length);

    for (let i = 0; i < chunk.length; i++) {
      const point = chunk[i];
      const x = point ? point[0] || 0 : 0;
      const y = point ? point[1] || 1 : 1;
      offset[i] = x;
      offset[i + 1] = y;
      scale[i] = Noise2D(x, y);

      const rotation = new Vector3(0, 0, 0);
      const Q = Quaternion.FromEulerAngles(rotation.x, rotation.y, rotation.z);
      const matrix = Matrix.Compose(
        new Vector3(1, 1, 1),
        Q,
        new Vector3(x, 0, y)
      );

      random[i] = 0.5 - Math.random();

      matrix.copyToArray(bufferMatrices, i * 16);
    }
    const grassBladeHigh = meshes[index];
    const grassBladeLow = meshes[index + NO_OF_CHUNKS];
    if (grassBladeHigh) {
    //   grassBladeHigh.addLODLevel(10, grassBladeLow);
      grassBladeHigh.thinInstanceSetBuffer("aOffset", offset, 2);
      grassBladeHigh.thinInstanceSetBuffer("aRandom", random, 1);
      grassBladeHigh.thinInstanceSetBuffer("aScale", scale, 1);
      grassBladeHigh.thinInstanceSetBuffer("matrix", bufferMatrices);
      const material = grassMaterial;
      grassBladeHigh.material = material;
      grassBladeHigh.material.backFaceCulling = false;
    }
    if (grassBladeLow) {
      grassBladeLow.thinInstanceSetBuffer("aOffset", offset, 2);
      grassBladeLow.thinInstanceSetBuffer("aRandom", random, 1);
      grassBladeLow.thinInstanceSetBuffer("aScale", scale, 1);
      grassBladeLow.thinInstanceSetBuffer("matrix", bufferMatrices);
      const material = grassMaterial;
      grassBladeLow.material = material;
      grassBladeLow.material.backFaceCulling = false;
      grassBladeLow.material.wireframe = true
    }
  });

  // grassMeshHigh.dispose()
  // grassMeshLow.dispose()
});

const startTime = Date.now();

engine.runRenderLoop(() => {
  const elapsedTime = Date.now() - startTime;
  grassMaterial?.setFloat("uTime", elapsedTime);
  scene.render();
});
