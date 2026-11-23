import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'
import { matchesStepName, parts } from './catalog'

type ModelMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>

type Appearance = {
  material: THREE.MeshStandardMaterial
  color: THREE.Color
  emissive: THREE.Color
  intensity: number
  opacity: number
  transparent: boolean
  depthWrite: boolean
}

type Assembly = {
  group: THREE.Group
  bounds: THREE.Box3
  offset: THREE.Vector3
  explodedBounds: THREE.Box3
  materials: Map<THREE.Material, Appearance>
}

const signal = new THREE.Color('#5b8cff')
// Model coordinates use +Y up. Offsets separate assemblies that share an axis or enclosure.
const assemblyOffsets: Record<string, [number, number, number]> = {
  mainboard: [.68, .04, -1.15],
  psu: [-1.35, .34, .65],
  hotend: [-.12, .50, -1.25],
  'hotend-fans': [-.85, .38, -.95],
  extruder: [.85, .78, .83],
  steppers: [.65, -.18, .70],
  hotbed: [.08, 1.02, -.27],
  leveling: [.32, -.40, -.55],
  'z-axis': [1.2, .45, -.12],
}
const enclosureOffsets = new Map<string, THREE.Vector3>([
  ['Control panel', new THREE.Vector3(.52, .13, -.32)],
  ['Case fan', new THREE.Vector3(-.25, .95, -.10)],
  ['Sheetmetal enclosure top', new THREE.Vector3(.20, .48, .65)],
  ['Sheetmetal enclosure bottom', new THREE.Vector3(.54, -.33, .25)],
])
const easeInOutCubic = (t: number) => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2
const cameraDirection = new THREE.Vector3(-.88, .7, -1.35).normalize()

// Visual finishes for the monochrome CAD. These are illustrative, not BOM specifications.
const finishes = {
  aluminum: new THREE.MeshStandardMaterial({ color: '#aab3ba', metalness: .78, roughness: .32 }),
  anodized: new THREE.MeshStandardMaterial({ color: '#282e35', metalness: .55, roughness: .46 }),
  steel: new THREE.MeshStandardMaterial({ color: '#858a90', metalness: .84, roughness: .29 }),
  plastic: new THREE.MeshStandardMaterial({ color: '#23262b', roughness: .67 }),
  bed: new THREE.MeshStandardMaterial({ color: '#24272a', roughness: .83 }),
  brass: new THREE.MeshStandardMaterial({ color: '#be913e', metalness: .68, roughness: .37 }),
  board: new THREE.MeshStandardMaterial({ color: '#17375c', roughness: .56 }),
  screen: new THREE.MeshStandardMaterial({ color: '#284659', metalness: .18, roughness: .3 }),
  tube: new THREE.MeshStandardMaterial({ color: '#e8e8e3', roughness: .65 }),
}

function finishFor(id: string, stepName: string, meshName: string) {
  if (id === 'frame') return stepName.endsWith('profile') ? finishes.aluminum : finishes.plastic
  if (id === 'psu' && stepName === '24V15A power supply') return finishes.aluminum
  if (stepName === 'Hot bed') return finishes.bed
  if (stepName === 'Control panel') return finishes.board
  if (stepName === 'lcd') return meshName.endsWith('521') ? finishes.screen : finishes.board
  if (id === 'hotend') {
    // GLB child names end in the source mesh indices of the nozzle and tube.
    if (meshName.endsWith('652')) return finishes.brass
    if (meshName.endsWith('658')) return finishes.tube
    return finishes.aluminum
  }
  if (['fasteners', 'pulleys', 'z-axis'].includes(id) || /spring|spacers|eccentric|pillow/i.test(stepName)) return finishes.steel
  if (['belts', 'wheels', 'limit-switches'].includes(id) || /fan|knob|switch/i.test(stepName)) return finishes.plastic
  return finishes.anodized
}

function groundShadow() {
  const source = document.createElement('canvas')
  source.width = source.height = 128
  const context = source.getContext('2d')!
  const gradient = context.createRadialGradient(64, 64, 7, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(0,0,0,0.62)')
  gradient.addColorStop(.39, 'rgba(0,0,0,0.38)')
  gradient.addColorStop(.7, 'rgba(0,0,0,0.14)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(source)
  texture.colorSpace = THREE.SRGBColorSpace
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 6.2), new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false,
  }))
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = -.018
  return shadow
}

