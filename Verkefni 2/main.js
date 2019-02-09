let scene, camera, renderer;

let WIDTH  = window.innerWidth; //basic width og height á browser stærðinni
let HEIGHT = window.innerHeight;

let SPEED = 0.01;

//Sá ekki neina breytingu á kubbnum með PointLight og fann ekki hvernig á að nota shaders.
//let light = new THREE.PointLight(0x000000,10);
//light.position.set(0,3.5,5);

function init() { //init fall sem kallar á nokkur built-in föll frá three.min.js
    scene = new THREE.Scene();
    //scene.add(light);
    initCube();
    initCamera();
    initRenderer();

    document.body.appendChild(renderer.domElement); //bætir canvas tagi í html fileið
}

function initCamera() { //hér er fall fyrir staðsetningu "myndavélarinnar" 
    camera = new THREE.PerspectiveCamera(50, WIDTH / HEIGHT, 1, 10); //50 er stærðin, 30 gerir kubbinn stærri.
    //1 og 10 er í raun plássið sem kubburinn hefur,
    //ef 10 er breytt í t.d. 5 þá er bakgrunnurinn nær myndavélinni og minna af kubbnum sést
    //sama gildir um 1, ef því er breytt í t.d. 5 þá fer fremsti hlutinn ef kubbnum, gott gæti verið að breyta þessum tölum ef veggur er staðsettur þarna í einhverskonar 3D modeli
    camera.position.set(0, 3.5, 5); //staðsetningin á myndavélinni
    camera.lookAt(scene.position); //myndavélin "snúin" þannig hún horfir í áttina að scene
}

function initRenderer() { //hér er renderer-inn hafinn með antialiasing til að gera öll horn töluvert meira smooth
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(WIDTH, HEIGHT);
}

function initCube() { //kubburinn sjálfur er búinn til og bætt í scene-ið með stærðinni 2x2x2. fyndið að setja í 0.1x0.1x5 gerir langa stöng
    cube = new THREE.Mesh(new THREE.CubeGeometry(2, 2, 2), new THREE.MeshNormalMaterial());
    scene.add(cube);
    //scene.add(light);
}

function rotateCube() { //einfalt fall til að snúa kubbnum, segir sig sjálft.
    cube.rotation.x -= SPEED;
    cube.rotation.y -= SPEED;
    cube.rotation.z -= SPEED;
    cube.scale.set(2,1,1) //gerir kubbinn lengri
}

function render() { //lokafallið búið til sem kallar í hin
    requestAnimationFrame(render);
    rotateCube();
    renderer.render(scene, camera);
}

init();
render();