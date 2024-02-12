import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math";

// Side-effects only imports allowing the standard material to be used as default.
import "@babylonjs/core/Materials/standardMaterial";
// Side-effects only imports allowing Mesh to create default shapes (to enhance tree shaking, the construction methods on mesh are not available if the meshbuilder has not been imported).
import "@babylonjs/core/Meshes/Builders/sphereBuilder";
import "@babylonjs/core/Meshes/Builders/boxBuilder";
import "@babylonjs/core/Meshes/Builders/groundBuilder";
import "@babylonjs/loaders/glTF";
import {
  ArcRotateCamera,
  Buffer,
  Effect,
  Mesh,
  MeshBuilder,
  SSAORenderingPipeline,
  SceneLoader,
  ShaderMaterial,
  StandardMaterial,
  Texture,
  VertexData,
} from "@babylonjs/core";
import { GrassMatrial } from "./grassMat";

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

class Vector2 {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  dot(other) {
    return this.x * other.x + this.y * other.y;
  }
}

function Shuffle(arrayToShuffle) {
  for (let e = arrayToShuffle.length - 1; e > 0; e--) {
    const index = Math.round(Math.random() * (e - 1));
    const temp = arrayToShuffle[e];

    arrayToShuffle[e] = arrayToShuffle[index];
    arrayToShuffle[index] = temp;
  }
}

function MakePermutation() {
  const permutation = [];
  for (let i = 0; i < 256; i++) {
    permutation.push(i);
  }

  Shuffle(permutation);

  for (let i = 0; i < 256; i++) {
    permutation.push(permutation[i]);
  }

  return permutation;
}
const Permutation = MakePermutation();

function GetConstantVector(v) {
  // v is the value from the permutation table
  const h = v & 3;
  if (h == 0) return new Vector2(1.0, 1.0);
  else if (h == 1) return new Vector2(-1.0, 1.0);
  else if (h == 2) return new Vector2(-1.0, -1.0);
  else return new Vector2(1.0, -1.0);
}

function Fade(t) {
  return ((6 * t - 15) * t + 10) * t * t * t;
}

function Lerp(t, a1, a2) {
  return a1 + t * (a2 - a1);
}

function Noise2D(x, y) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;

  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  const topRight = new Vector2(xf - 1.0, yf - 1.0);
  const topLeft = new Vector2(xf, yf - 1.0);
  const bottomRight = new Vector2(xf - 1.0, yf);
  const bottomLeft = new Vector2(xf, yf);

  // Select a value from the permutation array for each of the 4 corners
  const valueTopRight = Permutation[Permutation[X + 1] + Y + 1];
  const valueTopLeft = Permutation[Permutation[X] + Y + 1];
  const valueBottomRight = Permutation[Permutation[X + 1] + Y];
  const valueBottomLeft = Permutation[Permutation[X] + Y];

  const dotTopRight = topRight.dot(GetConstantVector(valueTopRight));
  const dotTopLeft = topLeft.dot(GetConstantVector(valueTopLeft));
  const dotBottomRight = bottomRight.dot(GetConstantVector(valueBottomRight));
  const dotBottomLeft = bottomLeft.dot(GetConstantVector(valueBottomLeft));

  const u = Fade(xf);
  const v = Fade(yf);

  return Lerp(
    u,
    Lerp(v, dotBottomLeft, dotTopLeft),
    Lerp(v, dotBottomRight, dotTopRight)
  );
}

// // Our built-in 'ground' shape. Params: name, width, depth, subdivs, scene
// // const mat = GrassMatrial.generateField(scene, new GrassMatrial("grass", scene));

// // instancing experiment

const PLANE_SIZE = 100;
const BLADE_COUNT = 100000;
const BLADE_WIDTH = 0.1;
const BLADE_HEIGHT = 0.8;
const BLADE_HEIGHT_VARIATION = 0.6;
const MID_WIDTH = BLADE_WIDTH * 0.5;

