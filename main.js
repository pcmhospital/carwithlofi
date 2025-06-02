import * as THREE from 'three';
// GLTFLoader might be used later, keep if present, or add if needed for other models
// import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Scene, Camera, Renderer
const scene = new THREE.Scene(); // Background will be set in setupEnvironment

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
// renderer.shadowMap.enabled = true; // For future shadow implementation

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
});

// --- Global Light References ---
let ambientLight;
let hemisphereLight;
let directionalLight;

// --- Environment Setup Function ---
function setupEnvironment(
    skyFallbackColor = 0x87CEEB, // Default: Sky Blue
    ambientColor = 0x607D8B, ambientIntensity = 0.8, // Cooler, less intense ambient
    hemiSkyColor = 0xB0C4DE, hemiGroundColor = 0x4A4A4A, hemiIntensity = 0.7, // Lighter Hemi
    dirLightColor = 0xFFF5E1, dirLightIntensity = 1.5, // Warmer sun
    dirLightPosition = new THREE.Vector3(25, 35, 20)
) {
    // Skybox Setup
    const cubeLoader = new THREE.CubeTextureLoader();
    const skyboxAssetPath = 'assets/skybox/'; // Expected path for skybox images
    const skyboxTextures = [
        skyboxAssetPath + 'px.jpg', skyboxAssetPath + 'nx.jpg', // Right (pos-x), Left (neg-x)
        skyboxAssetPath + 'py.jpg', skyboxAssetPath + 'ny.jpg', // Top (pos-y), Bottom (neg-y)
        skyboxAssetPath + 'pz.jpg', skyboxAssetPath + 'nz.jpg'  // Front (pos-z), Back (neg-z)
    ];

    // --- IMPORTANT: Set this to true when actual skybox image files are in 'assets/skybox/' ---
    const enableSkyboxLoading = false;
    // --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- --- ---

    if (enableSkyboxLoading) {
        try {
            const textureCube = cubeLoader.load(skyboxTextures,
                () => { console.log("Skybox loaded successfully."); },
                undefined, // onProgress callback (optional)
                (error) => { // onError callback
                    console.error(`Skybox loading failed. Ensure 6 images (px.jpg, nx.jpg, etc.) are in '${skyboxAssetPath}'. Falling back to solid color. Error: ${error}`);
                    scene.background = new THREE.Color(skyFallbackColor);
                }
            );
            scene.background = textureCube;
        } catch (e) {
            console.error("Error initializing CubeTextureLoader (likely due to incorrect paths or setup):", e);
            scene.background = new THREE.Color(skyFallbackColor);
        }
    } else {
        console.log("Skybox loading is disabled (enableSkyboxLoading = false). Using fallback color for background.");
        scene.background = new THREE.Color(skyFallbackColor);
    }

    // Clear existing lights before adding new ones (important if this function is called multiple times)
    if (ambientLight) scene.remove(ambientLight);
    if (hemisphereLight) scene.remove(hemisphereLight);
    if (directionalLight) scene.remove(directionalLight);

    // Ambient Light
    ambientLight = new THREE.AmbientLight(ambientColor, ambientIntensity);
    scene.add(ambientLight);

    // Hemisphere Light (Sky color, Ground color, Intensity)
    hemisphereLight = new THREE.HemisphereLight(hemiSkyColor, hemiGroundColor, hemiIntensity);
    scene.add(hemisphereLight);

    // Directional Light (Simulating Sun)
    directionalLight = new THREE.DirectionalLight(dirLightColor, dirLightIntensity);
    directionalLight.position.copy(dirLightPosition);
    // directionalLight.castShadow = true; // Future: Enable and configure shadows
    // directionalLight.shadow.mapSize.width = 1024;
    // directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);
    // const helper = new THREE.DirectionalLightHelper( directionalLight, 5 ); // Debug
    // scene.add( helper ); // Debug
}


// Terrain Constants & Segments
const SEGMENT_LENGTH = 50; const ROAD_WIDTH = 10; const NUM_SEGMENTS_VISIBLE = 5;
const roadSegments = [];
let roadSegmentMesh = null; // Template for road segments

// Car object & properties
const carObject = new THREE.Group(); scene.add(carObject); carObject.position.set(0, 0.5, 0);
// camera.position.set(0, 3, 7); // Initial camera position handled by follow logic
// camera.lookAt(carObject.position);

