import { Engine, Scene, ArcRotateCamera, HemisphericLight, Vector3, MeshBuilder, Quaternion, Mesh, Matrix, Geometry, VertexData, StandardMaterial, Color3, CannonJSPlugin, PhysicsImpostor, Nullable, SceneRecorder } from 'babylonjs';
import lilGUI from 'lil-gui';
import * as CANNON from "cannon";
import { MESH_NAME, GRAVITY, MeshData } from './src/constants';

let activeScene = localStorage.getItem("activeScene") ?? "1";
const canvas = document.getElementById("canvas");
if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Couldn't find a canvas. Aborting the demo")

const engine = new Engine(canvas, true, {});
let scene = new Scene(engine);
let dt = new SceneRecorder();
dt.track(scene);

let icoData: MeshData = { radius: 1, subdivisions: 1 }
let cubeData: MeshData = { width: 1, height: 1, depth: 1 }
let cylinderData: MeshData = { height: 1, diameter: 1 };
// Physics
let simulating = false;
let physicEngine: CannonJSPlugin;

let sphere: Mesh;
const physicAttr = {
	amplitude: 1,
	duration: 1,
	applyBouncing: () => {
		if (sphere) {
			simulating = true;
			if (!sphere.physicsImpostor || sphere.physicsImpostor.isDisposed) sphere.physicsImpostor = new PhysicsImpostor(sphere, PhysicsImpostor.SphereImpostor, { mass: 1, restitution: 0.9 }, scene);
			// sphere.physicsImpostor.applyImpulse(new Vector3(0, 1, 0), sphere.getAbsolutePosition());
		}
	},
	reset: () => {
		simulating = false;
		if (sphere && sphere.physicsImpostor) sphere.physicsImpostor.dispose();
		sphere.position.set(0, physicAttr.amplitude, 0);
	}
}

let panel = new lilGUI();
let sceneBtn = {
	task1: function () {
		scene.dispose();
		scene = new Scene(engine);
		prepareScene1(scene);
	},
	task2: function () {
		scene.dispose();
		scene = new Scene(engine);
		prepareScene2(scene);
	}
}
panel.add(sceneBtn, "task1");
panel.add(sceneBtn, "task2");

function prepareScene1(scene: Scene) {
	panel.folders.forEach(folder => {
		folder.destroy();
	});
	localStorage.setItem("activeScene", "1");
	// Camera
	const camera = new ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2.5, 4, new Vector3(0, 0, 0), scene);
	camera.attachControl(canvas, true);

	// Light
	new HemisphericLight("light", new Vector3(0.5, 1, 0.8).normalize(), scene);

	// Objects
	const cube = MeshBuilder.CreateBox(MESH_NAME.CUBE, {}, scene);
	cube.rotationQuaternion = Quaternion.FromEulerAngles(0, Math.PI, 0);

	const icosphere = MeshBuilder.CreateIcoSphere(MESH_NAME.ICOSPHERE, { updatable: true }, scene);
	icosphere.position.set(-2, 0, 0);

	const cylinder = MeshBuilder.CreateCylinder(MESH_NAME.CYLINDER, {}, scene);
	cylinder.position.set(2, 0, 0);

	scene.onPointerDown = () => {
		var ray = scene.createPickingRay(scene.pointerX, scene.pointerY, Matrix.Identity(), scene.activeCamera);

		var hit = scene.pickWithRay(ray);

		if (hit?.pickedMesh && hit.pickedMesh instanceof Mesh) {
			meshController(hit.pickedMesh);
		}
	}
}

