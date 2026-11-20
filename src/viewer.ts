import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { parts } from './catalog'

type ModelMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>

type Appearance = {
  material: THREE.MeshStandardMaterial
  emissive: THREE.Color
  intensity: number
  opacity: number
  transparent: boolean
  depthWrite: boolean
  transmission: number
}

type Assembly = {
  group: THREE.Group
  bounds: THREE.Box3
  offset: THREE.Vector3
  materials: Map<THREE.Material, Appearance>
}

const bodyId = 'body'
const hintBlue = new THREE.Color('#387cf5')
const selectedBlue = new THREE.Color('#5695ff')
const cameraDirection = new THREE.Vector3(1.0, .62, 1.27).normalize()

function groundShadow() {
  const source = document.createElement('canvas')
  source.width = source.height = 128
  const context = source.getContext('2d')!
  const gradient = context.createRadialGradient(64, 64, 7, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(35,51,77,0.49)')
  gradient.addColorStop(.39, 'rgba(35,51,77,0.31)')
  gradient.addColorStop(.7, 'rgba(35,51,77,0.13)')
  gradient.addColorStop(1, 'rgba(35,51,77,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(source)
  texture.colorSpace = THREE.SRGBColorSpace
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 6.5), new THREE.MeshBasicMaterial({
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
  private lastTime = 0
  private spread = 0
  private spreadTo = 0
  private motion: {
    fromTarget: THREE.Vector3; fromPosition: THREE.Vector3
    toTarget: THREE.Vector3; toPosition: THREE.Vector3; started: number
  } | null = null
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

  constructor(private readonly canvas: HTMLCanvasElement, private readonly onPick: (id: string | null) => void) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio))
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2
    this.renderer.transmissionResolutionScale = .5
    this.renderer.setClearColor(0x000000, 0)

    const environment = new RoomEnvironment()
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(environment, .04).texture
    environment.dispose()
    pmrem.dispose()
    this.scene.add(this.model, groundShadow())

    this.camera.position.copy(cameraDirection).multiplyScalar(9)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
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
      .loadAsync('/models/car-concept.glb', event => {
        if (event.lengthComputable) onProgress(event.loaded / event.total)
      })
    asset.scene.updateMatrixWorld(true)
    const originalBounds = new THREE.Box3().setFromObject(asset.scene)
    const sourceCenter = originalBounds.getCenter(new THREE.Vector3())
    const sourceSize = originalBounds.getSize(new THREE.Vector3())
    const scale = 5 / Math.max(sourceSize.x, sourceSize.y, sourceSize.z)
    const normalizer = new THREE.Matrix4().makeScale(scale, scale, scale)
      .setPosition(-sourceCenter.x * scale, -originalBounds.min.y * scale, -sourceCenter.z * scale)

    asset.scene.traverse(object => {
      const mesh = object as ModelMesh
      if (!mesh.isMesh) return
      let id = bodyId
      for (let node: THREE.Object3D | null = mesh; node; node = node.parent) {
        const part = parts.find(entry => entry.nodes.test(node.name))
        if (part) {
          id = part.id
          break
        }
      }
      const assembly = this.getAssembly(id)
      const clone = mesh.clone(false)
      normalizer.clone().multiply(mesh.matrixWorld).decompose(clone.position, clone.quaternion, clone.scale)
      clone.material = this.cloneMaterial(mesh.material, assembly)
      assembly.group.add(clone)
      this.meshes.push(clone)
      this.meshIds.set(clone, id)
    })

    this.bounds.setFromObject(this.model)
    const center = this.bounds.getCenter(new THREE.Vector3())
    for (const [id, assembly] of this.assemblies) {
      assembly.bounds.setFromObject(assembly.group)
      if (id === bodyId) continue
      const configured = parts.find(part => part.id === id)?.explode
      if (configured) {
        assembly.offset.set(...configured)
      } else {
        const direction = assembly.bounds.getCenter(new THREE.Vector3()).sub(center)
        direction.y = .16
        assembly.offset.copy(direction.normalize().multiplyScalar(1.15))
      }
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
      material, emissive: material.emissive.clone(), intensity: material.emissiveIntensity,
      opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite,
      transmission: material instanceof THREE.MeshPhysicalMaterial ? material.transmission : 0,
    })
    return material
  }

  select(id: string | null, instant = false) {
    this.selectedId = id
    this.hoveredId = null
    this.colorParts()
    this.focus(!instant)
  }

  setGhost(on: boolean) {
    this.ghost = on
    this.colorParts()
  }

  setExploded(on: boolean) {
    this.exploded = on
    this.spreadTo = Number(on)
    this.focus(true)
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
      for (const { material, emissive, intensity, opacity, transparent, depthWrite, transmission } of assembly.materials.values()) {
        // Turn off the separate transmission pass for ghosted glass so it fades with the rest of the car.
        if (material instanceof THREE.MeshPhysicalMaterial) material.transmission = faded ? 0 : transmission
        const nextTransparent = faded || transparent
        if (nextTransparent !== material.transparent) material.needsUpdate = true
        material.transparent = nextTransparent
        material.depthWrite = !faded && depthWrite
        material.opacity = faded ? (hovered ? .52 : .25) * opacity : opacity
        material.emissive.copy(emissive)
        material.emissiveIntensity = intensity
        if (selected || hovered) {
          material.emissive.lerp(selected ? selectedBlue : hintBlue, selected ? .66 : .45)
          material.emissiveIntensity = Math.max(intensity, selected ? .62 : .42)
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

  private focus(animate: boolean, reset = false) {
    if (!this.ready) return
    const direction = reset ? cameraDirection : this.camera.position.clone().sub(this.controls.target).normalize()
    const home = this.bounds.clone()
    if (this.exploded) {
      for (const { bounds, offset } of this.assemblies.values()) home.union(bounds.clone().translate(offset))
    }
    const center = home.getCenter(new THREE.Vector3())
    const narrow = this.camera.aspect < 1
    const homeDistance = this.viewDistance(home, center, direction) * (narrow ? 1.14 : 1.23)
    const part = this.selectedId ? this.assemblies.get(this.selectedId) : undefined
    let target = center
    let distance = homeDistance
    if (part) {
      const bounds = part.bounds.clone().translate(part.offset.clone().multiplyScalar(this.spreadTo))
      const partCenter = bounds.getCenter(new THREE.Vector3())
      target = center.clone().lerp(partCenter, narrow ? .65 : .8)
      distance = Math.max(this.viewDistance(bounds, target, direction) * 1.28, homeDistance * (narrow ? .87 : .75), 2)
    }
    const position = target.clone().addScaledVector(direction, Math.min(distance, this.controls.maxDistance))
    if (animate && !this.reducedMotion.matches) {
      this.motion = {
        fromTarget: this.controls.target.clone(), fromPosition: this.camera.position.clone(),
        toTarget: target, toPosition: position, started: performance.now(),
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
    const delta = Math.min(50, now - this.lastTime)
    this.lastTime = now
    if (this.spread !== this.spreadTo) {
      this.spread = THREE.MathUtils.damp(this.spread, this.spreadTo, 10, delta / 1000)
      if (Math.abs(this.spread - this.spreadTo) < .002 || this.reducedMotion.matches) this.spread = this.spreadTo
      for (const { group, offset } of this.assemblies.values()) group.position.copy(offset).multiplyScalar(this.spread)
      if (this.spread !== this.spreadTo) this.invalidate()
    }
    if (this.motion) {
      const motion = this.motion
      const progress = Math.min(1, (now - motion.started) / 460)
      const eased = 1 - (1 - progress) ** 3
      this.controls.target.lerpVectors(motion.fromTarget, motion.toTarget, eased)
      this.camera.position.lerpVectors(motion.fromPosition, motion.toPosition, eased)
      if (progress < 1) this.invalidate()
      else this.motion = null
    }
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  private pick(x: number, y: number) {
    if (!this.ready) return null
    const rect = this.canvas.getBoundingClientRect()
    const point = new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2)
    this.model.updateMatrixWorld(true)
    this.camera.updateMatrixWorld()
    this.raycaster.setFromCamera(point, this.camera)
    const closest = this.raycaster.intersectObjects(this.meshes, false)[0]
    const id = closest && this.meshIds.get(closest.object)
    return id && id !== bodyId ? id : null
  }

  projectPart(id: string) {
    const assembly = this.assemblies.get(id)
    if (!assembly) return null
    const bounds = assembly.bounds.clone().translate(assembly.group.position)
    const rect = this.canvas.getBoundingClientRect()
    this.camera.updateMatrixWorld()
    const project = (point: THREE.Vector3) => {
      point.project(this.camera)
      return { x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 }
    }
    const center = project(bounds.getCenter(new THREE.Vector3()))
    if (this.pick(center.x, center.y) === id) return center
    // Convex bounds can surround holes or cover occluded surfaces. Look for a visible point near the center.
    const corners = [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.y, bounds.max.y].flatMap(y =>
      [bounds.min.z, bounds.max.z].map(z => project(new THREE.Vector3(x, y, z)))))
    const left = Math.max(rect.left, Math.min(...corners.map(point => point.x)))
    const right = Math.min(rect.right, Math.max(...corners.map(point => point.x)))
    const top = Math.max(rect.top, Math.min(...corners.map(point => point.y)))
    const bottom = Math.min(rect.bottom, Math.max(...corners.map(point => point.y)))
    if (left >= right || top >= bottom) return center
    const steps = [.5, .375, .625, .25, .75, .125, .875]
    for (const row of steps) {
      for (const column of steps) {
        const point = { x: left + column * (right - left), y: top + row * (bottom - top) }
        if (this.pick(point.x, point.y) === id) return point
      }
    }
    return center
  }

  private bindPointers() {
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