// Car physics/control parameters
let carSpeed = 0; const acceleration = 0.005; const decelerationDrag = 0.003; const brakeForce = 0.01;
const maxSpeed = 0.35; const maxReverseSpeed = -0.15;
let steeringAngle = 0; const maxSteeringAngle = Math.PI / 8; const steeringSpeed = 0.02;
const wheelSteeringFactor = 1.5;

// Wheel references
let wheelFL, wheelFR, wheelRL, wheelRR; const wheelRadius = 0.4;

// Mode States
let isAutoDriving = false; const autoDriveSpeed = 0.15;
let isStandingMode = false;

// Input State
const keyboardState = { forward: false, backward: false, left: false, right: false };

// Event Listeners
document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'p') {
        isAutoDriving = !isAutoDriving;
        if (isAutoDriving) isStandingMode = false;
        console.log("Auto-Drive:", isAutoDriving ? "ON" : "OFF");
        return;
    }
    if (key === 'o') {
        isStandingMode = !isStandingMode;
        if (isStandingMode) isAutoDriving = false;
        console.log("Standing Mode:", isStandingMode ? "ON" : "OFF");
        return;
    }
    if (!isAutoDriving && !isStandingMode) {
        if (key === 'w' || key === 'arrowup') keyboardState.forward = true;
        else if (key === 's' || key === 'arrowdown') keyboardState.backward = true;
        if (key === 'a' || key === 'arrowleft') keyboardState.left = true;
        else if (key === 'd' || key === 'arrowright') keyboardState.right = true;
    }
});
document.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    if (key === 'w' || key === 'arrowup') keyboardState.forward = false;
    else if (key === 's' || key === 'arrowdown') keyboardState.backward = false;
    if (key === 'a' || key === 'arrowleft') keyboardState.left = false;
    else if (key === 'd' || key === 'arrowright') keyboardState.right = false;
});

// Placeholder Assets Creation
function createPlaceholderCar() {
    const carBodyGeo = new THREE.BoxGeometry(2, 1, 4);
    const carBodyMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.5, metalness: 0.3 });
    const carBodyMesh = new THREE.Mesh(carBodyGeo, carBodyMat);
    // carBodyMesh.castShadow = true;
    carObject.add(carBodyMesh);

    const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.3, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 });
    const createWheel = (pos) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(...pos);
        wheel.rotation.z = Math.PI / 2; // Align for rolling on local Y-axis after this rotation
        // wheel.castShadow = true;
        carObject.add(wheel);
        return wheel;
    };
    wheelFL = createWheel([-1.1, -0.2, 1.3]); wheelFR = createWheel([1.1, -0.2, 1.3]);
    wheelRL = createWheel([-1.1, -0.2, -1.3]); wheelRR = createWheel([1.1, -0.2, -1.3]);
}

function createPlaceholderRoadSegment() {
    const roadGeo = new THREE.BoxGeometry(ROAD_WIDTH, 0.2, SEGMENT_LENGTH);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.9, metalness: 0.1 });
    const segment = new THREE.Mesh(roadGeo, roadMat);
    // segment.receiveShadow = true;
    return segment;
}

function addRoadSegmentInstance(zIndex) {
    if (!roadSegmentMesh) { console.error("Road segment mesh template not created!"); return null; }
    const segmentInstance = roadSegmentMesh.clone();
    segmentInstance.position.set(0, 0, zIndex * SEGMENT_LENGTH);
    scene.add(segmentInstance);
    return segmentInstance;
}

function initializeAssets() {
    setupEnvironment(); // Call to set up sky and lighting with default values
    createPlaceholderCar();
    roadSegmentMesh = createPlaceholderRoadSegment();
    // roadSegmentMesh.receiveShadow = true; // If template is set to receive shadows

    for (let i = 0; i < NUM_SEGMENTS_VISIBLE; i++) {
        roadSegments.push(addRoadSegmentInstance(-i));
    }
}

