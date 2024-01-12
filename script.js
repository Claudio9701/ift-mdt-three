import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { LumaSplatsThree, LumaSplatsSemantics } from 'luma-web';


let camera, scene, renderer, model;

const raycaster = new THREE.Raycaster();
let pointerPosition = { x: 0, y: 0 };
window.addEventListener('click', (event) => {

    pointerPosition.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointerPosition.y = - (event.clientY / window.innerHeight) * 2 + 1;

    console.log('click', pointerPosition)
});

let keyPressed;
window.addEventListener('keydown', (event) => {
    console.log('keydown', event.key)
    keyPressed = event.key;
});

// Add a dropdown menu to select the luma source
let select = document.createElement('select');
select.id = 'source';

// Options
let options = [
    'La Defense Statue',
    'IFT 6th floor space',
    'IFT Staff Room'
];
let values = [
    'https://lumalabs.ai/capture/ddc47b58-fe0e-4c99-ba45-f9ab2a1bf5f6',
    'https://lumalabs.ai/capture/97352f55-c5f2-42d4-a867-ed676acfd90b',
    'https://lumalabs.ai/capture/251afeaa-6802-4017-8ead-6df9b3fdc190'
];

for (let i = 0; i < options.length; i++) {
    let option = document.createElement('option');
    option.value = values[i];
    option.text = options[i];
    select.appendChild(option);
}

select.onchange = () => {
    // remove scene
    scene.remove(scene.children[0]);
    // free memory
    renderer.dispose();
    init(select.value);
    animate();
};
document.body.appendChild(select);
select.value = values[0];

// Add a menu to show controls
let menu = document.createElement('div');
menu.id = 'menu';
menu.innerHTML = `
    <div id="menu-content">
        <h1>Controls</h1>
        <p>WASD or Arrows: Move the object</p>
        <p>EQ: Move the object up and down</p>
        <p>KLNM: Rotate the object</p>
        <p>ZX: Scale the object</p>
        <p>Click: Select an object</p>
    </div>
`;
document.body.appendChild(menu);
// Toggle menu on/off with a button
let menuButton = document.createElement('button');
menuButton.id = 'menu-button';
menuButton.innerHTML = 'x';
// Add an event listener to the button
menuButton.onclick = () => {
    if (menu.style.display === 'none') {
        menu.style.display = 'block';
        menuButton.innerHTML = 'x';
    } else {
        menu.style.display = 'none';
        menuButton.innerHTML = 'o';
    }
}
document.body.appendChild(menuButton);

// Create a progress bar
let progress = document.createElement('div');
progress.id = 'progress';
let progressBar = document.createElement('div');
progressBar.id = 'progress-bar';
// Add the progress bar to the page
progress.appendChild(progressBar);
document.body.appendChild(progress);

var manager = new THREE.LoadingManager();
manager.onProgress = function (item, loaded, total) {
    console.log("Percent loaded: " + Math.round(loaded / total * 100) + " %");
    progressBar.style.width = (loaded / total * 100) + '%';
    if (loaded / total * 100 === 100) {
        // wait 1 second before hiding the progress bar
        setTimeout(() => {
            progress.style.display = 'none';
        }, 1000);
    }
};

init(select.value);

