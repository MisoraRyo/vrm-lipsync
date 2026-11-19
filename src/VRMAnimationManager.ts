import { VRM } from "@pixiv/three-vrm"
import * as THREE from "three"
import gsap from "gsap"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { createVRMAnimationClip, VRMAnimationLoaderPlugin } from "@pixiv/three-vrm-animation"

let activeAction: any  = undefined;
let lastAction: any  = undefined;

const gsapAnimations = new Map();//  追加 - 03/27 -

interface MotionConfig {
    url: string;
    name: string;
}

export class AnimationManager {
    private vrm: VRM | null = null;
    private currentMixer: THREE.AnimationMixer | null = null;
    private animations: Map<string, THREE.AnimationAction> = new Map();
    private loader: GLTFLoader;
    public currentEmotion: string | null = null;
    public nextStandardMotion: number;
    private AllLoadAnimationData: any ;
    private AllLoadAnimationEmotionName: any ;
    private IdlingMotion: any;
    // Easing
    private easeInOutSine: (x: number) => number = (x: number): number => {
        return -(Math.cos(Math.PI * x) - 1) / 2;
    }

    constructor( montionArray: string[] ) {
        this.loader = new GLTFLoader();
        this.loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
        this.eventFinish = this.eventFinish.bind(this);
        this.nextStandardMotion = 0;
        this.AllLoadAnimationData = [];
        this.AllLoadAnimationEmotionName = [];
        this.IdlingMotion = montionArray;
    }

    public setVRM(vrm: VRM) {
        this.vrm = vrm;
        this.currentMixer = new THREE.AnimationMixer(vrm.scene);
    }

    // モーションをひとつひとつ読み込ませる
    async loadVRMA(emotion: string, url: string) {

        return new Promise<void>((resolve, reject) => {

            this.loader.load(
                url,
                (gltf) => {

                    const vrmAnimations = gltf.userData.vrmAnimations;

                    if (vrmAnimations == null) {
                        return;
                    }

                    const currentVrmAnimation = vrmAnimations[0] ?? null;

                    // 読み込んだすべてのアニメーションデータを保存する
                    this.AllLoadAnimationData.push(currentVrmAnimation);
                    this.AllLoadAnimationEmotionName.push(emotion);

                    if (this.vrm && currentVrmAnimation) {
                        const clip = createVRMAnimationClip(currentVrmAnimation, this.vrm);
                        this.addAnimation(emotion, clip);
                        resolve();
                    }else{
                        console.error(`Failed to load VRMA or create animation clip for emotion: ${emotion}`);
                        reject(new Error("Failed to load VRMA or create animation clip"));
                    }
                },
                (progress) =>{
                    //console.log(`Loading VRMA ${emotion}:`, (progress.loaded / progress.total) * 100, '%')
                },
                (error) => {
                    console.error(`Error loading VRMA for emotion ${emotion}:`, error);
                    reject(error);
                }
            );

        });

    }

    // 配列形式のモーションをいっきに読み込ませる
    async loadAVRMAArray( Motion_PATH : MotionConfig[] ): Promise<any> {

        return new Promise((resolve, reject) => {

            Motion_PATH.forEach((data) => {
                
                this.loader.load(
                    data.url,
                    (gltf) => {

                        const vrmAnimations = gltf.userData.vrmAnimations;

                        if (vrmAnimations == null) {
                            return;
                        }

                        const currentVrmAnimation = vrmAnimations[0] ?? null;

                        // 読み込んだすべてのアニメーションデータを保存する
                        this.AllLoadAnimationData.push(currentVrmAnimation);
                        this.AllLoadAnimationEmotionName.push( data.name );

                        if (this.vrm && currentVrmAnimation) {
                            const clip = createVRMAnimationClip(currentVrmAnimation, this.vrm);
                            this.addAnimation(data.name, clip);
                            //resolve(vrmAnimations);

                        }else{
                            console.error(`Failed to load VRMA or create animation clip for emotion: ${data.name}`);
                            reject(new Error("Failed to load VRMA or create animation clip"));
                        }

                        // 全てのモーションファイルが読み込まれたら
                        if ( this.animations.size === Motion_PATH.length) {
                            console.log("All VRMA File loaded successfully");
                            resolve(true);// true を返す
                        }

                    },
                    (progress) =>{
                        //console.log(`Loading VRMA ${data.name}:`, (progress.loaded / progress.total) * 100, '%')
                    },
                    (error) => {
                        console.error(`Error loading VRMA for emotion ${data.name}:`, error);
                        reject(error);
                    }
                );

            })

        });
    }

    // アニメーションを追加するヘルパー関数
    private addAnimation(name: string, clip: THREE.AnimationClip): void{
        if (this.currentMixer) {
            const action = this.currentMixer.clipAction(clip);
            this.animations.set(name, action);
        }
    }