// --- Main Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    // Mode logic (Standing, Auto-Driving, Manual)
    if (isStandingMode) {
        carSpeed = 0;
        steeringAngle *= 0.85;
        if (Math.abs(steeringAngle) < 0.001) steeringAngle = 0;
        keyboardState.forward = keyboardState.backward = keyboardState.left = keyboardState.right = false;
    } else if (isAutoDriving) {
        if (carSpeed < autoDriveSpeed) {
            carSpeed += acceleration * 0.5; carSpeed = Math.min(carSpeed, autoDriveSpeed);
        } else if (carSpeed > autoDriveSpeed) {
            carSpeed -= brakeForce * 0.5; carSpeed = Math.max(carSpeed, autoDriveSpeed);
        }
        if (Math.abs(carSpeed - autoDriveSpeed) < (acceleration * 0.5)) carSpeed = autoDriveSpeed;

        steeringAngle *= 0.85;
        if (Math.abs(steeringAngle) < 0.001) steeringAngle = 0;
        keyboardState.forward = keyboardState.backward = keyboardState.left = keyboardState.right = false;
    } else { // Manual Driving
        let appliedInput = false;
        if (keyboardState.forward) { carSpeed += acceleration; appliedInput = true;}
        if (keyboardState.backward) {
            if (carSpeed > 0) carSpeed -= brakeForce; else carSpeed -= acceleration / 2;
            appliedInput = true;
        }
        if (!appliedInput) carSpeed *= (1 - decelerationDrag);

        carSpeed = Math.max(maxReverseSpeed, Math.min(maxSpeed, carSpeed));
        if (Math.abs(carSpeed) < 0.0005) carSpeed = 0;

        let currentSteerInput = 0;
        if (keyboardState.left) { steeringAngle += steeringSpeed; currentSteerInput = 1; }
        if (keyboardState.right) { steeringAngle -= steeringSpeed; currentSteerInput = -1; }
        steeringAngle = Math.max(-maxSteeringAngle, Math.min(maxSteeringAngle, steeringAngle));
        if (currentSteerInput === 0 && Math.abs(carSpeed) > 0.01) steeringAngle *= 0.92;
        if (Math.abs(steeringAngle) < 0.001) steeringAngle = 0;
    }

    // Apply car model rotation (yaw)
    if (!isStandingMode && Math.abs(carSpeed) > 0.001) {
      carObject.rotation.y += steeringAngle * carSpeed * 0.075;
    }

    // Animate Wheels
    const wheelRotationAmount = carSpeed / wheelRadius;
    if (wheelFL) wheelFL.rotation.y = steeringAngle * wheelSteeringFactor; // Visual steer
    if (wheelFR) wheelFR.rotation.y = steeringAngle * wheelSteeringFactor; // Visual steer
    [wheelFL, wheelFR, wheelRL, wheelRR].forEach(wheel => {
        if (wheel) {
            if (!isStandingMode && Math.abs(carSpeed) > 0.001) {
                // Cylinder's default height is along Y. Rotated on Z by PI/2 means its length is along X.
                // So, to roll, it should rotate around its local Y-axis.
                wheel.rotateOnAxis(new THREE.Vector3(0, 1, 0), wheelRotationAmount);
            }
        }
    });

    // Update road segment positions
    if (!isStandingMode) {
        roadSegments.forEach(segment => {
            segment.position.z += carSpeed;
            if (Math.abs(steeringAngle) > 0.001 && Math.abs(carSpeed) > 0.01) {
                 segment.position.x -= steeringAngle * carSpeed * 1.5;
            }
            if (segment.position.z > SEGMENT_LENGTH / 2 + 5) {
                segment.position.z -= NUM_SEGMENTS_VISIBLE * SEGMENT_LENGTH;
                segment.position.x = 0;
            }
        });
    }

    // Camera follow logic
    const relativeCameraOffset = new THREE.Vector3(0, 3.5, 7.5);
    const cameraTargetPosition = new THREE.Vector3();
    cameraTargetPosition.copy(carObject.position);
    const offsetRotated = relativeCameraOffset.clone().applyQuaternion(carObject.quaternion);
    cameraTargetPosition.add(offsetRotated);
    camera.position.lerp(cameraTargetPosition, 0.12);
    const lookAtTarget = carObject.position.clone().add(new THREE.Vector3(0,1,0));
    camera.lookAt(lookAtTarget);

    renderer.render(scene, camera);
}

// --- Start ---
const loadingManager = new THREE.LoadingManager();
loadingManager.onLoad = () => {
    console.log("Conceptual assets ready. Starting animation.");
    if (THREE) {
        animate();
    } else {
        console.error('Three.js failed to load. Cannot start animation.');
    }
};

initializeAssets();
loadingManager.onLoad();

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('Service Worker registered successfully with scope:', registration.scope);
            })
            .catch((error) => {
                console.error('Service Worker registration failed:', error);
            });
    });
} else {
    console.log('Service Worker is not supported by this browser.');
}
