import './sanitize.css'
import './style.css'

import * as THREE from 'three/webgpu'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GUI } from 'three/addons/libs/lil-gui.module.min.js'
import Stats from 'three/addons/libs/stats.module.js'

import type { VRM } from '@pixiv/three-vrm'
import { loadVRM } from './VRMLoader'
import { AnimationManager } from "./VRMAnimationManager" //VRMA読み込み
import { VRMLookTarget } from "./VRMLookTarget.ts"; // 目線
import { EyeBlinkController } from "./VRMBlinkContorller.ts"; //まばたき
import { loadAudio } from './AudioLoader.ts'
import { LipSync } from './VRMLipsync'

/**
 * Base
 */

// Canvas
const canvas = document.querySelector<HTMLCanvasElement>('canvas.MyCanvas')!

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

/**
 * Renderer
 */
const renderer = new THREE.WebGPURenderer({
    canvas: canvas,
    antialias: true
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor(0xeeeeee)
await renderer.init()

// GUI
const gui = new GUI()

// Stats
const stats = new Stats()
stats.dom.style.top = 'auto'
stats.dom.style.bottom = '0'
document.body.appendChild(stats.dom)

// Scene
const scene = new THREE.Scene()

// Axis
const axesHelper = new THREE.GridHelper(5, 5, 0xcccccc, 0xcccccc)
scene.add(axesHelper)

/**
 * Camera
 */

// Base camera
const camera = new THREE.PerspectiveCamera(42, sizes.width / sizes.height, 0.1, 100)
camera.position.set(0, 1.35, -0.8)
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.target.set(0, 1.35, 0)
controls.enableDamping = false

controls.update()

// Camera
const cameraGui = gui.addFolder('Camera').close()
cameraGui.add(camera, 'fov', 10, 120, 1).onChange(() => camera.updateProjectionMatrix()).name('FOV')
cameraGui.add(camera.position, 'x', -10, 10, 0.1).onChange(() => controls.update()).name('posX')
cameraGui.add(camera.position, 'y', -10, 10, 0.1).onChange(() => controls.update()).name('posY')
cameraGui.add(camera.position, 'z', -10, 10, 0.1).onChange(() => controls.update()).name('posZ')


/**
 * Lights
 */

/** Directional light **/ 
const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0)
directionalLight.castShadow = true
directionalLight.position.set(2, 1.1, -1.75).normalize().multiplyScalar(10)
directionalLight.shadow.camera.top = 10
directionalLight.shadow.camera.right = 10
directionalLight.shadow.camera.bottom = -10
directionalLight.shadow.camera.left = -10
directionalLight.shadow.camera.near = 0.01
directionalLight.shadow.camera.far = 20
directionalLight.shadow.radius = 5
directionalLight.shadow.normalBias = 0.1
scene.add(directionalLight)

/** Ambient light  **/
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
scene.add(ambientLight)

// Debug
const lightsGui = gui.addFolder('Lights').close()
lightsGui.addColor(directionalLight, 'color').name('directionalColor')
lightsGui.add(directionalLight.position, 'y', 0, 10, 0.01).name('directionalY')
lightsGui.add(directionalLight, 'intensity', 0, 10, 0.01).name('directionalIntensity')
lightsGui.addColor(ambientLight, 'color').name('ambientColor')
lightsGui.add(ambientLight, 'intensity', 0, 5, 0.01).name('ambientIntensity')


/**
 * VRM
 */

let currentVrm: VRM | undefined
const facialParameters = {
    neutral: 0,
    angry: 0,
    happy: 0,
    relaxed: 0,
    sad: 0,
    surprised: 0,
    blink: 0,
    blinkLeft: 0,
    blinkRight: 0,
    aa: 0,
    ee: 0,
    ih: 0,
    oh: 0,
    ou: 0
}

try
{   
    // モデルを読み込みます
    const vrm = await loadVRM('./model/AvatarSample_Y.vrm', gui, facialParameters)
    scene.add(vrm.scene)
    currentVrm = vrm 
}
catch (error)
{
    console.error('VRMの読み込みに失敗しました。', error)
}

/**
 * VRMAnimation
 */

const animationManager = new AnimationManager([
    'Idle', // ここに使用するモーション名を追加
])

const Motion_PATH:any = [
    { url: './motion/idle.vrma', name: 'idle' },
]   

if (currentVrm) {
    animationManager.setVRM(currentVrm)
}   

// motionデータ読み込み
const LoadAnimation = await animationManager.loadAVRMAArray( Motion_PATH );

// motionの作動
animationManager.playAnimation("idle", 0.2, true);

// VRM Look Target
const VRMLook = new VRMLookTarget();
if (currentVrm) {
    VRMLook.setVRM(currentVrm, camera, gui);
}
// VRMLook.EyeTarget(px,py); その方向を向きます(-1~1)
// VRMLook.targetAnimation(0.0, 1.0, 0.5); // X,Y,duration
// VRMLook.YosomiAnimation(); //よそ見するアニメーション（目線方向はランダム）

// まばたき
let NowExpression: any = "neutral";
// 基本の喜怒哀楽時、まばたきのパラメータ
const BlinkParam = {
  neutral:0.90,
  happy:0.00,
  angry:0.88,
  sad:0.86,
  relaxed:0.87,
  surprised:1.00,
}

let VRMBlinkController: EyeBlinkController | undefined
if (currentVrm) {
    VRMBlinkController = new EyeBlinkController( currentVrm, NowExpression, facialParameters, BlinkParam, VRMLook );
    VRMBlinkController.EyeStart();// 目パチ（まばたき）スタート
    // VRMBlinkController.updateExpression(NowExpression); //RenderLoopで使用
    // VRMBlinkController.EyeStart()
    // VRMBlinkController.EyeStop()
    // VRMBlinkController.EyeOnceShot()
}


// いまの表情を設定するGUI
const expressionSettings = {
  expression: NowExpression as keyof typeof BlinkParam,
}
// @ts-ignore
gui.add(expressionSettings, 'expression', Object.keys(BlinkParam))
  .name('いまの表情（まばたきに影響）')
  .onChange((value: keyof typeof BlinkParam) => {
    NowExpression = value
})

/**
 * Lipsync
 */

const lipSync = new LipSync(facialParameters)

if (currentVrm) {
    // VRMをLipSyncに設定
    lipSync.setVRM(currentVrm)
}

// 音声の再生の管理フラグ
let isVoicePlaying = false
// 音声ファイルのパスリスト
const Audio_PATH = [
   { url: "./voice/voice01.mp3", name: "lady", text:"__" },
   { url: "./voice/voice02.mp3", name: "lady", text:"__" },
   { url: "./voice/voice03.mp3", name: "lady", text:"__" },
];

const voiceControls = {
    selectedAudio: 0,
    play: async () => {
        if (isVoicePlaying) return

        if (!currentVrm) {
            console.error('VRMが読み込まれていません。')
            return
        }

        isVoicePlaying = true

        try {
            const selectedAudio = Audio_PATH[voiceControls.selectedAudio]
            if (!selectedAudio) {
                throw new Error('選択された音声が見つかりません。')
            }
            const audioData = await loadAudio([selectedAudio])
            await lipSync.playLoadAudio(audioData[0])

        } catch (error) {
            console.error('音声を再生できませんでした。', error)
        } finally {
            isVoicePlaying = false
        }
    },

    stop: async () => {
        if (!isVoicePlaying) return
        isVoicePlaying = false
        await lipSync.stopAudio()
    }

}

// Audioコントロール用のGUIフォルダ
const AudioFolder = gui.addFolder('Audio')
const audioOptions = Object.fromEntries(
    Audio_PATH.map((audio, index) => [`音声 ${index + 1} (${audio.url.split('/').pop()})`, index])
)
AudioFolder.add(voiceControls, 'selectedAudio', audioOptions).name('音声を選択')
const playButton = AudioFolder.add(voiceControls, 'play').name('音声を再生')
AudioFolder.add(voiceControls, 'stop').name('音声を停止')

playButton.domElement.style.setProperty('--widget-color', '#e53935')
playButton.domElement.style.setProperty('--hover-color', '#c62828')
playButton.domElement.style.setProperty('--focus-color', '#b71c1c')

/**
 * Animate
 */
const clock = new THREE.Clock()

const tick = () =>
{
    stats.begin()
    const deltaTime = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();
    
    // Update controls
    controls.update()

    //
    if(currentVrm) {

        if(LoadAnimation){
            animationManager.update(deltaTime) // VRMとcurrentMixerをupdate
            //animationManager.debug()
            animationManager.eventFinish()// currentMixerからアクションの終了を検知する
        }

        // LipSyncのaudioコンテキスト
        lipSync.update(deltaTime);

        // 目のハイライトを回転
        // @ts-ignore
        if(currentVrm.expressionManager && currentVrm.expressionManager._expressionMap.custom_highLight){
          // @ts-ignore
          facialParameters.custom_highLight = Math.sin(elapsedTime * 8) * 0.5+0.5;
          // @ts-ignore
          currentVrm.expressionManager.setValue("custom_highLight", facialParameters.custom_highLight);
        }

        //表情に応じて、目パチを設定をアップデート
        if (VRMBlinkController) {
            VRMBlinkController.updateExpression(NowExpression);
        }

        currentVrm.update(deltaTime);
    }

    // Render
    renderer.render(scene, camera)
    stats.end()
}

renderer.setAnimationLoop(tick)
console.log(renderer.backend)


window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})