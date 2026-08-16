(function(){
  "use strict";

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas = document.getElementById('scene-canvas');
  var renderer, scene, camera;
  var mountainNear, mountainMid, mountainFar, lake, entranceGroup, starField;
  var skyMaterial, ambientLight, sunLight;
  var mistLayers = [];
  var grassFieldMesh = null;
  var grassWindShader = null;
  var grassDummy = new THREE.Object3D();
  var fireflyGroup, fireflyCore, fireflyTrail = [], fireflyTrailPositions = [];
  var clock = new THREE.Clock();
  var W = window.innerWidth, H = window.innerHeight;

  var mouseNX = 0, mouseNY = 0, mouseActive = false;

  // Renderer and scene setup
  function initRenderer(){
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias:true, alpha:false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x151d32, 1);
  }

  function buildSky(){
    var skyGeo = new THREE.SphereGeometry(600, 24, 16);
    skyMaterial = new THREE.ShaderMaterial({
      uniforms:{
        topColor:{ value: new THREE.Color(0x1b2440) },
        bottomColor:{ value: new THREE.Color(0x6d5f74) },
        offset:{ value: 24 },
        exponent:{ value: 0.62 }
      },
      vertexShader:
        'varying vec3 vWorldPosition;' +
        'void main(){' +
        '  vec4 worldPosition = modelMatrix * vec4(position, 1.0);' +
        '  vWorldPosition = worldPosition.xyz;' +
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);' +
        '}',
      fragmentShader:
        'uniform vec3 topColor; uniform vec3 bottomColor; uniform float offset; uniform float exponent;' +
        'varying vec3 vWorldPosition;' +
        'void main(){' +
        '  float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;' +
        '  gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);' +
        '}',
      side: THREE.BackSide
    });
    var sky = new THREE.Mesh(skyGeo, skyMaterial);
    scene.add(sky);
  }

  function initScene(){
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x101827, 0.0038);
    camera = new THREE.PerspectiveCamera(52, W/H, 0.1, 900);
    camera.position.set(90, 130, 260);

    buildSky();

    ambientLight = new THREE.AmbientLight(0x3c4b66, 0.85);
    scene.add(ambientLight);
    sunLight = new THREE.DirectionalLight(0xffdfaa, 0.42);
    sunLight.position.set(-50, 80, -30);
    scene.add(sunLight);
  }

  function fbm(x, z, seed){
    var s = seed || 0, total = 0, amp = 1, freq = 1, max = 0;
    for(var i=0;i<4;i++){
      total += amp * Math.sin(x*freq*0.045 + s*11.3 + i*1.7) * Math.cos(z*freq*0.045 - s*7.1 + i*2.3);
      max += amp; amp *= 0.52; freq *= 2.05;
    }
    return total / max;
  }
  function ridgeShape(x, z, seed, sharpness){
    var n = (fbm(x, z, seed) + 1) / 2;
    return Math.pow(n, sharpness || 1.6);
  }
  function mountainEdgeFall(localX, localZ, spec){
    var xFall = 1 - Math.pow(Math.abs(localX) / (spec.width*0.5), 2.2);
    var zFall = 1 - Math.pow(Math.abs(localZ) / (spec.depth*0.5), 2.4);
    return Math.max(0.035, Math.min(xFall, zFall));
  }
  function mountainHeightForSpec(worldX, worldZ, spec){
    var localX = worldX - spec.centerOffsetX;
    var localZ = worldZ - spec.zOffset;
    var h = ridgeShape(worldX, worldZ, spec.seed, spec.sharpness) * spec.heightScale;
    return h * mountainEdgeFall(localX, localZ, spec);
  }

  // Terrain, trailhead, and environmental geometry
  function buildMountain(opts){
    var geo = new THREE.BufferGeometry();
    var positions = [];
    var colors = [];
    var indices = [];
    var cLow = new THREE.Color(opts.colorLow);
    var cHigh = new THREE.Color(opts.colorHigh);
    var cFrost = new THREE.Color(0xcdd9e4);
    var cBase = cLow.clone().multiplyScalar(0.62);
    var baseY = opts.baseY == null ? -26 : opts.baseY;
    var skirtOut = opts.skirtOut == null ? 38 : opts.skirtOut;
    var cols = opts.segX + 1;
    var rows = opts.segZ + 1;

    function vertexIndex(ix, iz){ return iz * cols + ix; }
    function bottomIndex(ix, iz){ return rows * cols + vertexIndex(ix, iz); }

    for(var iz=0; iz<rows; iz++){
      for(var ix=0; ix<cols; ix++){
        var x = -opts.width*0.5 + (ix / opts.segX) * opts.width;
        var z = -opts.depth*0.5 + (iz / opts.segZ) * opts.depth;
        var worldX = x + opts.centerOffsetX;
        var worldZ = z + opts.zOffset;
        var h = mountainHeightForSpec(worldX, worldZ, opts);

        positions.push(x, h, z);

        var t = Math.min(1, h / opts.heightScale);
        var col = cLow.clone().lerp(cHigh, Math.pow(t, 1.4));
        if(t > 0.78){
          col.lerp(cFrost, (t-0.78)/0.22 * 0.5);
        }
        colors.push(col.r, col.g, col.b);
      }
    }

    for(var bz=0; bz<rows; bz++){
      for(var bx=0; bx<cols; bx++){
        var bottomX = -opts.width*0.5 + (bx / opts.segX) * opts.width;
        var bottomZ = -opts.depth*0.5 + (bz / opts.segZ) * opts.depth;
        if(bx === 0) bottomX -= skirtOut;
        if(bx === opts.segX) bottomX += skirtOut;
        if(bz === 0) bottomZ -= skirtOut;
        if(bz === opts.segZ) bottomZ += skirtOut;
        positions.push(bottomX, baseY, bottomZ);
        colors.push(cBase.r, cBase.g, cBase.b);
      }
    }

    for(var qz=0; qz<opts.segZ; qz++){
      for(var qx=0; qx<opts.segX; qx++){
        var a = vertexIndex(qx, qz);
        var b = vertexIndex(qx+1, qz);
        var c = vertexIndex(qx+1, qz+1);
        var d = vertexIndex(qx, qz+1);
        indices.push(a, d, b, b, d, c);

        var ba = bottomIndex(qx, qz);
        var bb = bottomIndex(qx+1, qz);
        var bc = bottomIndex(qx+1, qz+1);
        var bd = bottomIndex(qx, qz+1);
        indices.push(ba, bb, bd, bb, bc, bd);
      }
    }

    for(var sx=0; sx<opts.segX; sx++){
      var frontA = vertexIndex(sx, 0);
      var frontB = vertexIndex(sx+1, 0);
      var frontBottomA = bottomIndex(sx, 0);
      var frontBottomB = bottomIndex(sx+1, 0);
      indices.push(frontA, frontB, frontBottomB, frontA, frontBottomB, frontBottomA);

      var backA = vertexIndex(sx, opts.segZ);
      var backB = vertexIndex(sx+1, opts.segZ);
      var backBottomA = bottomIndex(sx, opts.segZ);
      var backBottomB = bottomIndex(sx+1, opts.segZ);
      indices.push(backA, backBottomB, backB, backA, backBottomA, backBottomB);
    }

    for(var sz=0; sz<opts.segZ; sz++){
      var leftA = vertexIndex(0, sz);
      var leftB = vertexIndex(0, sz+1);
      var leftBottomA = bottomIndex(0, sz);
      var leftBottomB = bottomIndex(0, sz+1);
      indices.push(leftA, leftBottomB, leftB, leftA, leftBottomA, leftBottomB);

      var rightA = vertexIndex(opts.segX, sz);
      var rightB = vertexIndex(opts.segX, sz+1);
      var rightBottomA = bottomIndex(opts.segX, sz);
      var rightBottomB = bottomIndex(opts.segX, sz+1);
      indices.push(rightA, rightB, rightBottomB, rightA, rightBottomB, rightBottomA);
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    var mat = new THREE.MeshStandardMaterial({
      vertexColors:true,
      flatShading:true,
      roughness:1,
      metalness:0,
      fog:true,
      transparent:false,
      opacity:1,
      side:THREE.FrontSide
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(opts.centerOffsetX, 0, opts.zOffset);
    scene.add(mesh);
    return mesh;
  }

  function buildTrailheadEntrance(){
    entranceGroup = new THREE.Group();
    var pathGeo = new THREE.PlaneGeometry(38, 170, 1, 1);
    pathGeo.rotateX(-Math.PI/2);
    var pathMat = new THREE.MeshStandardMaterial({ color:0x080b0f, roughness:1, metalness:0, fog:true });
    var path = new THREE.Mesh(pathGeo, pathMat);
    path.position.set(0, -0.85, -12);
    entranceGroup.add(path);

    scene.add(entranceGroup);
  }

  function buildRidgeBackdrop(opts){
    var count = opts.count || 18;
    var width = opts.width || 1000;
    var bottom = opts.bottom || -8;
    var base = opts.base || 42;
    var amp = opts.amp || 80;
    var z = opts.z || -330;
    var verts = [];
    var indices = [];
    for(var i=0; i<=count; i++){
      var x = -width/2 + width * (i / count);
      var n = ridgeShape(x*0.4, z, opts.seed || 1, opts.sharpness || 1.8);
      var y = base + n * amp + Math.sin(i*1.7 + (opts.seed || 0))*10;
      verts.push(x, bottom, z, x, y, z);
      if(i < count){
        var a = i*2;
        indices.push(a, a+1, a+2, a+1, a+3, a+2);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    var mat = new THREE.MeshBasicMaterial({ color:opts.color || 0x07111d, fog:true, side:THREE.DoubleSide });
    var mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    return mesh;
  }

  function buildNatureDetails(){
    var treeMat = new THREE.MeshStandardMaterial({ color:0x03080d, roughness:1, metalness:0, fog:true });
    var trunkMat = new THREE.MeshStandardMaterial({ color:0x120d09, roughness:1, metalness:0, fog:true });
    var grassMat = new THREE.MeshStandardMaterial({
      color:0x3a6838,
      roughness:1,
      metalness:0,
      fog:true,
      side:THREE.DoubleSide,
      vertexColors:true,
      emissive:0x071106,
      emissiveIntensity:0.28
    });
    grassMat.onBeforeCompile = function(shader){
      grassWindShader = shader;
      shader.uniforms.uTime = { value:0 };
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', [
        'vec3 transformed = vec3( position );',
        '#ifdef USE_INSTANCING',
        '  vec3 bladeWorld = instanceMatrix[3].xyz;',
        '  float bladeTop = smoothstep(0.08, 1.0, position.y);',
      '  float wind = sin(uTime * 1.45 + bladeWorld.x * 0.12 + bladeWorld.z * 0.16);',
      '  float crossWind = cos(uTime * 1.05 + bladeWorld.x * 0.07 - bladeWorld.z * 0.1);',
      '  transformed.x += wind * 0.13 * bladeTop;',
      '  transformed.z += crossWind * 0.06 * bladeTop;',
        '#endif'
      ].join('\n'));
    };
    var grassFieldMat = new THREE.MeshStandardMaterial({ color:0x102417, roughness:1, metalness:0, fog:true, side:THREE.DoubleSide });
    function pine(x, z, h, mat){
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, h*0.36, 5), trunkMat);
      trunk.position.set(x, h*0.18 - 0.8, z);
      scene.add(trunk);
      var crown = new THREE.Mesh(new THREE.ConeGeometry(h*0.26, h, 7), mat || treeMat);
      crown.position.set(x, h*0.62 - 0.8, z);
      scene.add(crown);
    }
    for(var i=0;i<32;i++){
      var side = i % 2 === 0 ? -1 : 1;
      var x = side * (34 + Math.random()*90);
      var z = 28 - Math.random()*170;
      pine(x, z, 7 + Math.random()*11);
    }
    var grassField = new THREE.Mesh(new THREE.PlaneGeometry(430, 250, 1, 1), grassFieldMat);
    grassField.rotation.x = -Math.PI/2;
    grassField.position.set(0, -1.08, 42);
    scene.add(grassField);

    var bladeGeo = new THREE.BufferGeometry();
    bladeGeo.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.5, 0, 0,
       0.5, 0, 0,
      -0.22, 0.7, 0,
       0.22, 0.7, 0,
       0, 1, 0
    ], 3));
    bladeGeo.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
    bladeGeo.computeVertexNormals();
    var grassCols = 1020;
    var grassRows = 680;
    var bladeCount = grassCols * grassRows;
    grassFieldMesh = new THREE.InstancedMesh(bladeGeo, grassMat, bladeCount);
    var bladeColor = new THREE.Color();
    for(var b=0; b<bladeCount; b++){
      var col = b % grassCols;
      var row = Math.floor(b / grassCols);
      var px = -215 + (col + Math.random()) * (430 / grassCols);
      var pz = -78 + (row + Math.random()) * (250 / grassRows);
      var clump = (Math.sin(px*0.075) + Math.cos(pz*0.09) + Math.sin((px+pz)*0.045)) / 3;
      var bladeH = 0.9 + Math.random()*1.72 + Math.max(0, clump)*0.58;
      var bladeW = 0.07 + Math.random()*0.12;
      grassDummy.position.set(px, -1.02, pz);
      grassDummy.rotation.set(-0.12 + Math.random()*0.24, Math.random()*Math.PI, -0.36 + Math.random()*0.72);
      grassDummy.scale.set(bladeW, bladeH, 1);
      grassDummy.updateMatrix();
      grassFieldMesh.setMatrixAt(b, grassDummy.matrix);
      bladeColor.setHSL(
        0.275 + Math.random()*0.06,
        0.38 + Math.random()*0.24,
        0.16 + Math.random()*0.1 + Math.max(0, clump)*0.04
      );
      grassFieldMesh.setColorAt(b, bladeColor);
    }
    if(grassFieldMesh.instanceColor) grassFieldMesh.instanceColor.needsUpdate = true;
    scene.add(grassFieldMesh);
  }

  var MOUNTAIN_SPECS = [
    { width:820, depth:220, segX:56, segZ:22, heightScale:110, seed:1.7, sharpness:2.1, zOffset:-270, centerOffsetX:20, colorLow:0x060c15, colorHigh:0x1d3142, skirtOut:52, baseY:-32 },
    { width:680, depth:200, segX:68, segZ:28, heightScale:80, seed:4.2, sharpness:1.8, zOffset:-155, centerOffsetX:-15, colorLow:0x040911, colorHigh:0x132436, skirtOut:46, baseY:-30 },
    { width:560, depth:180, segX:96, segZ:40, heightScale:56, seed:8.9, sharpness:1.55, zOffset:-60, centerOffsetX:0, colorLow:0x010306, colorHigh:0x0b1723, skirtOut:42, baseY:-28 }
  ];

  function buildTerrain(){
    buildRidgeBackdrop({ width:1120, count:26, bottom:-16, base:30, amp:92, z:-380, seed:11.2, color:0x050a12 });
    buildRidgeBackdrop({ width:980, count:20, bottom:-12, base:18, amp:70, z:-300, seed:6.4, color:0x081322 });
    mountainFar = buildMountain(MOUNTAIN_SPECS[0]);
    mountainMid = buildMountain(MOUNTAIN_SPECS[1]);
    mountainNear = buildMountain(MOUNTAIN_SPECS[2]);

    var lakeGeo = new THREE.PlaneGeometry(340, 180, 1, 1);
    lakeGeo.rotateX(-Math.PI/2);
    var lakeMat = new THREE.MeshStandardMaterial({ color:0x050a13, roughness:0.45, metalness:0.08, transparent:false, opacity:1 });
    lake = new THREE.Mesh(lakeGeo, lakeMat);
    lake.position.set(0, -0.4, 40);
    scene.add(lake);

    var groundGeo = new THREE.PlaneGeometry(900, 520, 1, 1);
    groundGeo.rotateX(-Math.PI/2);
    var groundMat = new THREE.MeshStandardMaterial({ color:0x03070c, roughness:1, metalness:0, fog:true, side:THREE.DoubleSide });
    var ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.set(0, -1.2, 25);
    scene.add(ground);

    buildTrailheadEntrance();
    buildNatureDetails();

    for(var m=0; m<3; m++){
      var mg = new THREE.PlaneGeometry(500, 90);
      var mmat = new THREE.MeshBasicMaterial({ color:0x9fb6c6, transparent:true, opacity:0.018 - m*0.004, depthWrite:false, fog:false });
      var mesh = new THREE.Mesh(mg, mmat);
      mesh.position.set(0, 20 + m*12, -150 - m*80);
      mesh.userData.baseY = mesh.position.y;
      mesh.userData.phase = m*2.4;
      mistLayers.push(mesh);
      scene.add(mesh);
    }

    var starGeo = new THREE.BufferGeometry();
    var starCount = 700;
    var starPos = new Float32Array(starCount*3);
    for(var s=0;s<starCount;s++){
      var r = 400 + Math.random()*280;
      var theta = Math.random()*Math.PI*2;
      var phi = Math.acos((Math.random()*0.75)+0.1);
      starPos[s*3] = r*Math.sin(phi)*Math.cos(theta);
      starPos[s*3+1] = Math.abs(r*Math.cos(phi))*0.7 + 40;
      starPos[s*3+2] = r*Math.sin(phi)*Math.sin(theta) - 100;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    var starMat = new THREE.PointsMaterial({ color:0xcdd9e4, size:1.3, transparent:true, opacity:0.5, fog:false });
    starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);
  }

  function makeGlowTexture(hex){
    var c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(64,64,0,64,64,64);
    g.addColorStop(0, 'rgba(255,244,222,1)');
    g.addColorStop(0.35, hex);
    g.addColorStop(1, 'rgba(255,159,74,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,128,128);
    return new THREE.CanvasTexture(c);
  }

  // Firefly, fireworks, and travel effects
  function buildFirefly(){
    var tex = makeGlowTexture('rgba(255,207,143,0.95)');
    fireflyGroup = new THREE.Group();
    var coreMat = new THREE.SpriteMaterial({ map:tex, color:0xffffff, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false });
    fireflyCore = new THREE.Sprite(coreMat);
    fireflyCore.scale.set(3.4, 3.4, 1);
    fireflyCore.userData.baseScale = 3.4;
    fireflyGroup.add(fireflyCore);

    var trailCount = 10;
    for(var i=0;i<trailCount;i++){
      var tMat = new THREE.SpriteMaterial({ map:tex, color:0xffb066, transparent:true, opacity:(1 - i/trailCount)*0.32, blending:THREE.AdditiveBlending, depthWrite:false });
      var tSprite = new THREE.Sprite(tMat);
      var sc = 2.3 * (1 - i/trailCount*0.7);
      tSprite.scale.set(sc, sc, 1);
      tSprite.userData.baseScale = sc;
      scene.add(tSprite);
      fireflyTrail.push(tSprite);
      fireflyTrailPositions.push(new THREE.Vector3());
    }
    scene.add(fireflyGroup);
  }

  function clampNum(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function mountainSurfaceHeightAt(worldX, worldZ){
    var maxH = -Infinity;
    for(var i=0; i<MOUNTAIN_SPECS.length; i++){
      var spec = MOUNTAIN_SPECS[i];
      var localX = worldX - spec.centerOffsetX;
      var localZ = worldZ - spec.zOffset;
      if(Math.abs(localX) > spec.width*0.5 || Math.abs(localZ) > spec.depth*0.5) continue;
      maxH = Math.max(maxH, mountainHeightForSpec(worldX, worldZ, spec));
    }
    return maxH === -Infinity ? -1.2 : maxH;
  }
  function liftAboveTerrain(point, clearance){
    point.y = Math.max(point.y, mountainSurfaceHeightAt(point.x, point.z) + clearance);
    return point;
  }
  var FIREFLY_REF_DIST = 22;

  var fireworkParticles = [];
  var fireworkTex = null;
  var fireworkStreakTex = null;
  var fireworkActive = false;
  var pendingBursts = [];

  function makeStreakTexture(){
    var c = document.createElement('canvas');
    c.width = 32; c.height = 128;
    var ctx = c.getContext('2d');
    var g = ctx.createLinearGradient(0,0,0,128);
    g.addColorStop(0, 'rgba(255,244,222,0)');
    g.addColorStop(0.55, 'rgba(255,207,143,0.9)');
    g.addColorStop(1, 'rgba(255,244,222,1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(16,64,10,64,0,0,Math.PI*2);
    ctx.fill();
    return new THREE.CanvasTexture(c);
  }

  function spawnFirework(origin, opts){
    opts = opts || {};
    var count = reducedMotion ? 0 : (opts.count || 34);
    var speed = opts.speed || 20;
    if(!fireworkTex) fireworkTex = makeGlowTexture('rgba(255,207,143,0.95)');
    if(!fireworkStreakTex) fireworkStreakTex = makeStreakTexture();
    if(count === 0) return;
    fireworkActive = true;

    var flashMat = new THREE.SpriteMaterial({ map:fireworkTex, color:0xfff6e6, transparent:true, opacity:1, blending:THREE.AdditiveBlending, depthWrite:false });
    var flash = new THREE.Sprite(flashMat);
    flash.scale.set(4,4,1);
    flash.position.copy(origin);
    scene.add(flash);
    fireworkParticles.push({ sprite:flash, vel:new THREE.Vector3(0,0,0), life:1, maxLife:0.28, isFlash:true, baseScale:4 });

    var palette = [0xfff4de, 0xffcf8f, 0xff9f4a, 0xffe3c2];
    var goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for(var i=0;i<count;i++){
      var yFrac = 1 - (i/(count-1))*2;
      var radius = Math.sqrt(Math.max(0, 1 - yFrac*yFrac));
      var theta = goldenAngle * i;
      var dir = new THREE.Vector3(Math.cos(theta)*radius, yFrac, Math.sin(theta)*radius);
      var thisSpeed = speed * (0.75 + Math.random()*0.5);
      var vel = dir.multiplyScalar(thisSpeed);

      var mat = new THREE.SpriteMaterial({
        map: fireworkStreakTex,
        color: palette[i % palette.length],
        transparent:true, opacity:1,
        blending:THREE.AdditiveBlending, depthWrite:false,
        rotation:0
      });
      var sprite = new THREE.Sprite(mat);
      var sc = 1.3 + Math.random()*0.6;
      sprite.scale.set(sc*0.5, sc*2.2, 1);
      sprite.position.copy(origin);
      scene.add(sprite);
      fireworkParticles.push({ sprite:sprite, vel:vel, life:1, maxLife: 0.75 + Math.random()*0.35, isFlash:false });
    }

    pendingBursts.push({ origin:origin.clone(), delay:0.32, count:Math.round(count*0.4), speed:speed*0.45 });
  }

  function updateFireworks(dt){
    for(var b=pendingBursts.length-1;b>=0;b--){
      pendingBursts[b].delay -= dt;
      if(pendingBursts[b].delay <= 0){
        var pb = pendingBursts[b];
        pb.origin.y -= 2;
        spawnFireworkSimple(pb.origin, pb.count, pb.speed);
        pendingBursts.splice(b,1);
      }
    }

    if(fireworkParticles.length === 0){ fireworkActive = pendingBursts.length > 0; return; }
    for(var i=fireworkParticles.length-1;i>=0;i--){
      var p = fireworkParticles[i];
      if(p.isFlash){
        p.life -= dt/p.maxLife;
        p.sprite.material.opacity = Math.max(0, p.life);
        var grow = p.baseScale * (1 + (1-p.life)*2.2);
        p.sprite.scale.set(grow, grow, 1);
      } else {
        p.vel.y -= dt*11;
        p.vel.multiplyScalar(1 - dt*0.5);
        p.sprite.position.addScaledVector(p.vel, dt);
        p.life -= dt/p.maxLife;
        p.sprite.material.opacity = Math.max(0, p.life);
        var angle = Math.atan2(p.vel.y, p.vel.x) + Math.PI/2;
        p.sprite.material.rotation = angle;
      }
      if(p.life <= 0){
        scene.remove(p.sprite);
        p.sprite.material.dispose();
        fireworkParticles.splice(i,1);
      }
    }
    if(fireworkParticles.length === 0 && pendingBursts.length === 0) fireworkActive = false;
  }

  function spawnFireworkSimple(origin, count, speed){
    if(reducedMotion || count <= 0) return;
    var palette = [0xffe3c2, 0xffb066, 0xfff4de];
    for(var i=0;i<count;i++){
      var theta = Math.random()*Math.PI*2;
      var phi = Math.random()*Math.PI;
      var dir = new THREE.Vector3(Math.sin(phi)*Math.cos(theta), Math.abs(Math.cos(phi)), Math.sin(phi)*Math.sin(theta));
      var vel = dir.multiplyScalar(speed * (0.7 + Math.random()*0.5));
      var mat = new THREE.SpriteMaterial({ map:fireworkStreakTex, color:palette[i%palette.length], transparent:true, opacity:1, blending:THREE.AdditiveBlending, depthWrite:false });
      var sprite = new THREE.Sprite(mat);
      var sc = 0.8 + Math.random()*0.4;
      sprite.scale.set(sc*0.5, sc*1.8, 1);
      sprite.position.copy(origin);
      scene.add(sprite);
      fireworkParticles.push({ sprite:sprite, vel:vel, life:1, maxLife:0.55 + Math.random()*0.25, isFlash:false });
    }
  }

  // Content shown when a portfolio card is opened
  var STORY_DATA = {
    magnus: {
      images:['images/logos/magnus-logo.png'],
      title:'AI Software Engineering Intern',
      org:'Magnus Investment Partners · Malibu, CA · May 2026 - Present',
      desc:'Built a multi-agent LangGraph workflow combining embedding-based RAG with deterministic ranking, structured validation, and fallback execution for reliable LLM-generated recommendations.',
      tags:['LangGraph','RAG','Python','Agentic AI'],
      links:[],
      pos:new THREE.Vector3(46, 48, -48),
      look:new THREE.Vector3(22, 58, -140)
    },

    ucsf: {
      images:['images/logos/ucsf-logo.png'],
      title:'Full-Stack Developer Intern',
      org:'LIN Lab, UCSF · San Francisco, CA · June 2026 - Present',
      desc:'Developing a NestJS/PostgreSQL platform with two Next.js clients, Dockerized local development, environment-selectable local and S3 audio storage, and hardened authentication and database seeding.',
      tags:['NestJS','PostgreSQL','Next.js','Docker','AWS S3'],
      links:[
        { label:'Website', url:'https://linlab.ucsf.edu/' }
      ],
      pos:new THREE.Vector3(-46, 58, -72),
      look:new THREE.Vector3(-18, 66, -160)
    },

    mathworks: {
      images:['images/logos/mathworks-logo.png'],
      title:'Machine Learning Project Intern',
      org:'MathWorks · Los Angeles, CA · Jun 2025 - Aug 2025',
      desc:'Designed an end-to-end speech noise-suppression pipeline using STFT and deep learning, achieving 62–73% noise reduction and 0.943 correlation with clean reference audio.',
      tags:['MATLAB','Deep Learning','Signal Processing','STFT'],
      links:[],
      pos:new THREE.Vector3(42, 68, -96),
      look:new THREE.Vector3(16, 76, -184)
    },

    'personal-website': {
      logos:[],
      photos:[],
      title:'Personal Website',
      org:'This portfolio',
      desc:'Designed and built this interactive 3D portfolio as a mountain journey, adding cinematic effects, careful design details, and visual taste across scroll-driven camera movement, terrain-aware firefly navigation, responsive sections, and clickable detail views.',
      tags:['Three.js','JavaScript','CSS','Interaction Design'],
      links:[
        { label:'View on GitHub', url:'https://github.com/sjxchng' }
      ],
      pos:new THREE.Vector3(-26, 72, -112),
      look:new THREE.Vector3(-8, 82, -206)
    },

    drumvoice: {
      logos:[],
      photos:['images/covers/drumvoice-cover.png'],
      imageFit:'contain',
      title:'DrumVoice',
      org:'Personal Project',
      desc:'Built a real-time voice-controlled practice tool with AI-based natural-language parsing and a deterministic regex fallback, integrating metronome, tap tempo, subdivisions, and voice-controlled PDF sheet-music navigation.',
      tags:['Node.js','Express','JavaScript','PDF.js'],
      links:[
        { label:'View on GitHub', url:'https://github.com/sjxchng' }
      ],
      pos:new THREE.Vector3(38, 82, -148),
      look:new THREE.Vector3(12, 90, -226)
    },

    hkn: {
      logos:['images/logos/hkn-logo.png'],
      photos:[
        'images/photos/activities/hkn/calendar.png',
        'images/photos/activities/hkn/course-guide.png'
      ],
      title:'Eta Kappa Nu',
      org:'UC Berkeley EECS Honor Society',
      desc:'Computing Services Officer for Berkeley’s Eta Kappa Nu chapter, contributing to the technical systems supporting chapter operations and member services, in addition to tutoring.',
      tags:['Computing Services','EECS','Leadership'],
      links:[],
      pos:new THREE.Vector3(-40, 78, -160),
      look:new THREE.Vector3(-22, 76, -200)
    },

    music: {
      logos:[
        'images/logos/music-logo.jpg',
        'images/logos/fcs-logo.png'
      ],
      photos:[
        'images/photos/activities/music/fcs-crossroads-post-concert.png',
        'images/photos/activities/music/drumline.png',
        'images/photos/activities/music/timpani.png',
        'images/photos/activities/music/fcs-concert-singing.png'    
      ],
      title:'Musical Activities',
      org:'UC Berkeley Symphony Orchestra · Drumming · FCS A Cappella',
      desc: 'Music has been part of my life since I started playing piano at four. I later found percussion and spent years performing in school and honor ensembles, including California All-State & All-Southern. At Cal, that journey continues through Symphony Orchestra and FCS A Cappella, where I discovered a new side of ensemble music through singing. I also continue playing drums and cajon for worship.',
      tags:['Drumming', 'Percussio Performance','A Cappella'],
      links:[],
      pos:new THREE.Vector3(30, 82, -175),
      look:new THREE.Vector3(14, 80, -215)
    },

    yhwh: {
      logos:['images/logos/yhwh-logo.jpg'],
      photos:[
        'images/photos/activities/yhwh/website-1.png',
        'images/photos/activities/yhwh/website-2.png',
        'images/photos/activities/yhwh/website-3.png'
      ],
      title:'YHWH Apparel',
      org:'Web Developer',
      desc:'Contributed to YHWH Apparel as a web developer, working on the organization’s web presence and frontend experience.',
      tags:['Web Development','Frontend'],
      links:[],
      pos:new THREE.Vector3(18, 90, -192),
      look:new THREE.Vector3(4, 88, -228)
    },

    taug: {
      logos:['images/logos/taug-logo.jpg'],
      photos:[
        'images/photos/activities/taug/group-photo.png',
        'images/photos/activities/taug/siwoo-journal.png'
      ],
      title:'TAUG Journal',
      org:'Web Developer',
      desc:'Contributed to TAUG Journal as both a writer and web developer, publishing my own work, attending conferences, and helping build the journal’s digital presence.',
      tags:['Web Development','Publishing'],
      links:[],
      pos:new THREE.Vector3(-8, 93, -198),
      look:new THREE.Vector3(2, 91, -232)
    }
  };

  var travelState = 'idle';
  var travelT = 0;
  var travelDuration = 2.5;
  var travelCurve = null;
  var travelLookCurve = null;
  var savedScrollT = 0;
  var fireflyOverridePos = null;
  var justArrived = false;
  var activeFireSpot = new THREE.Vector3();
  var activeFireLook = new THREE.Vector3();

  function buildGuidedCurve(start, end, clearance, lift){
    var full = new THREE.Vector3().subVectors(end, start);
    var dir = full.clone().normalize();
    var upRef = new THREE.Vector3(0,1,0);
    var side = new THREE.Vector3().crossVectors(dir, upRef).normalize();
    if(side.lengthSq() < 0.0001) side.set(1,0,0);
    var pts = [];
    var segments = 6;
    var peakLift = lift == null ? 34 : lift;
    for(var i=0;i<=segments;i++){
      var t = i/segments;
      var p = start.clone().lerp(end, t);
      var envelope = Math.sin(t*Math.PI);
      var zigSign = (i % 2 === 0) ? -1 : 1;
      p.add(side.clone().multiplyScalar((zigSign*4 + 3)*envelope));
      p.x = clampNum(p.x, -82, 82);
      if(t > 0.18 && t < 0.96){
        p.z = Math.min(p.z, -52 - envelope*22);
      }
      p.y += envelope * peakLift;
      liftAboveTerrain(p, clearance == null ? 18 : clearance);
      pts.push(p);
    }
    return new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  }

  var destPage = document.getElementById('destination-page');
  var destContent = document.getElementById('dest-content');
  var destEyebrow = document.getElementById('dest-eyebrow');
  var veil2 = document.getElementById('veil2');
  var destHint = document.getElementById('dest-hint');
  var destHintTimer = null;

  var DEST_NDC_X = 0.4;
  var DEST_NDC_Y = 0.32;
  var DEST_DISTANCE = 20;

  function computeScreenPoint(refCam, ndcX, ndcY, distance){
    var ndc = new THREE.Vector3(ndcX, ndcY, 0.5);
    ndc.unproject(refCam);
    var dir = ndc.sub(refCam.position).normalize();
    return refCam.position.clone().addScaledVector(dir, distance);
  }

  var travelLightCurve = null;

  function currentCameraLookPoint(distance){
    var dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return camera.position.clone().addScaledVector(dir, distance || 90);
  }

  function easeInOutQuad(x){ return x<0.5 ? 2*x*x : 1-Math.pow(-2*x+2,2)/2; }
  function easeInOutSine(x){ return -(Math.cos(Math.PI*x)-1)/2; }

  function beginTravel(id){
    var d = STORY_DATA[id];
    if(!d || travelState !== 'idle') return;

    savedScrollT = smoothedScrollT;
    activeFireSpot.copy(d.pos);
    activeFireLook.copy(d.look);
    liftAboveTerrain(activeFireSpot, 24);
    liftAboveTerrain(activeFireLook, 18);

    var camStart = camPath.getPointAt(Math.min(savedScrollT, VISUAL_SCROLL_MAX)).clone();
    var camEnd = activeFireSpot.clone();
    travelCurve = buildGuidedCurve(camStart, camEnd, 26, 44);
    travelLookCurve = buildGuidedCurve(currentCameraLookPoint(110), activeFireLook.clone(), 18, 12);

    var lightStart = fireflyGroup.position.clone();
    var tempCam = camera.clone();
    tempCam.position.copy(activeFireSpot);
    tempCam.up.set(0,1,0);
    tempCam.lookAt(activeFireLook);
    tempCam.updateMatrixWorld(true);
    tempCam.updateProjectionMatrix();
    var lightEnd = computeScreenPoint(tempCam, DEST_NDC_X, DEST_NDC_Y, DEST_DISTANCE);
    liftAboveTerrain(lightEnd, 18);
    travelLightCurve = buildGuidedCurve(lightStart, lightEnd, 18, 28);

    travelT = 0;
    travelState = 'out';
    document.body.style.overflow = 'hidden';
    document.body.classList.add('traveling');
    veil2.classList.add('visible');
    destEyebrow.textContent = 'Arriving';
    destHint.classList.remove('show', 'fade');
    if(destHintTimer){ clearTimeout(destHintTimer); destHintTimer = null; }

    var linksHTML = d.links.map(function(l){
      return '<a href="'+l.url+'" target="_blank" rel="noopener">'+l.label+' ↗</a>';
    }).join('');
    var imagesHTML = '';
    var photos = d.photos || [];
    var legacyImages = d.images || [];
    var hasModernMedia = photos.length > 0;
    function photoSliderHTML(sources, fit){
      if(!sources.length) return '';
      var still = sources.length === 1 ? ' is-still' : '';
      var fitClass = fit === 'contain' ? ' contain-media' : '';
      var loopSources = sources.length > 1 ? sources.concat(sources) : sources;
      var countStyle = sources.length > 1 ? ' style="--track-width:'+(sources.length*200)+'%; --slide-basis:'+(100/(sources.length*2))+'%"' : '';
      return '<div class="dest-media-slider dest-photo-slider'+still+fitClass+'" aria-label="'+d.title+' photos"><div class="dest-slide-track"'+countStyle+'>' +
        loopSources.map(function(src){ return '<img src="'+src+'" alt="'+d.title+' photo">'; }).join('') +
      '</div></div>';
    }
    if(photos.length === 1 && d.imageFit === 'contain'){
      imagesHTML += '<img class="dest-full-image" src="'+photos[0]+'" alt="'+d.title+'">';
    } else {
      imagesHTML += photoSliderHTML(photos, d.imageFit || 'cover');
    }
    if(!hasModernMedia && legacyImages.length && legacyImages.length === 1 && /logo/i.test(legacyImages[0])){
      imagesHTML = '<img class="dest-logo-image" src="'+legacyImages[0]+'" alt="'+d.title+' logo">';
    } else if(!hasModernMedia && legacyImages.length && d.imageFit === 'contain' && legacyImages.length === 1){
      imagesHTML = '<img class="dest-full-image" src="'+legacyImages[0]+'" alt="'+d.title+'">';
    } else if(!hasModernMedia && legacyImages.length){
      imagesHTML =
      '<div class="coverflow-wrap" id="dest-cf-wrap"><div class="coverflow" id="dest-cf">' +
      legacyImages.map(function(src){
        var classes = [];
        if(/logo/i.test(src)) classes.push('logo-image');
        if(d.imageFit === 'contain') classes.push('contain-image');
        var itemClass = d.imageFit === 'contain' ? 'cf-item contain-item' : 'cf-item';
        if(/logo/i.test(src)) itemClass += ' logo-item';
        var imageClass = classes.length ? ' class="'+classes.join(' ')+'"' : '';
        return '<div class="'+itemClass+'"><img src="'+src+'" alt="'+d.title+'"'+imageClass+'></div>';
      }).join('') +
      '</div></div>';
    }
    destContent.innerHTML =
      imagesHTML +
      '<div class="dest-title">'+d.title+'</div>' +
      '<div class="dest-org">'+d.org+'</div>' +
      '<div class="dest-desc">'+d.desc+'</div>' +
      '<div class="dest-tags">'+d.tags.join(' · ')+'</div>' +
      (linksHTML ? '<div class="dest-links">'+linksHTML+'</div>' : '') +
      '<div class="dest-return-note">Click the light to return</div>';

    var cfWrap = document.getElementById('dest-cf-wrap');
    if(cfWrap) setupCoverflow(cfWrap);
  }

  function beginReturn(){
    if(travelState !== 'destination') return;
    var camStart = activeFireSpot.clone();
    var camEnd = camPath.getPointAt(savedScrollT).clone();
    travelCurve = buildGuidedCurve(camStart, camEnd, 24, 38);
    travelLookCurve = buildGuidedCurve(activeFireLook.clone(), lookPath.getPointAt(savedScrollT).clone(), 18, 12);

    var lightStart = fireflyGroup.position.clone();
    var lightEnd = camEnd.clone();
    liftAboveTerrain(lightEnd, 18);
    travelLightCurve = buildGuidedCurve(lightStart, lightEnd, 18, 26);

    travelT = 0;
    travelState = 'back';
    destPage.classList.remove('visible');
    destHint.classList.remove('show', 'fade');
    if(destHintTimer){ clearTimeout(destHintTimer); destHintTimer = null; }
  }

  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && travelState === 'destination') beginReturn(); });

  destPage.addEventListener('click', function(e){
    if(travelState !== 'destination') return;
    if(e.target.closest('a')) return;
    var dx = e.clientX - fireflyScreenPos.x;
    var dy = e.clientY - fireflyScreenPos.y;
    if(Math.sqrt(dx*dx + dy*dy) < 60){
      beginReturn();
    }
  });
  destPage.addEventListener('mousemove', function(e){
    if(travelState !== 'destination') return;
    var dx = e.clientX - fireflyScreenPos.x;
    var dy = e.clientY - fireflyScreenPos.y;
    destPage.style.cursor = Math.sqrt(dx*dx+dy*dy) < 60 ? 'pointer' : 'default';
  });

  document.querySelectorAll('[data-story]').forEach(function(el){
    el.addEventListener('click', function(){ beginTravel(el.getAttribute('data-story')); });
    el.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); beginTravel(el.getAttribute('data-story')); }
    });
  });

  document.querySelectorAll('.skill-card img').forEach(function(img){
    img.addEventListener('error', function(){
      var card = img.closest('.skill-card');
      var label = card ? card.querySelector('span:last-child') : null;
      if(!card || card.querySelector('.skill-mark')) return;
      var text = label ? label.textContent.trim() : img.alt.replace(/\s*logo\s*/i, '').trim();
      var mark = document.createElement('span');
      mark.className = 'skill-mark';
      mark.textContent = text.split(/\s+/).map(function(part){ return part.charAt(0); }).join('').slice(0, 4).toUpperCase();
      img.replaceWith(mark);
    });
  });

  // Scroll-driven camera path through the portfolio sections
  var camps = [
    { pos:new THREE.Vector3(10, 8, 124),    look:new THREE.Vector3(-8, 14, 48) },
    { pos:new THREE.Vector3(-46, 32, 72),   look:new THREE.Vector3(-12, 30, 0) },
    { pos:new THREE.Vector3(-72, 56, 42),   look:new THREE.Vector3(-28, 52, -34) },
    { pos:new THREE.Vector3(58, 80, -8),    look:new THREE.Vector3(20, 76, -92) },
    { pos:new THREE.Vector3(-34, 98, -70),  look:new THREE.Vector3(-10, 100, -156) },
    { pos:new THREE.Vector3(18, 114, -118), look:new THREE.Vector3(4, 120, -218) },
    { pos:new THREE.Vector3(0, 136, -156),  look:new THREE.Vector3(0, 144, -272) }
  ];
  var camPath = new THREE.CatmullRomCurve3(camps.map(function(c){ return c.pos; }));
  var lookPath = new THREE.CatmullRomCurve3(camps.map(function(c){ return c.look; }));
  var VISUAL_SCROLL_MAX = 0.91;
  var currentCameraT = 0;
  var sectionMeta = [];

  var introDone = true, introT = 1, fireflyIntroT = 0;
  var fireflyIntroSeeded = false;
  var smoothedScrollT = 0, targetScrollT = 0;

  function easeOutCubic(x){ return 1 - Math.pow(1-x, 3); }

  function getScrollFraction(){
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    if(max <= 0) return 0;
    return Math.min(1, Math.max(0, window.scrollY / max));
  }

  function refreshSectionMeta(){
    var doc = document.documentElement;
    var max = Math.max(1, doc.scrollHeight - window.innerHeight);
    sectionMeta = Array.prototype.slice.call(document.querySelectorAll('.camp')).map(function(section){
      return {
        start: clampNum(section.offsetTop / max, 0, 1),
        elev: Number(section.getAttribute('data-elev')) || 0,
        name: section.getAttribute('data-name') || ''
      };
    }).sort(function(a, b){ return a.start - b.start; });
  }

  function updateHUD(t){
    if(!sectionMeta.length) refreshSectionMeta();
    var idx = 0;
    for(var i=0; i<sectionMeta.length; i++){
      if(t >= sectionMeta[i].start - 0.01) idx = i;
    }
    var current = sectionMeta[idx] || { elev:800, name:'Trailhead', start:0 };
    var next = sectionMeta[Math.min(idx + 1, sectionMeta.length - 1)] || current;
    var span = Math.max(0.0001, next.start - current.start);
    var localT = clampNum((t - current.start) / span, 0, 1);
    var elevVal = current.elev + (next.elev - current.elev) * localT;
    document.getElementById('elev-val').textContent = Math.round(elevVal).toLocaleString() + ' FT';
    document.getElementById('camp-val').textContent = current.name;
  }

  function colorMix(a, b, t){
    return new THREE.Color(a).lerp(new THREE.Color(b), clampNum(t, 0, 1));
  }

  function updateDayCycle(t){
    var day = Math.sin(Math.PI * clampNum(t, 0, 1));
    var evening = Math.max(0, (t - 0.68) / 0.32);
    var dawnTop = new THREE.Color(0x17223d);
    var dayTop = new THREE.Color(0x7ea9c8);
    var nightTop = new THREE.Color(0x10162a);
    var dawnBottom = new THREE.Color(0x5a536c);
    var dayBottom = new THREE.Color(0xf1c58d);
    var nightBottom = new THREE.Color(0x27263d);

    var top = dawnTop.clone().lerp(dayTop, day);
    var bottom = dawnBottom.clone().lerp(dayBottom, day);
    top.lerp(nightTop, evening);
    bottom.lerp(nightBottom, evening);

    if(skyMaterial){
      skyMaterial.uniforms.topColor.value.copy(top);
      skyMaterial.uniforms.bottomColor.value.copy(bottom);
    }
    if(scene && scene.fog){
      scene.fog.color.copy(colorMix(0x101827, 0xaab7c1, day * 0.55).lerp(new THREE.Color(0x111525), evening));
      scene.fog.density = 0.0034 + (1 - day) * 0.0008;
    }
    if(renderer){
      renderer.setClearColor(top, 1);
    }
    if(ambientLight){
      ambientLight.color.copy(colorMix(0x3c4b66, 0xb7c1bd, day).lerp(new THREE.Color(0x343852), evening));
      ambientLight.intensity = 0.72 + day * 0.58;
    }
    if(sunLight){
      sunLight.color.copy(colorMix(0xffc58e, 0xfff1c6, day).lerp(new THREE.Color(0x91a3d8), evening));
      sunLight.intensity = 0.28 + day * 0.95 - evening * 0.35;
      sunLight.position.set(-70 + t*130, 26 + day*120, -35 - t*70);
    }
    if(starField){
      starField.material.opacity = clampNum(0.58 - day * 0.48 + evening * 0.52, 0.08, 0.7);
    }
  }

  var scrollCueEl = document.querySelector('.scroll-cue');
  function onScroll(){
    targetScrollT = getScrollFraction();
    if(scrollCueEl){
      scrollCueEl.style.opacity = window.scrollY < window.innerHeight * 0.4 ? '' : '0';
    }
  }

  function onMouseMove(e){
    mouseActive = true;
    mouseNX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseNY = (e.clientY / window.innerHeight) * 2 - 1;
  }

  var fireflyScreenPos = new THREE.Vector2();
  function checkFireflyHover(e){
    if(!fireflyGroup) return;
    var dx = e.clientX - fireflyScreenPos.x;
    var dy = e.clientY - fireflyScreenPos.y;
    var dist = Math.sqrt(dx*dx + dy*dy);
    canvas.style.cursor = dist < 55 ? 'pointer' : 'default';
  }

  function nextSection(){
    var sections = document.querySelectorAll('.camp');
    var currentTop = window.scrollY + 40;
    for(var i=0;i<sections.length;i++){
      if(sections[i].offsetTop > currentTop){
        window.scrollTo({ top: sections[i].offsetTop, behavior:'smooth' });
        return;
      }
    }
  }

  function onClick(e){
    if(travelState !== 'idle') return;
    var dx = e.clientX - fireflyScreenPos.x;
    var dy = e.clientY - fireflyScreenPos.y;
    if(Math.sqrt(dx*dx + dy*dy) < 55){
      nextSection();
    }
  }

  var projVec = new THREE.Vector3();
  function updateFireflyScreenPos(){
    if(!fireflyGroup) return;
    projVec.copy(fireflyGroup.position).project(camera);
    fireflyScreenPos.x = (projVec.x * 0.5 + 0.5) * window.innerWidth;
    fireflyScreenPos.y = (-projVec.y * 0.5 + 0.5) * window.innerHeight;
    if(travelState === 'destination'){
      destHint.style.left = fireflyScreenPos.x + 'px';
      destHint.style.top = fireflyScreenPos.y + 'px';
    }
  }

  // Main render loop
  function animate(){
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    var elapsed = clock.elapsedTime;

    if(travelState === 'out' || travelState === 'back'){
      travelT += dt / (reducedMotion ? 0.5 : travelDuration);
      var tt = Math.min(1, travelT);
      var te = easeInOutSine(tt);
      var camT = Math.max(0, te - 0.1);
      var curvePos = travelCurve.getPointAt(camT);
      camera.position.copy(curvePos);
      var leadPos = travelLightCurve.getPointAt(te);
      fireflyOverridePos = leadPos;
      var lookPoint = travelLookCurve ? travelLookCurve.getPointAt(te) : activeFireLook;
      camera.lookAt(lookPoint);

      if(tt >= 1){
        if(travelState === 'out'){
          travelState = 'destination';
          fireflyOverridePos = null;
          travelLookCurve = null;
          justArrived = true;
          veil2.classList.remove('visible');
          destPage.classList.add('visible');
          destEyebrow.textContent = 'You\u2019ve arrived';
        } else {
          travelState = 'idle';
          fireflyOverridePos = null;
          travelLookCurve = null;
          document.body.style.overflow = '';
          document.body.classList.remove('traveling');
          veil2.classList.remove('visible');
        }
      }
    } else if(travelState === 'destination'){
      if(justArrived){
        camera.position.copy(activeFireSpot);
        camera.lookAt(activeFireLook);
        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();
        var burstOrigin = computeScreenPoint(camera, DEST_NDC_X, DEST_NDC_Y, DEST_DISTANCE);
        spawnFirework(burstOrigin, { count:36, speed:22 });
        fireflyGroup.position.copy(burstOrigin);
        justArrived = false;
        destHintTimer = setTimeout(function(){
          destHint.classList.add('show');
          destHintTimer = setTimeout(function(){ destHint.classList.add('fade'); }, 3800);
        }, 1300);
      }
      var bob = Math.sin(elapsed*0.4)*1.2;
      camera.position.set(activeFireSpot.x, activeFireSpot.y + bob*0.2, activeFireSpot.z);
      camera.lookAt(activeFireLook);
    } else {
      smoothedScrollT += (targetScrollT - smoothedScrollT) * (reducedMotion ? 1 : Math.min(1, dt*1.3));
      var ct = smoothedScrollT;
      var visualT = Math.min(ct, VISUAL_SCROLL_MAX);
      currentCameraT = visualT;
      var scrollCamPos = camPath.getPointAt(visualT);
      if(ct < 0.34){
        scrollCamPos.y = Math.max(scrollCamPos.y, 16 + ct * 150);
      }
      camera.position.copy(scrollCamPos);
      camera.lookAt(lookPath.getPointAt(visualT));
      updateHUD(ct);
    }

    updateDayCycle(smoothedScrollT);

    for(var m=0;m<mistLayers.length;m++){
      var layer = mistLayers[m];
      layer.position.y = layer.userData.baseY + Math.sin(elapsed*0.15 + layer.userData.phase)*2.2;
      layer.position.x = Math.sin(elapsed*0.08 + layer.userData.phase)*14;
    }
    if(grassWindShader){
      grassWindShader.uniforms.uTime.value = elapsed;
    }

    updateFireworks(dt);

    if(fireflyGroup){
      var fPos;
      if(!introDone || smoothedScrollT < 0.025){
        fireflyIntroT = Math.min(1, fireflyIntroT + dt / (reducedMotion ? 1.0 : 4.2));
        var introFlyT = easeInOutSine(fireflyIntroT);
        var introFlyX = 1.34 - introFlyT * 0.88;
        var introFlyY = 0.12 + Math.sin(elapsed*1.15)*0.018;
        fPos = computeScreenPoint(camera, introFlyX, introFlyY, 18);
        if(!fireflyIntroSeeded){
          fireflyGroup.position.copy(fPos);
          fireflyIntroSeeded = true;
        } else {
          fireflyGroup.position.lerp(fPos, 0.028);
        }
      } else if(fireflyOverridePos){
        fPos = fireflyOverridePos.clone();
        fPos.y += Math.sin(elapsed*2.4)*0.4;
        fireflyGroup.position.lerp(fPos, 0.18);
      } else if(travelState === 'destination'){
        if(fireworkActive || justArrived){
          fPos = fireflyGroup.position.clone();
        } else {
          fPos = computeScreenPoint(camera, DEST_NDC_X, DEST_NDC_Y + Math.sin(elapsed*1.6)*0.015, DEST_DISTANCE);
        }
        fireflyGroup.position.lerp(fPos, 0.09);
      } else {
        if(smoothedScrollT > 0.025 && smoothedScrollT < 0.36){
          fPos = computeScreenPoint(camera, 0.32, 0.18 + Math.sin(elapsed*1.4)*0.02, 18);
        } else {
          var pathT = Math.min(VISUAL_SCROLL_MAX, currentCameraT + 0.07);
          fPos = camPath.getPointAt(pathT).clone();
          fPos.y += Math.sin(elapsed*1.3)*1.1 + 2.4;
          fPos.x += Math.cos(elapsed*1.0)*2.0;
          if(mouseActive){
            fPos.x += mouseNX * 5.5;
            fPos.y += -mouseNY * 3.5;
          }
        }
        fireflyGroup.position.lerp(fPos, smoothedScrollT < 0.36 ? 0.16 : 0.05);
      }

      fireflyTrailPositions.unshift(fireflyGroup.position.clone());
      if(fireflyTrailPositions.length > fireflyTrail.length + 6) fireflyTrailPositions.pop();
      for(var tI=0; tI<fireflyTrail.length; tI++){
        var p = fireflyTrailPositions[tI + 4];
        if(p){ fireflyTrail[tI].position.copy(p); }
      }
      var flicker = 0.9 + Math.sin(elapsed*3.1)*0.14 + Math.sin(elapsed*7.7)*0.05;
      var coreDist = camera.position.distanceTo(fireflyGroup.position);
      var coreFactor = clampNum(coreDist / FIREFLY_REF_DIST, 0.5, 1.5);
      var guideScaleBoost = (!introDone || smoothedScrollT < 0.36) ? 2.65 : 1;
      fireflyCore.scale.set(fireflyCore.userData.baseScale*flicker*coreFactor*guideScaleBoost, fireflyCore.userData.baseScale*flicker*coreFactor*guideScaleBoost, 1);
      for(var tS=0; tS<fireflyTrail.length; tS++){
        var trailSprite = fireflyTrail[tS];
        var tDist = camera.position.distanceTo(trailSprite.position);
        var tFactor = clampNum(tDist / FIREFLY_REF_DIST, 0.5, 1.5);
        var tBase = trailSprite.userData.baseScale;
        trailSprite.scale.set(tBase*tFactor*guideScaleBoost, tBase*tFactor*guideScaleBoost, 1);
      }
      updateFireflyScreenPos();
    }

    renderer.render(scene, camera);
  }

  function onResize(){
    W = window.innerWidth; H = window.innerHeight;
    camera.aspect = W/H; camera.updateProjectionMatrix();
    renderer.setSize(W, H);
    refreshSectionMeta();
  }

  // DOM setup and progressive section reveal
  function setupSections(){
    var sections = document.querySelectorAll('.camp');
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting && en.intersectionRatio > 0.32){ en.target.classList.add('in-view'); }
      });
    }, { threshold:[0, 0.32, 0.6] });
    sections.forEach(function(s){ io.observe(s); });
    refreshSectionMeta();
  }

  function setupCoverflow(wrap){
    if(!wrap) return;
    var items = wrap.querySelectorAll('.cf-item');
    if(items.length <= 1){
      items.forEach(function(item){
        item.style.transform = 'none';
        item.style.opacity = 1;
      });
      return;
    }
    var ticking = false;
    function update(){
      ticking = false;
      var wrapRect = wrap.getBoundingClientRect();
      var centerX = wrapRect.left + wrapRect.width/2;
      items.forEach(function(item){
        var r = item.getBoundingClientRect();
        var itemCenter = r.left + r.width/2;
        var delta = (itemCenter - centerX) / (wrapRect.width/2);
        var clamped = Math.max(-1.4, Math.min(1.4, delta));
        var rotateY = clamped * -42;
        var scale = 1 - Math.min(Math.abs(clamped), 1) * 0.22;
        var opacity = 1 - Math.min(Math.abs(clamped), 1) * 0.55;
        var z = -Math.abs(clamped) * 60;
        item.style.transform = 'translateZ('+z+'px) rotateY('+rotateY+'deg) scale('+scale+')';
        item.style.opacity = opacity;
      });
    }
    wrap.addEventListener('scroll', function(){
      if(!ticking){ requestAnimationFrame(update); ticking = true; }
    }, { passive:true });
    update();
  }

  function init(){
    try{
      initRenderer();
      initScene();
      buildTerrain();
      buildFirefly();
      setupSections();
      window.addEventListener('scroll', onScroll, { passive:true });
      window.addEventListener('resize', onResize);
      window.addEventListener('mousemove', function(e){ onMouseMove(e); checkFireflyHover(e); }, { passive:true });
      window.addEventListener('click', onClick);
      onScroll();
      animate();
      setTimeout(function(){
        var veil = document.getElementById('veil');
        veil.classList.add('hide');
        setTimeout(function(){ veil.style.display='none'; }, 1700);
      }, 400);
    } catch(err){
      document.getElementById('veil').style.display='none';
      canvas.style.display='none';
      document.body.style.background = 'linear-gradient(180deg, #050a12 0%, #14243a 100%)';
      console.error('Scene init failed', err);
    }
  }

  if(document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(init, 30);
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
