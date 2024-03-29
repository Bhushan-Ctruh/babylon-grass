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
import Stats from "stats.js";
import MersenneTwister from "mersenne-twister";

import {
  AbstractMesh,
  Effect,
  Mesh,
  MeshBuilder,
  SceneLoader,
  ShaderMaterial,
  Texture,
  type Nullable,
  BoundingBox,
  UniversalCamera,
  ToHalfFloat,
  StandardMaterial,
  VertexBuffer,
  VertexData,
} from "@babylonjs/core";
import { Noise2D, chunkRectangleCentered, positionWithinChunk } from "./util";

const PLANE_SIZE = 60;
const BLADE_COUNT = 40000;

const NO_OF_CHUNKS = 12;

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new Engine(canvas);
const scene = new Scene(engine);

// This creates and positions a free camera (non-mesh)
// const camera = new ArcRotateCamera(
//   "camera",
//   0,
//   0,
//   0,
//   new Vector3(26.4, 32.5, 7.8),
//   scene
// );

const camera = new UniversalCamera("camera", new Vector3(0, 9, 0), scene);

const grassData = positionWithinChunk(
  BLADE_COUNT,
  chunkRectangleCentered(PLANE_SIZE, PLANE_SIZE, NO_OF_CHUNKS)
);
console.log(grassData);

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

const ground = MeshBuilder.CreateGround(
  "ground",
  { width: PLANE_SIZE, height: PLANE_SIZE },
  scene
);

class GrassMaterial {
  private grassColorTexture: Nullable<Texture> = null;
  private cloudTexture: Nullable<Texture> = null;

  public material: ShaderMaterial;

