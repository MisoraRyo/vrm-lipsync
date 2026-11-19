import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRM } from "@pixiv/three-vrm";
import { MToonMaterialLoaderPlugin, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { MToonNodeMaterial } from '@pixiv/three-vrm/nodes';
import { VRMLookAtQuaternionProxy } from "@pixiv/three-vrm-animation";


export async function loadVRM( Model_URL:string, gui:any, FicialParam:any ): Promise<VRM> {

  const loader = new GLTFLoader();

  loader.register((parser) => {
    // WebGL version of the VRMLoaderPlugin
    // return new VRMLoaderPlugin(parser);

    // create a WebGPU compatible MToonMaterialLoaderPlugin
    const mtoonMaterialPlugin = new MToonMaterialLoaderPlugin(parser, {
      // set the material type to MToonNodeMaterial
      materialType: MToonNodeMaterial,
    });

    return new VRMLoaderPlugin(parser, {
      // Specify the MToonMaterialLoaderPlugin to use in the VRMLoaderPlugin instance
      mtoonMaterialPlugin,
    });
  
  });

  return new Promise((resolve, reject) => {
    loader.load(

      Model_URL,

      (gltf) => {

        const vrm = gltf.userData.vrm as VRM;

        if (vrm) {

          console.log("VRM model loaded successfully / version:", vrm.meta.metaVersion);

          if ( vrm == null ) {
              return;
          }

          // calling these functions greatly improves the performance
          VRMUtils.removeUnnecessaryVertices( vrm.scene );
          VRMUtils.combineSkeletons( vrm.scene );

          // Disable frustum culling
          vrm.scene.traverse( ( obj:any ) => {
            obj.frustumCulled = false;

            //@ts-ignore
            if (obj.isMesh) {
              obj.castShadow = true;
              obj.receiveShadow = true;
            }

          });

          // Rotate the VRM model if it is version 1
          if(vrm.meta.metaVersion == "1"){
            vrm.scene.rotation.set( 0, -Math.PI, 0 );
          }

          // Add look at quaternion proxy to the VRM; which is needed to play the look at animation
          // @ts-ignore
          const lookAtQuatProxy = new VRMLookAtQuaternionProxy( vrm.lookAt );
          lookAtQuatProxy.name = 'lookAtQuaternionProxy';
          vrm.scene.add( lookAtQuatProxy );

          ////////////////////////////////////////////////////////////
          // GUI 各種パラメータ
          const FaceMotionFolder = gui.addFolder('Character')
          FaceMotionFolder.open()

          // 表情
          const FicialMotionFolder = FaceMotionFolder.addFolder('Facial').close()
          FicialMotionFolder.add(FicialParam, 'neutral', 0, 1, 0.01).onChange( (value: number) => {
            vrm.expressionManager?.setValue("neutral", value)
          }).listen()
          FicialMotionFolder.add(FicialParam, 'happy', 0, 1, 0.01).onChange( (value: number) => {
            vrm.expressionManager?.setValue("happy", value)
          }).listen()
          FicialMotionFolder.add(FicialParam, 'angry', 0, 1, 0.01).onChange( (value: number) => {
            vrm.expressionManager?.setValue("angry", value)
          }).listen()
          FicialMotionFolder.add(FicialParam, 'relaxed', 0, 1, 0.01).onChange( (value: number) => {
            vrm.expressionManager?.setValue("relaxed", value)
          }).listen()
          FicialMotionFolder.add(FicialParam, 'sad', 0, 1, 0.01).onChange( (value: number) => {
            vrm.expressionManager?.setValue("sad", value)
          }).listen()
          FicialMotionFolder.add(FicialParam, 'surprised', 0, 1, 0.01).onChange( (value: number) => {
            vrm.expressionManager?.setValue("surprised", value)
          }).listen()

          // まばたき
          FicialMotionFolder.add(FicialParam, 'blink', 0, 1, 0.01).onChange( (value: number) => {
            vrm.expressionManager?.setValue("blink", value)
          }).listen().name("blink");
          FicialMotionFolder.add(FicialParam, 'blinkLeft', 0, 1, 0.01).onChange( (value: number) => {
            vrm.expressionManager?.setValue("blinkLeft", value)
          }).listen()
          FicialMotionFolder.add(FicialParam, 'blinkRight', 0, 1, 0.01).onChange( (value: number) => {
            vrm.expressionManager?.setValue("blinkRight", value)
          }).listen()

          // 口もと
          const MouseMotionFolder = FaceMotionFolder.addFolder('Mouse').open()
          MouseMotionFolder.add(FicialParam, 'aa', 0, 1, 0.01).onChange( (value: number) => {
            vrm.expressionManager?.setValue("aa", value)
          }).listen()
          MouseMotionFolder.add(FicialParam, 'ee', 0, 1, 0.01).onChange( (value: number) => {
            vrm.expressionManager?.setValue("ee", value)
          }).listen()
          MouseMotionFolder.add(FicialParam, 'ih', 0, 1, 0.01).onChange( (value: number) => {
            vrm.expressionManager?.setValue("ih", value)
          }).listen()
          MouseMotionFolder.add(FicialParam, 'oh', 0, 1, 0.01).onChange( (value: number) => {
            vrm.expressionManager?.setValue("oh", value)
          }).listen()
          MouseMotionFolder.add(FicialParam, 'ou', 0, 1, 0.01).onChange( (value: number) => {
            vrm.expressionManager?.setValue("ou", value)
          }).listen()


          const loadingText = document.getElementById("loadingText");
          if (loadingText) {
            loadingText.innerText = "VRMモデルのリップシンクデモ";
          }

          resolve(vrm);

        } else {
          reject(new Error("Failed to load VRM from GLTF"));
        }
      },
      () => {
        //console.log('Loading VRM model...')
      },
      (error) => reject(error)
    );

  });
}