function prepareScene2(scene: Scene) {
	panel.folders.forEach(folder => {
		folder.destroy();
	});
	localStorage.setItem("activeScene", "2");
	physicEngine = new CannonJSPlugin(false, 10, CANNON);
	scene.enablePhysics(new Vector3(0, GRAVITY, 0), physicEngine);

	// Camera
	const camera = new ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2.5, 4, new Vector3(0, 0, 0), scene);
	camera.attachControl(canvas, true);

	// Light
	new HemisphericLight("light", new Vector3(0.5, 1, 0.8).normalize(), scene);

	// Create Blue sphere
	sphere = MeshBuilder.CreateSphere("sphere", { diameter: 1 }, scene);
	sphere.position.set(0, physicAttr.amplitude, 0);
	const material = new StandardMaterial("material", scene);
	material.diffuseColor = Color3.Blue();
	sphere.material = material;

	// Create Physic ground
	const ground = MeshBuilder.CreateGround("ground", { width: 6, height: 6 }, scene);
	ground.position.set(0, -1, 0);
	ground.physicsImpostor = new PhysicsImpostor(ground, PhysicsImpostor.BoxImpostor, { mass: 0, restitution: 1 }, scene);

	const physicController = panel.addFolder("Simulation");
	physicController.add(physicAttr, "amplitude", 0, 10).step(1).onChange((value: number) => {
		sphere.position.y = value;
	});
	physicController.add(physicAttr, "duration", 0, 10).step(1).onChange((value: number) => {
		scene.getPhysicsEngine()!.setTimeStep(1 / (value * 10));
	});
	physicController.add(physicAttr, "applyBouncing");
	physicController.add(physicAttr, "reset");
}

switch(activeScene) {
	case "1":
		prepareScene1(scene);
		break;
	case "2":
		prepareScene2(scene);
		break;
}
engine.runRenderLoop(() => {
	if (simulating) {
		requestAnimationFrame(() => {
			scene.render();
		})
	} else {
		scene.render();
	}
});

window.addEventListener("resize", () => {
	engine.resize();
});

function meshController(mesh: Mesh) {
	panel.folders.forEach(folder => {
		folder.destroy();
	});
	const folder = panel.addFolder(mesh.name);
	outlineObject(mesh);
	switch (mesh.name) {
		case MESH_NAME.CUBE:
			{
				cubeData = {
					width: mesh.scaling.x,
					height: mesh.scaling.y,
					depth: mesh.scaling.z
				}
				folder.title("Cube");
				folder.add(cubeData, "width", 0, 10).onChange((value: number) => {
					mesh.scaling.x = value;
				});
				folder.add(cubeData, "height", 0, 10).onChange((value: number) => {
					mesh.scaling.y = value;
				});
				folder.add(cubeData, "depth", 0, 10).onChange((value: number) => {
					mesh.scaling.z = value;
				});
			}
			break;
		case MESH_NAME.ICOSPHERE:
			{
				folder.title("Icosphere");
				folder.add(icoData, "radius", 0.1, 2.0).step(0.1).onChange((value: number) => {
					updateGroupGeometry(mesh, CreateIcoSphereGeometry({ radius: value }));
				})
				folder.add(icoData, "subdivisions", 1, 10).step(1).onChange((value: number) => {
					updateGroupGeometry(mesh, CreateIcoSphereGeometry({ subdivisions: value }));
				})
			}
			break;
		case MESH_NAME.CYLINDER:
			{
				folder.title("Cylinder");
				folder.add(cylinderData, "height", 0.1, 2.0).step(0.1).onChange((value: number) => {
					updateGroupGeometry(mesh, CreateCylinderGeometry({ height: value }));
				});
				folder.add(cylinderData, "diameter", 0.1, 2.0).step(0.1).onChange((value: number) => {
					updateGroupGeometry(mesh, CreateCylinderGeometry({ diameter: value }));
				});
			}
	}
}

// Dispose a mesh geometry and update with new geometry
function updateGroupGeometry(mesh: Mesh, geometry: Geometry) {
	const vertexData = VertexData.ExtractFromGeometry(geometry);
	vertexData.applyToMesh(mesh);
}

// New IcosSphereGeometry from Data
function CreateIcoSphereGeometry(data: { radius?: number, subdivisions?: number }) {
	const geometry = new Geometry(MESH_NAME.ICOSPHERE, scene);
	geometry.setAllVerticesData(VertexData.CreateIcoSphere(data));
	return geometry;
}

// New CylinderGeometry from Data
function CreateCylinderGeometry(data: { height?: number, diameter?: number }) {
	const geometry = new Geometry(MESH_NAME.CYLINDER, scene);
	geometry.setAllVerticesData(VertexData.CreateCylinder(data));
	return geometry;
}

function outlineObject(pickedMesh: Mesh) {
	scene.meshes.forEach((mesh) => {
		if (mesh.renderOutline) mesh.renderOutline = false;
	});
	if (!pickedMesh.renderOutline)
		pickedMesh.renderOutline = true;
	else
		pickedMesh.renderOutline = false;
}

/// Linear interpolation between two values
function lerp(a: number, b: number, dt: number) {
	return (1 - dt) * a + dt * b;
}