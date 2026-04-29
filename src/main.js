import "./style.css";
import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { gsap } from "gsap";
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

let controls, scene, camera;
let renderer = new THREE.WebGLRenderer({ antialias: true });
let loader = new GLTFLoader();
let loadedAmount = 0;
let mapLoaded = false;
let progressTimer = null;

function startFakeProgress() {
  progressTimer = setInterval(() => {
    if (loadedAmount < 92) {
      // Ease toward 92% — slows as it approaches
      loadedAmount += Math.max(0.3, (92 - loadedAmount) * 0.018);
      loadedAmount = Math.min(92, loadedAmount);
      const percentEl = document.getElementById("percent");
      if (percentEl) {
        percentEl.innerHTML = Math.floor(loadedAmount);
      }
    }
  }, 250);
}

function stopFakeProgress() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

// navigation points
let pointers = [
  {name: "tunnel start",description: "tunel start desc",x: 70,y: 1.6,z: 12},
  { name: "tunnel", description: "tunel desc", x: 40, y: 2.2, z: 10 },
  { name: "tunnel end", description: "tunel end desc", x: 0, y: 4, z: 8.5 },
  { name: "valley", description: "valley", x: -14, y: 5.5, z: 0},
  { name: "left_1", description: "left", x: -28, y: 7, z:-11}
];

//clock to set framerate
const clock = new THREE.Clock();
let targetTime = 0;
let framerate = 25;

const hasFinePointer = window.matchMedia("(any-pointer: fine)").matches;
const hasTouchInput = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
const isTouchDevice = !hasFinePointer && hasTouchInput;

let interactionDown = false;
let moving = false; // is the camera moving between navigation points
let touchLookEnabled = false;
let touchDragging = false;
let touchStartX = 0;
let touchStartY = 0;
let lastTouchX = 0;
let lastTouchY = 0;
let yaw = 0;
let pitch = 0;

const touchLookSensitivity = 0.003;
const maxPitch = Math.PI / 2 - 0.1;
const tapThresholdPx = 10;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0); 

const Txloader = new RGBELoader();

let pmremGenerator;

const MAP_MODEL_URL = "./models/environment.gltf";
const POINTER_MODEL_URL = "./models/map_pointer_3d_icon.glb";
const SKY_HDR_URL = "./hdris/sky.hdr";

function setOverlayReadyState() {
  const loadingLabel = document.querySelector(".overlay-loading-label");
  const progressTrack = document.querySelector(".overlay-progress-track");
  const hint = document.querySelector(".overlay-hint");

  if (loadingLabel) {
    loadingLabel.textContent = "Scan data ready";
  }

  if (progressTrack) {
    progressTrack.style.display = "none";
  }

  if (hint) {
    hint.textContent = "Press Enter to begin";
  }
}

function init() {


  document.getElementById("enterButton").addEventListener("click",enterScan );



  //initialise scene
  scene = new THREE.Scene();

  //initialise camera at first navigation point
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(pointers[0].x, pointers[0].y, pointers[0].z);
  camera.lookAt(0, 0, 0);

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  yaw = Math.atan2(forward.x, forward.z);
  pitch = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1));

  //initialise render
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.domElement.style.touchAction = "none";
  document.body.appendChild(renderer.domElement);

  pmremGenerator = new THREE.PMREMGenerator(renderer);  
  pmremGenerator.compileEquirectangularShader();


  //add lights
  const light = new THREE.AmbientLight(0x404040); // soft white light
  light.intensity= 1.2;
  scene.add(light);

  //initialise controls
  if (!isTouchDevice) {
    controls = new PointerLockControls(camera, document.body);
  } else {
    setupTouchControls();
  }

  window.addEventListener("resize", onWindowResize);

 
}

function optimizeModelTextures(root) {
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  root.traverse((object3d) => {
    if (!object3d.isMesh) {
      return;
    }

    const materials = Array.isArray(object3d.material)
      ? object3d.material
      : [object3d.material];

    materials.forEach((material) => {
      if (!material) {
        return;
      }

      const maps = [
        material.map,
        material.emissiveMap,
        material.normalMap,
        material.roughnessMap,
        material.metalnessMap,
        material.aoMap,
      ];

      maps.forEach((texture) => {
        if (!texture) {
          return;
        }

        texture.anisotropy = maxAnisotropy;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
      });

      material.needsUpdate = true;
    });
  });
}

//called on loop
function animate() {
  requestAnimationFrame(animate);

  //check if main model environment has loaded
  if (mapLoaded) {
    // required if controls.enableDamping or controls.autoRotate are set to true
    if (controls) {
      controls.update();
    }

    if (isTouchDevice && touchLookEnabled) {
      applyTouchLook();
    }

    //only update at a set framerate
    if (clock.getElapsedTime() >= targetTime) {
      targetTime += 1 / framerate;

      for (let i = 0; i < pointers.length; i++) {
        if (pointers[i].object) {
          pointers[i].object.rotateY(0.03);

          if (pointers[i].object.position.distanceTo(camera.position) < 2) {
            pointers[i].object.visible = false;
            pointers[i].object.children[0].children[0].children[0].layers.set(
              1
            ); // move to another layer so doesnt block raycaster
          } else {
            pointers[i].object.visible = true;
            pointers[i].object.children[0].children[0].children[0].layers.set(
              0
            );
          }
        }
      }
    }

    if (!isTouchDevice) {
      const pointerHit = getPointerAtNdc(mouse);

      if (pointerHit && interactionDown && !moving) {
        moveCameraToPointer(pointerHit);
      }
    }

    renderer.render(scene, camera);

  }
}

