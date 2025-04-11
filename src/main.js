import "./style.css";
import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { gsap } from "gsap";
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

let controls, scene, camera;
let renderer = new THREE.WebGLRenderer();
let loader = new GLTFLoader();
let loadedAmount = 0;

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

let mouseDown = false; // is the mouse pressed down
let moving = false; // is the camera moving between navigation points

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0); 

const Txloader = new RGBELoader();

let pmremGenerator;

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

  //initialise render
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  pmremGenerator = new THREE.PMREMGenerator(renderer);  
  pmremGenerator.compileEquirectangularShader();


  //add lights
  const light = new THREE.AmbientLight(0x404040); // soft white light
  light.intensity= 10;
  scene.add(light);

  //initialise controls
  controls = new PointerLockControls(camera, document.body);

 
}

//called on loop
function animate() {
  requestAnimationFrame(animate);

  //check if main model environment has loaded
  if (loadedAmount == 100) {
    // required if controls.enableDamping or controls.autoRotate are set to true
    controls.update();

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

    // Update raycaster from camera through center of screen
    raycaster.setFromCamera(mouse, camera);
    raycaster.layers.enable(0); // Only raycast layer 0
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      const firstHit = intersects[0].object;

      if (firstHit.name == "pointer") {
        if (mouseDown && !moving) {
          moving = true; // dont check for raycast hits when camera is moving
          const hitPos = firstHit.parent.parent.parent.position;
          
      
          gsap.to(camera.position, {
            duration: 5, // time in seconds
            x: hitPos.x,
            y: hitPos.y + 0.5,
            z: hitPos.z,
            onComplete: () => {
              moving = false;
            },
            ease: "power1.inOut",
          });
        }else if(!moving){
          
          //hover effect


        }
      }
    }

    renderer.render(scene, camera);

  } else {
  
    document.getElementById("percent").innerHTML = loadedAmount;
  }
}

// Load a map
loader.load(
  // resource URL
  "/models/kannonzaki_battery_historic_site.glb",
  // called when the resource is loaded
  function (gltf) {
    scene.add(gltf.scene);


    document.getElementById("enterButton").style.display= "block";


  },
  // called while loading is progressing
  function (xhr) {
    loadedAmount = Math.ceil((xhr.loaded / xhr.total) * 100);
  },
  // called when loading has errors
  function (error) {
    console.log("An error happened");
  }
);

// Load a pointer
loader.load(
  // resource URL
  "/models/map_pointer_3d_icon.glb",
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
Txloader.load('/hdris/sky.hdr', function(hdrTexture) {
  
  const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;

  scene.background = envMap;     // Set as skybox
  scene.environment = envMap;   // Use as environment lighting

  hdrTexture.dispose();         // Clean up
  pmremGenerator.dispose();

});


document.addEventListener("mousedown", () => {
  mouseDown = true;
});

document.addEventListener("mouseup", () => {
  mouseDown = false;
});



function enterScan(){
  console.log("start");
  hideOverlay();
}


function hideOverlay()
{
 document.getElementById("overlay").remove();
  //lock the controls when you first click on the screen
document.getElementById("crosshair-lines").style.display="block";
  controls.lock();

}

init();
animate();


