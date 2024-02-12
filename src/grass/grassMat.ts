import {
  Color3,
  Engine,
  Geometry,
  InspectableType,
  InstancedMesh,
  Mesh,
  MeshBuilder,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector3,
  VertexBuffer,
  VertexData,
} from "@babylonjs/core";

const PLANE_SIZE = 30;
const BLADE_COUNT = 1;
const BLADE_WIDTH = 0.1;
const BLADE_HEIGHT = 0.8;
const BLADE_HEIGHT_VARIATION = 0.6;
const MID_WIDTH = BLADE_WIDTH * 0.5;

function convertRange(
  val: number,
  oldMin: number,
  oldMax: number,
  newMin: number,
  newMax: number
) {
  return ((val - oldMin) * (newMax - newMin)) / (oldMax - oldMin) + newMin;
}

export class GrassMatrial extends ShaderMaterial {
  constructor(name: "grass", scene: Scene) {
    const grassTexture = new Texture("grass.jpg", scene);
    const cloudTexture = new Texture("cloud.jpg", scene);
    cloudTexture.wrapU = Texture.WRAP_ADDRESSMODE;
    cloudTexture.wrapV = Texture.WRAP_ADDRESSMODE;
    super(name, scene, "./grass", {
      attributes: ["position", "uv", "color"],
      uniforms: [
        "worldViewProjection",
        "texture_grass",
        "texture_cloud",
        "iTime",
      ],
    });

    // Set initial color.
    this.backFaceCulling = false;
    this.alphaMode = Engine.ALPHA_COMBINE; // Equivalent to blending in Three.js
    this.setFloat("iTime", 0.0);
    this.setTexture("texture_grass", grassTexture);
    this.setTexture("texture_cloud", cloudTexture);

    // Custom inspector properties.
    this.inspectableCustomProperties = [
      {
        label: "My color field",
        propertyName: "color",
        type: InspectableType.Color3,
      },
    ];
  }
  public static generateField(scene: Scene, grassMaterial: GrassMatrial) {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    for (let i = 0; i < BLADE_COUNT; i++) {
      const VERTEX_COUNT = 5;
      const surfaceMin = (PLANE_SIZE / 2) * -1;
      const surfaceMax = PLANE_SIZE / 2;
      const radius = PLANE_SIZE / 2;

      const r = radius * Math.sqrt(Math.random());
      const theta = Math.random() * 2 * Math.PI;
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);

      const pos = new Vector3(x, 0, y);

      const uv: [number, number] = [
        convertRange(pos.x, surfaceMin, surfaceMax, 0, 1),
        convertRange(pos.z, surfaceMin, surfaceMax, 0, 1),
      ];

      const blade = this.generateBlade(pos, i * VERTEX_COUNT, uv);
      blade.verts.forEach((vert) => {
        positions.push(...vert.pos);
        uvs.push(...vert.uv);
        colors.push(...vert.color);
      });
      blade.indices.forEach((indice) => indices.push(indice));
    }

    const vertexData = new VertexData();

    const col = new Float32Array(colors.length * 3 * 3);
    for (let i = 0; i < colors.length; i++) {
      col[i] = positions[i];
    }
    const pos = new Float32Array(positions.length * 3 * 3);
    for (let i = 0; i < positions.length; i++) {
      pos[i] = positions[i];
    }
    vertexData.uvs = new Float32Array(uvs);
    vertexData.colors = col;
    vertexData.positions = pos; //new Float32Array(positions);
    vertexData.indices = indices;
    // vertexData.uvs = new Float32Array(uvs);
    // vertexData.colors = new Float32Array(colors);
    // // vertexData.
    // VertexData.ComputeNormals(
    //   vertexData.positions,
    //   vertexData.indices,
    //   vertexData.normals
    // );
    // compute face normals
    console.log(vertexData, "vertexData");

    const geom = new Mesh("filed", scene);

    vertexData.applyToMesh(geom, true);
    geom.updateVerticesData(
      VertexBuffer.PositionKind,
      new Float32Array(positions),
      false,
      false
    );

    // Apply the computed normals to the mesh
    // vertexData.applyToMesh(geom);

    geom.material = grassMaterial;
    return grassMaterial;
  }
  public setItime(val: number) {
    this.setFloat("iTime", val);
  }
  public static generateBlade(
    center: Vector3,
    vArrOffset: number,
    uv: [number, number]
  ) {
    const TIP_OFFSET = 0.1;
    const height = BLADE_HEIGHT + Math.random() * BLADE_HEIGHT_VARIATION;

    const yaw = Math.random() * Math.PI * 2;
    const yawUnitVec = new Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
    const tipBend = Math.random() * Math.PI * 2;
    const tipBendUnitVec = new Vector3(
      Math.sin(tipBend),
      0,
      -Math.cos(tipBend)
    );

    // Find the Bottom Left, Bottom Right, Top Left, Top right, Top Center vertex positions
    const bl = center.add(
      yawUnitVec.clone().scaleInPlace((BLADE_WIDTH / 2) * 1)
    );
    const br = center.add(
      yawUnitVec.clone().scaleInPlace((BLADE_WIDTH / 2) * -1)
    );
    const tl = center.add(yawUnitVec.clone().scaleInPlace((MID_WIDTH / 2) * 1));
    const tr = center.add(
      yawUnitVec.clone().scaleInPlace((MID_WIDTH / 2) * -1)
    );
    const tc = center.add(tipBendUnitVec.clone().scaleInPlace(TIP_OFFSET));

    tl.y += height / 2;
    tr.y += height / 2;
    tc.y += height;

    // Vertex Colors
    const black = [0, 0, 0];
    const gray = [0.5, 0.5, 0.5];
    const white = [1.0, 1.0, 1.0];

    const verts = [
      { pos: bl.asArray(), uv: uv, color: black },
      { pos: br.asArray(), uv: uv, color: black },
      { pos: tr.asArray(), uv: uv, color: gray },
      { pos: tl.asArray(), uv: uv, color: gray },
      { pos: tc.asArray(), uv: uv, color: white },
    ];

    const indices = [
      vArrOffset,
      vArrOffset + 1,
      vArrOffset + 2,
      vArrOffset + 2,
      vArrOffset + 4,
      vArrOffset + 3,
      vArrOffset + 3,
      vArrOffset,
      vArrOffset + 2,
    ];

    return { verts, indices };
  }

  setcolor(value: Color3) {
    this.setColor3("color", value);
  }
}