startFakeProgress();

// Load a map
loader.load(
  // resource URL
  MAP_MODEL_URL,
  // called when the resource is loaded
  function (gltf) {
    stopFakeProgress();
    optimizeModelTextures(gltf.scene);
    scene.add(gltf.scene);

    mapLoaded = true;
    loadedAmount = 100;
    document.getElementById("percent").innerHTML = loadedAmount;
    setOverlayReadyState();

    document.getElementById("enterButton").style.display= "block";
  },
  // called while loading is progressing — only fires for the small .gltf JSON, ignored
  function (xhr) {},
  // called when loading has errors
  function (error) {
    console.log("An error happened");
    stopFakeProgress();
  }
);

// Load a pointer
loader.load(
  // resource URL
  POINTER_MODEL_URL,
  // called when the resource is loaded
  function (gltf) {
    for (let i = 0; i < pointers.length; i++) {
      pointers[i].object = gltf.scene.clone(true);
      scene.add(pointers[i].object);
      pointers[i].object.position.set(
        pointers[i].x,
        pointers[i].y,
        pointers[i].z
      );
      pointers[i].object.scale.set(0.3, 0.3, 0.3);
      pointers[i].object.children[0].children[0].children[0].name = "pointer";

      pointers[i].object.children[0].children[0].children[0].layers.set(0); // Move it to another layer
    }
  },
  // called while loading is progressing
  function (xhr) {},
  // called when loading has errors
  function (error) {
    console.log("An error happened");
  }
);

//load skydome
Txloader.load(SKY_HDR_URL, function(hdrTexture) {
  
  const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;

  scene.background = envMap;     // Set as skybox
  scene.environment = envMap;   // Use as environment lighting
  scene.backgroundIntensity = 0.6;

  hdrTexture.dispose();         // Clean up
  pmremGenerator.dispose();

});


document.addEventListener("mousedown", () => {
  if (!isTouchDevice) {
    interactionDown = true;
  }
});

document.addEventListener("mouseup", () => {
  if (!isTouchDevice) {
    interactionDown = false;
  }
});



function enterScan(){
  console.log("start");
  hideOverlay();
}


function hideOverlay()
{
 document.getElementById("overlay").remove();
  if (!isTouchDevice) {
    //lock the controls when you first click on the screen
    document.getElementById("crosshair-lines").style.display="block";
    controls.lock();
  } else {
    touchLookEnabled = true;
    document.getElementById("crosshair-lines").style.display = "none";
  }

}

function getPointerAtNdc(ndc) {
  raycaster.setFromCamera(ndc, camera);
  raycaster.layers.enable(0);
  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length === 0) {
    return null;
  }

  const firstHit = intersects[0].object;
  if (firstHit.name !== "pointer") {
    return null;
  }

  return firstHit;
}

function moveCameraToPointer(pointerObject) {
  moving = true;
  const hitPos = pointerObject.parent.parent.parent.position;

  gsap.to(camera.position, {
    duration: 5,
    x: hitPos.x,
    y: hitPos.y + 0.5,
    z: hitPos.z,
    onComplete: () => {
      moving = false;
    },
    ease: "power1.inOut",
  });
}

function screenToNdc(clientX, clientY) {
  return new THREE.Vector2(
    (clientX / window.innerWidth) * 2 - 1,
    -(clientY / window.innerHeight) * 2 + 1
  );
}

function setupTouchControls() {
  const canvas = renderer.domElement;

  canvas.addEventListener(
    "touchstart",
    (event) => {
      if (!touchLookEnabled || loadedAmount < 100 || event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
      touchDragging = false;
      interactionDown = true;
      event.preventDefault();
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchmove",
    (event) => {
      if (!touchLookEnabled || loadedAmount < 100 || event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      const dragDistance = Math.hypot(
        touch.clientX - touchStartX,
        touch.clientY - touchStartY
      );

      if (dragDistance > tapThresholdPx) {
        touchDragging = true;
      }

      const dx = touch.clientX - lastTouchX;
      const dy = touch.clientY - lastTouchY;

      yaw -= dx * touchLookSensitivity;
      pitch -= dy * touchLookSensitivity;
      pitch = THREE.MathUtils.clamp(pitch, -maxPitch, maxPitch);

      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
      event.preventDefault();
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchend",
    (event) => {
      if (!touchLookEnabled || loadedAmount < 100) {
        return;
      }

      interactionDown = false;

      if (!touchDragging && !moving && event.changedTouches.length > 0) {
        const touch = event.changedTouches[0];
        const ndc = screenToNdc(touch.clientX, touch.clientY);
        const pointerHit = getPointerAtNdc(ndc);

        if (pointerHit) {
          moveCameraToPointer(pointerHit);
        }
      }

      event.preventDefault();
    },
    { passive: false }
  );
}

function applyTouchLook() {
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler(pitch, yaw, 0, "YXZ");

  quaternion.setFromEuler(euler);
  camera.quaternion.copy(quaternion);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

}

init();
animate();


