class Vector2 {
  public x: number;
  public y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  dot(other: { x: number; y: number }) {
    return this.x * other.x + this.y * other.y;
  }
}

function Shuffle(arrayToShuffle: (number | undefined)[]) {
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

function GetConstantVector(v: number) {
  // v is the value from the permutation table
  const h = v & 3;
  if (h == 0) return new Vector2(1.0, 1.0);
  else if (h == 1) return new Vector2(-1.0, 1.0);
  else if (h == 2) return new Vector2(-1.0, -1.0);
  else return new Vector2(1.0, -1.0);
}

function Fade(t: number) {
  return ((6 * t - 15) * t + 10) * t * t * t;
}

function Lerp(t: number, a1: number, a2: number) {
  return a1 + t * (a2 - a1);
}

export function Noise2D(x: number, y: number) {
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

export function divideRectangleIntoChunks(
  width: number,
  height: number,
  chunksX: number,
  chunksY: number,
  pointsPerChunkX: number,
  pointsPerChunkY: number
) {
  let chunkWidth = width / chunksX;
  let chunkHeight = height / chunksY;
  let result = [];
  const maxOffset =
    Math.min(chunkWidth / pointsPerChunkX, chunkHeight / pointsPerChunkY) / 2;

  for (let x = 0; x < chunksX; x++) {
    for (let y = 0; y < chunksY; y++) {
      let chunk: {
        chunkData: number[][];
        size: { min: { x: number; z: number }; max: { x: number; z: number } };
      } = {
        chunkData: [],
        size: {
          min: { x: Infinity, z: Infinity },
          max: { x: -Infinity, z: -Infinity },
        },
      };

      for (let px = 0; px < pointsPerChunkX; px++) {
        for (let py = 0; py < pointsPerChunkY; py++) {
          let basePointX =
            width / 2 - x * chunkWidth + (px * chunkWidth) / pointsPerChunkX;
          let basePointY =
            height / 2 - y * chunkHeight + (py * chunkHeight) / pointsPerChunkY;
          let offsetX = (Math.random() * 2 - 1) * maxOffset; // Random offset between -maxOffset and +maxOffset
          let offsetY = (Math.random() * 2 - 1) * maxOffset; // Random offset between -maxOffset and +maxOffset

          let pointX = basePointX + offsetX;
          let pointY = basePointY + offsetY;

          //   chunk.push([pointX, pointY]);
          chunk.chunkData.push([pointX, pointY]);
          if (pointX < chunk.size.min.x) {
            chunk.size.min.x = pointX;
          }
          if (pointX > chunk.size.max.x) {
            chunk.size.max.x = pointX;
          }
          if (pointY < chunk.size.min.z) {
            chunk.size.min.z = pointY;
          }
          if (pointY > chunk.size.max.z) {
            chunk.size.max.z = pointY;
          }
        }
      }
      result.push(chunk);
    }
  }

  return result;
}

export function chunkRectangleCentered(
  rectWidth: number,
  rectHeight: number,
  numberOfChunks: number
) {
  const chunks = [];
  const chunksPerRow = Math.ceil(Math.sqrt(numberOfChunks));
  const chunksPerColumn = Math.ceil(numberOfChunks / chunksPerRow);

  const chunkWidth = rectWidth / chunksPerRow;
  const chunkHeight = rectHeight / chunksPerColumn;

  const halfWidth = rectWidth / 2;
  const halfHeight = rectHeight / 2;

  for (let x = 0; x < chunksPerRow; x++) {
    for (let y = 0; y < chunksPerColumn; y++) {
      // Adjust starting positions to be centered around (0, 0)
      const startX = x * chunkWidth - halfWidth;
      const startY = y * chunkHeight - halfHeight;

      chunks.push({
        x: startX,
        y: startY,
        width: chunkWidth,
        height: chunkHeight,
      });
    }
  }

  // Adjust the number of chunks in case it doesn't perfectly fit the original request due to rounding
  return chunks.slice(0, numberOfChunks);
}

export const positionWithinChunk = (
  totalBlades: number,
  chunks: { x: number; y: number; width: number; height: number }[]
) => {
  const bladePerChunk = Math.round(totalBlades / chunks.length);

  const bladerPerSide = Math.floor(Math.sqrt(bladePerChunk));

  let chunkData: {
    dataPoints: number[][];
    size: { min: { x: number; z: number }; max: { x: number; z: number } };
  }[] = [];

  chunks.forEach((chunk) => {
    const gapX = chunk.width / bladerPerSide;
    const gapY = chunk.height / bladerPerSide;
    let data = [];
    let min = { x: Infinity, z: Infinity };
    let max = { x: -Infinity, z: -Infinity };
    for (let i = 0; i < bladerPerSide; i++) {
      const basePointX = chunk.x + i * gapX;
      const posX = basePointX + (Math.random() * gapX) / 2;
      if (min.x > posX) {
        min.x = posX;
      }
      if (max.x < posX) {
        max.x = posX;
      }
      for (let j = 0; j < bladerPerSide; j++) {
        const basePointY = chunk.y + j * gapY;
        const posY = basePointY + (Math.random() * gapY) / 2;
        if (min.z > posY) {
          min.z = posY;
        }
        if (max.z < posY) {
          max.z = posY;
        }
        data.push([posX, posY]);
      }
    }
    chunkData.push({ dataPoints: data, size: { min, max } });
  });

  return chunkData;
};

const _tables = /*@__PURE__*/ _generateTables();

function _generateTables() {
  // float32 to float16 helpers

  const buffer = new ArrayBuffer(4);
  const floatView = new Float32Array(buffer);
  const uint32View = new Uint32Array(buffer);

  const baseTable = new Uint32Array(512);
  const shiftTable = new Uint32Array(512);

  for (let i = 0; i < 256; ++i) {
    const e = i - 127;

    // very small number (0, -0)

    if (e < -27) {
      baseTable[i] = 0x0000;
      baseTable[i | 0x100] = 0x8000;
      shiftTable[i] = 24;
      shiftTable[i | 0x100] = 24;

      // small number (denorm)
    } else if (e < -14) {
      baseTable[i] = 0x0400 >> (-e - 14);
      baseTable[i | 0x100] = (0x0400 >> (-e - 14)) | 0x8000;
      shiftTable[i] = -e - 1;
      shiftTable[i | 0x100] = -e - 1;

      // normal number
    } else if (e <= 15) {
      baseTable[i] = (e + 15) << 10;
      baseTable[i | 0x100] = ((e + 15) << 10) | 0x8000;
      shiftTable[i] = 13;
      shiftTable[i | 0x100] = 13;

      // large number (Infinity, -Infinity)
    } else if (e < 128) {
      baseTable[i] = 0x7c00;
      baseTable[i | 0x100] = 0xfc00;
      shiftTable[i] = 24;
      shiftTable[i | 0x100] = 24;

      // stay (NaN, Infinity, -Infinity)
    } else {
      baseTable[i] = 0x7c00;
      baseTable[i | 0x100] = 0xfc00;
      shiftTable[i] = 13;
      shiftTable[i | 0x100] = 13;
    }
  }

  // float16 to float32 helpers

  const mantissaTable = new Uint32Array(2048);
  const exponentTable = new Uint32Array(64);
  const offsetTable = new Uint32Array(64);

  for (let i = 1; i < 1024; ++i) {
    let m = i << 13; // zero pad mantissa bits
    let e = 0; // zero exponent

    // normalized
    while ((m & 0x00800000) === 0) {
      m <<= 1;
      e -= 0x00800000; // decrement exponent
    }

    m &= ~0x00800000; // clear leading 1 bit
    e += 0x38800000; // adjust bias

    mantissaTable[i] = m | e;
  }

  for (let i = 1024; i < 2048; ++i) {
    mantissaTable[i] = 0x38000000 + ((i - 1024) << 13);
  }

  for (let i = 1; i < 31; ++i) {
    exponentTable[i] = i << 23;
  }

  exponentTable[31] = 0x47800000;
  exponentTable[32] = 0x80000000;

  for (let i = 33; i < 63; ++i) {
    exponentTable[i] = 0x80000000 + ((i - 32) << 23);
  }

  exponentTable[63] = 0xc7800000;

  for (let i = 1; i < 64; ++i) {
    if (i !== 32) {
      offsetTable[i] = 1024;
    }
  }

  return {
    floatView: floatView,
    uint32View: uint32View,
    baseTable: baseTable,
    shiftTable: shiftTable,
    mantissaTable: mantissaTable,
    exponentTable: exponentTable,
    offsetTable: offsetTable,
  };
}

// float32 to float16

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toHalfFloat(val: number) {
  if (Math.abs(val) > 65504)
    console.warn("toHalfFloat(): Value out of range.");

  val = clamp(val, -65504, 65504);

  _tables.floatView[0] = val;
  const f = _tables.uint32View[0];
  const e = (f >> 23) & 0x1ff;
  return _tables.baseTable[e] + ((f & 0x007fffff) >> _tables.shiftTable[e]);
}


const t = ` precision highp float;

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
uniform vec3 uCameraPosition;

// Varying
varying vec2 vUV;
varying vec3 vColor;
varying vec3 vNormal;
varying vec3 vPosition;
varying float vDist;

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

float inverseLerp(float v, float minValue, float maxValue) {
    return (v - minValue) / (maxValue - minValue);
}

float remap(float v, float inMin, float inMax, float outMin, float outMax) {
    float t = inverseLerp(v, inMin, inMax);
    return mix(outMin, outMax, t);
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

    cpos.z += wind * (uv.y * uv.y * uv.y) * 1.5 ;
    cpos.y *= 1.0 + aScale * 1.5;
    // cpos.x *= 0.01;
    vec4 wPos =  finalWorld * vec4(cpos, 1.0);
    // vec2 worldPos = vec2(wPos.x, wPos.z);
    // vec2 camPos = vec2(uCameraPosition.x, uCameraPosition.z);
    // float dist = distance(worldPos, camPos);
    // dist = remap(dist, -${(30/2).toFixed(2)}, ${(30/2).toFixed(2)}, -1., 1.);
    // dist = smoothstep(-0.7, 0.7, dist);
    // dist = 1.0 - dist;
    // float absDist = dist;
    // dist = (1.0 - remap(dist, -0.3, 0.3, 0.0, 1.0));
    // wPos.z -=  uv.y * 5. * dist;
    // wPos.x -=  uv.y * 5. * dist;
    // wPos.y *= 1.0 - dist;
    vec4 wNorm = finalWorld * vec4(norm, 0.0);
    gl_Position = viewProjection * wPos;

    vUV = uv;
    vColor = color;
    vNormal = wNorm.xyz;
    vPosition = wPos.xyz;
    // vDist = dist;`