  constructor(
    name: "grass",
    { planeSize }: { planeSize: number },
    scene: Scene
  ) {
    this.grassColorTexture = new Texture("/grass.jpg", scene);
    this.cloudTexture = new Texture("/cloud.jpg", scene);

    Effect.ShadersStore[`${name}VertexShader`] = `
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
    Effect.ShadersStore[`${name}FragmentShader`] = `
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

                vec2 globalUV = vPosition.xz + ${(planeSize / 2).toFixed(2)};
                vec3 colorSample = texture2D(grassColorTexture, globalUV/${planeSize.toFixed(
                  2
                )}).rgb;
                vec3 cloudSample = texture2D(cloudMap, globalUV/${planeSize.toFixed(
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

    this.material = new ShaderMaterial(
      `${name}_shader`,
      scene,
      {
        vertex: name,
        fragment: name,
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
        ],
        samplers: ["grassColorTexture", "cloudMap"],
      }
    );

    this.material.setTexture("grassColorTexture", this.grassColorTexture);
    this.material.setTexture("cloudMap", this.cloudTexture);
  }

  setGrassColorTexture(texture: Texture) {
    this.material.setTexture("grassColorTexture", texture);
    this.grassColorTexture = texture;
  }

  setCloudTexture(texture: Texture) {
    this.material.setTexture("cloudMap", texture);
    this.cloudTexture = texture;
  }
}

// const fieldChunks = divideRectangleIntoChunks(
//   PLANE_SIZE,
//   PLANE_SIZE,
//   NO_OF_CHUNKS / 2,
//   NO_OF_CHUNKS / 2,
//   80,
//   80
// );

const grassMaterial = new GrassMaterial(
  "grass",
  { planeSize: PLANE_SIZE },
  scene
);

class GrassTile {
  private random: Float32Array;
  private bufferMatrices: Float32Array;
  private offset: Float32Array;
  private scale: Float32Array;
  public mesh: Mesh;
  private scene: Scene;

  private LODMeshLow: Nullable<Mesh> = null;

  private cameraPos: Vector3 = new Vector3();

  private boundingBox: Nullable<BoundingBox> = null;

  private LODLeveles = new Map<number, Mesh>();

  constructor(params: {
    random: Float32Array;
    bufferMatrices: Float32Array;
    offset: Float32Array;
    scale: Float32Array;
    mesh: Mesh;
    scene: Scene;
  }) {
    this.random = params.random;
    this.bufferMatrices = params.bufferMatrices;
    this.offset = params.offset;
    this.scale = params.scale;
    this.mesh = params.mesh;
    this.scene = params.scene;
    this.generateTile();
  }

  private generateTile() {
    this.mesh.thinInstanceSetBuffer("aOffset", this.offset, 2);
    this.mesh.thinInstanceSetBuffer("aRandom", this.random, 1);
    this.mesh.thinInstanceSetBuffer("aScale", this.scale, 1);
    this.mesh.thinInstanceSetBuffer("matrix", this.bufferMatrices);
  }

  private colorCode: Nullable<{ name: string; color: Color3 }> = null;
  public setColorCode(name: string, color: Color3) {
    this.colorCode = { name, color };
    // this.LODMeshLow.material.diffuseColor = color;
  }

  private checkLOD = () => {
    if (!this.boundingBox) return;
    const cameraPositionXZ = this.cameraPos.set(
      camera.position.x,
      0,
      camera.position.z
    );

    const distance = Vector3.Distance(
      cameraPositionXZ,
      this.boundingBox.centerWorld
    );

    if (distance > 40) {
      this.LODMeshLow?.setEnabled(true);
      this.mesh.setEnabled(false);
    } else {
      this.LODMeshLow?.setEnabled(false);
      this.mesh.setEnabled(true);
    }
  };

  public setBoundingBox({ min, max }: { min: Vector3; max: Vector3 }) {
    this.boundingBox = new BoundingBox(min, max);
    const camera = this.scene.activeCamera;
    if (!camera) throw new Error("Scene does not have an active camera");

    camera.onViewMatrixChangedObservable.add(this.checkLOD);
  }

  addLOD(distance: number, mesh: Mesh) {
    this.LODLeveles.set(distance, mesh);
    mesh.thinInstanceSetBuffer("aOffset", this.offset, 2);
    mesh.thinInstanceSetBuffer("aRandom", this.random, 1);
    mesh.thinInstanceSetBuffer("aScale", this.scale, 1);
    mesh.thinInstanceSetBuffer("matrix", this.bufferMatrices);
    // mesh.material = new StandardMaterial("ahs", this.scene);
    mesh.material = this.mesh.material;
    // mesh.material.diffuseColor = new Color3(1.0, 0.0, 0.0);

    mesh.material.backFaceCulling = false;
    this.LODMeshLow = mesh;
    this.checkLOD();
  }
}

const loadLOD1 = (numOfChunks: number) =>
  new Array(numOfChunks)
    .fill(null)
    .map(() => loadGrassMesh("/", "grassBladeHigh.glb"));
const loadLOD2 = (numOfChunks: number) =>
  new Array(numOfChunks)
    .fill(null)
    .map(() => loadGrassMesh("/", "grassBladeLow2.glb"));

const res = Promise.all([...loadLOD1(NO_OF_CHUNKS), ...loadLOD2(NO_OF_CHUNKS)]);

res.then((meshes) => {
  grassData.forEach(({ dataPoints, size }, index) => {
    const random = new Float32Array(1 * dataPoints.length);
    const bufferMatrices = new Float32Array(16 * dataPoints.length);
    const offset = new Float32Array(2 * dataPoints.length);
    const scale = new Float32Array(1 * dataPoints.length);

    for (let i = 0; i < dataPoints.length; i++) {
      const point = dataPoints[i];
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
    const grassBladeHigh = meshes[index] as Mesh;

    const grassBladeLow = meshes[index + NO_OF_CHUNKS] as Mesh;

    const tile = new GrassTile({
      random,
      bufferMatrices,
      offset,
      scale,
      mesh: grassBladeHigh,
      scene,
    });
    tile.mesh.material = grassMaterial.material;
    tile.mesh.material.backFaceCulling = false;
    tile.setBoundingBox({
      min: new Vector3(size.min.x, 0, size.min.z),
      max: new Vector3(size.max.x, 0, size.max.z),
    });

    tile.addLOD(50, grassBladeLow);

    tile.setColorCode(
      `tile-${index}`,
      new Color3(Math.random(), Math.random(), Math.random())
    );
  });
});

const NUM_BUGS = 8;
const NUM_SEGMENTS = 2;
const NUM_VERTICES = (NUM_SEGMENTS + 1) * 2;
const BUG_SPAWN_RANGE = 5.0;
const BUG_MAX_DIST = 10.0;

const rng = new MersenneTwister(1);

console.log(rng);

const offsets = new Float32Array(NUM_BUGS * 3);
const bufferMatrices = new Float32Array(NUM_BUGS * 16);
for (let i = 0; i < NUM_BUGS; ++i) {
  offsets[i * 3 + 0] = ToHalfFloat(
    (rng.random() * 2.0 - 1.0) * (BUG_SPAWN_RANGE / 2)
  );
  offsets[i * 3 + 1] = ToHalfFloat(rng.random() * 1.0 + 2.0);
  offsets[i * 3 + 2] = ToHalfFloat(
    (rng.random() * 2.0 - 1.0) * (BUG_SPAWN_RANGE / 2)
  );

  const borderSize = PLANE_SIZE * 0.85

  const rotation = new Vector3(0, 0, 0);
  const Q = Quaternion.FromEulerAngles(rotation.x, rotation.y, rotation.z);
  const matrix = Matrix.Compose(
    new Vector3(1, 1, 1),
    Q,
    new Vector3(Math.random() * borderSize - borderSize/2, 10, Math.random() * borderSize - borderSize/2 )
  );

  matrix.copyToArray(bufferMatrices, i * 16);
}

const moth = MeshBuilder.CreateGround(
  "moth-geom",
  { width: 1, height: 1, subdivisionsX: 2, subdivisionsY: 1 },
  scene
);

const mothVertices = moth.getVerticesData(VertexBuffer.PositionKind, true, true)
const mothUvs = moth.getVerticesData(VertexBuffer.UVKind, true, true)
const mothNormals = moth.getVerticesData(VertexBuffer.NormalKind)
const mothIndices = moth.getIndices(true, true)

const mothMesh = new Mesh("moth-mesh", scene)
const vertexdata = new VertexData()
vertexdata.positions = mothVertices
vertexdata.uvs = mothUvs 
vertexdata.indices = mothIndices
vertexdata.normals = mothNormals

moth.dispose();

vertexdata.applyToMesh(mothMesh)

mothMesh.thinInstanceSetBuffer("matrix", bufferMatrices);
mothMesh.thinInstanceSetBuffer("aOffset", offsets, 3);

// const mothMat = new StandardMaterial("moth-mat", scene);
// mothMat.backFaceCulling = false;
// mothMat.wireframe = true;
// moth.material = mothMat;

Effect.ShadersStore[`mothVertexShader`] = `
            precision highp float;

            // Attributes
            attribute vec3 position;
            attribute vec2 uv;
            attribute vec3 normal;
            attribute vec3 aOffset;

            // Uniforms
            uniform mat4 viewProjection;
            uniform float uTime;

            // Varying
            varying vec2 vUV;
            varying vec3 vNormal;
            varying vec3 vPosition;

            #include<instancesDeclaration>

            uvec4 murmurHash42(uvec2 src) {
                const uint M = 0x5bd1e995u;
                uvec4 h = uvec4(1190494759u, 2147483647u, 3559788179u, 179424673u);
                src *= M; src ^= src>>24u; src *= M;
                h *= M; h ^= src.x; h *= M; h ^= src.y;
                h ^= h>>13u; h *= M; h ^= h>>15u;
                return h;
            }
            
            // 4 outputs, 2 inputs
            vec4 hash42(vec2 src) {
                uvec4 h = murmurHash42(floatBitsToUint(src));
                return uintBitsToFloat(h & 0x007fffffu | 0x3f800000u) - 1.0;
            }

            mat4 rotationMatrix(vec3 axis, float angle) {
                axis = normalize(axis);
                float s = sin(angle);
                float c = cos(angle);
                float oc = 1.0 - c;
                
                return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                            oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                            oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                            0.0,                                0.0,                                0.0,                                1.0);
            }

            mat4 rotateY(float angle){
                return rotationMatrix(vec3(0., 1., 0.), angle);
            }

            float bnoise( in float x ){
                float i = floor(x);
                float f = fract(x);
                float s = sign(fract(x/2.0)-0.5);
                float k = fract(i*.1731);
                return s*f*(f-1.0)*((16.0*k-4.0)*f*(f-1.0)-1.0);
            }

            
            void main(void) {
                #include<instancesVertex>

                vec3 transformed = position;    

                vec4 bugHashVal = hash42(aOffset.xz);

                float BUG_SCALE = mix(0.55, 1.0, bugHashVal.z);
                transformed *= BUG_SCALE;

                const float FLAP_SPEED = 20.0;
                float flapTimeSample = uTime * FLAP_SPEED + bugHashVal.x * 100.0;
                transformed.y += mix(0.0, sin(flapTimeSample), abs(position.x)) * BUG_SCALE;
                transformed.x *= abs(cos(flapTimeSample));

                float TIME_PERIOD = 20.0;
                float repeatingTime = TIME_PERIOD * 0.5 - abs(mod(uTime, TIME_PERIOD) - TIME_PERIOD * 0.5);

                float height = bnoise(uTime * 1.5  + bugHashVal.x * 100.0);

                float loopTime = uTime * 0.002 + bugHashVal.x * 123.23;
                float loopSize = 5.0;

                vec3 bugsOffset = vec3(sin(loopTime) * loopSize,  height, cos(loopTime) * loopSize) + aOffset;

                vec2 translatedPosition = transformed.xz - vec2(5.0, 5.0);

                float cosAngle = cos(-loopTime + 3.14 / 2.0);
                float sinAngle = sin(-loopTime + 3.14 / 2.0);
                vec2 rotatedPosition = vec2(
                    translatedPosition.x * cosAngle - translatedPosition.y * sinAngle,
                    translatedPosition.x * sinAngle + translatedPosition.y * cosAngle
                );

                vec2 finalPosition = rotatedPosition + vec2(5.0, 5.0);

                transformed.x += finalPosition.x;
                transformed.z += finalPosition.y;
    
                // transformed += bugsOffset * 0.0001;


                vec4 wPos =  finalWorld * vec4(transformed, 1.0);
                vec4 wNorm = finalWorld * vec4(normal, 0.0);
                gl_Position = viewProjection * wPos;

                vUV = uv;
                vNormal = wNorm.xyz;
                vPosition = wPos.xyz;
            }
        `;
Effect.ShadersStore[`mothFragmentShader`] = `
            precision highp float;

            varying vec2 vUV;
            varying vec3 vNormal;
            varying vec3 vPosition;

            uniform float uTime;
            uniform sampler2D diffuseTexture;

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

                vec3 normal = vNormal ;
            
                vec4 diffuse = texture2D(diffuseTexture,vUV );

                gl_FragColor = diffuse;

                //Tonemapping
                // gl_FragColor.rgb = ACESFilm(gl_FragColor.rgb);

                //Gamma correction 1.0/2.2 = 0.4545...
                // gl_FragColor.rgb = pow(gl_FragColor.rgb, vec3(0.4545));
                // gl_FragColor.rgb = normal;
            }
        `;

const material = new ShaderMaterial(
  `moth_shader`,
  scene,
  {
    vertex: "moth",
    fragment: "moth",
  },
  {
    attributes: ["position", "normal", "uv", "aOffset"],
    uniforms: [
      "world",
      "worldView",
      "worldViewProjection",
      "view",
      "projection",
      "viewProjection",
      "uTime",
    ],
    samplers: ["diffuseTexture"],
    needAlphaBlending: true
  }
);
material.backFaceCulling = false
mothMesh.material = material

const mothTexture = new Texture("/moth.png", scene)
material.setTexture("diffuseTexture", mothTexture)


// const geo = new THREE.InstancedBufferGeometry();
//     geo.instanceCount = NUM_BUGS;
//     geo.setAttribute('position', plane.attributes.position);
//     geo.setAttribute('uv', plane.attributes.uv);
//     geo.setAttribute('normal', plane.attributes.normal);
//     geo.setAttribute('offset', new InstancedFloat16BufferAttribute(offsets, 3));
//     geo.setIndex(plane.index);
//     geo.rotateX(-Math.PI / 2);
//     geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), BUG_SPAWN_RANGE);

const startTime = Date.now();

const stats = new Stats();
stats.showPanel(1); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);

engine.runRenderLoop(() => {
  stats.begin();
  const elapsedTime = Date.now() - startTime;
  grassMaterial.material?.setFloat("uTime", elapsedTime);
  material.setFloat("uTime", elapsedTime)
  //   camera.position.y = 9;
  scene.render();
  stats.end();
});