// function generateBlade(center: Vector3, vArrOffset: number) {
//   const TIP_OFFSET = 0.1;
//   const height = BLADE_HEIGHT + Math.random() * BLADE_HEIGHT_VARIATION;

//   const yaw = 0;
//   const yawUnitVec = new Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
//   const tipBend = 0;
//   const tipBendUnitVec = new Vector3(Math.sin(tipBend), 0, -Math.cos(tipBend));

//   // Find the Bottom Left, Bottom Right, Top Left, Top right, Top Center vertex positions
//   const bl = center.add(yawUnitVec.clone().scaleInPlace((BLADE_WIDTH / 2) * 1));
//   const br = center.add(
//     yawUnitVec.clone().scaleInPlace((BLADE_WIDTH / 2) * -1)
//   );
//   const tl = center.add(yawUnitVec.clone().scaleInPlace((MID_WIDTH / 2) * 1));
//   const tr = center.add(yawUnitVec.clone().scaleInPlace((MID_WIDTH / 2) * -1));
//   const tc = center.add(tipBendUnitVec.clone().scaleInPlace(TIP_OFFSET));

//   tl.y += height / 2;
//   tr.y += height / 2;
//   tc.y += height;

//   const verts = [
//     { pos: bl.asArray(), uv: [0, 0]  },
//     { pos: br.asArray(), uv: [1, 0] },
//     { pos: tr.asArray(), uv: [0.5, 0.5]  },
//     { pos: tl.asArray(), uv: [0, 0.5]  },
//     { pos: tc.asArray(), uv: [1, 1] },
//   ];

//   const indices = [
//     vArrOffset,
//     vArrOffset + 1,
//     vArrOffset + 2,
//     vArrOffset + 2,
//     vArrOffset + 4,
//     vArrOffset + 3,
//     vArrOffset + 3,
//     vArrOffset,
//     vArrOffset + 2,
//   ];

//   return { verts, indices };
// }

// const bladeData = generateBlade(new Vector3(0, 0, 0), 0);
// const vertexData = new VertexData();
// const pos = new Float32Array(bladeData.verts.length * 3 * 3);
// const posData = bladeData.verts.map((v) => v.pos).flat();
// for (let index = 0; index < pos.length; index++) {
//   pos[index] = posData[index];
// }
// vertexData.positions = pos;
// vertexData.indices = bladeData.indices;

// const uv = new Float32Array(bladeData.verts.length * 2);
// const uvData = bladeData.verts.map((v) => v.uv).flat();
// for (let index = 0; index < uv.length; index++) {
//   uv[index] = uvData[index];
// }
// vertexData.uvs = uv;

// const normals: number[] = [];

// VertexData.ComputeNormals(vertexData.positions, vertexData.indices, normals);

// vertexData.normals = normals;
// // console.log(vertexData, "vertexData");

// const bladeMesh = new Mesh("grass-blade", scene);
// vertexData.applyToMesh(bladeMesh);
// // console.log(random);

// const random = new Float32Array(1 * BLADE_COUNT);
// for (let index = 0; index < random.length; index++) {
//   random[index] = 0.5 - Math.random();
// }

// const bufferMatrices = new Float32Array(16 * BLADE_COUNT);
// const offset = new Float32Array(2 * BLADE_COUNT);
// const scale = new Float32Array(1 * BLADE_COUNT);
// for (let i = 0; i < BLADE_COUNT; i++) {
//   const radius = PLANE_SIZE / 2;

//   const r = radius * Math.sqrt(Math.random());
//   const theta = Math.random() * 2 * Math.PI;
//   const x = r * Math.cos(theta);
//   const y = r * Math.sin(theta);

//   offset[i] = x / r;
//   offset[i + 1] = y / r;

//   scale[i] = Noise2D(x, y);

//   const rotation = new Vector3(0, Math.random() * Math.PI, 0);
//   const Q = Quaternion.FromEulerAngles(rotation.x, rotation.y, rotation.z);
//   const matrix1 = Matrix.Compose(new Vector3(1, 1, 1), Q, new Vector3(x, 0, y));

