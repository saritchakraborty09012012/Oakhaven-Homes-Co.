import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { STAGES, stageAt, stageLocal } from '../stages.js'

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const lerp = (a, b, t) => a + (b - a) * t
const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const smooth = (t) => t * t * (3 - 2 * t)

const CAM = [
  { p: 0.0, pos: [-12.5, 5.4, 23.5], tgt: [1.3, 4.4, -3.0] },
  { p: 0.13, pos: [-13.5, 5.8, 22.8], tgt: [1.3, 3.6, -3.0] },
  { p: 0.30, pos: [-11.5, 6.2, 21.8], tgt: [1.4, 4.6, -3.2] },
  { p: 0.48, pos: [-13.0, 6.8, 23.0], tgt: [1.5, 5.0, -3.4] },
  { p: 0.64, pos: [-12.0, 6.0, 22.2], tgt: [1.5, 4.4, -3.2] },
  { p: 0.80, pos: [-11.2, 5.6, 21.5], tgt: [1.5, 4.0, -3.0] },
  { p: 0.93, pos: [-3.8, 2.7, 10.4], tgt: [-0.45, 2.35, -0.4] },
  { p: 1.0, pos: [-1.5, 1.9, 5.8], tgt: [-0.5, 2.05, -0.6] },
]

export class BuildScene {
  constructor(host, { onProgress, onStage, onLoad } = {}) {
    this.host = host
    this.onProgress = onProgress || (() => {})
    this.onStage = onStage || (() => {})
    this.onLoad = onLoad || (() => {})
    this.targetP = 0
    this.dispP = 0
    this.parts = []
    this.ready = false
    this.mouse = { x: 0, y: 0, tx: 0, ty: 0 }
    this.clock = new THREE.Clock()

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.setSize(host.clientWidth, host.clientHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.02
    host.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(
      38, host.clientWidth / host.clientHeight, 0.1, 400)
    this.camera.position.set(...CAM[0].pos)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

    this.buildSky()
    this.buildLights()
    this.buildGround()
    this.buildDust()
    this.buildComposer()

    window.addEventListener('resize', this._onResize = () => this.resize())
    window.addEventListener('scroll', this._onScroll = () => this.readScroll(),
      { passive: true })
    window.addEventListener('mousemove', this._onMouse = (e) => {
      this.mouse.tx = (e.clientX / window.innerWidth) * 2 - 1
      this.mouse.ty = (e.clientY / window.innerHeight) * 2 - 1
    })
    this.readScroll()

    window.__jump = (p) => {
      this.targetP = this.dispP = p
      this.apply(0, true)
    }
    window.__scene = this
    window.__THREE = THREE

    this.load()
    this.animate = this.animate.bind(this)
    this.raf = requestAnimationFrame(this.animate)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this._onResize)
    window.removeEventListener('scroll', this._onScroll)
    window.removeEventListener('mousemove', this._onMouse)
    this.renderer.dispose()
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
    }
  }

  readScroll() {
    const max = document.documentElement.scrollHeight - window.innerHeight
    this.targetP = max > 0 ? clamp01(window.scrollY / max) : 0
  }

  // ------------------------------------------------------------------ sky
  buildSky() {
    const geo = new THREE.SphereGeometry(280, 32, 16)
    this.skyUniforms = {
      top: { value: new THREE.Color('#6f9fd0') },
      bottom: { value: new THREE.Color('#e9eef4') },
      offset: { value: 20 },
      exponent: { value: 0.75 },
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vW; void main(){ vW = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform float offset; uniform float exponent;
        varying vec3 vW;
        void main(){ float h = normalize(vW + vec3(0., offset, 0.)).y;
          gl_FragColor = vec4(mix(bottom, top, pow(max(h,0.0), exponent)), 1.0); }`,
    })
    this.sky = new THREE.Mesh(geo, mat)
    this.scene.add(this.sky)
    this.scene.fog = new THREE.Fog('#dfe7ee', 60, 240)
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight('#bcd8f0', '#7a6a52', 0.6)
    this.scene.add(this.hemi)
    this.sun = new THREE.DirectionalLight('#fff3dd', 2.6)
    this.sun.position.set(-18, 26, 16)
    this.sun.castShadow = true
    const s = this.sun.shadow
    s.mapSize.set(2048, 2048)
    s.camera.near = 1
    s.camera.far = 90
    s.camera.left = -32
    s.camera.right = 32
    s.camera.top = 30
    s.camera.bottom = -24
    s.bias = -0.0003
    s.normalBias = 0.03
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)
    this.sun.target.position.set(1.5, 3, -3)

    this.lanternA = new THREE.PointLight('#ff7a2a', 0, 4.5, 2)
    this.lanternA.position.set(-1.85, 2.5, 0.3)
    this.lanternB = new THREE.PointLight('#ff7a2a', 0, 4.5, 2)
    this.lanternB.position.set(0.85, 2.5, 0.3)
    this.scene.add(this.lanternA, this.lanternB)

    // warm interior lamps (living room + staircase hall)
    this.intA = new THREE.PointLight('#ffc27a', 0, 9, 2)
    this.intA.position.set(-1.4, 2.3, -3.4)
    this.intB = new THREE.PointLight('#ffc27a', 0, 9, 2)
    this.intB.position.set(3.6, 2.3, -2.6)
    this.scene.add(this.intA, this.intB)
  }

  buildGround() {
    const tl = new THREE.TextureLoader()
    const dirt = tl.load('/assets/tex/dirt.png')
    dirt.wrapS = dirt.wrapT = THREE.RepeatWrapping
    dirt.repeat.set(26, 26)
    dirt.colorSpace = THREE.SRGBColorSpace
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 420),
      new THREE.MeshStandardMaterial({ map: dirt, roughness: 0.95 }))
    this.ground.rotation.x = -Math.PI / 2
    this.ground.position.y = -0.02
    this.ground.receiveShadow = true
    this.scene.add(this.ground)

    const grass = tl.load('/assets/tex/grass.png')
    grass.wrapS = grass.wrapT = THREE.RepeatWrapping
    grass.repeat.set(34, 34)
    grass.colorSpace = THREE.SRGBColorSpace
    this.lawnMat = new THREE.MeshStandardMaterial({
      map: grass, roughness: 0.92, transparent: true, opacity: 0,
    })
    this.lawn = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), this.lawnMat)
    this.lawn.rotation.x = -Math.PI / 2
    this.lawn.position.set(0, 0.015, -20)
    this.lawn.receiveShadow = true
    this.scene.add(this.lawn)
  }

  buildDust() {
    const n = 260
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = lerp(-18, 20, Math.random())
      pos[i * 3 + 1] = lerp(0.2, 10, Math.random())
      pos[i * 3 + 2] = lerp(-14, 9, Math.random())
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.dustMat = new THREE.PointsMaterial({
      color: '#fff1da', size: 0.07, transparent: true, opacity: 0.0,
      depthWrite: false, sizeAttenuation: true,
    })
    this.dust = new THREE.Points(geo, this.dustMat)
    this.scene.add(this.dust)
  }

  buildComposer() {
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(this.host.clientWidth, this.host.clientHeight),
      0.45, 0.55, 0.85)
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())
  }

  // ------------------------------------------------------------------ load
  load() {
    const tl = new THREE.TextureLoader()
    const loader = new GLTFLoader()
    loader.load('/assets/house.glb', (gltf) => {
      const root = gltf.scene
      root.traverse((o) => {
        if (!o.isMesh) return
        o.castShadow = true
        o.receiveShadow = true
        if (o.material) {
          o.material.envMapIntensity = 0.18
          if (o.material.map) o.material.map.anisotropy = 4
        }
        const name = o.name
        if (name.startsWith('env_tree') && name.endsWith('_leaf')) {
          o.castShadow = false
        }
        if (name === 'home_walk' || name === 'home_drive' || name === 'home_beds') {
          o.castShadow = false
        }
        if (name === 'fnd_deck' || name.startsWith('dry_deck')) {
          // roof/wall decks keep shadows
        }
      })
      this.root = root
      this.scene.add(root)
      this.parseParts(root)
      this.setupGlass(root)
      this.buildBlueprint(root)
      this.ready = true
      window.__ready = true
      this.onLoad()
    }, undefined, (err) => {
      console.error('GLB load failed', err)
      this.onLoad()
    })
    void tl
  }

  parseParts(root) {
    const fadeAnims = new Set(['pop', 'fade', 'temp'])
    root.traverse((o) => {
      if (!o.isMesh || !o.name.includes('|')) return
      const bits = o.name.split('|')
      if (bits.length < 6) return
      const [stage, oCode, anim, vstage, vCode, label, axis] = bits
      const base = o.position.clone()
      let ax = new THREE.Vector3(0, -1, 0)
      if (axis) {
        const v = axis.split(',').map((x) => parseInt(x, 10) / 1000)
        if (v.every((x) => !Number.isNaN(x))) ax.set(v[0], v[1], v[2])
      }
      if (fadeAnims.has(anim) && o.material) {
        o.material = o.material.clone()
        o.material.transparent = true
      }
      this.parts.push({
        mesh: o, stage, order: parseInt(oCode, 10) / 1000, anim,
        vstage, vorder: parseInt(vCode, 10) / 1000, label, base, axis: ax,
      })
    })
    // hide everything up front (env parts re-shown in apply)
    for (const pt of this.parts) pt.mesh.visible = false
  }

  setupGlass(root) {
    this.glowMats = []
    const seen = new Set()
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return
      const m = o.material
      if (seen.has(m.uuid)) return
      if (m.name === 'glass') {
        seen.add(m.uuid)
        m.transparent = true
        m.emissive = new THREE.Color('#ff9a4d')
        m.emissiveIntensity = 0
        m.envMapIntensity = 1.1
        this.glowMats.push(m)
      } else if (m.name === 'bulb') {
        seen.add(m.uuid)
        m.emissiveIntensity = 0
        if (!this.bulbMats) this.bulbMats = []
        this.bulbMats.push(m)
      }
    })
  }

  buildBlueprint(root) {
    const positions = []
    const tmp = new THREE.Vector3()
    root.traverse((o) => {
      if (!o.isMesh || !o.name.includes('|')) return
      const stage = o.name.split('|')[0]
      const label = o.name.split('|')[5] || ''
      if (!['fnd', 'frm', 'dry', 'ext'].includes(stage)) return
      if (label.startsWith('glow_') || label.startsWith('fnd_mound') ||
          label.startsWith('fnd_lumber') || label.startsWith('dry_felt') ||
          label.startsWith('dry_shingle') || label.startsWith('frm_deck')) return
      o.updateMatrixWorld(true)
      const eg = new THREE.EdgesGeometry(o.geometry, 20)
      const p = eg.attributes.position
      for (let i = 0; i < p.count; i++) {
        tmp.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld)
        positions.push(tmp.x, tmp.y, tmp.z)
      }
      eg.dispose()
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    this.bpMat = new THREE.LineBasicMaterial({
      color: '#ffffff', transparent: true, opacity: 0.32,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
    this.blueprint = new THREE.LineSegments(geo, this.bpMat)
    this.blueprint.position.set(0, 0.01, 0)
    this.scene.add(this.blueprint)

    const cnv = document.createElement('canvas')
    cnv.width = cnv.height = 256
    const g = cnv.getContext('2d')
    const grad = g.createRadialGradient(128, 128, 6, 128, 128, 128)
    grad.addColorStop(0, 'rgba(214,232,255,0.45)')
    grad.addColorStop(1, 'rgba(214,232,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 256)
    this.bpGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 18),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(cnv), transparent: true, opacity: 0.24,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }))
    this.bpGlow.rotation.x = -Math.PI / 2
    this.bpGlow.position.set(-0.5, 0.03, -4.5)
    this.scene.add(this.bpGlow)
    this.bpLight = new THREE.PointLight('#cfe0ff', 0, 18, 2)
    this.bpLight.position.set(-0.5, 6, -4.5)
    this.scene.add(this.bpLight)
  }

  // -------------------------------------------------------------- animate
  stageT(p, id) {
    const s = STAGES.find((x) => x.id === id)
    return stageLocal(p, s)
  }

  apply(dt, instant = false) {
    const p = this.dispP
    const idx = stageAt(p)
    const stage = STAGES[idx]

    // parts
    for (const pt of this.parts) {
      const { mesh } = pt
      if (pt.stage === 'env') {
        mesh.visible = true
        continue
      }
      const st = STAGES.find((s) => s.id === pt.stage)
      if (!st) { mesh.visible = true; continue }
      const ls = stageLocal(p, st)
      if (pt.anim === 'temp') {
        const tin = clamp01((ls - pt.order) / 0.10)
        const vs = STAGES.find((s) => s.id === pt.vstage)
        const vls = vs ? stageLocal(p, vs) : 1
        const tout = clamp01((vls - pt.vorder) / 0.10)
        const op = easeOut(tin) * (1 - easeOut(tout))
        mesh.visible = op > 0.01
        if (mesh.material) {
          mesh.material.opacity = op
          mesh.material.transparent = true
        }
        continue
      }
      const raw = (ls - pt.order * 0.74) / 0.26
      const t = clamp01(raw)
      const e = easeOut(t)
      mesh.visible = t > 0.0005
      switch (pt.anim) {
        case 'grow':
          mesh.scale.set(1, Math.max(e, 0.0001), 1)
          mesh.position.copy(pt.base)
          break
        case 'rise':
          mesh.position.set(pt.base.x, pt.base.y - (1 - e) * 2.2, pt.base.z)
          mesh.scale.set(1, 1, 1)
          break
        case 'drop':
          mesh.position.set(pt.base.x, pt.base.y + (1 - e) * 1.6, pt.base.z)
          mesh.scale.set(1, 1, 1)
          break
        case 'slide':
          mesh.position.copy(pt.base).addScaledVector(pt.axis, (1 - e) * 2.4)
          mesh.scale.set(1, 1, 1)
          break
        case 'pop': {
          const s = 0.62 + 0.38 * e
          mesh.scale.set(s, s, s)
          mesh.position.copy(pt.base)
          if (mesh.material) mesh.material.opacity = e
          break
        }
        case 'fade':
          mesh.position.copy(pt.base)
          mesh.scale.set(1, 1, 1)
          if (mesh.material) mesh.material.opacity = e
          break
        default:
          mesh.position.copy(pt.base)
          mesh.scale.set(1, 1, 1)
      }
    }

    // blueprint exit: sinks into the ground (keeps the white glow while visible)
    const fndLs = stageLocal(p, STAGES[1])
    const sink = smooth(clamp01((fndLs - 0.18) / 0.47))
    if (this.blueprint) {
      this.blueprint.visible = sink < 0.999
      this.blueprint.position.y = 0.01 - sink * 13
    }
    const bpVis = this.blueprint && this.blueprint.visible ? 1 - sink : 0
    if (this.bpGlow) {
      this.bpGlow.visible = bpVis > 0.01
      this.bpGlow.material.opacity = 0.55 * bpVis
      this.bpGlow.position.y = 0.03 - sink * 13
    }
    if (this.bpLight) {
      this.bpLight.visible = bpVis > 0.01
      this.bpLight.intensity = 16 * bpVis
    }

    // home / dusk transition
    const homeLs = stageLocal(p, STAGES[5])
    const dusk = smooth(clamp01((homeLs - 0.12) / 0.55))
    this.sun.color.setStyle('#fff3dd').lerp(new THREE.Color('#ffab63'), dusk)
    this.sun.intensity = lerp(2.6, 1.85, dusk)
    this.sun.position.set(lerp(-18, -24, dusk), lerp(26, 11, dusk),
      lerp(16, 15, dusk))
    this.hemi.intensity = lerp(0.45, 0.34, dusk)
    this.hemi.color.setStyle('#bcd8f0').lerp(new THREE.Color('#8f9fd6'), dusk)
    this.hemi.groundColor.setStyle('#7a6a52').lerp(new THREE.Color('#4a3f36'), dusk)
    this.skyUniforms.top.value.setStyle('#6f9fd0').lerp(new THREE.Color('#3d4f84'), dusk)
    this.skyUniforms.bottom.value.setStyle('#e9eef4').lerp(new THREE.Color('#f2b57e'), dusk)
    this.scene.fog.color.setStyle('#dfe7ee').lerp(new THREE.Color('#d9a97e'), dusk)
    this.renderer.toneMappingExposure = lerp(0.98, 0.86, dusk)

    const glow = smooth(clamp01((homeLs - 0.28) / 0.35))
    // at WELCOME the glass dims so the lit interior reads through it
    const welLs = stageLocal(p, STAGES[6])
    const welOpen = smooth(clamp01(welLs / 0.45))
    for (const m of this.glowMats || []) {
      m.emissiveIntensity = glow * 1.7 * (1 - welOpen * 0.78)
      m.opacity = 0.4 - welOpen * 0.16
    }
    for (const m of this.bulbMats || []) m.emissiveIntensity = glow * 0.9
    this.lanternA.intensity = glow * 4
    this.lanternB.intensity = glow * 4
    this.intA.intensity = glow * (6 + welOpen * 9)
    this.intB.intensity = glow * (6 + welOpen * 9)
    this.lawnMat.opacity = smooth(clamp01((homeLs - 0.18) / 0.28))

    // dust density
    let dust = 0.04
    if (stage.id === 'frm') dust = 0.16
    else if (stage.id === 'dry') dust = 0.12
    else if (stage.id === 'fnd') dust = 0.10
    else if (stage.id === 'wel') dust = 0.0
    this.dustMat.opacity = dust

    // bloom strength
    this.bloom.strength = lerp(0.12, 0.1, dusk) + bpVis * 0.04
    this.bloom.threshold = lerp(1.18, 0.98, dusk)

    // camera
    this.updateCamera(p, dt, instant)
    void idx
  }

  updateCamera(p, dt, instant) {
    let i = 0
    while (i < CAM.length - 2 && p > CAM[i + 1].p) i++
    const a = CAM[i]
    const b = CAM[i + 1]
    const t = smooth(clamp01((p - a.p) / (b.p - a.p || 1)))
    const px = lerp(a.pos[0], b.pos[0], t)
    const py = lerp(a.pos[1], b.pos[1], t)
    const pz = lerp(a.pos[2], b.pos[2], t)
    const tx = lerp(a.tgt[0], b.tgt[0], t)
    const ty = lerp(a.tgt[1], b.tgt[1], t)
    const tz = lerp(a.tgt[2], b.tgt[2], t)

    // breathing + parallax
    const time = performance.now() * 0.001
    const swayX = Math.sin(time * 0.23) * 0.35
    const swayY = Math.sin(time * 0.17) * 0.14
    this.mouse.x = lerp(this.mouse.x, this.mouse.tx, instant ? 1 : 0.05)
    this.mouse.y = lerp(this.mouse.y, this.mouse.ty, instant ? 1 : 0.05)
    const par = 1 - clamp01((p - 0.885) / 0.06) // reduce during welcome push
    const mx = this.mouse.x * 1.1 * par
    const my = this.mouse.y * 0.5 * par

    this.camera.position.set(
      px + swayX * par + mx, py + swayY * par - my, pz)
    this.camera.lookAt(tx - mx * 0.25, ty - my * 0.2, tz)
  }

  animate() {
    this.raf = requestAnimationFrame(this.animate)
    const dt = Math.min(this.clock.getDelta(), 0.05)
    if (!this.ready) {
      this.renderer.render(this.scene, this.camera)
      return
    }
    this.dispP = instantable(this.dispP, this.targetP, dt)
    this.apply(dt)
    this.dust.rotation.y += dt * 0.012
    this.sky.position.copy(this.camera.position)
    this.composer.render()
    this.onProgress(this.dispP)
  }

  resize() {
    const w = this.host.clientWidth
    const h = this.host.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
  }
}

function instantable(cur, target, dt) {
  const k = 1 - Math.pow(0.0015, dt) // frame-rate independent damping
  return cur + (target - cur) * k
}