export class Viewer {
  ready = false
  exploded = false
  private selectedId: string | null = null
  private hoveredId: string | null = null
  private ghost = true
  private readonly scene = new THREE.Scene()
  private readonly renderer: THREE.WebGLRenderer
  private readonly camera = new THREE.PerspectiveCamera(34, 1, .05, 75)
  private readonly controls: OrbitControls
  private readonly raycaster = new THREE.Raycaster()
  private readonly assemblies = new Map<string, Assembly>()
  private readonly meshIds = new Map<THREE.Object3D, string>()
  private readonly meshes: ModelMesh[] = []
  private readonly model = new THREE.Group()
  private readonly bounds = new THREE.Box3()
  private readonly activePointers = new Set<number>()
  private tap: { id: number; x: number; y: number; time: number } | null = null
  private frame = 0
  private readonly controlPanelMeshes = new Set<THREE.Object3D>()
  private readonly enclosureMeshes: { mesh: ModelMesh; position: THREE.Vector3; offset: THREE.Vector3 }[] = []
  private spread = 0
  private spreadTo = 0
  private spreadFrom = 0
  private spreadStarted = 0
  private spreadDuration = 900
  get explodeProgress() { return this.spread }
  private motion: {
    fromTarget: THREE.Vector3; fromPosition: THREE.Vector3
    toTarget: THREE.Vector3; toPosition: THREE.Vector3; started: number; duration: number
  } | null = null
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

  constructor(private readonly canvas: HTMLCanvasElement, private readonly onPick: (id: string | null) => void) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.32
    this.renderer.setClearColor(0x000000, 0)

    const environment = new RoomEnvironment()
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(environment, .04).texture
    this.scene.environmentIntensity = 1.2
    environment.dispose()
    pmrem.dispose()
    const key = new THREE.DirectionalLight(0xffffff, 1.8)
    key.position.set(-4, 7, -5)
    const fill = new THREE.DirectionalLight(0xffffff, .55)
    fill.position.set(4, 4, 2)
    this.scene.add(this.model, groundShadow(), key, fill)