//   // const matrix1 = Matrix.Translation(x, 0, y);
//   matrix1.copyToArray(bufferMatrices, i * 16);
// }

// bladeMesh.thinInstanceSetBuffer("aOffset", offset, 2);
// bladeMesh.thinInstanceSetBuffer("aRandom", random, 1);
// bladeMesh.thinInstanceSetBuffer("aScale", scale, 1);

// bladeMesh.thinInstanceSetBuffer("matrix", bufferMatrices);

// Effect.ShadersStore["ttVertexShader"] = `
//         precision highp float;

//         // Attributes
//         attribute vec3 position;
//         attribute vec2 uv;
//         attribute vec3 color;
//         attribute vec3 normal;
//         attribute float aRandom;
//         attribute vec2 aOffset;
//         attribute float aScale;

//         // Uniforms
//         uniform mat4 viewProjection;
//         uniform float uTime;

//         // Varying
//         varying vec2 vUV;
//         varying vec3 vColor;
//         varying vec3 vNormal;
//         varying vec3 vPosition;

//         #include<instancesDeclaration>

//         vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
//         vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
//         vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

//         float cnoise(vec3 P){
//           vec3 Pi0 = floor(P); // Integer part for indexing
//           vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
//           Pi0 = mod(Pi0, 289.0);
//           Pi1 = mod(Pi1, 289.0);
//           vec3 Pf0 = fract(P); // Fractional part for interpolation
//           vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
//           vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
//           vec4 iy = vec4(Pi0.yy, Pi1.yy);
//           vec4 iz0 = Pi0.zzzz;
//           vec4 iz1 = Pi1.zzzz;

//           vec4 ixy = permute(permute(ix) + iy);
//           vec4 ixy0 = permute(ixy + iz0);
//           vec4 ixy1 = permute(ixy + iz1);

//           vec4 gx0 = ixy0 / 7.0;
//           vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
//           gx0 = fract(gx0);
//           vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
//           vec4 sz0 = step(gz0, vec4(0.0));
//           gx0 -= sz0 * (step(0.0, gx0) - 0.5);
//           gy0 -= sz0 * (step(0.0, gy0) - 0.5);

//           vec4 gx1 = ixy1 / 7.0;
//           vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
//           gx1 = fract(gx1);
//           vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
//           vec4 sz1 = step(gz1, vec4(0.0));
//           gx1 -= sz1 * (step(0.0, gx1) - 0.5);
//           gy1 -= sz1 * (step(0.0, gy1) - 0.5);

//           vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
//           vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
//           vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
//           vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
//           vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
//           vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
//           vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
//           vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

//           vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
//           g000 *= norm0.x;
//           g010 *= norm0.y;
//           g100 *= norm0.z;
//           g110 *= norm0.w;
//           vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
//           g001 *= norm1.x;
//           g011 *= norm1.y;
//           g101 *= norm1.z;
//           g111 *= norm1.w;

//           float n000 = dot(g000, Pf0);
//           float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
//           float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
//           float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
//           float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
//           float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
//           float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
//           float n111 = dot(g111, Pf1);

//           vec3 fade_xyz = fade(Pf0);
//           vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
//           vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
//           float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
//           return 2.2 * n_xyz;
//         }

//         void main(void) {
//             #include<instancesVertex>
//             float waveSize = 10.0f;
//             float tipDistance = 0.3f;
//             float centerDistance = 0.1f;

//             vec3 cpos = position;

//             float wind = cnoise(vec3(aOffset.x, aOffset.y, uTime * 0.0005));

//             float cosRotation = cos(aRandom * 3.14);
//             float sinRotation = sin(aRandom * 3.14);
//             mat3 rotationMatrix = mat3(
//                 cosRotation, 0.0, sinRotation,
//                 0.0, 1.0, 0.0,
//                 -sinRotation, 0.0, cosRotation
//             );

//             vec3 norm = normalize(cross(position, vec3(0.0, 1.0, 0.0)));
//             cpos = rotationMatrix * cpos;
//             norm = rotationMatrix * norm;

