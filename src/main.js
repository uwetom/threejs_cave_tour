import './style.css'
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';



let controls;
let scene;
let camera;
let renderer = new THREE.WebGLRenderer();
let loader = new GLTFLoader();

let pointers = [];

const clock = new THREE.Clock();
let targetTime = 0;
let framerate = 25;


function init(){

  // Initialize Three.js
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(73, 1.6, 11.6);
 
  camera.lookAt(0, 0, 0);
  renderer = new THREE.WebGLRenderer();
  
  controls = new PointerLockControls( camera, document.body );

  // add event listener to show/hide a UI (e.g. the game's menu)

  document.body.addEventListener('click', function () {
    controls.lock();
  });


  
  const size = 10;
  const divisions = 10;

  const gridHelper = new THREE.GridHelper( size, divisions );
  scene.add( gridHelper );

  const light = new THREE.AmbientLight( 0x404040 ); // soft white light
  scene.add( light );

  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Render the scene
  renderer.render(scene, camera);
}

function animate() {

	requestAnimationFrame( animate );

	// required if controls.enableDamping or controls.autoRotate are set to true
	controls.update();



  if(clock.getElapsedTime() >= targetTime){

   targetTime += 1/framerate;
    pointers[0].rotateY (0.03);
  }




	renderer.render( scene, camera );


}

// Load a map
loader.load(
	// resource URL
	'src/models/kannonzaki_battery_historic_site.glb',
	// called when the resource is loaded
	function ( gltf ) {

		scene.add( gltf.scene );

		gltf.animations; // Array<THREE.AnimationClip>
		gltf.scene; // THREE.Group
		gltf.scenes; // Array<THREE.Group>
		gltf.cameras; // Array<THREE.Camera>
		gltf.asset; // Object

	},
	// called while loading is progressing
	function ( xhr ) {

	},
	// called when loading has errors
	function ( error ) {

		console.log( 'An error happened' );

	}
);

// Load a pointer
loader.load(
	// resource URL
	'src/models/map_pointer_3d_icon.glb',
	// called when the resource is loaded
	function ( gltf ) {

		scene.add( gltf.scene );
    pointers.push(gltf.scene);


		gltf.animations; // Array<THREE.AnimationClip>
		gltf.scene; // THREE.Group
		gltf.scenes; // Array<THREE.Group>
		gltf.cameras; // Array<THREE.Camera>
		gltf.asset; // Object
    //position

    gltf.scene.position.set(50, 1.6, 10.5);



    gltf.scene.scale.set(0.3,0.3,0.3);
    //gltf.scene.rotation.set();

    console.log(gltf.scene.position);

	},
	// called while loading is progressing
	function ( xhr ) {

	},
	// called when loading has errors
	function ( error ) {

		console.log( 'An error happened' );

	}
);



init();
animate();