function init(source) {

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.25, 20);
    camera.position.set(- 1.8, 0.6, 2.7);

    scene = new THREE.Scene();

    let uniformTime = new THREE.Uniform(0);

    let splats = new LumaSplatsThree({
        // La Defense Statue
        source: source,
        // disable loading animation so model is fully rendered after onLoad
        loadingAnimationEnabled: true,
        onBeforeRender: () => {
            uniformTime.value = performance.now() / 100;
        },
    });

    splats.onLoad = () => {
        splats.captureCubemap(renderer).then(capturedTexture => {
            scene.environment = capturedTexture;
            scene.background = capturedTexture;
            scene.backgroundBlurriness = 0.5;
        });
    }

    scene.add(splats);

    // filter splats to only show foreground layers
    splats.semanticsMask = LumaSplatsSemantics.FOREGROUND | LumaSplatsSemantics.BACKGROUND;

    // move camera to ideal viewing position
    splats.onInitialCameraTransform = transform => {
        camera.matrix.copy(transform);
        camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
        camera.position.y = 0.25;
    };

    // load glb
    let loader = new GLTFLoader(manager);
    loader.load('models/gltf/a2301035b201_model.glb', (gltf) => {
        model = gltf.scene;
        model.position.y = 0.5;
        model.position.x = 0;
        model.position.z = -2;
        // rotate
        model.rotation.y = Math.PI / 2;

        scene.add(model);
    });

    scene.fog = new THREE.FogExp2(new THREE.Color(0xe0e1ff).convertLinearToSRGB(), 0.15);
    scene.background = scene.fog.color;

    splats.setShaderHooks({
        vertexShaderHooks: {
            additionalUniforms: {
                time_s: ['float', uniformTime],
            },

            getSplatTransform: /*glsl*/`
                (vec3 position, uint layersBitmask) {
                    // sin wave on x-axis
                    float x = 0.;
                    float z = 0.;
                    float y = sin(position.x * 1.0 + time_s) * 0.1;
                    return mat4(
                        1., 0., 0., 0,
                        0., 1., 0., 0,
                        0., 0., 1., 0,
                        x,  y,  z, 1.
                    );
                }
            `,
        }
    });

    const canvas = document.getElementById('canvas');
    // Create a WebGLRenderer and set its width and height
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        // Antialiasing is used to smooth the edges of what is rendered
        antialias: false
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;


    const controls = new OrbitControls(camera, canvas);
    // controls.addEventListener('change', render); // use if there is no animation loop
    controls.minDistance = 2;
    controls.maxDistance = 100;
    controls.target.set(0, 0, - 0.2);
    controls.update();

    window.addEventListener('resize', onWindowResize);

    renderer.xr.enabled = true;

    let vrButton = VRButton.createButton(renderer);

    document.body.appendChild(vrButton);

    render();
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

    render();

}

function render() {

    renderer.render(scene, camera);
    animate();

}

function controlObjectKeys() {
    if (!keyPressed) return;
    // Move the object forward (w, W or up arrow)
    if (keyPressed === "W" || keyPressed === "w" || keyPressed === "ArrowUp") {
        model.position.z -= 0.1;
        keyPressed = null;
    }
    // Move the object backward
    if (keyPressed === "S" || keyPressed === "s" || keyPressed === "ArrowDown") {
        model.position.z += 0.1;
        keyPressed = null;
    }
    // Move the object to the left
    if (keyPressed === "A" || keyPressed === "a" || keyPressed === "ArrowLeft") {
        model.position.x += 0.1;
        keyPressed = null;
    }
    // Move the object to the right
    if (keyPressed === "D" || keyPressed === "d" || keyPressed === "ArrowRight") {
        model.position.x -= 0.1;
        keyPressed = null;
    }
    // Move the object up
    if (keyPressed === "E" || keyPressed === "e") {
        model.position.y += 0.1;
        keyPressed = null;
    }
    // Move the object down
    if (keyPressed === "Q" || keyPressed === "q") {
        model.position.y -= 0.1;
        keyPressed = null;
    }

    // Rotate the object to the left
    if (keyPressed === "K" || keyPressed === "k") {
        model.rotation.y -= 0.1;
        keyPressed = null;
    }
    // Rotate the object to the right
    if (keyPressed === "L" || keyPressed === "l") {
        model.rotation.y += 0.1;
        keyPressed = null;
    }
    // Rotate the object up
    if (keyPressed === "N" || keyPressed === "n") {
        model.rotation.x -= 0.1;
        keyPressed = null;
    }
    // Rotate the object down
    if (keyPressed === "M" || keyPressed === "m") {
        model.rotation.x += 0.1;
        keyPressed = null;
    }

    // Scale the object up
    if (keyPressed === "Z" || keyPressed === "z") {
        model.scale.x += 0.1;
        model.scale.y += 0.1;
        model.scale.z += 0.1;
        keyPressed = null;
    }
    // Scale the object down
    if (keyPressed === "X" || keyPressed === "x") {
        model.scale.x -= 0.1;
        model.scale.y -= 0.1;
        model.scale.z -= 0.1;
        keyPressed = null;
    }

}

function animate() {

    renderer.setAnimationLoop(render);

    controlObjectKeys();

    // update the picking ray with the camera and mouse position
    raycaster.setFromCamera(pointerPosition, camera);



    if (model) {
        // calculate objects intersecting the picking ray
        const intersects = raycaster.intersectObjects(scene.children, true);
        model.traverse((child) => {
            if (child.isMesh) {
                if (intersects.length > 0) {
                    console.log('intersects', intersects)
                    child.material.color.set(0xff0000);
                } else {
                    console.log('no intersects')
                    child.material.color.set(0xffffff);
                }
            }
        });
    };
}