//             cpos.x += wind * cpos.y * 0.15;
//             cpos.z += wind * cpos.y * 0.15;
//             cpos.y *= 1. +  aScale * 0.5;
//             vec4 wNorm = finalWorld * vec4(norm, 1.0);
//             gl_Position = viewProjection * finalWorld * vec4(cpos, 1.0);

//             vUV = uv;
//             vColor = color;
//             vNormal = wNorm.xyz;
//             vPosition = gl_Position.xyz;
//         }
//     `;
// Effect.ShadersStore["ttFragmentShader"] = `
//         precision highp float;

//         varying vec2 vUV;
//         varying vec3 vColor;
//         varying vec3 vNormal;
//         varying vec3 vPosition;

//         uniform vec3 sunDirection;
//         uniform sampler2D normalMap;

//         vec3 ACESFilm(vec3 x){
//           float a = 2.51;
//           float b = 0.03;
//           float c = 2.43;
//           float d = 0.59;
//           float e = 0.14;
//           return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
//         }

//         float inverseLerp(float v, float minValue, float maxValue) {
//           return (v - minValue) / (maxValue - minValue);
//         }

//         float remap(float v, float inMin, float inMax, float outMin, float outMax) {
//           float t = inverseLerp(v, inMin, inMax);
//           return mix(outMin, outMax, t);
//         }

//         float exponentialIn(float t) {
//           return t == 0.0 ? t : pow(2.0, 10.0 * (t - 1.0));
//         }

//         float quadraticIn(float t) {
//           return t * t;
//         }        

//         void main(void) {
//           vec3 BOTTOM_COLOR = vec3(0.83, 1.0, 0.0);
//           vec3 TOP_COLOR = vec3(0.019, 0.47, 0.14);

//             vec3 normal = vNormal;
//             if(gl_FrontFacing){
//               normal = normalize(normal);
//             }else{
//               normal = normalize(-normal);
//             }

//             vec3 lighting = vec3(0.0);

//             vec3 skyColour = vec3(0.0, 0.3, 0.6);
//             vec3 groundColour = vec3(0.6, 0.3, 0.1);

//             vec3 hemi = mix(groundColour, skyColour, remap(normal.y, -1.0, 1.0, 0.0, 1.0));

//             vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
//             vec3 lightColour = vec3(1.0, 1.0, 1.0);
//             float dp = max(0.0, dot(lightDir, normal));

//             vec3 diffuse = dp * lightColour;
//             vec3 specular = vec3(0.0);

//             lighting = hemi * 0.3 + diffuse ;

//             float ao = 1.0 - mix(1.0, 0.0, smoothstep(0.0, 1.0, vUV.y));

//             // vec3 dirtColor = vec3(0.58, 0.29, 0.0);
//             vec3 baseColor = mix(TOP_COLOR, BOTTOM_COLOR, vUV.y);
//             // vec3 lightTimesTexture = vec3(1.0, 1.0, 1.0) * baseColor;

//             gl_FragColor = vec4(baseColor * lighting  , 1.0);
//             gl_FragColor.rgb *= ao;

//             //Tonemapping
//             gl_FragColor.rgb = ACESFilm(gl_FragColor.rgb);

//             //Gamma correction 1.0/2.2 = 0.4545...
//             gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(0.4545));
//             // gl_FragColor.rgb = vNormal;
//         }
//     `;

// const mat = new ShaderMaterial(
//   "shader",
//   scene,
//   {
//     vertex: "tt",
//     fragment: "tt",
//   },
//   {
//     attributes: ["position", "normal", "uv", "aRandom", "aOffset", "aScale"],
//     uniforms: [
//       "world",
//       "worldView",
//       "worldViewProjection",
//       "view",
//       "projection",
//       "viewProjection",
//       "uTime",
//       "sunDirection"
//     ],
//     samplers: ["normalMap"],
//   }
// );
// bladeMesh.material = mat;
// // bladeMesh.addLODLevel(15, bladeMesh);
// mat.backFaceCulling = false;
// const azimuth = 0.4;
// const elevation = 0.2;
// const sunDirection = new Vector3(Math.sin(azimuth), Math.sin(elevation), -Math.cos(azimuth));
// mat.setVector3("sunDirection", sunDirection);
// mat.setTexture("normalMap", new Texture("/normal.png", scene));