    // アニメーションを再生する関数
    public playAnimation(emotion: string, FadeInOutduration: number, loop: boolean) {

        if(this.currentEmotion === emotion) return;

        //console.log("playAnimation:",emotion);// 何のアニメーションが再生されたか確認用
        
        // playAnimation メソッド内
        const easeInOutSine = this.easeInOutSine

        if (lastAction && gsapAnimations.has(lastAction)) {
            gsapAnimations.get(lastAction).kill();
            gsapAnimations.delete(lastAction);
            lastAction.weight = 0.0; // 追加: weightリセット
        }
        if (activeAction && gsapAnimations.has(activeAction)) {
            gsapAnimations.get(activeAction).kill();
            gsapAnimations.delete(activeAction);
            //activeAction.weight = 0.0; // 追加: weightリセット
        }

        activeAction = this.animations.get(emotion);
        lastAction = this.currentEmotion ? this.animations.get(this.currentEmotion) : null;

        if (activeAction) {

            if (lastAction) {
                // GSAPでアニメーションのweightをイージングで変更
                const fadeOutAnim = gsap.to(lastAction, {
                    weight: 1, // weightを0にして非表示
                    duration: FadeInOutduration, // イージングの継続時間
                    onUpdate: function(){
                        // Deltatimeの計算
                        const currentProgress = easeInOutSine(this.progress()); // 現在の進捗（0〜1）
                        lastAction.weight = 1.0 - currentProgress;
                    },
                    onComplete: () => {
                        lastAction.stop() // 完了時にアニメーションを停止
                        lastAction.weight = 0.0; // 完了時にweightを0にリセット
                        gsapAnimations.delete(lastAction); // Mapから削除
                    }
                });
                //
                gsapAnimations.set(lastAction, fadeOutAnim); // Mapに登録
            }

            if(loop){
                activeAction.loop = THREE.LoopRepeat
            }else{
                activeAction.loop = THREE.LoopOnce
                activeAction.clampWhenFinished = true
            }

            activeAction.reset()
            activeAction.weight = 0.0
            activeAction.timeScale = 1.0
            //
            this.currentEmotion = emotion;

            activeAction.play();
            console.log("Animation finished:", this.currentEmotion);

            // GSAPでアニメーションのweightをイージングで変更
            const fadeInAnim = gsap.to(activeAction, {
                weight: 0, // weightを1にして表示
                duration: FadeInOutduration, // イージングの継続時間
                onUpdate: function(){
                    // Deltatimeの計算
                    const currentProgress = easeInOutSine(this.progress()); // 現在の進捗（0〜1）
                    activeAction.weight = currentProgress;
                },
                onComplete: () =>{
                    activeAction.weight = 1.0
                }
            });

            gsapAnimations.set(activeAction, fadeInAnim); // Mapに登録

            // アニメーションの終了処理
            if (this.currentMixer) {
                this.currentMixer.addEventListener('finished', () => {

                })
            }

            // 次の終了処理のための
            setTimeout(() => {
                //this.nextStandardMotion = this.getRandomDifferentNumber(this.nextStandardMotion);
                //this.nextStandardMotion = (this.nextStandardMotion + 1) % this.IdlingMotion.length;
                // 順番に再生していきます
                this.nextStandardMotion = (this.nextStandardMotion + 1) % this.IdlingMotion.length;
            }, 100);

        }
    }

    // いま保持している番号以外のランダムな番号を１つ選ぶ
    // @ts-ignore
    private getRandomDifferentNumber(currentNumber:number): number{
        const numbers:any = [];
        for (let i = 0; i < this.IdlingMotion.length; i++) {
            numbers.push(i);
        }
        //@ts-ignore
        const filteredNumbers = numbers.filter(num => num !== currentNumber);
        const randomIndex = Math.floor(Math.random() * filteredNumbers.length);
        return filteredNumbers[randomIndex];
    }

    // アニメーションの更新
    public update(deltaTime: number): void{
        if (this.currentMixer) {
            this.currentMixer.update(deltaTime);
        }
    }

    // 経過時間を表示させるデバッグ
    public debug(): void{
        if (this.currentMixer) {
          //AnimeText.innerHTML = "<span> AnimDuration[ " + this.currentEmotion + " ]: " + Math.floor(activeAction.time*1000) / 1000 + " / "+ activeAction._clip.duration.toFixed(3)  + "</span>"
        }
    }

    // アニメーションが終了したら呼ばれる　アニメーションのループ設定時は呼ばれない
    public eventFinish(): void{
        if (this.currentMixer) {
            this.currentMixer.addEventListener('finished', () => {
                this.playAnimation( this.IdlingMotion[this.nextStandardMotion], 1.0, false)
            });
        }
    }

    // 新たに読み込まれたVRMにアニメーションをセットする
    public set_VRMA_AllAnimation(vrm: VRM): void{
        this.vrm = vrm;
        this.currentMixer = new THREE.AnimationMixer(vrm.scene);
        this.currentEmotion = null;

        //@ts-ignore
        this.AllLoadAnimationData.forEach((element, index) => {

            if (this.vrm && element) {
                const clip = createVRMAnimationClip(element, this.vrm);
                this.addAnimation(this.AllLoadAnimationEmotionName[index], clip);
            }

        });
    }

    public hasAnimation(name: string): boolean{
        return this.animations.has(name);
    }

}