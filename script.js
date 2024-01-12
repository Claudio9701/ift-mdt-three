import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { LumaSplatsThree, LumaSplatsSemantics } from 'luma-web';


let camera, scene, renderer;

init();

function init() {

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.25, 20);
    camera.position.set(- 1.8, 0.6, 2.7);

    scene = new THREE.Scene();

    let uniformTime = new THREE.Uniform(0);

    let splats = new LumaSplatsThree({
        source: 'https://lumalabs.ai/capture/251afeaa-6802-4017-8ead-6df9b3fdc190',

        // disable loading animation so model is fully rendered after onLoad
        loadingAnimationEnabled: false,
        onBeforeRender: () => {
            uniformTime.value = performance.now() / 100;
        }
    });

    scene.add(splats);

    // filter splats to only show foreground layers
    splats.semanticsMask = LumaSplatsSemantics.BACKGROUND;

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

    scene.fog = new THREE.FogExp2(new THREE.Color(0xe0e1ff).convertLinearToSRGB(), 0.15);
    scene.background = scene.fog.color;

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
    controls.addEventListener('change', render); // use if there is no animation loop
    controls.minDistance = 2;
    controls.maxDistance = 10;
    controls.target.set(0, 0, - 0.2);
    controls.update();

    window.addEventListener('resize', onWindowResize);

    renderer.xr.enabled = true;

    let vrButton = VRButton.createButton(renderer);

    document.body.appendChild(vrButton);

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

    render();

}

//

function render() {

    renderer.render(scene, camera);

}