let mat;
SceneLoader.ImportMesh(
  "",
  "/",
  "grassBlade.glb",
  scene,
  function (newMeshes) {
    console.log(newMeshes, "ASDASD");

    const mesh = newMeshes.find((m) => m.name === "3steps");

    console.log(mesh);
    if (!mesh) return;

    const random = new Float32Array(1 * BLADE_COUNT);
    for (let index = 0; index < random.length; index++) {
      random[index] = 0.5 - Math.random();
    }

    const bufferMatrices = new Float32Array(16 * BLADE_COUNT);
    const offset = new Float32Array(2 * BLADE_COUNT);
    const scale = new Float32Array(1 * BLADE_COUNT);
    for (let i = 0; i < BLADE_COUNT; i++) {
      const radius = PLANE_SIZE / 2;

      const r = radius * Math.sqrt(Math.random());
      const theta = Math.random() * 2 * Math.PI;
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);

      offset[i] = x / r;
      offset[i + 1] = y / r;

      scale[i] = Noise2D(x, y);

      const rotation = new Vector3(0, Math.random() * Math.PI, 0);
      const Q = Quaternion.FromEulerAngles(rotation.x, rotation.y, rotation.z);
      const matrix1 = Matrix.Compose(
        new Vector3(1, 1, 1),
        Q,
        new Vector3(x, 0, y)
      );

      // const matrix1 = Matrix.Translation(x, 0, y);
      matrix1.copyToArray(bufferMatrices, i * 16);
    }
    mesh.thinInstanceSetBuffer("aOffset", offset, 2);
    mesh.thinInstanceSetBuffer("aRandom", random, 1);
    mesh.thinInstanceSetBuffer("aScale", scale, 1);

    mesh.thinInstanceSetBuffer("matrix", bufferMatrices);

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

                float wind = cnoise(vec3(aOffset.x, aOffset.y, uTime * 0.0005));

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
                cpos.y *= 1.0 + aScale * 0.5;
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

                vec2 globalUV = vPosition.xz + 50.0;
                vec3 colorSample = texture2D(grassColorTexture, globalUV/100.).rgb;
                vec3 cloudSample = texture2D(cloudMap, globalUV/100. + uTime * 0.0001).rgb;

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

    mat = new ShaderMaterial(
      "shader",
      scene,
      {
        vertex: "tt",
        fragment: "tt",
      },
      {
        attributes: [
          "position",
          "normal",
          "uv",
          "aRandom",
          "aOffset",
          "aScale",
        ],
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
    mesh.material = mat;
    // bladeMesh.addLODLevel(15, bladeMesh);
    mat.backFaceCulling = false;
    const azimuth = 0.4;
    const elevation = 0.2;
    const sunDirection = new Vector3(
      Math.sin(azimuth),
      Math.sin(elevation),
      -Math.cos(azimuth)
    );
    mat.setVector3("sunDirection", sunDirection);
    mat.setTexture("normalMap", new Texture("/normal.png", scene));
    mat.setTexture("grassColorTexture", new Texture("/grass.jpg", scene));
    mat.setTexture("cloudMap", new Texture("/cloud.jpg", scene));
  },
  (e) => {
    console.log(e);
  },
  (scene, error) => {
    console.log(error);
  },
  ".glb"
);

// const createGrassBlade = ({
//   width,
//   height,
//   segments = 1,
// }: {
//   width: number;
//   height: number;
//   segments?: number;
// }) => {
//   const grassWidth = width || 0.1;
//   const grasHeight = height || 1;

//   const vertices = new Float32Array((segments * 2 + 1) * 3 * 3);
//   const indices = [];
//   const normals = [];

//   for (let index = 0; index < segments; index++) {
//     const x1 = -width / 2;
//     const x2 = width / 2;

//     const y = (grasHeight * index) / segments;

//     vertices[index] = x1;
//     vertices[index + 1] = y;
//     vertices[index + 2] = 0;
//     vertices[index + 3] = x2;
//     vertices[index + 4] = y;
//     vertices[index + 5] = 0;

//     if(index < segments - 1) {
//       indices.push(index, index + 1, index + 2);
//       indices.push(index + 2, index + 1, index + 3);
//     }
//   }

//   // // vertices.push(0, grasHeight, 0);
//   vertices[vertices.length - 3] = 0;
//   vertices[vertices.length - 2] = grasHeight;
//   vertices[vertices.length - 1] = 0;

//   indices.push()

//   indices[segments * 2] = segments * 2
//   indices[segments * 2 - 1] = segments * 2 - 1
//   indices[segments * 2 - 2] = segments * 2 - 2

//   const blade = new Mesh("blade", scene);
//   const vertexData = new VertexData();
//   vertexData.positions = vertices;
//   vertexData.indices = indices;
//   vertexData.applyToMesh(blade);
//   console.log(vertexData);

// };

// createGrassBlade({ width: 0.5, height: 1, segments: 3 });

// mat.wireframe = true

// const grassGeometry = MeshBuilder.CreateGround(
//   "grassGeometryHigh",
//   { width: BLADE_WIDTH, height: BLADE_HEIGHT, subdivisionsY: 5 },
//   scene
// );
// const grassGeometry2 = MeshBuilder.CreateGround(
//   "grassGeometryMed",
//   { width: BLADE_WIDTH, height: BLADE_HEIGHT, subdivisionsY: 3 },
//   scene
// );
// const grassGeometry3 = MeshBuilder.CreateGround(
//   "grassGeometryLow",
//   { width: BLADE_WIDTH, height: BLADE_HEIGHT, subdivisionsY: 1 },
//   scene
// );
// // grassGeometry.rotation.x = Math.PI / 2;
// // grassGeometry2.rotation.x = Math.PI / 2;
// // grassGeometry3.rotation.x = Math.PI / 2;

// // grassGeometry.addLODLevel(10, grassGeometry2);
// // grassGeometry.addLODLevel(20, grassGeometry3);

// // const grassMat = new StandardMaterial("grassMaterialHigh", scene);

// const random = new Float32Array(1 * BLADE_COUNT);
// for (let index = 0; index < random.length; index++) {
//   random[index] = 0.5 - Math.random();
// }

// const bufferMatrices = new Float32Array(16 * BLADE_COUNT);
// const offset = new Float32Array(2 * BLADE_COUNT);
// const scale = new Float32Array(1 * BLADE_COUNT);
// for (let i = 0; i < BLADE_COUNT; i++) {
//   const radius = PLANE_SIZE / 2;

//   const r = radius * Math.sqrt(Math.random());
//   const theta = Math.random() * 2 * Math.PI;
//   const x = r * Math.cos(theta);
//   const y = r * Math.sin(theta);

//   offset[i] = x / r;
//   offset[i + 1] = y / r;

//   scale[i] = Noise2D(x, y);

//   const rotation = new Vector3(-Math.PI / 2, Math.random() * Math.PI, 0);
//   const Q = Quaternion.FromEulerAngles(rotation.x, rotation.y, rotation.z);
//   const matrix1 = Matrix.Compose(new Vector3(1,1,1), Q, new Vector3(x, 0, y));
//   matrix1.copyToArray(bufferMatrices, i * 16);
// }
// grassGeometry.thinInstanceSetBuffer("aOffset", offset, 2);
// // grassGeometry.thinInstanceSetBuffer("aRandom", random, 1);
// grassGeometry.thinInstanceSetBuffer("aScale", scale, 1);

// grassGeometry2.thinInstanceSetBuffer("aOffset", offset, 2);
// // grassGeometry2.thinInstanceSetBuffer("aRandom", random, 1);
// grassGeometry2.thinInstanceSetBuffer("aScale", scale, 1);

// grassGeometry3.thinInstanceSetBuffer("aOffset", offset, 2);
// // grassGeometry3.thinInstanceSetBuffer("aRandom", random, 1);
// grassGeometry3.thinInstanceSetBuffer("aScale", scale, 1);

// grassGeometry.thinInstanceSetBuffer("matrix", bufferMatrices);
// grassGeometry2.thinInstanceSetBuffer("matrix", bufferMatrices);
// grassGeometry3.thinInstanceSetBuffer("matrix", bufferMatrices);

// Effect.ShadersStore["ttVertexShader"] = `
//         precision highp float;

//         // Attributes
//         attribute vec3 position;
//         attribute vec2 uv;
//         attribute vec3 color;
//         attribute vec3 normal;
//         attribute float aRandom;
//         attribute vec2 aOffset;
//         attribute float aScale;

//         // Uniforms
//         uniform mat4 viewProjection;
//         uniform float uTime;

//         // Varying
//         varying vec2 vUV;
//         varying vec3 vColor;
//         varying vec3 vNormal;
//         varying vec3 vPosition;

//         #include<instancesDeclaration>

//         vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
//         vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
//         vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

//         float cnoise(vec3 P){
//           vec3 Pi0 = floor(P); // Integer part for indexing
//           vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
//           Pi0 = mod(Pi0, 289.0);
//           Pi1 = mod(Pi1, 289.0);
//           vec3 Pf0 = fract(P); // Fractional part for interpolation
//           vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
//           vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
//           vec4 iy = vec4(Pi0.yy, Pi1.yy);
//           vec4 iz0 = Pi0.zzzz;
//           vec4 iz1 = Pi1.zzzz;

//           vec4 ixy = permute(permute(ix) + iy);
//           vec4 ixy0 = permute(ixy + iz0);
//           vec4 ixy1 = permute(ixy + iz1);

//           vec4 gx0 = ixy0 / 7.0;
//           vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
//           gx0 = fract(gx0);
//           vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
//           vec4 sz0 = step(gz0, vec4(0.0));
//           gx0 -= sz0 * (step(0.0, gx0) - 0.5);
//           gy0 -= sz0 * (step(0.0, gy0) - 0.5);

//           vec4 gx1 = ixy1 / 7.0;
//           vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
//           gx1 = fract(gx1);
//           vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
//           vec4 sz1 = step(gz1, vec4(0.0));
//           gx1 -= sz1 * (step(0.0, gx1) - 0.5);
//           gy1 -= sz1 * (step(0.0, gy1) - 0.5);

//           vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
//           vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
//           vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
//           vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
//           vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
//           vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
//           vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
//           vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

//           vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
//           g000 *= norm0.x;
//           g010 *= norm0.y;
//           g100 *= norm0.z;
//           g110 *= norm0.w;
//           vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
//           g001 *= norm1.x;
//           g011 *= norm1.y;
//           g101 *= norm1.z;
//           g111 *= norm1.w;

//           float n000 = dot(g000, Pf0);
//           float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
//           float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
//           float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
//           float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
//           float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
//           float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
//           float n111 = dot(g111, Pf1);

//           vec3 fade_xyz = fade(Pf0);
//           vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
//           vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
//           float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
//           return 2.2 * n_xyz;
//         }

//         void main(void) {
//             #include<instancesVertex>
//             float waveSize = 10.0f;
//             float tipDistance = 0.3f;
//             float centerDistance = 0.1f;

//             vec3 cpos = position;

//             float wind = cnoise(vec3(aOffset.x, aOffset.y, uTime * 0.0005));

//             // float cosRotation = cos(aRandom * 3.14);
//             // float sinRotation = sin(aRandom * 3.14);
//             // mat3 rotationMatrix = mat3(
//             //     cosRotation, 0.0, sinRotation,
//             //     1.0, 1.0, 1.0,
//             //     -sinRotation, 0.0, cosRotation
//             // );

//             // cpos = rotationMatrix * cpos;

//             cpos.x += wind * cpos.y * 0.55;
//             cpos.z += wind * cpos.y * 0.55;
//             cpos.y *= 1. +  aScale * 0.5;
//             gl_Position = viewProjection * finalWorld * vec4(cpos, 1.0);

//             vUV = uv;
//             vColor = color;
//             vNormal = normal;
//             vPosition = position;
//         }
//     `;
// Effect.ShadersStore["ttFragmentShader"] = `
//         precision highp float;

//         varying vec2 vUV;
//         varying vec3 vColor;
//         varying vec3 vNormal;
//         varying vec3 vPosition;

//         uniform sampler2D diffuseSampler;
//         uniform sampler2D alphaMap;

//         void main(void) {
//             vec4 alphaMapColor = texture2D(alphaMap, vUV);
//             if(alphaMapColor.r < 0.15){
//               discard;
//             }
//             vec3 BOTTOM_COLOR = vec3(0.83, 1.0, 0.0);
//             vec3 TOP_COLOR = vec3(0.019, 0.47, 0.14);
//             float ao = mix(1.0, 0.7, smoothstep(0.0, 1.0, vPosition.y));
//             vec4 baseColor = texture2D(diffuseSampler, vUV);
//             gl_FragColor = baseColor;
//             gl_FragColor.a = 1.0;
//             gl_FragColor = gl_FragColor * ao;
//         }
//     `;

// const grassMat = new ShaderMaterial(
//   "shader",
//   scene,
//   {
//     vertex: "tt",
//     fragment: "tt",
//   },
//   {
//     attributes: ["position", "normal", "uv", "aRandom", "aOffset", "aScale"],
//     uniforms: [
//       "world",
//       "worldView",
//       "worldViewProjection",
//       "view",
//       "projection",
//       "viewProjection",
//       "uTime"
//     ],
//     samplers: ["diffuseSampler", "alphaMap"],
//     needAlphaBlending: true,
//   }
// );

// grassMat.setTexture("diffuseSampler", new Texture("https://al-ro.github.io/images/grass/blade_diffuse.jpg", scene))
// grassMat.setTexture("alphaMap", new Texture("https://al-ro.github.io/images/grass/blade_alpha.jpg", scene))
// grassGeometry.material = grassMat;
// grassGeometry2.material = grassMat;
// grassGeometry3.material = grassMat;
// grassMat.backFaceCulling = false;
// grassMat.forceDepthWrite = true
// grassMat.wireframe = true

// const createGrassBlade = ({width, height, segments = 1},scene) => {
//   const grassWidth = width || 0.1;
//   const grasHeight = height || 1;
//   const numOfVertices = (segments * 2) + 2
//   const numOfTris = ((segments - 1) * 2) + 1
//   const vertices = new Float32Array(numOfVertices * 3 * 3);
//   const indices = [];
//   const normals = [];

//   for(let i = 0; i < segments+1; i++) {
//       const x1 = -grassWidth/2
//       const x2 = grassWidth/2

//       const y = grasHeight * i/segments;

//       vertices[i*6] = x1
//       vertices[i*6+1] = y
//       vertices[i*6+2] = 0

//       vertices[i*6+3] = x2
//       vertices[i*6+4] = y
//       vertices[i*6+5] = 0

//       if(i < segments  ){
//           indices.push(i*2, i*2+1, i*2+2)
//           indices.push(i*2+2, i*2+3, i*2+1)
//       }
//   }

//   const blade = new Mesh("blade", scene);

//   const vertexData = new VertexData()

//   vertexData.positions = vertices
//   vertexData.indices

//   vertexData.applyToMesh(blade)

//   console.log(vertices, indices)
// }

// createGrassBlade({width: 0.1, height: 1, segments: 3}, scene)

camera.setTarget(new Vector3(0, 1, 0));
const startTime = Date.now();
engine.runRenderLoop(() => {
  const elapsedTime = Date.now() - startTime;
  mat?.setFloat("uTime", elapsedTime);
  scene.render();
});
