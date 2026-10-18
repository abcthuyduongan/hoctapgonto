import { Mesh, Group, BoxGeometry, CylinderGeometry, IcosahedronGeometry, ConeGeometry, TorusGeometry, SphereGeometry, MeshStandardMaterial, type Object3D } from 'three';
import type { WorldId } from '../engine';

/** Distinct authored presentation without cloning a second retained source island. */
export function decorateWorld(id:WorldId, scene:Object3D) {
  if(id==='word-connect') {
    const wordConnectScene=scene;
    // Remove the windmill, library building, and giant open books so this island has its own unique architecture
    wordConnectScene.traverse(node => {
      if (node instanceof Mesh && /(library|eaves|roof|quill|door|brass|glazing|book|blossoms)/i.test(node.name || '')) {
        node.visible = false;
      }
    });

    const wordLandmark = new Group(); wordLandmark.name = 'Word connect grand arch landmark';
    const marbleMat = new MeshStandardMaterial({ color: 0xfffcf0, roughness: 0.35, metalness: 0.1 });
    const goldMat = new MeshStandardMaterial({ color: 0xffb703, roughness: 0.25, metalness: 0.5, emissive: 0xff8800, emissiveIntensity: 0.2 });
    const linkRuneMat = new MeshStandardMaterial({ color: 0xffd166, roughness: 0.2, emissive: 0xff9900, emissiveIntensity: 0.7 });
    const coreGemMat = new MeshStandardMaterial({ color: 0xffe66d, roughness: 0.15, emissive: 0xffaa00, emissiveIntensity: 0.9 });
    const autumnBarkMat = new MeshStandardMaterial({ color: 0x5a3825, roughness: 0.9 });
    const autumnLeafMat1 = new MeshStandardMaterial({ color: 0xf77f00, roughness: 0.8 });
    const autumnLeafMat2 = new MeshStandardMaterial({ color: 0xfcbf49, roughness: 0.8 });

    // Twin Grand Obelisk Towers (Left & Right)
    for (const side of [-1.5, 1.5]) {
      const tower = new Group();
      tower.position.set(side, 0, -0.4);
      const base1 = new Mesh(new BoxGeometry(0.85, 0.25, 0.85), marbleMat); base1.position.y = 0.12;
      const base2 = new Mesh(new BoxGeometry(0.7, 0.2, 0.7), marbleMat); base2.position.y = 0.32;
      const shaft = new Mesh(new CylinderGeometry(0.24, 0.28, 2.7, 12), marbleMat); shaft.position.y = 1.68;
      const ring1 = new Mesh(new TorusGeometry(0.27, 0.045, 8, 20), goldMat);
      ring1.rotation.x = Math.PI / 2; ring1.position.y = 1.0;
      const ring2 = new Mesh(new TorusGeometry(0.26, 0.045, 8, 20), goldMat);
      ring2.rotation.x = Math.PI / 2; ring2.position.y = 2.0;
      const cap = new Mesh(new BoxGeometry(0.6, 0.2, 0.6), marbleMat); cap.position.y = 3.05;
      const spire = new Mesh(new ConeGeometry(0.32, 0.85, 8), goldMat); spire.position.y = 3.55;
      tower.add(base1, base2, shaft, ring1, ring2, cap, spire);
      wordLandmark.add(tower);
    }

    // Grand Semicircular Skybridge Arch spanning between the twin towers
    const archCurve = new Mesh(new TorusGeometry(1.5, 0.12, 12, 36, Math.PI), marbleMat);
    archCurve.position.set(0, 1.6, -0.4);
    wordLandmark.add(archCurve);

    const archTrim = new Mesh(new TorusGeometry(1.5, 0.05, 8, 36, Math.PI), goldMat);
    archTrim.position.set(0, 1.6, -0.38);
    wordLandmark.add(archTrim);

    // Hovering Interlocking Chain Link 🔗 at the apex (The universal symbol of Word Connect)
    const linkNexus = new Group();
    linkNexus.position.set(0, 3.1, -0.4);
    const linkRing1 = new Mesh(new TorusGeometry(0.38, 0.075, 12, 28), linkRuneMat);
    const linkRing2 = new Mesh(new TorusGeometry(0.38, 0.075, 12, 28), linkRuneMat);
    linkRing2.rotation.y = Math.PI / 2;
    const coreGem = new Mesh(new IcosahedronGeometry(0.22, 0), coreGemMat);
    linkNexus.add(linkRing1, linkRing2, coreGem);
    wordLandmark.add(linkNexus);

    // Paired Word Connector Tablets on the ground
    for (const [x1, x2, z] of [[-1.0, -0.4, 0.8], [0.4, 1.0, 0.8]] as const) {
      const pad1 = new Mesh(new BoxGeometry(0.42, 0.1, 0.42), marbleMat); pad1.position.set(x1, 0.05, z);
      const pad2 = new Mesh(new BoxGeometry(0.42, 0.1, 0.42), marbleMat); pad2.position.set(x2, 0.05, z);
      const connectorBeam = new Mesh(new BoxGeometry(Math.abs(x2 - x1), 0.04, 0.1), linkRuneMat);
      connectorBeam.position.set((x1 + x2) / 2, 0.07, z);
      wordLandmark.add(pad1, pad2, connectorBeam);
    }

    // Warm Golden Autumn Trees along the rear rim
    for (const [tx, tz, h, mat] of [
      [-2.2, -1.2, 1.3, autumnLeafMat1],
      [-1.8, -2.1, 1.6, autumnLeafMat2],
      [1.8, -2.1, 1.5, autumnLeafMat1],
      [2.2, -1.2, 1.3, autumnLeafMat2],
    ] as const) {
      const tree = new Group(); tree.position.set(tx, 0, tz);
      const trunk = new Mesh(new CylinderGeometry(0.09, 0.16, h, 6), autumnBarkMat);
      trunk.position.y = h / 2;
      const foliage1 = new Mesh(new SphereGeometry(0.55, 7, 6), mat);
      foliage1.position.set(0, h + 0.2, 0);
      const foliage2 = new Mesh(new SphereGeometry(0.4, 6, 5), mat === autumnLeafMat1 ? autumnLeafMat2 : autumnLeafMat1);
      foliage2.position.set(0.15, h + 0.5, -0.1);
      tree.add(trunk, foliage1, foliage2);
      wordLandmark.add(tree);
    }
    wordConnectScene.add(wordLandmark);
  }
  if(id==='sequence-trail') {
    const sequenceScene=scene;
    // Remove the castle, battlements, blue conical roofs, and cottages
    sequenceScene.traverse(node => {
      if (node instanceof Mesh && /(masonry|sculptures|castle|roof|recess|windows|banner|door|coral)/i.test(node.name || '')) {
        node.visible = false;
      }
    });

    const logicLandmark = new Group(); logicLandmark.name = 'Sequence trail ziggurat landmark';
    const stairMarbleMat = new MeshStandardMaterial({ color: 0xf0f8ff, roughness: 0.35, metalness: 0.1 });
    const summitDiamondMat = new MeshStandardMaterial({ color: 0x90e0ef, roughness: 0.15, emissive: 0x00f0ff, emissiveIntensity: 0.85 });
    const orbitRingMat = new MeshStandardMaterial({ color: 0x48cae4, roughness: 0.3, emissive: 0x0077b6, emissiveIntensity: 0.4 });
    const logicPineBark = new MeshStandardMaterial({ color: 0x3d5a80, roughness: 0.9 });
    const logicPineFoliage = new MeshStandardMaterial({ color: 0x0077b6, roughness: 0.7 });

    // Terraced Ascending Ziggurat Staircase (6 Levels climbing from front to apex)
    const tiers = [
      { w: 1.8, d: 1.4, h: 0.22, x: -0.6, y: 0.11, z: 0.7 },
      { w: 1.5, d: 1.2, h: 0.22, x: -0.4, y: 0.33, z: 0.4 },
      { w: 1.3, d: 1.0, h: 0.22, x: -0.2, y: 0.55, z: 0.1 },
      { w: 1.1, d: 0.9, h: 0.22, x: 0.0, y: 0.77, z: -0.2 },
      { w: 0.9, d: 0.8, h: 0.22, x: 0.2, y: 0.99, z: -0.5 },
      { w: 0.7, d: 0.7, h: 0.22, x: 0.4, y: 1.21, z: -0.8 },
    ];
    tiers.forEach((t, i) => {
      const stepMesh = new Mesh(new BoxGeometry(t.w, t.h, t.d), stairMarbleMat);
      stepMesh.position.set(t.x, t.y, t.z);
      const edgeStrip = new Mesh(new BoxGeometry(t.w + 0.04, 0.05, 0.08),
        new MeshStandardMaterial({ color: 0x00b4d8, emissive: 0x0077b6, emissiveIntensity: 0.3 + i * 0.1 }));
      edgeStrip.position.set(t.x, t.y + t.h / 2, t.z + t.d / 2);
      logicLandmark.add(stepMesh, edgeStrip);
    });

    // 5 Ascending Spectral Crystal Monoliths (📶 1, 2, 3, 4, 5)
    const monolithData = [
      { h: 0.9, x: -1.4, z: 0.7, color: 0x48cae4, emissive: 0x00b4d8 }, // 1: Aqua
      { h: 1.35, x: -1.1, z: 0.2, color: 0x00b4d8, emissive: 0x0096c7 }, // 2: Cyan
      { h: 1.85, x: -0.8, z: -0.3, color: 0x0096c7, emissive: 0x0077b6 }, // 3: Ocean
      { h: 2.35, x: -0.4, z: -0.8, color: 0x0077b6, emissive: 0x023e8a }, // 4: Cobalt
      { h: 2.9, x: 0.0, z: -1.3, color: 0x023e8a, emissive: 0x0077b6 },  // 5: Sapphire
    ];
    monolithData.forEach(m => {
      const pillarGroup = new Group();
      pillarGroup.position.set(m.x, 0, m.z);
      const mat = new MeshStandardMaterial({ color: m.color, roughness: 0.2, emissive: m.emissive, emissiveIntensity: 0.45 });
      const shaft = new Mesh(new CylinderGeometry(0.16, 0.2, m.h, 6), mat);
      shaft.position.y = m.h / 2;
      const cap = new Mesh(new ConeGeometry(0.2, 0.4, 6), mat);
      cap.position.y = m.h + 0.2;
      const ring = new Mesh(new TorusGeometry(0.25, 0.035, 8, 20),
        new MeshStandardMaterial({ color: 0xffffff, emissive: m.color, emissiveIntensity: 0.8 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = m.h * 0.75;
      pillarGroup.add(shaft, cap, ring);
      logicLandmark.add(pillarGroup);
    });

    // Summit Hovering Logic Diamond Star above Apex
    const summitGroup = new Group();
    summitGroup.position.set(0.4, 2.1, -0.8);
    const diamond = new Mesh(new IcosahedronGeometry(0.36, 0), summitDiamondMat);
    const orbitRing1 = new Mesh(new TorusGeometry(0.55, 0.04, 8, 32), orbitRingMat);
    orbitRing1.rotation.x = Math.PI / 3;
    const orbitRing2 = new Mesh(new TorusGeometry(0.55, 0.04, 8, 32), orbitRingMat);
    orbitRing2.rotation.y = Math.PI / 3;
    summitGroup.add(diamond, orbitRing1, orbitRing2);
    logicLandmark.add(summitGroup);

    // Crystalline Blue Fir Trees on peripheral edge
    for (const [px, pz] of [[1.5, -0.3], [1.7, 0.6], [1.2, 1.2], [-1.7, -1.0]] as const) {
      const pine = new Group(); pine.position.set(px, 0, pz);
      const trunk = new Mesh(new CylinderGeometry(0.08, 0.12, 0.8, 6), logicPineBark);
      trunk.position.y = 0.4;
      const c1 = new Mesh(new ConeGeometry(0.65, 0.8, 6), logicPineFoliage); c1.position.y = 0.9;
      const c2 = new Mesh(new ConeGeometry(0.48, 0.7, 6), logicPineFoliage); c2.position.y = 1.35;
      const c3 = new Mesh(new ConeGeometry(0.32, 0.6, 6), logicPineFoliage); c3.position.y = 1.75;
      pine.add(trunk, c1, c2, c3);
      logicLandmark.add(pine);
    }
    sequenceScene.add(logicLandmark);
  }
}
