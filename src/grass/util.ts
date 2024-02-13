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


export function divideRectangleIntoChunks(width: number, height: number, chunksX: number, chunksY: number, pointsPerChunkX: number, pointsPerChunkY: number) {
    let chunkWidth = width / chunksX;
    let chunkHeight = height / chunksY;
    let result = [];

    const maxOffset = Math.min(chunkWidth/pointsPerChunkX, chunkHeight/pointsPerChunkY)/2

    for (let x = 0; x < chunksX; x++) {
        for (let y = 0; y < chunksY; y++) {
            let chunk = [];
            for (let px = 0; px < pointsPerChunkX; px++) {
                for (let py = 0; py < pointsPerChunkY; py++) {
                    let basePointX = x * chunkWidth + (px * chunkWidth) / pointsPerChunkX;
                    let basePointY = y * chunkHeight + (py * chunkHeight) / pointsPerChunkY;
                    let offsetX = (Math.random() * 2 - 1) * maxOffset; // Random offset between -maxOffset and +maxOffset
                    let offsetY = (Math.random() * 2 - 1) * maxOffset; // Random offset between -maxOffset and +maxOffset

                    let pointX = basePointX+offsetX 
                    let pointY = basePointY+offsetY 

                    chunk.push([pointX, pointY]);
                }
            }
            result.push(chunk);
        }
    }

    return result;
}