    this.camera.position.copy(cameraDirection).multiplyScalar(9)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = !this.reducedMotion.matches
    this.reducedMotion.addEventListener('change', () => {
      this.controls.enableDamping = !this.reducedMotion.matches
      if (this.reducedMotion.matches && this.motion) this.focus(false)
    })
    this.controls.dampingFactor = .11
    this.controls.minDistance = 1.1
    this.controls.maxDistance = 32
    this.controls.maxPolarAngle = Math.PI * .57
    this.controls.minTargetRadius = 0
    this.controls.maxTargetRadius = 3.8
    this.controls.cursor.set(0, .75, 0)
    this.controls.addEventListener('change', this.invalidate)
    this.controls.addEventListener('start', () => {
      this.motion = null
    })
    new ResizeObserver(this.resize).observe(canvas)
    this.resize()
    this.bindPointers()
  }

  async load(onProgress: (fraction: number) => void) {
    const asset = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
      .loadAsync('/models/ender3.glb', event => {
        if (event.lengthComputable) onProgress(event.loaded / event.total)
      })
    asset.scene.updateMatrixWorld(true)
    const originalBounds = new THREE.Box3().setFromObject(asset.scene)
    const sourceCenter = originalBounds.getCenter(new THREE.Vector3())
    const sourceSize = originalBounds.getSize(new THREE.Vector3())
    const scale = 5 / Math.max(sourceSize.x, sourceSize.y, sourceSize.z)
    const normalizer = new THREE.Matrix4().makeScale(scale, scale, scale)
      .setPosition(-sourceCenter.x * scale, -originalBounds.min.y * scale, -sourceCenter.z * scale)

    const creased = new Map<THREE.BufferGeometry, THREE.BufferGeometry>()
    asset.scene.traverse(object => {
      const mesh = object as ModelMesh
      if (!mesh.isMesh) return
      let occurrence: THREE.Object3D | null = mesh
      while (occurrence && typeof occurrence.userData.stepName !== 'string') occurrence = occurrence.parent
      const stepName = occurrence?.userData.stepName
      const matching = parts.filter(part => typeof stepName === 'string' && matchesStepName(part, stepName))
      if (matching.length !== 1) throw new Error(`Invalid CAD tag for ${mesh.name}`)
      const { id } = matching[0]

      const assembly = this.getAssembly(id)
      const clone = mesh.clone(false)
      normalizer.clone().multiply(mesh.matrixWorld).decompose(clone.position, clone.quaternion, clone.scale)
      let geometry = creased.get(mesh.geometry)
      if (!geometry) {
        geometry = toCreasedNormals(mesh.geometry, Math.PI / 6)
        creased.set(mesh.geometry, geometry)
      }
      clone.geometry = geometry
      clone.material = this.cloneMaterial(finishFor(id, stepName, mesh.name), assembly)
      assembly.group.add(clone)
      const extraOffset = enclosureOffsets.get(stepName)
      if (id === 'mainboard' && extraOffset) {
        this.enclosureMeshes.push({ mesh: clone, position: clone.position.clone(), offset: extraOffset })
        if (stepName === 'Control panel') this.controlPanelMeshes.add(clone)
      }
      this.meshes.push(clone)
      this.meshIds.set(clone, id)
    })

    this.bounds.setFromObject(this.model)
    const center = this.bounds.getCenter(new THREE.Vector3())
    for (const [id, assembly] of this.assemblies) {
      assembly.bounds.setFromObject(assembly.group)
      const manual = assemblyOffsets[id]
      if (manual) assembly.offset.set(...manual)
      else assembly.offset.copy(assembly.bounds.getCenter(new THREE.Vector3()).sub(center).normalize()).multiplyScalar(1.15)
      if (id === 'mainboard') {
        for (const { mesh, offset } of this.enclosureMeshes) {
          assembly.explodedBounds.union(new THREE.Box3().setFromObject(mesh).translate(offset))
        }
        assembly.explodedBounds.translate(assembly.offset)
      } else assembly.explodedBounds.copy(assembly.bounds).translate(assembly.offset)
    }

    this.ready = true
    this.focus(false, true)
    this.invalidate()
  }

  private getAssembly(id: string): Assembly {
    const found = this.assemblies.get(id)
    if (found) return found
    const assembly = {
      group: new THREE.Group(),
      bounds: new THREE.Box3(),
      offset: new THREE.Vector3(),
      explodedBounds: new THREE.Box3(),
      materials: new Map<THREE.Material, Appearance>(),
    }
    this.assemblies.set(id, assembly)
    this.model.add(assembly.group)
    return assembly
  }

  private cloneMaterial(original: THREE.MeshStandardMaterial, assembly: Assembly) {
    const found = assembly.materials.get(original)
    if (found) return found.material
    const material = original.clone()
    assembly.materials.set(original, {
      material, color: material.color.clone(), emissive: material.emissive.clone(), intensity: material.emissiveIntensity,
      opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite,
    })
    return material
  }

  select(id: string | null, instant = false) {
    this.selectedId = id
    this.hoveredId = null
    this.colorParts()
    const hidden = id && this.ready && !this.exploded && (id === 'mainboard' || (!this.ghost && !this.projectPart(id)))
    if (hidden) this.setExploded(true)
    else this.focus(!instant)
  }

  setGhost(on: boolean) {
    this.ghost = on
    this.colorParts()
  }

  setExploded(on: boolean) {
    if (this.exploded === on) return
    this.exploded = on
    this.spreadFrom = this.spread
    this.spreadTo = Number(on)
    this.spreadStarted = performance.now()
    this.spreadDuration = Math.max(180, 900 * Math.abs(this.spreadTo - this.spreadFrom))
    this.focus(true, false, this.spreadDuration)
    this.invalidate()
  }

  resetView() {
    this.focus(true, true)
  }

  private colorParts() {
    for (const [id, assembly] of this.assemblies) {
      const selected = id === this.selectedId
      const hovered = id === this.hoveredId
      const faded = this.ghost && this.selectedId !== null && !selected
      for (const { material, color, emissive, intensity, opacity, transparent, depthWrite } of assembly.materials.values()) {
        const nextTransparent = faded || transparent
        if (nextTransparent !== material.transparent) material.needsUpdate = true
        material.transparent = nextTransparent
        material.depthWrite = !faded && depthWrite
        material.opacity = faded ? (hovered ? .58 : .40) * opacity : opacity
        material.color.copy(color)
        if (selected) material.color.lerp(signal, .68)
        material.emissive.copy(emissive)
        material.emissiveIntensity = intensity
        if (selected || hovered) {
          material.emissive.lerp(signal, selected ? .78 : .35)
          material.emissiveIntensity = Math.max(intensity, selected ? .7 : .32)
        }
      }
    }
    this.invalidate()
  }

  private resize = () => {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    if (!width || !height || (this.camera.aspect === width / height &&
      this.renderer.domElement.width === Math.floor(width * this.renderer.getPixelRatio()) &&
      this.renderer.domElement.height === Math.floor(height * this.renderer.getPixelRatio()))) return
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    if (this.ready) this.focus(true)
    this.invalidate()
  }

  private viewDistance(box: THREE.Box3, target: THREE.Vector3, direction: THREE.Vector3) {
    const vertical = Math.tan(THREE.MathUtils.degToRad(this.camera.fov * .5))
    const horizontal = vertical * this.camera.aspect
    const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize()
    const up = direction.clone().cross(right)
    let distance = 0
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          const corner = new THREE.Vector3(x, y, z).sub(target)
          distance = Math.max(distance, corner.dot(direction) + Math.max(
            Math.abs(corner.dot(right)) / horizontal,
            Math.abs(corner.dot(up)) / vertical,
          ))
        }
      }
    }
    return distance
  }

  private focus(animate: boolean, reset = false, duration = 460) {
    if (!this.ready) return
    const direction = reset ? cameraDirection : this.camera.position.clone().sub(this.controls.target).normalize()
    const home = this.bounds.clone()
    if (this.exploded) {
      home.makeEmpty()
      for (const { explodedBounds } of this.assemblies.values()) home.union(explodedBounds)
    }
    const center = home.getCenter(new THREE.Vector3())
    const narrow = this.camera.aspect < 1
    const homeDistance = this.viewDistance(home, center, direction) * (narrow ? 1.14 : this.exploded ? 1.13 : 1.23)
    const part = this.selectedId ? this.assemblies.get(this.selectedId) : undefined
    let target = center
    let distance = homeDistance
    if (part) {
      const bounds = this.exploded ? part.explodedBounds : part.bounds
      const partCenter = bounds.getCenter(new THREE.Vector3())
      target = center.clone().lerp(partCenter, narrow ? .24 : .43)
      distance = Math.max(
        this.viewDistance(bounds, target, direction) * 1.28,
        this.viewDistance(home, target, direction) * (narrow ? 1.14 : 1.11),
      )
    }
    const position = target.clone().addScaledVector(direction, Math.min(distance, this.controls.maxDistance))
    if (animate && !this.reducedMotion.matches) {
      this.motion = {
        fromTarget: this.controls.target.clone(), fromPosition: this.camera.position.clone(),
        toTarget: target, toPosition: position, started: performance.now(), duration,
      }
    } else {
      this.motion = null
      this.controls.target.copy(target)
      this.camera.position.copy(position)
      this.controls.update()
    }
    this.invalidate()
  }

  private invalidate = () => {
    if (!this.frame) this.frame = requestAnimationFrame(this.draw)
  }

  private draw = (now: number) => {
    this.frame = 0
    if (this.spread !== this.spreadTo) {
      const progress = this.reducedMotion.matches ? 1 : Math.min(1, (now - this.spreadStarted) / this.spreadDuration)
      this.spread = THREE.MathUtils.lerp(this.spreadFrom, this.spreadTo, easeInOutCubic(progress))
      for (const { group, offset } of this.assemblies.values()) group.position.copy(offset).multiplyScalar(this.spread)
      for (const { mesh, position, offset } of this.enclosureMeshes) mesh.position.copy(position).addScaledVector(offset, this.spread)
      if (progress < 1) this.invalidate()
    }
    if (this.motion) {
      const motion = this.motion
      const progress = Math.min(1, (now - motion.started) / motion.duration)
      const eased = easeInOutCubic(progress)
      this.controls.target.lerpVectors(motion.fromTarget, motion.toTarget, eased)
      this.camera.position.lerpVectors(motion.fromPosition, motion.toPosition, eased)
      if (progress < 1) this.invalidate()
      else this.motion = null
    }
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  private pick(x: number, y: number) {
    const mesh = this.pickMesh(x, y)
    return mesh ? this.meshIds.get(mesh) ?? null : null
  }

  private pickMesh(x: number, y: number) {
    if (!this.ready) return null
    const rect = this.canvas.getBoundingClientRect()
    const point = new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2)
    this.model.updateMatrixWorld(true)
    this.camera.updateMatrixWorld()
    this.raycaster.setFromCamera(point, this.camera)
    return this.raycaster.intersectObjects(this.meshes, false)[0]?.object ?? null
  }

  projectPart(id: string) {
    const assembly = this.assemblies.get(id)
    if (!assembly) return null
    const exposedBoard = id === 'mainboard' && this.spread === 1
    const bounds = assembly.bounds.clone().translate(assembly.group.position)
    if (exposedBoard) {
      bounds.makeEmpty()
      for (const mesh of this.controlPanelMeshes) bounds.expandByObject(mesh)
    }
    const hitsPart = ({ x, y }: { x: number; y: number }) => {
      const mesh = this.pickMesh(x, y)
      return mesh && (exposedBoard ? this.controlPanelMeshes.has(mesh) : this.meshIds.get(mesh) === id)
    }
    const rect = this.canvas.getBoundingClientRect()
    this.camera.updateMatrixWorld()
    const project = (point: THREE.Vector3) => {
      point.project(this.camera)
      return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 }
    }
    const center = project(bounds.getCenter(new THREE.Vector3()))
    if (hitsPart(center)) return center
    // Convex bounds can surround holes or cover occluded surfaces. Look for a visible point near the center.
    const corners = [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.y, bounds.max.y].flatMap(y =>
      [bounds.min.z, bounds.max.z].map(z => project(new THREE.Vector3(x, y, z)))))
    const left = Math.max(rect.left, Math.min(...corners.map(point => point.x)))
    const right = Math.min(rect.right, Math.max(...corners.map(point => point.x)))
    const top = Math.max(rect.top, Math.min(...corners.map(point => point.y)))
    const bottom = Math.min(rect.bottom, Math.max(...corners.map(point => point.y)))
    if (left >= right || top >= bottom) return null
    const steps = [.5, .375, .625, .25, .75, .125, .875]
    for (const row of steps) {
      for (const column of steps) {
        const point = { x: left + column * (right - left), y: top + row * (bottom - top) }
        if (hitsPart(point)) return point
      }
    }
    return null
  }

  private bindPointers() {
    // Pointer events handle picks. Suppress the follow-up touch click, which can land on the newly opened sheet.
    this.canvas.addEventListener('touchend', event => event.preventDefault(), { passive: false })
    this.canvas.addEventListener('pointerdown', event => {
      this.activePointers.add(event.pointerId)
      this.tap = this.activePointers.size === 1 && event.button === 0
        ? { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() }
        : null
    })
    this.canvas.addEventListener('pointermove', event => {
      if (this.tap?.id === event.pointerId &&
          Math.hypot(event.clientX - this.tap.x, event.clientY - this.tap.y) >= 6) this.tap = null
      if (event.pointerType !== 'mouse' || this.activePointers.size) return
      this.hover(this.pick(event.clientX, event.clientY))
    })
    this.canvas.addEventListener('pointerup', event => {
      this.activePointers.delete(event.pointerId)
      const tap = this.tap
      this.tap = null
      if (this.ready && tap?.id === event.pointerId && performance.now() - tap.time < 350 &&
          Math.hypot(event.clientX - tap.x, event.clientY - tap.y) < 6) {
        this.onPick(this.pick(event.clientX, event.clientY))
      }
    })
    const cancel = (event: PointerEvent) => {
      this.activePointers.delete(event.pointerId)
      if (this.tap?.id === event.pointerId) this.tap = null
    }
    this.canvas.addEventListener('pointercancel', cancel)
    this.canvas.addEventListener('lostpointercapture', cancel)
    this.canvas.addEventListener('pointerleave', () => this.hover(null))
  }

  private hover(id: string | null) {
    if (id === this.hoveredId) return
    this.hoveredId = id
    this.canvas.classList.toggle('can-select', id !== null)
    this.colorParts()
  }
}
